'use client';

import { LineChart, Line, ResponsiveContainer } from 'recharts';

interface Props {
  data: { period: string; margin_pct: number }[];
}

export function CustomerSparkline({ data }: Props) {
  if (!data || data.length < 2) return <span className="text-xs text-muted-foreground">—</span>;

  const first = data[0].margin_pct;
  const last = data[data.length - 1].margin_pct;
  const color = last >= first ? '#10b981' : '#ef4444';

  return (
    <div className="h-[28px] w-[100px]">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data}>
          <Line
            type="monotone"
            dataKey="margin_pct"
            stroke={color}
            strokeWidth={1.5}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
