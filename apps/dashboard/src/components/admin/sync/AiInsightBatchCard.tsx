'use client';

import { useEffect, useMemo, useState } from 'react';
import { mutate } from 'swr';
import {
  AlertTriangle,
  Brain,
  CheckCircle2,
  Clock,
  DollarSign,
  Hash,
  Loader2,
  PlayCircle,
  ShieldAlert,
  XCircle,
} from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useRole } from '@/components/layout/RoleProvider';
import {
  AI_INSIGHT_BATCH_STATUS_KEY,
  useBatchStatus,
  type BatchRunState,
  type BatchRunStatus,
} from '@/hooks/ai-insight/useBatchStatus';

const EST_COST_PER_SECTION_USD = 0.02;
const EST_SECONDS_PER_SECTION = 85;

function formatTime(iso: string) {
  return new Date(iso).toLocaleString('en-MY', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'Asia/Kuala_Lumpur',
  });
}

function formatDurationSeconds(seconds: number) {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  return `${Math.floor(seconds / 60)}m ${Math.round(seconds % 60)}s`;
}

function formatUsd(value: number) {
  return `$${value.toFixed(2)} USD`;
}

function formatStatus(status: BatchRunState) {
  if (status === 'idle') return 'Idle';
  if (status === 'running') return 'Running';
  if (status === 'success') return 'Success';
  if (status === 'partial') return 'Partial';
  return 'Error';
}

function getStatusIcon(status: BatchRunState) {
  if (status === 'success') return <CheckCircle2 className="size-4" />;
  if (status === 'partial') return <AlertTriangle className="size-4" />;
  if (status === 'error') return <XCircle className="size-4" />;
  return <Clock className="size-4" />;
}

function getStatusClass(status: BatchRunState) {
  if (status === 'success') return 'text-emerald-700';
  if (status === 'partial') return 'text-amber-700';
  if (status === 'error') return 'text-red-600';
  return 'text-foreground';
}

function getElapsedSeconds(status: BatchRunStatus) {
  if (!status.started_at) return 0;
  const end = status.finished_at ? new Date(status.finished_at).getTime() : Date.now();
  return Math.max(0, (end - new Date(status.started_at).getTime()) / 1000);
}

function getActualRuntime(status: BatchRunStatus) {
  if (typeof status.total_runtime_s === 'number') {
    return formatDurationSeconds(status.total_runtime_s);
  }
  return formatDurationSeconds(getElapsedSeconds(status));
}

