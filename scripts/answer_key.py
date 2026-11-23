#!/usr/bin/env python3
"""Compute every graded answer for the Part 2 site, independently of the site code.

This is a reference implementation used to check the figures the site shows.
It reads the read-only CSV and prints the answers for Q1-Q10 plus the
sensitivity tables used in the Insights section.

Run: python3 scripts/answer_key.py
"""
from pathlib import Path

import pandas as pd

ROOT = Path(__file__).resolve().parent.parent
CSV = ROOT / "data" / "college_town_home_sales.csv"

LOW, HIGH = 10_000, 5_000_000


def med(s):
    return float(pd.Series(s).median())


def main() -> None:
    df = pd.read_csv(
        CSV,
        dtype={"zipcode": str, "county_fips": str, "parcel_number": str},
    )
    for c in ("sale_date", "list_date", "contract_date"):
        df[c] = pd.to_datetime(df[c], errors="coerce")

    df["city"] = df["city"] + ", " + df["state"]
    df["dom"] = (df["contract_date"] - df["list_date"]).dt.days

    valid = df[(df.sale_price >= LOW) & (df.sale_price <= HIGH)].copy()
    valid["ppsf"] = valid.sale_price / valid.living_area_sqft

    print(f"all rows {len(df):,}   valid rows {len(valid):,}")

    # ---- Q1 -------------------------------------------------------------
    print("\n=== Q1  highest median sale price (valid rows) ===")
    q1 = valid.groupby("city").sale_price.median().sort_values(ascending=False)
    print(q1.round(0).to_string())
    print("ANSWER:", q1.index[0], f"${q1.iloc[0]:,.0f}")

    # ---- Q2 -------------------------------------------------------------
    print("\n=== Q2  mean vs median gap, ALL ROWS ===")
    g = df.groupby("city").sale_price.agg(["mean", "median", "count"])
    g["gap_pct"] = (g["mean"] - g["median"]) / g["median"] * 100
    g = g.sort_values("gap_pct", ascending=False)
    print(g.round(2).to_string())
    print("ANSWER:", g.index[0], f"{g.gap_pct.iloc[0]:.2f}%")

    # ---- Q3 -------------------------------------------------------------
    print("\n=== Q3  mean rank, all rows vs valid rows ===")
    ra = df.groupby("city").sale_price.mean().rank(ascending=False, method="min").astype(int)
    rb = valid.groupby("city").sale_price.mean().rank(ascending=False, method="min").astype(int)
    cmp = pd.DataFrame({"mean_all": df.groupby("city").sale_price.mean().round(0),
                        "mean_valid": valid.groupby("city").sale_price.mean().round(0),
                        "rank_all": ra, "rank_valid": rb})
    cmp["moved"] = cmp.rank_all - cmp.rank_valid
    print(cmp.sort_values("rank_valid").to_string())
    print("changed:", cmp[cmp.moved != 0].shape[0], "of", len(cmp))

    # ---- Q4 -------------------------------------------------------------
    print("\n=== Q4  percent change in median price, 2024 -> 2025 ===")
    y = valid.groupby(["university", valid.sale_date.dt.year]).sale_price.median().unstack()
    ch = ((y[2025] - y[2024]) / y[2024] * 100).sort_values(ascending=False)
    print(pd.DataFrame({"2024": y[2024].round(0), "2025": y[2025].round(0),
                        "pct": ch.round(2)}).to_string())
    print("ANSWER biggest:", ch.index[0], f"{ch.iloc[0]:.2f}%")
    print("decreases:", ch[ch < 0].round(2).to_dict())

    # ---- Q5 -------------------------------------------------------------
    print("\n=== Q5  median days on market by campus area ===")
    d = valid.dropna(subset=["list_date", "contract_date"]).groupby("university").dom.median().sort_values()
    print(d.to_string())
    print("ANSWER fastest:", d.index[0], d.iloc[0], " slowest:", d.index[-1], d.iloc[-1])

    # ---- Q6 -------------------------------------------------------------
    print("\n=== Q6  total annual tax / total sale price ===")
    t = valid[valid.tax_annual_amount.notna()].copy()
    t = t[(t.tax_annual_amount > 0) & (t.tax_annual_amount < 0.10 * t.sale_price)]
    r = (t.groupby("university").tax_annual_amount.sum() /
         t.groupby("university").sale_price.sum() * 100).sort_values(ascending=False)
    print(pd.DataFrame({"tax": t.groupby("university").tax_annual_amount.sum().round(0),
                        "price": t.groupby("university").sale_price.sum().round(0),
                        "pct": r.round(3)}).to_string())
    print("ANSWER highest:", r.index[0], f"{r.iloc[0]:.3f}%")
    print("ANSWER lowest:", r.index[-1], f"{r.iloc[-1]:.3f}%")

    # ---- Q7-Q10 sample settings ------------------------------------------
    print("\n=== Q7  3 bedrooms, lowest median price ===")
    b = valid[valid.beds == 3]
    q7 = b.groupby("city").sale_price.agg(["median", "count"]).sort_values("median")
    print(q7.head(5).to_string())
    print("ANSWER:", q7.index[0], f"${q7.iloc[0]['median']:,.0f}")

    print("\n=== Q8  $200,000-$400,000, shortest median days on market ===")
    p = valid[(valid.sale_price >= 200_000) & (valid.sale_price <= 400_000)].dropna(
        subset=["list_date", "contract_date"])
    q8 = p.groupby("city").dom.agg(["median", "count"]).sort_values("median")
    print(q8.head(5).to_string())
    print("ANSWER:", q8.index[0], q8.iloc[0]["median"])

    print("\n=== Q9  Champaign, IL 2025 sales by month (all rows) ===")
    c = df[(df.city == "Champaign, IL") & (df.sale_date.dt.year == 2025)]
    m = c.sale_date.dt.month.value_counts().reindex(range(1, 13), fill_value=0)
    print(m.to_string())
    print("ANSWER peak month:", m.idxmax(), m.max(), " total:", m.sum())

    print("\n=== Q10  Illinois, budget $400,000, min 3 beds ===")
    s = valid[(valid.university == "University of Illinois Urbana-Champaign")
              & (valid.sale_price <= 400_000) & (valid.beds >= 3)]
    print("count:", len(s), " median miles:", round(s.miles_to_campus.median(), 2))

    # ---- Insights sensitivity --------------------------------------------
    print("\n=== INSIGHT P1  blank list_date treated as zero days ===")
    withz = valid.copy()
    withz["dom"] = (withz.contract_date - withz.list_date).dt.days.fillna(0)
    a = withz.groupby("university").dom.median()
    b2 = valid.dropna(subset=["list_date", "contract_date"]).groupby("university").dom.median()
    share = withz.groupby("university").dom.apply(
        lambda s: (s == 0).sum() / len(s) * 100
    )
    tbl = pd.DataFrame({"blank_as_zero": a, "blank_excluded": b2, "no_list_date_pct": share}).sort_values(
        "no_list_date_pct", ascending=False
    )
    print(tbl.round(2).to_string())
    print("overall median blank-as-zero:", withz.dom.median(),
          " blank-excluded:", b2.median())
    print("Q2 detail, Athens all rows:", g.loc["Athens, GA"][["mean", "median"]].round(0).to_dict())
    p = df[df.city == "Athens, GA"].sale_price
    print("  over $5M count:", int((p > HIGH).sum()), " their values:", sorted(int(x) for x in p[p > HIGH]))
    print("  mean after dropping >$5M:", round(valid[valid.city == "Athens, GA"].sale_price.mean(), 0))
    print("Q3 detail, Athens ranks:",
          "all", int(ra["Athens, GA"]), "valid", int(rb["Athens, GA"]),
          "| Madison", int(ra["Madison, WI"]), "->", int(rb["Madison, WI"]),
          "| State College", int(ra["State College, PA"]), "->", int(rb["State College, PA"]))


if __name__ == "__main__":
    main()
