/* Explorer wiring: filters kept in the page address, key numbers, a map,
   a side-by-side comparison and a sortable results table. */

'use strict';

const Fmt = {
  usd: (n, digits = 0) =>
    n === null || n === undefined || !Number.isFinite(n)
      ? '—'
      : n.toLocaleString('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: digits, maximumFractionDigits: digits }),
  usdShort: (n) => {
    if (!Number.isFinite(n)) return '—';
    if (Math.abs(n) >= 1e6) return `$${(n / 1e6).toFixed(2).replace(/\.00$/, '')}M`;
    if (Math.abs(n) >= 1e3) return `$${Math.round(n / 1e3)}k`;
    return `$${Math.round(n)}`;
  },
  int: (n) => (Number.isFinite(n) ? Math.round(n).toLocaleString('en-US') : '—'),
  num: (n, d = 1) => (Number.isFinite(n) ? n.toFixed(d) : '—'),
  pct: (n, d = 1) => (Number.isFinite(n) ? `${n.toFixed(d)}%` : '—'),
  days: (n) => (Number.isFinite(n) ? `${Number.isInteger(n) ? n : n.toFixed(1)} d` : '—'),
  miles: (n) => (Number.isFinite(n) ? `${n.toFixed(1)} mi` : '—'),
  sqft: (n) => (Number.isFinite(n) ? `${Math.round(n).toLocaleString('en-US')} sq ft` : '—'),
};

const CAMPUS_SHORT = (name) => {
  const map = {
    'University of Illinois Urbana-Champaign': 'Illinois',
    'Purdue University': 'Purdue',
    'The University of Iowa': 'Iowa',
    'The University of North Carolina at Chapel Hill': 'North Carolina',
    'University of California, Davis': 'UC Davis',
    'University of Florida': 'Florida',
    'University of Georgia': 'Georgia',
    'University of Michigan': 'Michigan',
    'University of Virginia': 'Virginia',
    'The Pennsylvania State University': 'Penn State',
    'University of Wisconsin-Madison': 'Wisconsin',
  };
  return map[name] || name;
};

/* --------------------------- filter state -------------------------- */

const DEFAULTS = {
  campus: '',
  city: '',
  year: '',
  bedsMin: 0,
  bedsMax: 10,
  priceMin: 10000,
  priceMax: 5000000,
  sqftMin: 200,
  sqftMax: 8000,
  milesMin: 0,
  milesMax: 15,
  builtMin: 1900,
  builtMax: 2026,
  garage: '',
  basement: '',
  fireplace: '',
};

const RANGES = {
  price: { min: 10000, max: 5000000, step: 1000, minId: 'f-price-min', maxId: 'f-price-max', sliderId: 'price-slider', format: Fmt.usdShort },
  sqft: { min: 200, max: 8000, step: 50, minId: 'f-sqft-min', maxId: 'f-sqft-max', sliderId: 'sqft-slider', format: (v) => `${Fmt.int(v)}` },
  miles: { min: 0, max: 15, step: 0.5, minId: 'f-miles-min', maxId: 'f-miles-max', sliderId: 'miles-slider', format: (v) => `${v} mi` },
  built: { min: 1900, max: 2026, step: 1, minId: 'f-built-min', maxId: 'f-built-max', sliderId: 'built-slider', format: (v) => `${v}` },
};

const STATE = {
  model: null,
  filters: { ...DEFAULTS },
  sort: { key: 'sales', dir: 'desc' },
  compare: { kind: 'city' },
};

/* -------------------------- URL <-> state -------------------------- */

function readURL() {
  const p = new URLSearchParams(window.location.search);
  const f = { ...DEFAULTS };
  for (const key of Object.keys(DEFAULTS)) {
    if (!p.has(key)) continue;
    const raw = p.get(key);
    if (['campus', 'city', 'year', 'garage', 'basement', 'fireplace'].includes(key)) f[key] = raw;
    else {
      const n = Number(raw);
      if (Number.isFinite(n)) f[key] = n;
    }
  }
  return f;
}

function writeURL() {
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(STATE.filters)) {
    if (String(v) !== String(DEFAULTS[k])) p.set(k, v);
  }
  const qs = p.toString();
  const next = `${window.location.pathname}${qs ? `?${qs}` : ''}`;
  history.replaceState(null, '', next);
}

