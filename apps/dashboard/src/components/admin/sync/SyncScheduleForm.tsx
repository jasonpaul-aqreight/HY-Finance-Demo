'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { useSyncSchedule } from '@/hooks/admin/useSyncData';
import { mutate } from 'swr';
import { Clock, Save } from 'lucide-react';

const CRON_PRESETS = [
  { label: 'Every 6 hours', value: '0 */6 * * *' },
  { label: 'Daily at 6 AM', value: '0 6 * * *' },
  { label: 'Daily at midnight', value: '0 0 * * *' },
  { label: 'Every 12 hours', value: '0 0,12 * * *' },
  { label: 'Weekdays at 6 AM', value: '0 6 * * 1-5' },
];

function describeCron(expr: string): string {
  const parts = expr.split(' ');
  if (parts.length !== 5) return expr;
  const [min, hour, , , dow] = parts;

  const days = dow === '*' ? 'every day' : dow === '1-5' ? 'weekdays' : `days ${dow}`;

  if (hour.startsWith('*/')) return `Every ${hour.slice(2)} hours`;
  if (hour.includes(',')) {
    const hours = hour.split(',').map((h) => `${h}:${min.padStart(2, '0')}`);
    return `${days} at ${hours.join(' & ')} MYT`;
  }
  return `${days} at ${hour}:${min.padStart(2, '0')} MYT`;
}

export function SyncScheduleForm() {
  const { data: schedule, isLoading } = useSyncSchedule();
  const [cronExpr, setCronExpr] = useState('');
  const [isActive, setIsActive] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    if (schedule?.cron_expression != null) {
      setCronExpr(schedule.cron_expression);
      setIsActive(schedule.is_active);
    }
  }, [schedule]);

  async function handleSave() {
    setSaving(true);
    setFeedback(null);
    try {
      const res = await fetch('/api/admin/sync/schedule', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ cron_expression: cronExpr, is_active: isActive }),
      });
      const data = await res.json();
      if (res.ok) {
        setFeedback('Schedule saved');
        mutate('/api/admin/sync/schedule');
      } else {
        setFeedback(data.error ?? 'Failed to save');
      }
    } catch {
      setFeedback('Sync service unreachable');
    } finally {
      setSaving(false);
    }
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader><CardTitle>Sync Schedule</CardTitle></CardHeader>
        <CardContent><div className="h-20 flex items-center justify-center text-foreground">Loading...</div></CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="flex-row items-center gap-2">
        <Clock className="size-5" />
        <CardTitle>Sync Schedule</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <label className="text-sm font-medium mb-1 block">Cron Expression</label>
          <div className="flex items-center gap-2">
            <Input
              value={cronExpr}
              onChange={(e) => setCronExpr(e.target.value)}
              placeholder="0 6 * * *"
              className="font-mono max-w-60"
            />
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
                className="rounded"
              />
              Active
            </label>
          </div>
          {cronExpr && (
            <p className="text-sm text-foreground mt-1">{describeCron(cronExpr)}</p>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          {CRON_PRESETS.map((preset) => (
            <Button
              key={preset.value}
              variant={cronExpr === preset.value ? 'secondary' : 'outline'}
              size="sm"
              onClick={() => setCronExpr(preset.value)}
            >
              {preset.label}
            </Button>
          ))}
        </div>

        <div className="flex items-center gap-3">
          <Button onClick={handleSave} disabled={saving}>
            <Save className="size-4" />
            {saving ? 'Saving...' : 'Save Schedule'}
          </Button>
          {feedback && <span className="text-sm text-foreground">{feedback}</span>}
        </div>
      </CardContent>
    </Card>
  );
}
