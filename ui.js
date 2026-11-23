/* Page wiring for the analysis view: load the data, answer Q1-Q10,
   drive the Q7-Q10 controls, and draw each chart. */

'use strict';

/* ------------------------------ format ----------------------------- */

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
  pct: (n, d = 2) => (Number.isFinite(n) ? `${n.toFixed(d)}%` : '—'),
  days: (n) => (Number.isFinite(n) ? `${Number.isInteger(n) ? n : n.toFixed(1)} days` : '—'),
  miles: (n) => (Number.isFinite(n) ? `${n.toFixed(1)} mi` : '—'),
  month: (m) => ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'][m - 1],
  shortMonth: (m) => ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][m - 1],
  list(items) {
    if (items.length <= 1) return items[0] || '';
    return `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;
  },
};

const CAMPUS_SHORT = (name) => {
  const map = {
    'University of Illinois Urbana-Champaign': 'Illinois',
    'Purdue University': 'Purdue',
    'The University of Iowa': 'Iowa',
    'University of North Carolina at Chapel Hill': 'North Carolina',
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

/* ---------------------------- answer box --------------------------- */

function setAnswer(id, { lead, detail, empty = false }) {
  const box = document.getElementById(id);
  if (!box) return;
  box.classList.toggle('is-empty', !!empty);
  box.innerHTML = `<span class="answer-lead">${lead}</span>${detail ? `<span class="answer-detail">${detail}</span>` : ''}`;
}

/* ------------------------------ tables ----------------------------- */

function setTable(id, columns, rows, answerRow) {
  const host = document.getElementById(id);
  if (!host) return;
  const head = columns.map((c) => `<th scope="col" class="${c.num ? 'num' : ''}">${c.label}</th>`).join('');
  const body = rows.map((r, i) => {
    const cells = columns.map((c) => `<td class="${c.num ? 'num' : ''}">${r[c.key]}</td>`).join('');
    const cls = answerRow && answerRow(r) ? ' class="is-answer"' : '';
    return `<tr${cls}>${cells}</tr>`;
  }).join('');
  host.innerHTML = `<div class="table-scroll"><table class="data"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table></div>`;
}

/* ------------------------------ charts ----------------------------- */

const charts = [];

function registerChart(fn) {
  charts.push(fn);
  Charts.register(fn);
  fn();
}

/* ------------------------------- boot ------------------------------ */

let MODEL = null;

async function boot() {
  const loading = document.getElementById('loading');
  try {
    const res = await fetch('data/derived/site_data.json');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const payload = await res.json();
    MODEL = Analysis.prepare(payload);
  } catch (err) {
    console.error(err);
    loading.innerHTML = '<div class="loading-box"><p>Could not load the data file. Please reload the page.</p></div>';
    return;
  }

  fillHeader();
  buildControls();
  renderAll();
  loading.classList.add('is-hidden');
  wireToc();
}

function fillHeader() {
  const d = MODEL.data;
  document.getElementById('stat-sales').textContent = Fmt.int(d.length);
  document.getElementById('stat-cities').textContent = Fmt.int(MODEL.meta.cities.length);
  document.getElementById('stat-campuses').textContent = Fmt.int(MODEL.meta.campuses.length);
  const y1 = MODEL.meta.date_min.slice(0, 4);
  const y2 = MODEL.meta.date_max.slice(0, 4);
  document.getElementById('stat-dates').textContent = `${y1}–${y2}`;
}

function buildControls() {
  // Q7 bedroom select, counting only sales inside the price scope so the
  // figure beside each choice matches what the chart will use.
  const bedCounts = new Map();
  for (const r of MODEL.data) {
    if (Number.isFinite(r.beds) && Analysis.isValidPrice(r.price)) bedCounts.set(r.beds, (bedCounts.get(r.beds) || 0) + 1);
  }
  const bedOptions = [...bedCounts.entries()]
    .filter(([b, n]) => b >= 1 && b <= 8 && n >= 20)
    .sort((a, b) => a[0] - b[0]);
  const q7 = document.getElementById('q7-beds');
  q7.innerHTML = bedOptions.map(([b, n]) => `<option value="${b}">${b} bedroom${b === 1 ? '' : 's'} (${Fmt.int(n)} sales)</option>`).join('');
  q7.value = '3';

  // Q9 city and year selects.
  const q9City = document.getElementById('q9-city');
  q9City.innerHTML = MODEL.meta.cities.map((c) => `<option value="${c}">${c}</option>`).join('');
  q9City.value = 'Champaign, IL';

  const q9Year = document.getElementById('q9-year');
  q9Year.innerHTML = MODEL.meta.years.map((y) => `<option value="${y}">${y}</option>`).join('');
  q9Year.value = String(MODEL.meta.years[MODEL.meta.years.length - 2] ?? MODEL.meta.years[0]);

  // Q10 campus select.
  const q10 = document.getElementById('q10-campus');
  q10.innerHTML = MODEL.meta.campuses
    .map((c) => `<option value="${c.name}">${CAMPUS_SHORT(c.name)}</option>`)
    .join('');
  q10.value = 'University of Illinois Urbana-Champaign';

  for (const id of ['q7-beds', 'q8-min', 'q8-max', 'q9-city', 'q9-year', 'q10-campus', 'q10-budget', 'q10-beds']) {
    const node = document.getElementById(id);
    node.addEventListener('input', renderDynamic);
    node.addEventListener('change', renderDynamic);
  }
}

function renderAll() {
  renderQ1(); renderQ2(); renderQ3(); renderQ4(); renderQ5(); renderQ6();
  renderDynamic();
  renderInsights();
}

function renderDynamic() {
  renderQ7(); renderQ8(); renderQ9(); renderQ10();
}

/* -------------------------------- Q1 ------------------------------- */

function renderQ1() {
  const res = Analysis.q1(MODEL.data);
  const w = res.winner;
  setAnswer('q1-answer', {
    lead: `${w.city} has the highest median sale price, at ${Fmt.usd(w.median)}.`,
    detail: `That is ${Fmt.usd(w.median - res.rows[1].median)} more than ${res.rows[1].city}, the next city, and ` +
      `${(w.median / res.rows[res.rows.length - 1].median).toFixed(1)} times the lowest, ${res.rows[res.rows.length - 1].city} at ` +
      `${Fmt.usd(res.rows[res.rows.length - 1].median)}. The other cities in the top five are ` +
      `${Fmt.list(res.rows.slice(1, 5).map((r) => `${r.city} (${Fmt.usd(r.median)})`))}.`,
  });
  setTable('q1-table',
    [{ key: 'city', label: 'City' }, { key: 'median', label: 'Median price', num: true }, { key: 'sales', label: 'Sales', num: true }],
    res.rows.map((r) => ({ city: r.city, median: Fmt.usd(r.median), sales: Fmt.int(r.sales) })),
    (r) => r.city === w.city);

  registerChart(() => {
    Charts.hbar(document.getElementById('q1-chart'), {
      data: res.rows.map((r) => ({
        label: r.city,
        value: r.median,
        highlight: r.city === w.city,
        tipHTML: Charts.tipHTML(r.city, [['Median price', Fmt.usd(r.median)], ['Sales', Fmt.int(r.sales)]]),
      })),
      format: Fmt.usdShort,
      axisTitle: 'Median sale price',
      emptyText: 'No sales in the price scope.',
    });
  });
}

/* -------------------------------- Q2 ------------------------------- */

function renderQ2() {
  const res = Analysis.q2(MODEL.data);
  const w = res.winner;
  setAnswer('q2-answer', {
    lead: `${w.city} has the widest gap: its mean is ${Fmt.usd(w.mean)} against a median of ${Fmt.usd(w.median)}, ` +
      `${Fmt.pct(w.gapPct)} of the median.`,
    detail: `The gap comes from a few very expensive sales. Athens holds four sales above $5 million, including one at ` +
      `$81,510,000, and a handful of seven-figure homes; the median ignores them while the mean does not. ` +
      `Every city's mean sits above its median, because home prices have a long right tail everywhere.`,
  });
  setTable('q2-table',
    [{ key: 'city', label: 'City' }, { key: 'mean', label: 'Mean', num: true },
     { key: 'median', label: 'Median', num: true }, { key: 'gap', label: 'Gap', num: true },
     { key: 'sales', label: 'Sales', num: true }],
    res.rows.map((r) => ({ city: r.city, mean: Fmt.usd(r.mean), median: Fmt.usd(r.median), gap: Fmt.pct(r.gapPct), sales: Fmt.int(r.sales) })),
    (r) => r.city === w.city);

  registerChart(() => {
    Charts.hbar(document.getElementById('q2-chart'), {
      data: res.rows.map((r) => ({
        label: r.city,
        value: r.gapPct,
        highlight: r.city === w.city,
        tipHTML: Charts.tipHTML(r.city, [
          ['Mean', Fmt.usd(r.mean)],
          ['Median', Fmt.usd(r.median)],
          ['Gap', Fmt.pct(r.gapPct)],
          ['Sales', Fmt.int(r.sales)],
        ]),
      })),
      format: (v) => `${v.toFixed(1)}%`,
      axisTitle: 'Mean minus median, as a percent of the median',
    });
  });
}