/* ----------------------------- controls ---------------------------- */

function setControlsFromState() {
  const f = STATE.filters;
  document.getElementById('f-campus').value = f.campus;
  document.getElementById('f-city').value = f.city;
  document.getElementById('f-year').value = f.year;
  document.getElementById('f-beds-min').value = f.bedsMin;
  document.getElementById('f-beds-max').value = f.bedsMax;
  for (const key of ['price', 'sqft', 'miles', 'built']) {
    const r = RANGES[key];
    document.getElementById(r.minId).value = f[`${key}Min`];
    document.getElementById(r.maxId).value = f[`${key}Max`];
  }
  for (const key of ['garage', 'basement', 'fireplace']) {
    document.getElementById(`f-${key}`).value = f[key];
  }
}

function buildControls() {
  const campusSel = document.getElementById('f-campus');
  campusSel.innerHTML = '<option value="">All campuses</option>' +
    STATE.model.meta.campuses.map((c) => `<option value="${c.name}">${CAMPUS_SHORT(c.name)}</option>`).join('');

  const citySel = document.getElementById('f-city');
  citySel.innerHTML = '<option value="">All cities</option>' +
    STATE.model.meta.cities.map((c) => `<option value="${c}">${c}</option>`).join('');

  const yearSel = document.getElementById('f-year');
  yearSel.innerHTML = '<option value="">All years</option>' +
    STATE.model.meta.years.map((y) => `<option value="${y}">${y}</option>`).join('');

  for (const key of ['price', 'sqft', 'miles', 'built']) {
    buildSlider(key);
  }

  const simple = {
    'f-campus': 'campus', 'f-city': 'city', 'f-year': 'year',
    'f-garage': 'garage', 'f-basement': 'basement', 'f-fireplace': 'fireplace',
  };
  for (const [id, key] of Object.entries(simple)) {
    document.getElementById(id).addEventListener('change', () => {
      STATE.filters[key] = document.getElementById(id).value;
      commit();
    });
  }

  for (const key of ['bedsMin', 'bedsMax']) {
    const id = key === 'bedsMin' ? 'f-beds-min' : 'f-beds-max';
    document.getElementById(id).addEventListener('input', () => {
      const v = Number(document.getElementById(id).value);
      if (Number.isFinite(v)) STATE.filters[key] = Math.max(0, Math.min(10, Math.round(v)));
      commit();
    });
  }

  document.getElementById('reset-filters').addEventListener('click', () => {
    STATE.filters = { ...DEFAULTS };
    setControlsFromState();
    syncSliders();
    commit();
  });

  document.getElementById('copy-link').addEventListener('click', copyLink);

  document.getElementById('compare-kind').addEventListener('change', (e) => {
    STATE.compare.kind = e.target.value;
    fillCompareOptions();
    renderCompare();
  });
  document.getElementById('compare-a').addEventListener('change', renderCompare);
  document.getElementById('compare-b').addEventListener('change', renderCompare);
}

