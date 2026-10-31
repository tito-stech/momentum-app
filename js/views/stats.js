/* ==========================================================================
   MOMENTUM - Global stats view (accordion)
   ========================================================================== */

(function () {
  if (!window.Views) window.Views = {};

  window.Views.stats = async function (root) {

    const [habits, habitLogs, journal, tx, workouts, sleepLogs, tasks, pomos, measures, nutrition, goals, books]
      = await Promise.all([
        DB.getAll('habits'), DB.getAll('habitLogs'),
        DB.getAll('journal'), DB.getAll('transactions'),
        DB.getAll('workouts'), DB.getAll('sleepLogs'),
        DB.getAll('tasks'), DB.getAll('pomodoroSessions'),
        DB.getAll('bodyMeasures'), DB.getAll('nutrition'),
        DB.getAll('goals'), DB.getAll('books')
      ]);

    const header = U.el('div', { class: 'view-header' });
    header.appendChild(U.el('h2', { text: 'Statistiques' }));
    root.appendChild(header);

    // KPIs (toujours visibles)
    const totalActions = habitLogs.length + journal.length + workouts.length + sleepLogs.length + tx.length + pomos.length + tasks.filter(t => t.done).length;
    const activeDays = new Set([
      ...habitLogs.map(l => l.date), ...journal.map(j => j.date), ...workouts.map(w => w.date),
      ...sleepLogs.map(s => s.date), ...tx.map(t => t.date), ...pomos.map(p => p.date)
    ]).size;
    const totalFocusMin = Math.round(U.sum(pomos.filter(p => p.type === 'focus').map(p => p.duration / 60)));

    const kpis = U.el('div', { class: 'grid grid-auto-sm' });
    kpis.appendChild(Comp.statCard({ label: 'Jours actifs', value: activeDays }));
    kpis.appendChild(Comp.statCard({ label: 'Actions totales', value: totalActions }));
    kpis.appendChild(Comp.statCard({ label: 'Focus cumulé', value: Math.floor(totalFocusMin / 60), unit: 'h' }));
    kpis.appendChild(Comp.statCard({ label: 'Objectifs atteints', value: goals.filter(g => g.done).length }));
    kpis.appendChild(Comp.statCard({ label: 'Livres lus', value: books.filter(b => b.status === 'read').length }));
    kpis.appendChild(Comp.statCard({ label: 'Habitudes', value: habitLogs.length }));
    root.appendChild(kpis);

    // Build accordion sections
    const sections = [];

    // Activity heatmap
    sections.push({
      title: 'Activité globale (6 mois)',
      icon: '🔥',
      build: () => {
        const map = {};
        [...habitLogs, ...journal, ...workouts, ...sleepLogs, ...tx, ...pomos].forEach(x => {
          if (x.date) map[x.date] = (map[x.date] || 0) + 1;
        });
        return Charts.heatmap({ data: map, days: 182, color: '#8b5cf6' });
      }
    });

    // Mood 30 days
    if (journal.length) {
      sections.push({
        title: 'Humeur sur 30 jours',
        icon: '😊',
        build: () => {
          const vals = [], labels = [];
          for (let i = 29; i >= 0; i--) {
            const d = U.addDays(U.today(), -i);
            const j = journal.find(x => x.date === U.iso(d));
            vals.push(j ? j.mood : 0);
            labels.push(d.getDate() + '/' + (d.getMonth() + 1));
          }
          return Charts.line({ data: vals, labels, color: '#ec4899', yFormat: v => v.toFixed(1) });
        }
      });
    }

    // Sleep 30 days
    if (sleepLogs.length) {
      sections.push({
        title: 'Sommeil sur 30 jours',
        icon: '😴',
        build: () => {
          const vals = [], labels = [];
          for (let i = 29; i >= 0; i--) {
            const d = U.addDays(U.today(), -i);
            const s = sleepLogs.find(x => x.date === U.iso(d));
            vals.push(s ? s.duration / 60 : 0);
            labels.push(d.getDate() + '/' + (d.getMonth() + 1));
          }
          return Charts.bar({ data: vals, labels, color: '#6366f1', yFormat: v => v.toFixed(1) + 'h' });
        }
      });
    }

    // Correlations
    const corr = calcCorrelations({ journal, sleepLogs, workouts, pomos });
    if (corr.length) {
      sections.push({
        title: 'Corrélations détectées',
        icon: '🔗',
        build: () => {
          const wrap = U.el('div');
          wrap.appendChild(U.el('div', { class: 'text-xs text-muted', style: { marginBottom: '10px' }, text: 'Liens observés entre tes activités.' }));
          corr.forEach(c => {
            const row = U.el('div', { class: 'list-item' });
            row.innerHTML = `
              <div style="width:28px;text-align:center;font-size:18px;">${c.icon}</div>
              <div class="list-item-main">
                <div class="list-item-title">${c.text}</div>
                <div class="list-item-sub">Sur ${c.n} jours</div>
              </div>
              <div class="pill ${c.score > 0 ? 'fin' : 'fit'}">${c.score > 0 ? '+' : ''}${(c.score * 100).toFixed(0)}%</div>
            `;
            wrap.appendChild(row);
          });
          return wrap;
        }
      });
    }

    // Habits leaderboard
    if (habits.length) {
      sections.push({
        title: 'Habitudes les plus suivies',
        icon: '🏆',
        build: () => {
          const sorted = habits.map(h => ({ h, count: habitLogs.filter(l => l.habitId === h.id).length })).sort((a, b) => b.count - a.count).slice(0, 8);
          return Charts.hBarList({
            items: sorted.map(({ h, count }) => ({
              label: (h.emoji || '') + ' ' + h.name,
              value: count,
              display: count + 'x',
              color: h.color
            })),
            color: '#10b981'
          });
        }
      });
    }

    // Weekday pattern
    if (habitLogs.length > 7) {
      sections.push({
        title: 'Pattern par jour de semaine',
        icon: '📅',
        build: () => {
          const byDow = [0, 0, 0, 0, 0, 0, 0];
          habitLogs.forEach(l => byDow[(U.fromISO(l.date).getDay() + 6) % 7]++);
          return Charts.bar({ data: byDow, labels: ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'], color: '#8b5cf6' });
        }
      });
    }

    if (sections.length === 0) {
      root.appendChild(Comp.emptyState({ title: 'Pas assez de données', text: 'Utilise l\'app quelques jours pour voir apparaître tes stats.' }));
      return;
    }

    // Render accordion grid
    const accWrap = U.el('div', { class: 'col gap-2' });
    sections.forEach((s, idx) => {
      const acc = Comp.accordion({ title: s.title, icon: s.icon, open: idx === 0 });
      acc.body.appendChild(s.build());
      accWrap.appendChild(acc.el);
    });
    root.appendChild(accWrap);
  };

  function calcCorrelations({ journal, sleepLogs, workouts, pomos }) {
    const results = [];
    const workoutDates = new Set(workouts.map(w => w.date));

    if (journal.length >= 7 && workouts.length >= 3) {
      const moodW = journal.filter(j => workoutDates.has(j.date)).map(j => j.mood);
      const moodR = journal.filter(j => !workoutDates.has(j.date)).map(j => j.mood);
      if (moodW.length >= 2 && moodR.length >= 2) {
        const diff = (U.avg(moodW) - U.avg(moodR)) / 5;
        if (Math.abs(diff) > 0.03) results.push({ icon: '💪', text: `Humeur ${diff > 0 ? 'meilleure' : 'moindre'} les jours de sport`, score: diff, n: moodW.length + moodR.length });
      }
    }

    if (journal.length >= 7 && sleepLogs.length >= 7) {
      const paired = [];
      journal.forEach(j => {
        const s = sleepLogs.find(x => x.date === j.date);
        if (s && j.mood) paired.push({ mood: j.mood, sleep: s.duration });
      });
      if (paired.length >= 5) {
        const high = paired.filter(p => p.sleep >= 420);
        const low = paired.filter(p => p.sleep < 420);
        if (high.length >= 2 && low.length >= 2) {
          const diff = (U.avg(high.map(p => p.mood)) - U.avg(low.map(p => p.mood))) / 5;
          if (Math.abs(diff) > 0.03) results.push({ icon: '😴', text: `Humeur ${diff > 0 ? 'meilleure' : 'moindre'} après ≥ 7h de sommeil`, score: diff, n: paired.length });
        }
      }
    }

    const focusDates = new Set(pomos.filter(p => p.type === 'focus').map(p => p.date));
    if (journal.length >= 7 && focusDates.size >= 3) {
      const moodF = journal.filter(j => focusDates.has(j.date)).map(j => j.mood);
      const moodNF = journal.filter(j => !focusDates.has(j.date)).map(j => j.mood);
      if (moodF.length >= 2 && moodNF.length >= 2) {
        const diff = (U.avg(moodF) - U.avg(moodNF)) / 5;
        if (Math.abs(diff) > 0.03) results.push({ icon: '🎯', text: `Humeur ${diff > 0 ? 'meilleure' : 'moindre'} les jours avec Pomodoro`, score: diff, n: moodF.length + moodNF.length });
      }
    }

    return results.sort((a, b) => Math.abs(b.score) - Math.abs(a.score));
  }
})();
