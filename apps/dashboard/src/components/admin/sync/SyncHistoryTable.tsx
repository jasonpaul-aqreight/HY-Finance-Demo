'use client';

import { Fragment, useState } from 'react';
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
import { useSyncHistory, useSyncLogs, type SyncJob } from '@/hooks/admin/useSyncData';
import { CheckCircle2, XCircle, ChevronDown, ChevronRight } from 'lucide-react';

function formatTime(iso: string) {
  return new Date(iso).toLocaleString('en-MY', {
    dateStyle: 'short',
    timeStyle: 'short',
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

function LogsPanel({ jobId }: { jobId: number }) {
  const { data: logs, isLoading } = useSyncLogs(jobId);

  if (isLoading) return <div className="p-3 text-sm text-foreground">Loading logs...</div>;
  if (!logs?.length) return <div className="p-3 text-sm text-foreground">No logs available.</div>;

  return (
    <div className="max-h-64 overflow-y-auto bg-muted/30 rounded p-3">
      <table className="w-full text-xs">
        <thead>
          <tr className="text-left font-medium">
            <th className="pr-3 pb-1">Phase</th>
            <th className="pr-3 pb-1">Table</th>
            <th className="pr-3 pb-1">Message</th>
            <th className="pr-3 pb-1 text-right">Rows</th>
            <th className="pr-3 pb-1 text-right">Time</th>
          </tr>
        </thead>
        <tbody>
          {logs.map((log, i) => (
            <tr key={i} className={log.level === 'error' ? 'text-red-600' : ''}>
              <td className="pr-3 py-0.5">{log.phase}</td>
              <td className="pr-3 py-0.5">{log.table_name}</td>
              <td className="pr-3 py-0.5">{log.message}</td>
              <td className="pr-3 py-0.5 text-right">{log.rows_affected?.toLocaleString() ?? '-'}</td>
              <td className="pr-3 py-0.5 text-right">{log.duration_ms != null ? `${log.duration_ms}ms` : '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function SyncHistoryTable() {
  const { data: jobs, isLoading } = useSyncHistory();
  const [expandedId, setExpandedId] = useState<number | null>(null);

  return (
    <Card>
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
                <TableHead className="w-8"></TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Trigger</TableHead>
                <TableHead>Started</TableHead>
                <TableHead>Duration</TableHead>
                <TableHead className="text-right">Tables</TableHead>
                <TableHead className="text-right">Rows</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {jobs.map((job: SyncJob) => (
                <Fragment key={job.id}>
                  <TableRow
                    className="cursor-pointer"
                    onClick={() => setExpandedId(expandedId === job.id ? null : job.id)}
                  >
                    <TableCell>
                      {expandedId === job.id ? (
                        <ChevronDown className="size-4" />
                      ) : (
                        <ChevronRight className="size-4" />
                      )}
                    </TableCell>
                    <TableCell>
                      {job.status === 'success' ? (
                        <span className="flex items-center gap-1 text-emerald-700">
                          <CheckCircle2 className="size-4" /> Success
                        </span>
                      ) : (
                        <span className="flex items-center gap-1 text-red-600">
                          <XCircle className="size-4" /> Error
                        </span>
                      )}
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
                        : 'In progress'}
                    </TableCell>
                    <TableCell className="text-right">
                      {job.tables_completed}/{job.tables_total}
                    </TableCell>
                    <TableCell className="text-right">
                      {job.rows_synced?.toLocaleString() ?? '-'}
                    </TableCell>
                  </TableRow>
                  {expandedId === job.id && (
                    <TableRow key={`${job.id}-logs`}>
                      <TableCell colSpan={7} className="p-0 px-2 pb-2">
                        <LogsPanel jobId={job.id} />
                        {job.error_message && (
                          <p className="text-xs text-red-600 px-3 pb-2">{job.error_message}</p>
                        )}
                      </TableCell>
                    </TableRow>
                  )}
                </Fragment>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}