function buildSlider(key) {
  const r = RANGES[key];
  const holder = document.getElementById(r.sliderId);
  holder.innerHTML = `
    <div class="slider-track"><span class="slider-fill" data-fill></span></div>
    <input type="range" data-role="lo" min="${r.min}" max="${r.max}" step="${r.step}" aria-label="${key} minimum">
    <input type="range" data-role="hi" min="${r.min}" max="${r.max}" step="${r.step}" aria-label="${key} maximum">
    <output class="slider-out" data-out></output>`;

  const lo = holder.querySelector('[data-role="lo"]');
  const hi = holder.querySelector('[data-role="hi"]');
  lo.value = r.min;
  hi.value = r.max;

  const push = (source) => {
    let a = Number(lo.value);
    let b = Number(hi.value);
    // Keep the handles from crossing.
    if (a > b) {
      if (source === 'lo') b = a; else a = b;
    }
    STATE.filters[`${key}Min`] = a;
    STATE.filters[`${key}Max`] = b;
    document.getElementById(r.minId).value = a;
    document.getElementById(r.maxId).value = b;
    paintSlider(key);
    commit();
  };

  lo.addEventListener('input', () => push('lo'));
  hi.addEventListener('input', () => push('hi'));

  for (const [id, which] of [[r.minId, 'lo'], [r.maxId, 'hi']]) {
    const input = document.getElementById(id);
    input.addEventListener('input', () => {
      const v = Number(input.value);
      if (!Number.isFinite(v)) return;
      STATE.filters[`${key}${which === 'lo' ? 'Min' : 'Max'}`] = v;
      const lo2 = Math.max(r.min, Math.min(STATE.filters[`${key}Min`], STATE.filters[`${key}Max`]));
      const hi2 = Math.min(r.max, Math.max(STATE.filters[`${key}Min`], STATE.filters[`${key}Max`]));
      lo.value = lo2;
      hi.value = hi2;
      paintSlider(key);
      commit();
    });
    input.addEventListener('blur', () => {
      // Tidy odd typed values once the field loses focus.
      const v = Number(input.value);
      const clamped = Number.isFinite(v) ? Math.max(r.min, Math.min(r.max, v)) : (which === 'lo' ? r.min : r.max);
      input.value = clamped;
      STATE.filters[`${key}${which === 'lo' ? 'Min' : 'Max'}`] = clamped;
      lo.value = STATE.filters[`${key}Min`];
      hi.value = STATE.filters[`${key}Max`];
      paintSlider(key);
      commit();
    });
  }
}

function paintSlider(key) {
  const r = RANGES[key];
  const holder = document.getElementById(r.sliderId);
  const lo = Number(holder.querySelector('[data-role="lo"]').value);
  const hi = Number(holder.querySelector('[data-role="hi"]').value);
  const pct = (v) => ((v - r.min) / (r.max - r.min)) * 100;
  const fill = holder.querySelector('[data-fill]');
  fill.style.left = `${pct(lo)}%`;
  fill.style.width = `${Math.max(0, pct(hi) - pct(lo))}%`;
  holder.querySelector('[data-out]').textContent = `${r.format(lo)} to ${r.format(hi)}`;
}

function syncSliders() {
  for (const key of ['price', 'sqft', 'miles', 'built']) {
    const r = RANGES[key];
    const holder = document.getElementById(r.sliderId);
    const lo = STATE.filters[`${key}Min`];
    const hi = STATE.filters[`${key}Max`];
    const loEl = holder.querySelector('[data-role="lo"]');
    const hiEl = holder.querySelector('[data-role="hi"]');
    if (loEl) loEl.value = Math.max(r.min, Math.min(r.max, lo));
    if (hiEl) hiEl.value = Math.max(r.min, Math.min(r.max, hi));
    paintSlider(key);
  }
}

async function copyLink() {
  const btn = document.getElementById('copy-link');
  const before = btn.textContent;
  try {
    await navigator.clipboard.writeText(window.location.href);
    btn.textContent = 'Link copied';
  } catch (e) {
    btn.textContent = 'Copy the address bar';
  }
  setTimeout(() => { btn.textContent = before; }, 1800);
}

/* ------------------------------ render ----------------------------- */

