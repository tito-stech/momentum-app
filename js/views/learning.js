/* ==========================================================================
   MOMENTUM - Learning view (books, skills, Pomodoro)
   ========================================================================== */

(function () {
  if (!window.Views) window.Views = {};

  const Pomo = window._pomo = window._pomo || {
    running: false, type: 'focus', remaining: 25 * 60 * 1000, duration: 25 * 60 * 1000,
    startTime: null, timerId: null, project: ''
  };

  function clearPomoTimer() {
    if (Pomo.timerId) { clearInterval(Pomo.timerId); Pomo.timerId = null; }
  }

  window.Views.learning = async function (root) {

    const [books, skills, pomos] = await Promise.all([
      DB.getAll('books'), DB.getAll('skills'), DB.getAll('pomodoroSessions')
    ]);

    const header = U.el('div', { class: 'view-header' });
    header.appendChild(U.el('h2', { text: 'Apprentissage' }));
    root.appendChild(header);

    let tab = 'pomodoro';
    const tabs = U.el('div', { class: 'tabs' });
    [['pomodoro', 'Focus'], ['books', 'Livres'], ['skills', 'Comp.']].forEach(([t, label]) => {
      tabs.appendChild(U.el('a', { class: 'tab-link' + (t === tab ? ' active' : ''), text: label, onclick: () => { tab = t; renderTab(); } }));
    });
    root.appendChild(tabs);

    const content = U.el('div');
    root.appendChild(content);
    renderTab();

    function renderTab() {
      content.innerHTML = '';
      U.$$('.tab-link', tabs).forEach((l, i) => l.classList.toggle('active', ['pomodoro', 'books', 'skills'][i] === tab));
      if (tab === 'pomodoro') renderPomodoroTab();
      else if (tab === 'books') renderBooks();
      else renderSkills();
    }

    // ---- POMODORO (built once, updated in-place) ----
    function renderPomodoroTab() {
      const today = U.iso(U.today());
      const todayPomos = pomos.filter(p => p.date === today && p.type === 'focus');
      const todayFocusMin = U.sum(todayPomos.map(p => p.duration / 60));

      const stats = U.el('div', { class: 'grid grid-auto-sm' });
      stats.appendChild(Comp.statCard({ label: 'Pomos jour', value: todayPomos.length }));
      stats.appendChild(Comp.statCard({ label: 'Focus jour', value: Math.round(todayFocusMin), unit: 'min' }));
      stats.appendChild(Comp.statCard({ label: 'Total', value: pomos.filter(p => p.type === 'focus').length }));
      content.appendChild(stats);

      // Timer card built ONCE
      const timer = U.el('div', { class: 'pomodoro' });
      timer.id = 'pomo-card';
      timer.innerHTML = `
        <div class="pomo-label" id="pomo-type-label">Focus</div>
        <div class="pomo-time" id="pomo-time">25:00</div>
        <div class="row" style="justify-content:center;gap:6px;flex-wrap:wrap;">
          <button type="button" class="segment" data-type="focus">25 min</button>
          <button type="button" class="segment" data-type="short">5 min</button>
          <button type="button" class="segment" data-type="long">15 min</button>
        </div>
        <div class="field" style="max-width:280px;margin:12px auto 0;">
          <input class="input" placeholder="Projet / sujet (optionnel)" id="pomo-project">
        </div>
        <div class="pomo-actions">
          <button type="button" class="btn btn-primary btn-lg" id="pomo-toggle">▶ Démarrer</button>
          <button type="button" class="btn btn-lg" id="pomo-reset">⟲ Reset</button>
        </div>
      `;
      content.appendChild(timer);

      const timeEl = U.$('#pomo-time', timer);
      const typeLabelEl = U.$('#pomo-type-label', timer);
      const projectInput = U.$('#pomo-project', timer);
      const toggleBtn = U.$('#pomo-toggle', timer);
      const resetBtn = U.$('#pomo-reset', timer);

      projectInput.value = Pomo.project || '';

      function syncUI() {
        timeEl.textContent = U.fmtTime(Pomo.remaining);
        typeLabelEl.textContent = Pomo.type === 'focus' ? 'Focus' : Pomo.type === 'short' ? 'Pause courte' : 'Pause longue';
        timer.classList.toggle('running', Pomo.running);
        toggleBtn.innerHTML = Pomo.running ? '⏸ Pause' : '▶ Démarrer';
        toggleBtn.classList.toggle('btn-primary', !Pomo.running);
        U.$$('.segment[data-type]', timer).forEach(b => b.classList.toggle('active', b.dataset.type === Pomo.type));
      }
      syncUI();

      U.$$('.segment[data-type]', timer).forEach(b => {
        b.onclick = () => {
          if (Pomo.running) return U.toast('Mets en pause avant de changer');
          Pomo.type = b.dataset.type;
          Pomo.duration = (b.dataset.type === 'focus' ? 25 : b.dataset.type === 'short' ? 5 : 15) * 60 * 1000;
          Pomo.remaining = Pomo.duration;
          syncUI();
        };
      });

      toggleBtn.onclick = () => {
        if (Pomo.running) {
          Pomo.running = false;
          Pomo.remaining = Math.max(0, Pomo.duration - (Date.now() - Pomo.startTime));
          clearPomoTimer();
        } else {
          Pomo.running = true;
          Pomo.startTime = Date.now() - (Pomo.duration - Pomo.remaining);
          Pomo.project = projectInput.value;
          startTick();
        }
        syncUI();
      };

      resetBtn.onclick = () => {
        Pomo.running = false;
        clearPomoTimer();
        Pomo.remaining = Pomo.duration;
        syncUI();
      };

      function startTick() {
        clearPomoTimer();
        Pomo.timerId = setInterval(() => {
          if (!Pomo.running) return;
          const rem = Math.max(0, Pomo.duration - (Date.now() - Pomo.startTime));
          Pomo.remaining = rem;
          const live = document.getElementById('pomo-time');
          if (live) live.textContent = U.fmtTime(rem);
          if (rem <= 0) finish();
        }, 500);
      }

      // Resume ticking if timer already running when we land here
      if (Pomo.running) startTick();

      async function finish() {
        clearPomoTimer();
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

      // Projects breakdown
      if (pomos.length) {
        const byProject = {};
        pomos.filter(p => p.type === 'focus' && p.project).forEach(p => {
          byProject[p.project] = (byProject[p.project] || 0) + p.duration;
        });
        const items = Object.entries(byProject).sort((a, b) => b[1] - a[1]).slice(0, 6);
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

      // Focus 14d chart (collapsible)
      if (pomos.length > 1) {
        const vals = [], labels = [];
        for (let i = 13; i >= 0; i--) {
          const d = U.addDays(U.today(), -i);
          const iso = U.iso(d);
          const dayPomos = pomos.filter(p => p.date === iso && p.type === 'focus');
          vals.push(Math.round(U.sum(dayPomos.map(p => p.duration / 60000))));
          labels.push(d.getDate() + '/' + (d.getMonth() + 1));
        }
        const acc = Comp.accordion({ title: 'Focus 14 jours (minutes)', open: false });
        acc.body.appendChild(Charts.bar({ data: vals, labels, color: '#0ea5e9' }));
        content.appendChild(acc.el);
      }
    }

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
      stats.appendChild(Comp.statCard({ label: 'Lus', value: read.length }));
      stats.appendChild(Comp.statCard({ label: 'À lire', value: wishlist.length }));
      content.appendChild(stats);

      content.appendChild(U.el('button', { class: 'btn btn-primary full', text: '+ Nouveau livre', onclick: () => openBookForm() }));

      [['En cours', reading], ['À lire', wishlist], ['Lus', read]].forEach(([title, list]) => {
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
      stats.appendChild(Comp.statCard({ label: 'Compétences', value: skills.length }));
      stats.appendChild(Comp.statCard({ label: 'Niveau moyen', value: skills.length ? U.avg(skills.map(s => s.level || 0)).toFixed(1) : '-', unit: '/5' }));
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
        title: existing ? 'Modifier' : 'Nouvelle compétence',
        fields: [
          { name: 'name', label: 'Compétence', required: true, placeholder: 'JS, Guitare, Dessin...' },
          { name: 'level', label: 'Niveau (0-5)', type: 'number' },
          { name: 'notes', label: 'Notes', type: 'textarea', rows: 3 }
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
