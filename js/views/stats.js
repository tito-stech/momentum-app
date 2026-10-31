/* ==========================================================================
   MOMENTUM - Global stats view
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
    const currency = await DB.getSetting('currency', '€');

    const header = U.el('div', { class: 'view-header' });
    header.appendChild(U.el('h2', { text: 'Statistiques globales' }));
    root.appendChild(header);

    // Big KPIs
    const totalActions = habitLogs.length + journal.length + workouts.length + sleepLogs.length + tx.length + pomos.length + tasks.filter(t => t.done).length;
    const activeDays = new Set([
      ...habitLogs.map(l => l.date),
      ...journal.map(j => j.date),
      ...workouts.map(w => w.date),
      ...sleepLogs.map(s => s.date),
      ...tx.map(t => t.date),
      ...pomos.map(p => p.date)
    ]).size;
    const totalFocusMin = Math.round(U.sum(pomos.filter(p => p.type === 'focus').map(p => p.duration / 60)));

    const kpis = U.el('div', { class: 'grid grid-auto-sm' });
    kpis.appendChild(Comp.statCard({ label: 'Jours actifs', value: activeDays }));
    kpis.appendChild(Comp.statCard({ label: 'Actions totales', value: totalActions }));
    kpis.appendChild(Comp.statCard({ label: 'Focus cumulé', value: Math.floor(totalFocusMin / 60), unit: 'h' }));
    kpis.appendChild(Comp.statCard({ label: 'Objectifs atteints', value: goals.filter(g => g.done).length }));
    kpis.appendChild(Comp.statCard({ label: 'Livres lus', value: books.filter(b => b.status === 'read').length }));
    kpis.appendChild(Comp.statCard({ label: 'Habitudes totales', value: habitLogs.length }));
    root.appendChild(kpis);

    // Activity heatmap (all modules combined)
    const activityMap = {};
    [...habitLogs, ...journal, ...workouts, ...sleepLogs, ...tx, ...pomos].forEach(x => {
      if (x.date) activityMap[x.date] = (activityMap[x.date] || 0) + 1;
    });
    const heatCard = U.el('div', { class: 'chart-container' });
    heatCard.appendChild(U.el('h3', { text: 'Activité globale (6 mois)' }));
    heatCard.appendChild(Charts.heatmap({ data: activityMap, days: 182, color: '#8b5cf6' }));
    root.appendChild(heatCard);

    // Multi-line evolution: mood + sleep (last 30 days)
    const data30 = [];
    for (let i = 29; i >= 0; i--) {
      const d = U.addDays(U.today(), -i);
      const iso = U.iso(d);
      const j = journal.find(x => x.date === iso);
      const s = sleepLogs.find(x => x.date === iso);
      const workouts30 = workouts.find(x => x.date === iso);
      data30.push({ date: iso, mood: j?.mood || 0, sleep: s ? s.duration / 60 : 0, workout: workouts30 ? 1 : 0 });
    }

    if (journal.length) {
      const chart = U.el('div', { class: 'chart-container' });
      chart.appendChild(U.el('h3', { text: 'Humeur sur 30 jours' }));
      chart.appendChild(Charts.line({
        data: data30.map(d => d.mood),
        labels: data30.map(d => d.date.slice(8)),
        color: '#ec4899',
        yFormat: v => v.toFixed(1)
      }));
      root.appendChild(chart);
    }

    if (sleepLogs.length) {
      const chart = U.el('div', { class: 'chart-container' });
      chart.appendChild(U.el('h3', { text: 'Sommeil sur 30 jours' }));
      chart.appendChild(Charts.bar({
        data: data30.map(d => d.sleep),
        labels: data30.map(d => d.date.slice(8)),
        color: '#6366f1',
        yFormat: v => v.toFixed(1) + 'h'
      }));
      root.appendChild(chart);
    }

    // Correlations
    const corr = calcCorrelations({ journal, sleepLogs, workouts, pomos });
    if (corr.length) {
      const card = U.el('div', { class: 'card' });
      card.appendChild(Comp.section('Corrélations détectées'));
      card.appendChild(U.el('div', { class: 'text-sm text-muted', text: 'Basé sur tes données, voici des liens observés entre tes activités.' }));
      corr.forEach(c => {
        const row = U.el('div', { class: 'list-item' });
        row.innerHTML = `
          <div style="width:36px;text-align:center;font-size:22px;">${c.icon}</div>
          <div class="list-item-main">
            <div class="list-item-title">${c.text}</div>
            <div class="list-item-sub">Observation sur ${c.n} jours</div>
          </div>
          <div class="pill ${c.score > 0 ? 'fin' : 'fit'}">${c.score > 0 ? '+' : ''}${(c.score * 100).toFixed(0)}%</div>
        `;
        card.appendChild(row);
      });
      root.appendChild(card);
    }

    // Habits leaderboard
    if (habits.length) {
      const leaderCard = U.el('div', { class: 'card' });
      leaderCard.appendChild(Comp.section('Habitudes les plus suivies'));
      const sorted = habits.map(h => ({ h, count: habitLogs.filter(l => l.habitId === h.id).length })).sort((a, b) => b.count - a.count).slice(0, 8);
      leaderCard.appendChild(Charts.hBarList({
        items: sorted.map(({ h, count }) => ({
          label: (h.emoji || '') + ' ' + h.name,
          value: count,
          display: count + 'x',
          color: h.color
        })),
        color: '#10b981'
      }));
      root.appendChild(leaderCard);
    }

    // Weekday pattern
    if (habitLogs.length > 7) {
      const byDow = [0, 0, 0, 0, 0, 0, 0];
      habitLogs.forEach(l => byDow[(U.fromISO(l.date).getDay() + 6) % 7]++);
      const chart = U.el('div', { class: 'chart-container' });
      chart.appendChild(U.el('h3', { text: 'Patterns par jour de semaine' }));
      chart.appendChild(Charts.bar({
        data: byDow,
        labels: ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'],
        color: '#8b5cf6'
      }));
      root.appendChild(chart);
    }
  };

  // Simple correlation finder (illustrative)
  function calcCorrelations({ journal, sleepLogs, workouts, pomos }) {
    const results = [];
    const workoutDates = new Set(workouts.map(w => w.date));

    // Mood on workout days vs rest days
    if (journal.length >= 7 && workouts.length >= 3) {
      const moodW = journal.filter(j => workoutDates.has(j.date)).map(j => j.mood);
      const moodR = journal.filter(j => !workoutDates.has(j.date)).map(j => j.mood);
      if (moodW.length >= 2 && moodR.length >= 2) {
        const diff = (U.avg(moodW) - U.avg(moodR)) / 5;
        if (Math.abs(diff) > 0.03) {
          results.push({
            icon: '💪',
            text: `Humeur ${diff > 0 ? 'meilleure' : 'moindre'} les jours de sport`,
            score: diff,
            n: moodW.length + moodR.length
          });
        }
      }
    }

    // Mood vs sleep duration
    if (journal.length >= 7 && sleepLogs.length >= 7) {
      const paired = [];
      journal.forEach(j => {
        const s = sleepLogs.find(x => x.date === j.date);
        if (s && j.mood) paired.push({ mood: j.mood, sleep: s.duration });
      });
      if (paired.length >= 5) {
        const highSleep = paired.filter(p => p.sleep >= 420);
        const lowSleep = paired.filter(p => p.sleep < 420);
        if (highSleep.length >= 2 && lowSleep.length >= 2) {
          const diff = (U.avg(highSleep.map(p => p.mood)) - U.avg(lowSleep.map(p => p.mood))) / 5;
          if (Math.abs(diff) > 0.03) {
            results.push({
              icon: '😴',
              text: `Humeur ${diff > 0 ? 'meilleure' : 'moindre'} après ≥ 7h de sommeil`,
              score: diff,
              n: paired.length
            });
          }
        }
      }
    }

    // Focus days vs mood
    const focusDates = new Set(pomos.filter(p => p.type === 'focus').map(p => p.date));
    if (journal.length >= 7 && focusDates.size >= 3) {
      const moodF = journal.filter(j => focusDates.has(j.date)).map(j => j.mood);
      const moodNF = journal.filter(j => !focusDates.has(j.date)).map(j => j.mood);
      if (moodF.length >= 2 && moodNF.length >= 2) {
        const diff = (U.avg(moodF) - U.avg(moodNF)) / 5;
        if (Math.abs(diff) > 0.03) {
          results.push({
            icon: '🎯',
            text: `Humeur ${diff > 0 ? 'meilleure' : 'moindre'} les jours avec Pomodoro`,
            score: diff,
            n: moodF.length + moodNF.length
          });
        }
      }
    }

    return results.sort((a, b) => Math.abs(b.score) - Math.abs(a.score));
  }
})();
