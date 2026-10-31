/* ==========================================================================
   MOMENTUM - Tasks view
   ========================================================================== */

(function () {
  if (!window.Views) window.Views = {};

  window.Views.tasks = async function (root) {
    const tasks = await DB.getAll('tasks');
    const today = U.iso(U.today());

    const header = U.el('div', { class: 'view-header' });
    header.appendChild(U.el('h2', { text: 'Tâches' }));
    header.appendChild(U.el('div', { class: 'spacer' }));
    header.appendChild(U.el('button', { class: 'btn btn-primary', text: '+ Nouvelle', onclick: () => openForm() }));
    root.appendChild(header);

    // Stats
    const open = tasks.filter(t => !t.done);
    const done = tasks.filter(t => t.done);
    const overdue = open.filter(t => t.dueDate && t.dueDate < today);
    const dueToday = open.filter(t => t.dueDate === today);
    const doneWeek = done.filter(t => t.completedAt && (Date.now() - t.completedAt) < 7 * 86400000);

    const stats = U.el('div', { class: 'grid grid-auto-sm' });
    stats.appendChild(Comp.statCard({ label: 'Ouvertes', value: open.length }));
    stats.appendChild(Comp.statCard({ label: 'Dues aujourd\'hui', value: dueToday.length }));
    stats.appendChild(Comp.statCard({ label: 'En retard', value: overdue.length, deltaDir: overdue.length ? 'down' : 'flat' }));
    stats.appendChild(Comp.statCard({ label: 'Terminées (7j)', value: doneWeek.length, deltaDir: 'up' }));
    root.appendChild(stats);

    // Filters
    let filter = 'open';
    let search = '';
    const filterRow = U.el('div', { class: 'row' });
    const chips = Comp.chips({
      items: [
        { value: 'open', label: 'À faire' },
        { value: 'today', label: 'Aujourd\'hui' },
        { value: 'overdue', label: 'En retard' },
        { value: 'done', label: 'Terminées' },
        { value: 'all', label: 'Tout' }
      ],
      selected: filter,
      onChange: (v) => { filter = v; render(); }
    });
    filterRow.appendChild(chips);
    const searchInput = U.el('input', { class: 'input', placeholder: 'Rechercher...', style: { maxWidth: '200px' } });
    searchInput.oninput = U.debounce(e => { search = e.target.value.toLowerCase(); render(); }, 150);
    filterRow.appendChild(searchInput);
    root.appendChild(filterRow);

    const list = U.el('div', { class: 'col gap-2' });
    root.appendChild(list);

    render();

    function render() {
      list.innerHTML = '';
      let filtered = tasks;
      if (filter === 'open') filtered = open;
      else if (filter === 'today') filtered = dueToday;
      else if (filter === 'overdue') filtered = overdue;
      else if (filter === 'done') filtered = done;

      if (search) filtered = filtered.filter(t => (t.title || '').toLowerCase().includes(search));

      const sorted = U.sortBy(filtered, t => {
        if (t.done) return '9999' + (t.completedAt || 0);
        return (t.dueDate || '2999') + (10 - (t.priority || 4));
      });

      if (sorted.length === 0) {
        list.appendChild(Comp.emptyState({ title: 'Rien ici', text: 'Pas de tâche à afficher.' }));
        return;
      }

      sorted.forEach(t => {
        const overdue = t.dueDate && t.dueDate < today && !t.done;
        const item = U.el('div', { class: 'task-item' + (t.done ? ' done' : '') });
        item.innerHTML = `
          <div class="task-prio p${t.priority || 4}"></div>
          <label class="check">
            <input type="checkbox" ${t.done ? 'checked' : ''}>
            <span class="check-box"></span>
          </label>
          <div class="task-text">${U.escapeHtml(t.title)}</div>
          ${t.project ? `<span class="pill tsk">${U.escapeHtml(t.project)}</span>` : ''}
          ${t.dueDate ? `<span class="task-due ${overdue ? 'overdue' : ''}">${U.fmtRelative(t.dueDate)}</span>` : ''}
          <button class="icon-btn" data-act="edit"><svg viewBox="0 0 24 24" width="16" height="16"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 013 3L7 19l-4 1 1-4L16.5 3.5z" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg></button>
        `;
        item.querySelector('input').onchange = async (e) => {
          t.done = e.target.checked;
          t.completedAt = e.target.checked ? Date.now() : null;
          await DB.put('tasks', t);
          Router.render();
        };
        item.querySelector('[data-act="edit"]').onclick = () => openForm(t);
        list.appendChild(item);
      });
    }

    function openForm(existing) {
      Comp.formModal({
        title: existing ? 'Modifier tâche' : 'Nouvelle tâche',
        fields: [
          { name: 'title', label: 'Tâche', required: true, placeholder: 'Que dois-tu faire ?' },
          { name: 'priority', label: 'Priorité', type: 'select', options: [
            { value: '1', label: '🔴 P1 - Urgent' },
            { value: '2', label: '🟡 P2 - Important' },
            { value: '3', label: '🔵 P3 - Normal' },
            { value: '4', label: '⚪ P4 - Bas' }
          ] },
          { name: 'dueDate', label: 'Échéance', type: 'date' },
          { name: 'project', label: 'Projet / contexte', placeholder: 'Études, Perso...' },
          { name: 'notes', label: 'Notes', type: 'textarea', rows: 3 }
        ],
        values: existing || { priority: '3' },
        extraContent: existing ? U.el('button', { type: 'button', class: 'btn btn-danger', text: 'Supprimer', onclick: async () => {
          if (await U.confirm('Supprimer cette tâche ?', { danger: true })) {
            await DB.del('tasks', existing.id);
            Router.render();
          }
        } }) : null,
        onSubmit: async (v) => {
          v.priority = Number(v.priority);
          const obj = existing ? { ...existing, ...v } : { ...v, done: false };
          await DB.put('tasks', obj);
          U.toast('Enregistré', 'success');
          Router.render();
        }
      });
    }
  };
})();
