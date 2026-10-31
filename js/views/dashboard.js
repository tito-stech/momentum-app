/* ==========================================================================
   MOMENTUM - Dashboard view (vue d'ensemble)
   ========================================================================== */

(function () {
  if (!window.Views) window.Views = {};

  window.Views.dashboard = async function (root) {

    const [habits, habitLogs, journal, transactions, workouts, sleepLogs, tasks, goals, pomodoros] = await Promise.all([
      DB.getAll('habits'), DB.getAll('habitLogs'),
      DB.getAll('journal'), DB.getAll('transactions'),
      DB.getAll('workouts'), DB.getAll('sleepLogs'),
      DB.getAll('tasks'), DB.getAll('goals'),
      DB.getAll('pomodoroSessions')
    ]);

    const today = U.iso(U.today());
    const userName = await DB.getSetting('userName', '');
    const currency = await DB.getSetting('currency', '€');

    // Greeting
    const h = new Date().getHours();
    const greet = h < 6 ? 'Bonne nuit' : h < 12 ? 'Bonjour' : h < 18 ? 'Bon aprem' : 'Bonsoir';

    // Habits today
    const todayLogs = habitLogs.filter(l => l.date === today);
    const habitsDone = todayLogs.length;
    const habitsTotal = habits.length;

    // Streak global (max streak across habits)
    const streaks = habits.map(hab => calcStreak(hab.id, habitLogs));
    const bestStreak = Math.max(0, ...streaks);

    // Mood today
    const todayJournal = journal.find(j => j.date === today);
    const moodAvg = journal.length ? U.avg(journal.slice(-7).map(j => j.mood || 3)).toFixed(1) : '-';

    // Finance this month
    const monthStart = U.iso(U.startOfMonth(new Date()));
    const monthTx = transactions.filter(t => t.date >= monthStart);
    const income = U.sum(monthTx.filter(t => t.type === 'income').map(t => t.amount));
    const expense = U.sum(monthTx.filter(t => t.type === 'expense').map(t => t.amount));
    const balance = income - expense;

    // Workouts this week
    const weekStart = U.iso(U.startOfWeek(new Date()));
    const weekWorkouts = workouts.filter(w => w.date >= weekStart);

    // Sleep last 7 days
    const sleep7 = sleepLogs.slice(-7);
    const sleepAvg = sleep7.length ? U.avg(sleep7.map(s => s.duration || 0)) : 0;

    // Tasks
    const openTasks = tasks.filter(t => !t.done);
    const dueToday = openTasks.filter(t => t.dueDate && t.dueDate <= today);

    // Focus today
    const todayPomos = pomodoros.filter(p => p.date === today && p.type === 'focus');
    const focusMinToday = U.sum(todayPomos.map(p => p.duration / 60));

    // Goals in progress
    const activeGoals = goals.filter(g => !g.done).slice(0, 3);

    // --- Render ---

    // Hero
    const hero = U.el('div', { class: 'hero-card' });
    hero.innerHTML = `
      <div class="hero-greeting">${greet}${userName ? ', ' + U.escapeHtml(userName) : ''}</div>
      <div class="hero-title">${U.fmtDateLong(new Date()).charAt(0).toUpperCase() + U.fmtDateLong(new Date()).slice(1)}</div>
      <div class="hero-sub">Ta progression du jour, en un coup d'œil. Clique sur un module pour aller plus loin.</div>
      <div class="hero-stats">
        <div class="hero-stat"><div class="hero-stat-value">${habitsDone}/${habitsTotal}</div><div class="hero-stat-label">Habitudes</div></div>
        <div class="hero-stat"><div class="hero-stat-value">${bestStreak}</div><div class="hero-stat-label">Streak</div></div>
        <div class="hero-stat"><div class="hero-stat-value">${openTasks.length}</div><div class="hero-stat-label">Tâches</div></div>
        <div class="hero-stat"><div class="hero-stat-value">${Math.round(focusMinToday)}<span style="font-size:14px;color:var(--text-2);"> min</span></div><div class="hero-stat-label">Focus</div></div>
      </div>
    `;
    root.appendChild(hero);

    // Quick actions
    const quick = U.el('div', { class: 'quick-actions' });
    const actions = [
      { title: 'Journal', sub: todayJournal ? 'Déjà écrit aujourd\'hui' : 'Note du jour', color: '#ec4899', route: 'journal', icon: '📝' },
      { title: 'Habitudes', sub: `${habitsDone}/${habitsTotal} aujourd'hui`, color: '#10b981', route: 'habits', icon: '✅' },
      { title: 'Tâches', sub: `${dueToday.length} dues`, color: '#a855f7', route: 'tasks', icon: '📋' },
      { title: 'Focus', sub: 'Pomodoro', color: '#0ea5e9', route: 'learning', icon: '🎯' }
    ];
    actions.forEach(a => {
      const btn = U.el('button', { class: 'quick-action', onclick: () => Router.go(a.route) });
      btn.innerHTML = `
        <div class="quick-action-icon" style="background:${a.color}20;color:${a.color};font-size:16px;">${a.icon}</div>
        <div class="quick-action-main">
          <div class="quick-action-title">${a.title}</div>
          <div class="quick-action-sub">${a.sub}</div>
        </div>
      `;
      quick.appendChild(btn);
    });
    root.appendChild(quick);

    // Stats grid
    const stats = U.el('div', { class: 'grid grid-auto-sm' });
    stats.appendChild(Comp.statCard({
      label: 'Humeur 7j',
      value: moodAvg,
      unit: '/5',
      icon: '<svg viewBox="0 0 24 24" width="24" height="24"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/><path d="M8 14s1.5 2 4 2 4-2 4-2M9 9h.01M15 9h.01" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/></svg>'
    }));
    stats.appendChild(Comp.statCard({
      label: 'Solde du mois',
      value: U.fmtNum(balance, 0),
      unit: currency,
      deltaDir: balance >= 0 ? 'up' : 'down',
      delta: balance >= 0 ? '+' + U.fmtNum(balance, 0) : U.fmtNum(balance, 0),
      icon: '<svg viewBox="0 0 24 24" width="24" height="24"><path d="M4 7h16v11a2 2 0 01-2 2H6a2 2 0 01-2-2V7z" fill="none" stroke="currentColor" stroke-width="2"/></svg>'
    }));
    stats.appendChild(Comp.statCard({
      label: 'Séances / semaine',
      value: weekWorkouts.length,
      icon: '<svg viewBox="0 0 24 24" width="24" height="24"><path d="M6 7v10M18 7v10M3 10v4M21 10v4M8 12h8" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>'
    }));
    stats.appendChild(Comp.statCard({
      label: 'Sommeil moy. 7j',
      value: sleep7.length ? (sleepAvg / 60).toFixed(1) : '-',
      unit: 'h',
      icon: '<svg viewBox="0 0 24 24" width="24" height="24"><path d="M21 13a9 9 0 11-10-10 7 7 0 0010 10z" fill="none" stroke="currentColor" stroke-width="2"/></svg>'
    }));
    root.appendChild(stats);

    // Two columns: today habits + due tasks (collapsible)
    const twoCol = U.el('div', { class: 'grid grid-2' });

    // Habits of today
    const habAcc = Comp.accordion({ title: `Habitudes du jour (${habitsDone}/${habitsTotal})`, icon: '✅', open: false });
    const habitsCard = habAcc.body;
    if (habits.length === 0) {
      habitsCard.appendChild(Comp.emptyState({ title: 'Pas encore d\'habitude', text: 'Crée ta première habitude.', action: 'Nouvelle habitude', onAction: () => Router.go('habits') }));
    } else {
      habits.slice(0, 5).forEach(hab => {
        const done = todayLogs.some(l => l.habitId === hab.id);
        const row = U.el('div', { class: 'list-item' });
        row.innerHTML = `
          <span class="emoji">${hab.emoji || '•'}</span>
          <div class="list-item-main">
            <div class="list-item-title">${U.escapeHtml(hab.name)}</div>
            <div class="list-item-sub">Streak ${calcStreak(hab.id, habitLogs)}</div>
          </div>
          <div class="habit-done ${done ? 'done' : ''}" data-h="${hab.id}">
            ${done ? '<svg viewBox="0 0 24 24" width="20" height="20"><path d="M5 12l4 4L19 7" stroke="currentColor" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>' : ''}
          </div>
        `;
        row.querySelector('.habit-done').onclick = async () => {
          const existing = habitLogs.find(l => l.habitId === hab.id && l.date === today);
          if (existing) {
            await DB.del('habitLogs', existing.id);
          } else {
            await DB.put('habitLogs', { habitId: hab.id, date: today, count: 1 });
          }
          Router.render();
        };
        habitsCard.appendChild(row);
      });
    }
    twoCol.appendChild(habAcc.el);

    // Due tasks
    const taskAcc = Comp.accordion({ title: `Tâches à faire (${openTasks.length})`, icon: '📋', open: false });
    const tasksCard = taskAcc.body;
    const shown = U.sortBy(openTasks, t => t.dueDate || '9999').slice(0, 5);
    if (shown.length === 0) {
      tasksCard.appendChild(Comp.emptyState({ title: 'Tout est fait', text: 'Rien de prévu.' }));
    } else {
      shown.forEach(t => {
        const overdue = t.dueDate && t.dueDate < today;
        const row = U.el('div', { class: 'task-item' });
        row.innerHTML = `
          <div class="task-prio p${t.priority || 4}"></div>
          <div class="task-text">${U.escapeHtml(t.title)}</div>
          ${t.dueDate ? `<div class="task-due ${overdue ? 'overdue' : ''}">${U.fmtRelative(t.dueDate)}</div>` : ''}
        `;
        tasksCard.appendChild(row);
      });
    }
    twoCol.appendChild(taskAcc.el);

    root.appendChild(twoCol);

    // Goals snapshot
    if (activeGoals.length) {
      const goalsAcc = Comp.accordion({ title: `Objectifs en cours (${activeGoals.length})`, icon: '🎯', open: false });
      const goalsCard = goalsAcc.body;
      activeGoals.forEach(g => {
        const krDone = (g.keyResults || []).filter(k => k.done).length;
        const krTotal = (g.keyResults || []).length;
        const pct = krTotal ? (krDone / krTotal) * 100 : 0;
        const row = U.el('div', { style: { padding: '10px 0', borderBottom: '1px solid var(--border)' } });
        row.innerHTML = `
          <div style="display:flex;justify-content:space-between;margin-bottom:6px;">
            <div style="font-weight:500;">${U.escapeHtml(g.title)}</div>
            <div class="text-sm text-muted">${krDone}/${krTotal}</div>
          </div>
          <div class="progress thin"><div class="progress-bar" style="width:${pct}%"></div></div>
        `;
        goalsCard.appendChild(row);
      });
      root.appendChild(goalsAcc.el);
    }

    // Weekly mood chart
    if (journal.length) {
      const chartAcc = Comp.accordion({ title: 'Humeur sur 14 jours', icon: '😊', open: false });
      const chartCard = chartAcc.body;
      const dates = [];
      const vals = [];
      const labels = [];
      for (let i = 13; i >= 0; i--) {
        const d = U.addDays(U.today(), -i);
        const iso = U.iso(d);
        const j = journal.find(x => x.date === iso);
        dates.push(iso);
        vals.push(j ? j.mood : 0);
        labels.push(d.getDate() + '/' + (d.getMonth() + 1));
      }
      chartCard.appendChild(Charts.line({ data: vals, labels, color: '#ec4899', yFormat: v => v.toFixed(1) }));
      root.appendChild(chartAcc.el);
    }
  };

  function calcStreak(habitId, logs) {
    const sorted = logs.filter(l => l.habitId === habitId).map(l => l.date).sort().reverse();
    if (!sorted.length) return 0;
    let streak = 0;
    let cursor = U.today();
    const todayISO = U.iso(cursor);
    // allow skipping today if not yet done
    if (sorted[0] !== todayISO) cursor = U.addDays(cursor, -1);
    for (;;) {
      const iso = U.iso(cursor);
      if (sorted.includes(iso)) { streak++; cursor = U.addDays(cursor, -1); }
      else break;
    }
    return streak;
  }

  window.Views._calcStreak = calcStreak;
})();
