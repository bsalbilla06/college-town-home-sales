/* The P2 insight text. Kept apart from ui.js so it reads like prose
   rather than markup, and so the steps it describes can be traced in
   AGENT_LOG.md. */

const P2_TEXT = `
  A notebook gives me one answer at a time. I write a query, read the number, adjust a
  line, run it again. With a coding agent the loop changed: I described what should
  exist, and the agent produced a page that computes all ten answers from every row,
  charts included, far faster than I would have written the plotting code by hand. The
  surprise was the safety net. Asking for a reference script beside the site gave me two
  independent implementations, one in pandas and one in the browser, and running
  <code>node scripts/check_analysis.js</code> compares thirty-odd numbers between them.
  In a notebook I would have trusted the cell I had just edited.
  <br><br>
  It also made mistakes I had to catch, and catching them taught me the data. My first
  build used a $5,000,000 ceiling for Q2, which the assignment says to answer on all
  rows, and that changed which city looked most skewed away from its median. When I asked
  for Q3, the agent first reported that cities had changed rank when they had not,
  because it compared the two rankings in the wrong order. The most useful catch was
  smaller: the agent wrote that days on market uses only rows with both dates, but its
  code also accepted rows where the contract date came before the listing date, quietly
  adding negative day counts. Only the pandas comparison surfaced it. A check script is
  the part of the project I would keep either way.
  <br><br>
  I prefer the agent for building and the notebook for judging. When I wanted to know
  whether a number was right, I still reached for a few pandas lines, because one cell is
  quick to write and easy to read. When I wanted twenty charts that answer to a grader's
  own filters, the agent was far ahead. The split I would choose again is the agent
  building the product, a script holding the answers, and my own eyes on anything that
  looked too neat.
`;