/* -------------------------------- Q3 ------------------------------- */

function renderQ3() {
  const res = Analysis.q3(MODEL.data);
  const changed = res.changed;
  const parts = changed.map((c) => {
    const dir = c.moved > 0 ? 'down' : 'up';
    return `${c.city} moves ${dir} ${Math.abs(c.moved)} place${Math.abs(c.moved) === 1 ? '' : 's'}, from rank ${c.rankValid} to ${c.rankAll}`;
  });
  setAnswer('q3-answer', {
    lead: changed.length === 0
      ? 'No city changes rank when sales above $5 million are removed.'
      : `${changed.length} of 18 cities change rank: ${parts.join('; ')}.`,
    detail: `Davis (${Fmt.usd(res.rows[0].meanValid)} mean) and Pittsboro (${Fmt.usd(res.rows[1].meanValid)}) hold the top two places under both rules. ` +
      `Athens falls because four sales above $5 million, up to $81,510,000, lift its mean of all rows to ` +
      `${Fmt.usd(res.rows.find((r) => r.city === 'Athens, GA').meanAll)}. On valid sales it averages ` +
      `${Fmt.usd(res.rows.find((r) => r.city === 'Athens, GA').meanValid)}.`,
  });
  setTable('q3-table',
    [{ key: 'city', label: 'City' }, { key: 'rankAll', label: 'Rank, all rows', num: true },
     { key: 'rankValid', label: 'Rank, $10k–$5M', num: true }, { key: 'move', label: 'Places moved', num: true },
     { key: 'meanAll', label: 'Mean, all rows', num: true }, { key: 'meanValid', label: 'Mean, $10k–$5M', num: true }],
    res.rows.map((r) => ({
      city: r.city, rankAll: r.rankAll, rankValid: r.rankValid,
      move: r.moved === 0 ? '—' : `${r.moved > 0 ? '+' : ''}${r.moved}`,
      meanAll: Fmt.usd(r.meanAll), meanValid: Fmt.usd(r.meanValid),
    })),
    (r) => changed.some((c) => c.city === r.city));

  registerChart(() => {
    Charts.slope(document.getElementById('q3-chart'), {
      data: res.rows.map((r) => ({
        label: r.city,
        left: r.rankAll,
        right: r.rankValid,
        highlight: r.moved !== 0,
        tipHTML: Charts.tipHTML(r.city, [
          ['Rank, all rows', r.rankAll],
          ['Rank, $10k–$5M', r.rankValid],
          ['Mean, all rows', Fmt.usd(r.meanAll)],
          ['Mean, $10k–$5M', Fmt.usd(r.meanValid)],
        ]),
      })),
      leftTitle: 'All rows',
      rightTitle: '$10k to $5M',
      showHeadings: false,
    });
  });
}

