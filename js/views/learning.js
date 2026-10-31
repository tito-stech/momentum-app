/* ==========================================================================
   MOMENTUM - Learning view (books, skills, Pomodoro)
   ========================================================================== */

(function () {
  if (!window.Views) window.Views = {};

  // Pomodoro state (persist across view re-renders)
  const Pomo = window._pomo = window._pomo || {
    running: false, type: 'focus', remaining: 25 * 60 * 1000, duration: 25 * 60 * 1000,
    startTime: null, timerId: null, project: '', completedToday: 0
  };

  window.Views.learning = async function (root) {

    const [books, skills, pomos] = await Promise.all([
      DB.getAll('books'), DB.getAll('skills'), DB.getAll('pomodoroSessions')
    ]);

    const header = U.el('div', { class: 'view-header' });
    header.appendChild(U.el('h2', { text: 'Apprentissage' }));
    root.appendChild(header);

    let tab = 'pomodoro';
    const tabs = U.el('div', { class: 'tabs' });
    [['pomodoro', 'Focus'], ['books', 'Livres'], ['skills', 'Compétences']].forEach(([t, label]) => {
      tabs.appendChild(U.el('a', { class: 'tab-link' + (t === tab ? ' active' : ''), text: label, onclick: () => { tab = t; render(); } }));
    });
    root.appendChild(tabs);

    const content = U.el('div');
    root.appendChild(content);
    render();

    function render() {
      content.innerHTML = '';
      U.$$('.tab-link', tabs).forEach((l, i) => l.classList.toggle('active', ['pomodoro', 'books', 'skills'][i] === tab));
      if (tab === 'pomodoro') renderPomodoro();
      else if (tab === 'books') renderBooks();
      else renderSkills();
    }

    // ---- POMODORO ----
    function renderPomodoro() {
      const today = U.iso(U.today());
      const todayPomos = pomos.filter(p => p.date === today && p.type === 'focus');
      const todayFocusMin = U.sum(todayPomos.map(p => p.duration / 60));
      const totalPomos = pomos.filter(p => p.type === 'focus').length;

      const stats = U.el('div', { class: 'grid grid-auto-sm' });
      stats.appendChild(Comp.statCard({ label: 'Aujourd\'hui', value: todayPomos.length, unit: 'pomos' }));
      stats.appendChild(Comp.statCard({ label: 'Focus du jour', value: Math.round(todayFocusMin), unit: 'min' }));
      stats.appendChild(Comp.statCard({ label: 'Total', value: totalPomos }));
      content.appendChild(stats);

      // Timer card
      const timer = U.el('div', { class: 'pomodoro' + (Pomo.running ? ' running' : '') });
      const typeLabel = Pomo.type === 'focus' ? 'Focus' : Pomo.type === 'short' ? 'Pause courte' : 'Pause longue';
      timer.innerHTML = `
        <div class="pomo-label">${typeLabel}</div>
        <div class="pomo-time" id="pomo-time">${U.fmtTime(Pomo.remaining)}</div>
        <div class="row" style="justify-content:center;gap:8px;">
          <button class="segment ${Pomo.type === 'focus' ? 'active' : ''}" data-type="focus">25 min</button>
          <button class="segment ${Pomo.type === 'short' ? 'active' : ''}" data-type="short">5 min</button>
          <button class="segment ${Pomo.type === 'long' ? 'active' : ''}" data-type="long">15 min</button>
        </div>
        <div class="field mt-4" style="max-width:300px;margin:16px auto;">
          <input class="input" placeholder="Projet / sujet (optionnel)" value="${U.escapeHtml(Pomo.project || '')}" id="pomo-project">
        </div>
        <div class="pomo-actions">
          ${Pomo.running
            ? '<button class="btn btn-lg" id="pomo-pause">⏸ Pause</button>'
            : '<button class="btn btn-primary btn-lg" id="pomo-start">▶ Démarrer</button>'}
          <button class="btn btn-lg" id="pomo-reset">⟲ Réinitialiser</button>
        </div>
      `;
      content.appendChild(timer);

      // Type buttons
      U.$$('.segment[data-type]', timer).forEach(b => b.onclick = () => {
        if (Pomo.running) return;
        Pomo.type = b.dataset.type;
        Pomo.duration = (b.dataset.type === 'focus' ? 25 : b.dataset.type === 'short' ? 5 : 15) * 60 * 1000;
        Pomo.remaining = Pomo.duration;
        renderPomodoro();
      });

      U.$('#pomo-start', timer)?.addEventListener('click', () => {
        Pomo.running = true;
        Pomo.startTime = Date.now() - (Pomo.duration - Pomo.remaining);
        Pomo.project = U.$('#pomo-project', timer).value;
        tick();
        renderPomodoro();
      });
      U.$('#pomo-pause', timer)?.addEventListener('click', () => {
        Pomo.running = false;
        Pomo.remaining = Math.max(0, Pomo.duration - (Date.now() - Pomo.startTime));
        clearInterval(Pomo.timerId);
        renderPomodoro();
      });
      U.$('#pomo-reset', timer)?.addEventListener('click', () => {
        Pomo.running = false;
        clearInterval(Pomo.timerId);
        Pomo.remaining = Pomo.duration;
        renderPomodoro();
      });

      // Projects breakdown
      if (pomos.length) {
        const byProject = {};
        pomos.filter(p => p.type === 'focus' && p.project).forEach(p => {
          byProject[p.project] = (byProject[p.project] || 0) + p.duration;
        });
        const items = Object.entries(byProject).sort((a, b) => b[1] - a[1]).slice(0, 8);
        if (items.length) {
          const card = U.el('div', { class: 'card' });
          card.appendChild(Comp.section('Temps par projet'));
          card.appendChild(Charts.hBarList({
            items: items.map(([p, s]) => ({ label: p, value: s, display: Math.round(s / 60000) + ' min' })),
            color: '#0ea5e9'
          }));
          content.appendChild(card);
        }
      }

      // Focus 14d chart
      if (pomos.length > 1) {
        const vals = [], labels = [];
        for (let i = 13; i >= 0; i--) {
          const d = U.addDays(U.today(), -i);
          const iso = U.iso(d);
          const dayPomos = pomos.filter(p => p.date === iso && p.type === 'focus');
          vals.push(Math.round(U.sum(dayPomos.map(p => p.duration / 60000))));
          labels.push(d.getDate() + '/' + (d.getMonth() + 1));
        }
        const chart = U.el('div', { class: 'chart-container' });
        chart.appendChild(U.el('h3', { text: 'Focus (14 jours, en minutes)' }));
        chart.appendChild(Charts.bar({ data: vals, labels, color: '#0ea5e9' }));
        content.appendChild(chart);
      }

      function tick() {
        clearInterval(Pomo.timerId);
        Pomo.timerId = setInterval(() => {
          if (!Pomo.running) return;
          const rem = Math.max(0, Pomo.duration - (Date.now() - Pomo.startTime));
          Pomo.remaining = rem;
          const timeEl = U.$('#pomo-time');
          if (timeEl) timeEl.textContent = U.fmtTime(rem);
          if (rem <= 0) finish();
        }, 500);
      }

      async function finish() {
        clearInterval(Pomo.timerId);
        Pomo.running = false;
        await DB.put('pomodoroSessions', {
          type: Pomo.type,
          duration: Pomo.duration / 1000,
          project: Pomo.project,
          date: U.iso(U.today()),
          finishedAt: Date.now()
        });
        beep();
        U.toast(`${Pomo.type === 'focus' ? 'Focus' : 'Pause'} terminé !`, 'success');
        Pomo.remaining = Pomo.duration;
        if (location.hash.includes('learning')) Router.render();
      }
    }

    // Beep via Web Audio (no file needed)
    function beep() {
      try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        const o = ctx.createOscillator();
        const g = ctx.createGain();
        o.connect(g); g.connect(ctx.destination);
        o.frequency.value = 880; o.type = 'sine';
        g.gain.setValueAtTime(0.2, ctx.currentTime);
        g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.8);
        o.start(); o.stop(ctx.currentTime + 0.8);
      } catch {}
    }

    // ---- BOOKS ----
    function renderBooks() {
      const reading = books.filter(b => b.status === 'reading');
      const read = books.filter(b => b.status === 'read');
      const wishlist = books.filter(b => b.status === 'wishlist');

      const stats = U.el('div', { class: 'grid grid-auto-sm' });
      stats.appendChild(Comp.statCard({ label: 'En cours', value: reading.length }));
      stats.appendChild(Comp.statCard({ label: 'Terminés', value: read.length }));
      stats.appendChild(Comp.statCard({ label: 'À lire', value: wishlist.length }));
      stats.appendChild(Comp.statCard({ label: 'Pages lues (année)', value: U.sum(read.filter(b => b.finishedAt && new Date(b.finishedAt).getFullYear() === new Date().getFullYear()).map(b => b.pages || 0)) }));
      content.appendChild(stats);

      content.appendChild(U.el('button', { class: 'btn btn-primary full', text: '+ Nouveau livre', onclick: () => openBookForm() }));

      [['En cours', reading], ['À lire', wishlist], ['Terminés', read]].forEach(([title, list]) => {
        if (!list.length) return;
        const card = U.el('div', { class: 'card' });
        card.appendChild(Comp.section(title + ` (${list.length})`));
        list.forEach(b => {
          const pct = b.pages ? Math.round((b.currentPage || 0) / b.pages * 100) : 0;
          const row = U.el('div', { class: 'book-card', style: { cursor: 'pointer' }, onclick: () => openBookForm(b) });
          row.innerHTML = `
            <div class="book-cover">${b.emoji || '📖'}</div>
            <div class="book-info">
              <div class="book-title">${U.escapeHtml(b.title)}</div>
              <div class="book-author">${U.escapeHtml(b.author || '')}</div>
              ${b.pages ? `<div class="mt-4" style="font-size:12px;color:var(--text-2);margin-bottom:4px;">${b.currentPage || 0} / ${b.pages} pages · ${pct}%</div><div class="progress thin"><div class="progress-bar" style="width:${pct}%"></div></div>` : ''}
            </div>
          `;
          card.appendChild(row);
        });
        content.appendChild(card);
      });

      if (!books.length) {
        content.appendChild(Comp.emptyState({ title: 'Pas de livre', text: 'Ajoute un livre pour commencer ta bibliothèque.' }));
      }
    }

    function openBookForm(existing) {
      Comp.formModal({
        title: existing ? 'Modifier livre' : 'Nouveau livre',
        fields: [
          { name: 'title', label: 'Titre', required: true },
          { name: 'author', label: 'Auteur' },
          { name: 'emoji', label: 'Emoji', value: '📖' },
          { name: 'pages', label: 'Nombre de pages', type: 'number' },
          { name: 'currentPage', label: 'Page actuelle', type: 'number' },
          { name: 'status', label: 'Statut', type: 'select', options: [
            { value: 'wishlist', label: '📌 À lire' }, { value: 'reading', label: '📖 En cours' }, { value: 'read', label: '✅ Terminé' }
          ] },
          { name: 'rating', label: 'Note /5', type: 'number' },
          { name: 'notes', label: 'Notes', type: 'textarea', rows: 3 }
        ],
        values: existing || { status: 'reading', emoji: '📖' },
        extraContent: existing ? U.el('button', { type: 'button', class: 'btn btn-danger', text: 'Supprimer', onclick: async () => {
          if (await U.confirm('Supprimer ce livre ?', { danger: true })) {
            await DB.del('books', existing.id);
            Router.render();
          }
        } }) : null,
        onSubmit: async (v) => {
          const obj = existing ? { ...existing, ...v } : v;
          if (v.status === 'read' && !existing?.finishedAt) obj.finishedAt = Date.now();
          await DB.put('books', obj);
          U.toast('Enregistré', 'success');
          Router.render();
        }
      });
    }

    // ---- SKILLS ----
    function renderSkills() {
      const stats = U.el('div', { class: 'grid grid-auto-sm' });
      const avgLevel = skills.length ? U.avg(skills.map(s => s.level || 0)).toFixed(1) : '-';
      stats.appendChild(Comp.statCard({ label: 'Compétences', value: skills.length }));
      stats.appendChild(Comp.statCard({ label: 'Niveau moyen', value: avgLevel, unit: '/5' }));
      content.appendChild(stats);

      content.appendChild(U.el('button', { class: 'btn btn-primary full', text: '+ Nouvelle compétence', onclick: () => openSkillForm() }));

      if (!skills.length) {
        content.appendChild(Comp.emptyState({ title: 'Pas de compétence', text: 'Suis tes progrès sur les compétences que tu veux développer.' }));
        return;
      }

      const card = U.el('div', { class: 'card' });
      U.sortBy(skills, s => s.level || 0, true).forEach(s => {
        const row = U.el('div', { class: 'skill-bar', style: { cursor: 'pointer' }, onclick: () => openSkillForm(s) });
        row.innerHTML = `
          <div class="skill-name">${U.escapeHtml(s.name)}</div>
          <div class="skill-level">
            ${[1, 2, 3, 4, 5].map(i => `<div class="skill-pip ${i <= (s.level || 0) ? 'on' : ''}"></div>`).join('')}
          </div>
          <div class="text-sm text-muted" style="width:40px;text-align:right;">${s.level || 0}/5</div>
        `;
        card.appendChild(row);
      });
      content.appendChild(card);
    }

    function openSkillForm(existing) {
      Comp.formModal({
        title: existing ? 'Modifier compétence' : 'Nouvelle compétence',
        fields: [
          { name: 'name', label: 'Compétence', required: true, placeholder: 'JavaScript, Guitare, Dessin...' },
          { name: 'level', label: 'Niveau (0-5)', type: 'number' },
          { name: 'notes', label: 'Notes / objectif', type: 'textarea', rows: 3 }
        ],
        values: existing || { level: 1 },
        extraContent: existing ? U.el('button', { type: 'button', class: 'btn btn-danger', text: 'Supprimer', onclick: async () => {
          if (await U.confirm('Supprimer cette compétence ?', { danger: true })) {
            await DB.del('skills', existing.id);
            Router.render();
          }
        } }) : null,
        onSubmit: async (v) => {
          const obj = existing ? { ...existing, ...v } : v;
          await DB.put('skills', obj);
          U.toast('Enregistré', 'success');
          Router.render();
        }
      });
    }
  };
})();
