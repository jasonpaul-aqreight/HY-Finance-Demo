'use client';

import { useEffect, useState, useMemo } from 'react';

// ─── Types ─────────────────────────────────────────────────────────────────
interface TrendRow {
  period: string;
  invoice_revenue: number;
  cashsales_revenue: number;
  cn_amount: number;
}

// ─── Helpers ───────────────────────────────────────────────────────────────
function netSales(r: TrendRow) {
  return (r.invoice_revenue ?? 0) + (r.cashsales_revenue ?? 0) + (r.cn_amount ?? 0);
}

function monthLabel(period: string) {
  const [y, m] = period.split('-');
  const months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return `${months[parseInt(m) - 1]} ${y?.slice(2)}`;
}

function formatM(v: number) {
  if (Math.abs(v) >= 1e6) return `${(v / 1e6).toFixed(1)}M`;
  if (Math.abs(v) >= 1e3) return `${(v / 1e3).toFixed(0)}K`;
  return String(Math.round(v));
}

// ─── Simple SVG Bar + Line Chart ───────────────────────────────────────────
function BarLineChart({
  labels,
  barData,
  barColors,
  lineData,
  lineColor,
  lineDash,
  lineLabel,
  barLabel,
  secondLineData,
  secondLineColors,
  secondLineLabel,
  rightAxisLabel,
}: {
  labels: string[];
  barData: number[];
  barColors: string[];
  lineData?: number[];
  lineColor?: string;
  lineDash?: boolean;
  lineLabel?: string;
  barLabel?: string;
  secondLineData?: number[];
  secondLineColors?: string[];
  secondLineLabel?: string;
  rightAxisLabel?: string;
}) {
  const w = 900, h = 340;
  const pad = { top: 20, right: rightAxisLabel ? 70 : 20, bottom: 50, left: 70 };
  const cw = w - pad.left - pad.right;
  const ch = h - pad.top - pad.bottom;

  const allValues = [...barData, ...(lineData ?? [])];
  const maxVal = Math.max(...allValues, 1) * 1.1;

  const barW = cw / labels.length * 0.6;
  const gap = cw / labels.length;

  const yScale = (v: number) => pad.top + ch - (v / maxVal) * ch;
  const xCenter = (i: number) => pad.left + gap * i + gap / 2;

  // Right axis scale for second line (percentage)
  const secondMax = secondLineData ? Math.max(...secondLineData.map(Math.abs), 1) * 1.3 : 1;
  const yScaleRight = (v: number) => pad.top + ch / 2 - (v / secondMax) * (ch / 2);

  // Y-axis ticks
  const yTicks = [0, 0.25, 0.5, 0.75, 1].map(f => Math.round(maxVal * f));

  return (
    <svg viewBox={`0 0 ${w} ${h}`} style={{ width: '100%', height: '100%' }}>
      {/* Grid lines */}
      {yTicks.map(v => (
        <line key={v} x1={pad.left} x2={w - pad.right} y1={yScale(v)} y2={yScale(v)} stroke="#f0f0f0" strokeWidth={1} />
      ))}

      {/* Y-axis labels */}
      {yTicks.map(v => (
        <text key={v} x={pad.left - 8} y={yScale(v)} textAnchor="end" fontSize={10} fill="#666" dominantBaseline="central">
          RM {formatM(v)}
        </text>
      ))}

      {/* Bars */}
      {barData.map((v, i) => (
        <rect key={i} x={xCenter(i) - barW / 2} y={yScale(Math.max(v, 0))} width={barW}
          height={Math.abs(yScale(0) - yScale(Math.abs(v)))} rx={3} fill={barColors[i]} />
      ))}

      {/* Prior year line */}
      {lineData && (
        <>
          <polyline
            points={lineData.map((v, i) => `${xCenter(i)},${yScale(v)}`).join(' ')}
            fill="none" stroke={lineColor ?? '#94a3b8'} strokeWidth={2.5}
            strokeDasharray={lineDash ? '6 4' : undefined}
          />
          {lineData.map((v, i) => (
            <circle key={i} cx={xCenter(i)} cy={yScale(v)} r={3.5} fill={lineColor ?? '#94a3b8'} />
          ))}
        </>
      )}

      {/* Second line (YoY %) */}
      {secondLineData && (
        <>
          {/* Zero line for percentage */}
          <line x1={pad.left} x2={w - pad.right} y1={yScaleRight(0)} y2={yScaleRight(0)} stroke="#ccc" strokeDasharray="4 4" strokeWidth={1} />
          {/* Fill area */}
          {secondLineData.map((v, i) => {
            if (i === 0) return null;
            const prev = secondLineData[i - 1];
            return (
              <polygon key={i}
                points={`${xCenter(i - 1)},${yScaleRight(prev)} ${xCenter(i)},${yScaleRight(v)} ${xCenter(i)},${yScaleRight(0)} ${xCenter(i - 1)},${yScaleRight(0)}`}
                fill={v >= 0 && prev >= 0 ? 'rgba(22,163,98,0.12)' : 'rgba(220,38,38,0.12)'}
              />
            );
          })}
          {/* Line */}
          <polyline
            points={secondLineData.map((v, i) => `${xCenter(i)},${yScaleRight(v)}`).join(' ')}
            fill="none" stroke="#666" strokeWidth={2}
          />
          {secondLineData.map((v, i) => (
            <circle key={i} cx={xCenter(i)} cy={yScaleRight(v)} r={3.5}
              fill={(secondLineColors ?? [])[i] ?? (v >= 0 ? '#16a34a' : '#dc2626')} />
          ))}
          {/* Right axis ticks */}
          {[-secondMax, -secondMax / 2, 0, secondMax / 2, secondMax].map(v => (
            <text key={v} x={w - pad.right + 8} y={yScaleRight(v)} fontSize={9} fill="#666" dominantBaseline="central">
              {v.toFixed(0)}%
            </text>
          ))}
          {rightAxisLabel && (
            <text x={w - 8} y={pad.top + ch / 2} fontSize={10} fill="#888" textAnchor="end"
              transform={`rotate(-90, ${w - 8}, ${pad.top + ch / 2})`}>{rightAxisLabel}</text>
          )}
        </>
      )}

      {/* X-axis labels */}
      {labels.map((l, i) => (
        <text key={i} x={xCenter(i)} y={h - pad.bottom + 18} textAnchor="middle" fontSize={10} fill="#666">{l}</text>
      ))}

      {/* Legend */}
      <circle cx={pad.left + 20} cy={h - 10} r={4} fill={barColors[0]} />
      <text x={pad.left + 28} y={h - 10} fontSize={10} fill="#666" dominantBaseline="central">{barLabel ?? 'Net Sales'}</text>
      {lineLabel && (
        <>
          <line x1={pad.left + 150} x2={pad.left + 170} y1={h - 10} y2={h - 10} stroke={lineColor ?? '#94a3b8'} strokeWidth={2.5} strokeDasharray={lineDash ? '6 4' : undefined} />
          <text x={pad.left + 176} y={h - 10} fontSize={10} fill="#666" dominantBaseline="central">{lineLabel}</text>
        </>
      )}
      {secondLineLabel && (
        <>
          <circle cx={pad.left + 350} cy={h - 10} r={4} fill="#666" />
          <text x={pad.left + 358} y={h - 10} fontSize={10} fill="#666" dominantBaseline="central">{secondLineLabel}</text>
        </>
      )}
    </svg>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────
export default function ExperimentGrowthPage() {
  const [currentData, setCurrentData] = useState<TrendRow[]>([]);
  const [priorData, setPriorData] = useState<TrendRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const now = new Date();
    const end = now.toISOString().slice(0, 10);
    const start = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate() + 1).toISOString().slice(0, 10);
    const priorStart = new Date(now.getFullYear() - 2, now.getMonth(), now.getDate() + 1).toISOString().slice(0, 10);
    const priorEnd = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate()).toISOString().slice(0, 10);

    Promise.all([
      fetch(`/api/sales/revenue/trend?start_date=${start}&end_date=${end}&granularity=monthly`).then(r => r.json()),
      fetch(`/api/sales/revenue/trend?start_date=${priorStart}&end_date=${priorEnd}&granularity=monthly`).then(r => r.json()),
    ]).then(([curr, prior]) => {
      setCurrentData(curr.data ?? []);
      setPriorData(prior.data ?? []);
      setLoading(false);
    });
  }, []);

  const { labels, currentValues, priorValues, yoyPct } = useMemo(() => {
    const priorByMonth: Record<string, number> = {};
    priorData.forEach(r => { priorByMonth[r.period.slice(5)] = netSales(r); });

    const labels = currentData.map(r => monthLabel(r.period));
    const currentValues = currentData.map(r => netSales(r));
    const priorValues = currentData.map(r => priorByMonth[r.period.slice(5)] ?? 0);
    const yoyPct = currentValues.map((c, i) => {
      const p = priorValues[i];
      return p > 0 ? ((c - p) / p) * 100 : 0;
    });

    return { labels, currentValues, priorValues, yoyPct };
  }, [currentData, priorData]);

  if (loading) {
    return (
      <div style={{ padding: 40, textAlign: 'center', fontFamily: 'system-ui', color: '#999' }}>
        Loading sales trend data...
      </div>
    );
  }

  const barColorsA = currentValues.map(() => '#2E5090');
  const barColorsB = currentValues.map((c, i) => {
    const p = priorValues[i];
    if (p <= 0) return '#2E5090';
    return c >= p ? '#16a34a' : '#dc2626';
  });
  const barColorsC = currentValues.map(() => '#2E5090');

  return (
    <div style={{ padding: 24, fontFamily: 'system-ui, -apple-system, sans-serif', maxWidth: 1000, margin: '0 auto' }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, marginBottom: 4 }}>Sales Growth Visual — 3 Options</h1>
      <p style={{ fontSize: 13, color: '#666', marginBottom: 32 }}>
        Compare how prior-year performance can be overlaid on the Net Sales Trend chart. Pick the one that&apos;s most intuitive for management.
      </p>

      {/* Option A */}
      <div style={{ background: '#fff', borderRadius: 12, padding: 24, border: '1px solid #e5e7eb', marginBottom: 32 }}>
        <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 2 }}>
          Option A: Prior Year Overlay
          <span style={{ display: 'inline-block', padding: '2px 10px', borderRadius: 9999, fontSize: 11, fontWeight: 600, marginLeft: 8, background: '#dcfce7', color: '#166534' }}>Recommended</span>
        </h2>
        <p style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>
          A faded dashed line shows last year&apos;s net sales behind this year&apos;s bars. The director sees the gap instantly.
        </p>
        <p style={{ fontSize: 12, color: '#16a34a', marginBottom: 16 }}>
          &quot;Is the bar above or below the dashed line?&quot; — even a 70-year-old director gets it immediately.
        </p>
        <BarLineChart
          labels={labels} barData={currentValues} barColors={barColorsA}
          lineData={priorValues} lineColor="#94a3b8" lineDash lineLabel="Prior Year"
          barLabel="Current Year"
        />
      </div>

      {/* Option B */}
      <div style={{ background: '#fff', borderRadius: 12, padding: 24, border: '1px solid #e5e7eb', marginBottom: 32 }}>
        <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 2 }}>
          Option B: Growth Shading
          <span style={{ display: 'inline-block', padding: '2px 10px', borderRadius: 9999, fontSize: 11, fontWeight: 600, marginLeft: 8, background: '#fef3c7', color: '#92400e' }}>Alternative</span>
        </h2>
        <p style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>
          Each monthly bar is colored green (above prior year) or red (below). No extra visual element.
        </p>
        <p style={{ fontSize: 12, color: '#16a34a', marginBottom: 16 }}>
          Cleanest option — the bars themselves tell the story. Hover for details.
        </p>
        <BarLineChart
          labels={labels} barData={currentValues} barColors={barColorsB}
          barLabel="Net Sales (green ↑ YoY, red ↓ YoY)"
        />
      </div>

      {/* Option C */}
      <div style={{ background: '#fff', borderRadius: 12, padding: 24, border: '1px solid #e5e7eb', marginBottom: 32 }}>
        <h2 style={{ fontSize: 16, fontWeight: 600, marginBottom: 2 }}>
          Option C: YoY % Ribbon
          <span style={{ display: 'inline-block', padding: '2px 10px', borderRadius: 9999, fontSize: 11, fontWeight: 600, marginLeft: 8, background: '#fef3c7', color: '#92400e' }}>Alternative</span>
        </h2>
        <p style={{ fontSize: 12, color: '#888', marginBottom: 4 }}>
          A secondary axis shows YoY growth % as a line. Green area above 0%, red below.
        </p>
        <p style={{ fontSize: 12, color: '#16a34a', marginBottom: 16 }}>
          Best for data-literate users. Shows magnitude of growth/decline as a percentage.
        </p>
        <BarLineChart
          labels={labels} barData={currentValues} barColors={barColorsC}
          barLabel="Net Sales" secondLineData={yoyPct}
          secondLineColors={yoyPct.map(v => v >= 0 ? '#16a34a' : '#dc2626')}
          secondLineLabel="YoY Growth %" rightAxisLabel="YoY %"
        />
      </div>
    </div>
  );
}
