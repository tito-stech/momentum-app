/* ==========================================================================
   MOMENTUM - Hash router
   ========================================================================== */

const Router = (() => {

  const routes = {};
  const titles = {
    dashboard: 'Dashboard',
    habits: 'Habitudes',
    goals: 'Objectifs',
    journal: 'Journal',
    finance: 'Finances',
    fitness: 'Fitness',
    sleep: 'Sommeil',
    learning: 'Apprentissage',
    tasks: 'Tâches',
    stats: 'Statistiques',
    settings: 'Paramètres'
  };

  function register(name, renderFn) {
    routes[name] = renderFn;
  }

  async function go(name) {
    if (!routes[name]) name = 'dashboard';
    location.hash = '#/' + name;
  }

  async function render() {
    const hash = location.hash.replace(/^#\//, '') || 'dashboard';
    const name = routes[hash] ? hash : 'dashboard';
    const view = U.$('#view');
    const title = U.$('#topbar-title');

    // Update nav
    U.$$('.nav-item').forEach(n => n.classList.toggle('active', n.dataset.route === name));
    if (title) title.textContent = titles[name] || '';

    // Clear + render
    view.innerHTML = '';
    view.scrollTop = 0;
    try {
      await routes[name](view);
    } catch (err) {
      console.error('[router]', err);
      view.innerHTML = `<div class="empty"><div class="empty-title">Erreur</div><div class="empty-text">${U.escapeHtml(err.message)}</div></div>`;
    }

    // Close sidebar on mobile
    U.$('#sidebar')?.classList.remove('open');
    U.$('#sidebar-overlay')?.classList.remove('show');
  }

  function init() {
    window.addEventListener('hashchange', render);
    U.on(document, '[data-route]', 'click', (e, t) => {
      e.preventDefault();
      go(t.dataset.route);
    });
    render();
  }

  return { register, go, render, init };
})();
