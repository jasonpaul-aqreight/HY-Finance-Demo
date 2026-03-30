'use client';

import { useState, useEffect, useRef } from 'react';
import { ChevronDownIcon, ChevronRightIcon } from 'lucide-react';
import useSWR, { mutate, useSWRConfig } from 'swr';
import { Dialog, DialogContent } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { useRole } from '@/components/layout/RoleProvider';

const fetcher = (url: string) => fetch(url).then(r => r.json());

// ─── Types ───────────────────────────────────────────────────────────────

interface SettingsV2 {
  creditScoreWeights: {
    utilization: number;
    overdueDays: number;
    timeliness: number;
    doubleBreach: number;
  };
  riskThresholds: { low: number; high: number };
}

const DEFAULTS_V2: SettingsV2 = {
  creditScoreWeights: { utilization: 40, overdueDays: 30, timeliness: 20, doubleBreach: 10 },
  riskThresholds: { low: 75, high: 30 },
};

// ─── Shared input ───────────────────────────────────────────────────────────

function NumberInput({
  label, value, onChange, suffix, min, max, disabled,
}: {
  label: string; value: number; onChange: (v: number) => void;
  suffix?: string; min?: number; max?: number; disabled?: boolean;
}) {
  return (
    <div>
      <label className="text-sm font-medium">{label}</label>
      <div className="mt-1 flex items-center gap-2">
        <input type="number" value={value} onChange={e => onChange(Number(e.target.value))}
          min={min} max={max} disabled={disabled}
          className="h-8 w-24 rounded-md border border-input bg-transparent px-2.5 text-sm disabled:opacity-50 disabled:cursor-not-allowed" />
        {suffix && <span className="text-sm text-muted-foreground">{suffix}</span>}
      </div>
    </div>
  );
}

// ─── Risk Threshold Visual Bar ──────────────────────────────────────────────

function RiskThresholdBar({ low, high }: { low: number; high: number }) {
  const highPct = Math.max(0, Math.min(100, high));
  const lowPct = Math.max(0, Math.min(100, low));

  return (
    <div className="mt-4">
      <div className="relative h-7 w-full overflow-hidden rounded-lg border border-border">
        <div className="absolute inset-y-0 left-0 bg-red-400" style={{ width: `${highPct}%` }} />
        <div className="absolute inset-y-0 bg-yellow-400" style={{ left: `${highPct}%`, width: `${Math.max(0, lowPct - highPct)}%` }} />
        <div className="absolute inset-y-0 right-0 bg-emerald-400" style={{ width: `${100 - lowPct}%` }} />
      </div>
      <div className="relative mt-1.5 h-5 text-xs">
        <span className="absolute left-0 text-red-600 font-medium">0</span>
        {highPct > 5 && highPct < 95 && (
          <span className="absolute -translate-x-1/2 text-red-600 font-medium" style={{ left: `${highPct}%` }}>{high}</span>
        )}
        {lowPct > 5 && lowPct < 95 && Math.abs(lowPct - highPct) > 8 && (
          <span className="absolute -translate-x-1/2 text-emerald-600 font-medium" style={{ left: `${lowPct}%` }}>{low}</span>
        )}
        <span className="absolute right-0 text-emerald-600 font-medium">100</span>
      </div>
      <div className="mt-2 flex items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-sm bg-red-400" /> High Risk (0–{high})
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-sm bg-yellow-400" /> Moderate ({high + 1}–{low - 1})
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-2.5 rounded-sm bg-emerald-400" /> Low Risk ({low}–100)
        </span>
      </div>
    </div>
  );
}

// ─── Score Table ─────────────────────────────────────────────────────────────

