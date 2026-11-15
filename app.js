/* College-town home sales explorer.
   Vanilla JS on a 2D canvas: no libraries, so nothing to install or build. */

'use strict';

const DATA_URL = 'data/derived/site_data.json';

const fmtUSD = (n) =>
  n.toLocaleString('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 });

const fmtInt = (n) => n.toLocaleString('en-US');

const fmtMiles = (n) => `${n.toFixed(1)} mi`;

const el = (id) => document.getElementById(id);

/** Short campus labels; the dataset uses full university names. */
const CAMPUS_SHORT = {
  'University of Illinois Urbana-Champaign': 'Illinois',
  'Purdue University': 'Purdue',
  'The University of Iowa': 'Iowa',
  'University of Florida': 'Florida',
  'University of Georgia': 'Georgia',
  'The Pennsylvania State University': 'Penn State',
  'University of Wisconsin-Madison': 'Wisconsin',
  'University of Michigan': 'Michigan',
  'University of Virginia': 'Virginia',
  'The University of North Carolina at Chapel Hill': 'North Carolina',
  'University of California, Davis': 'UC Davis',
};

const shortCampus = (name) => CAMPUS_SHORT[name] || name;

/* ------------------------------------------------------------------ */
/* State                                                               */
/* ------------------------------------------------------------------ */

const state = {
  data: null,
  sortKey: 'median_price',
  sortDir: 'desc',
  selectedCity: null,   // "City, ST"
  campus: '',
  cityFilter: '',
  dotColor: { r: 37, g: 87, b: 167 },
  hover: null,
};

/* ------------------------------------------------------------------ */
/* Header + KPI figures                                                */
/* ------------------------------------------------------------------ */

function fillHeadline(meta, cities) {
  const pct = Math.round(meta.dom_coverage);
  el('n-sales').textContent = fmtInt(meta.rows_kept);
  el('n-campuses').textContent = fmtInt(meta.campuses);
  el('n-cities').textContent = fmtInt(meta.cities);
  el('date-range').textContent = `${monthYear(meta.date_min)} to ${monthYear(meta.date_max)}`;

  el('kpi-median-price').textContent = fmtUSD(meta.median_price);
  el('kpi-ppsf').textContent = fmtUSD(meta.median_ppsf);
  el('kpi-dom').textContent = `${meta.median_dom} days`;
  el('kpi-near').textContent = `${meta.overall_share_under_3_mi.toFixed(0)}%`;

  el('dom-coverage').textContent = `${pct}%`;
  el('rule-min').textContent = fmtUSD(meta.min_price).replace('.00', '');
  el('rule-max').textContent = fmtUSD(meta.max_price).replace('.00', '');
  el('rule-low').textContent = fmtInt(meta.rows_dropped_low);
  el('rule-high').textContent = fmtInt(meta.rows_dropped_high);
  el('rule-kept').textContent = fmtInt(meta.rows_kept);
  el('rule-total').textContent = fmtInt(meta.rows_total);

  const cheapest = cities[0];
  const priciest = cities[cities.length - 1];
  el('city-note')?.replaceChildren(
    document.createTextNode(
      `Median prices run from ${fmtUSD(cheapest.median_price)} in ${cheapest.city}, ${cheapest.state} ` +
      `to ${fmtUSD(priciest.median_price)} in ${priciest.city}, ${priciest.state}.`
    )
  );
}

function monthYear(iso) {
  const d = new Date(`${iso}T00:00:00`);
  return d.toLocaleDateString('en-US', { month: 'short', year: 'numeric' });
}

/* ------------------------------------------------------------------ */
/* City table                                                          */
/* ------------------------------------------------------------------ */

function buildCityTable() {
  const { cities } = state.data;
  const maxPrice = Math.max(...cities.map((c) => c.median_price));

  const sorted = [...cities].sort((a, b) => {
    const { sortKey, sortDir } = state;
    let cmp;
    if (sortKey === 'city' || sortKey === 'university') {
      const av = sortKey === 'university' ? shortCampus(a[sortKey]) : a[sortKey];
      const bv = sortKey === 'university' ? shortCampus(b[sortKey]) : b[sortKey];
      cmp = av.localeCompare(bv);
    } else {
      cmp = (a[sortKey] ?? -1) - (b[sortKey] ?? -1);
    }
    return sortDir === 'asc' ? cmp : -cmp;
  });

  // Price order is always needed for the inline bars.
  const byPrice = [...cities].sort((a, b) => a.median_price - b.median_price);
  const rank = new Map(byPrice.map((c, i) => [`${c.city}, ${c.state}`, i + 1]));

  const tbody = document.querySelector('#city-table tbody');
  tbody.replaceChildren();

  for (const c of sorted) {
    const key = `${c.city}, ${c.state}`;
    const tr = document.createElement('tr');
    tr.dataset.key = key;
    if (state.selectedCity === key) tr.classList.add('is-selected');

    tr.innerHTML = `
      <td><span class="city-name">${c.city}</span> <span class="state">${c.state}</span></td>
      <td>${shortCampus(c.university)}</td>
      <td class="num">${fmtInt(c.sales)}</td>
      <td class="num bar-cell">
        <span class="bar" style="width:${(c.median_price / maxPrice) * 100}%"></span>
        <span>${fmtUSD(c.median_price)}</span>
      </td>
      <td class="num">${fmtUSD(c.median_ppsf)}</td>
      <td class="num">${fmtInt(c.median_sqft)}</td>
      <td class="num">${c.median_dom == null ? '—' : c.median_dom}</td>
      <td class="num">${fmtMiles(c.median_miles)}</td>
      <td class="num">${c.share_under_3_mi.toFixed(0)}%</td>
    `;

    tr.title = `Rank ${rank.get(key)} of ${cities.length} by median price`;
    tr.addEventListener('click', () => {
      state.selectedCity = state.selectedCity === key ? null : key;
      state.cityFilter = state.selectedCity ? c.city : '';
      el('filter-city').value = state.cityFilter;
      buildCityTable();
      drawScatter();
    });

    tbody.appendChild(tr);
  }

  document.querySelectorAll('#city-table th').forEach((th) => {
    th.setAttribute('aria-sort', th.dataset.sort === state.sortKey ? (state.sortDir === 'asc' ? 'ascending' : 'descending') : 'none');
  });

  const note = el('city-note');
  if (note) note.hidden = true;
}

function wireTableSort() {
  document.querySelectorAll('#city-table th').forEach((th) => {
    th.tabIndex = 0;
    th.addEventListener('click', () => sortBy(th.dataset.sort));
    th.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        sortBy(th.dataset.sort);
      }
    });
  });
}

