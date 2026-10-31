/* ==========================================================================
   MOMENTUM - SVG charts library (zero dependency)
   Chart types: line, area, bar, donut, ring, sparkline, heatmap, stackedBar
   ========================================================================== */

const Charts = (() => {

  const NS = 'http://www.w3.org/2000/svg';

  function svg(w, h, viewBox) {
    const s = document.createElementNS(NS, 'svg');
    s.setAttribute('viewBox', viewBox || `0 0 ${w} ${h}`);
    s.setAttribute('width', '100%');
    s.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    s.setAttribute('style', `max-height: ${h}px`);
    return s;
  }

  function elNS(tag, attrs = {}) {
    const n = document.createElementNS(NS, tag);
    for (const k in attrs) n.setAttribute(k, attrs[k]);
    return n;
  }

  function gradient(id, c1, c2) {
    const defs = elNS('defs');
    const g = elNS('linearGradient', { id, x1: '0', y1: '0', x2: '0', y2: '1' });
    g.appendChild(elNS('stop', { offset: '0', 'stop-color': c1, 'stop-opacity': '0.4' }));
    g.appendChild(elNS('stop', { offset: '1', 'stop-color': c2, 'stop-opacity': '0' }));
    defs.appendChild(g);
    return defs;
  }

  function textColor() { return U.cssVar('--text-2') || '#a1a1b2'; }
  function gridColor() { return U.cssVar('--border') || 'rgba(255,255,255,0.08)'; }

  // ---- Line chart ----
  function line({ data, labels, color = '#8b5cf6', height = 180, showGrid = true, showDots = true, fillArea = true, yFormat = v => v }) {
    const w = 600, h = height;
    const pad = { t: 20, r: 20, b: 30, l: 40 };
    const iw = w - pad.l - pad.r;
    const ih = h - pad.t - pad.b;

    const values = data.length ? data : [0];
    const min = Math.min(0, ...values);
    const max = Math.max(1, ...values);
    const range = (max - min) || 1;

    const s = svg(w, h);
    const uid = 'g' + Math.random().toString(36).slice(2, 8);
    s.appendChild(gradient(uid, color, color));

    // Grid
    if (showGrid) {
      for (let i = 0; i <= 4; i++) {
        const y = pad.t + (ih / 4) * i;
        s.appendChild(elNS('line', { x1: pad.l, y1: y, x2: w - pad.r, y2: y, stroke: gridColor(), 'stroke-dasharray': '2 4' }));
        const v = max - (range / 4) * i;
        const t = elNS('text', { x: pad.l - 8, y: y + 4, 'text-anchor': 'end', fill: textColor(), 'font-size': '10' });
        t.textContent = yFormat(v);
        s.appendChild(t);
      }
    }

    // Points
    const points = data.map((v, i) => {
      const x = data.length === 1 ? pad.l + iw / 2 : pad.l + (iw / (data.length - 1)) * i;
      const y = pad.t + ih - ((v - min) / range) * ih;
      return { x, y, v, i };
    });

    const path = points.map((p, i) => (i === 0 ? 'M' : 'L') + p.x + ',' + p.y).join(' ');

    if (fillArea && points.length > 1) {
      const areaPath = path + ` L${points[points.length - 1].x},${pad.t + ih} L${points[0].x},${pad.t + ih} Z`;
      s.appendChild(elNS('path', { d: areaPath, fill: `url(#${uid})` }));
    }

    if (points.length > 1) {
      const p = elNS('path', { d: path, fill: 'none', stroke: color, 'stroke-width': '2.5', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' });
      p.setAttribute('class', 'chart-line');
      s.appendChild(p);
    }

    if (showDots) {
      points.forEach((pt, i) => {
        const c = elNS('circle', { cx: pt.x, cy: pt.y, r: '3', fill: color, stroke: U.cssVar('--bg-1') || '#fff', 'stroke-width': '2' });
        c.setAttribute('class', 'chart-point');
        c.style.animationDelay = (i * 40) + 'ms';
        const title = elNS('title');
        title.textContent = (labels ? labels[i] + ': ' : '') + yFormat(pt.v);
        c.appendChild(title);
        s.appendChild(c);
      });
    }

    // X labels
    if (labels && data.length <= 14) {
      points.forEach((pt, i) => {
        const t = elNS('text', { x: pt.x, y: h - 8, 'text-anchor': 'middle', fill: textColor(), 'font-size': '10' });
        t.textContent = labels[i];
        s.appendChild(t);
      });
    } else if (labels) {
      const step = Math.ceil(labels.length / 7);
      points.forEach((pt, i) => {
        if (i % step !== 0) return;
        const t = elNS('text', { x: pt.x, y: h - 8, 'text-anchor': 'middle', fill: textColor(), 'font-size': '10' });
        t.textContent = labels[i];
        s.appendChild(t);
      });
    }

    return s;
  }

  // ---- Sparkline ----
  function sparkline({ data, color = '#8b5cf6', height = 44 }) {
    const w = 160, h = height;
    if (!data.length) return svg(w, h);

    const min = Math.min(...data);
    const max = Math.max(...data);
    const range = (max - min) || 1;

    const s = svg(w, h);
    const uid = 's' + Math.random().toString(36).slice(2, 8);
    s.appendChild(gradient(uid, color, color));

    const points = data.map((v, i) => {
      const x = data.length === 1 ? w / 2 : (w / (data.length - 1)) * i;
      const y = h - 4 - ((v - min) / range) * (h - 8);
      return { x, y };
    });

    const path = points.map((p, i) => (i === 0 ? 'M' : 'L') + p.x + ',' + p.y).join(' ');
    const areaPath = path + ` L${points[points.length - 1].x},${h} L${points[0].x},${h} Z`;

    s.appendChild(elNS('path', { d: areaPath, fill: `url(#${uid})` }));
    s.appendChild(elNS('path', { d: path, fill: 'none', stroke: color, 'stroke-width': '2', 'stroke-linecap': 'round', 'stroke-linejoin': 'round' }));

    return s;
  }

  // ---- Bar chart ----
  function bar({ data, labels, color = '#8b5cf6', height = 200, yFormat = v => v, horizontal = false }) {
    const w = 600, h = height;
    const pad = { t: 20, r: 20, b: 30, l: 40 };
    const iw = w - pad.l - pad.r;
    const ih = h - pad.t - pad.b;

    const values = data.length ? data : [0];
    const max = Math.max(1, ...values);

    const s = svg(w, h);

    // Grid
    for (let i = 0; i <= 4; i++) {
      const y = pad.t + (ih / 4) * i;
      s.appendChild(elNS('line', { x1: pad.l, y1: y, x2: w - pad.r, y2: y, stroke: gridColor(), 'stroke-dasharray': '2 4' }));
      const v = max - (max / 4) * i;
      const t = elNS('text', { x: pad.l - 8, y: y + 4, 'text-anchor': 'end', fill: textColor(), 'font-size': '10' });
      t.textContent = yFormat(v);
      s.appendChild(t);
    }

    const barW = (iw / data.length) * 0.6;
    const gap = (iw / data.length) * 0.4;

    data.forEach((v, i) => {
      const bh = (v / max) * ih;
      const x = pad.l + (iw / data.length) * i + gap / 2;
      const y = pad.t + ih - bh;

      const g = elNS('g');
      const r = elNS('rect', { x, y, width: barW, height: bh, rx: '3', fill: color, opacity: '0.9' });
      r.style.setProperty('--bar-h', bh + 'px');
      r.setAttribute('class', 'chart-bar');
      r.style.animationDelay = (i * 40) + 'ms';
      const title = elNS('title');
      title.textContent = (labels ? labels[i] + ': ' : '') + yFormat(v);
      g.appendChild(r);
      g.appendChild(title);
      s.appendChild(g);

      if (labels) {
        const t = elNS('text', { x: x + barW / 2, y: h - 8, 'text-anchor': 'middle', fill: textColor(), 'font-size': '10' });
        t.textContent = labels[i];
        s.appendChild(t);
      }
    });

    return s;
  }

  // ---- Stacked bar ----
  function stackedBar({ data, labels, colors, legend, height = 200, yFormat = v => v }) {
    const w = 600, h = height;
    const pad = { t: 20, r: 20, b: 30, l: 40 };
    const iw = w - pad.l - pad.r;
    const ih = h - pad.t - pad.b;

    const totals = data.map(row => row.reduce((a, b) => a + b, 0));
    const max = Math.max(1, ...totals);

    const s = svg(w, h);

    for (let i = 0; i <= 4; i++) {
      const y = pad.t + (ih / 4) * i;
      s.appendChild(elNS('line', { x1: pad.l, y1: y, x2: w - pad.r, y2: y, stroke: gridColor(), 'stroke-dasharray': '2 4' }));
      const v = max - (max / 4) * i;
      const t = elNS('text', { x: pad.l - 8, y: y + 4, 'text-anchor': 'end', fill: textColor(), 'font-size': '10' });
      t.textContent = yFormat(v);
      s.appendChild(t);
    }

    const barW = (iw / data.length) * 0.6;
    const gap = (iw / data.length) * 0.4;

    data.forEach((row, i) => {
      let acc = 0;
      const x = pad.l + (iw / data.length) * i + gap / 2;
      row.forEach((v, j) => {
        const bh = (v / max) * ih;
        const y = pad.t + ih - ((acc + v) / max) * ih;
        acc += v;
        const r = elNS('rect', { x, y, width: barW, height: bh, rx: j === row.length - 1 ? '3' : '0', fill: colors[j] });
        r.setAttribute('class', 'chart-bar');
        r.style.animationDelay = (i * 40) + 'ms';
        s.appendChild(r);
      });

      if (labels) {
        const t = elNS('text', { x: x + barW / 2, y: h - 8, 'text-anchor': 'middle', fill: textColor(), 'font-size': '10' });
        t.textContent = labels[i];
        s.appendChild(t);
      }
    });

    return s;
  }

  // ---- Donut ----
  function donut({ data, colors, labels, size = 180, centerText, centerLabel }) {
    const s = svg(size, size);
    const cx = size / 2, cy = size / 2;
    const r = size / 2 - 20, rInner = r * 0.6;
    const total = data.reduce((a, b) => a + b, 0) || 1;

    let start = -Math.PI / 2;
    data.forEach((v, i) => {
      if (v <= 0) return;
      const slice = (v / total) * Math.PI * 2;
      const end = start + slice;
      const large = slice > Math.PI ? 1 : 0;
      const x1 = cx + r * Math.cos(start);
      const y1 = cy + r * Math.sin(start);
      const x2 = cx + r * Math.cos(end);
      const y2 = cy + r * Math.sin(end);
      const x3 = cx + rInner * Math.cos(end);
      const y3 = cy + rInner * Math.sin(end);
      const x4 = cx + rInner * Math.cos(start);
      const y4 = cy + rInner * Math.sin(start);

      const d = [
        `M${x1},${y1}`,
        `A${r},${r} 0 ${large} 1 ${x2},${y2}`,
        `L${x3},${y3}`,
        `A${rInner},${rInner} 0 ${large} 0 ${x4},${y4}`,
        'Z'
      ].join(' ');

      const path = elNS('path', { d, fill: colors[i] });
      path.setAttribute('class', 'chart-point');
      path.style.animationDelay = (i * 60) + 'ms';
      path.style.transformOrigin = `${cx}px ${cy}px`;
      if (labels) {
        const title = elNS('title');
        title.textContent = `${labels[i]}: ${Math.round(v / total * 100)}%`;
        path.appendChild(title);
      }
      s.appendChild(path);

      start = end;
    });

    if (centerText) {
      const t = elNS('text', { x: cx, y: cy - 2, 'text-anchor': 'middle', fill: U.cssVar('--text-0'), 'font-size': '22', 'font-weight': '700' });
      t.textContent = centerText;
      s.appendChild(t);
    }
    if (centerLabel) {
      const t = elNS('text', { x: cx, y: cy + 16, 'text-anchor': 'middle', fill: textColor(), 'font-size': '11' });
      t.textContent = centerLabel;
      s.appendChild(t);
    }

    return s;
  }

  // ---- Progress ring ----
  function ring({ value = 0, max = 100, size = 120, stroke = 10, color = '#8b5cf6', bgColor, centerText, centerLabel }) {
    const s = svg(size, size);
    const cx = size / 2, cy = size / 2;
    const r = (size - stroke) / 2;
    const circ = 2 * Math.PI * r;
    const pct = U.clamp(value / max, 0, 1);
    const offset = circ * (1 - pct);

    s.appendChild(elNS('circle', { cx, cy, r, fill: 'none', stroke: bgColor || gridColor(), 'stroke-width': stroke }));

    const uid = 'r' + Math.random().toString(36).slice(2, 8);
    const defs = elNS('defs');
    const g = elNS('linearGradient', { id: uid, x1: '0', y1: '0', x2: '1', y2: '1' });
    g.appendChild(elNS('stop', { offset: '0', 'stop-color': color }));
    g.appendChild(elNS('stop', { offset: '1', 'stop-color': '#06b6d4' }));
    defs.appendChild(g);
    s.appendChild(defs);

    const circle = elNS('circle', {
      cx, cy, r,
      fill: 'none',
      stroke: `url(#${uid})`,
      'stroke-width': stroke,
      'stroke-linecap': 'round',
      'stroke-dasharray': circ,
      'stroke-dashoffset': offset,
      transform: `rotate(-90 ${cx} ${cy})`
    });
    circle.style.transition = 'stroke-dashoffset 1s cubic-bezier(0.4, 0, 0.2, 1)';
    s.appendChild(circle);

    if (centerText) {
      const t = elNS('text', { x: cx, y: cy + 2, 'text-anchor': 'middle', 'dominant-baseline': 'middle', fill: U.cssVar('--text-0'), 'font-size': size * 0.22, 'font-weight': '700' });
      t.textContent = centerText;
      s.appendChild(t);
    }
    if (centerLabel) {
      const t = elNS('text', { x: cx, y: cy + size * 0.18, 'text-anchor': 'middle', fill: textColor(), 'font-size': size * 0.08 });
      t.textContent = centerLabel;
      s.appendChild(t);
    }

    return s;
  }

  // ---- Heatmap (GitHub-style) ----
  function heatmap({ data, days = 90, color = '#10b981', onClick }) {
    // data: { 'YYYY-MM-DD': count } or array of { date, count }
    const map = Array.isArray(data) ? data.reduce((o, d) => { o[d.date] = d.count; return o; }, {}) : (data || {});
    const end = U.today();
    const cells = [];
    const max = Math.max(1, ...Object.values(map));

    for (let i = days - 1; i >= 0; i--) {
      const d = U.addDays(end, -i);
      const iso = U.iso(d);
      cells.push({ iso, count: map[iso] || 0, date: d });
    }

    const container = U.el('div', { class: 'heatmap' });
    // pad first week with empty cells so columns align by week
    const firstDay = cells[0].date.getDay();
    const pad = (firstDay + 6) % 7; // Monday=0
    for (let i = 0; i < pad; i++) {
      container.appendChild(U.el('div', { class: 'heatmap-cell empty' }));
    }

    cells.forEach(c => {
      const level = c.count === 0 ? 0 : c.count >= max * 0.75 ? 4 : c.count >= max * 0.5 ? 3 : c.count >= max * 0.25 ? 2 : 1;
      const cell = U.el('div', {
        class: 'heatmap-cell' + (level > 0 ? ' l' + level : ''),
        title: `${U.fmtDate(c.date, { day: 'numeric', month: 'short', year: 'numeric' })} - ${c.count}`,
        onclick: onClick ? () => onClick(c) : null
      });
      container.appendChild(cell);
    });

    return container;
  }

  // ---- Horizontal bar list (budget-style) ----
  function hBarList({ items, color = '#8b5cf6', max }) {
    const container = U.el('div', { style: { display: 'flex', flexDirection: 'column', gap: '10px' } });
    const vMax = max || Math.max(1, ...items.map(i => i.value));
    items.forEach(it => {
      const pct = U.clamp(it.value / vMax * 100, 0, 100);
      const row = U.el('div');
      row.innerHTML = `
        <div style="display:flex;justify-content:space-between;margin-bottom:4px;font-size:13px;">
          <span style="color:var(--text-1);font-weight:500;">${U.escapeHtml(it.label)}</span>
          <span style="color:var(--text-2);font-family:var(--font-mono);">${it.display || it.value}</span>
        </div>
        <div class="progress thin"><div class="progress-bar" style="width:${pct}%;background:${it.color || color};"></div></div>
      `;
      container.appendChild(row);
    });
    return container;
  }

  return { line, sparkline, bar, stackedBar, donut, ring, heatmap, hBarList };
})();
