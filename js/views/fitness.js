/* ==========================================================================
   MOMENTUM - Fitness view (workouts + body measures + nutrition)
   ========================================================================== */

(function () {
  if (!window.Views) window.Views = {};

  window.Views.fitness = async function (root) {

    const [workouts, measures, nutrition] = await Promise.all([
      DB.getAll('workouts'), DB.getAll('bodyMeasures'), DB.getAll('nutrition')
    ]);

    const header = U.el('div', { class: 'view-header' });
    header.appendChild(U.el('h2', { text: 'Fitness' }));
    header.appendChild(U.el('div', { class: 'spacer' }));
    root.appendChild(header);

    let tab = 'workouts';
    const tabs = U.el('div', { class: 'tabs' });
    ['workouts', 'measures', 'nutrition'].forEach(t => {
      const label = t === 'workouts' ? 'Entraînements' : t === 'measures' ? 'Mesures' : 'Nutrition';
      const link = U.el('a', { class: 'tab-link' + (t === tab ? ' active' : ''), text: label, onclick: () => { tab = t; render(); } });
      tabs.appendChild(link);
    });
    root.appendChild(tabs);

    const content = U.el('div');
    root.appendChild(content);
    render();

    function render() {
      content.innerHTML = '';
      U.$$('.tab-link', tabs).forEach((l, i) => {
        const t = ['workouts', 'measures', 'nutrition'][i];
        l.classList.toggle('active', t === tab);
      });

      if (tab === 'workouts') renderWorkouts();
      else if (tab === 'measures') renderMeasures();
      else renderNutrition();
    }

    function renderWorkouts() {
      const week = workouts.filter(w => w.date >= U.iso(U.startOfWeek(new Date())));
      const month = workouts.filter(w => w.date >= U.iso(U.startOfMonth(new Date())));
      const totalVolume = (w) => U.sum((w.exercises || []).flatMap(e => (e.sets || []).map(s => (s.reps || 0) * (s.weight || 0))));
      const weekVol = U.sum(week.map(totalVolume));

      const stats = U.el('div', { class: 'grid grid-auto-sm' });
      stats.appendChild(Comp.statCard({ label: 'Semaine', value: week.length, unit: 'séances' }));
      stats.appendChild(Comp.statCard({ label: 'Mois', value: month.length, unit: 'séances' }));
      stats.appendChild(Comp.statCard({ label: 'Volume semaine', value: U.fmtNum(weekVol, 0), unit: 'kg' }));
      stats.appendChild(Comp.statCard({ label: 'Total', value: workouts.length }));
      content.appendChild(stats);

      // Volume chart
      if (workouts.length) {
        const vals = [], labels = [];
        for (let i = 11; i >= 0; i--) {
          const d = U.addDays(U.today(), -i * 7);
          const start = U.iso(U.startOfWeek(d));
          const end = U.iso(U.addDays(U.startOfWeek(d), 7));
          const wk = workouts.filter(w => w.date >= start && w.date < end);
          vals.push(U.sum(wk.map(totalVolume)));
          labels.push('S' + Math.ceil(d.getDate() / 7) + ' ' + (d.getMonth() + 1));
        }
        const chart = U.el('div', { class: 'chart-container' });
        chart.appendChild(U.el('h3', { text: 'Volume hebdomadaire (12 semaines)' }));
        chart.appendChild(Charts.bar({ data: vals, labels, color: '#ef4444', yFormat: v => U.fmtNum(v, 0) }));
        content.appendChild(chart);
      }

      const addBtn = U.el('button', { class: 'btn btn-primary full', text: '+ Nouvelle séance', onclick: () => openWorkoutForm() });
      content.appendChild(addBtn);

      // List
      if (workouts.length === 0) {
        content.appendChild(Comp.emptyState({ title: 'Pas encore de séance', text: 'Ajoute ta première séance de muscu, cardio, étirements...' }));
      } else {
        const sorted = U.sortBy(workouts, w => w.date, true);
        sorted.forEach(w => content.appendChild(workoutCard(w)));
      }
    }

    function workoutCard(w) {
      const card = U.el('div', { class: 'workout-card' });
      const head = `
        <div class="workout-head">
          <div>
            <div class="workout-title">${U.escapeHtml(w.name || 'Séance')}</div>
            <div class="workout-date">${U.fmtDateLong(w.date)}${w.duration ? ' · ' + U.fmtDuration(w.duration) : ''}</div>
          </div>
          <div class="row">
            <button class="btn btn-sm" data-act="edit">Modifier</button>
            <button class="btn btn-sm btn-danger" data-act="del">×</button>
          </div>
        </div>
      `;
      card.innerHTML = head;
      card.querySelector('[data-act="edit"]').onclick = () => openWorkoutForm(w);
      card.querySelector('[data-act="del"]').onclick = async () => {
        if (await U.confirm('Supprimer cette séance ?', { danger: true })) {
          await DB.del('workouts', w.id);
          Router.render();
        }
      };

      (w.exercises || []).forEach(ex => {
        const exEl = U.el('div', { class: 'exercise' });
        const setsHTML = (ex.sets || []).map(s => `<span class="set-chip">${s.reps || 0} × ${s.weight || 0}kg</span>`).join('');
        exEl.innerHTML = `
          <div class="exercise-name">${U.escapeHtml(ex.name)}</div>
          <div class="sets">${setsHTML}</div>
        `;
        card.appendChild(exEl);
      });
      if (w.notes) {
        card.appendChild(U.el('div', { class: 'text-sm text-muted mt-4', text: '📝 ' + w.notes }));
      }
      return card;
    }

    function openWorkoutForm(existing) {
      const body = U.el('form', { class: 'col gap-4' });
      body.appendChild(Comp.field({ name: 'name', label: 'Nom', value: existing?.name || '', required: true, placeholder: 'Push, Pull, Cardio...' }));
      body.appendChild(Comp.field({ name: 'date', label: 'Date', type: 'date', value: existing?.date || U.iso(U.today()), required: true }));
      body.appendChild(Comp.field({ name: 'duration', label: 'Durée (min)', type: 'number', value: existing?.duration || '' }));

      // Exercises builder
      const exos = JSON.parse(JSON.stringify(existing?.exercises || []));
      const exosWrap = U.el('div', { class: 'col gap-4' });
      const label = U.el('label', { style: { fontSize: '12px', fontWeight: '600', textTransform: 'uppercase', letterSpacing: '0.04em', color: 'var(--text-2)' }, text: 'Exercices' });
      body.appendChild(label);

      function renderExos() {
        exosWrap.innerHTML = '';
        exos.forEach((ex, i) => {
          const ei = U.el('div', { class: 'exercise' });
          ei.innerHTML = `
            <div class="row">
              <input class="input" style="flex:1;" placeholder="Nom exercice" value="${U.escapeHtml(ex.name || '')}" data-ex="${i}" data-k="name">
              <button type="button" class="btn btn-sm btn-danger" data-del="${i}">×</button>
            </div>
            <div class="col gap-2 mt-4" data-sets="${i}"></div>
            <button type="button" class="btn btn-sm mt-4" data-addset="${i}">+ Série</button>
          `;
          const setsWrap = ei.querySelector(`[data-sets="${i}"]`);
          (ex.sets || []).forEach((s, si) => {
            const srow = U.el('div', { class: 'row' });
            srow.innerHTML = `
              <input class="input" type="number" placeholder="Reps" value="${s.reps || ''}" data-ex="${i}" data-set="${si}" data-k="reps" style="width:90px;">
              <input class="input" type="number" step="0.5" placeholder="Poids (kg)" value="${s.weight || ''}" data-ex="${i}" data-set="${si}" data-k="weight" style="width:120px;">
              <button type="button" class="icon-btn" data-delset="${i}" data-si="${si}">×</button>
            `;
            srow.querySelectorAll('input').forEach(inp => inp.oninput = (e) => {
              exos[i].sets[si][inp.dataset.k] = inp.value === '' ? null : Number(inp.value);
            });
            srow.querySelector('[data-delset]').onclick = () => { exos[i].sets.splice(si, 1); renderExos(); };
            setsWrap.appendChild(srow);
          });
          ei.querySelector(`[data-addset="${i}"]`).onclick = () => {
            exos[i].sets = exos[i].sets || [];
            exos[i].sets.push({ reps: null, weight: null });
            renderExos();
          };
          ei.querySelector(`[data-del="${i}"]`).onclick = () => { exos.splice(i, 1); renderExos(); };
          ei.querySelector(`[data-k="name"]`).oninput = (e) => { exos[i].name = e.target.value; };
          exosWrap.appendChild(ei);
        });
      }
      renderExos();
      body.appendChild(exosWrap);
      const addExBtn = U.el('button', { type: 'button', class: 'btn', text: '+ Exercice', onclick: () => { exos.push({ name: '', sets: [{ reps: null, weight: null }] }); renderExos(); } });
      body.appendChild(addExBtn);

      body.appendChild(Comp.field({ name: 'notes', label: 'Notes', type: 'textarea', rows: 2, value: existing?.notes || '' }));

      const actions = U.el('div', { class: 'modal-actions' });
      actions.appendChild(U.el('button', { type: 'button', class: 'btn', text: 'Annuler', onclick: () => m.close() }));
      actions.appendChild(U.el('button', { type: 'submit', class: 'btn btn-primary', text: 'Enregistrer' }));
      body.appendChild(actions);

      body.onsubmit = async (e) => {
        e.preventDefault();
        const v = Comp.formValues(body);
        const obj = existing ? { ...existing, ...v, exercises: exos } : { ...v, exercises: exos };
        await DB.put('workouts', obj);
        U.toast('Séance enregistrée', 'success');
        m.close();
        Router.render();
      };

      const m = U.modal({ title: existing ? 'Modifier séance' : 'Nouvelle séance', body });
    }

    function renderMeasures() {
      // Latest
      const sorted = U.sortBy(measures, m => m.date, true);
      const latest = sorted[0];
      const prev = sorted[1];

      if (latest) {
        const stats = U.el('div', { class: 'grid grid-auto-sm' });
        if (latest.weight != null) {
          const delta = prev?.weight != null ? (latest.weight - prev.weight).toFixed(1) : null;
          stats.appendChild(Comp.statCard({ label: 'Poids', value: latest.weight, unit: 'kg', delta: delta ? (delta > 0 ? '+' : '') + delta + 'kg' : null, deltaDir: delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat' }));
        }
        if (latest.bodyFat != null) stats.appendChild(Comp.statCard({ label: 'Masse grasse', value: latest.bodyFat, unit: '%' }));
        if (latest.chest != null) stats.appendChild(Comp.statCard({ label: 'Poitrine', value: latest.chest, unit: 'cm' }));
        if (latest.waist != null) stats.appendChild(Comp.statCard({ label: 'Taille', value: latest.waist, unit: 'cm' }));
        content.appendChild(stats);

        // Weight chart
        const weightData = sorted.filter(m => m.weight != null).slice(0, 30).reverse();
        if (weightData.length > 1) {
          const chart = U.el('div', { class: 'chart-container' });
          chart.appendChild(U.el('h3', { text: 'Évolution du poids' }));
          chart.appendChild(Charts.line({
            data: weightData.map(m => m.weight),
            labels: weightData.map(m => U.fmtDate(m.date)),
            color: '#ef4444',
            yFormat: v => v.toFixed(1)
          }));
          content.appendChild(chart);
        }
      }

      content.appendChild(U.el('button', { class: 'btn btn-primary full', text: '+ Nouvelle mesure', onclick: () => openMeasureForm() }));

      if (measures.length === 0) {
        content.appendChild(Comp.emptyState({ title: 'Pas de mesure', text: 'Ajoute ton poids, tour de taille, etc. pour suivre ton évolution.' }));
      } else {
        const card = U.el('div', { class: 'card' });
        card.appendChild(Comp.section('Historique'));
        sorted.forEach(m => {
          const row = U.el('div', { class: 'measure-row', style: { cursor: 'pointer' }, onclick: () => openMeasureForm(m) });
          row.innerHTML = `
            <span class="font-medium">${U.fmtDate(m.date)}</span>
            <span class="text-sm text-muted">
              ${m.weight != null ? m.weight + 'kg' : ''}
              ${m.bodyFat != null ? ' · ' + m.bodyFat + '%' : ''}
              ${m.chest != null ? ' · P ' + m.chest : ''}
              ${m.waist != null ? ' · T ' + m.waist : ''}
            </span>
          `;
          card.appendChild(row);
        });
        content.appendChild(card);
      }
    }

    function openMeasureForm(existing) {
      Comp.formModal({
        title: existing ? 'Modifier mesure' : 'Nouvelle mesure',
        fields: [
          { name: 'date', label: 'Date', type: 'date', value: existing?.date || U.iso(U.today()), required: true },
          { name: 'weight', label: 'Poids (kg)', type: 'number', value: existing?.weight || '' },
          { name: 'bodyFat', label: 'Masse grasse (%)', type: 'number', value: existing?.bodyFat || '' },
          { name: 'chest', label: 'Poitrine (cm)', type: 'number', value: existing?.chest || '' },
          { name: 'waist', label: 'Taille (cm)', type: 'number', value: existing?.waist || '' },
          { name: 'arm', label: 'Bras (cm)', type: 'number', value: existing?.arm || '' },
          { name: 'thigh', label: 'Cuisse (cm)', type: 'number', value: existing?.thigh || '' }
        ],
        extraContent: existing ? U.el('button', { type: 'button', class: 'btn btn-danger', text: 'Supprimer', onclick: async () => {
          if (await U.confirm('Supprimer cette mesure ?', { danger: true })) {
            await DB.del('bodyMeasures', existing.id);
            Router.render();
          }
        } }) : null,
        onSubmit: async (v) => {
          const obj = existing ? { ...existing, ...v } : v;
          await DB.put('bodyMeasures', obj);
          U.toast('Mesure enregistrée', 'success');
          Router.render();
        }
      });
    }

    function renderNutrition() {
      const today = U.iso(U.today());
      const todayN = nutrition.find(n => n.date === today);
      const targetCal = 2200;
      const targetP = 150, targetC = 250, targetF = 70;

      if (todayN) {
        const stats = U.el('div', { class: 'grid grid-auto-sm' });
        stats.appendChild(Comp.statCard({ label: 'Calories', value: todayN.calories || 0, unit: '/ ' + targetCal }));
        stats.appendChild(Comp.statCard({ label: 'Protéines', value: todayN.protein || 0, unit: 'g' }));
        stats.appendChild(Comp.statCard({ label: 'Glucides', value: todayN.carbs || 0, unit: 'g' }));
        stats.appendChild(Comp.statCard({ label: 'Lipides', value: todayN.fat || 0, unit: 'g' }));
        content.appendChild(stats);

        // Macros donut
        if (todayN.protein || todayN.carbs || todayN.fat) {
          const chart = U.el('div', { class: 'chart-container' });
          chart.appendChild(U.el('h3', { text: 'Répartition macros du jour' }));
          const totalKcal = (todayN.protein || 0) * 4 + (todayN.carbs || 0) * 4 + (todayN.fat || 0) * 9;
          const wrap = U.el('div', { style: { display: 'flex', justifyContent: 'center' } });
          wrap.appendChild(Charts.donut({
            data: [(todayN.protein || 0) * 4, (todayN.carbs || 0) * 4, (todayN.fat || 0) * 9],
            colors: ['#ef4444', '#f59e0b', '#8b5cf6'],
            labels: ['Protéines', 'Glucides', 'Lipides'],
            size: 200,
            centerText: Math.round(totalKcal),
            centerLabel: 'kcal'
          }));
          chart.appendChild(wrap);
          const legend = U.el('div', { class: 'legend' });
          legend.innerHTML = `
            <div class="legend-item"><span class="legend-dot" style="background:#ef4444;"></span>Protéines</div>
            <div class="legend-item"><span class="legend-dot" style="background:#f59e0b;"></span>Glucides</div>
            <div class="legend-item"><span class="legend-dot" style="background:#8b5cf6;"></span>Lipides</div>
          `;
          chart.appendChild(legend);
          content.appendChild(chart);
        }
      }

      content.appendChild(U.el('button', { class: 'btn btn-primary full', text: todayN ? 'Modifier aujourd\'hui' : 'Enregistrer aujourd\'hui', onclick: () => openNutriForm(todayN) }));

      // Last 14 days chart
      if (nutrition.length > 1) {
        const vals = [], labels = [];
        for (let i = 13; i >= 0; i--) {
          const d = U.addDays(U.today(), -i);
          const iso = U.iso(d);
          const n = nutrition.find(x => x.date === iso);
          vals.push(n?.calories || 0);
          labels.push(d.getDate() + '/' + (d.getMonth() + 1));
        }
        const chart = U.el('div', { class: 'chart-container' });
        chart.appendChild(U.el('h3', { text: 'Calories (14 jours)' }));
        chart.appendChild(Charts.bar({ data: vals, labels, color: '#ef4444' }));
        content.appendChild(chart);
      }
    }

    function openNutriForm(existing) {
      Comp.formModal({
        title: 'Nutrition',
        fields: [
          { name: 'date', label: 'Date', type: 'date', value: existing?.date || U.iso(U.today()), required: true },
          { name: 'calories', label: 'Calories', type: 'number', value: existing?.calories || '' },
          { name: 'protein', label: 'Protéines (g)', type: 'number', value: existing?.protein || '' },
          { name: 'carbs', label: 'Glucides (g)', type: 'number', value: existing?.carbs || '' },
          { name: 'fat', label: 'Lipides (g)', type: 'number', value: existing?.fat || '' },
          { name: 'water', label: 'Eau (L)', type: 'number', value: existing?.water || '' }
        ],
        onSubmit: async (v) => {
          const obj = existing ? { ...existing, ...v } : v;
          await DB.put('nutrition', obj);
          U.toast('Enregistré', 'success');
          Router.render();
        }
      });
    }
  };
})();