function sortBy(key) {
  if (state.sortKey === key) {
    state.sortDir = state.sortDir === 'asc' ? 'desc' : 'asc';
  } else {
    state.sortKey = key;
    state.sortDir = key === 'city' || key === 'university' ? 'asc' : 'desc';
  }
  buildCityTable();
}

/* ------------------------------------------------------------------ */
/* Scatter chart                                                       */
/* ------------------------------------------------------------------ */

function setupFilters() {
  const { cities, points } = state.data;
  const campusSel = el('filter-campus');
  const citySel = el('filter-city');

  const campuses = [...new Set(cities.map((c) => c.university))].sort((a, b) =>
    shortCampus(a).localeCompare(shortCampus(b))
  );
  for (const u of campuses) {
    const o = document.createElement('option');
    o.value = u;
    o.textContent = shortCampus(u);
    campusSel.appendChild(o);
  }

  const towns = cities.map((c) => c.city).sort();
  for (const t of towns) {
    const o = document.createElement('option');
    o.value = t;
    o.textContent = t;
    citySel.appendChild(o);
  }

  campusSel.addEventListener('change', () => {
    state.campus = campusSel.value;
    drawScatter();
  });
  citySel.addEventListener('change', () => {
    state.cityFilter = citySel.value;
    if (state.cityFilter) {
      // A city filter implies its campus; keep the campus dropdown consistent.
      const row = cities.find((c) => c.city === state.cityFilter);
      state.campus = row ? row.university : '';
      campusSel.value = state.campus;
      state.selectedCity = row ? `${row.city}, ${row.state}` : null;
    } else {
      state.selectedCity = null;
    }
    buildCityTable();
    drawScatter();
  });
}

function filteredPoints() {
  const { points } = state.data;
  const cityToCampus = new Map(state.data.cities.map((c) => [c.city, c.university]));
  const out = [];
  for (let i = 0; i < points.price.length; i++) {
    if (state.campus || state.cityFilter) {
      const city = points.city[i];
      if (state.cityFilter && city !== state.cityFilter) continue;
      if (state.campus && cityToCampus.get(city) !== state.campus) continue;
    }
    out.push(i);
  }
  return out;
}

