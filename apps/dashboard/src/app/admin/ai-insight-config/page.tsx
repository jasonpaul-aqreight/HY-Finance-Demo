import { Suspense } from 'react';
import { PageBanner } from '@/components/layout/PageBanner';
import { PromptConfigDashboard } from '@/components/admin/ai-insight-config/PromptConfigDashboard';

export default function AiInsightConfigPage() {
  return (
    <>
      <PageBanner
        title="AI Insight Config"
        description="Edit the prompts that drive every AI Insight analysis. Changes apply to new analyses, not in-progress runs."
      />
      <Suspense fallback={<div className="p-8 text-foreground">Loading...</div>}>
        <PromptConfigDashboard />
      </Suspense>
    </>
  );
}