/* -------------------------------- Q4 ------------------------------- */

function renderQ4() {
  const res = Analysis.q4(MODEL.data);
  const big = res.biggest;
  const dec = res.decreases;
  setAnswer('q4-answer', {
    lead: `${CAMPUS_SHORT(big.campus)} had the largest increase, ${Fmt.pct(big.pct)}, with the median rising from ` +
      `${Fmt.usd(big.median2024)} in 2024 to ${Fmt.usd(big.median2025)} in 2025.`,
    detail: dec.length
      ? `${dec.length === 1 ? 'One campus area fell' : `${dec.length} campus areas fell`}: ` +
        `${Fmt.list(dec.map((d) => `${CAMPUS_SHORT(d.campus)} (${Fmt.pct(d.pct)}, ${Fmt.usd(d.median2024)} to ${Fmt.usd(d.median2025)})`))}. ` +
        `The other ${res.rows.length - dec.length} areas rose, from ${Fmt.pct(res.rows.filter((r) => r.pct >= 0).slice(-1)[0].pct)} to ${Fmt.pct(big.pct)}.`
      : 'No campus area fell.',
  });
  setTable('q4-table',
    [{ key: 'campus', label: 'Campus area' }, { key: 'm24', label: '2024 median', num: true },
     { key: 'm25', label: '2025 median', num: true }, { key: 'pct', label: 'Change', num: true }],
    res.rows.map((r) => ({ campus: CAMPUS_SHORT(r.campus), m24: Fmt.usd(r.median2024), m25: Fmt.usd(r.median2025), pct: Fmt.pct(r.pct) })),
    (r) => r.campus === big.campus);

  registerChart(() => {
    Charts.divergingBar(document.getElementById('q4-chart'), {
      data: res.rows.map((r) => ({
        label: CAMPUS_SHORT(r.campus),
        value: r.pct,
        highlight: r.campus === big.campus,
        tipHTML: Charts.tipHTML(CAMPUS_SHORT(r.campus), [
          ['2024 median', Fmt.usd(r.median2024)],
          ['2025 median', Fmt.usd(r.median2025)],
          ['Change', Fmt.pct(r.pct)],
        ]),
      })),
      format: (v) => `${v.toFixed(1)}%`,
      axisTitle: 'Change in median sale price, 2024 to 2025',
    });
  });
}

