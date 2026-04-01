'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';
import { mutate } from 'swr';

export function SyncTriggerButton() {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  async function handleTrigger() {
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch('/api/admin/sync/trigger', { method: 'POST' });
      const data = await res.json();
      if (res.ok) {
        setMessage('Sync started');
        // Refresh status and history
        mutate('/api/admin/sync/status');
        mutate('/api/admin/sync/history');
      } else {
        setMessage(data.error ?? 'Failed to trigger sync');
      }
    } catch {
      setMessage('Sync service unreachable');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center gap-3">
      <Button onClick={handleTrigger} disabled={loading} size="lg">
        <RefreshCw className={`size-4 ${loading ? 'animate-spin' : ''}`} />
        {loading ? 'Triggering...' : 'Sync Now'}
      </Button>
      {message && (
        <span className="text-sm text-foreground">{message}</span>
      )}
    </div>
  );
}
