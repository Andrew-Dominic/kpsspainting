/**
 * KPSS Admin — Firebase Configuration + Admin Allowlist
 */
const FIREBASE_CONFIG = {
  apiKey: "AIzaSyA-VT-FFZyJmdDKRnLFpCdqOvHZhBiOPRQ",
  authDomain: "kpss-painting.firebaseapp.com",
  projectId: "kpss-painting",
  storageBucket: "kpss-painting.firebasestorage.app",
  messagingSenderId: "1060145692690",
  appId: "1:1060145692690:web:d259698417bb00c38d98cb",
  measurementId: "G-1PNH4H8SF1"
};

// ===== ADMIN ALLOWLIST — ONLY these emails can access the dashboard =====
const ALLOWED_ADMINS = [
  'kanthan180@gmail.com',
  'suryayogeshkumar301@gmail.com',
  'cursordrew@gmail.com'
];

function isAllowedAdmin(email) {
  if (!email) return false;
  return ALLOWED_ADMINS.includes(email.toLowerCase().trim());
}

let app, db, auth;

function initFirebase() {
  if (!firebase.apps.length) {
    app = firebase.initializeApp(FIREBASE_CONFIG);
  } else {
    app = firebase.apps[0];
  }
  db = firebase.firestore();
  auth = firebase.auth();
  return { db, auth };
}

window.KPSSAdmin = window.KPSSAdmin || {};
window.KPSSAdmin.initFirebase = initFirebase;
window.KPSSAdmin.getDB = () => db;
window.KPSSAdmin.getAuth = () => auth;
window.KPSSAdmin.isAllowedAdmin = isAllowedAdmin;
window.KPSSAdmin.ALLOWED_ADMINS = ALLOWED_ADMINS;
