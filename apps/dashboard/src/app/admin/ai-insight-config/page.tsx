import { Suspense } from 'react';
import { PageBanner } from '@/components/layout/PageBanner';
import { PromptConfigDashboard } from '@/components/admin/ai-insight-config/PromptConfigDashboard';

export default function AiInsightConfigPage() {
  return (
    <>
      <PageBanner
        title="AI Insight Config"
        description="View the code-backed prompts that drive AI Insight analysis. Configuration editing will be added in the next phase."
      />
      <Suspense fallback={<div className="p-8 text-foreground">Loading...</div>}>
        <PromptConfigDashboard />
      </Suspense>
    </>
  );
}