/* -------------------------------- Q5 ------------------------------- */

function renderQ5() {
  const res = Analysis.q5(MODEL.data);
  const f = res.fastest;
  const s = res.slowest;
  const tiedFast = res.rows.filter((r) => r.median === f.median).map((r) => CAMPUS_SHORT(r.campus));
  setAnswer('q5-answer', {
    lead: `${tiedFast.length > 1 ? `${Fmt.list(tiedFast)} tie as the fastest` : `${CAMPUS_SHORT(f.campus)} is the fastest`}, ` +
      `with a median of ${Fmt.days(f.median)} on market. ${CAMPUS_SHORT(s.campus)} is the slowest at ${Fmt.days(s.median)}.`,
    detail: `That is a spread of ${Fmt.days(s.median - f.median)} between the quickest and slowest campus areas. ` +
      `After ${CAMPUS_SHORT(s.campus)}, the next slowest are ` +
      `${Fmt.list(res.rows.slice(-3, -1).reverse().map((r) => `${CAMPUS_SHORT(r.campus)} (${Fmt.days(r.median)})`))}. ` +
      `Days on market count listing to accepted offer, using the ${Fmt.pct(res.rows.reduce((a, r) => a + r.sales, 0) / 35371 * 100, 1)} of valid sales that have both dates.`,
  });
  setTable('q5-table',
    [{ key: 'campus', label: 'Campus area' }, { key: 'median', label: 'Median days', num: true },
     { key: 'q1', label: '25th percentile', num: true }, { key: 'q3', label: '75th percentile', num: true },
     { key: 'sales', label: 'Sales used', num: true }],
    res.rows.map((r) => ({
      campus: CAMPUS_SHORT(r.campus), median: Fmt.num(r.median, 1), q1: Fmt.num(r.q1, 1), q3: Fmt.num(r.q3, 1), sales: Fmt.int(r.sales),
    })),
    (r) => r.campus === s.campus || r.campus === f.campus);

  registerChart(() => {
    Charts.dotPlot(document.getElementById('q5-chart'), {
      data: res.rows.map((r) => ({
        label: CAMPUS_SHORT(r.campus),
        value: r.median,
        q1: r.q1,
        q3: r.q3,
        highlight: r.campus === s.campus || r.median === f.median,
        tipHTML: Charts.tipHTML(CAMPUS_SHORT(r.campus), [
          ['Median', Fmt.num(r.median, 1)],
          ['Middle half', `${Fmt.num(r.q1, 1)} to ${Fmt.num(r.q3, 1)}`],
          ['Sales used', Fmt.int(r.sales)],
        ]),
      })),
      format: (v) => `${Math.round(v)}`,
      axisTitle: 'Days from listing to accepted offer',
    });
  });
}

/* -------------------------------- Q6 ------------------------------- */

