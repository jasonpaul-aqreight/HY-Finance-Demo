'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeftIcon } from 'lucide-react';
import useSWR, { mutate } from 'swr';
import { Card, CardHeader, CardTitle, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';

const fetcher = (url: string) => fetch(url).then(r => r.json());

// ─── Types ───────────────────────────────────────────────────────────────

interface SettingsV2 {
  creditScoreWeights: {
    utilization: number;
    overdueDays: number;
    paymentConsistency: number;
    timeliness: number;
    breach: number;
  };
  riskThresholds: { low: number; moderate: number; high: number };
}

const DEFAULTS_V2: SettingsV2 = {
  creditScoreWeights: { utilization: 35, overdueDays: 25, paymentConsistency: 15, timeliness: 15, breach: 10 },
  riskThresholds: { low: 85, moderate: 65, high: 35 },
};

// ─── Shared input ───────────────────────────────────────────────────────────

function NumberInput({
  label,
  value,
  onChange,
  suffix,
  min,
  max,
  description,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  suffix?: string;
  min?: number;
  max?: number;
  description?: string;
}) {
  return (
    <div>
      <label className="text-sm font-medium">{label}</label>
      {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
      <div className="mt-1 flex items-center gap-2">
        <input
          type="number"
          value={value}
          onChange={e => onChange(Number(e.target.value))}
          min={min}
          max={max}
          className="h-8 w-24 rounded-md border border-input bg-transparent px-2.5 text-sm"
        />
        {suffix && <span className="text-sm text-muted-foreground">{suffix}</span>}
      </div>
    </div>
  );
}

// ─── Risk Thresholds Card ────────────────────────────────────────────────

function RiskThresholdsCard({
  thresholds,
  onChange,
}: {
  thresholds: { low: number; moderate: number; high: number };
  onChange: (t: { low: number; moderate: number; high: number }) => void;
}) {
  return (
    <Card>
      <CardHeader><CardTitle>Risk Level Thresholds</CardTitle></CardHeader>
      <CardContent>
        <p className="mb-3 text-sm text-muted-foreground">
          Credit score cutoffs for each risk category.
        </p>
        <div className="grid grid-cols-3 gap-4">
          <NumberInput label="Low Risk (score >=)" value={thresholds.low}
            onChange={v => onChange({ ...thresholds, low: v })} min={1} max={100} />
          <NumberInput label="Moderate (score >=)" value={thresholds.moderate}
            onChange={v => onChange({ ...thresholds, moderate: v })} min={1} max={100} />
          <NumberInput label="High Risk (score <)" value={thresholds.high}
            onChange={v => onChange({ ...thresholds, high: v })} min={0} max={100}
            description="Scores below Moderate threshold are High risk." />
        </div>
      </CardContent>
    </Card>
  );
}

// ─── Main component ─────────────────────────────────────────────────────────

export default function SettingsForm() {
  const { data: serverSettings, isLoading } = useSWR<Record<string, unknown>>(
    '/api/payment/settings',
    fetcher,
    { revalidateOnFocus: false },
  );
  const [form, setForm] = useState<SettingsV2>(DEFAULTS_V2);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    if (serverSettings) {
      const v2 = serverSettings.v2 as SettingsV2 | undefined;
      if (v2) setForm({ ...DEFAULTS_V2, ...v2 });
    }
  }, [serverSettings]);

  const weightSum =
    form.creditScoreWeights.utilization +
    form.creditScoreWeights.overdueDays +
    form.creditScoreWeights.paymentConsistency +
    form.creditScoreWeights.timeliness +
    form.creditScoreWeights.breach;

  const isValid = weightSum === 100;

  const handleSave = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const res = await fetch('/api/payment/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ v2: form }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage({ type: 'error', text: data.error ?? 'Failed to save' });
      } else {
        setMessage({ type: 'success', text: 'Settings saved successfully' });
        mutate('/api/payment/settings');
      }
    } catch {
      setMessage({ type: 'error', text: 'Network error' });
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    setForm(DEFAULTS_V2);
    setMessage(null);
  };

  if (isLoading) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-8">
        <div className="h-8 w-32 animate-pulse rounded bg-muted" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-2xl px-4 py-8">
      {/* Header */}
      <div className="mb-6 flex items-center gap-3">
        <Link href="/payment" className="rounded-lg p-2 text-muted-foreground hover:bg-muted hover:text-foreground">
          <ArrowLeftIcon className="size-5" />
        </Link>
        <h1 className="text-2xl font-bold">Credit Score Settings</h1>
      </div>

      <div className="space-y-4">
        {/* Credit Score Weights */}
        <Card>
          <CardHeader><CardTitle>Credit Score Weights</CardTitle></CardHeader>
          <CardContent>
            <p className="mb-3 text-sm text-muted-foreground">
              How much each factor contributes to the credit score. Must sum to 100.
            </p>
            <div className="grid grid-cols-2 gap-x-6 gap-y-5">
              <NumberInput label="Credit Utilization" value={form.creditScoreWeights.utilization}
                description="Outstanding balance as a percentage of credit limit. Lower utilization = higher score."
                onChange={v => setForm(f => ({ ...f, creditScoreWeights: { ...f.creditScoreWeights, utilization: v } }))}
                suffix="%" min={0} max={100} />
              <NumberInput label="Overdue Days" value={form.creditScoreWeights.overdueDays}
                description="Age of the oldest overdue invoice. Fewer overdue days = higher score."
                onChange={v => setForm(f => ({ ...f, creditScoreWeights: { ...f.creditScoreWeights, overdueDays: v } }))}
                suffix="%" min={0} max={100} />
              <NumberInput label="Payment Consistency" value={form.creditScoreWeights.paymentConsistency}
                description="Ratio of months with payments to months with invoices (last 12 months). More consistent = higher score."
                onChange={v => setForm(f => ({ ...f, creditScoreWeights: { ...f.creditScoreWeights, paymentConsistency: v } }))}
                suffix="%" min={0} max={100} />
              <NumberInput label="Payment Timeliness" value={form.creditScoreWeights.timeliness}
                description="Average days late across paid invoices (last 12 months). Paying on time or early = higher score."
                onChange={v => setForm(f => ({ ...f, creditScoreWeights: { ...f.creditScoreWeights, timeliness: v } }))}
                suffix="%" min={0} max={100} />
              <NumberInput label="Overdue Limit Breach" value={form.creditScoreWeights.breach}
                description="Whether outstanding exceeds credit or overdue limit. No breach = 100, breach = 0."
                onChange={v => setForm(f => ({ ...f, creditScoreWeights: { ...f.creditScoreWeights, breach: v } }))}
                suffix="%" min={0} max={100} />
            </div>
            <p className={`mt-3 text-sm font-medium ${weightSum === 100 ? 'text-emerald-600' : 'text-red-600'}`}>
              Sum: {weightSum}/100{weightSum !== 100 && ' — must equal 100'}
            </p>
          </CardContent>
        </Card>

        <RiskThresholdsCard
          thresholds={form.riskThresholds}
          onChange={t => setForm(f => ({ ...f, riskThresholds: t }))}
        />
      </div>

      {/* Sticky bottom bar */}
      <div className="sticky bottom-0 mt-6 flex items-center gap-3 border-t bg-background py-4">
        {message && (
          <p className={`flex-1 text-sm ${message.type === 'success' ? 'text-emerald-600' : 'text-red-600'}`}>
            {message.text}
          </p>
        )}
        {!message && <div className="flex-1" />}
        <Button variant="outline" onClick={handleReset}>
          Reset to Defaults
        </Button>
        <Button onClick={handleSave} disabled={!isValid || saving}>
          {saving ? 'Saving...' : 'Save'}
        </Button>
      </div>
    </div>
  );
}
