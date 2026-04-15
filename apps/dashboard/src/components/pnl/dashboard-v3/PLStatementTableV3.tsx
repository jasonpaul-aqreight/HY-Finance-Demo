'use client';

import React, { useState } from 'react';
import { useV3Statement } from '@/hooks/pnl/usePLDataV3';
import { useStableData } from '@/hooks/useStableData';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { AnalyzeIcon } from '@/components/ai-insight/AnalyzeIcon';
import { exportToExcel } from '@/lib/export-excel';
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from '@/components/ui/table';
import {
  formatAmount,
  formatPct,
  formatPctChange,
  formatPctPoints,
  growthColor,
} from '@/lib/pnl/format';
import type { V2PeriodValues, V2MarginValues } from '@/types/pnl-v2';

interface Props {
  fy: string;
}

const ROW_STYLES: Record<string, { bg: string; text: string; font: string }> = {
  detail:     { bg: '', text: '', font: '' },
  subtotal:   { bg: 'bg-muted/40', text: '', font: 'font-semibold' },
  total:      { bg: 'bg-muted/60', text: '', font: 'font-bold' },
  grandtotal: { bg: 'bg-muted', text: '', font: 'font-bold' },
  margin:     { bg: '', text: 'text-muted-foreground italic', font: 'text-xs' },
};

/** Convert "COST OF GOODS SOLD" → "Cost of Goods Sold" */
function titleCase(str: string): string {
  const lower = new Set(['of', 'the', 'and', 'a', 'an', 'in', 'on', 'for', 'to', 'or']);
  return str
    .split(/(\s+|[/()])/)
    .map((word, i) => {
      if (!word.trim() || /^[/()]$/.test(word)) return word;
      const lc = word.toLowerCase();
      return i === 0 || !lower.has(lc) ? lc.charAt(0).toUpperCase() + lc.slice(1) : lc;
    })
    .join('');
}

function CellValue({ value, type }: { value: number; type: string }) {
  if (type === 'margin') return <span>{formatPct(value)}</span>;
  const formatted = formatAmount(value);
  const isNeg = value < 0;
  return <span className={isNeg ? 'text-red-600' : ''}>{formatted}</span>;
}

function YoYCell({ ytd, priorYtd, type }: { ytd: number; priorYtd: number; type: string }) {
  if (type === 'margin') {
    return <span className="text-muted-foreground">{formatPctPoints(ytd, priorYtd)}</span>;
  }
  const pctStr = formatPctChange(ytd, priorYtd);
  const pct = priorYtd !== 0 ? ((ytd - priorYtd) / Math.abs(priorYtd)) * 100 : null;
  return <span className={growthColor(pct)}>{pctStr}</span>;
}

function isGroupEmpty(group: { subtotal: V2PeriodValues }) {
  return group.subtotal.monthly.every(v => v === 0)
    && group.subtotal.ytd === 0
    && group.subtotal.prior_ytd === 0;
}