function drawScatter() {
  const canvas = el('scatter');
  const ctx = setupCanvas(canvas);
  const { width: W, height: H } = ctx.dims;
  const pad = { top: 16, right: 18, bottom: 44, left: 68 };
  const plotW = W - pad.left - pad.right;
  const plotH = H - pad.top - pad.bottom;

  const { points } = state.data;
  const idx = filteredPoints();

  const narrow = W < 560;
  const yStep = narrow ? 500000 : 250000;
  const xStep = narrow ? 1000 : 500;

  const xMax = 4500;
  state.offPlot = 0;
  const yMax = 1500000;
  const x = (v) => pad.left + (v / xMax) * plotW;
  const y = (v) => pad.top + plotH - (v / yMax) * plotH;

  ctx.clearRect(0, 0, W, H);
  ctx.font = '12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.fillStyle = '#4c5a6b';
  ctx.strokeStyle = '#e6eaef';
  ctx.lineWidth = 1;

  // horizontal grid + y labels
  for (let v = 0; v <= yMax; v += yStep) {
    const yy = Math.round(y(v)) + 0.5;
    ctx.beginPath();
    ctx.moveTo(pad.left, yy);
    ctx.lineTo(pad.left + plotW, yy);
    ctx.stroke();
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#4c5a6b';
    ctx.fillText(v === 0 ? '$0' : `$${(v / 1000).toFixed(0)}k`, pad.left - 8, yy);
  }

  // x ticks
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  for (let v = xStep; v <= xMax; v += xStep) {
    const xx = Math.round(x(v)) + 0.5;
    ctx.beginPath();
    ctx.moveTo(xx, pad.top);
    ctx.lineTo(xx, pad.top + plotH);
    ctx.stroke();
    ctx.fillText(fmtInt(v), xx, pad.top + plotH + 8);
  }

  // axis titles
  ctx.fillStyle = '#1c2430';
  ctx.font = '600 12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'top';
  ctx.fillText('Living area (sq ft)', pad.left + plotW / 2, H - 18);
  ctx.save();
  ctx.translate(16, pad.top + plotH / 2);
  ctx.rotate(-Math.PI / 2);
  ctx.textBaseline = 'middle';
  ctx.fillText('Sale price', 0, 0);
  ctx.restore();

  // plot border
  ctx.strokeStyle = '#c9d1da';
  ctx.strokeRect(pad.left + 0.5, pad.top + 0.5, plotW, plotH);

  // dots
  ctx.save();
  ctx.beginPath();
  ctx.rect(pad.left, pad.top, plotW, plotH);
  ctx.clip();
  ctx.fillStyle = 'rgba(37, 87, 167, 0.18)';
  for (const i of idx) {
    const sqft = points.sqft[i];
    const price = points.price[i];
    if (sqft > xMax || price > yMax) continue;
    ctx.beginPath();
    ctx.arc(x(sqft), y(price), 1.6, 0, Math.PI * 2);
    ctx.fill();
  }

  // Median guides for the filtered set, each computed on its own.
  if (idx.length > 5) {
    const median = (arr) => {
      const s = [...arr].sort((a, b) => a - b);
      const m = Math.floor(s.length / 2);
      return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
    };
    const medSq = median(idx.map((i) => points.sqft[i]));
    const medPr = median(idx.map((i) => points.price[i]));
    state.medSq = medSq;
    state.medPr = medPr;
    ctx.strokeStyle = '#f5b02e';
    ctx.lineWidth = 1.5;
    ctx.setLineDash([5, 4]);
    ctx.beginPath();
    ctx.moveTo(x(medSq), pad.top + plotH);
    ctx.lineTo(x(medSq), y(medPr));
    ctx.lineTo(pad.left, y(medPr));
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = '#8a6100';
    ctx.font = '600 12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.textBaseline = 'bottom';
    ctx.textAlign = 'left';
    ctx.fillText(`median price ${fmtUSD(medPr)}`, pad.left + 8, y(medPr) - 6);
    if (!narrow) {
      ctx.save();
      ctx.translate(x(medSq) - 6, y(medPr) - 14);
      ctx.rotate(-Math.PI / 2);
      ctx.textBaseline = 'bottom';
      ctx.textAlign = 'left';
      ctx.fillText(`median ${fmtInt(medSq)} sq ft`, 0, 0);
      ctx.restore();
    }
  }
  ctx.restore();

  // Points outside the plotted range are counted, then stated on the page.
  for (const i of idx) {
    if (points.sqft[i] > xMax || points.price[i] > yMax) state.offPlot++;
  }

  updateScatterNote(idx.length);
}

