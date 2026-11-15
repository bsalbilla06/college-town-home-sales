# College-Town Home Sales Explorer

An interactive website built from the college-town home sales dataset: 35,442 recorded sales around
11 university campuses in 18 college towns, collected March 2026.

## What this site is for

For anyone sizing up a college town — a student's family, a first-time buyer, or someone comparing
campuses — the site answers one plain question in a few views: **what does a home cost near campus,
and how long does it take to sell?**

The page combines:

- **Four headline figures:** median sale price, median price per square foot, median days on market,
  and the share of sales within 3 miles of a campus.
- **A sortable city table:** 18 towns with sales count, median price, median price per sq ft, median
  size, median days on market, median distance to campus, and the share of sales within 3 miles.
- **A scatter of every kept sale:** living area against sale price, filterable by campus and town,
  with median guide lines for the current filter.
- **A yearly trend:** median sale price for sales closing in 2023, 2024, 2025 and the part of 2026
  in the file.

## Live site

https://bsalbilla06.github.io/college-town-home-sales/

## Data notes

The page is built from `data/derived/site_data.json`, regenerated from the raw CSV by
`scripts/build_site_data.py`. The five original dataset files are untouched.

Rules applied, and stated on the page:

- **Prices:** sales from $10,000 to $5,000,000 are kept. This drops 40 sales under $10,000 (one at
  $0) and 31 over $5,000,000 (up to $81,510,000). **35,371 of 35,442 rows are kept.**
- **Price per sq ft:** only on rows with `living_area_sqft > 0` (127 rows report zero square feet).
- **Days on market:** `contract_date - list_date`, the standard listing-to-accepted-offer measure,
  not listing to closing. Only rows with both dates are used (79.2% of kept sales); a blank is not
  treated as zero. Rows where the contract date precedes the listing date are also dropped from this
  measure.
- **No address de-duplication.** 66 rows share a street address, mostly condo units in one State
  College building; each has its own `listing_id` and is a real sale.
- **`home_type` is not used.** The source labels nearly every row "single family", so it is not
  trustworthy for grouping.
- **Medians everywhere.** Means would be distorted by the long upper tail (mostly in the size and
  distance columns), so every figure is a median.
- **Distance** is straight-line miles to the campus landmark, never driving distance.
- **2026 is partial:** the file ends 2026-03-25.

## Tools we used

- OpenCode as the coding agent (driving GitHub through the browser: template, repository, Pages,
  About link).
- Plain HTML, CSS and JavaScript with the Canvas API, no libraries or build step, so the template's
  `pages.yml` publishes the repository as is.
- Python with pandas in `scripts/build_site_data.py` to compute the aggregates once at build time.

## Citation

College-town home sales dataset, version 1.0 (2026). University of Illinois-Deloitte Foundation
Center for Business Emerging Technologies. Data collected March 2026.
