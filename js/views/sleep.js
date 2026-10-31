/* ==========================================================================
   MOMENTUM - Sleep view
   ========================================================================== */

(function () {
  if (!window.Views) window.Views = {};

  window.Views.sleep = async function (root) {
    const logs = await DB.getAll('sleepLogs');
    const target = await DB.getSetting('sleepTarget', 480); // 8h in minutes
    const today = U.iso(U.today());

    const header = U.el('div', { class: 'view-header' });
    header.appendChild(U.el('h2', { text: 'Sommeil' }));
    header.appendChild(U.el('div', { class: 'spacer' }));
    header.appendChild(U.el('button', { class: 'btn btn-primary', text: '+ Enregistrer', onclick: () => openForm() }));
    root.appendChild(header);

    const sorted = U.sortBy(logs, l => l.date, true);
    const last7 = sorted.slice(0, 7);

    // Ring for last night
    const lastNight = sorted[0];
    if (lastNight) {
      const ringCard = U.el('div', { class: 'card text-center' });
      ringCard.appendChild(U.el('div', { class: 'card-title', text: 'Dernière nuit' }));
      const ringWrap = U.el('div', { style: { display: 'flex', justifyContent: 'center' } });
      const h = Math.floor(lastNight.duration / 60);
      const m = lastNight.duration % 60;
      ringWrap.appendChild(Charts.ring({
        value: lastNight.duration,
        max: target,
        size: 180,
        stroke: 14,
        color: '#6366f1',
        centerText: `${h}h${m > 0 ? m : ''}`,
        centerLabel: `objectif ${Math.floor(target / 60)}h`
      }));
      ringCard.appendChild(ringWrap);
      if (lastNight.quality) {
        const qRow = U.el('div', { style: { display: 'flex', justifyContent: 'center', marginTop: '12px' } });
        const dots = U.el('div', { class: 'quality-dots' });
        for (let i = 1; i <= 5; i++) dots.appendChild(U.el('div', { class: 'quality-dot' + (i <= lastNight.quality ? ' on' : '') }));
        qRow.appendChild(dots);
        ringCard.appendChild(qRow);
        ringCard.appendChild(U.el('div', { class: 'text-sm text-muted mt-4', text: `Qualité ${lastNight.quality}/5` }));
      }
      ringCard.appendChild(U.el('div', { class: 'text-sm text-muted', text: U.fmtDateLong(lastNight.date) }));
      root.appendChild(ringCard);
    }

    // Stats
    const avg7 = last7.length ? U.avg(last7.map(l => l.duration)) : 0;
    const avg30 = sorted.slice(0, 30).length ? U.avg(sorted.slice(0, 30).map(l => l.duration)) : 0;
    const qualAvg = last7.length ? U.avg(last7.filter(l => l.quality).map(l => l.quality)).toFixed(1) : '-';
    const debt = last7.reduce((acc, l) => acc + (target - l.duration), 0);

    const stats = U.el('div', { class: 'grid grid-auto-sm' });
    stats.appendChild(Comp.statCard({ label: 'Moy. 7 nuits', value: avg7 ? (avg7 / 60).toFixed(1) : '-', unit: 'h' }));
    stats.appendChild(Comp.statCard({ label: 'Moy. 30 nuits', value: avg30 ? (avg30 / 60).toFixed(1) : '-', unit: 'h' }));
    stats.appendChild(Comp.statCard({ label: 'Qualité moy.', value: qualAvg, unit: '/5' }));
    stats.appendChild(Comp.statCard({ label: 'Dette (7j)', value: debt > 0 ? '+' + Math.round(debt / 60 * 10) / 10 : Math.round(-debt / 60 * 10) / 10, unit: 'h', deltaDir: debt > 0 ? 'down' : 'up' }));
    root.appendChild(stats);

    // Chart 14 nights
    if (sorted.length > 1) {
      const vals = [], labels = [];
      for (let i = 13; i >= 0; i--) {
        const d = U.addDays(U.today(), -i);
        const iso = U.iso(d);
        const l = sorted.find(x => x.date === iso);
        vals.push(l ? l.duration / 60 : 0);
        labels.push(d.getDate() + '/' + (d.getMonth() + 1));
      }
      const chart = U.el('div', { class: 'chart-container' });
      chart.appendChild(U.el('h3', { text: 'Durée sommeil (14 nuits)' }));
      chart.appendChild(Charts.bar({ data: vals, labels, color: '#6366f1', yFormat: v => v.toFixed(1) + 'h' }));
      root.appendChild(chart);
    }

    // List
    const listCard = U.el('div', { class: 'card' });
    listCard.appendChild(Comp.section('Historique'));
    if (sorted.length === 0) {
      listCard.appendChild(Comp.emptyState({ title: 'Pas encore de nuit', text: 'Enregistre ta première nuit pour commencer le suivi.' }));
    } else {
      sorted.forEach(l => {
        const h = Math.floor(l.duration / 60);
        const m = l.duration % 60;
        const row = U.el('div', { class: 'measure-row', style: { cursor: 'pointer' }, onclick: () => openForm(l) });
        row.innerHTML = `
          <div>
            <div class="font-medium">${U.fmtDate(l.date)}</div>
            <div class="text-xs text-muted">${l.bedtime || ''}${l.wakeup ? ' → ' + l.wakeup : ''}</div>
          </div>
          <div class="text-right">
            <div class="font-semibold">${h}h${m > 0 ? String(m).padStart(2, '0') : ''}</div>
            <div class="text-xs text-muted">${l.quality ? '★'.repeat(l.quality) + '☆'.repeat(5 - l.quality) : ''}</div>
          </div>
        `;
        listCard.appendChild(row);
      });
    }
    root.appendChild(listCard);

    function openForm(existing) {
      const body = U.el('form', { class: 'col gap-4' });
      body.appendChild(Comp.field({ name: 'date', label: 'Date (nuit du)', type: 'date', value: existing?.date || U.iso(U.today()), required: true }));
      body.appendChild(Comp.field({ name: 'bedtime', label: 'Heure du coucher', type: 'time', value: existing?.bedtime || '23:00' }));
      body.appendChild(Comp.field({ name: 'wakeup', label: 'Heure du réveil', type: 'time', value: existing?.wakeup || '07:00' }));

      // Quality stars
      const qWrap = U.el('div', { class: 'field' });
      qWrap.appendChild(U.el('label', { text: 'Qualité' }));
      let qVal = existing?.quality || 3;
      const stars = U.el('div', { class: 'row' });
      for (let i = 1; i <= 5; i++) {
        const s = U.el('button', { type: 'button', class: 'icon-btn', style: { fontSize: '26px', color: i <= qVal ? '#f59e0b' : 'var(--text-3)' } });
        s.textContent = '★';
        s.onclick = () => {
          qVal = i;
          U.$$('button', stars).forEach((b, idx) => b.style.color = idx + 1 <= qVal ? '#f59e0b' : 'var(--text-3)');
        };
        stars.appendChild(s);
      }
      qWrap.appendChild(stars);
      body.appendChild(qWrap);

      body.appendChild(Comp.field({ name: 'notes', label: 'Notes', type: 'textarea', rows: 2, value: existing?.notes || '' }));

      const actions = U.el('div', { class: 'modal-actions' });
      if (existing) {
        actions.appendChild(U.el('button', { type: 'button', class: 'btn btn-danger', text: 'Supprimer', onclick: async () => {
          m.close();
          if (await U.confirm('Supprimer cette nuit ?', { danger: true })) {
            await DB.del('sleepLogs', existing.id);
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
        // compute duration from bedtime/wakeup
        const [bh, bm] = (v.bedtime || '23:00').split(':').map(Number);
        const [wh, wm] = (v.wakeup || '07:00').split(':').map(Number);
        let dur = (wh * 60 + wm) - (bh * 60 + bm);
        if (dur <= 0) dur += 24 * 60;
        const obj = existing ? { ...existing, ...v, duration: dur, quality: qVal } : { ...v, duration: dur, quality: qVal };
        await DB.put('sleepLogs', obj);
        U.toast('Nuit enregistrée', 'success');
        m.close();
        Router.render();
      };

      const m = U.modal({ title: existing ? 'Modifier nuit' : 'Nouvelle nuit', body });
    }
  };
})();
