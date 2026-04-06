'use client';

import { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useSyncSchedule } from '@/hooks/admin/useSyncData';
import { useRole } from '@/components/layout/RoleProvider';
import { mutate } from 'swr';
import { Clock, Save, ShieldAlert } from 'lucide-react';

/* ── Frequency ↔ Cron mapping ──────────────────────────── */

type Frequency = 'every_hour' | 'every_2h' | 'every_4h' | 'every_6h' | 'every_8h' | 'every_12h' | 'daily' | 'weekdays';

interface FriendlySchedule {
  frequency: Frequency;
  startTime: string; // "HH:MM" — used for daily/weekdays and as offset for intervals
  isActive: boolean;
}

const FREQUENCY_OPTIONS: { value: Frequency; label: string }[] = [
  { value: 'every_hour', label: 'Every hour' },
  { value: 'every_2h', label: 'Every 2 hours' },
  { value: 'every_4h', label: 'Every 4 hours' },
  { value: 'every_6h', label: 'Every 6 hours' },
  { value: 'every_8h', label: 'Every 8 hours' },
  { value: 'every_12h', label: 'Every 12 hours' },
  { value: 'daily', label: 'Once a day' },
  { value: 'weekdays', label: 'Weekdays only' },
];

const HOUR_OPTIONS = Array.from({ length: 24 }, (_, i) => {
  const h = i.toString().padStart(2, '0');
  const label = i === 0 ? '12:00 AM' : i < 12 ? `${i}:00 AM` : i === 12 ? '12:00 PM' : `${i - 12}:00 PM`;
  return { value: `${h}:00`, label };
});

function friendlyToCron(s: FriendlySchedule): string {
  const hour = parseInt(s.startTime.split(':')[0], 10);
  switch (s.frequency) {
    case 'every_hour':   return '0 * * * *';
    case 'every_2h':     return `0 ${hour % 2}/${2} * * *`;
    case 'every_4h':     return `0 ${hour % 4}/${4} * * *`;
    case 'every_6h':     return `0 ${hour % 6}/${6} * * *`;
    case 'every_8h':     return `0 ${hour % 8}/${8} * * *`;
    case 'every_12h':    return `0 ${hour % 12}/${12} * * *`;
    case 'daily':        return `0 ${hour} * * *`;
    case 'weekdays':     return `0 ${hour} * * 1-5`;
  }
}

function cronToFriendly(cron: string, isActive: boolean): FriendlySchedule {
  const parts = cron.split(' ');
  if (parts.length !== 5) return { frequency: 'daily', startTime: '06:00', isActive };
  const [, hourField, , , dow] = parts;

  // Every hour
  if (hourField === '*') return { frequency: 'every_hour', startTime: '00:00', isActive };

  // "*/N" pattern (e.g. "*/6") — must check before generic "/" pattern
  if (hourField.startsWith('*/')) {
    const step = parseInt(hourField.slice(2), 10);
    const freqMap: Record<number, Frequency> = { 1: 'every_hour', 2: 'every_2h', 4: 'every_4h', 6: 'every_6h', 8: 'every_8h', 12: 'every_12h' };
    return { frequency: freqMap[step] ?? 'every_6h', startTime: '00:00', isActive };
  }

  // Step patterns: "offset/step" e.g. "2/6"
  if (hourField.includes('/')) {
    const [offset, step] = hourField.split('/').map(Number);
    const freqMap: Record<number, Frequency> = { 2: 'every_2h', 4: 'every_4h', 6: 'every_6h', 8: 'every_8h', 12: 'every_12h' };
    const freq = freqMap[step] ?? 'every_6h';
    return { frequency: freq, startTime: `${offset.toString().padStart(2, '0')}:00`, isActive };
  }

  // Comma-separated (e.g. "0,12") — treat as every_12h
  if (hourField.includes(',')) {
    const hours = hourField.split(',').map(Number);
    if (hours.length === 2) {
      const diff = hours[1] - hours[0];
      const freqMap: Record<number, Frequency> = { 12: 'every_12h', 8: 'every_8h', 6: 'every_6h' };
      return { frequency: freqMap[diff] ?? 'every_12h', startTime: `${hours[0].toString().padStart(2, '0')}:00`, isActive };
    }
  }

  // Single hour — daily or weekdays
  const hour = parseInt(hourField, 10);
  const startTime = `${hour.toString().padStart(2, '0')}:00`;
  if (dow === '1-5') return { frequency: 'weekdays', startTime, isActive };
  return { frequency: 'daily', startTime, isActive };
}

