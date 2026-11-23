# Agent log

Add a dated entry each time you work with your AI coding agent, with the newest entry at the bottom. Each entry records what you asked the agent, what it produced, and what you checked or changed. Paste your key prompts in exactly as you typed them. Include at least one time the agent got something wrong, and how you caught it.

Copy this outline for each entry:

```markdown
## YYYY-MM-DD: What you worked on

- **Asked:** "Paste your prompt here."
- **Agent produced:** What it made or changed.
- **Checked or changed:** How you checked it, and what you fixed.
```

---

## 2026-11-15: Repo setup and the market explorer site

- **Asked:** "Complete this assignment only using broswer use, do not use computer use:
  https://canvas.illinois.edu/courses/74173/assignments/1799408. I don't need you to sign up for
  GitHub education, you are my coding agent." Then, when offered a choice of site focus, I picked
  **Market explorer** and asked for `AGENT_LOG.md` to be filled in.
- **Agent produced:**
  - Created a public repository from the starter template: `bsalbilla06/college-town-home-sales`.
  - Turned on GitHub Pages with GitHub Actions as the source and ran the workflow once to confirm
    publishing works (the "Initial commit" run shows a red X, which the assignment says is expected).
  - Read `AGENTS.md` and `docs/data_description_sheet.md` before touching the data.
  - Wrote `scripts/build_site_data.py` (pandas) to derive `data/derived/site_data.json` from the CSV,
    with a stated price rule ($10,000 to $5,000,000), a guarded price-per-sq-ft, and days on market
    measured to contract date.
  - Replaced `index.html` with the explorer page, plus `styles.css` and a vanilla-JS `app.js`
    (Canvas scatter and bar chart, sortable table, campus/town filters).
  - Rewrote `README.md` with the site purpose, live URL, and data rules.
- **Checked or changed:**
  - Cross-checked the derived numbers against the description sheet: overall median $410,000 matches,
    and every city median matches the sheet's table (e.g. Urbana $229,900, Champaign $240,000,
    Davis $889,000). Row counts per city differ slightly from the sheet because the sheet counts all
    rows and the site drops implausible prices.
  - Loaded the page in a browser and clicked the filters. **The agent got one thing wrong:** the
    scatter's median annotation first read "median 1,200 sq ft, $410,000" — it took a middle element
    of the sorted square footage list and then looked up an unrelated price. I spotted the mismatch
    against the table, and the agent was asked to compute the two medians independently. It now reads
    the true medians (e.g. Urbana: $229,900 and 1,550 sq ft), which match the table.
  - Also had the agent state on the page how many dots fall outside the chart range, rather than
    silently dropping them.

---

## 2026-11-22: Part 2, the graded questions and the explorer

- **Asked:** "Ok now onto part 2: https://canvas.illinois.edu/courses/74173/assignments/1805936. DO NOT SUBMIT"
  Then, when offered a choice of scope: build the full 140-point version — ten answered questions with
  charts, two written insights, all ten required features, and several design rounds — in the existing
  repository.
- **Agent produced:** A pandas answer key (`scripts/answer_key.py`), a row-level extract and a
  browser statistics module (`analysis.js`), a new chart toolkit (`charts.js`), the analysis page
  (`index.html` + `ui.js`), the explorer (`explore.html` + `explore.js`), a theme toggle, three
  explorer insights (`insights.js`), a Node check script (`scripts/check_analysis.js`), and this
  rewrite of the README.
- **Checked or changed:** Every answer was compared with pandas. The failures below are the ones I
  caught while reviewing, and each is reproduced in the commit history.

### Mistakes the agent made, and how they were caught

1. **The price scope was wrong for Q2.** The first version applied the $10,000 to $5,000,000 rule to
   Q2, which the assignment says to answer on all rows. Caught by re-reading the question against the
   assignment's rules list. A second bug hid behind it: the "winner" field was never filled in for Q2.
2. **Q3 reported changes that did not happen.** The agent described cities moving rank in the wrong
   order. Caught by comparing its sentence against the table the same run had drawn. The ranking
   itself was right; only the narrative was wrong.
3. **Days on market kept negative gaps.** The code accepted rows where the contract date came before
   the listing date. Caught by the pandas comparison, which used the same filter and disagreed on 73
   rows.
4. **Chart labels were drawn inside the margin.** Horizontal bar charts put their bars at the edge of
   the SVG, so every city name was clipped. Caught by taking screenshots of the rendered page rather
   than trusting that the chart had drawn.
5. **A chart short-circuit hid the first paint.** A "not ready" guard I had added for a slow
   stylesheet made five charts draw once with no labels and never again. Caught by reading the
   rendered SVG, finding bars at x=0, and tracing which code path could produce them.
6. **One label per chart was cut off at the right edge**, and on a phone-length chart the value
   labels sat on top of each other. Caught by resizing to 390 px and looking at every chart again.
7. **The explorer crashed silently.** `Charts.bindTip` was never exported, so the map threw and the
   map, comparison, table and chart below it never drew. Caught only because the page was empty past
   the filters; the console then named the missing function.
8. **Nine wording or number slips in prose**, including "Illinois posts an 11-day median" when its
   median is 7 days, "55%" written as "5%", and a claim that Athens would stop being the slowest
   market, which is false because blank-as-zero also depresses every other slow market. Caught by
   printing the computed values beside each sentence and reading them one by one.

### What worked well

- Asking for a reference implementation in pandas before touching the page. Running
  `node scripts/check_analysis.js` takes a second and compared 37 numbers between the two code paths;
  it caught the negative-day-count bug and a stale cache of an older data file.
- Working in small rounds: get the answers right, then the controls, then the responsive layout, then
  the design passes, with a screenshot after each.
- Letting the agent write the insights prose but checking every figure in it against the table on
  the same page.

### Things I would do differently

- Take a screenshot of every chart on every change, not just the one I was editing; several layout
  bugs survived because I only re-checked the chart I had last touched.
- Ask the agent to build charts through one shared frame function from the start. The label-column bug
  existed in four separate chart types because each had its own copy of the same drawing code.