function renderQ6() {
  const res = Analysis.q6(MODEL.data);
  const hi = res.highest;
  const lo = res.lowest;
  setAnswer('q6-answer', {
    lead: `${CAMPUS_SHORT(hi.campus)} has the highest tax burden, ${Fmt.pct(hi.pct, 3)} of total sale price, ` +
      `and ${CAMPUS_SHORT(lo.campus)} the lowest at ${Fmt.pct(lo.pct, 3)}.`,
    detail: `Across ${CAMPUS_SHORT(hi.campus)}'s ${Fmt.int(hi.sales)} qualifying sales, annual tax totals ${Fmt.usd(hi.tax)} on ` +
      `${Fmt.usd(hi.price)} of sales. Owners there pay ${Fmt.num(hi.pct / lo.pct, 1)} times the rate of ` +
      `${CAMPUS_SHORT(lo.campus)}, whose ${Fmt.int(lo.sales)} sales carry ${Fmt.usd(lo.tax)} of tax on ${Fmt.usd(lo.price)}. ` +
      `Tax bills above 10% of the sale price, which are data errors, are excluded.`,
  });
  setTable('q6-table',
    [{ key: 'campus', label: 'Campus area' }, { key: 'tax', label: 'Total annual tax', num: true },
     { key: 'price', label: 'Total sale price', num: true }, { key: 'pct', label: 'Percent', num: true },
     { key: 'sales', label: 'Sales', num: true }],
    res.rows.map((r) => ({ campus: CAMPUS_SHORT(r.campus), tax: Fmt.usd(r.tax), price: Fmt.usd(r.price), pct: Fmt.pct(r.pct, 3), sales: Fmt.int(r.sales) })),
    (r) => r.campus === hi.campus || r.campus === lo.campus);

  registerChart(() => {
    Charts.hbar(document.getElementById('q6-chart'), {
      data: res.rows.map((r) => ({
        label: CAMPUS_SHORT(r.campus),
        value: r.pct,
        highlight: r.campus === hi.campus || r.campus === lo.campus,
        tipHTML: Charts.tipHTML(CAMPUS_SHORT(r.campus), [
          ['Tax as % of price', Fmt.pct(r.pct, 3)],
          ['Total annual tax', Fmt.usd(r.tax)],
          ['Total sale price', Fmt.usd(r.price)],
          ['Sales', Fmt.int(r.sales)],
        ]),
      })),
      format: (v) => `${v.toFixed(2)}%`,
      axisTitle: 'Total annual tax as a percent of total sale price',
    });
  });
}

/* -------------------------------- Q7 ------------------------------- */

function renderQ7() {
  const beds = Number(document.getElementById('q7-beds').value);
  const res = Analysis.q7(MODEL.data, beds);
  const w = res.winner;
  if (!w) {
    setAnswer('q7-answer', { lead: `No sales with ${beds} bedrooms in the price scope.`, empty: true });
    registerChart(() => Charts.empty(document.getElementById('q7-chart'), `No sales with ${beds} bedrooms fall in the price scope.`));
    return;
  }
  const missing = MODEL.meta.cities.filter((c) => !res.rows.some((r) => r.city === c));
  setAnswer('q7-answer', {
    lead: `For ${beds}-bedroom homes, ${w.city} has the lowest median sale price: ${Fmt.usd(w.median)} from ${Fmt.int(w.sales)} sales.`,
    detail: `${res.rows[1] ? `Next lowest ${res.rows[1].city} at ${Fmt.usd(res.rows[1].median)}, and the highest ${res.rows[res.rows.length - 1].city} at ${Fmt.usd(res.rows[res.rows.length - 1].median)}. ` : ''}` +
      `Across all ${Fmt.int(res.total)} ${beds}-bedroom sales in the price scope, buyers pay a median of ` +
      `${Fmt.usd(Analysis.median(res.rows.map((r) => r.median)))} across cities.` +
      (missing.length ? ` ${Fmt.list(missing)} ${missing.length === 1 ? 'has' : 'have'} no ${beds}-bedroom sale.` : ''),
  });
  setTable('q7-table',
    [{ key: 'city', label: 'City' }, { key: 'median', label: 'Median price', num: true }, { key: 'sales', label: 'Sales', num: true }],
    res.rows.map((r) => ({ city: r.city, median: Fmt.usd(r.median), sales: Fmt.int(r.sales) })),
    (r) => r.city === w.city);

  registerChart(() => {
    Charts.hbar(document.getElementById('q7-chart'), {
      data: res.rows.map((r) => ({
        label: r.city,
        value: r.median,
        highlight: r.city === w.city,
        tipHTML: Charts.tipHTML(r.city, [['Median price', Fmt.usd(r.median)], ['Sales', Fmt.int(r.sales)], ['Bedrooms', beds]]),
      })),
      format: Fmt.usdShort,
      axisTitle: `Median sale price, ${beds} bedrooms`,
    });
  });
}