function currentRows() {
  const f = STATE.filters;
  return Analysis.filterRows(STATE.model.data, {
    campus: f.campus,
    city: f.city,
    year: f.year === '' ? null : Number(f.year),
    bedsMin: Number.isFinite(f.bedsMin) ? f.bedsMin : null,
    bedsMax: Number.isFinite(f.bedsMax) ? f.bedsMax : null,
    priceMin: f.priceMin,
    priceMax: f.priceMax,
    sqftMin: f.sqftMin,
    sqftMax: f.sqftMax,
    milesMin: f.milesMin,
    milesMax: f.milesMax,
    builtMin: f.builtMin,
    builtMax: f.builtMax,
    garage: f.garage,
    basement: f.basement,
    fireplace: f.fireplace,
  });
}

function commit() {
  writeURL();
  render();
}

function render() {
  const rows = currentRows();
  renderKPIs(rows);
  renderActiveFilters();
  renderMap(rows);
  renderCompare();
  renderTable(rows);
  renderDistribution(rows);
}

function renderKPIs(rows) {
  const s = Analysis.summarize(rows);
  const any = s.sales > 0;
  document.getElementById('kpi-sales').textContent = any ? Fmt.int(s.sales) : '0';
  document.getElementById('kpi-price').textContent = any ? Fmt.usd(s.medianPrice) : '—';
  document.getElementById('kpi-ppsf').textContent = any && Number.isFinite(s.medianPpsf) ? Fmt.usd(s.medianPpsf) : '—';
  document.getElementById('kpi-dom').textContent = any && Number.isFinite(s.medianDom) ? `${Fmt.num(s.medianDom, 1)} d` : '—';
  document.getElementById('kpi-miles').textContent = any && Number.isFinite(s.medianMiles) ? Fmt.miles(s.medianMiles) : '—';
  document.getElementById('kpi-sqft').textContent = any && Number.isFinite(s.medianSqft) ? Fmt.sqft(s.medianSqft) : '—';

  const note = document.querySelector('.kpis-card .no-match');
  if (!any && !note) {
    const p = document.createElement('p');
    p.className = 'no-match';
    p.textContent = 'No sales match these filters. Widen a range or clear a choice to see results.';
    document.getElementById('kpi-grid').after(p);
  } else if (any && note) {
    note.remove();
  }
}

function renderActiveFilters() {
  const f = STATE.filters;
  const chips = [];
  if (f.campus) chips.push(['campus', CAMPUS_SHORT(f.campus)]);
  if (f.city) chips.push(['city', f.city]);
  if (f.year !== '') chips.push(['year', f.year]);
  if (f.bedsMin !== DEFAULTS.bedsMin || f.bedsMax !== DEFAULTS.bedsMax) chips.push(['bedsMin', `${f.bedsMin}–${f.bedsMax} bedrooms`]);
  if (f.priceMin !== DEFAULTS.priceMin || f.priceMax !== DEFAULTS.priceMax) chips.push(['priceMin', `${Fmt.usdShort(f.priceMin)}–${Fmt.usdShort(f.priceMax)}`]);
  if (f.sqftMin !== DEFAULTS.sqftMin || f.sqftMax !== DEFAULTS.sqftMax) chips.push(['sqftMin', `${Fmt.int(f.sqftMin)}–${Fmt.int(f.sqftMax)} sq ft`]);
  if (f.milesMin !== DEFAULTS.milesMin || f.milesMax !== DEFAULTS.milesMax) chips.push(['milesMin', `${f.milesMin}–${f.milesMax} mi`]);
  if (f.builtMin !== DEFAULTS.builtMin || f.builtMax !== DEFAULTS.builtMax) chips.push(['builtMin', `built ${f.builtMin}–${f.builtMax}`]);
  for (const key of ['garage', 'basement', 'fireplace']) {
    if (f[key]) chips.push([key, `${key}: ${f[key]}`]);
  }

  const host = document.getElementById('active-filters');
  if (!chips.length) {
    host.innerHTML = '<span class="chip-empty">No filters applied: all 35,442 rows are shown.</span>';
    return;
  }
  host.innerHTML = chips.map(([group, label]) =>
    `<button type="button" class="chip" data-clear="${group}">${label}<span aria-hidden="true">×</span></button>`).join('');

  host.querySelectorAll('[data-clear]').forEach((b) => {
    b.addEventListener('click', () => {
      const g = b.dataset.clear;
      if (g === 'campus') STATE.filters.campus = '';
      else if (g === 'city') STATE.filters.city = '';
      else if (g === 'year') STATE.filters.year = '';
      else if (g === 'bedsMin') { STATE.filters.bedsMin = DEFAULTS.bedsMin; STATE.filters.bedsMax = DEFAULTS.bedsMax; }
      else if (g === 'priceMin') { STATE.filters.priceMin = DEFAULTS.priceMin; STATE.filters.priceMax = DEFAULTS.priceMax; }
      else if (g === 'sqftMin') { STATE.filters.sqftMin = DEFAULTS.sqftMin; STATE.filters.sqftMax = DEFAULTS.sqftMax; }
      else if (g === 'milesMin') { STATE.filters.milesMin = DEFAULTS.milesMin; STATE.filters.milesMax = DEFAULTS.milesMax; }
      else if (g === 'builtMin') { STATE.filters.builtMin = DEFAULTS.builtMin; STATE.filters.builtMax = DEFAULTS.builtMax; }
      else STATE.filters[g] = '';
      setControlsFromState();
      syncSliders();
      commit();
    });
  });
}

