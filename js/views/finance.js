/* ==========================================================================
   MOMENTUM - Finance view
   ========================================================================== */

(function () {
  if (!window.Views) window.Views = {};

  const CATS = [
    { v: 'alimentation', emoji: '🍕', color: '#ef4444' },
    { v: 'transport', emoji: '🚗', color: '#f59e0b' },
    { v: 'logement', emoji: '🏠', color: '#06b6d4' },
    { v: 'loisirs', emoji: '🎮', color: '#a855f7' },
    { v: 'santé', emoji: '🏥', color: '#10b981' },
    { v: 'études', emoji: '📚', color: '#0ea5e9' },
    { v: 'abonnements', emoji: '📱', color: '#ec4899' },
    { v: 'épargne', emoji: '💰', color: '#22c55e' },
    { v: 'salaire', emoji: '💵', color: '#22c55e' },
    { v: 'cadeau', emoji: '🎁', color: '#8b5cf6' },
    { v: 'autre', emoji: '📦', color: '#6b7280' }
  ];

  window.Views.finance = async function (root) {
    const tx = await DB.getAll('transactions');
    const currency = await DB.getSetting('currency', '€');

    const header = U.el('div', { class: 'view-header' });
    header.appendChild(U.el('h2', { text: 'Finances' }));
    header.appendChild(U.el('div', { class: 'spacer' }));
    header.appendChild(U.el('button', { class: 'btn btn-primary', text: '+ Transaction', onclick: () => openForm() }));
    root.appendChild(header);

    // Period selector
    let period = 'month';
    const segs = Comp.segmented({
      options: [
        { value: 'week', label: 'Semaine' },
        { value: 'month', label: 'Mois' },
        { value: 'year', label: 'Année' },
        { value: 'all', label: 'Tout' }
      ],
      value: period,
      onChange: (v) => { period = v; render(); }
    });
    root.appendChild(segs);

    const content = U.el('div');
    root.appendChild(content);

    render();

    function render() {
      content.innerHTML = '';

      let since;
      if (period === 'week') since = U.iso(U.startOfWeek(new Date()));
      else if (period === 'month') since = U.iso(U.startOfMonth(new Date()));
      else if (period === 'year') since = U.iso(new Date(new Date().getFullYear(), 0, 1));
      else since = '0000-00-00';

      const filtered = tx.filter(t => t.date >= since);
      const income = U.sum(filtered.filter(t => t.type === 'income').map(t => t.amount));
      const expense = U.sum(filtered.filter(t => t.type === 'expense').map(t => t.amount));
      const balance = income - expense;
      const savingsRate = income > 0 ? Math.round(balance / income * 100) : 0;

      // Stats
      const stats = U.el('div', { class: 'grid grid-auto-sm' });
      stats.appendChild(Comp.statCard({ label: 'Revenus', value: U.fmtNum(income, 0), unit: currency, deltaDir: 'up' }));
      stats.appendChild(Comp.statCard({ label: 'Dépenses', value: U.fmtNum(expense, 0), unit: currency, deltaDir: 'down' }));
      stats.appendChild(Comp.statCard({ label: 'Solde', value: U.fmtNum(balance, 0), unit: currency, deltaDir: balance >= 0 ? 'up' : 'down' }));
      stats.appendChild(Comp.statCard({ label: 'Taux épargne', value: savingsRate, unit: '%' }));
      content.appendChild(stats);

      // Donut dépenses par catégorie
      const expenseTx = filtered.filter(t => t.type === 'expense');
      if (expenseTx.length) {
        const byCat = {};
        expenseTx.forEach(t => { byCat[t.category || 'autre'] = (byCat[t.category || 'autre'] || 0) + t.amount; });
        const sorted = Object.entries(byCat).sort((a, b) => b[1] - a[1]);
        const labels = sorted.map(([k]) => k);
        const vals = sorted.map(([, v]) => v);
        const colors = labels.map(k => CATS.find(c => c.v === k)?.color || '#6b7280');

        const twoCol = U.el('div', { class: 'grid grid-2' });

        const donutCard = U.el('div', { class: 'chart-container' });
        donutCard.appendChild(U.el('h3', { text: 'Dépenses par catégorie' }));
        const donutWrap = U.el('div', { style: { display: 'flex', justifyContent: 'center' } });
        donutWrap.appendChild(Charts.donut({ data: vals, colors, labels, size: 200, centerText: U.fmtNum(expense, 0), centerLabel: currency }));
        donutCard.appendChild(donutWrap);
        const legend = U.el('div', { class: 'legend' });
        labels.forEach((l, i) => {
          const item = U.el('div', { class: 'legend-item' });
          item.innerHTML = `<span class="legend-dot" style="background:${colors[i]};"></span>${l} <span class="text-muted">(${U.fmtNum(vals[i], 0)}${currency})</span>`;
          legend.appendChild(item);
        });
        donutCard.appendChild(legend);
        twoCol.appendChild(donutCard);

        // hBarList
        const breakdown = U.el('div', { class: 'chart-container' });
        breakdown.appendChild(U.el('h3', { text: 'Détail' }));
        breakdown.appendChild(Charts.hBarList({
          items: sorted.map(([k, v], i) => ({
            label: (CATS.find(c => c.v === k)?.emoji || '') + ' ' + k,
            value: v,
            display: U.fmtMoney(v, currency),
            color: colors[i]
          })),
          max: Math.max(...vals)
        }));
        twoCol.appendChild(breakdown);

        content.appendChild(twoCol);
      }

      // Line chart monthly evolution (always on all data)
      const months = {};
      tx.forEach(t => {
        const m = t.date.slice(0, 7);
        if (!months[m]) months[m] = { income: 0, expense: 0 };
        if (t.type === 'income') months[m].income += t.amount;
        else months[m].expense += t.amount;
      });
      const sortedMonths = Object.keys(months).sort().slice(-12);
      if (sortedMonths.length) {
        const chart = U.el('div', { class: 'chart-container' });
        chart.appendChild(U.el('h3', { text: 'Évolution (12 derniers mois)' }));
        chart.appendChild(Charts.stackedBar({
          data: sortedMonths.map(m => [months[m].income, -months[m].expense].map(Math.abs)),
          labels: sortedMonths.map(m => m.slice(5)),
          colors: ['#22c55e', '#ef4444'],
          height: 180,
          yFormat: v => U.fmtNum(v, 0)
        }));
        const legend = U.el('div', { class: 'legend' });
        legend.innerHTML = `
          <div class="legend-item"><span class="legend-dot" style="background:#22c55e;"></span>Revenus</div>
          <div class="legend-item"><span class="legend-dot" style="background:#ef4444;"></span>Dépenses</div>
        `;
        chart.appendChild(legend);
        content.appendChild(chart);
      }

      // Transactions list
      const listCard = U.el('div', { class: 'card' });
      listCard.appendChild(Comp.section(`Transactions (${filtered.length})`));
      if (filtered.length === 0) {
        listCard.appendChild(Comp.emptyState({ title: 'Pas de transaction', text: 'Enregistre tes revenus et dépenses pour avoir un vrai suivi.' }));
      } else {
        const sorted = U.sortBy(filtered, t => t.date, true);
        sorted.forEach(t => {
          const cat = CATS.find(c => c.v === t.category);
          const row = U.el('div', { class: 'tx-item' });
          row.innerHTML = `
            <div class="tx-icon" style="background:${cat?.color || '#6b7280'}22;">${cat?.emoji || '•'}</div>
            <div class="tx-main">
              <div class="tx-label">${U.escapeHtml(t.label || 'Sans libellé')}</div>
              <div class="tx-cat">${t.category || 'autre'} · ${U.fmtDate(t.date)}</div>
            </div>
            <div class="tx-amount ${t.type === 'income' ? 'money pos' : 'money neg'}">${t.type === 'income' ? '+' : '−'} ${U.fmtMoney(t.amount, currency).replace('-', '')}</div>
          `;
          row.onclick = () => openForm(t);
          row.style.cursor = 'pointer';
          listCard.appendChild(row);
        });
      }
      content.appendChild(listCard);
    }

    function openForm(existing) {
      Comp.formModal({
        title: existing ? 'Modifier la transaction' : 'Nouvelle transaction',
        fields: [
          { name: 'type', label: 'Type', type: 'select', options: [
            { value: 'expense', label: '💸 Dépense' }, { value: 'income', label: '💰 Revenu' }
          ] },
          { name: 'amount', label: 'Montant (' + currency + ')', type: 'number', required: true, placeholder: '0.00' },
          { name: 'category', label: 'Catégorie', type: 'select', options: CATS.map(c => ({ value: c.v, label: c.emoji + ' ' + c.v })) },
          { name: 'label', label: 'Libellé', placeholder: 'Course du week-end...' },
          { name: 'date', label: 'Date', type: 'date', value: U.iso(U.today()), required: true }
        ],
        values: existing || { type: 'expense', category: 'alimentation', date: U.iso(U.today()) },
        extraContent: existing ? U.el('button', { type: 'button', class: 'btn btn-danger', text: 'Supprimer', onclick: async () => {
          if (await U.confirm('Supprimer cette transaction ?', { danger: true })) {
            await DB.del('transactions', existing.id);
            U.toast('Supprimée');
            Router.render();
          }
        } }) : null,
        onSubmit: async (v) => {
          const obj = existing ? { ...existing, ...v } : v;
          obj.amount = Math.abs(Number(v.amount));
          await DB.put('transactions', obj);
          U.toast(existing ? 'Modifiée' : 'Transaction ajoutée', 'success');
          Router.render();
        }
      });
    }
  };
})();