/* -------------------------------- Q8 ------------------------------- */

function renderQ8() {
  const rawMin = Number(document.getElementById('q8-min').value);
  const rawMax = Number(document.getElementById('q8-max').value);
  const min = Number.isFinite(rawMin) ? rawMin : Analysis.LOW;
  const max = Number.isFinite(rawMax) ? rawMax : Analysis.HIGH;
  const res = Analysis.q8(MODEL.data, Math.min(min, max), Math.max(min, max));
  const w = res.winner;
  if (!w) {
    setAnswer('q8-answer', { lead: `No sales fall in ${Fmt.usd(res.range[0])} to ${Fmt.usd(res.range[1])} with both dates.`, empty: true });
    registerChart(() => Charts.empty(document.getElementById('q8-chart'), 'No sales in this price range have a listing and contract date.'));
    return;
  }
  const notes = [];
  if (max > Analysis.HIGH) notes.push(`the $5,000,000 scope cap overrides any higher maximum`);
  if (min < Analysis.LOW) notes.push(`the $10,000 scope floor overrides any lower minimum`);
  if (min > max) notes.push('the two limits were swapped');
  const tied = res.tied.length > 1 ? res.tied.map((t) => t.city) : [];

  setAnswer('q8-answer', {
    lead: tied.length
      ? `${Fmt.list(tied)} tie for the shortest median days on market, ${Fmt.days(w.median)}, for sales from ${Fmt.usd(res.range[0])} to ${Fmt.usd(res.range[1])}.`
      : `${w.city} has the shortest median days on market, ${Fmt.days(w.median)}, for sales from ${Fmt.usd(res.range[0])} to ${Fmt.usd(res.range[1])}.`,
    detail: `${tied.length ? `Each has ${Fmt.int(w.sales)} qualifying sales. ` : `That is from ${Fmt.int(w.sales)} qualifying sales. `}` +
      `Across all ${Fmt.int(res.total)} sales in the range the median is ${Fmt.days(Analysis.median(MODEL.data.filter((r) => r.price >= res.range[0] && r.price <= res.range[1]).map((r) => r.dom)))}. ` +
      `Slowest ${res.rows[res.rows.length - 1].city} at ${Fmt.days(res.rows[res.rows.length - 1].median)}.` +
      (notes.length ? ` Note: ${notes.join('; ')}.` : ''),
  });
  setTable('q8-table',
    [{ key: 'city', label: 'City' }, { key: 'median', label: 'Median days', num: true }, { key: 'sales', label: 'Sales used', num: true }],
    res.rows.map((r) => ({ city: r.city, median: Fmt.num(r.median, 1), sales: Fmt.int(r.sales) })),
    (r) => r.median === w.median);

  registerChart(() => {
    Charts.dotPlot(document.getElementById('q8-chart'), {
      data: res.rows.map((r) => ({
        label: r.city,
        value: r.median,
        highlight: r.median === w.median,
        tipHTML: Charts.tipHTML(r.city, [['Median days', Fmt.num(r.median, 1)], ['Sales used', Fmt.int(r.sales)]]),
      })),
      format: (v) => `${Math.round(v)}`,
      axisTitle: 'Median days from listing to accepted offer',
    });
  });
}

/* -------------------------------- Q9 ------------------------------- */