function updateScatterNote(n) {
  const parts = [`${fmtInt(n)} sales plotted`];
  if (state.medSq != null) {
    parts.push(`median ${fmtInt(state.medSq)} sq ft at ${fmtUSD(state.medPr)}`);
  }
  if (state.offPlot) {
    parts.push(`${fmtInt(state.offPlot)} over 4,500 sq ft or $1.5M are outside the chart range and not drawn`);
  }
  if (state.cityFilter) parts.push(`filtered to ${state.cityFilter}`);
  else if (state.campus) parts.push(`filtered to ${shortCampus(state.campus)}`);
  el('scatter-note').textContent = `${parts.join('. ')}.`;
}

/* ------------------------------------------------------------------ */
/* Trend chart                                                         */
/* ------------------------------------------------------------------ */

function drawTrend() {
  const canvas = el('trend');
  const ctx = setupCanvas(canvas);
  const { width: W, height: H } = ctx.dims;
  const pad = { top: 28, right: 18, bottom: 34, left: 68 };
  const plotW = W - pad.left - pad.right;
  const plotH = H - pad.top - pad.bottom;

  const { yearly } = state.data;
  const maxV = Math.max(...yearly.map((y) => y.median_price));
  const top = Math.ceil(maxV / 50000) * 50000 + 25000;

  ctx.clearRect(0, 0, W, H);
  ctx.font = '12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';

  const y = (v) => pad.top + plotH - (v / top) * plotH;

  for (let v = 0; v <= top; v += 100000) {
    const yy = Math.round(y(v)) + 0.5;
    ctx.strokeStyle = '#e6eaef';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.moveTo(pad.left, yy);
    ctx.lineTo(pad.left + plotW, yy);
    ctx.stroke();
    ctx.fillStyle = '#4c5a6b';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    ctx.fillText(`$${(v / 1000).toFixed(0)}k`, pad.left - 8, yy);
  }

  const slot = plotW / yearly.length;
  const barW = Math.min(84, slot * 0.55);

  yearly.forEach((d, i) => {
    const cx = pad.left + slot * (i + 0.5);
    const h = Math.max(0, pad.top + plotH - y(d.median_price));
    ctx.fillStyle = '#2557a7';
    ctx.beginPath();
    ctx.roundRect(cx - barW / 2, y(d.median_price), barW, h, [4, 4, 0, 0]);
    ctx.fill();

    ctx.fillStyle = '#1c2430';
    ctx.font = '600 12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'bottom';
    ctx.fillText(fmtUSD(d.median_price), cx, y(d.median_price) - 6);

    ctx.fillStyle = '#4c5a6b';
    ctx.font = '12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    ctx.textBaseline = 'top';
    ctx.fillText(String(d.year), cx, pad.top + plotH + 8);
    ctx.fillText(`${fmtInt(d.sales)} sales`, cx, pad.top + plotH + 24);
  });

  ctx.strokeStyle = '#c9d1da';
  ctx.beginPath();
  ctx.moveTo(pad.left, pad.top + plotH + 0.5);
  ctx.lineTo(pad.left + plotW, pad.top + plotH + 0.5);
  ctx.stroke();
}

/* ------------------------------------------------------------------ */
/* Canvas plumbing                                                     */
/* ------------------------------------------------------------------ */

function setupCanvas(canvas) {
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const rect = canvas.getBoundingClientRect();
  const width = Math.max(320, Math.floor(rect.width));
  const height = Math.max(200, Math.floor(rect.height));
  if (canvas.width !== width * dpr || canvas.height !== height * dpr) {
    canvas.width = width * dpr;
    canvas.height = height * dpr;
  }
  const ctx = canvas.getContext('2d');
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.dims = { width, height };
  return ctx;
}

/* ------------------------------------------------------------------ */
/* Boot                                                                */
/* ------------------------------------------------------------------ */

async function init() {
  try {
    const res = await fetch(DATA_URL);
    if (!res.ok) throw new Error(`HTTP ${res.status} loading ${DATA_URL}`);
    state.data = await res.json();
  } catch (err) {
    console.error(err);
    document.querySelector('main').insertAdjacentHTML(
      'afterbegin',
      '<p class="panel" role="alert">Could not load the data file. If you opened this file directly, run it from a web server instead.</p>'
    );
    return;
  }

  fillHeadline(state.data.meta, state.data.cities);
  wireTableSort();
  buildCityTable();
  setupFilters();
  drawScatter();
  drawTrend();

  let raf = null;
  window.addEventListener('resize', () => {
    if (raf) cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => {
      drawScatter();
      drawTrend();
    });
  });
}

init();
