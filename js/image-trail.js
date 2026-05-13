/**
 * ImageTrail — Vanilla JS port of React Bits ImageTrail component.
 * Converted from React to vanilla JS for use in static HTML sites.
 * Dependency: GSAP (must be loaded before this script).
 * Desktop only — guarded by matchMedia check.
 */
(function () {
  'use strict';

  // Only run on desktop (hover-capable devices)
  if (!window.matchMedia('(hover: hover) and (min-width: 1025px)').matches) return;

  // Wait for GSAP
  if (typeof gsap === 'undefined') {
    console.warn('[ImageTrail] GSAP not found. Skipping.');
    return;
  }

  // --- Utility functions ---
  function lerp(a, b, n) {
    return (1 - n) * a + n * b;
  }

  function getLocalPointerPos(e, rect) {
    let clientX = e.clientX || 0;
    let clientY = e.clientY || 0;
    return {
      x: clientX - rect.left,
      y: clientY - rect.top
    };
  }

  function getMouseDistance(p1, p2) {
    const dx = p1.x - p2.x;
    const dy = p1.y - p2.y;
    return Math.hypot(dx, dy);
  }

  // --- ImageItem class ---
  class ImageItem {
    constructor(el) {
      this.el = el;
      this.inner = el.querySelector('.trail__img-inner');
      this.rect = null;
      this.defaultStyle = { scale: 1, x: 0, y: 0, opacity: 0 };
      this.getRect();
      this._onResize = () => {
        gsap.set(this.el, this.defaultStyle);
        this.getRect();
      };
      window.addEventListener('resize', this._onResize);
    }
    getRect() {
      this.rect = this.el.getBoundingClientRect();
    }
  }

  // --- Trail Engine (Variant 2 — zoom-in with brightness flash) ---
  class TrailEngine {
    constructor(container) {
      this.container = container;
      this.images = [...container.querySelectorAll('.trail__img')].map(el => new ImageItem(el));
      this.imagesTotal = this.images.length;
      this.imgPosition = 0;
      this.zIndexVal = 1;
      this.activeImagesCount = 0;
      this.isIdle = true;
      this.threshold = 80;

      this.mousePos = { x: 0, y: 0 };
      this.lastMousePos = { x: 0, y: 0 };
      this.cacheMousePos = { x: 0, y: 0 };
      this.running = false;

      this._onMove = (ev) => {
        const rect = this.container.getBoundingClientRect();
        this.mousePos = getLocalPointerPos(ev, rect);
      };

      this._onFirstMove = (ev) => {
        const rect = this.container.getBoundingClientRect();
        this.mousePos = getLocalPointerPos(ev, rect);
        this.cacheMousePos = { ...this.mousePos };
        this.lastMousePos = { ...this.mousePos };
        if (!this.running) {
          this.running = true;
          requestAnimationFrame(() => this.render());
        }
        container.removeEventListener('mousemove', this._onFirstMove);
      };

      container.addEventListener('mousemove', this._onMove);
      container.addEventListener('mousemove', this._onFirstMove);
    }

    render() {
      const distance = getMouseDistance(this.mousePos, this.lastMousePos);
      this.cacheMousePos.x = lerp(this.cacheMousePos.x, this.mousePos.x, 0.1);
      this.cacheMousePos.y = lerp(this.cacheMousePos.y, this.mousePos.y, 0.1);

      if (distance > this.threshold) {
        this.showNextImage();
        this.lastMousePos = { ...this.mousePos };
      }
      if (this.isIdle && this.zIndexVal !== 1) {
        this.zIndexVal = 1;
      }
      requestAnimationFrame(() => this.render());
    }

    showNextImage() {
      ++this.zIndexVal;
      this.imgPosition = this.imgPosition < this.imagesTotal - 1 ? this.imgPosition + 1 : 0;
      const img = this.images[this.imgPosition];

      gsap.killTweensOf(img.el);

      gsap.timeline({
        onStart: () => this.onImageActivated(),
        onComplete: () => this.onImageDeactivated()
      })
        .fromTo(img.el, {
          opacity: 1,
          scale: 0,
          zIndex: this.zIndexVal,
          x: this.cacheMousePos.x - img.rect.width / 2,
          y: this.cacheMousePos.y - img.rect.height / 2
        }, {
          duration: 0.4,
          ease: 'power1',
          scale: 1,
          x: this.mousePos.x - img.rect.width / 2,
          y: this.mousePos.y - img.rect.height / 2
        }, 0)
        .fromTo(img.inner, {
          scale: 2.8,
          filter: 'brightness(250%)'
        }, {
          duration: 0.4,
          ease: 'power1',
          scale: 1,
          filter: 'brightness(100%)'
        }, 0)
        .to(img.el, {
          duration: 0.4,
          ease: 'power2',
          opacity: 0,
          scale: 0.2
        }, 0.45);
    }

    onImageActivated() {
      this.activeImagesCount++;
      this.isIdle = false;
    }
    onImageDeactivated() {
      this.activeImagesCount--;
      if (this.activeImagesCount === 0) this.isIdle = true;
    }
  }

  // --- Initialization ---
  // Image URLs for the trail (uses existing project gallery images)
  const trailImages = [
    'assets/before after/a1.png',
    'assets/before after/a2.png',
    'assets/before after/a3.png',
    'assets/before after/a4.png',
    'assets/before after/a5.png',
    'gallery_1_after_1776580135445.png',
    'gallery_2_after_1776580171141.png',
    'gallery_3_after_1776580203196.png',
    'gallery_4_after_1776580236434.png',
    'gallery_5_after_1776580272027.png'
  ];

  function init() {
    const heroImgWrap = document.querySelector('.hero-img-wrap');
    if (!heroImgWrap) return;

    // Create the trail container
    const trailContainer = document.createElement('div');
    trailContainer.className = 'hero-trail-container';

    const trailContent = document.createElement('div');
    trailContent.className = 'hero-trail-content';

    // Generate trail image elements
    trailImages.forEach(url => {
      const imgDiv = document.createElement('div');
      imgDiv.className = 'trail__img';

      const innerDiv = document.createElement('div');
      innerDiv.className = 'trail__img-inner';
      innerDiv.style.backgroundImage = `url(${url})`;

      imgDiv.appendChild(innerDiv);
      trailContent.appendChild(imgDiv);
    });

    trailContainer.appendChild(trailContent);
    heroImgWrap.appendChild(trailContainer);

    // Initialize the trail engine on the content div
    new TrailEngine(trailContent);
  }

  // Run after DOM is ready and loader is done
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => setTimeout(init, 4000));
  } else {
    // If DOM already loaded, wait for loader animation
    setTimeout(init, 4000);
  }
})();
