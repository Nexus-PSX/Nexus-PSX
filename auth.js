
  import { initializeApp } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-app.js";
  import {
    getAuth,
    onAuthStateChanged,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    signOut,
    GoogleAuthProvider,
    signInWithPopup
  } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js";
  import {
    getFirestore,
    doc,
    getDoc,
    setDoc
  } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";
  import {
    getMessaging,
    getToken,
    onMessage
  } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-messaging.js";

  // ===== ADMIN ALLOWLIST =====
  // Only signed-in users whose email is in this list see the Data menu
  // (Update Data / Save Data JSON / Save Full HTML). Everyone else who signs
  // in sees the dashboard normally, just without that menu.
  // >>> REPLACE the email below with your real sign-in email before going live. <<<
  const ADMIN_EMAILS = ['bilal1947@gmail.com'];

  // Your web app's Firebase configuration
  const firebaseConfig = {
    apiKey: "AIzaSyCmIUoD99B2U94wWuHIaQIWmU2A4kppbDY",
    authDomain: "psx-dashboard-dev.firebaseapp.com",
    projectId: "psx-dashboard-dev",
    storageBucket: "psx-dashboard-dev.firebasestorage.app",
    messagingSenderId: "1089260456151",
    appId: "1:1089260456151:web:38c68733e2f4d547330892"
  };

  const app = initializeApp(firebaseConfig);
  const db  = getFirestore(app);
  const messaging = getMessaging(app);

  // ===== VAPID key — from Firebase Console → Project Settings → Cloud Messaging
  // → Web Push certificates → Key pair. Replace this placeholder with your
  // actual VAPID key before deploying. Without it, getToken() will fail silently.
  const VAPID_KEY = 'BCAeBSeNlmWhNR3A6jNMNhGUeyuySekxIMihnSsQwSCH2kS5WAfPoMjBVLqEfEfN9ThbzNQQqqB2cFVwA9CByiI';

  // ===== FCM Push Notifications =====
  // Requests notification permission, gets an FCM registration token, and
  // stores it in Firestore under users/{uid}/data/fcm_token so the admin
  // sender can look up all tokens to push to.

  async function registerForPush(uid) {
    if (!uid) return;
    if (!('Notification' in window)) return;
    if (Notification.permission === 'denied') return;
    try {
      const swReg = await navigator.serviceWorker.register('./firebase-messaging-sw.js');
      await navigator.serviceWorker.ready;
      const token = await getToken(messaging, { vapidKey: VAPID_KEY, serviceWorkerRegistration: swReg });
      if (!token) return;
      await setDoc(
        doc(db, 'users', uid, 'data', 'fcm_token'),
        { token, updatedAt: Date.now(), userAgent: navigator.userAgent.slice(0, 200) }
      );
      console.log('FCM token registered');
    } catch (e) {
      console.warn('FCM registration failed:', e.message || e);
    }
  }

  function syncPushButtonState() {
    const btn = document.getElementById('pushPermBtn');
    if (!btn) return;
    if (!('Notification' in window)) { btn.style.display = 'none'; return; }
    if (Notification.permission === 'granted') {
      btn.innerHTML = '<span style="display:flex;align-items:center;"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:7px;"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>🔔 Alerts On</span>';
      btn.title = 'Push notifications are enabled';
      btn.style.opacity = '0.6';
    } else if (Notification.permission === 'denied') {
      btn.innerHTML = '<span style="display:flex;align-items:center;"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:7px;"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>🔕 Blocked</span>';
      btn.title = 'Notifications blocked — enable in browser site settings';
      btn.style.opacity = '0.6';
    } else {
      btn.innerHTML = '<span style="display:flex;align-items:center;"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right:7px;"><path d="M18 8a6 6 0 0 0-12 0c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>🔔 Enable Alerts</span>';
      btn.title = 'Get push notifications for new buy signals, even when the tab is closed';
      btn.style.opacity = '1';
    }
    btn.disabled = false;
  }

  // Foreground handler: tab is open + a push arrives → use in-app toast
  // instead of a system notification (browsers suppress those when focused).
  onMessage(messaging, payload => {
    const { title, body } = payload.data || {};
    if (typeof showToast === 'function') showToast(`🔔 ${title || 'Alert'}: ${body || ''}`);
    if (typeof window.checkFreshSignalsToday === 'function') window.checkFreshSignalsToday();
  });

  // Exposed on window so the button in index.html can call it from outside
  // this module scope.
  window.requestPushPermission = async function () {
    const uid = window._currentFcmUid || null;
    const btn = document.getElementById('pushPermBtn');
    // Only update the label text, not innerHTML — preserves the SVG/span structure
    if (btn) {
      btn.disabled = true;
      const span = btn.querySelector('span');
      if (span) span.lastChild.textContent = ' Setting up…';
    }
    try {
      const permission = await Notification.requestPermission();
      if (permission === 'granted' && uid) await registerForPush(uid);
    } finally {
      syncPushButtonState(); // rebuilds the full button correctly
    }
  };

  window.unregisterPushToken = async function (uid) {
    if (!uid) return;
    try { await setDoc(doc(db, 'users', uid, 'data', 'fcm_token'), { token: null, removedAt: Date.now() }); }
    catch (e) { /* ignore */ }
  };

  // ===== Firestore bridges (watchlist) =====
  // The watchlist UI/state lives in a separate, non-module <script> earlier in
  // this file (it predates Firebase Auth and doesn't import any SDK). Rather
  // than duplicate Firestore imports there, we expose two small async
  // functions on window that it can call directly. Each user's watchlist is
  // stored at users/{uid}/data/watchlist — see the matching security rule
  // note further down.
  window.fsLoadWatchlist = async function (uid) {
    try {
      const snap = await getDoc(doc(db, 'users', uid, 'data', 'watchlist'));
      return snap.exists() ? (snap.data().tickers || []) : null; // null = no doc yet
    } catch (e) {
      console.error('Firestore load watchlist failed:', e);
      return undefined; // undefined = read failed (distinct from "no doc yet")
    }
  };
  window.fsSaveWatchlist = async function (uid, tickers) {
    try {
      await setDoc(doc(db, 'users', uid, 'data', 'watchlist'), { tickers, updatedAt: Date.now() });
      return true;
    } catch (e) {
      console.error('Firestore save watchlist failed:', e);
      return false;
    }
  };

  // ===== Auto-refresh on return =====
  // Data is baked into this HTML at publish time, so the only way to pick up
  // a newer version is a full page reload. If the user leaves this tab open
  // (or backgrounds the mobile browser) and comes back after a while, this
  // silently reloads so they land on whatever's currently published instead
  // of stale in-memory data.
  const PAGE_LOAD_TIME = Date.now();
  const AUTO_REFRESH_INTERVAL_MS = 60 * 60 * 1000; // 1 hour
  function refreshIfStale() {
    if (document.visibilityState === 'visible' && Date.now() - PAGE_LOAD_TIME > AUTO_REFRESH_INTERVAL_MS) {
      window.location.reload();
    }
  }
  document.addEventListener('visibilitychange', refreshIfStale);
  window.addEventListener('focus', refreshIfStale);
  const auth = getAuth(app);

  // DOM references — resolved inside DOMContentLoaded since this module script
  // runs before the body is parsed (it's in <head>), so querying immediately
  // would return null for most elements.
  let overlay, userMenu, avatarBtn, dropdown, avatarLg, dropdownName,
      dropdownEmail, alertsBtn, alertsPanel, signOutItem,
      emailEl, passEl, errEl, submitBtn, toggleBtn, titleEl, subEl;

  function getAllCurrentBuySignals() {
    if (!window.SOURCE_DATA || !Array.isArray(window.SOURCE_DATA) || !window.SOURCE_DATA.length) return [];

    const BUY_CODES = new Set([1.5, 2, 2.5]);
    // Text fragments covering all buy-signal label variants in the SIGNAL_STATUS_MAP
    const BUY_TEXTS = ['initial buy signal', 'fresh buy signal', 'continuation buy signal', 'extended buy signal'];

    let signals = window.SOURCE_DATA.filter(d => {
      const raw = d['Signal Status'];
      if (raw == null || raw === '') return false;
      // Numeric code (most common after the data migration)
      if (typeof raw === 'number') return BUY_CODES.has(raw);
      // String that contains a numeric code e.g. "1.5" or "2"
      const num = parseFloat(raw);
      if (!isNaN(num) && String(num) === String(raw).trim()) return BUY_CODES.has(num);
      // Text label e.g. "Initial buy signal", "Continuation buy signal"
      const lower = String(raw).toLowerCase();
      return BUY_TEXTS.some(t => lower.includes(t));
    });

    const wlToggle = document.getElementById('alertsWatchlistOnlyToggle');
    if (wlToggle?.checked && typeof window.getWatchlistTickers === 'function') {
      const tickers = new Set(window.getWatchlistTickers());
      signals = signals.filter(d => tickers.has(String(d.Ticker)));
    }
    return signals;
  }

  document.addEventListener('DOMContentLoaded', () => {
    overlay      = document.getElementById('authOverlay');
    userMenu     = document.getElementById('authUserMenu');
    avatarBtn    = document.getElementById('authAvatarBtn');
    dropdown     = document.getElementById('authDropdown');
    avatarLg     = document.getElementById('authAvatarLg');
    dropdownName = document.getElementById('authDropdownName');
    dropdownEmail= document.getElementById('authDropdownEmail');
    alertsBtn    = document.getElementById('authAlertsBtn');
    alertsPanel  = document.getElementById('alertsPanel');
    signOutItem  = document.getElementById('authSignOutItem');
    emailEl      = document.getElementById('authEmail');
    passEl       = document.getElementById('authPassword');
    errEl        = document.getElementById('authError');
    submitBtn    = document.getElementById('authSubmitBtn');
    toggleBtn    = document.getElementById('authToggleMode');
    titleEl      = document.getElementById('authTitle');
    subEl        = document.getElementById('authSub');

    if (!alertsBtn || !alertsPanel) return;

    alertsBtn.addEventListener('click', () => {
      dropdown.classList.add('hidden');
      alertsPanel.classList.toggle('hidden');
      // Always re-render on open — show all current buy signals
      if (!alertsPanel.classList.contains('hidden')) {
        renderAlertsPanel(getAllCurrentBuySignals());
      }
    });
    document.addEventListener('click', (e) => {
      if (!alertsPanel || !alertsBtn) return;
      if (alertsPanel.contains(e.target) || alertsBtn.contains(e.target)) return;
      alertsPanel.classList.add('hidden');
    });
    document.getElementById('alertsPanelClose')?.addEventListener('click',
      () => alertsPanel.classList.add('hidden'));

    const wlToggle = document.getElementById('alertsWatchlistOnlyToggle');
    if (wlToggle) {
      wlToggle.checked = localStorage.getItem(ALERTS_WL_ONLY_KEY) === '1';
      wlToggle.addEventListener('change', () => {
        try { localStorage.setItem(ALERTS_WL_ONLY_KEY, wlToggle.checked ? '1' : '0'); } catch {}
        renderAlertsPanel(getAllCurrentBuySignals());
      });
    }
  });


  // ── Auth form listeners — inside a second DOMContentLoaded because the
  // variables (emailEl, passEl, submitBtn, avatarBtn etc.) are only assigned
  // in the first DOMContentLoaded block above and would be undefined here. ──
  document.addEventListener('DOMContentLoaded', () => {
    let mode = 'signin';

    function friendlyError(err) {
      const code = err && err.code || '';
      if (code.includes('invalid-email')) return 'That email address looks invalid.';
      if (code.includes('user-not-found') || code.includes('wrong-password') || code.includes('invalid-credential')) return 'Incorrect email or password.';
      if (code.includes('email-already-in-use')) return 'An account already exists for that email.';
      if (code.includes('weak-password')) return 'Password should be at least 6 characters.';
      if (code.includes('unauthorized-domain')) return 'This domain is not yet authorized in Firebase (Authentication → Settings → Authorized domains). Add this domain there.';
      if (code.includes('popup-blocked')) return 'Your browser blocked the sign-in popup. Allow popups for this site and try again.';
      if (code.includes('operation-not-allowed')) return 'Google sign-in is not enabled for this project in Firebase (Authentication → Sign-in method).';
      if (code.includes('network-request-failed')) return 'Network error — check your connection and try again.';
      return 'Something went wrong (' + (code || 'unknown error') + '). Please try again.';
    }

    function setMode(next) {
      mode = next;
      if (!errEl || !titleEl) return;
      errEl.textContent = '';
      if (mode === 'signin') {
        titleEl.textContent = 'Sign in';
        subEl.textContent = 'Sign in to access Nexus PSX';
        submitBtn.textContent = 'Sign in';
        toggleBtn.textContent = "Need an account? Sign up";
      } else {
        titleEl.textContent = 'Create account';
        subEl.textContent = 'Sign up to access the PSX dashboard';
        submitBtn.textContent = 'Sign up';
        toggleBtn.textContent = 'Already have an account? Sign in';
      }
    }

    toggleBtn?.addEventListener('click', () => setMode(mode === 'signin' ? 'signup' : 'signin'));

    submitBtn?.addEventListener('click', async () => {
      if (!emailEl || !passEl) return;
      errEl.textContent = '';
      const email = emailEl.value.trim();
      const password = passEl.value;
      if (!email || !password) { errEl.textContent = 'Please enter an email and password.'; return; }
      submitBtn.disabled = true;
      try {
        if (mode === 'signin') {
          await signInWithEmailAndPassword(auth, email, password);
        } else {
          await createUserWithEmailAndPassword(auth, email, password);
        }
      } catch (err) {
        errEl.textContent = friendlyError(err);
      } finally {
        submitBtn.disabled = false;
      }
    });

    [emailEl, passEl].forEach(el => el?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter') submitBtn?.click();
    }));

    avatarBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      dropdown?.classList.toggle('hidden');
    });
    document.addEventListener('click', (e) => {
      if (userMenu && !userMenu.contains(e.target)) dropdown?.classList.add('hidden');
    });
    signOutItem?.addEventListener('click', () => { dropdown?.classList.add('hidden'); signOut(auth); });
  });

  // ===== Buy-signal alerts: fires when a stock's status CHANGES into the
  // "buy" family (Initial buy signal / Fresh buy signal / Continuation buy
  // signal / their cautious variants — codes 1.5, 2, 2.5 in SIGNAL_STATUS_MAP),
  // not based on Signal date (which stays as historical data and is never
  // used for alert matching). Each ticker's last-seen status code is kept in
  // localStorage so a stock already sitting in a buy signal doesn't keep
  // re-alerting every time the page loads — only a genuine change does.
  const ALERTS_WL_ONLY_KEY = 'psx_alerts_watchlist_only';
  const ALERT_STATUS_BASELINE_KEY = 'psx_alert_status_baseline_v1';
  const BUY_SIGNAL_CODES = new Set([1.5, 2, 2.5]); // Initial / Fresh / Continuation / cautious variants

  function readStatusBaseline() {
    try { return JSON.parse(localStorage.getItem(ALERT_STATUS_BASELINE_KEY) || '{}'); }
    catch { return {}; }
  }
  function writeStatusBaseline(map) {
    try { localStorage.setItem(ALERT_STATUS_BASELINE_KEY, JSON.stringify(map)); } catch {}
  }

  function findFreshSignalsToday() {
    // Read via window.SOURCE_DATA, not the bare identifier — SOURCE_DATA is
    // declared with const in app.js (a classic script), and module scripts
    // cannot see another script's top-level const/let bindings directly,
    // only true window properties (which app.js explicitly exposes this as).
    if (typeof window.SOURCE_DATA === 'undefined' || !Array.isArray(window.SOURCE_DATA) || !window.SOURCE_DATA.length) return [];
    if (typeof sigStatusCode !== 'function') return []; // signal-status helpers not loaded yet

    const baseline = readStatusBaseline();
    const isFirstRunEver = Object.keys(baseline).length === 0;
    const newBaseline = {};
    let signals = [];

    window.SOURCE_DATA.forEach(d => {
      const ticker = String(d.Ticker || '');
      if (!ticker) return;
      const code = sigStatusCode(d['Signal Status']);
      newBaseline[ticker] = code;
      if (code == null || !BUY_SIGNAL_CODES.has(code)) return;
      const prevCode = baseline[ticker];
      const wasAlreadyBuySignal = prevCode != null && BUY_SIGNAL_CODES.has(prevCode);
      // First time this browser has ever checked: establish the baseline
      // silently rather than alerting on every stock already sitting in a
      // buy signal — only genuine changes from here on should alert.
      if (!isFirstRunEver && !wasAlreadyBuySignal) signals.push(d);
    });

    writeStatusBaseline(newBaseline);

    // Expose to admin.html's FCM sender (window._latestNewSignals is read by
    // sendFcmToAllUsers() after data upload + reinitDashboard() runs).
    window._latestNewSignals = signals;

    const watchlistOnly = document.getElementById('alertsWatchlistOnlyToggle')?.checked;
    if (watchlistOnly && typeof window.getWatchlistTickers === 'function') {
      const tickers = new Set(window.getWatchlistTickers());
      signals = signals.filter(d => tickers.has(String(d.Ticker)));
    }
    return signals;
  }

  function renderAlertsPanel(signals) {
    const body = document.getElementById('alertsPanelBody');
    if (!body) { console.warn('renderAlertsPanel: alertsPanelBody not found in DOM'); return; }
    if (!signals.length) {
      body.innerHTML = '<div class="alerts-panel-empty">No stocks currently in a buy signal. Check back after the next data update.</div>';
      return;
    }
    body.innerHTML = signals.map(d => `
      <div class="alert-row">
        <div class="alert-row-left">
          <span class="alert-row-ticker">${d.Ticker}</span>
          <span class="alert-row-name">${d.Name || ''}</span>
        </div>
        <span class="alert-row-tag">${
          (typeof sigStatusLabel === 'function' ? sigStatusLabel(d['Signal Status']) : null)
          || String(d['Signal Status'] || '')
        }</span>
      </div>
    `).join('');
  }

  function showAlertToast(signals) {
    const existing = document.getElementById('alertToast');
    if (existing) existing.remove();
    const toast = document.createElement('div');
    toast.id = 'alertToast';
    toast.className = 'alert-toast';
    const tickers = signals.slice(0, 4).map(d => d.Ticker).join(', ');
    const more = signals.length > 4 ? ` +${signals.length - 4} more` : '';
    toast.innerHTML = `
      <button class="alert-toast-close">✕</button>
      <div class="alert-toast-title" style="display:flex;align-items:center;gap:6px;"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="flex-shrink:0;"><path d="M6 8a6 6 0 0 1 12 0c0 7 3 9 3 9H3s3-2 3-9"></path><path d="M10.3 21a1.94 1.94 0 0 0 3.4 0"></path></svg>${signals.length} new buy signal${signals.length > 1 ? 's' : ''}</div>
      <div class="alert-toast-body">${tickers}${more}</div>
    `;
    document.body.appendChild(toast);
    toast.querySelector('.alert-toast-close').addEventListener('click', () => toast.remove());
    setTimeout(() => { if (toast.parentNode) toast.remove(); }, 12000);
  }

  function maybeShowBrowserNotification(signals) {
    // Best-effort desktop/mobile popup while the tab is open. True background
    // push (delivered even when the app/tab is closed) needs a service worker
    // + push subscription + a backend (e.g. Firebase Cloud Messaging) — a
    // separate, bigger build than this in-page notification.
    if (!('Notification' in window)) return;
    const fire = () => {
      const tickers = signals.slice(0, 4).map(d => d.Ticker).join(', ');
      new Notification('New buy signal' + (signals.length > 1 ? 's' : ''), {
        body: `${signals.length} stock${signals.length > 1 ? 's' : ''} just turned bullish: ${tickers}`,
        icon: undefined
      });
    };
    if (Notification.permission === 'granted') {
      fire();
    } else if (Notification.permission !== 'denied') {
      Notification.requestPermission().then(perm => { if (perm === 'granted') fire(); });
    }
  }

  function checkFreshSignalsToday() {
    const signals = findFreshSignalsToday();
    window._latestNewSignals = signals; // persisted so panel can re-render on open
    const badge = document.getElementById('authAlertBadge');
    const countEl = document.getElementById('authAlertsCount');
    // Defensive: these elements should always exist, but if anything ever
    // removes/renames them, fail quietly rather than throwing — an error
    // here must never be able to block unrelated code (e.g. watchlist sync)
    // that happens to run right after this in the same call stack.
    if (!badge || !countEl) {
      console.warn('checkFreshSignalsToday: authAlertBadge/authAlertsCount not found in DOM');
      renderAlertsPanel(signals);
      return;
    }
    if (signals.length > 0) {
      badge.textContent = signals.length;
      badge.classList.remove('hidden');
      countEl.textContent = signals.length;
      countEl.classList.remove('hidden');
      showAlertToast(signals);
      maybeShowBrowserNotification(signals);
    } else {
      badge.classList.add('hidden');
      countEl.classList.add('hidden');
    }
    renderAlertsPanel(signals);
  }
  window.checkFreshSignalsToday = checkFreshSignalsToday;

  // Google sign-in button — must run after DOM is parsed (googleBtn would be
  // null if queried before DOMContentLoaded)
  document.addEventListener('DOMContentLoaded', () => {
    const googleBtn = document.getElementById('authGoogleBtn');
    const googleProvider = new GoogleAuthProvider();
    if (!googleBtn) return;
    googleBtn.addEventListener('click', async () => {
      if (errEl) errEl.textContent = '';
      googleBtn.disabled = true;
      try {
        await signInWithPopup(auth, googleProvider);
      } catch (err) {
        if (err && err.code === 'auth/popup-closed-by-user') {
          // user just closed the popup, no need to show an error
        } else {
          if (errEl) errEl.textContent = typeof friendlyError === 'function' ? friendlyError(err) : (err?.message || 'Sign-in failed');
        }
      } finally {
        googleBtn.disabled = false;
      }
    });
  });

  onAuthStateChanged(auth, (user) => {
    // Auth state is now known — dismiss the splash regardless of outcome.
    // Fade it out rather than snapping it away so the transition feels smooth.
    const splash = document.getElementById('splashOverlay');
    if (splash) {
      splash.style.opacity = '0';
      setTimeout(() => { if (splash.parentNode) splash.parentNode.removeChild(splash); }, 420);
    }

    if (user) {
      document.body.classList.remove('authgate-locked');
      overlay.style.display = 'none';
      const displayName = user.displayName || '';
      const email = user.email || '';
      const initial = (displayName || email || '?').charAt(0).toUpperCase();
      avatarBtn.textContent = initial;
      avatarLg.textContent = initial;
      dropdownName.textContent = displayName || email || 'Account';
      dropdownEmail.textContent = email;
      userMenu.style.display = 'block';
      const isAdmin = ADMIN_EMAILS.includes(email);
      const adminControlsEl = document.getElementById('adminControls');
      if (adminControlsEl) adminControlsEl.style.display = isAdmin ? 'flex' : 'none';
      // Watchlist sync runs first and is wrapped defensively: it must not be
      // skipped just because an unrelated Alerts error happens to throw on
      // the line before it (this previously caused the watchlist to never
      // sync to Firestore at all whenever checkFreshSignalsToday() threw).
      if (typeof window.wlOnSignIn === 'function') window.wlOnSignIn(user.uid, email);
      try { checkFreshSignalsToday(); } catch (e) { console.error('checkFreshSignalsToday failed:', e); }
      // Store the current UID for the push-permission button and register FCM
      // if permission was already granted on a previous visit (so returning
      // users get their token refreshed without needing to click the button again).
      window._currentFcmUid = user.uid;
      syncPushButtonState();
      if (Notification.permission === 'granted') registerForPush(user.uid);
    } else {
      document.body.classList.add('authgate-locked');
      // Only reveal the sign-in form now that auth has confirmed user is logged out.
      // It starts hidden (display:none in CSS) so it never flashes for returning users.
      overlay.style.display = 'flex';
      userMenu.style.display = 'none';
      const adminControlsEl2 = document.getElementById('adminControls');
      if (adminControlsEl2) adminControlsEl2.style.display = 'none';
      dropdown.classList.add('hidden');
      alertsPanel.classList.add('hidden');
      const toast = document.getElementById('alertToast');
      if (toast) toast.remove();
      if (typeof window.wlOnSignOut === 'function') window.wlOnSignOut();
      window._currentFcmUid = null;
      syncPushButtonState();
    }
  });
