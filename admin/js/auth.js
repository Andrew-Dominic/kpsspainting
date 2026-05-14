/**
 * KPSS Admin — Auth Module (Google Sign-In + Allowlist Enforcement)
 * 
 * Security flow:
 * 1. User clicks "Sign in with Google"
 * 2. Firebase authenticates via Google popup
 * 3. We check user.email against ALLOWED_ADMINS
 * 4. If NOT in allowlist → sign out immediately, show error
 * 5. If allowed → redirect to dashboard
 * 6. Every dashboard page re-verifies on load
 */
(function () {
  'use strict';

  function initAuth() {
    const { auth } = KPSSAdmin.initFirebase();
    const isLoginPage = !!document.getElementById('loginForm');

    // PROTOCOL CHECK: Firebase Auth requires http/https
    if (window.location.protocol === 'file:') {
      const errEl = document.getElementById('loginError');
      if (errEl) {
        errEl.innerHTML = `<strong>Protocol Error:</strong> Google Sign-In requires a local server.<br>Please use: <a href="http://localhost:5500/admin/" style="color:var(--bronze);text-decoration:underline;">http://localhost:5500/admin/</a>`;
      }
      console.error('Firebase Auth does not support file:// protocol. Use a local server.');
    }

    if (isLoginPage) {
      // --- LOGIN PAGE ---
      // If already signed in as allowed admin, go straight to dashboard
      auth.onAuthStateChanged(user => {
        if (user && KPSSAdmin.isAllowedAdmin(user.email)) {
          window.location.href = '/admin/dashboard.html';
        }
      });

      // Google Sign-In button
      const googleBtn = document.getElementById('googleSignInBtn');
      const errEl = document.getElementById('loginError');

      if (googleBtn) {
        googleBtn.addEventListener('click', async () => {
          if (window.location.protocol === 'file:') {
            errEl.innerHTML = `<strong>Error:</strong> You cannot sign in via file://<br>Use: <a href="http://localhost:5500/admin/">http://localhost:5500/admin/</a>`;
            return;
          }
          
          errEl.textContent = '';
          googleBtn.disabled = true;
          googleBtn.innerHTML = '<span class="spinner"></span> Signing in…';

          try {
            const provider = new firebase.auth.GoogleAuthProvider();
            const result = await auth.signInWithPopup(provider);
            const email = result.user.email;

            // === ALLOWLIST CHECK ===
            if (!KPSSAdmin.isAllowedAdmin(email)) {
              await auth.signOut();
              errEl.textContent = `Access denied. ${email} is not an authorized admin.`;
              googleBtn.disabled = false;
              googleBtn.innerHTML = '<svg class="google-icon" viewBox="0 0 24 24" width="20" height="20"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg> Sign in with Google';
              return;
            }
          } catch (err) {
            if (err.code === 'auth/operation-not-supported-in-this-environment') {
              errEl.innerHTML = `<strong>Environment Error:</strong> Use a local server (http://localhost:5500) to login.`;
            } else if (err.code === 'auth/popup-closed-by-user') {
              errEl.textContent = '';
            } else {
              errEl.textContent = err.message || 'Sign-in failed.';
            }
            googleBtn.disabled = false;
            googleBtn.innerHTML = 'Sign in with Google';
          }
        });
      }
      return;
    }

    // --- DASHBOARD PAGES — GUARD ---
    auth.onAuthStateChanged(async (user) => {
      if (!user) {
        window.location.href = '/admin/';
        return;
      }

      // === ALLOWLIST CHECK ON EVERY PAGE LOAD ===
      if (!KPSSAdmin.isAllowedAdmin(user.email)) {
        await auth.signOut();
        window.location.href = '/admin/';
        return;
      }

      // Authorized admin — show dashboard
      document.body.classList.remove('auth-loading');
      document.body.classList.add('auth-ready');

      const avatarEl = document.getElementById('userAvatar');
      const nameEl = document.getElementById('userName');
      if (avatarEl) avatarEl.textContent = (user.displayName || user.email || 'A').charAt(0).toUpperCase();
      if (nameEl) nameEl.textContent = user.displayName || user.email || 'Admin';

      // Fire ready event for other modules
      document.dispatchEvent(new CustomEvent('admin:ready', { detail: { user } }));
    });
  }

  function logout() {
    firebase.auth().signOut().then(() => window.location.href = '/admin/');
  }

  window.KPSSAdmin = window.KPSSAdmin || {};
  Object.assign(window.KPSSAdmin, { initAuth, logout });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initAuth);
  } else {
    initAuth();
  }
})();
