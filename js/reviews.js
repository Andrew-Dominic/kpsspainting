/**
 * KPSS Painting — Reviews System
 * Firebase Firestore for review data + Cloudinary for photo uploads
 * Shared between index.html (teaser) and reviews.html (full page)
 */
(function () {
    'use strict';

    // ===================== CONFIG =====================
    const FIREBASE_CONFIG = {
        apiKey: "AIzaSyA-VT-FFZyJmdDKRnLFpCdqOvHZhBiOPRQ",
        authDomain: "kpss-painting.firebaseapp.com",
        projectId: "kpss-painting",
        storageBucket: "kpss-painting.firebasestorage.app",
        messagingSenderId: "1060145692690",
        appId: "1:1060145692690:web:d259698417bb00c38d98cb",
        measurementId: "G-1PNH4H8SF1"
    };

    const CLOUDINARY_CLOUD_NAME = 'dhaq1sdr2';
    // ⚠️  Create an UNSIGNED upload preset in Cloudinary Dashboard:
    //     Settings → Upload → Upload Presets → Add → Signing Mode: Unsigned → Save
    //     Then paste the preset name below:
    const CLOUDINARY_UPLOAD_PRESET = 'kpss-review';

    const COLLECTION_NAME = 'reviews';
    const MAX_PHOTOS = 5;
    const MAX_PHOTO_SIZE_PX = 1200; // Compress to max 1200px
    const PHOTO_QUALITY = 0.75;

    // Seed data — shown when Firestore is empty or unavailable
    const SEED_REVIEWS = [
        {
            id: 'seed-1',
            name: 'M. Johnson',
            rating: 5,
            text: 'KPSS Painting did an amazing job on our home. Very neat and professional — couldn\'t be happier with the result. The finish is absolutely flawless.',
            timestamp: new Date('2025-11-15'),
            photos: [],
            location: 'Sydney, NSW',
            isSeed: true
        },
        {
            id: 'seed-2',
            name: 'R. Patel',
            rating: 5,
            text: 'Affordable pricing and excellent finishing. They completed everything on time with zero mess left behind. Highly recommended to anyone looking for a reliable painter.',
            timestamp: new Date('2025-12-02'),
            photos: [],
            location: 'Parramatta, NSW',
            isSeed: true
        },
        {
            id: 'seed-3',
            name: 'L. Chen',
            rating: 5,
            text: 'Outstanding quality service. The team was professional, punctual, and the finish exceeded our expectations. We\'ll definitely be using KPSS again for our next project.',
            timestamp: new Date('2026-01-20'),
            photos: [],
            location: 'North Sydney, NSW',
            isSeed: true
        }
    ];

    // ===================== STATE =====================
    let db = null;
    let firebaseReady = false;
    let allReviews = [];
    let currentSort = 'newest';
    let currentFilter = null; // null = all, 1-5 = star filter
    let selectedRating = 0;
    let selectedPhotos = []; // { file, dataUrl }
    let isSubmitting = false;

    // Detect page context
    const isFullPage = document.body.classList.contains('reviews-page');

    // ===================== FIREBASE INIT =====================
    function initFirebase() {
        try {
            if (typeof firebase === 'undefined') {
                console.warn('Firebase SDK not loaded');
                return false;
            }
            if (!firebase.apps.length) {
                firebase.initializeApp(FIREBASE_CONFIG);
            }
            db = firebase.firestore();
            firebaseReady = true;
            return true;
        } catch (e) {
            console.warn('Firebase init failed:', e);
            return false;
        }
    }

    // ===================== FIRESTORE CRUD =====================
    function loadReviews() {
        if (!firebaseReady || !db) {
            renderReviews(SEED_REVIEWS);
            return;
        }

        showSkeletons();

        db.collection(COLLECTION_NAME)
            .orderBy('timestamp', 'desc')
            .onSnapshot(
                (snapshot) => {
                    const liveReviews = snapshot.docs.map(doc => {
                        const d = doc.data();
                        return {
                            id: doc.id,
                            name: d.name || 'Anonymous',
                            rating: d.rating || 5,
                            text: d.text || '',
                            timestamp: d.timestamp ? d.timestamp.toDate() : new Date(),
                            photos: d.photos || [],
                            location: d.location || '',
                            isSeed: false
                        };
                    });

                    // Merge live reviews with seeds (seeds at the end if fewer live reviews)
                    if (liveReviews.length === 0) {
                        allReviews = [...SEED_REVIEWS];
                    } else {
                        allReviews = [...liveReviews, ...SEED_REVIEWS];
                    }
                    renderReviews(applyFilters(allReviews));
                },
                (error) => {
                    console.warn('Firestore listen error:', error);
                    allReviews = [...SEED_REVIEWS];
                    renderReviews(allReviews);
                }
            );
    }

    async function submitReviewToFirestore(reviewData) {
        if (!firebaseReady || !db) {
            throw new Error('Firebase is not configured yet.');
        }
        await db.collection(COLLECTION_NAME).add({
            name: reviewData.name,
            rating: reviewData.rating,
            text: reviewData.text,
            photos: reviewData.photos,
            location: reviewData.location || '',
            timestamp: firebase.firestore.FieldValue.serverTimestamp()
        });
    }

    // ===================== CLOUDINARY UPLOAD =====================
    async function compressImage(file) {
        return new Promise((resolve) => {
            const img = new Image();
            const reader = new FileReader();
            reader.onload = (e) => {
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    let w = img.width, h = img.height;
                    if (w > MAX_PHOTO_SIZE_PX || h > MAX_PHOTO_SIZE_PX) {
                        if (w > h) { h = (h / w) * MAX_PHOTO_SIZE_PX; w = MAX_PHOTO_SIZE_PX; }
                        else { w = (w / h) * MAX_PHOTO_SIZE_PX; h = MAX_PHOTO_SIZE_PX; }
                    }
                    canvas.width = w;
                    canvas.height = h;
                    canvas.getContext('2d').drawImage(img, 0, 0, w, h);
                    canvas.toBlob((blob) => resolve(blob), 'image/jpeg', PHOTO_QUALITY);
                };
                img.src = e.target.result;
            };
            reader.readAsDataURL(file);
        });
    }

    async function uploadToCloudinary(file) {
        const compressed = await compressImage(file);
        const formData = new FormData();
        formData.append('file', compressed);
        formData.append('upload_preset', CLOUDINARY_UPLOAD_PRESET);
        formData.append('folder', 'kpss_reviews');

        const response = await fetch(
            `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/image/upload`,
            { method: 'POST', body: formData }
        );

        if (!response.ok) {
            const err = await response.json().catch(() => ({}));
            throw new Error(err.error?.message || 'Photo upload failed');
        }
        const data = await response.json();
        return data.secure_url;
    }

    // ===================== SORTING / FILTERING =====================
    function applyFilters(reviews) {
        let result = [...reviews];

        // Star filter
        if (currentFilter !== null) {
            result = result.filter(r => r.rating === currentFilter);
        }

        // Sort
        switch (currentSort) {
            case 'newest': result.sort((a, b) => b.timestamp - a.timestamp); break;
            case 'oldest': result.sort((a, b) => a.timestamp - b.timestamp); break;
            case 'highest': result.sort((a, b) => b.rating - a.rating || b.timestamp - a.timestamp); break;
            case 'lowest': result.sort((a, b) => a.rating - b.rating || b.timestamp - a.timestamp); break;
            case 'photos': result = result.filter(r => r.photos && r.photos.length > 0); result.sort((a, b) => b.timestamp - a.timestamp); break;
        }
        return result;
    }

    // ===================== TIME FORMAT =====================
    function timeAgo(date) {
        const seconds = Math.floor((new Date() - date) / 1000);
        if (seconds < 60) return 'Just now';
        const minutes = Math.floor(seconds / 60);
        if (minutes < 60) return `${minutes}m ago`;
        const hours = Math.floor(minutes / 60);
        if (hours < 24) return `${hours}h ago`;
        const days = Math.floor(hours / 24);
        if (days < 30) return `${days}d ago`;
        const months = Math.floor(days / 30);
        if (months < 12) return `${months}mo ago`;
        return date.toLocaleDateString('en-AU', { month: 'short', year: 'numeric' });
    }

    // ===================== RENDER =====================
    function starsHTML(rating, size) {
        const cls = size === 'sm' ? 'star-icon' : 'star-icon';
        let html = '';
        for (let i = 1; i <= 5; i++) {
            html += `<span class="${cls} ${i <= rating ? 'filled' : 'empty'}">★</span>`;
        }
        return html;
    }

    function renderReviewCard(review) {
        const initial = review.name.charAt(0).toUpperCase();
        const photosHTML = review.photos.length
            ? `<div class="review-photos">${review.photos.map(url =>
                `<img src="${url}" alt="Review photo" class="review-photo-thumb" onclick="window.KPSSReviews.openLightbox('${url}')" loading="lazy">`
            ).join('')}</div>`
            : '';

        const textClass = review.text.length > 200 ? 'review-text clamped' : 'review-text';
        const readMore = review.text.length > 200
            ? `<button class="review-read-more" onclick="this.previousElementSibling.classList.toggle('clamped');this.textContent=this.textContent==='Read more'?'Show less':'Read more'">Read more</button>`
            : '';

        const locationHTML = review.location ? ` · ${review.location}` : '';

        return `
      <div class="review-card">
        <div class="review-card-header">
          <div class="review-avatar">${initial}</div>
          <div class="review-meta">
            <div class="review-author">${escapeHTML(review.name)}</div>
            <div class="review-date">${timeAgo(review.timestamp)}${locationHTML}</div>
          </div>
        </div>
        <div class="review-stars">${starsHTML(review.rating)}</div>
        <div class="${textClass}">${escapeHTML(review.text)}</div>
        ${readMore}
        ${photosHTML}
      </div>
    `;
    }

    function renderReviews(reviews) {
        const grid = document.getElementById('reviewsGrid');
        if (!grid) return;

        if (reviews.length === 0) {
            grid.innerHTML = `
        <div class="reviews-empty">
          <div class="reviews-empty-icon">✍</div>
          <div class="reviews-empty-title">No reviews yet</div>
          <div class="reviews-empty-text">Be the first to share your experience with KPSS Painting.</div>
        </div>
      `;
            return;
        }

        // On the index page, only show first 6
        const displayReviews = isFullPage ? reviews : reviews.slice(0, 6);
        grid.innerHTML = displayReviews.map(renderReviewCard).join('');
        renderSummary();
    }

    function renderSummary() {
        const summaryEl = document.getElementById('reviewsSummary');
        if (!summaryEl) return;

        const reviews = allReviews;
        if (reviews.length === 0) return;

        const avg = reviews.reduce((sum, r) => sum + r.rating, 0) / reviews.length;
        const dist = [0, 0, 0, 0, 0]; // index 0 = 1 star, index 4 = 5 star
        reviews.forEach(r => dist[r.rating - 1]++);
        const maxCount = Math.max(...dist, 1);

        summaryEl.innerHTML = `
      <div class="reviews-big-rating">
        <div class="reviews-big-num">${avg.toFixed(1)}</div>
        <div class="reviews-big-stars">${starsHTML(Math.round(avg))}</div>
        <div class="reviews-big-count">${reviews.length} review${reviews.length !== 1 ? 's' : ''}</div>
      </div>
      <div class="reviews-distribution">
        ${[5, 4, 3, 2, 1].map(star => {
            const count = dist[star - 1];
            const pct = (count / maxCount) * 100;
            const activeClass = currentFilter === star ? 'active' : '';
            return `
            <div class="dist-row ${activeClass}" onclick="window.KPSSReviews.filterByStar(${star})">
              <span class="dist-label">${star} star${star !== 1 ? 's' : ''}</span>
              <div class="dist-bar-wrap"><div class="dist-bar-fill" style="width:${pct}%"></div></div>
              <span class="dist-count">${count}</span>
            </div>
          `;
        }).join('')}
      </div>
    `;
    }

    function showSkeletons() {
        const grid = document.getElementById('reviewsGrid');
        if (!grid) return;
        const count = isFullPage ? 6 : 3;
        grid.innerHTML = Array(count).fill(`
      <div class="review-skeleton">
        <div class="skeleton-header">
          <div class="skeleton-avatar skeleton-line"></div>
          <div class="skeleton-meta">
            <div class="skeleton-name skeleton-line"></div>
            <div class="skeleton-date skeleton-line"></div>
          </div>
        </div>
        <div class="skeleton-stars skeleton-line"></div>
        <div class="skeleton-text-1 skeleton-line"></div>
        <div class="skeleton-text-2 skeleton-line"></div>
        <div class="skeleton-text-3 skeleton-line"></div>
      </div>
    `).join('');
    }

    // ===================== MODAL =====================
    function openModal() {
        const overlay = document.getElementById('reviewModalOverlay');
        if (!overlay) return;
        overlay.classList.add('open');
        document.body.style.overflow = 'hidden';
        selectedRating = 0;
        selectedPhotos = [];
        renderStarPicker();
        renderPhotoPreviews();
        const form = document.getElementById('reviewForm');
        if (form) form.reset();
        clearFieldErrors();
    }

    function closeModal() {
        const overlay = document.getElementById('reviewModalOverlay');
        if (!overlay) return;
        overlay.classList.remove('open');
        document.body.style.overflow = '';
    }

    // ===================== STAR PICKER =====================
    function renderStarPicker() {
        const picker = document.getElementById('starPicker');
        if (!picker) return;
        picker.innerHTML = '';
        for (let i = 1; i <= 5; i++) {
            const star = document.createElement('span');
            star.className = 'star-picker-star' + (i <= selectedRating ? ' active' : '');
            star.textContent = '★';
            star.dataset.rating = i;

            star.addEventListener('click', () => {
                selectedRating = i;
                renderStarPicker();
            });
            star.addEventListener('mouseenter', () => {
                picker.querySelectorAll('.star-picker-star').forEach((s, idx) => {
                    s.classList.toggle('hover-preview', idx < i && idx >= selectedRating);
                });
            });
            star.addEventListener('mouseleave', () => {
                picker.querySelectorAll('.star-picker-star').forEach(s => s.classList.remove('hover-preview'));
            });
            picker.appendChild(star);
        }
    }

    // ===================== PHOTO UPLOAD =====================
    function setupPhotoUpload() {
        const zone = document.getElementById('photoUploadZone');
        const input = document.getElementById('photoInput');
        if (!zone || !input) return;

        zone.addEventListener('click', () => input.click());

        // Drag & drop
        zone.addEventListener('dragover', (e) => { e.preventDefault(); zone.classList.add('drag-over'); });
        zone.addEventListener('dragleave', () => zone.classList.remove('drag-over'));
        zone.addEventListener('drop', (e) => {
            e.preventDefault();
            zone.classList.remove('drag-over');
            handleFiles(e.dataTransfer.files);
        });

        input.addEventListener('change', () => {
            handleFiles(input.files);
            input.value = '';
        });
    }

    function handleFiles(fileList) {
        const files = Array.from(fileList).filter(f => f.type.startsWith('image/'));
        const remaining = MAX_PHOTOS - selectedPhotos.length;
        if (remaining <= 0) {
            showToast(`Maximum ${MAX_PHOTOS} photos allowed`, 'error');
            return;
        }
        const toAdd = files.slice(0, remaining);
        toAdd.forEach(file => {
            const reader = new FileReader();
            reader.onload = (e) => {
                selectedPhotos.push({ file, dataUrl: e.target.result });
                renderPhotoPreviews();
            };
            reader.readAsDataURL(file);
        });
    }

    function renderPhotoPreviews() {
        const container = document.getElementById('photoPreviews');
        if (!container) return;
        if (selectedPhotos.length === 0) {
            container.innerHTML = '';
            return;
        }
        container.innerHTML = selectedPhotos.map((p, i) => `
      <div class="photo-preview-item">
        <img src="${p.dataUrl}" alt="Preview">
        <button class="photo-preview-remove" onclick="window.KPSSReviews.removePhoto(${i})">✕</button>
      </div>
    `).join('');
    }

    function removePhoto(index) {
        selectedPhotos.splice(index, 1);
        renderPhotoPreviews();
    }

    // ===================== SUBMIT =====================
    async function submitReview() {
        if (isSubmitting) return;

        const nameInput = document.getElementById('reviewName');
        const textInput = document.getElementById('reviewText');

        // Validate
        clearFieldErrors();
        let hasError = false;

        if (!nameInput.value.trim()) {
            nameInput.classList.add('error');
            hasError = true;
        }
        if (selectedRating === 0) {
            showToast('Please select a star rating', 'error');
            hasError = true;
        }
        if (!textInput.value.trim()) {
            textInput.classList.add('error');
            hasError = true;
        }

        if (hasError) return;

        isSubmitting = true;
        const btn = document.getElementById('reviewSubmitBtn');
        const btnText = btn.innerHTML;
        btn.innerHTML = '<span class="spinner"></span> Submitting…';
        btn.disabled = true;

        try {
            // Upload photos to Cloudinary
            let photoUrls = [];
            if (selectedPhotos.length > 0) {
                showToast('Uploading photos…', 'success');
                for (const photo of selectedPhotos) {
                    const url = await uploadToCloudinary(photo.file);
                    photoUrls.push(url);
                }
            }

            // Save to Firestore
            await submitReviewToFirestore({
                name: nameInput.value.trim(),
                rating: selectedRating,
                text: textInput.value.trim(),
                photos: photoUrls
            });

            showToast('✓ Thank you for your review!', 'success');
            closeModal();

        } catch (error) {
            console.error('Submit error:', error);
            showToast(error.message || 'Something went wrong. Please try again.', 'error');
        } finally {
            isSubmitting = false;
            btn.innerHTML = btnText;
            btn.disabled = false;
        }
    }

    function clearFieldErrors() {
        document.querySelectorAll('.review-form-input.error, .review-form-textarea.error').forEach(el => {
            el.classList.remove('error');
        });
    }

    // ===================== LIGHTBOX =====================
    function openLightbox(url) {
        let overlay = document.getElementById('lightboxOverlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'lightboxOverlay';
            overlay.className = 'lightbox-overlay';
            overlay.innerHTML = `
        <button class="lightbox-close" onclick="window.KPSSReviews.closeLightbox()">✕</button>
        <img src="" alt="Review photo enlarged">
      `;
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) closeLightbox();
            });
            document.body.appendChild(overlay);
        }
        overlay.querySelector('img').src = url;
        requestAnimationFrame(() => overlay.classList.add('open'));
        document.body.style.overflow = 'hidden';
    }

    function closeLightbox() {
        const overlay = document.getElementById('lightboxOverlay');
        if (overlay) {
            overlay.classList.remove('open');
            document.body.style.overflow = '';
        }
    }

    // ===================== TOAST =====================
    function showToast(message, type) {
        let toast = document.getElementById('reviewToast');
        if (!toast) {
            toast = document.createElement('div');
            toast.id = 'reviewToast';
            toast.className = 'review-toast';
            document.body.appendChild(toast);
        }
        toast.className = `review-toast ${type}`;
        toast.innerHTML = `<span class="review-toast-icon">${type === 'success' ? '✓' : '⚠'}</span> ${escapeHTML(message)}`;
        requestAnimationFrame(() => toast.classList.add('show'));
        setTimeout(() => toast.classList.remove('show'), 3500);
    }

    // ===================== FILTER / SORT HANDLERS =====================
    function filterByStar(star) {
        currentFilter = currentFilter === star ? null : star;
        renderReviews(applyFilters(allReviews));

        // Update filter tag
        const actionsEl = document.querySelector('.reviews-actions');
        if (!actionsEl) return;
        const existingTag = actionsEl.querySelector('.reviews-filter-tag');
        if (existingTag) existingTag.remove();

        if (currentFilter !== null) {
            const tag = document.createElement('span');
            tag.className = 'reviews-filter-tag';
            tag.innerHTML = `${currentFilter} star${currentFilter !== 1 ? 's' : ''} <span class="filter-x" onclick="window.KPSSReviews.filterByStar(${currentFilter})">✕</span>`;
            actionsEl.appendChild(tag);
        }
    }

    function handleSortChange(value) {
        currentSort = value;
        renderReviews(applyFilters(allReviews));
    }

    // ===================== UTILITIES =====================
    function escapeHTML(str) {
        const div = document.createElement('div');
        div.appendChild(document.createTextNode(str));
        return div.innerHTML;
    }

    // ===================== INIT =====================
    function init() {
        initFirebase();
        loadReviews();
        setupPhotoUpload();

        // Modal close handlers
        const overlay = document.getElementById('reviewModalOverlay');
        if (overlay) {
            overlay.addEventListener('click', (e) => {
                if (e.target === overlay) closeModal();
            });
        }
        const closeBtn = document.getElementById('reviewModalClose');
        if (closeBtn) {
            closeBtn.addEventListener('click', closeModal);
        }

        // Submit button
        const submitBtn = document.getElementById('reviewSubmitBtn');
        if (submitBtn) {
            submitBtn.addEventListener('click', submitReview);
        }

        // Sort dropdown
        const sortSelect = document.getElementById('reviewsSort');
        if (sortSelect) {
            sortSelect.addEventListener('change', (e) => handleSortChange(e.target.value));
        }

        // Open modal buttons
        document.querySelectorAll('[data-action="open-review-modal"]').forEach(btn => {
            btn.addEventListener('click', openModal);
        });

        // Keyboard: Escape closes modal/lightbox
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                closeLightbox();
                closeModal();
            }
        });

        // Check URL param for auto-open modal
        const params = new URLSearchParams(window.location.search);
        if (params.get('action') === 'write') {
            setTimeout(openModal, 600);
        }
    }

    // Public API (for inline onclick handlers)
    window.KPSSReviews = {
        openModal,
        closeModal,
        openLightbox,
        closeLightbox,
        removePhoto,
        filterByStar,
        submitReview
    };

    // Run on DOM ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

})();
