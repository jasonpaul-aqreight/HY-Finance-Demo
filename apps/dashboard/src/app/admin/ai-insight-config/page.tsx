import { Suspense } from 'react';
import { PageBanner } from '@/components/layout/PageBanner';
import { PromptConfigDashboard } from '@/components/admin/ai-insight-config/PromptConfigDashboard';

export default function AiInsightConfigPage() {
  return (
    <>
      <PageBanner
        title="AI Insight Config"
        description="Review rendered AI Insight prompts and edit the business thresholds used at runtime."
      />
      <Suspense fallback={<div className="p-8 text-foreground">Loading...</div>}>
        <PromptConfigDashboard />
      </Suspense>
    </>
  );
}
