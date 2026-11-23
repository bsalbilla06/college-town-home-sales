/* Explorer insights. Each one adds something a price ranking alone hides:
   the commute, the tax bill, and the wait from listing to closing. */

const INSIGHTS_TEXT = {
  proximity: `
    Distance to campus is the quiet variable behind every price in this dataset. A family
    that needs three bedrooms and can spend $400,000 near the Illinois campus finds 2,601
    qualifying sales, and half of them sit within 2.8 miles of the Main Quad. The cheapest
    cities are also the ones closest to campus: Urbana's median is $229,900 at a median
    2.2 miles, while Davis, the most expensive at $889,000, sits 2.0 miles out. Spatial
    position alone therefore does not explain a city's price level; local demand does.
    What the rows do show is that distance is a constraint on what is for sale rather than
    a discount a buyer can bank. Only 5% of qualifying sales sit within a mile of campus,
    and those homes are older and smaller than the rest: a median build year of 1940
    against 1983, and 1,778 square feet against 1,920. In most towns the pattern holds,
    though Madison and West Lafayette keep larger houses close in. The buyer's real
    trade-off is between a short walk and a larger, newer house further out, and it bites
    hardest where land beside campus is already built up.
  `,

  tax: `
    Tax rates vary more between states than house prices do between towns, and the
    difference compounds every year a family owns. Summed over the qualifying sales, annual
    property tax runs 1.93% of sale price around the Illinois campus, the highest of the
    eleven areas, against 0.63% at Purdue, the lowest, a gap of about three to one. On a
    median Illinois home near campus, priced at $245,000, that difference is roughly $3,000
    a year, or $30,000 over ten years, which is more than one year's median price growth in
    any city here. The pattern does not follow the price ranking. Penn State and Iowa pay
    well under 1% while their medians sit near the middle, and Wisconsin pays 1.43% despite
    a median of $421,000. A buyer comparing two offers should therefore compare the annual
    bill, not only the asking price. It is the one number in this dataset that keeps
    changing long after the sale closes.
  `,

  timing: `
    Days on market is the number buyers and sellers quote most, but the assignment's rule
    measures listing to accepted offer. That is not when money changes hands. Adding the
    contract-to-close step roughly quadruples the wait: across the qualifying sales, the
    median from listing to closing is 50 days, against 11 days to the accepted offer. About
    55% of homes were under contract within 30 days, yet half still took nearly a full
    extra month to close. The gap matters most in fast markets, where it looks small as a
    percentage. Illinois and three other campus areas post a 7-day median to contract, and
    every one of those sales still went through financing, appraisal and title work first.
    For a buyer with a lease ending in June, the market's speed is only part of the
    timeline, and a seller should plan closing dates from contract, not from listing.
    Treating the two steps as one number would understate how long a move actually takes
    near campus.
  `,
};
