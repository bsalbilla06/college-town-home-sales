/* Check the browser statistics against scripts/answer_key.py.

   Runs under Node: it loads the same data and analysis code the page
   uses, then compares a fixed set of answers. Any mismatch exits non-zero.

   Run: node scripts/check_analysis.js
*/
'use strict';

const fs = require('fs');
const path = require('path');
const vm = require('vm');

const root = path.join(__dirname, '..');
const read = (p) => fs.readFileSync(path.join(root, p), 'utf8');

const sandbox = { window: {}, document: {}, console };
vm.createContext(sandbox);
vm.runInContext(read('analysis.js'), sandbox);
const A = sandbox.Analysis || vm.runInContext("Analysis", sandbox);

const payload = JSON.parse(read('data/derived/site_data.json'));
const { data } = A.prepare(payload);

// Expected values come from scripts/answer_key.py (pandas), not from the site.
const expected = [
  ['Q1 winner city', A.q1(data).winner.city, 'Davis, CA'],
  ['Q1 winner median', A.q1(data).winner.median, 889000],
  ['Q1 Urbana median', A.q1(data).rows.find((r) => r.city === 'Urbana, IL').median, 229900],
  ['Q2 winner city', A.q2(data).winner.city, 'Athens, GA'],
  ['Q2 winner gap', +A.q2(data).winner.gapPct.toFixed(2), 32.8],
  ['Q3 changed count', A.q3(data).changed.length, 3],
  ['Q3 Athens ranks', A.q3(data).rows.find((r) => r.city === 'Athens, GA').rankAll + '->' +
    A.q3(data).rows.find((r) => r.city === 'Athens, GA').rankValid, '9->11'],
  ['Q4 biggest campus', A.q4(data).biggest.campus, 'University of Illinois Urbana-Champaign'],
  ['Q4 biggest pct', +A.q4(data).biggest.pct.toFixed(2), 7.55],
  ['Q4 decreases', A.q4(data).decreases.map((d) => d.campus).sort().join('|'),
    ['University of California, Davis', 'The University of North Carolina at Chapel Hill'].sort().join('|')],
  ['Q5 fastest', A.q5(data).fastest.median, 7],
  ['Q5 slowest campus', A.q5(data).slowest.campus, 'University of Georgia'],
  ['Q5 slowest median', A.q5(data).slowest.median, 27],
  ['Q6 highest', A.q6(data).highest.campus, 'University of Illinois Urbana-Champaign'],
  ['Q6 highest pct', +A.q6(data).highest.pct.toFixed(3), 1.93],
  ['Q6 lowest', A.q6(data).lowest.campus, 'Purdue University'],
  ['Q6 lowest pct', +A.q6(data).lowest.pct.toFixed(3), 0.63],
  ['Q7 3-bed winner', A.q7(data, 3).winner.city, 'Champaign, IL'],
  ['Q7 3-bed median', A.q7(data, 3).winner.median, 215000],
  ['Q7 3-bed count', A.q7(data, 3).winner.sales, 1106],
  ['Q8 200k-400k shortest', A.q8(data, 200000, 400000).winner.median, 6],
  ['Q8 200k-400k ties', A.q8(data, 200000, 400000).tied.length, 3],
  ['Q9 Champaign 2025 peak month', A.q9(data, 'Champaign, IL', 2025).peakMonths.join(','), '6'],
  ['Q9 Champaign 2025 peak sales', A.q9(data, 'Champaign, IL', 2025).peak, 86],
  ['Q9 Champaign 2025 total', A.q9(data, 'Champaign, IL', 2025).total, 717],
  ['Q10 Illinois 400k 3-bed count', A.q10(data, 'University of Illinois Urbana-Champaign', 400000, 3).sales, 2601],
  ['Q10 Illinois 400k 3-bed median miles', +A.q10(data, 'University of Illinois Urbana-Champaign', 400000, 3).medianMiles.toFixed(2), 2.8],
  ['P1 overall zeroed', A.p1(data).overall.zeroed, 6],
  ['P1 overall excluded', A.p1(data).overall.excluded, 11],
  ['P1 valid sales with a day count', data.filter((r) => A.isValidPrice(r.price) && Number.isFinite(r.dom)).length, 28028],
  ['P1 most blanks', A.p1(data).rows[0].campus, 'The University of Iowa'],
  // The stated price rule is inclusive at both ends.
  ['$400,000 budget includes $400,000', A.filterRows(data, { priceMin: 10000, priceMax: 400000 }).some((r) => r.price === 400000), true],
  ['$6,000,000 budget still capped at $5M', A.filterRows(data, { priceMin: 10000, priceMax: 6000000 }).every((r) => r.price <= 5000000), true],
  ['$5,000,000 sale is in scope', A.isValidPrice(5000000), true],
  ['$5,000,001 sale is out of scope', A.isValidPrice(5000001), false],
  ['$9,999 sale is out of scope', A.isValidPrice(9999), false],
  ['$10,000 sale is in scope', A.isValidPrice(10000), true],
];

// Boundary checks on the stated rules live in the list above.

let failures = 0;
for (const [name, got, want] of expected) {
  const ok = String(got) === String(want);
  if (!ok) failures++;
  console.log(`${ok ? 'ok  ' : 'FAIL'}  ${name}: ${got}${ok ? '' : `  (expected ${want})`}`);
}
console.log(failures ? `\n${failures} failure(s)` : '\nAll checks passed.');
process.exit(failures ? 1 : 0);
