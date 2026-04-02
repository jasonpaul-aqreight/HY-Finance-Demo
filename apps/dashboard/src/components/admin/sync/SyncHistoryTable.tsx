'use client';

import {
  Table,
  TableHeader,
  TableBody,
  TableHead,
  TableRow,
  TableCell,
} from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { useSyncHistory, type SyncJob } from '@/hooks/admin/useSyncData';
import { CheckCircle2, XCircle, AlertTriangle, Loader2 } from 'lucide-react';

function formatTime(iso: string) {
  return new Date(iso).toLocaleString('en-MY', {
    day: '2-digit',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hour12: true,
    timeZone: 'Asia/Kuala_Lumpur',
  });
}

function formatDuration(start: string, end: string) {
  const ms = new Date(end).getTime() - new Date(start).getTime();
  if (ms < 1000) return `${ms}ms`;
  const s = Math.round(ms / 1000);
  if (s < 60) return `${s}s`;
  return `${Math.floor(s / 60)}m ${s % 60}s`;
}

function StatusIcon({ status }: { status: string }) {
  switch (status) {
    case 'success':
      return <CheckCircle2 className="size-4 text-emerald-600" />;
    case 'error':
      return <XCircle className="size-4 text-red-600" />;
    case 'partial':
      return <AlertTriangle className="size-4 text-amber-600" />;
    case 'running':
      return <Loader2 className="size-4 text-blue-600 animate-spin" />;
    default:
      return <Loader2 className="size-4 text-foreground/50" />;
  }
}

function StatusLabel({ status }: { status: string }) {
  switch (status) {
    case 'success': return <span className="text-emerald-700">Success</span>;
    case 'error': return <span className="text-red-600">Failed</span>;
    case 'partial': return <span className="text-amber-700">Partial</span>;
    case 'running': return <span className="text-blue-600">Running</span>;
    default: return <span className="text-foreground/70">{status}</span>;
  }
}

export function SyncHistoryTable() {
  const { data: allJobs, isLoading } = useSyncHistory();

  // Limit to 10 latest
  const jobs = allJobs?.slice(0, 10);

  return (
    <Card className="lg:min-h-[calc(100vh-200px)]">
      <CardHeader>
        <CardTitle>Sync History</CardTitle>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="h-32 flex items-center justify-center text-foreground">Loading...</div>
        ) : !jobs?.length ? (
          <p className="text-sm text-foreground">No sync jobs found.</p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Status</TableHead>
                <TableHead>Trigger</TableHead>
                <TableHead>Time</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead className="text-right">Rows</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {jobs.map((job: SyncJob) => (
                <TableRow key={job.id}>
                  <TableCell>
                    <div className="flex items-center gap-1.5">
                      <StatusIcon status={job.status} />
                      <StatusLabel status={job.status} />
                    </div>
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className="capitalize">
                      {job.trigger_type}
                    </Badge>
                  </TableCell>
                  <TableCell>{formatTime(job.started_at)}</TableCell>
                  <TableCell>
                    {job.completed_at
                      ? formatDuration(job.started_at, job.completed_at)
                      : '—'}
                  </TableCell>
                  <TableCell className="text-right">
                    {job.rows_synced?.toLocaleString() ?? '—'}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