/* -------------------------------- map ------------------------------ */

function renderMap(rows) {
  const holder = document.getElementById('map-holder');
  holder.innerHTML = '';

  const campuses = STATE.model.meta.campuses;
  const byCity = Analysis.groupBy(STATE.model.data, (r) => r.city);

  // Median centre per city, straight from the rows.
  const cities = STATE.model.meta.cities.map((city) => {
    const rs = byCity.get(city) || [];
    const campus = campuses.find((c) => c.name === rs[0]?.campus);
    return {
      city,
      lat: Analysis.median(rs.map((r) => r.lat)),
      lon: Analysis.median(rs.map((r) => r.lon)),
      sales: rs.length,
      campus,
    };
  }).filter((c) => Number.isFinite(c.lat));

  const all = [...campuses.map((c) => ({ lat: c.lat, lon: c.lon })), ...cities];
  const latMin = Math.min(...all.map((p) => p.lat)) - 0.6;
  const latMax = Math.max(...all.map((p) => p.lat)) + 0.6;
  const lonMin = Math.min(...all.map((p) => p.lon)) - 0.6;
  const lonMax = Math.max(...all.map((p) => p.lon)) + 0.6;

  const W = 760;
  const H = 430;
  const x = (lon) => ((lon - lonMin) / (lonMax - lonMin)) * W;
  const y = (lat) => ((latMax - lat) / (latMax - latMin)) * H;

  const svg = Charts.el('svg', { viewBox: `0 0 ${W} ${H}`, role: 'group', 'aria-label': 'Map of campuses and cities' });
  svg.classList.add('map-svg');

  // A faint graticule so the map reads as a map.
  for (let lon = Math.ceil(lonMin); lon <= lonMax; lon += 2) {
    Charts.el('line', { x1: x(lon), y1: 0, x2: x(lon), y2: H, class: 'map-grid' }, svg);
  }
  for (let lat = Math.ceil(latMin); lat <= latMax; lat += 2) {
    Charts.el('line', { x1: 0, y1: y(lat), x2: W, y2: y(lat), class: 'map-grid' }, svg);
  }

  // Links from each city to its campus.
  for (const c of cities) {
    if (!c.campus) continue;
    Charts.el('line', {
      x1: x(c.campus.lon), y1: y(c.campus.lat), x2: x(c.lon), y2: y(c.lat),
      class: `map-link${STATE.filters.campus === c.campus.name ? ' is-active' : ''}`,
    }, svg);
  }

  const maxSales = Math.max(...cities.map((c) => c.sales));
  const cityRadius = (s) => 3 + 9 * Math.sqrt(s / maxSales);

  for (const c of cities) {
    const active = STATE.filters.city === c.city;
    const inCampus = STATE.filters.campus && c.campus && STATE.filters.campus === c.campus.name;
    const g = Charts.el('g', { class: 'map-city', 'tabindex': 0, role: 'button' }, svg);
    g.setAttribute('aria-label', `${c.city}, ${c.sales} sales. Click to filter to this city.`);
    Charts.el('circle', {
      cx: x(c.lon), cy: y(c.lat), r: cityRadius(c.sales),
      class: `map-dot${active ? ' is-active' : ''}${inCampus ? ' is-in-campus' : ''}${STATE.filters.city && !active ? ' is-dim' : ''}`,
    }, g);
    const labelLeft = x(c.lon) > W - 120;
    Charts.text(g, x(c.lon) + (labelLeft ? -cityRadius(c.sales) - 5 : cityRadius(c.sales) + 5), y(c.lat) + 4,
      c.city.replace(/,.*/, ''), { class: 'map-label', 'text-anchor': labelLeft ? 'end' : 'start' });
    Charts.bindTip(g, Charts.tipHTML(c.city, [['Sales', Fmt.int(c.sales)], ['Campus area', c.campus ? CAMPUS_SHORT(c.campus.name) : '—']]));
    const pick = () => {
      STATE.filters.city = active ? '' : c.city;
      STATE.filters.campus = '';
      setControlsFromState();
      commit();
    };
    g.addEventListener('click', pick);
    g.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(); } });
  }

  for (const c of campuses) {
    const active = STATE.filters.campus === c.name;
    const g = Charts.el('g', { class: 'map-campus', 'tabindex': 0, role: 'button' }, svg);
    g.setAttribute('aria-label', `${CAMPUS_SHORT(c.name)} campus. Click to filter to this campus area.`);
    Charts.el('path', {
      d: `M ${x(c.lon)} ${y(c.lat) - 9} L ${x(c.lon) + 8} ${y(c.lat) + 6} L ${x(c.lon) - 8} ${y(c.lat) + 6} Z`,
      class: `map-marker${active ? ' is-active' : ''}${STATE.filters.campus && !active ? ' is-dim' : ''}`,
    }, g);
    Charts.text(g, x(c.lon), y(c.lat) - 13, CAMPUS_SHORT(c.name), { class: 'map-campus-label', 'text-anchor': 'middle' });
    Charts.bindTip(g, Charts.tipHTML(CAMPUS_SHORT(c.name), [[ 'Campus landmark', `${c.lat.toFixed(3)}, ${c.lon.toFixed(3)}` ]]));
    const pick = () => {
      STATE.filters.campus = active ? '' : c.name;
      STATE.filters.city = '';
      setControlsFromState();
      commit();
    };
    g.addEventListener('click', pick);
    g.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); pick(); } });
  }

  svg.addEventListener('click', (e) => {
    if (e.target === svg || e.target.classList.contains('map-grid')) {
      STATE.filters.campus = '';
      STATE.filters.city = '';
      setControlsFromState();
      commit();
    }
  });

  holder.appendChild(svg);
}

