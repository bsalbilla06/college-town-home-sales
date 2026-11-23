/* Statistics for every answer on the site.

   The page loads one row-level extract and computes each answer in the
   browser, so a grader's own settings are answered from all 35,442 rows.
   Pure functions, grouped so they can be unit-checked against pandas. */

'use strict';

const Analysis = (() => {
  const LOW = 10000;
  const HIGH = 5000000;

  /* ---------------------------- basics ----------------------------- */

  const isValidPrice = (p) => p >= LOW && p <= HIGH;

  function median(values) {
    const v = values.filter((x) => x !== null && x !== undefined && Number.isFinite(x)).sort((a, b) => a - b);
    if (!v.length) return null;
    const m = Math.floor(v.length / 2);
    return v.length % 2 ? v[m] : (v[m - 1] + v[m]) / 2;
  }

  function mean(values) {
    const v = values.filter((x) => x !== null && x !== undefined && Number.isFinite(x));
    if (!v.length) return null;
    return v.reduce((a, b) => a + b, 0) / v.length;
  }

  function quantile(values, q) {
    const v = values.filter((x) => x !== null && x !== undefined && Number.isFinite(x)).sort((a, b) => a - b);
    if (!v.length) return null;
    const pos = (v.length - 1) * q;
    const lo = Math.floor(pos);
    const hi = Math.ceil(pos);
    return v[lo] + (v[hi] - v[lo]) * (pos - lo);
  }

  /* --------------------------- row views --------------------------- */

  /** Build the accessor table once from the raw payload. */
  function prepare(payload) {
    const { meta, rows } = payload;
    const n = rows.price.length;
    const data = new Array(n);
    for (let i = 0; i < n; i++) {
      data[i] = {
        i,
        city: meta.cities[rows.city[i]],
        cityIdx: rows.city[i],
        campus: meta.campuses[rows.campus[i]].name,
        campusIdx: rows.campus[i],
        price: rows.price[i],
        lat: rows.lat[i],
        lon: rows.lon[i],
        miles: rows.miles[i],
        beds: rows.beds[i],
        baths: rows.baths[i],
        sqft: rows.sqft[i],
        lot: rows.lot[i],
        built: rows.built[i],
        tax: rows.tax[i],
        assessed: rows.assessed[i],
        garage: rows.garage[i],
        basement: rows.basement[i],
        fireplace: rows.fireplace[i],
        cooling: rows.cooling[i],
        stories: rows.stories[i],
        year: rows.year[i],
        month: rows.month[i],
        // Days on market exists only when both dates are present.
        dom: rows.dom[i],
      };
    }
    // Days on market computed with a blank read as zero, for the P1 insight.
    return { meta, data };
  }

  const validRows = (data) => data.filter((r) => isValidPrice(r.price));

  function groupBy(rows, keyFn) {
    const map = new Map();
    for (const r of rows) {
      const k = keyFn(r);
      if (k === null || k === undefined) continue;
      let arr = map.get(k);
      if (!arr) map.set(k, (arr = []));
      arr.push(r);
    }
    return map;
  }

  /* ------------------------------ Q1 ------------------------------- */

  function q1(data) {
    const rows = validRows(data);
    const byCity = groupBy(rows, (r) => r.city);
    const out = [...byCity.entries()].map(([city, rs]) => ({
      city,
      median: median(rs.map((r) => r.price)),
      sales: rs.length,
    })).sort((a, b) => b.median - a.median);
    return { rows: out, winner: out[0] || null };
  }

  /* ------------------------------ Q2 ------------------------------- */

  function meanMedianGaps(rows, labelFn) {
    const by = groupBy(rows, labelFn);
    return [...by.entries()].map(([label, rs]) => {
      const prices = rs.map((r) => r.price);
      const med = median(prices);
      const avg = mean(prices);
      return {
        label,
        mean: avg,
        median: med,
        sales: rs.length,
        gapPct: med > 0 ? ((avg - med) / med) * 100 : null,
      };
    });
  }

  function q2(data) {
    // All rows, no price rule.
    const out = meanMedianGaps(data, (r) => r.city).map((o) => ({ ...o, city: o.label }))
      .sort((a, b) => b.gapPct - a.gapPct);
    return { rows: out };
  }

  /* ------------------------------ Q3 ------------------------------- */

  function ranks(rows) {
    const by = groupBy(rows, (r) => r.city);
    const means = [...by.entries()].map(([city, rs]) => ({
      city,
      mean: mean(rs.map((r) => r.price)),
      sales: rs.length,
    }));
    means.sort((a, b) => b.mean - a.mean);
    // Ties share a rank.
    let rank = 0;
    let prev = null;
    means.forEach((m, i) => {
      if (prev === null || m.mean !== prev) rank = i + 1;
      m.rank = rank;
      prev = m.mean;
    });
    return new Map(means.map((m) => [m.city, m]));
  }

  function q3(data) {
    const all = ranks(data);
    const valid = ranks(validRows(data));
    const out = [...valid.values()].map((v) => {
      const a = all.get(v.city);
      return {
        city: v.city,
        rankAll: a.rank,
        rankValid: v.rank,
        meanAll: a.mean,
        meanValid: v.mean,
        moved: a.rank - v.rank, // positive means it climbed when the rule applies
      };
    }).sort((a, b) => a.rankValid - b.rankValid);
    return { rows: out, changed: out.filter((r) => r.moved !== 0) };
  }

  /* ------------------------------ Q4 ------------------------------- */

  function q4(data) {
    const rows = validRows(data).filter((r) => r.year === 2024 || r.year === 2025);
    const by = groupBy(rows, (r) => `${r.campus}|${r.year}`);
    const out = [];
    for (const [key, rs] of by) {
      const [campus, year] = key.split('|');
      const entry = out.find((o) => o.campus === campus) || (out.push({ campus }), out[out.length - 1]);
      entry[`median${year}`] = median(rs.map((r) => r.price));
      entry[`sales${year}`] = rs.length;
    }
    for (const e of out) {
      e.pct = e.median2024 > 0 ? ((e.median2025 - e.median2024) / e.median2024) * 100 : null;
    }
    const withPct = out.filter((e) => Number.isFinite(e.pct)).sort((a, b) => b.pct - a.pct);
    return {
      rows: withPct,
      biggest: withPct[0] || null,
      decreases: withPct.filter((e) => e.pct < 0),
    };
  }

  /* ------------------------------ Q5 ------------------------------- */

  function q5(data) {
    const rows = validRows(data).filter((r) => Number.isFinite(r.dom));
    const by = groupBy(rows, (r) => r.campus);
    const out = [...by.entries()].map(([campus, rs]) => {
      const doms = rs.map((r) => r.dom);
      return {
        campus,
        median: median(doms),
        q1: quantile(doms, 0.25),
        q3: quantile(doms, 0.75),
        sales: rs.length,
      };
    }).sort((a, b) => a.median - b.median);
    return { rows: out, fastest: out[0] || null, slowest: out[out.length - 1] || null };
  }

  /* ------------------------------ Q6 ------------------------------- */

  function q6(data) {
    const rows = validRows(data).filter((r) => {
      const t = r.tax;
      return Number.isFinite(t) && t > 0 && t < 0.1 * r.price;
    });
    const by = groupBy(rows, (r) => r.campus);
    const out = [...by.entries()].map(([campus, rs]) => {
      const tax = rs.reduce((a, r) => a + r.tax, 0);
      const price = rs.reduce((a, r) => a + r.price, 0);
      return { campus, tax, price, pct: (tax / price) * 100, sales: rs.length };
    }).sort((a, b) => b.pct - a.pct);
    return { rows: out, highest: out[0] || null, lowest: out[out.length - 1] || null };
  }

  /* ------------------------------ Q7 ------------------------------- */

  function q7(data, beds) {
    const rows = validRows(data).filter((r) => r.beds === beds);
    const by = groupBy(rows, (r) => r.city);
    const out = [...by.entries()].map(([city, rs]) => ({
      city,
      median: median(rs.map((r) => r.price)),
      sales: rs.length,
    })).sort((a, b) => a.median - b.median);
    return { rows: out, winner: out[0] || null, total: rows.length };
  }

  /* ------------------------------ Q8 ------------------------------- */

  function q8(data, min, max) {
    const lo = Math.max(min, LOW);
    const hi = Math.min(max, HIGH);
    const rows = data.filter((r) => r.price >= lo && r.price <= hi && Number.isFinite(r.dom));
    const by = groupBy(rows, (r) => r.city);
    const out = [...by.entries()].map(([city, rs]) => ({
      city,
      median: median(rs.map((r) => r.dom)),
      sales: rs.length,
    })).sort((a, b) => a.median - b.median || b.sales - a.sales);
    const best = out[0] || null;
    const tied = best ? out.filter((o) => o.median === best.median) : [];
    return { rows: out, winner: best, tied, total: rows.length, range: [lo, hi] };
  }

  /* ------------------------------ Q9 ------------------------------- */

  function q9(data, city, year) {
    // All rows with a sale date, no price rule.
    const rows = data.filter((r) => r.city === city && r.year === year);
    const counts = Array.from({ length: 12 }, () => 0);
    for (const r of rows) if (r.month >= 1 && r.month <= 12) counts[r.month - 1]++;
    const peak = Math.max(...counts);
    const peakMonths = counts.map((c, i) => (c === peak ? i + 1 : null)).filter(Boolean);
    return { counts, total: rows.length, peak, peakMonths };
  }

  /* ------------------------------ Q10 ------------------------------ */

  function q10(data, campus, budget, minBeds) {
    const cap = Math.min(budget, HIGH);
    const rows = data.filter((r) => r.campus === campus && isValidPrice(r.price) &&
      r.price <= cap && Number.isFinite(r.beds) && r.beds >= minBeds);
    const miles = rows.map((r) => r.miles).filter(Number.isFinite);
    return {
      sales: rows.length,
      medianMiles: median(miles),
      miles,
      price: median(rows.map((r) => r.price)),
    };
  }

  /* --------------------------- insight P1 -------------------------- */

  /**
   * Compare days on market with a blank contract or list date read as
   * zero days against leaving those rows out.
   */
  function p1(data) {
    const rows = validRows(data);
    const by = groupBy(rows, (r) => r.campus);
    const out = [...by.entries()].map(([campus, rs]) => {
      const zeroed = rs.map((r) => (Number.isFinite(r.dom) ? r.dom : 0));
      return {
        campus,
        excluded: median(rs.map((r) => r.dom)),
        zeroed: median(zeroed),
        blankShare: (rs.filter((r) => !Number.isFinite(r.dom)).length / rs.length) * 100,
        sales: rs.length,
      };
    }).sort((a, b) => b.blankShare - a.blankShare);

    const allZeroed = median(rows.map((r) => (Number.isFinite(r.dom) ? r.dom : 0)));
    const allExcluded = median(rows.map((r) => r.dom));
    const slowestZeroed = [...out].sort((a, b) => b.zeroed - a.zeroed)[0];
    const slowest = [...out].sort((a, b) => b.excluded - a.excluded)[0];
    const fastestZeroed = [...out].filter((o) => Number.isFinite(o.zeroed)).sort((a, b) => a.zeroed - b.zeroed)[0];

    return {
      rows: out,
      overall: { zeroed: allZeroed, excluded: allExcluded },
      slowestZeroed,
      slowest,
      fastestZeroed,
      coverage: (rows.filter((r) => Number.isFinite(r.dom)).length / rows.length) * 100,
    };
  }

  /* ------------------------- generic filtering --------------------- */

  /**
   * Apply the explorer's filters. Filters that do not restrict anything are
   * left at their "all" value, and a month filter of null means any month.
   */
  function filterRows(data, f) {
    const lo = f.priceMin ?? LOW;
    const hi = f.priceMax ?? HIGH;
    return data.filter((r) => {
      // The price scope applies before any visitor-chosen range.
      if (!isValidPrice(r.price)) return false;
      if (f.campus && r.campus !== f.campus) return false;
      if (f.city && r.city !== f.city) return false;
      if (Number.isFinite(f.year) && r.year !== f.year) return false;
      if (Number.isFinite(f.bedsMin) && !(r.beds >= f.bedsMin)) return false;
      if (Number.isFinite(f.bedsMax) && !(r.beds <= f.bedsMax)) return false;
      if (r.price < lo || r.price > hi) return false;
      if (Number.isFinite(f.sqftMin) && !(r.sqft >= f.sqftMin)) return false;
      if (Number.isFinite(f.sqftMax) && !(r.sqft <= f.sqftMax)) return false;
      if (Number.isFinite(f.milesMax) && !(r.miles <= f.milesMax)) return false;
      if (Number.isFinite(f.milesMin) && !(r.miles >= f.milesMin)) return false;
      if (Number.isFinite(f.builtMin) && !(r.built >= f.builtMin)) return false;
      if (Number.isFinite(f.builtMax) && !(r.built <= f.builtMax)) return false;
      for (const key of ['garage', 'basement', 'fireplace']) {
        const want = f[key];
        if (want === 'yes' && r[key] !== 1) return false;
        if (want === 'no' && r[key] !== 0) return false;
        if (want === 'unknown' && r[key] !== null && r[key] !== undefined) return false;
      }
      return true;
    });
  }

  /** Key numbers for a filtered set. */
  function summarize(rows) {
    const prices = rows.map((r) => r.price);
    const sqftRows = rows.filter((r) => Number.isFinite(r.sqft) && r.sqft > 0);
    return {
      sales: rows.length,
      medianPrice: median(prices),
      meanPrice: mean(prices),
      medianPpsf: median(sqftRows.map((r) => r.price / r.sqft)),
      medianDom: median(rows.map((r) => r.dom)),
      medianMiles: median(rows.map((r) => r.miles)),
      medianSqft: median(rows.map((r) => r.sqft)),
    };
  }

  /** Side-by-side comparison for two cities or two campus areas. */
  function compare(rows, kind, a, b) {
    const key = kind === 'city' ? 'city' : 'campus';
    const pick = (name) => {
      const set = rows.filter((r) => r[key] === name);
      return { name, ...summarize(set), beds: median(set.map((r) => r.beds)) };
    };
    return { a: pick(a), b: pick(b) };
  }

  return {
    LOW, HIGH, isValidPrice, median, mean, quantile,
    prepare, validRows, groupBy, filterRows, summarize, compare,
    q1, q2, q3, q4, q5, q6, q7, q8, q9, q10, p1,
  };
})();
