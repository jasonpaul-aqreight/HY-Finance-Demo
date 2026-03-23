'use client';

import { LineChart, Line, YAxis } from 'recharts';

interface SparklineProps {
  data: number[];
  width?: number;
  height?: number;
}

export function Sparkline({ data, width = 100, height = 28 }: SparklineProps) {
  if (!data || data.length < 2) {
    return <div className="text-xs text-muted-foreground">—</div>;
  }

  const chartData = data.map((value, i) => ({ i, value }));
  const last = data[data.length - 1];
  const first = data[0];
  const trending = last >= first;

  return (
    <LineChart width={width} height={height} data={chartData}>
      <YAxis domain={['dataMin', 'dataMax']} hide />
      <Line
        type="monotone"
        dataKey="value"
        stroke={trending ? 'hsl(152, 69%, 40%)' : 'hsl(0, 72%, 51%)'}
        strokeWidth={1.5}
        dot={false}
        isAnimationActive={false}
      />
    </LineChart>
  );
}
