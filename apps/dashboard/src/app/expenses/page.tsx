import { Suspense } from 'react';
import { PageBanner } from '@/components/layout/PageBanner';
import { ExpensesVersionRouter } from '@/components/expenses/ExpensesVersionRouter';

export default function ExpensesPage() {
  return (
    <>
      <PageBanner
        title="Expenses"
        description="Monitors major cost categories such as cost of sales, operating costs, payroll, electricity, packing materials, and identifies the top 10 expenses."
      />
      <Suspense fallback={<div className="p-8 text-muted-foreground">Loading dashboard...</div>}>
        <ExpensesVersionRouter />
      </Suspense>
    </>
  );
}
