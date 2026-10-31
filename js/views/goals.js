/* ==========================================================================
   MOMENTUM - Goals / OKR view
   ========================================================================== */

(function () {
  if (!window.Views) window.Views = {};

  window.Views.goals = async function (root) {
    const goals = await DB.getAll('goals');

    const header = U.el('div', { class: 'view-header' });
    header.appendChild(U.el('h2', { text: 'Objectifs' }));
    header.appendChild(U.el('div', { class: 'spacer' }));
    header.appendChild(U.el('button', {
      class: 'btn btn-primary',
      html: '<svg viewBox="0 0 24 24" width="16" height="16"><path d="M12 5v14M5 12h14" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round"/></svg><span>Nouvel objectif</span>',
      onclick: () => openForm()
    }));
    root.appendChild(header);

    // Filter by status
    let filter = 'active';
    const filterRow = Comp.chips({
      items: [
        { value: 'active', label: 'En cours' },
        { value: 'done', label: 'Atteints' },
        { value: 'all', label: 'Tous' }
      ],
      selected: filter,
      onChange: (v) => { filter = v; render(); }
    });
    root.appendChild(filterRow);

    const container = U.el('div');
    root.appendChild(container);

    render();

    function render() {
      container.innerHTML = '';
      let filtered = goals;
      if (filter === 'active') filtered = goals.filter(g => !g.done);
      if (filter === 'done') filtered = goals.filter(g => g.done);

      if (filtered.length === 0) {
        container.appendChild(Comp.emptyState({
          title: 'Aucun objectif',
          text: 'Fixe-toi un cap. Un objectif se décompose en Key Results concrets et mesurables.',
          action: 'Nouvel objectif',
          onAction: openForm
        }));
        return;
      }

      // Overall stats
      const total = goals.length;
      const done = goals.filter(g => g.done).length;
      const inProg = goals.filter(g => !g.done).length;
      const avgKR = goals.length ? U.avg(goals.map(g => {
        const krs = g.keyResults || [];
        return krs.length ? krs.filter(k => k.done).length / krs.length * 100 : 0;
      })).toFixed(0) : 0;

      const stats = U.el('div', { class: 'grid grid-auto-sm' });
      stats.appendChild(Comp.statCard({ label: 'Total', value: total }));
      stats.appendChild(Comp.statCard({ label: 'Atteints', value: done }));
      stats.appendChild(Comp.statCard({ label: 'En cours', value: inProg }));
      stats.appendChild(Comp.statCard({ label: 'Progression moy.', value: avgKR, unit: '%' }));
      container.appendChild(stats);

      filtered.forEach(g => container.appendChild(goalCard(g)));
    }

    function goalCard(g) {
      const krs = g.keyResults || [];
      const krDone = krs.filter(k => k.done).length;
      const pct = krs.length ? krDone / krs.length * 100 : (g.done ? 100 : 0);
      const card = U.el('div', { class: 'goal-item' });

      const deadline = g.deadline ? U.fmtRelative(g.deadline) : null;
      const overdue = g.deadline && g.deadline < U.iso(U.today()) && !g.done;

      card.innerHTML = `
        <div class="goal-header">
          <div style="flex:1;">
            <div class="goal-title">${g.done ? '✓ ' : ''}${U.escapeHtml(g.title)}</div>
            ${g.description ? `<div class="goal-desc">${U.escapeHtml(g.description)}</div>` : ''}
            <div class="goal-meta">
              ${g.category ? `<span class="pill goal">${U.escapeHtml(g.category)}</span>` : ''}
              ${deadline ? `<span style="color:${overdue ? 'var(--danger)' : 'inherit'}">📅 ${deadline}</span>` : ''}
              <span>${krDone}/${krs.length} KR</span>
            </div>
          </div>
          <div style="display:flex;align-items:center;gap:12px;">
            <div style="font-size:22px;font-weight:700;color:var(--text-0);">${Math.round(pct)}%</div>
          </div>
        </div>
        <div class="progress"><div class="progress-bar" style="width:${pct}%"></div></div>
      `;

      if (krs.length) {
        const krList = U.el('div', { class: 'kr-list' });
        krs.forEach((k, idx) => {
          const row = U.el('div', { class: 'kr-item' });
          const checkbox = U.el('label', { class: 'check' });
          checkbox.innerHTML = `<input type="checkbox" ${k.done ? 'checked' : ''}><span class="check-box"></span>`;
          checkbox.querySelector('input').onchange = async (e) => {
            krs[idx].done = e.target.checked;
            await DB.put('goals', g);
            Router.render();
          };
          row.appendChild(checkbox);
          row.appendChild(U.el('div', { class: 'kr-text' + (k.done ? ' done' : ''), text: k.text }));
          krList.appendChild(row);
        });
        card.appendChild(krList);
      }

      const actions = U.el('div', { class: 'row', style: { marginTop: '12px' } });
      actions.appendChild(U.el('button', { class: 'btn btn-sm', text: g.done ? 'Rouvrir' : 'Marquer atteint', onclick: async () => {
        g.done = !g.done;
        g.completedAt = g.done ? Date.now() : null;
        await DB.put('goals', g);
        Router.render();
      } }));
      actions.appendChild(U.el('button', { class: 'btn btn-sm', text: 'Modifier', onclick: () => openForm(g) }));
      actions.appendChild(U.el('button', { class: 'btn btn-sm btn-danger', text: 'Supprimer', onclick: async () => {
        if (await U.confirm(`Supprimer l'objectif "${g.title}" ?`, { danger: true })) {
          await DB.del('goals', g.id);
          Router.render();
        }
      } }));
      card.appendChild(actions);

      return card;
    }

    function openForm(existing) {
      const krValues = (existing?.keyResults || []).map(k => k.text).join('\n');
      Comp.formModal({
        title: existing ? 'Modifier l\'objectif' : 'Nouvel objectif',
        fields: [
          { name: 'title', label: 'Objectif', required: true, placeholder: 'Décrocher mon Bac Pro' },
          { name: 'description', label: 'Description', type: 'textarea', rows: 2 },
          { name: 'category', label: 'Catégorie', type: 'select', options: [
            { value: '', label: '-' }, { value: 'Études', label: 'Études' }, { value: 'Carrière', label: 'Carrière' },
            { value: 'Santé', label: 'Santé' }, { value: 'Finance', label: 'Finance' }, { value: 'Perso', label: 'Perso' }
          ] },
          { name: 'deadline', label: 'Deadline', type: 'date' },
          { name: 'keyResults', label: 'Key Results (un par ligne)', type: 'textarea', rows: 4, placeholder: 'Avoir 14 de moyenne\nFaire 3 révisions par semaine' }
        ],
        values: existing ? { ...existing, keyResults: krValues } : {},
        submitText: existing ? 'Enregistrer' : 'Créer',
        onSubmit: async (v) => {
          const krs = (v.keyResults || '').split('\n').map(s => s.trim()).filter(Boolean).map((text, i) => {
            const prev = existing?.keyResults?.[i];
            return { text, done: prev?.done || false };
          });
          const obj = existing ? { ...existing, ...v, keyResults: krs } : { ...v, keyResults: krs, done: false };
          await DB.put('goals', obj);
          U.toast(existing ? 'Objectif modifié' : 'Objectif créé', 'success');
          Router.render();
        }
      });
    }
  };
})();
