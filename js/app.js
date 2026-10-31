/* ==========================================================================
   MOMENTUM - Bootstrap
   ========================================================================== */

const Views = window.Views = window.Views || {};

const KEY_STORAGE = 'momentum.accessKey';

function readStoredKey() {
  try { return localStorage.getItem(KEY_STORAGE) || null; } catch { return null; }
}
function storeKey(k) {
  try { localStorage.setItem(KEY_STORAGE, k); } catch {}
}
function clearStoredKey() {
  try { localStorage.removeItem(KEY_STORAGE); } catch {}
}
window.Momentum = {
  getCurrentKey: readStoredKey,
  getCurrentOwner: () => {
    const k = readStoredKey();
    return k && typeof getKeyOwner === 'function' ? getKeyOwner(k) : null;
  },
  logout: () => {
    clearStoredKey();
    location.reload();
  }
};

function showGate() {
  const gate = document.getElementById('gate');
  if (!gate) return;
  gate.classList.remove('hidden');
  const splash = document.getElementById('splash');
  if (splash) splash.remove();
  const input = document.getElementById('gate-input');
  const err = document.getElementById('gate-error');
  const form = document.getElementById('gate-form');
  setTimeout(() => input?.focus(), 100);
  form.onsubmit = (e) => {
    e.preventDefault();
    const v = (input.value || '').trim();
    if (isValidKey(v)) {
      storeKey(v);
      gate.classList.add('hidden');
      // relancer tout le flow
      location.reload();
    } else {
      err.classList.remove('hidden');
      input.classList.add('shake');
      setTimeout(() => input.classList.remove('shake'), 500);
    }
  };
}

(async function () {

  // ---- Charger les clés d'activation (JSON distant + cache) ----
  window._accessKeys = await loadAccessKeys();

  // ---- Vérification clé d'activation ----
  const stored = readStoredKey();
  if (!stored || !isValidKey(stored)) {
    // Pas de clé valide → afficher le gate et stopper le boot
    if (stored) clearStoredKey();
    showGate();
    return;
  }

  // ---- Theme ----
  async function applyTheme() {
    const pref = await DB.getSetting('theme', 'light');
    let effective = pref;
    if (pref === 'auto') {
      effective = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    document.body.setAttribute('data-theme', effective);
  }
  window.applyTheme = applyTheme;

  // ---- First-run seed ----
  async function seedIfEmpty() {
    const seeded = await DB.getSetting('seeded');
    if (seeded) return;

    // Example habits
    const today = U.iso(U.today());
    const sampleHabits = [
      { id: U.uid(), name: 'Méditation', emoji: '🧘', color: '#8b5cf6', frequency: 'daily', target: 1, createdAt: Date.now() },
      { id: U.uid(), name: 'Sport', emoji: '💪', color: '#ef4444', frequency: 'daily', target: 1, createdAt: Date.now() },
      { id: U.uid(), name: 'Lecture', emoji: '📚', color: '#0ea5e9', frequency: 'daily', target: 1, createdAt: Date.now() }
    ];
    for (const h of sampleHabits) await DB.put('habits', h);

    await DB.setSetting('seeded', true);
    await DB.setSetting('userName', '');
    await DB.setSetting('currency', '€');
  }

  // ---- Service worker ----
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('./service-worker.js').catch(() => {});
    });
  }

  // ---- Setup DOM listeners ----
  function setupLayout() {
    U.$('#menu-btn')?.addEventListener('click', () => {
      U.$('#sidebar').classList.add('open');
      U.$('#sidebar-overlay').classList.add('show');
    });
    U.$('#sidebar-close')?.addEventListener('click', () => {
      U.$('#sidebar').classList.remove('open');
      U.$('#sidebar-overlay').classList.remove('show');
    });
    U.$('#sidebar-overlay')?.addEventListener('click', () => {
      U.$('#sidebar').classList.remove('open');
      U.$('#sidebar-overlay').classList.remove('show');
    });

    U.$('#theme-btn')?.addEventListener('click', async () => {
      const cur = await DB.getSetting('theme', 'light');
      const next = cur === 'light' ? 'dark' : cur === 'dark' ? 'auto' : 'light';
      await DB.setSetting('theme', next);
      await applyTheme();
      U.toast(`Thème : ${next === 'auto' ? 'automatique' : next === 'dark' ? 'sombre' : 'clair'}`);
    });

    window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyTheme);
  }

  // ---- Register views ----
  function registerViews() {
    Router.register('dashboard', Views.dashboard);
    Router.register('habits', Views.habits);
    Router.register('goals', Views.goals);
    Router.register('journal', Views.journal);
    Router.register('finance', Views.finance);
    Router.register('fitness', Views.fitness);
    Router.register('sleep', Views.sleep);
    Router.register('learning', Views.learning);
    Router.register('tasks', Views.tasks);
    Router.register('stats', Views.stats);
    Router.register('settings', Views.settings);
  }

  // ---- Boot ----
  try {
    await DB.open();
    await applyTheme();
    await seedIfEmpty();
    setupLayout();
    registerViews();
    Router.init();

    // Hide splash
    setTimeout(() => {
      U.$('#splash')?.classList.add('fade');
      U.$('#app')?.classList.remove('hidden');
      setTimeout(() => U.$('#splash')?.remove(), 400);
    }, 200);
  } catch (err) {
    console.error('[boot]', err);
    document.body.innerHTML = `<div style="padding:40px;text-align:center;color:#ef4444;">Erreur: ${err.message}</div>`;
  }
})();

