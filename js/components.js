/* ==========================================================================
   MOMENTUM - Reusable components (form builders, cards, etc)
   ========================================================================== */

const Comp = (() => {

  function statCard({ label, value, unit, delta, deltaDir, icon, color = 'var(--accent-1)' }) {
    const card = U.el('div', { class: 'stat' });
    const valueHTML = `<span>${value}</span>${unit ? `<span class="unit">${unit}</span>` : ''}`;
    let deltaHTML = '';
    if (delta != null) {
      const dir = deltaDir || (delta > 0 ? 'up' : delta < 0 ? 'down' : 'flat');
      const arrow = dir === 'up' ? '↑' : dir === 'down' ? '↓' : '→';
      deltaHTML = `<div class="stat-delta ${dir}">${arrow} ${delta}</div>`;
    }
    const iconHTML = icon ? `<div class="stat-icon">${icon}</div>` : '';
    card.innerHTML = `
      ${iconHTML}
      <div class="stat-label">${U.escapeHtml(label)}</div>
      <div class="stat-value">${valueHTML}</div>
      ${deltaHTML}
    `;
    return card;
  }

  function emptyState({ icon, title, text, action, onAction }) {
    const btn = action ? U.el('button', { class: 'btn btn-primary mt-6', text: action, onclick: onAction }) : null;
    const iconEl = U.el('div', { class: 'empty-icon', html: icon || `<svg viewBox="0 0 24 24" width="28" height="28"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2"/></svg>` });
    return U.el('div', { class: 'empty' }, [
      iconEl,
      U.el('div', { class: 'empty-title', text: title }),
      U.el('div', { class: 'empty-text', text: text }),
      btn
    ].filter(Boolean));
  }

  function field({ label, name, type = 'text', value = '', placeholder = '', required, options, rows }) {
    const id = 'f_' + name;
    const wrap = U.el('div', { class: 'field' });
    if (label) wrap.appendChild(U.el('label', { for: id, text: label }));

    let input;
    if (type === 'textarea') {
      input = U.el('textarea', { id, name, class: 'textarea', placeholder, rows: rows || 4 });
      input.value = value || '';
    } else if (type === 'select') {
      input = U.el('select', { id, name, class: 'select' });
      (options || []).forEach(o => {
        const opt = U.el('option', { value: o.value, text: o.label });
        if (o.value === value) opt.selected = true;
        input.appendChild(opt);
      });
    } else {
      input = U.el('input', { id, name, type, class: 'input', placeholder, value });
    }
    if (required) input.required = true;
    wrap.appendChild(input);
    return wrap;
  }

  function formValues(formEl) {
    const values = {};
    U.$$('input, textarea, select', formEl).forEach(i => {
      if (!i.name) return;
      if (i.type === 'checkbox') values[i.name] = i.checked;
      else if (i.type === 'number') values[i.name] = i.value === '' ? null : Number(i.value);
      else values[i.name] = i.value;
    });
    return values;
  }

  // Confirmation + submit modal
  function formModal({ title, fields, submitText = 'Enregistrer', values = {}, onSubmit, extraContent }) {
    const form = U.el('form', { class: 'col gap-4' });
    fields.forEach(f => {
      const v = values[f.name] !== undefined ? values[f.name] : f.value;
      form.appendChild(field({ ...f, value: v }));
    });
    if (extraContent) form.appendChild(extraContent);

    const actions = U.el('div', { class: 'modal-actions' }, [
      U.el('button', { type: 'button', class: 'btn', text: 'Annuler', onclick: () => m.close() }),
      U.el('button', { type: 'submit', class: 'btn btn-primary', text: submitText })
    ]);
    form.appendChild(actions);

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      const v = formValues(form);
      try {
        await onSubmit(v);
        m.close();
      } catch (err) {
        U.toast(err.message || 'Erreur', 'error');
      }
    });

    const m = U.modal({ title, body: form });
    setTimeout(() => U.$('input, textarea, select', form)?.focus(), 50);
    return m;
  }

  // Section header
  function section(title, action) {
    const h = U.el('div', { class: 'card-header' });
    h.appendChild(U.el('h3', { text: title }));
    if (action) h.appendChild(action);
    return h;
  }

  // Chip filter group
  function chips({ items, selected, onChange, multi = false }) {
    const wrap = U.el('div', { class: 'row' });
    const sel = multi ? new Set(selected || []) : selected;
    items.forEach(it => {
      const isActive = multi ? sel.has(it.value) : sel === it.value;
      const c = U.el('button', {
        class: 'chip selectable' + (isActive ? ' active' : ''),
        type: 'button',
        onclick: () => {
          if (multi) {
            if (sel.has(it.value)) sel.delete(it.value); else sel.add(it.value);
            onChange(Array.from(sel));
          } else {
            onChange(it.value);
          }
        }
      });
      c.innerHTML = (it.color ? `<span class="chip-dot" style="color:${it.color}"></span>` : '') + U.escapeHtml(it.label);
      wrap.appendChild(c);
    });
    return wrap;
  }

  function segmented({ options, value, onChange }) {
    const wrap = U.el('div', { class: 'segments' });
    let current = value;
    options.forEach(o => {
      const b = U.el('button', {
        class: 'segment' + (o.value === current ? ' active' : ''),
        type: 'button',
        text: o.label,
        onclick: () => {
          current = o.value;
          U.$$('.segment', wrap).forEach(s => s.classList.remove('active'));
          b.classList.add('active');
          onChange(o.value);
        }
      });
      wrap.appendChild(b);
    });
    return wrap;
  }

  function accordion({ title, open = false, icon }) {
    const el = U.el('div', { class: 'accordion' + (open ? ' open' : '') });
    const head = U.el('button', { type: 'button', class: 'accordion-head' });
    head.innerHTML = `
      ${icon ? `<span class="accordion-icon">${icon}</span>` : ''}
      <span class="accordion-title">${U.escapeHtml(title)}</span>
      <svg class="accordion-chev" viewBox="0 0 24 24" width="18" height="18"><path d="M6 9l6 6 6-6" stroke="currentColor" stroke-width="2" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg>
    `;
    const body = U.el('div', { class: 'accordion-body' });
    el.appendChild(head);
    el.appendChild(body);
    head.onclick = () => el.classList.toggle('open');
    return { el, body, head };
  }

  function progressBar(pct, color) {
    const wrap = U.el('div', { class: 'progress' });
    const bar = U.el('div', { class: 'progress-bar', style: { width: U.clamp(pct, 0, 100) + '%' } });
    if (color) bar.style.background = color;
    wrap.appendChild(bar);
    return wrap;
  }

  return { statCard, emptyState, field, formValues, formModal, section, chips, segmented, progressBar, accordion };
})();