/* ---------------------------- comparison --------------------------- */

function fillCompareOptions() {
  const kind = STATE.compare.kind;
  const opts = kind === 'city'
    ? STATE.model.meta.cities
    : STATE.model.meta.campuses.map((c) => c.name);
  const label = (v) => (kind === 'city' ? v : CAMPUS_SHORT(v));
  const a = document.getElementById('compare-a');
  const b = document.getElementById('compare-b');
  const prevA = a.value;
  const prevB = b.value;
  a.innerHTML = opts.map((v) => `<option value="${v}">${label(v)}</option>`).join('');
  b.innerHTML = a.innerHTML;
  a.value = opts.includes(prevA) ? prevA : opts[0];
  b.value = opts.includes(prevB) && prevB !== a.value ? prevB : opts[1] || opts[0];
}

function renderCompare() {
  const rows = currentRows();
  const kind = STATE.compare.kind;
  const a = document.getElementById('compare-a').value;
  const b = document.getElementById('compare-b').value;
  const host = document.getElementById('compare-body');
  if (!a || !b) { host.innerHTML = ''; return; }

  const res = Analysis.compare(rows, kind, a, b);
  const label = (v) => (kind === 'city' ? v : CAMPUS_SHORT(v));
  const num = (v, f) => (Number.isFinite(v) ? f(v) : '—');
  const metrics = [
    ['Median sale price', 'medianPrice', (v) => num(v, Fmt.usd), 'higher is better'],
    ['Sales', 'sales', (v) => num(v, Fmt.int), 'more is a deeper market'],
    ['Median price per sq ft', 'medianPpsf', (v) => num(v, Fmt.usd), 'lower is cheaper'],
    ['Median days on market', 'medianDom', (v) => num(v, (d) => `${Fmt.num(d, 1)} d`), 'lower is faster'],
    ['Median distance to campus', 'medianMiles', (v) => num(v, Fmt.miles), 'lower is closer'],
    ['Median living area', 'medianSqft', (v) => num(v, Fmt.sqft), 'higher is larger'],
  ];

  // A value wins when it is the one a buyer would prefer for that metric.
  const better = (metric, va, vb) => {
    if (!Number.isFinite(va) || !Number.isFinite(vb) || va === vb) return [false, false];
    const higherWins = ['Median sale price', 'Sales', 'Median living area'].includes(metric);
    return higherWins ? [va > vb, vb > va] : [va < vb, vb < va];
  };

  host.innerHTML = `
    <div class="compare-grid">
      <div class="compare-head"><span></span><strong>${label(res.a.name)}</strong><strong>${label(res.b.name)}</strong></div>
      ${metrics.map(([name, key, fn, hint]) => {
        const [aw, bw] = better(name, res.a[key], res.b[key]);
        return `<div class="compare-row">
          <span class="compare-metric">${name}<small>${hint}</small></span>
          <span class="compare-val${aw ? ' is-better' : ''}">${fn(res.a[key])}</span>
          <span class="compare-val${bw ? ' is-better' : ''}">${fn(res.b[key])}</span>
        </div>`;
      }).join('')}
    </div>`;
}

