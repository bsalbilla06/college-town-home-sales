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