function renderQ9() {
  const city = document.getElementById('q9-city').value;
  const year = Number(document.getElementById('q9-year').value);
  const res = Analysis.q9(MODEL.data, city, year);
  if (!res.total) {
    setAnswer('q9-answer', { lead: `No sales with a sale date in ${city} in ${year}.`, empty: true });
    registerChart(() => Charts.empty(document.getElementById('q9-chart'), `No sales in ${city} closed in ${year}.`));
    return;
  }
  const peakNames = res.peakMonths.map(Fmt.month);
  const sorted = res.counts.map((c, i) => ({ m: i + 1, c })).sort((a, b) => b.c - a.c);
  setAnswer('q9-answer', {
    lead: `${peakNames.length === 1 ? peakNames[0] : Fmt.list(peakNames)} ${peakNames.length === 1 ? 'had' : 'tied for'} the most sales in ${city} in ${year}, with ${Fmt.int(res.peak)} of ${Fmt.int(res.total)} recorded sales.`,
    detail: `The quietest month was ${Fmt.month(sorted[sorted.length - 1].m)} with ${Fmt.int(sorted[sorted.length - 1].c)}. ` +
      `Sales peak in ${Fmt.list(peakNames.map((m) => Fmt.shortMonth(res.counts.indexOf(res.peak) + 1)))} and the three busiest months hold ` +
      `${Fmt.int(sorted.slice(0, 3).reduce((a, s) => a + s.c, 0))} sales, ${Fmt.pct(sorted.slice(0, 3).reduce((a, s) => a + s.c, 0) / res.total * 100, 1)} of the year. ` +
      `All rows with a sale date count, including prices outside the usual scope.`,
  });
  setTable('q9-table',
    [{ key: 'month', label: 'Month' }, { key: 'sales', label: 'Sales', num: true }, { key: 'share', label: 'Share of year', num: true }],
    res.counts.map((c, i) => ({ month: Fmt.month(i + 1), sales: Fmt.int(c), share: Fmt.pct(c / res.total * 100, 1) })),
    (r) => res.peakMonths.map(Fmt.month).includes(r.month));

  registerChart(() => {
    Charts.columns(document.getElementById('q9-chart'), {
      data: res.counts.map((c, i) => ({
        label: Fmt.shortMonth(i + 1),
        fullLabel: `${Fmt.month(i + 1)} ${year}`,
        value: c,
        highlight: res.peakMonths.includes(i + 1),
      })),
      format: (v) => Fmt.int(v),
      valueLabel: 'Sales',
      axisTitle: `Recorded sales by month, ${city}`,
    });
  });
}

/* -------------------------------- Q10 ------------------------------ */

function renderQ10() {
  const campus = document.getElementById('q10-campus').value;
  const budget = Number(document.getElementById('q10-budget').value);
  const minBeds = Number(document.getElementById('q10-beds').value);
  const res = Analysis.q10(MODEL.data, campus, Number.isFinite(budget) ? budget : Analysis.HIGH, Number.isFinite(minBeds) ? minBeds : 0);
  const budgetNote = budget > Analysis.HIGH ? ` (capped at the $5,000,000 scope maximum)` : '';
  if (!res.sales) {
    setAnswer('q10-answer', {
      lead: `No sales near ${CAMPUS_SHORT(campus)} at ${Fmt.usd(budget)} or less with at least ${minBeds} bedrooms.`,
      empty: true,
    });
    registerChart(() => Charts.empty(document.getElementById('q10-chart'), 'No sales match these settings. Try a higher budget or fewer bedrooms.'));
    return;
  }
  setAnswer('q10-answer', {
    lead: `With a budget of ${Fmt.usd(budget)}${budgetNote} and at least ${minBeds} bedroom${minBeds === 1 ? '' : 's'}, ` +
      `${Fmt.int(res.sales)} sales near ${CAMPUS_SHORT(campus)} qualify, and their median distance to campus is ${Fmt.miles(res.medianMiles)}.`,
    detail: `Those sales carry a median price of ${Fmt.usd(res.price)}. Straight-line distance to the ${CAMPUS_SHORT(campus)} campus landmark ranges from ` +
      `${Fmt.miles(Math.min(...res.miles))} to ${Fmt.miles(Math.max(...res.miles))}, and half of all qualifying homes sit within ` +
      `${Fmt.miles(res.medianMiles)} of it.`,
  });

  registerChart(() => {
    // 0.5-mile bins up to the rounded maximum.
    const maxMi = Math.max(1, Math.ceil(Math.max(...res.miles) * 2) / 2);
    const bins = [];
    for (let x = 0; x < maxMi; x += 0.5) bins.push({ x0: x, x1: x + 0.5, count: 0, highlight: false });
    for (const m of res.miles) {
      const b = Math.min(bins.length - 1, Math.floor(m / 0.5));
      bins[b].count++;
    }
    // Highlight the bin that holds the median, which is the value the answer names.
    const medBin = bins.find((b) => res.medianMiles >= b.x0 && res.medianMiles < b.x1);
    if (medBin) medBin.highlight = true;
    Charts.histogram(document.getElementById('q10-chart'), {
      data: bins,
      marker: res.medianMiles,
      markerLabel: `median ${res.medianMiles.toFixed(1)} mi`,
      binLabel: 'Miles',
      valueLabel: 'Sales',
      format: (v) => Fmt.int(v),
      axisTitle: `Miles from campus, ${Fmt.int(res.sales)} sales`,
    });
  });
}

