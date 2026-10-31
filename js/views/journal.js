/* ==========================================================================
   MOMENTUM - Journal / mood view
   ========================================================================== */

(function () {
  if (!window.Views) window.Views = {};

  const MOODS = [
    { v: 1, emoji: '😔', label: 'Triste' },
    { v: 2, emoji: '😕', label: 'Moyen' },
    { v: 3, emoji: '😐', label: 'Neutre' },
    { v: 4, emoji: '🙂', label: 'Bien' },
    { v: 5, emoji: '😄', label: 'Super' }
  ];

  const COMMON_TAGS = ['famille', 'amis', 'travail', 'sport', 'lecture', 'solo', 'nature', 'créatif', 'fatigue', 'stressé', 'énergique', 'reconnaissant'];

  window.Views.journal = async function (root) {
    const entries = await DB.getAll('journal');
    const today = U.iso(U.today());

    const header = U.el('div', { class: 'view-header' });
    header.appendChild(U.el('h2', { text: 'Journal' }));
    header.appendChild(U.el('div', { class: 'spacer' }));
    header.appendChild(U.el('button', { class: 'btn btn-primary', text: 'Nouvelle entrée', onclick: () => openForm() }));
    root.appendChild(header);

    // Today's quick entry
    const todayEntry = entries.find(e => e.date === today);
    const quickCard = U.el('div', { class: 'card' });
    quickCard.innerHTML = `<div class="card-title">Humeur du jour</div>`;
    const moodRow = U.el('div', { class: 'mood-selector' });
    MOODS.forEach(m => {
      const btn = U.el('button', {
        class: 'mood-opt' + (todayEntry?.mood === m.v ? ' selected' : ''),
        onclick: async () => {
          const entry = todayEntry || { date: today, text: '', tags: [] };
          entry.mood = m.v;
          await DB.put('journal', entry);
          U.toast('Humeur enregistrée', 'success');
          Router.render();
        }
      });
      btn.innerHTML = `<div class="mood-emoji">${m.emoji}</div><div class="mood-label">${m.label}</div>`;
      moodRow.appendChild(btn);
    });
    quickCard.appendChild(moodRow);
    if (todayEntry?.text) {
      quickCard.appendChild(U.el('div', { class: 'journal-text mt-4', style: { padding: '12px', background: 'var(--bg-elev)', borderRadius: '10px' }, text: todayEntry.text }));
    }
    quickCard.appendChild(U.el('button', { class: 'btn mt-4', text: todayEntry?.text ? 'Modifier l\'entrée' : 'Écrire l\'entrée du jour', onclick: () => openForm(todayEntry) }));
    root.appendChild(quickCard);

    // Stats
    if (entries.length) {
      const stats = U.el('div', { class: 'grid grid-auto-sm' });
      const avg7 = U.avg(entries.slice(-7).map(e => e.mood || 3));
      const avg30 = U.avg(entries.slice(-30).map(e => e.mood || 3));
      const totalEntries = entries.length;
      const streak = calcJournalStreak(entries);

      stats.appendChild(Comp.statCard({ label: 'Humeur 7j', value: avg7.toFixed(1), unit: '/5' }));
      stats.appendChild(Comp.statCard({ label: 'Humeur 30j', value: avg30.toFixed(1), unit: '/5' }));
      stats.appendChild(Comp.statCard({ label: 'Entrées', value: totalEntries }));
      stats.appendChild(Comp.statCard({ label: 'Streak', value: streak, unit: 'j' }));
      root.appendChild(stats);

      // Mood chart
      const chart = U.el('div', { class: 'chart-container' });
      chart.appendChild(U.el('h3', { text: 'Humeur sur 30 jours' }));
      const vals = [], labels = [];
      for (let i = 29; i >= 0; i--) {
        const d = U.addDays(U.today(), -i);
        const iso = U.iso(d);
        const e = entries.find(x => x.date === iso);
        vals.push(e ? e.mood : 0);
        labels.push(d.getDate() + '/' + (d.getMonth() + 1));
      }
      chart.appendChild(Charts.line({ data: vals, labels, color: '#ec4899', yFormat: v => v.toFixed(0) }));
      root.appendChild(chart);

      // Top tags
      const tagCounts = {};
      entries.forEach(e => (e.tags || []).forEach(t => tagCounts[t] = (tagCounts[t] || 0) + 1));
      const tagEntries = Object.entries(tagCounts).sort((a, b) => b[1] - a[1]).slice(0, 8);
      if (tagEntries.length) {
        const tagsCard = U.el('div', { class: 'card' });
        tagsCard.appendChild(Comp.section('Tags fréquents'));
        tagsCard.appendChild(Charts.hBarList({
          items: tagEntries.map(([t, c]) => ({ label: t, value: c, display: c + 'x' })),
          color: '#ec4899'
        }));
        root.appendChild(tagsCard);
      }
    }

    // Entries list
    const listCard = U.el('div');
    listCard.appendChild(U.el('h3', { style: { margin: '20px 0 12px', fontSize: '16px', fontWeight: '600' }, text: 'Dernières entrées' }));
    if (entries.length === 0) {
      listCard.appendChild(Comp.emptyState({ title: 'Pas encore d\'entrée', text: 'Commence par noter ton humeur du jour.' }));
    } else {
      const sorted = U.sortBy(entries, e => e.date, true);
      sorted.forEach(e => {
        const mood = MOODS.find(m => m.v === e.mood);
        const entry = U.el('div', { class: 'journal-entry', onclick: () => openForm(e), style: { cursor: 'pointer' } });
        entry.innerHTML = `
          <div class="journal-date">
            <span style="font-size:20px;">${mood?.emoji || '•'}</span>
            <span>${U.fmtDateLong(e.date)}</span>
            <span class="spacer"></span>
            <span class="text-xs text-muted">${mood?.label || ''}</span>
          </div>
          ${e.text ? `<div class="journal-text">${U.escapeHtml(e.text)}</div>` : ''}
          ${e.gratitude ? `<div class="journal-text mt-4" style="color:var(--text-2);font-style:italic;">💜 ${U.escapeHtml(e.gratitude)}</div>` : ''}
          ${(e.tags || []).length ? `<div class="journal-tags">${e.tags.map(t => `<span class="chip">#${U.escapeHtml(t)}</span>`).join('')}</div>` : ''}
        `;
        listCard.appendChild(entry);
      });
    }
    root.appendChild(listCard);

    function openForm(existing) {
      const body = U.el('form', { class: 'col gap-4' });
      body.appendChild(Comp.field({ name: 'date', label: 'Date', type: 'date', value: existing?.date || today, required: true }));

      // Mood
      const moodWrap = U.el('div', { class: 'field' });
      moodWrap.appendChild(U.el('label', { text: 'Humeur' }));
      const moodRow = U.el('div', { class: 'mood-selector' });
      let selMood = existing?.mood || 3;
      MOODS.forEach(m => {
        const b = U.el('button', { type: 'button', class: 'mood-opt' + (m.v === selMood ? ' selected' : '') });
        b.innerHTML = `<div class="mood-emoji">${m.emoji}</div><div class="mood-label">${m.label}</div>`;
        b.onclick = () => {
          selMood = m.v;
          U.$$('.mood-opt', moodRow).forEach(x => x.classList.remove('selected'));
          b.classList.add('selected');
        };
        moodRow.appendChild(b);
      });
      moodWrap.appendChild(moodRow);
      body.appendChild(moodWrap);

      body.appendChild(Comp.field({ name: 'text', label: 'Note du jour', type: 'textarea', rows: 5, value: existing?.text || '', placeholder: 'Ce que tu veux noter...' }));
      body.appendChild(Comp.field({ name: 'gratitude', label: 'Gratitude', type: 'textarea', rows: 2, value: existing?.gratitude || '', placeholder: 'Pour quoi es-tu reconnaissant ?' }));

      // Tags
      const tagsWrap = U.el('div', { class: 'field' });
      tagsWrap.appendChild(U.el('label', { text: 'Tags' }));
      const selTags = new Set(existing?.tags || []);
      const tagsRow = U.el('div', { class: 'row' });
      COMMON_TAGS.forEach(t => {
        const c = U.el('button', {
          type: 'button',
          class: 'chip selectable' + (selTags.has(t) ? ' active' : ''),
          text: '#' + t,
          onclick: () => {
            if (selTags.has(t)) selTags.delete(t); else selTags.add(t);
            c.classList.toggle('active');
          }
        });
        tagsRow.appendChild(c);
      });
      tagsWrap.appendChild(tagsRow);
      body.appendChild(tagsWrap);

      // Actions
      const actions = U.el('div', { class: 'modal-actions' });
      if (existing) {
        actions.appendChild(U.el('button', { type: 'button', class: 'btn btn-danger', text: 'Supprimer', onclick: async () => {
          m.close();
          if (await U.confirm('Supprimer cette entrée ?', { danger: true })) {
            await DB.del('journal', existing.id);
            Router.render();
          }
        } }));
      }
      actions.appendChild(U.el('div', { class: 'spacer' }));
      actions.appendChild(U.el('button', { type: 'button', class: 'btn', text: 'Annuler', onclick: () => m.close() }));
      actions.appendChild(U.el('button', { type: 'submit', class: 'btn btn-primary', text: 'Enregistrer' }));
      body.appendChild(actions);

      body.onsubmit = async (e) => {
        e.preventDefault();
        const v = Comp.formValues(body);
        const obj = existing ? { ...existing, ...v, mood: selMood, tags: Array.from(selTags) } : { ...v, mood: selMood, tags: Array.from(selTags) };
        await DB.put('journal', obj);
        U.toast('Entrée enregistrée', 'success');
        m.close();
        Router.render();
      };

      const m = U.modal({ title: existing ? 'Modifier l\'entrée' : 'Nouvelle entrée', body });
    }
  };

  function calcJournalStreak(entries) {
    const dates = new Set(entries.map(e => e.date));
    let streak = 0, cursor = U.today();
    if (!dates.has(U.iso(cursor))) cursor = U.addDays(cursor, -1);
    while (dates.has(U.iso(cursor))) {
      streak++;
      cursor = U.addDays(cursor, -1);
    }
    return streak;
  }
})();
