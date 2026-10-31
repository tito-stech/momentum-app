/* ==========================================================================
   MOMENTUM - Settings view
   ========================================================================== */

(function () {
  if (!window.Views) window.Views = {};

  window.Views.settings = async function (root) {
    const theme = await DB.getSetting('theme', 'light');
    const userName = await DB.getSetting('userName', '');
    const currency = await DB.getSetting('currency', '€');
    const sleepTarget = await DB.getSetting('sleepTarget', 480);

    const header = U.el('div', { class: 'view-header' });
    header.appendChild(U.el('h2', { text: 'Paramètres' }));
    root.appendChild(header);

    // Profil
    const profileCard = U.el('div', { class: 'card' });
    profileCard.appendChild(Comp.section('Profil'));
    const nameField = Comp.field({ name: 'name', label: 'Ton prénom', value: userName, placeholder: 'Comment on t\'appelle ?' });
    const nameInput = nameField.querySelector('input');
    nameInput.onchange = async () => {
      await DB.setSetting('userName', nameInput.value);
      U.toast('Prénom enregistré', 'success');
    };
    profileCard.appendChild(nameField);
    root.appendChild(profileCard);

    // Thème
    const themeCard = U.el('div', { class: 'card' });
    themeCard.appendChild(Comp.section('Apparence'));
    const themeRow = U.el('div', { class: 'theme-opts' });
    ['light', 'dark', 'auto'].forEach(t => {
      const opt = U.el('div', { class: 'theme-opt' + (t === theme ? ' selected' : ''), onclick: async () => {
        await DB.setSetting('theme', t);
        await window.applyTheme();
        U.$$('.theme-opt', themeRow).forEach(x => x.classList.remove('selected'));
        opt.classList.add('selected');
        U.toast('Thème modifié', 'success');
      } });
      opt.innerHTML = `
        <div class="theme-preview ${t}"></div>
        <div class="font-medium" style="font-size:13px;">${t === 'light' ? 'Clair' : t === 'dark' ? 'Sombre' : 'Auto'}</div>
      `;
      themeRow.appendChild(opt);
    });
    themeCard.appendChild(themeRow);
    root.appendChild(themeCard);

    // Finance
    const financeCard = U.el('div', { class: 'card' });
    financeCard.appendChild(Comp.section('Finances'));
    const curField = Comp.field({ name: 'currency', label: 'Devise', type: 'select', value: currency, options: [
      { value: '€', label: '€ Euro' }, { value: '$', label: '$ Dollar' }, { value: '£', label: '£ Livre' }, { value: 'CHF', label: 'CHF' }
    ] });
    curField.querySelector('select').onchange = async (e) => {
      await DB.setSetting('currency', e.target.value);
      U.toast('Devise enregistrée', 'success');
    };
    financeCard.appendChild(curField);
    root.appendChild(financeCard);

    // Sleep
    const sleepCard = U.el('div', { class: 'card' });
    sleepCard.appendChild(Comp.section('Sommeil'));
    const sleepField = Comp.field({ name: 'sleep', label: 'Objectif de sommeil (heures)', type: 'number', value: sleepTarget / 60 });
    sleepField.querySelector('input').onchange = async (e) => {
      const v = Math.max(1, Number(e.target.value)) * 60;
      await DB.setSetting('sleepTarget', v);
      U.toast('Objectif enregistré', 'success');
    };
    sleepCard.appendChild(sleepField);
    root.appendChild(sleepCard);

    // Data
    const dataCard = U.el('div', { class: 'card' });
    dataCard.appendChild(Comp.section('Données'));

    // Counts
    const counts = {};
    for (const s of DB.STORES) counts[s] = await DB.count(s);
    const totalItems = Object.values(counts).reduce((a, b) => a + b, 0);
    dataCard.appendChild(U.el('div', { class: 'text-sm text-muted', text: `${totalItems} enregistrements répartis sur ${DB.STORES.length} tables, stockés localement dans ton navigateur.` }));

    const dataActions = U.el('div', { class: 'row mt-4' });
    dataActions.appendChild(U.el('button', { class: 'btn', text: '📤 Exporter mes données', onclick: async () => {
      const data = await DB.exportAll();
      const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `momentum-export-${U.iso(U.today())}.json`;
      a.click();
      URL.revokeObjectURL(url);
      U.toast('Export téléchargé', 'success');
    } }));

    const importBtn = U.el('button', { class: 'btn', text: '📥 Importer un fichier' });
    const fileInput = U.el('input', { type: 'file', accept: 'application/json', style: { display: 'none' } });
    importBtn.onclick = () => fileInput.click();
    fileInput.onchange = async () => {
      const file = fileInput.files[0];
      if (!file) return;
      try {
        const text = await file.text();
        const data = JSON.parse(text);
        const mode = await U.confirm('Fusionner avec tes données actuelles (OK) ou TOUT remplacer (Annuler) ?', { confirmText: 'Fusionner', cancelText: 'Remplacer' });
        await DB.importAll(data, { replace: !mode });
        U.toast('Import réussi', 'success');
        Router.render();
      } catch (err) {
        U.toast('Erreur import: ' + err.message, 'error');
      }
    };
    dataActions.appendChild(importBtn);
    dataActions.appendChild(fileInput);
    dataCard.appendChild(dataActions);
    root.appendChild(dataCard);

    // Danger
    const dangerCard = U.el('div', { class: 'danger-zone' });
    dangerCard.appendChild(U.el('h4', { text: 'Zone sensible' }));
    dangerCard.appendChild(U.el('div', { class: 'text-sm text-muted', style: { marginBottom: '12px' }, text: 'Ces actions sont irréversibles. Fais un export avant.' }));
    dangerCard.appendChild(U.el('button', { class: 'btn btn-danger', text: '🗑 Effacer toutes mes données', onclick: async () => {
      if (await U.confirm('Supprimer TOUTES les données (habitudes, journal, finances, etc.) ? Cette action est irréversible.', { danger: true, confirmText: 'Tout effacer' })) {
        await DB.clearAll();
        await DB.setSetting('seeded', false);
        U.toast('Toutes les données ont été effacées');
        setTimeout(() => location.reload(), 800);
      }
    } }));
    root.appendChild(dangerCard);

    // About
    const aboutCard = U.el('div', { class: 'card' });
    aboutCard.appendChild(Comp.section('À propos'));
    aboutCard.appendChild(U.el('div', { class: 'text-sm text-muted', style: { lineHeight: '1.7' }, html: `
      <strong>Momentum</strong> est une app de développement personnel 100% locale.<br>
      Toutes tes données sont stockées dans ton navigateur, aucune API, aucun serveur, zéro traçage.<br><br>
      Pour un backup, exporte régulièrement tes données en JSON et conserve le fichier.<br><br>
      <span class="text-dim">v1.0 · PWA installable</span>
    ` }));
    root.appendChild(aboutCard);
  };
})();