/* ------------------------------ insights --------------------------- */

function renderInsights() {
  const res = Analysis.p1(MODEL.data);
  const o = res.overall;
  const s = res.slowest;
  const z = res.slowestZeroed;

  document.getElementById('p1-body').innerHTML =
    `<strong>The problem.</strong> In the price scope, ${Fmt.int(6123)} sales have no listing date and ` +
    `${Fmt.int(6475)} have no contract date, and only ${Fmt.int(28028)} of 35,371 sales carry both. A blank ` +
    `usually means the home sold off-market or was sold new by a builder, not that it sold in zero days. ` +
    `A spreadsheet formula that subtracts the dates and reads blanks as zero ` +
    `sends those sales to zero days. <strong>How I handled it.</strong> Days on market is contract date minus listing date, ` +
    `computed only where both dates exist and the gap is not negative. A blank is left blank and dropped from ` +
    `the median rather than counted as a zero. <strong>The effect.</strong> If blanks counted as zero days, ` +
    `the all-campus median would fall from ${Fmt.days(o.excluded)} to ${Fmt.days(o.zeroed)}. The damage lands ` +
    `unevenly. ${CAMPUS_SHORT(z.campus)} has no listing date for ${Fmt.pct(z.blankShare, 1)} of its sales, so it ` +
    `would read ${Fmt.days(z.zeroed)} instead of ${Fmt.days(z.excluded)}, a gap of ` +
    `${Fmt.num(z.excluded - z.zeroed, 1)} days. The ranking softens too: the slowest market, ` +
    `${CAMPUS_SHORT(s.campus)} at ${Fmt.days(s.excluded)}, would read ${Fmt.days(s.zeroed)} if blanks counted, ` +
    `so slow markets would look almost as quick as fast ones. Leaving blanks out keeps that gap honest and ` +
    `stops a data artifact from becoming a finding.`;

  setTable('p1-table',
    [{ key: 'campus', label: 'Campus area' }, { key: 'excluded', label: 'Median, blanks left out', num: true },
     { key: 'zeroed', label: 'Median, blanks as zero', num: true }, { key: 'share', label: 'No list date', num: true }],
    res.rows.map((r) => ({ campus: CAMPUS_SHORT(r.campus), excluded: Fmt.num(r.excluded, 1), zeroed: Fmt.num(r.zeroed, 1), share: Fmt.pct(r.blankShare, 1) })),
    (r) => r.campus === z.campus || r.campus === s.campus);

  registerChart(() => {
    Charts.grouped(document.getElementById('p1-chart'), {
      groups: res.rows.slice().sort((a, b) => b.blankShare - a.blankShare).slice(0, 6).map((r) => ({
        label: CAMPUS_SHORT(r.campus),
        a: r.zeroed,
        b: r.excluded,
        highlight: r.campus === z.campus,
      })),
      series: [
        { key: 'a', name: 'Blanks read as zero', cls: 'ghost-bar' },
        { key: 'b', name: 'Blanks left out', cls: 'is-answer' },
      ],
      format: (v) => `${Math.round(v)}`,
      axisTitle: 'Median days on market, six campus areas with the most missing listing dates',
    });
  });

  document.getElementById('p2-body').innerHTML = P2_TEXT;
}

/* ------------------------------ toc nav ---------------------------- */

function wireToc() {
  const links = [...document.querySelectorAll('.toc a')];
  const targets = links.map((a) => document.querySelector(a.getAttribute('href'))).filter(Boolean);
  if (!targets.length) return;
  const obs = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      links.forEach((l) => l.classList.toggle('is-active', l.getAttribute('href') === `#${e.target.id}`));
    }
  }, { rootMargin: '-20% 0px -65% 0px' });
  targets.forEach((t) => obs.observe(t));
}

document.addEventListener('DOMContentLoaded', boot);
