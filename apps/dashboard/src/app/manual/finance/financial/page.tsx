import { Screenshot } from '@/components/manual/Screenshot';
import { Callout } from '@/components/manual/Callout';
import { Steps, Step } from '@/components/manual/Steps';
import Link from 'next/link';

export default function FinancialStatementsPage() {
  return (
    <div className="max-w-3xl mx-auto space-y-5">
      <h1 className="text-2xl font-bold" style={{ color: '#1F4E79' }}>
        Financial Statements
      </h1>

      <p className="text-base text-foreground">
        The <strong>Financial Statements</strong> page gives you a full view of your company&apos;s
        financial health: Profit &amp; Loss, Balance Sheet, and AI-driven planning tools for
        variance analysis, forecasting, and budgeting.
      </p>

      <p className="text-base text-foreground">
        The page is divided into four sections, each with its own{' '}
        <Link
          href="/manual/general/ai-insight"
          className="font-semibold underline"
          style={{ color: '#1F4E79' }}
        >
          AI Insight
        </Link>{' '}
        analysis.
      </p>

      {/* ─── Page Layout ─── */}

      <h2 className="text-xl font-semibold text-foreground">Page Layout</h2>

      <div className="overflow-x-auto">
        <table className="w-full text-sm text-foreground border-collapse">
          <thead>
            <tr className="border-b">
              <th className="text-left py-2 pr-4 font-semibold">Section</th>
              <th className="text-left py-2 font-semibold">What It Shows</th>
            </tr>
          </thead>
          <tbody>
            <tr className="border-b">
              <td className="py-2 pr-4">Financial Overview</td>
              <td className="py-2">KPI summary cards (Net Sales, Gross Profit, Net Margin, etc.) and Monthly P&amp;L Trend chart</td>
            </tr>
            <tr className="border-b">
              <td className="py-2 pr-4">Profit &amp; Loss Detail</td>
              <td className="py-2">Full P&amp;L statement by month with account-level detail, plus multi-year (YoY) comparison</td>
            </tr>
            <tr className="border-b">
              <td className="py-2 pr-4">Balance Sheet</td>
              <td className="py-2">Assets, Liabilities &amp; Equity trend chart and detailed Balance Sheet statement</td>
            </tr>
            <tr>
              <td className="py-2 pr-4 font-semibold">Variance, Forecast &amp; Budget</td>
              <td className="py-2">AI-powered variance analysis, 12-month forecast, and budget management</td>
            </tr>
          </tbody>
        </table>
      </div>

      <Callout type="tip" title="Fiscal year filter">
        Use the fiscal year dropdown at the top of the page to switch between years.
        You can also choose a range: <strong>FY</strong> (full year),{' '}
        <strong>Last 12 Months</strong>, or <strong>YTD</strong> (year to date).
      </Callout>

      {/* ─── Variance, Forecast & Budget ─── */}

      <h2 className="text-xl font-semibold text-foreground">
        Variance, Forecast &amp; Budget
      </h2>

      <Screenshot
        src="/manual/financial/financial-section-header.png"
        alt="Variance, Forecast & Budget section header with Get Insight button"
        caption="Scroll to the bottom of the Financial page to find the Variance, Forecast & Budget section."
      />

      <p className="text-base text-foreground">
        This is the AI-driven Financial Planning &amp; Analysis section. When you click{' '}
        <strong>&ldquo;Get Insight&rdquo;</strong> and then <strong>Analyze</strong>, the AI
        examines four components:
      </p>

      <ul className="list-disc list-inside space-y-2 text-base text-foreground">
        <li>
          <strong>Variance Summary</strong> &mdash; Compares your actual P&amp;L results against
          last year (and against your approved budget, if one exists). Flags each line item as
          Favourable or Unfavourable.
        </li>
        <li>
          <strong>Variance Breakdown</strong> &mdash; Drills into individual GL accounts to show
          which specific accounts drove the biggest changes.
        </li>
        <li>
          <strong>12-Month Forecast</strong> &mdash; Projects Net Sales, Gross Profit, and Net
          Profit for the next 12 months based on recent trends.
        </li>
        <li>
          <strong>Budget Suggestions</strong> &mdash; Generates suggested annual budget numbers
          from your historical data, and compares against any previously approved budget.
        </li>
      </ul>

      <Screenshot
        src="/manual/financial/financial-insight-results.png"
        alt="AI insight results showing positive and negative findings with Approve as Budget bar"
        caption="After analysis: positive insights (left), negative insights (right), and the Approve as Budget bar at the bottom."
      />

      {/* ─── Approving a Budget ─── */}

      <h2 className="text-xl font-semibold text-foreground">Approving a Budget</h2>

      <p className="text-base text-foreground">
        After the AI analysis completes on the Variance, Forecast &amp; Budget section, a blue
        bar appears at the bottom asking if you want to save the suggested budget.
      </p>

      <Steps>
        <Step number={1} title="Run the AI analysis">
          On the Financial page, scroll to <strong>Variance, Forecast &amp; Budget</strong>.
          Click <strong>&ldquo;Get Insight&rdquo;</strong>, then click <strong>Analyze</strong>.
          Wait for the analysis to complete.
        </Step>
        <Step number={2} title="Review the suggestions">
          Read the AI&apos;s budget suggestions in the insight cards. The AI computes a suggested
          annual budget by averaging your actual monthly P&amp;L and multiplying by 12.
        </Step>
        <Step number={3} title="Click Approve as Budget">
          If you are satisfied, click the <strong>&ldquo;Approve as Budget&rdquo;</strong> button
          in the blue bar. The button changes to <strong>&ldquo;Budget Saved&rdquo;</strong> when done.
        </Step>
      </Steps>

      <Screenshot
        src="/manual/financial/financial-approve-budget.png"
        alt="Approve as Budget bar before clicking"
        caption="Click 'Approve as Budget' to save the AI-generated budget for this fiscal year."
      />

      <Screenshot
        src="/manual/financial/financial-budget-saved.png"
        alt="Budget Saved confirmation"
        caption="After approval, the button changes to 'Budget Saved' with a checkmark."
      />

      <Callout type="info" title="What gets saved?">
        Five headline P&amp;L lines are saved: <strong>Net Sales</strong>,{' '}
        <strong>Cost of Sales</strong>, <strong>Gross Profit</strong>,{' '}
        <strong>Operating Costs</strong>, and <strong>Net Profit</strong> &mdash; each with a
        monthly and annual budget amount. These are saved per fiscal year.
      </Callout>

      <Callout type="tip" title="Updating the budget">
        You can approve a new budget at any time. If the business changes and you run the
        analysis again, the new suggestions may differ. Clicking{' '}
        <strong>&ldquo;Approve as Budget&rdquo;</strong> again will update the saved budget.
      </Callout>

      {/* ─── Budget vs Actual Variance ─── */}

      <h2 className="text-xl font-semibold text-foreground">
        Budget vs Actual Variance
      </h2>

      <p className="text-base text-foreground">
        Once a budget is approved, the next time you run the AI analysis, the{' '}
        <strong>Variance Summary</strong> will automatically include a second comparison:
      </p>

      <ul className="list-disc list-inside space-y-2 text-base text-foreground">
        <li>
          <strong>YoY Variance</strong> &mdash; Actual vs same period last year (always shown)
        </li>
        <li>
          <strong>Budget Variance</strong> &mdash; Actual vs your approved budget (shown after
          you approve a budget)
        </li>
      </ul>

      <p className="text-base text-foreground">
        This tells you not just &ldquo;are we doing better than last year&rdquo; but also
        &ldquo;are we on track against our plan.&rdquo;
      </p>

      {/* ─── 12-Month Forecast ─── */}

      <h2 className="text-xl font-semibold text-foreground">12-Month Forecast</h2>

      <p className="text-base text-foreground">
        The forecast projects your key P&amp;L lines 12 months ahead using a weighted moving
        average of your recent monthly results (50% most recent month, 30% prior, 20%
        earliest).
      </p>

      <p className="text-base text-foreground">
        The AI highlights key milestones: <strong>Month+1</strong> (near-term),{' '}
        <strong>Month+3</strong> (quarter), <strong>Month+6</strong> (half-year), and{' '}
        <strong>Month+12</strong> (full-year). It also flags whether the trend is strong or
        weak, and warns if any forecast month projects a sign flip (e.g., profit turning into
        loss).
      </p>

      <Callout type="warning" title="Forecast limitations">
        The forecast uses a simple trend-based projection. It does not account for seasonality
        or one-off events. Treat longer-range forecasts (Month+7 onwards) as rough estimates.
      </Callout>

      {/* ─── Important Notes ─── */}

      <h2 className="text-xl font-semibold text-foreground">Important Notes</h2>

      <ul className="list-disc list-inside space-y-3 text-base text-foreground">
        <li>
          <strong>Budget approval is one-click.</strong> The AI generates the numbers, you
          review and approve. There is no manual data entry.
        </li>
        <li>
          <strong>Budget is per fiscal year.</strong> Each fiscal year has its own budget. When
          you switch to a different fiscal year, the budget for that year (if approved) will be
          used.
        </li>
        <li>
          <strong>Variance analysis works without a budget.</strong> Even if you never approve a
          budget, the AI still compares your actuals against last year (YoY variance).
        </li>
        <li>
          <strong>The AI observes, not recommends.</strong> Budget suggestions are starting
          points based on historical data. They are not formal financial targets.
        </li>
      </ul>
    </div>
  );
}
