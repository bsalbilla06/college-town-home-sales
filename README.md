# College-Town Home Sales: Analysis and Explorer

A public website that answers ten questions about home prices near 11 US college campuses,
computed from 35,442 recorded sales, plus an explorer for browsing the same data yourself.

**Live site:** https://bsalbilla06.github.io/college-town-home-sales/

| Page | What it does |
|---|---|
| [`index.html`](index.html) | Ten answered questions (Q1 to Q10), two written insights, and a data-and-methods section |
| [`explore.html`](explore.html) | Filters, a campus and city map, a side-by-side comparison, a sortable table, and a price distribution |

## What the site answers

Each question below has a written answer and a chart. Questions 7 to 10 recompute from whatever
settings a visitor chooses.

| Q | Question | Answer as the site opens |
|---|---|---|
| Q1 | Highest median sale price by city | Davis, CA at $889,000 |
| Q2 | Mean furthest above median (all rows) | Athens, GA, 32.80% above its median |
| Q3 | Cities that change mean rank under the price rule | Madison +1, State College +1, Athens −2 |
| Q4 | Percent change in median price, 2024 to 2025 | Largest rise Illinois +7.55%; falls at UC Davis and North Carolina |
| Q5 | Median days on market by campus | Fastest 7 days (four-way tie); slowest Georgia at 27 |
| Q6 | Total annual tax as a percent of total sale price | Highest Illinois 1.93%, lowest Purdue 0.63% |
| Q7 | Lowest median price for an exact bedroom count | Champaign, IL at $215,000 for 3 bedrooms |
| Q8 | Fastest city within a price range | For $200,000 to $400,000, three cities tie at 6 days |
| Q9 | Sales by month for a chosen city and year | Champaign, IL, 2025: June peaks at 86 of 717 |
| Q10 | Median distance to campus at a budget and bedroom floor | Illinois, $400,000, 3+ bedrooms: 2.8 miles from 2,601 sales |

## How it is built

Plain HTML, CSS and JavaScript, with hand-drawn SVG charts and no framework or build step, so the
template's GitHub Pages workflow publishes the repository as it is. The site is a single
row-level extract (`data/derived/site_data.json`) loaded once, after which every answer and every
filter is computed in the browser. That is what lets a grader choose their own settings for Q7 to
Q10 and get an answer from all 35,442 rows.

| File | Role |
|---|---|
| `scripts/build_site_data.py` | Shapes the extract from the dataset; run once, committed |
| `analysis.js` | Medians, ranks, groupings and the ten answers as pure functions |
| `charts.js` | The SVG chart toolkit: bars, slope chart, dot plot, columns, histogram |
| `ui.js` / `explore.js` | Page wiring for the analysis page and the explorer |
| `scripts/answer_key.py` | The same answers computed with pandas, for checking |
| `scripts/check_analysis.js` | Compares 37 numbers between the site code and the pandas results |

To check a number:

```sh
python3 scripts/build_site_data.py      # rebuild the extract
node scripts/check_analysis.js          # compare site code against pandas answers
python3 scripts/answer_key.py           # print every answer with its inputs
```

## Rules applied

- **Price scope:** sales from $10,000 to $5,000,000 inclusive, 35,371 of 35,442 rows. Q2, Q3 and Q9
  also use all rows, as their questions ask.
- **Days on market:** contract date minus listing date, only where both exist and the gap is not
  negative. A blank date is never read as zero.
- **Missing values** are left out of every statistic and never filled with zero. The feature filters
  treat a blank as *Unknown*.
- **No de-duplication by address.** 66 rows share a street address, mostly condo units in one State
  College building; each has its own `listing_id` and is kept.
- **Medians**, not means, unless a question asks for the mean.

## Coding agent

Built with **OpenCode** running **DeepSeek V4.1 Flash** on the author's computer. Every step and
the mistakes the agent made are recorded in [`AGENT_LOG.md`](AGENT_LOG.md).

## Citation

College-town home sales dataset, version 1.0 (2026). University of Illinois-Deloitte Foundation
Center for Business Emerging Technologies. Data collected March 2026.
