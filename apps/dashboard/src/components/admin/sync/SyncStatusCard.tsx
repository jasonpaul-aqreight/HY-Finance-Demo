'use client';

import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { useSyncStatus } from '@/hooks/admin/useSyncData';
import { RefreshCw, CheckCircle2, XCircle, Loader2 } from 'lucide-react';

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

export function SyncStatusCard() {
  const { data, isLoading } = useSyncStatus();
  const isRunning = data?.status === 'running';
  // Re-fetch faster while running
  const { data: live } = useSyncStatus(isRunning);
  const status = live ?? data;

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Sync Status</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="h-20 flex items-center justify-center text-foreground">Loading...</div>
        </CardContent>
      </Card>
    );
  }

  const last = status?.lastResult;

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle>Sync Status</CardTitle>
        {status?.status === 'running' ? (
          <Badge variant="default" className="gap-1">
            <Loader2 className="size-3 animate-spin" />
            Running
          </Badge>
        ) : (
          <Badge variant="secondary">Idle</Badge>
        )}
      </CardHeader>
      <CardContent className="space-y-3">
        {status?.status === 'running' && status.progress && (
          <div className="flex items-center gap-2 text-sm text-foreground">
            <RefreshCw className="size-4 animate-spin" />
            {status.progress}
          </div>
        )}

        {last && (
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
            <div className="grid grid-cols-2 gap-x-6 gap-y-1">
              <span className="font-medium">Started:</span>
              <span>{formatTime(last.startedAt)}</span>
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

        {!last && status?.status !== 'running' && (
          <p className="text-sm text-foreground">No sync has been run yet.</p>
        )}
      </CardContent>
    </Card>
  );
}
