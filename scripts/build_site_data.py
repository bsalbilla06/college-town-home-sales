#!/usr/bin/env python3
"""Build data/derived/site_data.json for the Part 2 site.

The page computes Q1-Q10 and every filter result in the browser from a
compact row-level extract, so graders can choose their own settings. This
script only shapes the extract; it does not precompute answers.

Rules (see docs/data_description_sheet.md and the assignment):
  * A valid price is $10,000 to $5,000,000 inclusive. This is a scope rule.
  * Campus area = `university`; city = city and state, e.g. "Champaign, IL".
  * Days on market = contract_date - list_date, only where both dates exist.
  * Year and month come from sale_date.
  * Rows are never dropped because two sales share an address.

Run: python3 scripts/build_site_data.py
"""
import json
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parent.parent
SRC = ROOT / "data" / "college_town_home_sales.csv"
OUT = ROOT / "data" / "derived" / "site_data.json"

LOW, HIGH = 10_000, 5_000_000

# Campus landmarks named in the data description sheet. Used for the map
# when the dataset itself has no campus coordinates.
CAMPUS = {
    "University of Illinois Urbana-Champaign": ("Illinois", 40.1059, -88.2272),
    "Purdue University": ("Purdue", 40.4308, -86.9137),
    "The University of Iowa": ("Iowa", 41.6622, -91.5365),
    "The University of North Carolina at Chapel Hill": ("North Carolina", 35.9049, -79.0460),
    "University of California, Davis": ("UC Davis", 38.5404, -121.7500),
    "University of Florida": ("Florida", 29.6500, -82.3430),
    "University of Georgia": ("Georgia", 33.9519, -83.3766),
    "University of Michigan": ("Michigan", 42.2768, -83.7379),
    "University of Virginia": ("Virginia", 38.0360, -78.5070),
    "The Pennsylvania State University": ("Penn State", 40.7982, -77.8599),
    "University of Wisconsin-Madison": ("Wisconsin", 43.0731, -89.4009),
}


def col(series, cast):
    """Round for size, keep nulls as None."""
    return [None if pd.isna(v) else cast(round(v, 4)) for v in series]


def main() -> None:
    df = pd.read_csv(SRC, dtype={"zipcode": str, "county_fips": str, "parcel_number": str})
    for c in ("sale_date", "list_date", "contract_date"):
        df[c] = pd.to_datetime(df[c], errors="coerce")

    df["city_full"] = df["city"] + ", " + df["state"]
    # Days on market: contract date minus listing date, only where both dates
    # exist. A negative gap means the two dates disagree, so it is dropped too.
    df["dom"] = (df["contract_date"] - df["list_date"]).dt.days.where(
        lambda d: d >= 0
    )
    df["year"] = df["sale_date"].dt.year
    df["month"] = df["sale_date"].dt.month

    # Compact categorical dictionaries keep the payload small.
    cities = sorted(df["city_full"].unique())
    campus = sorted(df["university"].unique())
    city_idx = {c: i for i, c in enumerate(cities)}
    campus_idx = {c: i for i, c in enumerate(campus)}

    rows = {
        "city": [city_idx[c] for c in df["city_full"]],
        "campus": [campus_idx[c] for c in df["university"]],
        "price": [int(v) for v in df["sale_price"]],
        "lat": col(df["latitude"], float),
        "lon": col(df["longitude"], float),
        "miles": col(df["miles_to_campus"], float),
        "beds": col(df["beds"], int),
        "baths": col(df["baths"], float),
        "sqft": col(df["living_area_sqft"], int),
        "lot": col(df["lot_size_sqft"], int),
        "built": col(df["year_built"], int),
        "tax": col(df["tax_annual_amount"], float),
        "assessed": col(df["tax_assessed_value"], int),
        "garage": col(df["has_garage"], int),
        "basement": col(df["has_basement"], int),
        "fireplace": col(df["has_fireplace"], int),
        "cooling": col(df["has_cooling"], int),
        "stories": col(df["stories"], int),
        "year": col(df["year"], int),
        "month": col(df["month"], int),
        "dom": col(df["dom"], int),
    }

    payload = {
        "meta": {
            "rows": int(len(df)),
            "low": LOW,
            "high": HIGH,
            "cities": cities,
            "campuses": [{"name": c, "short": CAMPUS.get(c, (c,))[0],
                          "lat": CAMPUS.get(c, (None, None, None))[1],
                          "lon": CAMPUS.get(c, (None, None, None))[2]} for c in campus],
            "date_min": df["sale_date"].min().strftime("%Y-%m-%d"),
            "date_max": df["sale_date"].max().strftime("%Y-%m-%d"),
            "years": sorted(int(y) for y in df["year"].dropna().unique()),
        },
        "rows": rows,
    }

    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(payload, separators=(",", ":")), encoding="utf-8")
    print(f"wrote {OUT.relative_to(ROOT)} ({OUT.stat().st_size:,} bytes)")
    print(f"{len(df):,} rows, {len(cities)} cities, {len(campus)} campus areas")


if __name__ == "__main__":
    main()