function describeSchedule(s: FriendlySchedule): string {
  const label = FREQUENCY_OPTIONS.find(o => o.value === s.frequency)?.label ?? s.frequency;
  const timeLabel = HOUR_OPTIONS.find(o => o.value === s.startTime)?.label ?? s.startTime;

  if (s.frequency === 'every_hour') return 'Runs every hour, on the hour';
  if (s.frequency === 'daily' || s.frequency === 'weekdays') return `${label} at ${timeLabel} MYT`;
  return `${label}, starting at ${timeLabel} MYT`;
}

export function SyncScheduleForm() {
  const { data: schedule, isLoading } = useSyncSchedule();
  const { isAdmin } = useRole();
  const [friendly, setFriendly] = useState<FriendlySchedule>({
    frequency: 'daily',
    startTime: '06:00',
    isActive: true,
  });
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [dirty, setDirty] = useState(false);

  useEffect(() => {
    if (schedule?.cron_expression != null) {
      setFriendly(cronToFriendly(schedule.cron_expression, schedule.is_active));
      setDirty(false);
    }
  }, [schedule]);

  const update = useCallback((patch: Partial<FriendlySchedule>) => {
    setFriendly(prev => ({ ...prev, ...patch }));
    setDirty(true);
    setFeedback(null);
  }, []);

  async function handleSave() {
    setSaving(true);
    setFeedback(null);
    try {
      const res = await fetch('/api/admin/sync/schedule', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          cron_expression: friendlyToCron(friendly),
          is_active: friendly.isActive,
        }),
      });
      const data = await res.json();
      if (res.ok) {
        setFeedback({ type: 'success', message: 'Schedule saved' });
        setDirty(false);
        mutate('/api/admin/sync/schedule');
      } else {
        setFeedback({ type: 'error', message: data.error ?? 'Failed to save' });
      }
    } catch {
      setFeedback({ type: 'error', message: 'Sync service unreachable' });
    } finally {
      setSaving(false);
    }
  }

  const showTimePicker = friendly.frequency !== 'every_hour';

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
        <CardTitle>Sync Config</CardTitle>
      </CardHeader>
      <CardContent className="space-y-5">
        {!isAdmin && (
          <div className="flex items-center gap-2 rounded-lg bg-amber-50 border border-amber-200 px-3 py-2 text-sm text-amber-800">
            <ShieldAlert className="size-4 shrink-0" />
            Only admins can modify sync settings.
          </div>
        )}

        {/* Frequency */}
        <div className="space-y-1.5">
          <label className="text-sm font-medium block">How often should data sync?</label>
          <Select
            value={friendly.frequency}
            onValueChange={(val) => val && update({ frequency: val as Frequency })}
            disabled={!isAdmin}
          >
            <SelectTrigger className="w-full max-w-[260px]">
              <SelectValue>{FREQUENCY_OPTIONS.find(o => o.value === friendly.frequency)?.label}</SelectValue>
            </SelectTrigger>
            <SelectContent>
              {FREQUENCY_OPTIONS.map(opt => (
                <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Time picker */}
        {showTimePicker && (
          <div className="space-y-1.5">
            <label className="text-sm font-medium block">
              {friendly.frequency === 'daily' || friendly.frequency === 'weekdays'
                ? 'What time?'
                : 'Starting from what hour?'}
            </label>
            <Select
              value={friendly.startTime}
              onValueChange={(val) => val && update({ startTime: val })}
              disabled={!isAdmin}
            >
              <SelectTrigger className="w-full max-w-[180px]">
                <SelectValue>{HOUR_OPTIONS.find(o => o.value === friendly.startTime)?.label}</SelectValue>
              </SelectTrigger>
              <SelectContent>
                {HOUR_OPTIONS.map(opt => (
                  <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        )}

        {/* Active toggle */}
        <label className="flex items-center gap-2.5 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={friendly.isActive}
            onChange={(e) => update({ isActive: e.target.checked })}
            disabled={!isAdmin}
            className="rounded size-4"
          />
          <span className="font-medium">Auto-sync enabled</span>
        </label>

        {/* Summary */}
        <div className="rounded-lg bg-muted/50 px-4 py-3 text-sm">
          <p className="font-medium">{describeSchedule(friendly)}</p>
        </div>

        {/* Save */}
        {isAdmin && (
          <div className="flex items-center gap-3">
            <Button onClick={handleSave} disabled={saving || !dirty}>
              <Save className="size-4" />
              {saving ? 'Saving...' : 'Save Schedule'}
            </Button>
            {feedback && (
              <span className={`text-sm ${feedback.type === 'error' ? 'text-red-600' : 'text-emerald-700'}`}>
                {feedback.message}
              </span>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
