/**
 * KPSS Admin — UI Utilities (toasts, modals, skeletons)
 */
(function () {
  'use strict';

  // --- Toast ---
  function showToast(message, type = 'success') {
    let container = document.getElementById('toastContainer');
    if (!container) {
      container = document.createElement('div');
      container.id = 'toastContainer';
      container.className = 'toast-container';
      document.body.appendChild(container);
    }
    const toast = document.createElement('div');
    toast.className = `toast toast--${type}`;
    const icons = { success: '✓', error: '✕', warning: '⚠', info: 'ℹ' };
    toast.innerHTML = `<span class="toast__icon">${icons[type] || icons.info}</span><span class="toast__msg">${message}</span>`;
    container.appendChild(toast);
    requestAnimationFrame(() => toast.classList.add('toast--visible'));
    setTimeout(() => {
      toast.classList.remove('toast--visible');
      toast.addEventListener('transitionend', () => toast.remove());
    }, 3500);
  }

  // --- Confirm Modal ---
  function showConfirm(title, message, onConfirm, confirmText = 'Confirm', variant = 'danger') {
    let overlay = document.getElementById('confirmOverlay');
    if (overlay) overlay.remove();
    overlay = document.createElement('div');
    overlay.id = 'confirmOverlay';
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal">
        <div class="modal__header">
          <h3 class="modal__title">${title}</h3>
          <button class="modal__close" id="confirmClose">✕</button>
        </div>
        <p class="modal__body">${message}</p>
        <div class="modal__actions">
          <button class="btn btn--ghost" id="confirmCancel">Cancel</button>
          <button class="btn btn--${variant}" id="confirmOk">${confirmText}</button>
        </div>
      </div>`;
    document.body.appendChild(overlay);
    requestAnimationFrame(() => overlay.classList.add('modal-overlay--visible'));

    const close = () => { overlay.classList.remove('modal-overlay--visible'); setTimeout(() => overlay.remove(), 300); };
    overlay.querySelector('#confirmClose').onclick = close;
    overlay.querySelector('#confirmCancel').onclick = close;
    overlay.querySelector('#confirmOk').onclick = () => { close(); onConfirm(); };
    overlay.addEventListener('click', (e) => { if (e.target === overlay) close(); });
  }

  // --- Skeleton Cards ---
  function renderSkeletons(container, count = 6) {
    container.innerHTML = Array(count).fill(`
      <div class="review-card review-card--skeleton">
        <div class="skel skel--circle"></div>
        <div class="skel skel--line skel--w60"></div>
        <div class="skel skel--line skel--w40"></div>
        <div class="skel skel--line skel--w80"></div>
        <div class="skel skel--line skel--w100"></div>
        <div class="skel skel--line skel--w50"></div>
      </div>`).join('');
  }

  // --- Time formatting ---
  function timeAgo(date) {
    if (!date) return '—';
    const seconds = Math.floor((Date.now() - date.getTime()) / 1000);
    if (seconds < 60) return 'Just now';
    const m = Math.floor(seconds / 60); if (m < 60) return `${m}m ago`;
    const h = Math.floor(m / 60); if (h < 24) return `${h}h ago`;
    const d = Math.floor(h / 24); if (d < 30) return `${d}d ago`;
    return date.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric' });
  }

  function formatDate(date) {
    if (!date) return '—';
    return date.toLocaleDateString('en-AU', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  }

  // --- Escape HTML ---
  function esc(str) {
    const d = document.createElement('div');
    d.appendChild(document.createTextNode(str || ''));
    return d.innerHTML;
  }

  // --- Stars HTML ---
  function starsHTML(rating) {
    let s = '';
    for (let i = 1; i <= 5; i++) s += `<span class="star ${i <= rating ? 'star--filled' : 'star--empty'}">★</span>`;
    return s;
  }

  window.KPSSAdmin = window.KPSSAdmin || {};
  Object.assign(window.KPSSAdmin, { showToast, showConfirm, renderSkeletons, timeAgo, formatDate, esc, starsHTML });
})();