/* ------------------------------ table ------------------------------ */

const TABLE_COLUMNS = [
  { key: 'city', label: 'City', num: false },
  { key: 'sales', label: 'Sales', num: true },
  { key: 'medianPrice', label: 'Median price', num: true },
  { key: 'medianPpsf', label: 'Median $/sq ft', num: true },
  { key: 'medianSqft', label: 'Median sq ft', num: true },
  { key: 'medianDom', label: 'Median days on market', num: true },
  { key: 'medianMiles', label: 'Median miles to campus', num: true },
];

function cityTableRows(rows) {
  const by = Analysis.groupBy(rows, (r) => r.city);
  return [...by.entries()].map(([city, rs]) => ({ city, ...Analysis.summarize(rs) }));
}

function renderTable(rows) {
  const host = document.getElementById('results-table');
  const data = cityTableRows(rows);

  if (!data.length) {
    host.innerHTML = '<p class="no-match">No sales match these filters, so there is nothing to list.</p>';
    return;
  }

  const { key, dir } = STATE.sort;
  const sorted = [...data].sort((a, b) => {
    const av = a[key];
    const bv = b[key];
    if (key === 'city') return dir === 'asc' ? av.localeCompare(bv) : bv.localeCompare(av);
    const an = Number.isFinite(av) ? av : -Infinity;
    const bn = Number.isFinite(bv) ? bv : -Infinity;
    return dir === 'asc' ? an - bn : bn - an;
  });

  const head = TABLE_COLUMNS.map((c) => {
    const active = c.key === key;
    const cls = `sortable${c.num ? ' num' : ''}${active ? ' is-sorted' : ''}`;
    const aria = active ? (dir === 'asc' ? 'ascending' : 'descending') : 'none';
    return `<th scope="col" class="${cls}" data-key="${c.key}" aria-sort="${aria}" tabindex="0">
      <span class="th-label">${c.label}</span><span class="sort-icon" aria-hidden="true"></span></th>`;
  }).join('');

  const body = sorted.map((r) => `<tr>
    <td>${r.city}</td>
    <td class="num">${Fmt.int(r.sales)}</td>
    <td class="num">${Fmt.usd(r.medianPrice)}</td>
    <td class="num">${Number.isFinite(r.medianPpsf) ? Fmt.usd(r.medianPpsf) : '—'}</td>
    <td class="num">${Number.isFinite(r.medianSqft) ? Fmt.int(r.medianSqft) : '—'}</td>
    <td class="num">${Number.isFinite(r.medianDom) ? Fmt.num(r.medianDom, 1) : '—'}</td>
    <td class="num">${Number.isFinite(r.medianMiles) ? Fmt.num(r.medianMiles, 1) : '—'}</td>
  </tr>`).join('');

  host.innerHTML = `<div class="table-scroll"><table class="data results-table">
    <thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>`;

  host.querySelectorAll('th.sortable').forEach((th) => {
    const sort = () => {
      const k = th.dataset.key;
      if (STATE.sort.key === k) STATE.sort.dir = STATE.sort.dir === 'asc' ? 'desc' : 'asc';
      else STATE.sort = { key: k, dir: k === 'city' ? 'asc' : 'desc' };
      renderTable(currentRows());
    };
    th.addEventListener('click', sort);
    th.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); sort(); } });
  });
}

