/* Small SVG chart toolkit shared by the analysis page and the explorer.
   No dependencies: each chart takes a container, data and options, and
   draws theme-aware SVG with a tooltip per mark. */

'use strict';

const SVG_NS = 'http://www.w3.org/2000/svg';

const Charts = (() => {
  const state = { theme: 'light', registry: [] };

  /* ---------------------------- helpers ---------------------------- */

  function el(tag, attrs = {}, parent = null) {
    const node = document.createElementNS(SVG_NS, tag);
    for (const [k, v] of Object.entries(attrs)) {
      if (v === null || v === undefined) continue;
      node.setAttribute(k, v);
    }
    if (parent) parent.appendChild(node);
    return node;
  }

  function text(parent, x, y, str, attrs = {}) {
    const t = el('text', { x, y, ...attrs }, parent);
    t.textContent = str;
    return t;
  }

  /** Width of a string in the page's sans font, measured once per string.
      Falls back to an estimate where no DOM is available (the Node check). */
  const widthCache = new Map();
  let measureCtx = null;
  function textWidth(str, size = 12) {
    const key = `${size}|${str}`;
    if (widthCache.has(key)) return widthCache.get(key);
    if (!measureCtx && typeof document !== 'undefined' && document.createElement) {
      measureCtx = document.createElement('canvas').getContext('2d');
    }
    let w;
    if (measureCtx) {
      measureCtx.font = `700 ${size}px "Inter", ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif`;
      w = measureCtx.measureText(String(str)).width;
    }
    // Value labels are drawn at font-weight 600, which is wider than the
    // regular weight; a small margin keeps a bold label from touching a bar.
    if (!Number.isFinite(w)) w = String(str).length * size * 0.62;
    w += size * 0.25;
    widthCache.set(key, w);
    return w;
  }

  function niceMax(value, steps = 5) {
    if (!(value > 0)) return 1;
    const raw = value / steps;
    const mag = Math.pow(10, Math.floor(Math.log10(raw)));
    const norm = raw / mag;
    const step = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 2.5 ? 2.5 : norm <= 5 ? 5 : 10) * mag;
    return step * Math.ceil(value / step);
  }

  function ticks(max, count = 5) {
    const step = niceMax(max, count) / count;
    const out = [];
    for (let v = 0; v <= max + step / 2; v += step) out.push(v);
    return out;
  }

  /* ---------------------------- tooltip ---------------------------- */

  let tip = null;
  function tooltipNode() {
    if (!tip) {
      tip = document.createElement('div');
      tip.className = 'tooltip';
      tip.setAttribute('role', 'tooltip');
      document.body.appendChild(tip);
    }
    return tip;
  }

  function showTip(evt, html) {
    const t = tooltipNode();
    t.innerHTML = html;
    t.classList.add('is-visible');
    moveTip(evt);
  }

  function moveTip(evt) {
    const t = tooltipNode();
    const pad = 14;
    const w = t.offsetWidth || 160;
    const h = t.offsetHeight || 60;
    let x = evt.clientX + pad;
    let y = evt.clientY + pad;
    if (x + w > window.innerWidth - 8) x = evt.clientX - w - pad;
    if (y + h > window.innerHeight - 8) y = evt.clientY - h - pad;
    t.style.transform = `translate(${Math.max(8, x)}px, ${Math.max(8, y)}px)`;
  }

  function hideTip() {
    if (tip) tip.classList.remove('is-visible');
  }

  function tipHTML(title, rows) {
    const parts = [`<div class="tooltip-title">${title}</div>`];
    for (const [k, v] of rows) {
      parts.push(`<div class="tooltip-row"><span>${k}</span><span>${v}</span></div>`);
    }
    return parts.join('');
  }

  /** Attach hover/focus behaviour to a mark: bindTip(node, html) or
      bindTip(html, node), so call sites can pass either order. */
  function bindTip(a, b) {
    const node = a && a.addEventListener ? a : b;
    const html = a && a.addEventListener ? b : a;
    node.addEventListener('mouseenter', (e) => showTip(e, html));
    node.addEventListener('mousemove', moveTip);
    node.addEventListener('mouseleave', hideTip);
    node.addEventListener('focus', (e) => {
      const r = node.getBoundingClientRect();
      showTip({ clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 }, html);
    });
    node.addEventListener('blur', hideTip);
    if (!node.hasAttribute('tabindex')) node.setAttribute('tabindex', '0');
    node.setAttribute('role', 'img');
    node.setAttribute('aria-label', html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim());
  }

  /* ----------------------------- frame ----------------------------- */

  function frame(container, { height, padLeft, padRight = 16, padTop = 8, padBottom = 34 }) {
    container.innerHTML = '';
    const rect = container.getBoundingClientRect();
    const W = Math.max(260, Math.floor(rect.width));
    const H = Math.max(140, Math.floor(rect.height || height));
    const svg = el('svg', {
      viewBox: `0 0 ${W} ${H}`,
      width: W,
      height: H,
      // Scale like text, not like a stretched image, so labels keep their shape.
      preserveAspectRatio: 'xMidYMid meet',
      role: 'group',
    }, container);
    svg.style.height = `${H}px`;
    return {
      svg, W, H,
      plotW: W - padLeft - padRight,
      plotH: H - padTop - padBottom,
      padLeft, padTop, padBottom, padRight,
    };
  }

  function empty(container, message) {
    container.innerHTML = `<div class="chart-empty"><p>${message}</p></div>`;
  }

  /* -------------------------- horizontal bar ----------------------- */

  /**
   * When a bar is long enough that its value label would run into the bars
   * for short values, the label moves inside the end of the bar and turns
   * light. Returns {x, anchor, inside}.
   */
  function valuePlacement(barLeft, barW, textW, plotRight, widestLabel) {
    // The lane is a clear column right of the bar's end that fits the longest
    // value label, so equal-length bars never overprint each other.
    const lane = widestLabel + 10;
    const fitsOutside = barLeft + barW + 8 + textW <= plotRight;
    if (barW < lane && fitsOutside) {
      // Short bar: its value reads best right beside its own end, and no
      // other bar reaches into the lane's right edge at that row.
      return { x: barLeft + barW + 8, anchor: 'start', inside: false };
    }
    if (barW > textW + 18) {
      return { x: barLeft + 8, anchor: 'start', inside: true };
    }
    return { x: Math.min(plotRight - 2, barLeft + barW + 8 + textW), anchor: 'end', inside: false };
  }

  /**
   * opts: {
   *   data: [{label, value, highlight, tipHTML}],
   *   format: fn(value) -> string,
   *   axisTitle, labelWidth (px), sort: 'none'|'asc'|'desc',
   *   minBarWidth
   * }
   */
  function hbar(container, opts) {
    // Wait for the chart box to have a width; a slow stylesheet can leave it at 0.
    if (container.clientWidth < 40) return;
    const data = opts.data.filter((d) => Number.isFinite(d.value));
    if (!data.length) return empty(container, opts.emptyText || 'No sales match these settings.');

    const labelW = opts.labelWidth || Math.max(56, Math.ceil(Math.max(...data.map((d) => textWidth(d.label, 12)))) + 8);
    const fmt = opts.format || ((v) => String(v));
    const max = Math.max(...data.map((d) => Math.abs(d.value)));
    const axisMax = niceMax(max, 4);
    const longestValue = Math.ceil(Math.max(...data.map((d) => textWidth(fmt(d.value), 11.5))));
    // Right padding is the longer of the axis tick label and the longest value
    // label, so nothing is cut off at the edge.
    const valueRoom = Math.max(longestValue / 2, Math.ceil(textWidth(fmt(axisMax), 11))) + 12;
    const f = frame(container, { height: container.clientHeight, padLeft: labelW, padBottom: 40, padTop: 6, padRight: valueRoom });
    const { svg, plotW, plotH } = f;
    const gx = (v) => (v / axisMax) * plotW;
    const rowH = Math.max(16, plotH / data.length);
    const colTop = Math.max(0, (plotH - rowH * data.length) / 2);
    const barH = Math.max(8, rowH * 0.62);

    // gridlines
    for (const t of ticks(axisMax, 4)) {
      const x = f.padLeft + gx(t);
      el('line', { x1: x, y1: 0, x2: x, y2: plotH, class: 'grid-line' }, svg);
      text(svg, x, plotH + 16, fmt(t), { class: 'tick-label', 'text-anchor': 'middle' });
    }

    data.forEach((d, i) => {
      const cy = colTop + rowH * (i + 0.5);
      const w = Math.max(2, gx(Math.abs(d.value)));
      const answer = !!d.highlight;
      const g = el('g', {}, svg);

      // A soft wash behind the answer row makes the highlighted city easy to
      // find without relying on colour alone.
      if (answer) {
        el('rect', {
          x: 0, y: colTop + rowH * i, width: f.W, height: rowH,
          class: 'answer-row', 'pointer-events': 'none',
        }, g);
      }

      // A soft wash behind the answer row makes the highlighted city easy to
      // find without relying on colour alone.
      if (answer) {
        el('rect', {
          x: 0, y: colTop + rowH * i, width: f.W, height: rowH,
          class: 'answer-row', 'pointer-events': 'none',
        }, g);
      }

      const bar = el('rect', {
        x: f.padLeft, y: cy - barH / 2, width: w, height: barH, rx: 3,
        class: `bar${answer ? ' is-answer' : ''}`,
      }, g);

      text(g, f.padLeft - 8, cy + 4, d.label, {
        class: `cat-label${answer ? ' is-answer' : ''}`,
        'text-anchor': 'end',
      });

      const place = valuePlacement(f.padLeft, w, textWidth(fmt(d.value), 11.5), f.padLeft + plotW, longestValue);
      text(g, place.x, cy + 4, fmt(d.value), {
        class: `value-label${place.inside ? ' is-inside' : ''}`,
        'text-anchor': place.anchor,
      });

      bindTip(bar, d.tipHTML || tipHTML(d.label, [[opts.valueLabel || 'Value', fmt(d.value)]]));
    });

    // axis line + title
    el('line', { x1: f.padLeft, y1: plotH, x2: f.padLeft + plotW, y2: plotH, class: 'axis-line' }, svg);
    if (opts.axisTitle) {
      text(svg, f.padLeft + plotW / 2, f.H - 4, opts.axisTitle, { class: 'axis-label', 'text-anchor': 'middle' });
    }
  }

  /* --------------------------- diverging bar ----------------------- */

  /** Bars for positive and negative percent values with a zero line. */
  function divergingBar(container, opts) {
    if (container.clientWidth < 40) return;
    const data = opts.data.filter((d) => Number.isFinite(d.value));
    if (!data.length) return empty(container, opts.emptyText || 'Nothing to show for these settings.');

    const labelW = opts.labelWidth || Math.max(56, Math.ceil(Math.max(...data.map((d) => textWidth(d.label, 12)))) + 8);
    const fmt0 = opts.format || ((v) => `${v.toFixed(1)}%`);
    const rightRoom = Math.ceil(Math.max(...data.map((d) => textWidth(fmt0(d.value), 11.5))) + 14);
    const f = frame(container, { height: container.clientHeight, padLeft: labelW, padRight: rightRoom, padTop: 10, padBottom: 40 });
    const { svg, plotW, plotH } = f;
    const fmt = opts.format || ((v) => `${v.toFixed(1)}%`);
    const min = Math.min(0, ...data.map((d) => d.value));
    const max = Math.max(0, ...data.map((d) => d.value));
    const span = max - min || 1;
    const gx = (v) => f.padLeft + ((v - min) / span) * plotW;
    const zero = gx(0);
    const rowH = plotH / data.length;
    const barH = Math.min(22, Math.max(8, rowH * 0.62));

    const stepCount = 4;
    const step = niceMax(Math.max(Math.abs(min), Math.abs(max)), stepCount) / stepCount;
    for (let v = Math.ceil(min / step) * step; v <= max + step / 2; v += step) {
      const x = gx(v);
      el('line', { x1: x, y1: 0, x2: x, y2: plotH, class: 'grid-line' }, svg);
      text(svg, x, plotH + 16, fmt(v), { class: 'tick-label', 'text-anchor': 'middle' });
    }

    data.forEach((d, i) => {
      const cy = rowH * (i + 0.5);
      const answer = !!d.highlight;
      const negative = d.value < 0;
      const x0 = negative ? gx(d.value) : zero;
      const w = Math.max(2, Math.abs(gx(d.value) - zero));
      const g = el('g', {}, svg);

      const bar = el('rect', {
        x: x0, y: cy - barH / 2, width: w, height: barH, rx: 3,
        class: `bar${negative ? ' is-negative' : ''}${answer ? ' is-answer' : ''}`,
      }, g);

      text(g, -8, cy + 4, d.label, { class: `cat-label${answer ? ' is-answer' : ''}`, 'text-anchor': 'end' });

      // In the positive lane the value sits at the far right, in the column the
      // axis tick ends at, so it never overprints a bar. Below zero there is
      // little room, so each value sits just left of its own bar.
      const lx = negative ? x0 - 6 : f.padLeft + plotW;
      text(g, lx, cy + 4, fmt(d.value), {
        class: 'value-label',
        'text-anchor': negative ? 'end' : 'start',
        ...(negative ? {} : {}),
      });

      bindTip(bar, d.tipHTML || tipHTML(d.label, [[opts.valueLabel || 'Value', fmt(d.value)]]));
    });

    el('line', { x1: zero, y1: 0, x2: zero, y2: plotH, class: 'zero-line' }, svg);
    el('line', { x1: f.padLeft, y1: plotH, x2: f.padLeft + plotW, y2: plotH, class: 'axis-line' }, svg);
    if (opts.axisTitle) text(svg, f.padLeft + plotW / 2, f.H - 4, opts.axisTitle, { class: 'axis-label', 'text-anchor': 'middle' });
  }

  /* --------------------------- vertical column --------------------- */

  /** Monthly columns. opts.data: [{label, value, highlight}] */
  function columns(container, opts) {
    const data = opts.data;
    const f = frame(container, { height: container.clientHeight, padLeft: 48, padRight: 12, padTop: 22, padBottom: 44 });
    const { svg, plotW, plotH } = f;
    const fmt = opts.format || ((v) => String(v));
    const max = Math.max(1, ...data.map((d) => d.value));
    const axisMax = niceMax(max, 4);

    for (const t of ticks(axisMax, 4)) {
      const y = plotH - (t / axisMax) * plotH;
      el('line', { x1: 0, y1: y, x2: plotW, y2: y, class: 'grid-line' }, svg);
      text(svg, -8, y + 4, fmt(t), { class: 'tick-label', 'text-anchor': 'end' });
    }

    const slot = plotW / data.length;
    const barW = Math.min(46, slot * 0.66);

    data.forEach((d, i) => {
      const cx = slot * (i + 0.5);
      const h = (d.value / axisMax) * plotH;
      const g = el('g', {}, svg);
      const col = el('rect', {
        x: cx - barW / 2, y: plotH - h, width: barW, height: Math.max(h, d.value > 0 ? 1.5 : 0),
        rx: Math.min(4, barW / 3),
        class: `col${d.highlight ? ' is-answer' : ''}`,
      }, g);
      if (d.highlight) text(g, cx, plotH - h - 6, fmt(d.value), { class: 'value-label', 'text-anchor': 'middle' });
      text(g, cx, plotH + 18, d.label, { class: `tick-label${d.highlight ? ' cat-label is-answer' : ''}`, 'text-anchor': 'middle' });
      bindTip(col, d.tipHTML || tipHTML(d.fullLabel || d.label, [[opts.valueLabel || 'Sales', fmt(d.value)]]));
    });

    el('line', { x1: 0, y1: plotH, x2: plotW, y2: plotH, class: 'axis-line' }, svg);
    if (opts.axisTitle) text(svg, plotW / 2, f.H - 4, opts.axisTitle, { class: 'axis-label', 'text-anchor': 'middle' });
  }

  /* ------------------------------ dot plot ------------------------- */

  /** Dot plot with optional quartile ranges per category. */
  function dotPlot(container, opts) {
    if (container.clientWidth < 40) return;
    const data = opts.data.filter((d) => Number.isFinite(d.value));
    if (!data.length) return empty(container, opts.emptyText || 'No sales match these settings.');

    const labelW = opts.labelWidth || Math.max(56, Math.ceil(Math.max(...data.map((d) => textWidth(d.label, 12)))) + 8);
    const fmt0 = opts.format || ((v) => String(v));
    const rightRoom = Math.ceil(Math.max(...data.map((d) => textWidth(fmt0(d.value), 11.5))) + 20);
    const f = frame(container, { height: container.clientHeight, padLeft: labelW, padRight: rightRoom, padTop: 8, padBottom: 40 });
    const { svg, plotW, plotH } = f;
    const fmt = fmt0;
    const vals = data.flatMap((d) => [d.value, d.q1 ?? d.value, d.q3 ?? d.value]);
    const axisMax = niceMax(Math.max(...vals), 4);
    const gx = (v) => f.padLeft + (v / axisMax) * plotW;
    const rowH = plotH / data.length;

    for (const t of ticks(axisMax, 4)) {
      const x = f.padLeft + gx(t);
      el('line', { x1: x, y1: 0, x2: x, y2: plotH, class: 'grid-line' }, svg);
      text(svg, x, plotH + 16, fmt(t), { class: 'tick-label', 'text-anchor': 'middle' });
    }

    data.forEach((d, i) => {
      const cy = rowH * (i + 0.5);
      const g = el('g', {}, svg);
      const answer = !!d.highlight;

      if (Number.isFinite(d.q1) && Number.isFinite(d.q3)) {
        el('line', { x1: gx(d.q1), y1: cy, x2: gx(d.q3), y2: cy, class: 'range-line' }, g);
        el('line', { x1: gx(d.q1), y1: cy - 5, x2: gx(d.q1), y2: cy + 5, class: 'range-cap' }, g);
        el('line', { x1: gx(d.q3), y1: cy - 5, x2: gx(d.q3), y2: cy + 5, class: 'range-cap' }, g);
      }

      const dot = el('circle', {
        cx: gx(d.value), cy, r: answer ? 7 : 5.5,
        class: 'dot', ...(answer ? {} : { style: 'fill:var(--ink-3)' }),
      }, g);

      text(g, f.padLeft - 8, cy + 4, d.label, { class: `cat-label${answer ? ' is-answer' : ''}`, 'text-anchor': 'end' });
      text(g, gx(d.value) + (answer ? 11 : 9), cy + 4, fmt(d.value), { class: 'value-label' });

      bindTip(dot, d.tipHTML || tipHTML(d.label, [[opts.valueLabel || 'Median', fmt(d.value)]]));
    });

    el('line', { x1: f.padLeft, y1: plotH, x2: f.padLeft + plotW, y2: plotH, class: 'axis-line' }, svg);
    if (opts.axisTitle) text(svg, f.padLeft + plotW / 2, f.H - 4, opts.axisTitle, { class: 'axis-label', 'text-anchor': 'middle' });
  }

  /* ------------------------------ slope ---------------------------- */

  /** Two-column slope chart. data: [{label, left, right, highlight, tipHTML}] */
  function slope(container, opts) {
    const data = opts.data;
    // Labels are right-aligned on the left and left-aligned on the right, so a
    // single label width that fits the longest name keeps both columns correct.
    const labelW = Math.max(72, Math.ceil(Math.max(...data.map((d) => textWidth(d.label, 12)))) + 12);
    const f = frame(container, { height: container.clientHeight, padLeft: labelW, padRight: labelW, padTop: 40, padBottom: 16 });
    const { svg, plotW, plotH } = f;
    const xL = 0;
    const xR = plotW;

    // Rank column headings. They start at the axis edge and stay inside the
    // figure, so a long label at the top cannot collide with them.
    if (opts.showHeadings !== false) {
      text(svg, xL, -12, opts.leftTitle || 'Before', { class: 'axis-label', 'text-anchor': 'start' });
      text(svg, xR, -12, opts.rightTitle || 'After', { class: 'axis-label', 'text-anchor': 'end' });
    }

    const yFor = (rank) => ((rank - 1) / Math.max(1, data.length - 1)) * plotH;

    const sorted = [...data].sort((a, b) => a.right - b.right);
    const leftByRank = new Map(sorted.map((d, i) => [d.label, i + 1]));

    for (const d of data) {
      const y1 = yFor(leftByRank.get(d.label));
      const y2 = yFor(d.right);
      const g = el('g', {}, svg);
      const answer = !!d.highlight;
      const moved = d.left !== d.right;

      const line = el('path', {
        d: `M ${xL} ${y1} C ${xL + plotW * 0.4} ${y1}, ${xR - plotW * 0.4} ${y2}, ${xR} ${y2}`,
        class: `slope-line${answer ? ' is-answer' : ''}`,
        fill: 'none',
        style: answer || moved ? '' : 'opacity:0.55',
      }, g);

      el('circle', { cx: xL, cy: y1, r: answer ? 4.5 : 3.5, class: `slope-dot${answer ? ' is-answer' : ''}` }, g);
      el('circle', { cx: xR, cy: y2, r: answer ? 4.5 : 3.5, class: `slope-dot${answer ? ' is-answer' : ''}` }, g);

      text(g, -8, y1 + 4, `${d.label}`, { class: `cat-label${answer ? ' is-answer' : ''}`, 'text-anchor': 'end' });
      text(g, xR + 8, y2 + 4, `${d.label}`, { class: `cat-label${answer ? ' is-answer' : ''}`, 'text-anchor': 'start' });

      bindTip(line, d.tipHTML || tipHTML(d.label, [
        [opts.leftTitle || 'Before', `rank ${leftByRank.get(d.label)}`],
        [opts.rightTitle || 'After', `rank ${d.right}`],
      ]));
    }
  }

  /* ---------------------------- histogram -------------------------- */

  /** opts.data: [{x0, x1, count, highlight}], opts.marker: value */
  function histogram(container, opts) {
    const data = opts.data;
    const f = frame(container, { height: container.clientHeight, padLeft: 58, padRight: 44, padTop: 20, padBottom: 44 });
    const { svg, plotW, plotH } = f;
    const fmt = opts.format || ((v) => String(v));
    const tickFmt = opts.tickFormat || ((v) => (Number.isInteger(v) ? fmt(v) : String(v)));
    const xMax = Math.max(...data.map((d) => d.x1));
    const max = Math.max(1, ...data.map((d) => d.count));
    const axisMax = niceMax(max, 4);
    const gx = (v) => f.padLeft + (v / xMax) * plotW;

    for (const t of ticks(axisMax, 4)) {
      const y = plotH - (t / axisMax) * plotH;
      el('line', { x1: f.padLeft, y1: y, x2: f.padLeft + plotW, y2: y, class: 'grid-line' }, svg);
      text(svg, f.padLeft - 8, y + 4, tickFmt(t), { class: 'tick-label', 'text-anchor': 'end' });
    }

    for (const d of data) {
      const x = gx(d.x0);
      const w = Math.max(1, gx(d.x1) - gx(d.x0) - 1);
      const h = (d.count / axisMax) * plotH;
      const g = el('g', {}, svg);
      const rect = el('rect', {
        x, y: plotH - h, width: w, height: Math.max(h, d.count > 0 ? 1.5 : 0),
        class: `hist${d.highlight ? ' is-answer' : ''}`,
      }, g);
      bindTip(rect, tipHTML(`${opts.binLabel || 'Range'} ${d.x0.toFixed(1)}–${d.x1.toFixed(1)}`, [
        [opts.valueLabel || 'Sales', fmt(d.count)],
      ]));
    }

    // x ticks, spaced and formatted to stay readable
    const stepCount = Math.min(6, Math.max(3, Math.floor(plotW / 110)));
    const xFmt = opts.xTickFormat || ((v) => String(v));
    for (let i = 0; i <= stepCount; i++) {
      const v = (xMax / stepCount) * i;
      text(svg, gx(v), plotH + 16, xFmt(v), { class: 'tick-label', 'text-anchor': 'middle' });
    }

    if (Number.isFinite(opts.marker)) {
      const mx = gx(Math.min(opts.marker, xMax));
      el('line', { x1: mx, y1: 0, x2: mx, y2: plotH, class: 'median-line' }, svg);
      const nearRight = mx > f.padLeft + plotW - 90;
      text(svg, mx + (nearRight ? -6 : 6), 12, opts.markerLabel || `median ${opts.marker.toFixed(1)}`, {
        class: 'value-label', 'text-anchor': nearRight ? 'end' : 'start',
      });
    }

    el('line', { x1: f.padLeft, y1: plotH, x2: f.padLeft + plotW, y2: plotH, class: 'axis-line' }, svg);
    if (opts.axisTitle) text(svg, f.padLeft + plotW / 2, f.H - 4, opts.axisTitle, { class: 'axis-label', 'text-anchor': 'middle' });
  }

  /* ------------------------- grouped columns ----------------------- */

  /** opts.groups: [{label, a, b, highlight}], opts.series: [{name, cls}] */
  function grouped(container, opts) {
    const { groups, series } = opts;
    const f = frame(container, { height: container.clientHeight, padLeft: 46, padRight: 12, padTop: 24, padBottom: 46 });
    const { svg, plotW, plotH } = f;
    const fmt = opts.format || ((v) => String(v));
    const axisMax = niceMax(Math.max(1, ...groups.flatMap((g) => series.map((s) => g[s.key]))), 4);

    for (const t of ticks(axisMax, 4)) {
      const y = plotH - (t / axisMax) * plotH;
      el('line', { x1: 0, y1: y, x2: plotW, y2: y, class: 'grid-line' }, svg);
      text(svg, -8, y + 4, fmt(t), { class: 'tick-label', 'text-anchor': 'end' });
    }

    const slot = plotW / groups.length;
    const barW = Math.min(26, (slot * 0.7) / series.length);

    groups.forEach((g, i) => {
      const cx = slot * (i + 0.5);
      const grp = el('g', {}, svg);
      series.forEach((s, si) => {
        const v = g[s.key];
        const h = (v / axisMax) * plotH;
        const x = cx - (barW * series.length) / 2 + si * barW;
        const rect = el('rect', {
          x, y: plotH - h, width: Math.max(2, barW - 2), height: Math.max(h, v > 0 ? 1.5 : 0),
          rx: 3, class: `col${s.cls ? ` ${s.cls}` : ''}`,
        }, grp);
        bindTip(rect, tipHTML(g.label, [[s.name, fmt(v)]]));
      });
      text(grp, cx, plotH + 18, g.label, { class: `tick-label${g.highlight ? ' cat-label is-answer' : ''}`, 'text-anchor': 'middle', 'style': 'font-size:12px' });
    });

    el('line', { x1: 0, y1: plotH, x2: plotW, y2: plotH, class: 'axis-line' }, svg);
    if (opts.axisTitle) text(svg, plotW / 2, f.H - 4, opts.axisTitle, { class: 'axis-label', 'text-anchor': 'middle' });
  }

  /* ---------------------------- registry --------------------------- */

  /** Register a redraw so theme changes and resizes keep charts current. */
  function register(draw) {
    state.registry.push(draw);
  }

  function redrawAll() {
    for (const d of state.registry) {
      try { d(); } catch (err) { console.error(err); }
    }
  }

  /** Re-registering a chart replaces its previous draw for that container. */
  function redraw(draw) {
    draw();
  }

  let resizeTimer = null;
  window.addEventListener('resize', () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(() => {
      hideTip();
      redrawAll();
    }, 120);
  });

  return {
    el, text, hbar, divergingBar, columns, dotPlot, slope, histogram, grouped,
    empty, tipHTML, register, redrawAll, redraw, hideTip, textWidth, niceMax, ticks,
  };
})();
