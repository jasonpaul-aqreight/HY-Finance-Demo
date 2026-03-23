'use client';

import { useV3BSComparison } from '@/hooks/pnl/usePLDataV3';
import { Card, CardContent } from '@/components/ui/card';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import { formatAmount, formatPctChange } from '@/lib/pnl/format';

interface Props {
  fy: string;
}

interface BSLineItem {
  label: string;
  type: 'detail' | 'subtotal' | 'total' | 'grandtotal' | 'header';
  current: number;
  prior: number;
}

const ROW_STYLES: Record<string, { bg: string; text: string; font: string }> = {
  detail: { bg: '', text: '', font: '' },
  subtotal: { bg: 'bg-muted/40', text: '', font: 'font-bold' },
  total: { bg: 'bg-muted/60', text: '', font: 'font-bold' },
  grandtotal: { bg: 'bg-muted', text: '', font: 'font-bold' },
  header: { bg: '', text: 'text-muted-foreground', font: 'font-bold italic' },
};

function CellValue({ value }: { value: number }) {
  const formatted = formatAmount(value);
  const isNeg = value < 0;
  return <span className={isNeg ? 'text-red-600' : ''}>{formatted}</span>;
}

export function BSStatementTableV3({ fy }: Props) {
  const { data, isLoading } = useV3BSComparison(fy);

  if (isLoading || !data) {
    return (
      <Card className="rounded-xl ring-1 ring-foreground/10 h-full">
        <CardContent className="p-6 h-[380px] animate-pulse bg-muted/30" />
      </Card>
    );
  }

  const { current, prior } = data;

  const findBalance = (items: typeof current.items, accType: string) => {
    return items.find(i => i.AccType === accType)?.balance || 0;
  };

  const cFA = findBalance(current.items, 'FA');
  const cOA = findBalance(current.items, 'OA');
  const cCA = findBalance(current.items, 'CA');
  const cCL = findBalance(current.items, 'CL');
  const cLL = findBalance(current.items, 'LL');
  const cOL = findBalance(current.items, 'OL');
  const cCP = findBalance(current.items, 'CP');
  const cRE = findBalance(current.items, 'RE');

  const pFA = findBalance(prior.items, 'FA');
  const pOA = findBalance(prior.items, 'OA');
  const pCA = findBalance(prior.items, 'CA');
  const pCL = findBalance(prior.items, 'CL');
  const pLL = findBalance(prior.items, 'LL');
  const pOL = findBalance(prior.items, 'OL');
  const pCP = findBalance(prior.items, 'CP');
  const pRE = findBalance(prior.items, 'RE');

  const lineItems: BSLineItem[] = [
    { label: 'Fixed Assets', type: 'detail', current: cFA, prior: pFA },
    { label: 'Other Assets', type: 'detail', current: cOA, prior: pOA },
    { label: 'Current Assets', type: 'detail', current: cCA, prior: pCA },
    { label: 'Current Liabilities', type: 'detail', current: -cCL, prior: -pCL },
    { label: 'Net Current Assets', type: 'subtotal', current: cCA - cCL, prior: pCA - pCL },
    { label: 'Total Assets', type: 'total', current: cFA + cOA + (cCA - cCL), prior: pFA + pOA + (pCA - pCL) },
    { label: 'Financed By:', type: 'header', current: 0, prior: 0 },
    { label: 'Capital', type: 'detail', current: cCP, prior: pCP },
    { label: 'Retained Earnings', type: 'detail', current: cRE + current.current_year_pl, prior: pRE + prior.current_year_pl },
    { label: 'Long Term Liabilities', type: 'detail', current: cLL, prior: pLL },
    { label: 'Other Liabilities', type: 'detail', current: cOL, prior: pOL },
    {
      label: 'Total Equity & Liabilities', type: 'grandtotal',
      current: cCP + cRE + current.current_year_pl + cLL + cOL,
      prior: pCP + pRE + prior.current_year_pl + pLL + pOL,
    },
  ];

  return (
    <Card className="rounded-xl ring-1 ring-foreground/10 h-full">
      <CardContent className="p-0 overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Description</TableHead>
              <TableHead className="text-right whitespace-nowrap">Current</TableHead>
              <TableHead className="text-right whitespace-nowrap">Prior</TableHead>
              <TableHead className="text-right">Change</TableHead>
              <TableHead className="text-right">%</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {lineItems.map((item, i) => {
              const style = ROW_STYLES[item.type] || ROW_STYLES.detail;
              const change = item.current - item.prior;
              const isAltRow = item.type === 'detail' && i % 2 === 1;

              if (item.type === 'header') {
                return (
                  <TableRow key={item.label} className="border-t">
                    <TableCell colSpan={5} className={`py-2 px-2 ${style.text} ${style.font} text-sm`}>
                      {item.label}
                    </TableCell>
                  </TableRow>
                );
              }

              return (
                <TableRow key={item.label} className={`${style.bg || (isAltRow ? 'bg-muted/10' : '')}`}>
                  <TableCell className={`py-1.5 px-2 ${style.text} ${style.font} text-sm`}>{item.label}</TableCell>
                  <TableCell className={`text-right py-1.5 px-1.5 ${style.text} ${style.font} text-sm font-mono`}>
                    <CellValue value={item.current} />
                  </TableCell>
                  <TableCell className={`text-right py-1.5 px-1.5 ${style.text} ${style.font} text-sm font-mono`}>
                    <CellValue value={item.prior} />
                  </TableCell>
                  <TableCell className={`text-right py-1.5 px-1.5 ${style.text} ${style.font} text-sm font-mono`}>
                    <CellValue value={change} />
                  </TableCell>
                  <TableCell className={`text-right py-1.5 px-1.5 ${style.text} ${style.font} text-sm font-mono`}>
                    {item.prior !== 0 ? (
                      <span className={change >= 0 ? 'text-emerald-600' : 'text-red-600'}>
                        {formatPctChange(item.current, item.prior)}
                      </span>
                    ) : '\u2013'}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