function ScoreTable({ rows }: { rows: [string, string][] }) {
  return (
    <table className="mt-2 w-full text-sm">
      <thead>
        <tr className="border-b">
          <th className="py-1 pr-4 text-left font-medium text-foreground">Condition</th>
          <th className="py-1 text-left font-medium text-foreground">Score</th>
        </tr>
      </thead>
      <tbody className="text-muted-foreground">
        {rows.map(([condition, score], i) => (
          <tr key={i} className="border-b border-border/50">
            <td className="py-1 pr-4">{condition}</td>
            <td className="py-1">{score}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

// ─── How It Works (Collapsible) ─────────────────────────────────────────────

function HowItWorks() {
  const [open, setOpen] = useState(false);

  return (
    <div className="rounded-lg border">
      <button type="button" className="flex w-full items-center justify-between px-4 py-3 text-left"
        onClick={() => setOpen(!open)}>
        <h3 className="text-sm font-semibold">How It Works</h3>
        {open ? <ChevronDownIcon className="size-4 text-muted-foreground" /> : <ChevronRightIcon className="size-4 text-muted-foreground" />}
      </button>
      {open && (
        <div className="space-y-5 border-t px-4 py-3">
          <p className="text-sm text-muted-foreground">
            Each customer gets a score from <strong>0</strong> (worst) to <strong>100</strong> (best).
            The score is made up of 4 parts. The higher the score, the safer the customer.
          </p>

          <div>
            <h4 className="text-sm font-semibold">1. Credit Utilization</h4>
            <p className="mt-1 text-sm text-muted-foreground">How much of their credit limit has the customer used? Less usage = higher score.</p>
            <div className="mt-2 rounded-md bg-muted/50 px-3 py-2 text-sm text-muted-foreground"><strong>Formula:</strong> Score = 100 - Utilization%</div>
            <p className="mt-1.5 text-xs text-muted-foreground italic">Example: Credit limit RM 50,000, owes RM 20,000 → 40% used → Score = 60</p>
            <ScoreTable rows={[['0% used', '100 (best)'], ['40% used', '60'], ['80% used', '20'], ['100% or more', '0 (worst)']]} />
            <p className="mt-1.5 text-xs text-muted-foreground">* Customers with no credit limit set are not scored on this factor.</p>
          </div>

          <div>
            <h4 className="text-sm font-semibold">2. Overdue Days</h4>
            <p className="mt-1 text-sm text-muted-foreground">How long has the oldest unpaid invoice been overdue? Shorter wait = higher score.</p>
            <ScoreTable rows={[['Nothing overdue', '100 (best)'], ['1 – 30 days late', '80'], ['31 – 60 days late', '60'], ['61 – 90 days late', '40'], ['91 – 120 days late', '20'], ['More than 120 days', '0 (worst)']]} />
            <p className="mt-1.5 text-xs text-muted-foreground italic">Example: Oldest unpaid invoice is 45 days overdue → Score = 60</p>
          </div>

          <div>
            <h4 className="text-sm font-semibold">3. Payment Timeliness</h4>
            <p className="mt-1 text-sm text-muted-foreground">When this customer pays, how many days late are they on average? Looks at the last 12 months. Paying on time = highest score.</p>
            <ScoreTable rows={[['On time or early', '100 (best)'], ['1 – 7 days late', '80'], ['8 – 14 days late', '60'], ['15 – 30 days late', '40'], ['31 – 60 days late', '20'], ['More than 60 days late', '0 (worst)']]} />
            <p className="mt-1.5 text-xs text-muted-foreground italic">Example: Customer pays on average 5 days late → Score = 80</p>
          </div>

          <div>
            <h4 className="text-sm font-semibold">4. Double Breach</h4>
            <p className="mt-1 text-sm text-muted-foreground">Has the customer gone over <strong>both</strong> their credit limit and overdue limit at the same time?</p>
            <ScoreTable rows={[['Neither or only one limit breached', '100 (safe)'], ['Both limits breached', '0 (danger)']]} />
          </div>

          <div>
            <h4 className="text-sm font-semibold">Putting It All Together</h4>
            <div className="mt-1 rounded-md bg-muted/50 px-3 py-2 text-sm text-muted-foreground">
              <strong>Final Score</strong> = (Utilization score x weight) + (Overdue score x weight) + (Timeliness score x weight) + (Double Breach score x weight)
            </div>
          </div>

          <div>
            <h4 className="text-sm font-semibold">Risk Levels</h4>
            <table className="mt-2 w-full text-sm">
              <thead><tr className="border-b">
                <th className="py-1.5 pr-4 text-left font-medium text-foreground">Level</th>
                <th className="py-1.5 pr-4 text-left font-medium text-foreground">Score</th>
                <th className="py-1.5 text-left font-medium text-foreground">What to do</th>
              </tr></thead>
              <tbody className="text-muted-foreground">
                <tr className="border-b border-border/50">
                  <td className="py-1.5 pr-4"><span className="inline-flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-sm bg-emerald-400" />Low Risk</span></td>
                  <td className="py-1.5 pr-4">75 and above</td>
                  <td className="py-1.5">All good. Customer pays on time and within limits.</td>
                </tr>
                <tr className="border-b border-border/50">
                  <td className="py-1.5 pr-4"><span className="inline-flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-sm bg-yellow-400" />Moderate</span></td>
                  <td className="py-1.5 pr-4">31 – 74</td>
                  <td className="py-1.5">Watch closely. Follow up on overdue payments.</td>
                </tr>
                <tr className="border-b border-border/50">
                  <td className="py-1.5 pr-4"><span className="inline-flex items-center gap-1.5"><span className="inline-block h-2.5 w-2.5 rounded-sm bg-red-400" />High Risk</span></td>
                  <td className="py-1.5 pr-4">30 and below</td>
                  <td className="py-1.5">Needs immediate attention. Consider pausing supply.</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Settings Dialog ─────────────────────────────────────────────────────────

interface SettingsDialogProps {
  open: boolean;
  onClose: () => void;
  onSaved?: () => void;
}

export function SettingsDialog({ open, onClose, onSaved }: SettingsDialogProps) {
  const { isAdmin } = useRole();
  const { cache } = useSWRConfig();
  const { data: serverSettings } = useSWR<Record<string, unknown>>(
    open ? '/api/payment/settings' : null,
    fetcher,
    { revalidateOnFocus: false },
  );
  const [form, setForm] = useState<SettingsV2>(DEFAULTS_V2);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [fading, setFading] = useState(false);
  const fadeTimer = useRef<ReturnType<typeof setTimeout>>();
  const clearTimer = useRef<ReturnType<typeof setTimeout>>();

  // Auto-dismiss success messages after 3 seconds with fade
  useEffect(() => {
    if (message?.type === 'success') {
      fadeTimer.current = setTimeout(() => setFading(true), 3000);
      clearTimer.current = setTimeout(() => { setMessage(null); setFading(false); }, 3500);
    }
    return () => { clearTimeout(fadeTimer.current); clearTimeout(clearTimer.current); };
  }, [message]);

  useEffect(() => {
    if (serverSettings) {
      const v2 = serverSettings.v2 as SettingsV2 | undefined;
      if (v2) {
        setForm({
          creditScoreWeights: {
            utilization: v2.creditScoreWeights?.utilization ?? DEFAULTS_V2.creditScoreWeights.utilization,
            overdueDays: v2.creditScoreWeights?.overdueDays ?? DEFAULTS_V2.creditScoreWeights.overdueDays,
            timeliness: v2.creditScoreWeights?.timeliness ?? DEFAULTS_V2.creditScoreWeights.timeliness,
            doubleBreach: v2.creditScoreWeights?.doubleBreach ?? DEFAULTS_V2.creditScoreWeights.doubleBreach,
          },
          riskThresholds: {
            low: v2.riskThresholds?.low ?? DEFAULTS_V2.riskThresholds.low,
            high: v2.riskThresholds?.high ?? DEFAULTS_V2.riskThresholds.high,
          },
        });
      }
    }
  }, [serverSettings]);

  // Reset message when dialog opens
  useEffect(() => { if (open) { setMessage(null); setFading(false); } }, [open]);

  const weightSum =
    form.creditScoreWeights.utilization +
    form.creditScoreWeights.overdueDays +
    form.creditScoreWeights.timeliness +
    form.creditScoreWeights.doubleBreach;

  const thresholdsValid = form.riskThresholds.low > form.riskThresholds.high;
  const isValid = weightSum === 100 && thresholdsValid;

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
        // Revalidate all payment data caches so dashboard calculations refresh
        for (const key of (cache as Map<string, unknown>).keys()) {
          if (typeof key === 'string' && key.startsWith('/api/payment/')) {
            mutate(key);
          }
        }
        onSaved?.();
      }
    } catch {
      setMessage({ type: 'error', text: 'Network error' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div>
          <h2 className="text-lg font-bold">Credit Health Score Settings</h2>
          <p className="mt-1 text-sm text-muted-foreground">
            The Credit Health Score rates each customer from 0 (highest risk) to 100 (safest),
            shown in the Score and Risk columns below.
          </p>
        </div>

        {!isAdmin && (
          <div className="rounded-md border border-yellow-300 bg-yellow-50 px-4 py-3 text-sm text-yellow-800">
            You are viewing as a non-admin user. Only administrators can change these settings.
          </div>
        )}

        <div className="space-y-4">
          {/* ─── Section 1: Weights ─── */}
          <div className="rounded-lg border p-4">
            <h3 className="text-sm font-semibold">Credit Health Score Weights</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              How much each factor contributes to the final score. Must add up to exactly 100.
            </p>
            <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-4">
              <NumberInput label="Credit Utilization" value={form.creditScoreWeights.utilization}
                onChange={v => setForm(f => ({ ...f, creditScoreWeights: { ...f.creditScoreWeights, utilization: v } }))}
                suffix="%" min={0} max={100} disabled={!isAdmin} />
              <NumberInput label="Overdue Days" value={form.creditScoreWeights.overdueDays}
                onChange={v => setForm(f => ({ ...f, creditScoreWeights: { ...f.creditScoreWeights, overdueDays: v } }))}
                suffix="%" min={0} max={100} disabled={!isAdmin} />
              <NumberInput label="Payment Timeliness" value={form.creditScoreWeights.timeliness}
                onChange={v => setForm(f => ({ ...f, creditScoreWeights: { ...f.creditScoreWeights, timeliness: v } }))}
                suffix="%" min={0} max={100} disabled={!isAdmin} />
              <NumberInput label="Double Breach" value={form.creditScoreWeights.doubleBreach}
                onChange={v => setForm(f => ({ ...f, creditScoreWeights: { ...f.creditScoreWeights, doubleBreach: v } }))}
                suffix="%" min={0} max={100} disabled={!isAdmin} />
            </div>
            <div className="mt-3 flex items-center justify-between">
              <p className={`text-sm font-medium ${weightSum === 100 ? 'text-emerald-600' : 'text-red-600'}`}>
                Total: {weightSum}/100{weightSum !== 100 && ' — must equal 100'}
              </p>
              {isAdmin && (
              <Button variant="outline" size="sm"
                onClick={() => setForm(f => ({ ...f, creditScoreWeights: DEFAULTS_V2.creditScoreWeights }))}>
                Reset to Defaults
              </Button>
              )}
            </div>
          </div>

          {/* ─── Section 2: Thresholds ─── */}
          <div className="rounded-lg border p-4">
            <h3 className="text-sm font-semibold">Risk Level Thresholds</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Set the score boundaries for each risk level. Moderate is automatically the range between Low and High.
            </p>
            <div className="mt-3 grid grid-cols-2 gap-x-6 gap-y-4">
              <NumberInput label="Low Risk (score >=)" value={form.riskThresholds.low}
                onChange={v => setForm(f => ({ ...f, riskThresholds: { ...f.riskThresholds, low: v } }))}
                min={1} max={100} disabled={!isAdmin} />
              <NumberInput label="High Risk (score <=)" value={form.riskThresholds.high}
                onChange={v => setForm(f => ({ ...f, riskThresholds: { ...f.riskThresholds, high: v } }))}
                min={0} max={99} disabled={!isAdmin} />
            </div>
            {!thresholdsValid && (
              <p className="mt-2 text-sm font-medium text-red-600">Low Risk must be greater than High Risk</p>
            )}
            <RiskThresholdBar low={form.riskThresholds.low} high={form.riskThresholds.high} />
            {isAdmin && (
            <div className="mt-3 flex justify-end">
              <Button variant="outline" size="sm"
                onClick={() => setForm(f => ({ ...f, riskThresholds: DEFAULTS_V2.riskThresholds }))}>
                Reset to Defaults
              </Button>
            </div>
            )}
          </div>

          {/* ─── Section 3: How It Works ─── */}
          <HowItWorks />
        </div>

        {/* Footer */}
        <div className="flex items-center gap-3 border-t pt-3">
          {message && (
            <p className={`flex-1 text-sm transition-opacity duration-500 ${fading ? 'opacity-0' : 'opacity-100'} ${message.type === 'success' ? 'text-emerald-600' : 'text-red-600'}`}>
              {message.text}
            </p>
          )}
          {!message && <div className="flex-1" />}
          <Button variant="outline" onClick={onClose}>{isAdmin ? 'Cancel' : 'Close'}</Button>
          {isAdmin && (
          <Button onClick={handleSave} disabled={!isValid || saving}>
            {saving ? 'Saving...' : 'Save'}
          </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