/* --------------------------- distribution -------------------------- */

function renderDistribution(rows) {
  const host = document.getElementById('dist-chart');
  if (!rows.length) { Charts.empty(host, 'No sales match these filters.'); return; }

  const prices = rows.map((r) => r.price);
  const cap = 2000000;
  const binW = 50000;
  const bins = [];
  for (let x = 0; x < cap; x += binW) bins.push({ x0: x, x1: x + binW, count: 0, highlight: false });
  let over = 0;
  for (const p of prices) {
    if (p >= cap) { over++; continue; }
    bins[Math.min(bins.length - 1, Math.floor(p / binW))].count++;
  }
  const median = Analysis.median(prices);

  Charts.histogram(host, {
    data: bins,
    marker: median,
    markerLabel: `median ${Fmt.usdShort(median)}`,
    binLabel: 'Price band',
    valueLabel: 'Sales',
    format: (v) => Fmt.int(v),
    xTickFormat: (v) => (v === 0 ? '$0' : `$${Math.round(v / 1000)}k`),
    axisTitle: `Sale price, $50,000 bins${over ? ` (${Fmt.int(over)} sales at $2M or more are in the last bar)` : ''}`,
  });
}

/* ------------------------------- boot ------------------------------ */

async function boot() {
  const loading = document.getElementById('loading');
  try {
    const res = await fetch('data/derived/site_data.json');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    STATE.model = Analysis.prepare(await res.json());
  } catch (err) {
    console.error(err);
    loading.innerHTML = '<div class="loading-box"><p>Could not load the data file. Please reload the page.</p></div>';
    return;
  }

  STATE.filters = readURL();
  buildControls();
  setControlsFromState();
  syncSliders();
  fillCompareOptions();
  render();
  loading.classList.add('is-hidden');

  // Back and forward buttons should restore a shared view.
  window.addEventListener('popstate', () => {
    STATE.filters = readURL();
    setControlsFromState();
    syncSliders();
    render();
  });
}

document.addEventListener('DOMContentLoaded', boot);
