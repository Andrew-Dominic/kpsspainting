/**
 * KPSS Admin — Reviews Management
 * Actions: Approve, Reject, Delete, Spam, Feature
 * Displays audit metadata: ID, timestamp, status, email
 */
(function () {
  'use strict';

  const COLLECTION = 'reviews';
  let allReviews = [];
  let currentFilter = 'all';
  let searchQuery = '';
  let unsubscribe = null;

  document.addEventListener('admin:ready', () => {
    loadReviews();
    bindEvents();
  });

  function bindEvents() {
    document.querySelectorAll('[data-filter]').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('[data-filter]').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        currentFilter = btn.dataset.filter;
        renderReviews();
      });
    });

    const searchInput = document.getElementById('reviewSearch');
    if (searchInput) {
      let timer;
      searchInput.addEventListener('input', () => {
        clearTimeout(timer);
        timer = setTimeout(() => { searchQuery = searchInput.value.trim().toLowerCase(); renderReviews(); }, 250);
      });
    }
  }

  function loadReviews() {
    const db = KPSSAdmin.getDB();
    const grid = document.getElementById('reviewsGrid');
    KPSSAdmin.renderSkeletons(grid, 6);

    if (unsubscribe) unsubscribe();

    unsubscribe = db.collection(COLLECTION)
      .orderBy('timestamp', 'desc')
      .onSnapshot(snapshot => {
        allReviews = snapshot.docs.map(doc => {
          const d = doc.data();
          return {
            id: doc.id,
            name: d.name || 'Anonymous',
            email: d.email || '',
            rating: d.rating || 5,
            text: d.text || d.review || '',
            status: d.status || 'pending',
            featured: d.featured || false,
            timestamp: d.timestamp ? d.timestamp.toDate() : (d.createdAt ? d.createdAt.toDate() : new Date()),
            photos: d.photos || [],
            location: d.location || '',
            device: d.device || '',
            ip: d.ip || '',
            source: d.source || 'website'
          };
        });
        updateStats();
        renderReviews();
      }, err => {
        console.error('Firestore error:', err);
        KPSSAdmin.showToast('Failed to load reviews', 'error');
      });
  }

  function updateStats() {
    const total = allReviews.length;
    const pending = allReviews.filter(r => r.status === 'pending').length;
    const approved = allReviews.filter(r => r.status === 'approved').length;
    const spam = allReviews.filter(r => r.status === 'spam' || r.status === 'rejected').length;

    setText('statTotal', total);
    setText('statPending', pending);
    setText('statApproved', approved);
    setText('statSpam', spam);
  }

  function setText(id, val) {
    const el = document.getElementById(id);
    if (el) el.textContent = val;
  }

  function getFiltered() {
    let list = [...allReviews];
    if (currentFilter !== 'all') {
      if (currentFilter === 'featured') {
        list = list.filter(r => r.featured);
      } else {
        list = list.filter(r => r.status === currentFilter);
      }
    }
    if (searchQuery) {
      list = list.filter(r =>
        r.name.toLowerCase().includes(searchQuery) ||
        r.text.toLowerCase().includes(searchQuery) ||
        (r.email && r.email.toLowerCase().includes(searchQuery)) ||
        r.id.toLowerCase().includes(searchQuery)
      );
    }
    return list;
  }

  function renderReviews() {
    const grid = document.getElementById('reviewsGrid');
    const filtered = getFiltered();

    if (filtered.length === 0) {
      grid.innerHTML = `
        <div class="empty-state">
          <div class="empty-state__icon">📋</div>
          <h3 class="empty-state__title">No reviews found</h3>
          <p class="empty-state__text">${currentFilter !== 'all' ? `No ${currentFilter} reviews.` : searchQuery ? 'Try a different search term.' : 'Reviews will appear here once submitted.'}</p>
        </div>`;
      return;
    }

    grid.innerHTML = filtered.map(r => renderCard(r)).join('');
    grid.querySelectorAll('.review-card').forEach((card, i) => {
      card.style.animationDelay = `${i * 0.04}s`;
    });
  }

  function renderCard(r) {
    const { esc, starsHTML, timeAgo, formatDate } = KPSSAdmin;
    const initial = r.name.charAt(0).toUpperCase();
    const statusClass = `status--${r.status}`;
    const statusLabel = r.status.charAt(0).toUpperCase() + r.status.slice(1);

    const photosHTML = r.photos.length
      ? `<div class="rc__photos">${r.photos.map(u => `<img src="${u}" alt="Review photo" class="rc__photo">`).join('')}</div>`
      : '';

    const featuredBadge = r.featured ? '<span class="rc__featured">★ Featured</span>' : '';

    // Audit metadata block
    const auditHTML = `
      <div class="rc__audit">
        <span title="Review ID">ID: ${r.id.substring(0, 8)}…</span>
        <span title="Submitted">${formatDate(r.timestamp)}</span>
        ${r.source ? `<span title="Source">via ${esc(r.source)}</span>` : ''}
        ${r.device ? `<span title="Device">${esc(r.device)}</span>` : ''}
      </div>`;

    return `
      <div class="review-card rc--reveal" data-id="${r.id}">
        <div class="rc__top">
          <div class="rc__user">
            <div class="rc__avatar">${initial}</div>
            <div>
              <div class="rc__name">${esc(r.name)} ${featuredBadge}</div>
              <div class="rc__date">${timeAgo(r.timestamp)}${r.location ? ' · ' + esc(r.location) : ''}</div>
            </div>
          </div>
          <span class="rc__status ${statusClass}">${statusLabel}</span>
        </div>
        <div class="rc__stars">${starsHTML(r.rating)}</div>
        <p class="rc__text">${esc(r.text)}</p>
        ${r.email ? `<div class="rc__meta">✉ ${esc(r.email)}</div>` : ''}
        ${photosHTML}
        ${auditHTML}
        <div class="rc__actions">
          ${r.status !== 'approved' ? `<button class="btn btn--sm btn--approve" onclick="KPSSAdmin.setStatus('${r.id}','approved')">✓ Approve</button>` : ''}
          ${r.status !== 'rejected' ? `<button class="btn btn--sm btn--reject" onclick="KPSSAdmin.setStatus('${r.id}','rejected')">✕ Reject</button>` : ''}
          ${r.status !== 'spam' ? `<button class="btn btn--sm btn--spam" onclick="KPSSAdmin.setStatus('${r.id}','spam')">🚫 Spam</button>` : ''}
          <button class="btn btn--sm ${r.featured ? 'btn--unfeature' : 'btn--feature'}" onclick="KPSSAdmin.toggleFeatured('${r.id}',${!r.featured})">${r.featured ? '☆ Unfeature' : '★ Feature'}</button>
          <button class="btn btn--sm btn--delete" onclick="KPSSAdmin.deleteReview('${r.id}','${esc(r.name)}')">🗑 Delete</button>
        </div>
      </div>`;
  }

  // --- Actions ---
  function setStatus(id, status) {
    const db = KPSSAdmin.getDB();
    db.collection(COLLECTION).doc(id).update({ status })
      .then(() => KPSSAdmin.showToast(`Review marked as ${status}`, 'success'))
      .catch(() => KPSSAdmin.showToast('Action failed', 'error'));
  }

  function toggleFeatured(id, featured) {
    const db = KPSSAdmin.getDB();
    db.collection(COLLECTION).doc(id).update({ featured })
      .then(() => KPSSAdmin.showToast(featured ? 'Review featured' : 'Review unfeatured', 'success'))
      .catch(() => KPSSAdmin.showToast('Action failed', 'error'));
  }

  function deleteReview(id, name) {
    KPSSAdmin.showConfirm(
      'Delete Review',
      `Permanently delete review by <strong>${name}</strong>? This cannot be undone.`,
      () => {
        const db = KPSSAdmin.getDB();
        db.collection(COLLECTION).doc(id).delete()
          .then(() => KPSSAdmin.showToast('Review deleted', 'success'))
          .catch(() => KPSSAdmin.showToast('Delete failed', 'error'));
      },
      'Delete',
      'danger'
    );
  }

  window.KPSSAdmin = window.KPSSAdmin || {};
  Object.assign(window.KPSSAdmin, { setStatus, toggleFeatured, deleteReview });
})();
