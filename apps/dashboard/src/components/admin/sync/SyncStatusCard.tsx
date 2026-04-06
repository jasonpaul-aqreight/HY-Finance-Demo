'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { useSyncStatus, useSyncSchedule } from '@/hooks/admin/useSyncData';
import { mutate } from 'swr';
import { RefreshCw, CheckCircle2, XCircle, Loader2, Clock, CalendarClock } from 'lucide-react';

function formatDuration(ms: number) {
  if (ms < 1000) return `${ms}ms`;
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m ${s % 60}s`;
}

function formatTime(iso: string) {
  return new Date(iso).toLocaleString('en-MY', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Kuala_Lumpur',
  });
}

/** Compute next sync time from a cron expression (MYT) */
function getNextSyncLabel(cron: string, isActive: boolean): string | null {
  if (!isActive) return 'Auto-sync is paused';
  const parts = cron.split(' ');
  if (parts.length !== 5) return null;
  const [minField, hourField, , , dow] = parts;
  const minute = parseInt(minField, 10) || 0;

  const now = new Date();
  const myt = new Date(now.toLocaleString('en-US', { timeZone: 'Asia/Kuala_Lumpur' }));
  const currentHour = myt.getHours();
  const currentMin = myt.getMinutes();
  const currentDay = myt.getDay();

  let nextHour: number;
  let daysOffset = 0;

  if (hourField === '*') {
    // Every hour at :minute
    nextHour = currentMin >= minute ? currentHour + 1 : currentHour;
    if (nextHour >= 24) { nextHour = 0; daysOffset = 1; }
  } else if (hourField.startsWith('*/')) {
    const step = parseInt(hourField.slice(2), 10);
    nextHour = 0;
    while (nextHour <= currentHour) nextHour += step;
    if (nextHour === currentHour && currentMin >= minute) nextHour += step;
    if (nextHour >= 24) { nextHour = nextHour % step; daysOffset = 1; }
  } else if (hourField.includes('/')) {
    const [offset, step] = hourField.split('/').map(Number);
    nextHour = offset;
    while (nextHour < currentHour || (nextHour === currentHour && currentMin >= minute)) nextHour += step;
    if (nextHour >= 24) { nextHour = offset; daysOffset = 1; }
  } else if (hourField.includes(',')) {
    const hours = hourField.split(',').map(Number).sort((a, b) => a - b);
    const found = hours.find(h => h > currentHour || (h === currentHour && currentMin < minute));
    if (found !== undefined) { nextHour = found; } else { nextHour = hours[0]; daysOffset = 1; }
  } else {
    nextHour = parseInt(hourField, 10);
    if (currentHour > nextHour || (currentHour === nextHour && currentMin >= minute)) daysOffset = 1;
  }

  // Weekdays check
  if (dow === '1-5') {
    let checkDay = (currentDay + daysOffset) % 7;
    while (checkDay === 0 || checkDay === 6) { daysOffset++; checkDay = (currentDay + daysOffset) % 7; }
  }

  const nextDate = new Date(myt);
  nextDate.setDate(nextDate.getDate() + daysOffset);
  nextDate.setHours(nextHour, minute, 0, 0);

  const timeStr = nextDate.toLocaleTimeString('en-MY', { hour: '2-digit', minute: '2-digit', hour12: true });
  if (daysOffset === 0) return `Today at ${timeStr} MYT`;
  if (daysOffset === 1) return `Tomorrow at ${timeStr} MYT`;
  const dayStr = nextDate.toLocaleDateString('en-MY', { weekday: 'long', day: 'numeric', month: 'short' });
  return `${dayStr} at ${timeStr} MYT`;
}

export function SyncStatusCard() {
  const { data, isLoading } = useSyncStatus();
  const isRunning = data?.status === 'running';
  const { data: live } = useSyncStatus(isRunning);
  const status = live ?? data;
  const { data: schedule } = useSyncSchedule();

  const [triggerLoading, setTriggerLoading] = useState(false);
  const [triggerMsg, setTriggerMsg] = useState<string | null>(null);

  async function handleTrigger() {
    setTriggerLoading(true);
    setTriggerMsg(null);
    try {
      const res = await fetch('/api/admin/sync/trigger', { method: 'POST' });
      const json = await res.json();
      if (res.ok) {
        setTriggerMsg('Sync started');
        mutate('/api/admin/sync/status');
        mutate('/api/admin/sync/history');
      } else {
        setTriggerMsg(json.error ?? 'Failed to trigger sync');
      }
    } catch {
      setTriggerMsg('Sync service unreachable');
    } finally {
      setTriggerLoading(false);
    }
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader><CardTitle>Sync Overview</CardTitle></CardHeader>
        <CardContent>
          <div className="h-20 flex items-center justify-center text-foreground">Loading...</div>
        </CardContent>
      </Card>
    );
  }

  const last = status?.lastResult;
  const running = status?.status === 'running';

  const progressCompleted = status?.stepsCompleted ?? 0;
  const progressTotal = status?.totalSteps ?? 0;
  const progressPct = progressTotal > 0 ? Math.round((progressCompleted / progressTotal) * 100) : 0;

  const nextSyncLabel = schedule?.cron_expression
    ? getNextSyncLabel(schedule.cron_expression, schedule.is_active)
    : null;

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>Sync Overview</CardTitle>
        <div className="flex items-center gap-3">
          {triggerMsg && <span className="text-sm text-foreground">{triggerMsg}</span>}
          <Button onClick={handleTrigger} disabled={triggerLoading || running} size="default">
            <RefreshCw className={`size-4 ${triggerLoading || running ? 'animate-spin' : ''}`} />
            {running ? 'Syncing...' : 'Sync Now'}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Running state with progress bar */}
        {running && (
          <div className="space-y-2">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center gap-2">
                <Badge variant="default" className="gap-1">
                  <Loader2 className="size-3 animate-spin" />
                  Running
                </Badge>
              </div>
              {progressTotal > 0 && (
                <span className="font-medium">{progressCompleted}/{progressTotal} tables</span>
              )}
            </div>
            {/* Progress bar */}
            <div className="w-full bg-muted rounded-full h-2.5 overflow-hidden">
              <div
                className="bg-primary h-full rounded-full transition-all duration-500 ease-out"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            {status?.progress && (
              <p className="text-sm text-foreground/70">{status.progress}</p>
            )}
          </div>
        )}

        {/* Idle state — last sync result */}
        {!running && last && (
          <div className="space-y-2 text-sm">
            <div className="flex items-center gap-2">
              <span className="font-medium">Last sync:</span>
              {last.status === 'success' ? (
                <span className="flex items-center gap-1 text-emerald-700">
                  <CheckCircle2 className="size-4" /> Success
                </span>
              ) : (
                <span className="flex items-center gap-1 text-red-600">
                  <XCircle className="size-4" /> Error
                </span>
              )}
            </div>
            <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
              <span className="font-medium flex items-center gap-1.5"><Clock className="size-3.5" /> Completed:</span>
              <span>{formatTime(last.completedAt ?? last.startedAt)}</span>
              <span className="font-medium">Duration:</span>
              <span>{formatDuration(last.durationMs)}</span>
              <span className="font-medium">Rows synced:</span>
              <span>{last.totalRows.toLocaleString()}</span>
            </div>
            {last.error && (
              <p className="text-red-600 text-xs mt-1">{last.error}</p>
            )}
          </div>
        )}

        {!running && !last && (
          <p className="text-sm text-foreground">No sync has been run yet. Click &quot;Sync Now&quot; to start.</p>
        )}

        {/* Next scheduled sync */}
        {nextSyncLabel && !running && (
          <div className="flex items-center gap-2 text-sm text-foreground/70 pt-1 border-t">
            <CalendarClock className="size-4" />
            <span>Next sync: {nextSyncLabel}</span>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