export function PLStatementTableV3({ fy }: Props) {
  const { data: rawData } = useV3Statement(fy);
  const data = useStableData(rawData);
  const [expanded, setExpanded] = useState<Record<string, boolean>>({});

  if (!data) {
    return (
      <Card className="rounded-xl ring-1 ring-foreground/10">
        <CardContent className="p-6 h-96 animate-pulse bg-muted/30" />
      </Card>
    );
  }

  const months = data.months ?? [];

  function handleExportExcel() {
    if (!data) return;
    const cols = [
      { header: 'Account', key: 'account', width: 30 },
      ...months.map(m => ({ header: m.label.split(' ')[0], key: String(m.period), width: 14 })),
      { header: 'Year to Date', key: 'ytd', width: 16 },
      { header: 'Prior Year', key: 'prior_ytd', width: 16 },
    ];
    const rows: Record<string, unknown>[] = [];
    for (const group of data.groups) {
      // Group subtotal row
      const subtotalRow: Record<string, unknown> = { account: group.acc_type_name };
      group.subtotal.monthly.forEach((v, i) => { subtotalRow[String(months[i]?.period)] = v; });
      subtotalRow.ytd = group.subtotal.ytd;
      subtotalRow.prior_ytd = group.subtotal.prior_ytd;
      rows.push(subtotalRow);
      // Account detail rows
      for (const acc of group.accounts) {
        const row: Record<string, unknown> = { account: `  ${acc.description}` };
        acc.monthly.forEach((v, i) => { row[String(months[i]?.period)] = v; });
        row.ytd = acc.ytd;
        row.prior_ytd = acc.prior_ytd;
        rows.push(row);
      }
    }
    exportToExcel('profit-and-loss', cols, rows);
  }

  function toggleGroup(accType: string) {
    setExpanded(prev => ({ ...prev, [accType]: !prev[accType] }));
  }

  function renderComputedRow(label: string, vals: V2PeriodValues, style: string) {
    const s = ROW_STYLES[style] || ROW_STYLES.detail;
    return (
      <TableRow key={label} className={`${s.bg} border-b`}>
        <TableCell className={`py-1.5 px-2 ${s.text} ${s.font} sticky left-0 z-10 ${s.bg || 'bg-background'} min-w-[160px]`}>
          {titleCase(label)}
        </TableCell>
        {vals.monthly.map((v, i) => (
          <TableCell key={i} className={`text-right py-1.5 px-1.5 ${s.text} ${s.font} font-mono`}>
            <CellValue value={v} type={style} />
          </TableCell>
        ))}
        <TableCell className={`text-right py-1.5 px-1.5 ${s.text} ${s.font} font-mono border-l-2 border-border`}>
          <CellValue value={vals.ytd} type={style} />
        </TableCell>
        <TableCell className={`text-right py-1.5 px-1.5 ${s.text} ${s.font} font-mono`}>
          <CellValue value={vals.prior_ytd} type={style} />
        </TableCell>
        <TableCell className={`text-right py-1.5 px-1.5 ${s.text} ${s.font} font-mono`}>
          <YoYCell ytd={vals.ytd} priorYtd={vals.prior_ytd} type={style} />
        </TableCell>
      </TableRow>
    );
  }

  function renderMarginRow(label: string, margin: V2MarginValues) {
    const s = ROW_STYLES.margin;
    return (
      <TableRow key={label}>
        <TableCell className={`py-1 px-2 ${s.text} ${s.font} sticky left-0 z-10 bg-background min-w-[160px] pl-6`}>
          {label}
        </TableCell>
        {margin.monthly.map((v, i) => (
          <TableCell key={i} className={`text-right py-1 px-1.5 ${s.text} ${s.font} font-mono`}>
            <CellValue value={v} type="margin" />
          </TableCell>
        ))}
        <TableCell className={`text-right py-1 px-1.5 ${s.text} ${s.font} font-mono border-l-2 border-border`}>
          <CellValue value={margin.ytd} type="margin" />
        </TableCell>
        <TableCell className={`text-right py-1 px-1.5 ${s.text} ${s.font} font-mono`}>
          <CellValue value={margin.prior_ytd} type="margin" />
        </TableCell>
        <TableCell className={`text-right py-1 px-1.5 ${s.text} ${s.font} font-mono`}>
          <YoYCell ytd={margin.ytd} priorYtd={margin.prior_ytd} type="margin" />
        </TableCell>
      </TableRow>
    );
  }

  return (
    <Card className="rounded-xl ring-1 ring-foreground/10">
      <CardHeader className="flex-row items-center justify-between pb-0 pt-2 px-4">
        <h3 className="text-sm font-semibold flex items-center gap-1">
          Profit & Loss Statement
          <AnalyzeIcon sectionKey="financial_pnl" componentKey="fin_pl_statement" />
        </h3>
        <Button variant="outline" size="sm" onClick={handleExportExcel}>
          Export Excel
        </Button>
      </CardHeader>
      <CardContent className="p-0 overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="sticky left-0 z-10 bg-background min-w-[160px]">
                Account
              </TableHead>
              {months.map(m => (
                <TableHead key={m.period} className="text-right">
                  {m.label.split(' ')[0]}
                </TableHead>
              ))}
              <TableHead className="text-right border-l-2 border-border">
                Year to Date
              </TableHead>
              <TableHead className="text-right">
                Prior Year
              </TableHead>
              <TableHead className="text-right">
                vs Last Year
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.groups
              .filter(group => !isGroupEmpty(group))
              .map((group) => {
              const isExpanded = expanded[group.acc_type] ?? false;
              const s = ROW_STYLES.subtotal;
              return (
                <React.Fragment key={group.acc_type}>
                  <TableRow
                    className={`${s.bg} cursor-pointer hover:bg-muted/60`}
                    onClick={() => toggleGroup(group.acc_type)}
                  >
                    <TableCell className={`py-1.5 px-2 ${s.font} sticky left-0 z-10 ${s.bg || 'bg-background'} min-w-[160px]`}>
                      <span className="mr-2 text-xs">{isExpanded ? '\u25BC' : '\u25B6'}</span>
                      {titleCase(group.acc_type_name)}
                    </TableCell>
                    {group.subtotal.monthly.map((v, i) => (
                      <TableCell key={i} className={`text-right py-1.5 px-1.5 ${s.font} font-mono`}>
                        <CellValue value={v} type="subtotal" />
                      </TableCell>
                    ))}
                    <TableCell className={`text-right py-1.5 px-1.5 ${s.font} font-mono border-l-2 border-border`}>
                      <CellValue value={group.subtotal.ytd} type="subtotal" />
                    </TableCell>
                    <TableCell className={`text-right py-1.5 px-1.5 ${s.font} font-mono`}>
                      <CellValue value={group.subtotal.prior_ytd} type="subtotal" />
                    </TableCell>
                    <TableCell className={`text-right py-1.5 px-1.5 ${s.font} font-mono`}>
                      <YoYCell ytd={group.subtotal.ytd} priorYtd={group.subtotal.prior_ytd} type="subtotal" />
                    </TableCell>
                  </TableRow>

                  {isExpanded && group.accounts.map((acc, rowIdx) => {
                    const isAlt = rowIdx % 2 === 1;
                    const altBg = isAlt ? 'bg-muted/10' : '';
                    const stickyBg = isAlt ? 'bg-muted/10' : 'bg-background';
                    return (
                      <TableRow key={acc.accno} className={`${altBg} hover:bg-muted/30`}>
                        <TableCell className={`py-1 px-2 pl-8 text-muted-foreground sticky left-0 z-10 ${stickyBg} min-w-[160px]`}>
                          {titleCase(acc.description)}
                        </TableCell>
                        {acc.monthly.map((v, i) => (
                          <TableCell key={i} className="text-right py-1 px-1.5 font-mono">
                            <CellValue value={v} type="detail" />
                          </TableCell>
                        ))}
                        <TableCell className="text-right py-1 px-1.5 font-mono border-l-2 border-border">
                          <CellValue value={acc.ytd} type="detail" />
                        </TableCell>
                        <TableCell className="text-right py-1 px-1.5 font-mono">
                          <CellValue value={acc.prior_ytd} type="detail" />
                        </TableCell>
                        <TableCell className="text-right py-1 px-1.5 font-mono">
                          <YoYCell ytd={acc.ytd} priorYtd={acc.prior_ytd} type="detail" />
                        </TableCell>
                      </TableRow>
                    );
                  })}

                  {group.acc_type === 'CO' && (
                    <>
                      {renderComputedRow('GROSS PROFIT / (LOSS)', data.computed.gross_profit, 'total')}
                      {renderMarginRow('Gross Margin %', data.computed.gpm)}
                    </>
                  )}
                  {group.acc_type === 'EP' && (
                    <>
                      {renderComputedRow('NET PROFIT / (LOSS)', data.computed.net_profit, 'total')}
                      {renderMarginRow('Net Margin %', data.computed.npm)}
                    </>
                  )}
                  {group.acc_type === 'TX' &&
                    renderComputedRow('NET PROFIT / (LOSS) AFTER TAXATION', data.computed.net_profit_after_tax, 'grandtotal')}
                </React.Fragment>
              );
            })}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  );
}
