/* ==========================================================================
   MOMENTUM - Habits view
   ========================================================================== */

(function () {
  if (!window.Views) window.Views = {};

  const EMOJIS = ['💪', '🧘', '📚', '🏃', '💧', '🥗', '😴', '✍️', '🎯', '🧠', '🎨', '🎸', '🧹', '☀️', '🌱', '📵'];

  window.Views.habits = async function (root) {

    const habits = await DB.getAll('habits');
    const logs = await DB.getAll('habitLogs');
    const today = U.iso(U.today());

    // Header
    const header = U.el('div', { class: 'view-header' });
    header.appendChild(U.el('h2', { text: 'Habitudes' }));
    header.appendChild(U.el('div', { class: 'spacer' }));
    header.appendChild(U.el('button', {
      class: 'btn btn-primary',
      html: '<svg viewBox="0 0 24 24" width="16" height="16"><path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/></svg><span>Nouvelle habitude</span>',
      onclick: () => openForm()
    }));
    root.appendChild(header);

    if (habits.length === 0) {
      root.appendChild(Comp.emptyState({
        title: 'Pas encore d\'habitude',
        text: 'Crée ta première habitude pour commencer à construire ton momentum.',
        action: 'Nouvelle habitude',
        onAction: openForm
      }));
      return;
    }

    // Overall stats
    const todayLogs = logs.filter(l => l.date === today);
    const doneToday = todayLogs.length;
    const completion = habits.length ? Math.round(doneToday / habits.length * 100) : 0;
    const streaks = habits.map(h => Views._calcStreak(h.id, logs));
    const bestStreak = Math.max(0, ...streaks);
    const totalLogs = logs.length;

    const statsRow = U.el('div', { class: 'grid grid-auto-sm' });
    statsRow.appendChild(Comp.statCard({ label: 'Aujourd\'hui', value: `${doneToday}/${habits.length}`, delta: completion + '%' }));
    statsRow.appendChild(Comp.statCard({ label: 'Meilleur streak', value: bestStreak, unit: 'jours' }));
    statsRow.appendChild(Comp.statCard({ label: 'Habitudes actives', value: habits.length }));
    statsRow.appendChild(Comp.statCard({ label: 'Compléted (total)', value: totalLogs }));
    root.appendChild(statsRow);

    // 90-day heatmap global
    const heatCard = U.el('div', { class: 'chart-container' });
    heatCard.appendChild(U.el('h3', { text: 'Activité (90 derniers jours)' }));
    const dateMap = {};
    logs.forEach(l => { dateMap[l.date] = (dateMap[l.date] || 0) + 1; });
    heatCard.appendChild(Charts.heatmap({ data: dateMap, days: 91, color: '#10b981' }));
    root.appendChild(heatCard);

    // List habits
    const list = U.el('div', { class: 'col gap-4' });
    habits.forEach(hab => {
      const habLogs = logs.filter(l => l.habitId === hab.id);
      const streak = Views._calcStreak(hab.id, logs);
      const done30 = habLogs.filter(l => l.date >= U.iso(U.addDays(U.today(), -29))).length;
      const pct30 = Math.round(done30 / 30 * 100);
      const doneToday = habLogs.some(l => l.date === today);

      const card = U.el('div', { class: 'habit-card' });
      card.innerHTML = `
        <div class="habit-emoji" style="background:${(hab.color || '#8b5cf6')}22;color:${hab.color || '#8b5cf6'};">${hab.emoji || '•'}</div>
        <div class="habit-info">
          <div class="habit-name">${U.escapeHtml(hab.name)}</div>
          <div class="habit-meta">
            <span>${streak > 0 ? '🔥 ' + streak + 'j' : 'Pas de streak'}</span>
            <span>${pct30}% sur 30j</span>
            <span>${habLogs.length} total</span>
          </div>
        </div>
        <div class="habit-done ${doneToday ? 'done' : ''}" data-id="${hab.id}">
          ${doneToday ? '<svg viewBox="0 0 24 24" width="22" height="22"><path d="M5 12l4 4L19 7" stroke="currentColor" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>' : ''}
        </div>
      `;
      card.querySelector('.habit-done').onclick = async () => {
        const existing = logs.find(l => l.habitId === hab.id && l.date === today);
        if (existing) await DB.del('habitLogs', existing.id);
        else await DB.put('habitLogs', { habitId: hab.id, date: today, count: 1 });
        Router.render();
      };
      card.onclick = (e) => {
        if (e.target.closest('.habit-done')) return;
        openDetail(hab);
      };
      card.style.cursor = 'pointer';
      list.appendChild(card);
    });
    root.appendChild(list);

    // --- Forms ---

    function openForm(existing) {
      Comp.formModal({
        title: existing ? 'Modifier l\'habitude' : 'Nouvelle habitude',
        fields: [
          { name: 'name', label: 'Nom', required: true, placeholder: 'Méditation, Lecture, Sport...' },
          { name: 'emoji', label: 'Emoji', value: '💪', placeholder: '💪' },
          { name: 'color', label: 'Couleur', type: 'select', value: '#8b5cf6', options: [
            { value: '#8b5cf6', label: 'Violet' }, { value: '#10b981', label: 'Vert' }, { value: '#ef4444', label: 'Rouge' },
            { value: '#f59e0b', label: 'Orange' }, { value: '#0ea5e9', label: 'Bleu' }, { value: '#ec4899', label: 'Rose' }
          ] },
          { name: 'frequency', label: 'Fréquence', type: 'select', value: 'daily', options: [
            { value: 'daily', label: 'Chaque jour' }, { value: 'weekly', label: 'Chaque semaine' }
          ] }
        ],
        values: existing || { color: '#8b5cf6', emoji: '💪', frequency: 'daily' },
        submitText: existing ? 'Enregistrer' : 'Créer',
        onSubmit: async (v) => {
          const obj = existing ? { ...existing, ...v } : v;
          await DB.put('habits', obj);
          U.toast(existing ? 'Habitude modifiée' : 'Habitude créée', 'success');
          Router.render();
        }
      });
    }

    async function openDetail(hab) {
      const habLogs = logs.filter(l => l.habitId === hab.id);
      const body = U.el('div', { class: 'col gap-4' });

      const streak = Views._calcStreak(hab.id, logs);
      const stats = U.el('div', { class: 'grid grid-3' });
      stats.appendChild(Comp.statCard({ label: 'Streak', value: streak, unit: 'j' }));
      stats.appendChild(Comp.statCard({ label: 'Total', value: habLogs.length }));
      stats.appendChild(Comp.statCard({ label: '30 derniers', value: habLogs.filter(l => l.date >= U.iso(U.addDays(U.today(), -29))).length }));
      body.appendChild(stats);

      const dateMap = {};
      habLogs.forEach(l => { dateMap[l.date] = 1; });
      body.appendChild(U.el('div', { style: { marginTop: '12px' }, html: '<div class="card-title">Historique (6 mois)</div>' }));
      body.appendChild(Charts.heatmap({ data: dateMap, days: 182, color: hab.color || '#10b981' }));

      body.appendChild(U.el('div', { class: 'row', style: { marginTop: '16px' } }, [
        U.el('button', { class: 'btn full', text: 'Modifier', onclick: () => { m.close(); openForm(hab); } }),
        U.el('button', { class: 'btn btn-danger full', text: 'Supprimer', onclick: async () => {
          m.close();
          if (await U.confirm(`Supprimer "${hab.name}" et tout son historique ?`, { danger: true })) {
            await DB.del('habits', hab.id);
            for (const l of habLogs) await DB.del('habitLogs', l.id);
            U.toast('Habitude supprimée');
            Router.render();
          }
        } })
      ]));

      const m = U.modal({ title: hab.emoji + ' ' + hab.name, body });
    }
  };
})();