export function AiInsightBatchCard() {
  const { role, isAdmin } = useRole();
  const { data, isLoading, error } = useBatchStatus();
  const firstRunning = data?.status === 'running';
  const { data: live } = useBatchStatus(firstRunning);
  const status = live ?? data;
  const running = status?.status === 'running';

  const [triggerLoading, setTriggerLoading] = useState(false);
  const [startPending, setStartPending] = useState(false);
  const [triggerMsg, setTriggerMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!startPending) return;
    if (running) {
      setStartPending(false);
      return;
    }
    const timeout = window.setTimeout(() => setStartPending(false), 4000);
    return () => window.clearTimeout(timeout);
  }, [running, startPending]);

  const sectionsTotal = status?.sections_total ?? 0;
  const estimate = useMemo(() => {
    const cost = sectionsTotal * EST_COST_PER_SECTION_USD;
    const minutes = Math.round((sectionsTotal * EST_SECONDS_PER_SECTION) / 60);
    return { cost, minutes };
  }, [sectionsTotal]);

  async function handleTrigger() {
    setTriggerLoading(true);
    setTriggerMsg(null);

    try {
      const res = await fetch('/api/admin/ai-insight/batch/trigger', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-user-role': role,
        },
        body: JSON.stringify({ triggeredBy: role }),
      });
      const json = await res.json().catch(() => ({}));

      if (res.ok) {
        setTriggerMsg('AI Insight batch started');
        setStartPending(true);
        mutate(AI_INSIGHT_BATCH_STATUS_KEY);
      } else if (res.status === 403) {
        setTriggerMsg('Admin role required');
      } else if (res.status === 409) {
        setTriggerMsg('Batch already running');
      } else {
        setTriggerMsg(typeof json.error === 'string' ? json.error : 'Failed to start AI Insight batch');
      }
    } catch {
      setTriggerMsg('AI Insight batch service unreachable');
    } finally {
      setTriggerLoading(false);
    }
  }

  if (isLoading && !status) {
    return (
      <Card>
        <CardHeader><CardTitle>AI Insight Batch</CardTitle></CardHeader>
        <CardContent>
          <div className="h-20 flex items-center justify-center text-foreground">Loading...</div>
        </CardContent>
      </Card>
    );
  }

  const progressCompleted = status?.sections_completed ?? 0;
  const progressTotal = status?.sections_total ?? 0;
  const progressPct = progressTotal > 0 ? Math.round((progressCompleted / progressTotal) * 100) : 0;
  const actualCost = status?.total_cost_usd ?? 0;
  const actualTokens = status?.total_tokens ?? 0;
  const buttonBusy = triggerLoading || startPending;
  const buttonDisabled = Boolean(running || !isAdmin || buttonBusy || isLoading);
  const lastRunTime = status?.finished_at ?? status?.started_at ?? status?.created_at ?? null;
  const hasLastRun = Boolean(status?.id && status.status !== 'running');

  return (
    <Card>
      <CardHeader className="flex-row items-center justify-between">
        <CardTitle className="flex items-center gap-2">
          <Brain className="size-5" />
          AI Insight Batch
        </CardTitle>
        <div className="flex items-center gap-3">
          {triggerMsg && <span className="text-sm font-medium text-foreground">{triggerMsg}</span>}
          <Button onClick={handleTrigger} disabled={buttonDisabled} size="default">
            {buttonBusy || running ? (
              <Loader2 className="size-4 animate-spin" />
            ) : (
              <PlayCircle className="size-4" />
            )}
            {running || buttonBusy ? 'Running...' : 'Run AI Insight (all sections)'}
          </Button>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {!isAdmin && (
          <div className="flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm font-medium text-amber-900">
            <ShieldAlert className="size-4 shrink-0" />
            Admin role required to run AI Insight.
          </div>
        )}

        {error && (
          <div className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm font-medium text-red-700">
            Unable to load AI Insight batch status.
          </div>
        )}

        {running && status && (
          <div className="space-y-3">
            <div className="flex items-center justify-between text-sm">
              <Badge variant="default" className="gap-1">
                <Loader2 className="size-3 animate-spin" />
                Running
              </Badge>
              {progressTotal > 0 && (
                <span className="font-semibold text-foreground">
                  {progressCompleted}/{progressTotal} sections
                </span>
              )}
            </div>
            <div className="h-2.5 w-full overflow-hidden rounded-full bg-border">
              <div
                className="h-full rounded-full bg-primary transition-all duration-500 ease-out"
                style={{ width: `${progressPct}%` }}
              />
            </div>
            <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm text-foreground">
              <span className="font-semibold">Current section:</span>
              <span>{status.current_section ?? 'Starting...'}</span>
              <span className="font-semibold">Elapsed:</span>
              <span>{formatDurationSeconds(getElapsedSeconds(status))}</span>
              <span className="font-semibold flex items-center gap-1.5"><DollarSign className="size-3.5" /> Cost so far:</span>
              <span>{formatUsd(actualCost)}</span>
              <span className="font-semibold flex items-center gap-1.5"><Hash className="size-3.5" /> Tokens so far:</span>
              <span>{actualTokens.toLocaleString('en-MY')}</span>
            </div>
          </div>
        )}

        {!running && hasLastRun && status && (
          <div className="space-y-3 text-sm text-foreground">
            <div className="flex items-center gap-2">
              <span className="font-semibold">Last AI Insight batch:</span>
              <span className={`flex items-center gap-1 font-semibold ${getStatusClass(status.status)}`}>
                {getStatusIcon(status.status)}
                {formatStatus(status.status)}
              </span>
            </div>
            <div className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1">
              {lastRunTime && (
                <>
                  <span className="font-semibold flex items-center gap-1.5"><Clock className="size-3.5" /> Completed:</span>
                  <span>{formatTime(lastRunTime)}</span>
                </>
              )}
              <span className="font-semibold">Runtime:</span>
              <span>{getActualRuntime(status)}</span>
              <span className="font-semibold">Sections:</span>
              <span>{status.sections_completed}/{status.sections_total} completed, {status.sections_failed} failed</span>
              <span className="font-semibold flex items-center gap-1.5"><DollarSign className="size-3.5" /> Actual cost:</span>
              <span>{formatUsd(actualCost)}</span>
              <span className="font-semibold flex items-center gap-1.5"><Hash className="size-3.5" /> Total tokens:</span>
              <span>{actualTokens.toLocaleString('en-MY')}</span>
            </div>
            {status.error_message && (
              <p className="text-sm font-medium text-red-700">{status.error_message}</p>
            )}
            {status.section_errors.length > 0 && (
              <div className="space-y-1 rounded-lg border border-amber-300 bg-amber-50 p-3 text-amber-950">
                <p className="font-semibold">Section errors</p>
                {status.section_errors.map((item) => (
                  <p key={`${item.sectionKey}-${item.message}`}>
                    <span className="font-semibold">{item.sectionKey}:</span> {item.message}
                  </p>
                ))}
              </div>
            )}
          </div>
        )}

        {!running && !hasLastRun && (
          <p className="text-sm text-foreground">No AI Insight batch has been run yet.</p>
        )}

        {sectionsTotal > 0 && (
          <div className="border-t pt-3 text-sm text-foreground">
            <span className="font-semibold">Rough estimate:</span>{' '}
            ~{formatUsd(estimate.cost)}, ~{estimate.minutes} min for {sectionsTotal} sections.
          </div>
        )}
      </CardContent>
    </Card>
  );
}
