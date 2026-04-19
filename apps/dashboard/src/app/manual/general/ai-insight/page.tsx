import { Screenshot } from '@/components/manual/Screenshot';
import { Callout } from '@/components/manual/Callout';
import { Steps, Step } from '@/components/manual/Steps';

export default function AiInsightPage() {
  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <h1 className="text-2xl font-bold" style={{ color: '#1F4E79' }}>
        How to Use AI Insight
      </h1>

      <p className="text-base text-foreground">
        The <strong>AI Insight Engine</strong> is your built-in analyst. It reads every number,
        chart, and table on a page section, then tells you what is going well and what needs
        attention &mdash; in plain language.
      </p>

      <p className="text-base text-foreground">
        AI Insight is available on the <strong>Payment Collection</strong>,{' '}
        <strong>Sales Report</strong>, <strong>Financial Statements</strong>, and other pages.
        Each page is split into sections, and each section has its own AI analysis.
      </p>

      <Callout type="warning" title="Do not navigate away during analysis">
        Once you click <strong>Analyze</strong>, stay on the page until the analysis completes.
        Navigating to another page will disconnect the progress display. The analysis will still
        finish in the background, but you may see a &ldquo;currently running&rdquo; message if you
        return and try to run it again. Wait 1&ndash;3 minutes and try again.
      </Callout>

      {/* ─── Opening the AI Panel ─── */}

      <h2 className="text-xl font-semibold text-foreground">Opening the AI Panel</h2>

      <p className="text-base text-foreground">
        Every section has a <strong>&ldquo;Get Insight&rdquo;</strong> button in the top-right
        corner of its header bar. Click it to expand or collapse the AI panel.
      </p>

      <Screenshot
        src="/manual/ai-insight/ai-panel-collapsed.png"
        alt="Section header with Get Insight button"
        caption="Click 'Get Insight' to expand the AI panel below the section header."
      />

      {/* ─── Running an Analysis ─── */}

      <h2 className="text-xl font-semibold text-foreground">Running an Analysis</h2>

      <Steps>
        <Step number={1} title="Expand the AI Panel">
          Click <strong>&ldquo;Get Insight&rdquo;</strong> on the section you want to analyze.
          The panel opens below the header.
        </Step>
        <Step number={2} title="Set your date range">
          Make sure the date range at the top of the page covers the period you want analyzed.
          The AI will use whatever date range is currently selected.
        </Step>
        <Step number={3} title="Click Analyze">
          Click the blue <strong>Analyze</strong> button in the bottom-right corner of the panel.
          You will see a live progress log as each metric is analyzed.
        </Step>
        <Step number={4} title="Wait for results">
          Analysis typically takes <strong>1&ndash;3 minutes</strong>. Each component is analyzed
          individually, then a summary is generated. Do not leave the page.
        </Step>
      </Steps>

      <Callout type="tip" title="Cost and tokens">
        Each analysis costs approximately $0.03&ndash;0.05 and uses 30,000&ndash;40,000 tokens.
        The exact cost and token count are shown in the footer after analysis completes.
      </Callout>

      {/* ─── Reading the Results ─── */}

      <h2 className="text-xl font-semibold text-foreground">Reading the Results</h2>

      <p className="text-base text-foreground">
        When analysis completes, the panel shows a <strong>two-column layout</strong>:
      </p>

      <ul className="list-disc list-inside space-y-2 text-base text-foreground">
        <li>
          <strong>POSITIVE</strong> (left, green) &mdash; Things going well in your business
        </li>
        <li>
          <strong>NEGATIVE</strong> (right, red) &mdash; Areas that need attention
        </li>
      </ul>

      <p className="text-base text-foreground">
        Each card shows a <strong>title</strong>, a <strong>metric badge</strong> (the key number),
        and a one-line preview. Up to 3 cards per column, ranked by business impact.
      </p>

      <Screenshot
        src="/manual/ai-insight/ai-panel-results.png"
        alt="AI panel showing positive and negative insights"
        caption="The AI panel with results: positive insights on the left, negative on the right."
      />

      <p className="text-base text-foreground">
        The footer shows analysis metadata: date range analyzed, time taken, tokens used, cost,
        last updated timestamp, and who ran the analysis.
      </p>

      {/* ─── Opening the Detail Dialog ─── */}

      <h2 className="text-xl font-semibold text-foreground">Opening the Detail Dialog</h2>

      <p className="text-base text-foreground">
        Click any insight card to open a <strong>full-screen detail dialog</strong>. This is the
        complete analyst report with:
      </p>

      <ul className="list-disc list-inside space-y-2 text-base text-foreground">
        <li>
          <strong>Overall Performance</strong> &mdash; The headline metric with supporting numbers
        </li>
        <li>
          <strong>Key Observations</strong> &mdash; A data table with specific metrics and values
        </li>
        <li>
          <strong>Trend Analysis</strong> &mdash; What direction things are moving
        </li>
        <li>
          <strong>Business Context</strong> &mdash; Why this matters for your operations
        </li>
        <li>
          <strong>Conclusion</strong> &mdash; A one-line bottom-line assessment
        </li>
      </ul>

      <Screenshot
        src="/manual/ai-insight/ai-panel-dialog.png"
        alt="Insight detail dialog showing full analysis"
        caption="Click any card to see the full analyst report with tables and evidence."
      />

      <p className="text-base text-foreground">
        The dialog header is <strong>green</strong> for positive insights and{' '}
        <strong>red</strong> for negative insights. Click the <strong>&times;</strong> button or
        click outside the dialog to close it.
      </p>

      {/* ─── Individual Component Analysis ─── */}

      <h2 className="text-xl font-semibold text-foreground">
        Individual Component Analysis
      </h2>

      <p className="text-base text-foreground">
        Every KPI card, chart, and table on the page also has a small{' '}
        <strong>analyze icon</strong> (magnifying glass) in its header. This lets you see the
        AI analysis for that specific component.
      </p>

      <Screenshot
        src="/manual/ai-insight/component-icon.png"
        alt="KPI cards showing the analyze icon"
        caption="Each metric has a small icon — click it to see the individual AI analysis."
      />

      <p className="text-base text-foreground">
        Clicking the icon opens a dialog that shows:
      </p>

      <ul className="list-disc list-inside space-y-2 text-base text-foreground">
        <li>
          <strong>What it measures</strong> &mdash; What the metric tracks
        </li>
        <li>
          <strong>Formula</strong> &mdash; How the number is calculated
        </li>
        <li>
          <strong>Indicator</strong> &mdash; What &ldquo;good&rdquo; and &ldquo;bad&rdquo; look like
        </li>
        <li>
          <strong>Analysis</strong> &mdash; The AI&apos;s detailed assessment of this specific metric
        </li>
      </ul>

      <Screenshot
        src="/manual/ai-insight/component-dialog.png"
        alt="Component insight dialog for Avg Collection Days"
        caption="The individual component dialog shows what a metric means and the AI's assessment."
      />

      <Callout type="info" title="No extra cost">
        Clicking the component icon does <strong>not</strong> run a new AI call. It shows the
        stored results from the last time you clicked &ldquo;Analyze&rdquo; on that section.
        If no analysis has been run yet, it will say &ldquo;No analysis available.&rdquo;
      </Callout>

      {/* ─── Important Notes ─── */}

      <h2 className="text-xl font-semibold text-foreground">Important Notes</h2>

      <ul className="list-disc list-inside space-y-3 text-base text-foreground">
        <li>
          <strong>One analysis at a time.</strong> Only one person can run an analysis at a time
          across the entire dashboard. If someone else is running an analysis, you will see a
          message: &ldquo;Analysis is currently running by [Name]. Please wait.&rdquo;
        </li>
        <li>
          <strong>Results are saved.</strong> The latest analysis results are stored and will
          appear when you next open the panel &mdash; you do not need to re-run every time.
        </li>
        <li>
          <strong>Date range matters.</strong> The AI analyzes whatever date range is currently
          selected. If you change the date range, run a new analysis to get updated insights.
        </li>
        <li>
          <strong>The AI observes, not recommends.</strong> The AI tells you what it sees in the
          data (e.g., &ldquo;credit notes are rising&rdquo;) but does not tell you what to do
          about it. Business decisions are yours to make.
        </li>
        <li>
          <strong>Cancel if needed.</strong> If analysis is taking too long, click the red{' '}
          <strong>Cancel</strong> button. Nothing will be saved and you can try again.
        </li>
      </ul>

      {/* ─── Available Sections ─── */}

      <h2 className="text-xl font-semibold text-foreground">Available Sections</h2>

      <p className="text-base text-foreground">
        AI Insight is available on these page sections:
      </p>

      <div className="overflow-x-auto">
        <table className="w-full text-sm text-foreground border-collapse">
          <thead>
            <tr className="border-b">
              <th className="text-left py-2 pr-4 font-semibold">Page</th>
              <th className="text-left py-2 pr-4 font-semibold">Section</th>
              <th className="text-left py-2 font-semibold">What it Analyzes</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b">
              <td className="py-2 pr-4">Payment</td>
              <td className="py-2 pr-4">Payment Collection Trend</td>
              <td className="py-2">Collection days, collection rate, monthly collections, trends</td>
            </tr>
            <tr className="border-b">
              <td className="py-2 pr-4">Payment</td>
              <td className="py-2 pr-4">Outstanding Payment</td>
              <td className="py-2">Outstanding amounts, overdue, credit limits, aging, customer health</td>
            </tr>
            <tr className="border-b">
              <td className="py-2 pr-4">Sales</td>
              <td className="py-2 pr-4">Sales Trend</td>
              <td className="py-2">Net sales, invoice, cash, credit notes, sales trend chart</td>
            </tr>
            <tr className="border-b">
              <td className="py-2 pr-4">Sales</td>
              <td className="py-2 pr-4">Sales Breakdown</td>
              <td className="py-2">Sales by customer, product, agent, outlet</td>
            </tr>
            <tr className="border-b">
              <td className="py-2 pr-4">Financial</td>
              <td className="py-2 pr-4">Financial Overview</td>
              <td className="py-2">KPI summary cards and monthly P&amp;L trend</td>
            </tr>
            <tr className="border-b">
              <td className="py-2 pr-4">Financial</td>
              <td className="py-2 pr-4">Profit &amp; Loss Detail</td>
              <td className="py-2">P&amp;L statement and multi-year comparison</td>
            </tr>
            <tr className="border-b">
              <td className="py-2 pr-4">Financial</td>
              <td className="py-2 pr-4">Balance Sheet</td>
              <td className="py-2">Assets, liabilities, equity trend and statement</td>
            </tr>
            <tr>
              <td className="py-2 pr-4">Financial</td>
              <td className="py-2 pr-4">Variance, Forecast &amp; Budget</td>
              <td className="py-2">P&amp;L variance, 12-month forecast, budget suggestions and approval</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
