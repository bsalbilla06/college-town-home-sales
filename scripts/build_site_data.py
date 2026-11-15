#!/usr/bin/env python3
"""Build data/derived/site_data.json from data/college_town_home_sales.csv.

The page shows three views:
  1. Every home sale we kept, as one dot on a price x living-area scatter.
  2. A city table with median price, price per sq ft, days on market and
     distance to campus.
  3. A price trend by year over the sale dates in the file.

Rules applied here, and stated on the page:
  * Drop sales under $10,000 (40 rows, including one at $0) and sales over
    $5,000,000 (31 rows up to $81.5M) as implausible. 35,371 of 35,442 kept.
  * Price per sq ft only on living_area_sqft > 0.
  * Days on market only where both list_date and contract_date are filled
    (the contract date, not the closing date).
  * Never deduplicate by address; listing_id is the key.

Run: python3 scripts/build_site_data.py
"""
import json
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "data" / "college_town_home_sales.csv"
OUT = ROOT / "data" / "derived" / "site_data.json"

MIN_PRICE, MAX_PRICE = 10_000, 5_000_000

COLUMNS = [
    "listing_id", "city", "state", "university", "miles_to_campus",
    "sale_date", "list_date", "contract_date", "sale_price", "beds", "baths",
    "living_area_sqft", "year_built",
]


def main() -> None:
    raw = pd.read_csv(SRC, dtype={"zipcode": str, "county_fips": str, "parcel_number": str})
    n_raw = len(raw)

    for col in ("sale_date", "list_date", "contract_date"):
        raw[col] = pd.to_datetime(raw[col], errors="coerce")

    kept = raw[(raw.sale_price >= MIN_PRICE) & (raw.sale_price <= MAX_PRICE)].copy()
    kept["dom"] = (kept.contract_date - kept.list_date).dt.days.where(
        lambda s: s >= 0
    )
    kept["ppsf"] = (kept.sale_price / kept.living_area_sqft.where(kept.living_area_sqft > 0)).round(1)
    kept["sale_year"] = kept.sale_date.dt.year

    # --- city table -------------------------------------------------------
    cities = []
    for (city, state), g in kept.groupby(["city", "state"]):
        uni = g.university.mode().iloc[0]
        cities.append({
            "city": city,
            "state": state,
            "university": uni,
            "sales": int(len(g)),
            "median_price": int(g.sale_price.median()),
            "median_ppsf": round(float(g.ppsf.median()), 0),
            "median_dom": int(g.dom.median()) if g.dom.notna().any() else None,
            "dom_share": round(float(g.dom.notna().mean()) * 100, 1),
            "median_miles": round(float(g.miles_to_campus.median()), 2),
            "median_sqft": int(g.living_area_sqft.median()),
            "median_year_built": int(g.year_built.median()),
            "share_under_3_mi": round(float((g.miles_to_campus < 3).mean()) * 100, 1),
        })
    cities.sort(key=lambda c: c["median_price"])

    # --- yearly medians ---------------------------------------------------
    yearly = []
    for year, g in kept.groupby("sale_year"):
        yearly.append({
            "year": int(year),
            "sales": int(len(g)),
            "median_price": int(g.sale_price.median()),
        })

    # --- scatter points (kept sales with a usable living area) ------------
    pts = kept[kept.living_area_sqft.between(200, 8000)]
    points = {
        "sqft": pts.living_area_sqft.astype(int).tolist(),
        "price": pts.sale_price.astype(int).tolist(),
        "beds": pts.beds.fillna(0).astype(int).tolist(),
        "city": pts.city.tolist(),
    }

    payload = {
        "meta": {
            "rows_total": int(n_raw),
            "rows_kept": int(len(kept)),
            "rows_dropped_low": int((raw.sale_price < MIN_PRICE).sum()),
            "rows_dropped_high": int((raw.sale_price > MAX_PRICE).sum()),
            "min_price": MIN_PRICE,
            "max_price": MAX_PRICE,
            "date_min": kept.sale_date.min().strftime("%Y-%m-%d"),
            "date_max": kept.sale_date.max().strftime("%Y-%m-%d"),
            "cities": len(cities),
            "campuses": int(kept.university.nunique()),
            "median_price": int(kept.sale_price.median()),
            "median_ppsf": round(float(kept.ppsf.median()), 0),
            "median_dom": int(kept.dom.median()),
            "p90_dom": int(kept.dom.quantile(0.9)),
            "dom_coverage": round(float(kept.dom.notna().mean()) * 100, 1),
            "overall_share_under_3_mi": round(float((kept.miles_to_campus < 3).mean()) * 100, 1),
        },
        "cities": cities,
        "yearly": yearly,
        "points": points,
    }

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(payload, separators=(",", ":")))
    print(f"wrote {OUT.relative_to(ROOT)} ({OUT.stat().st_size:,} bytes)")
    print(f"kept {len(kept):,} of {n_raw:,} rows, {len(cities)} cities")


if __name__ == "__main__":
    main()
