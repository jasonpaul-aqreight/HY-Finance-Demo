import { NextRequest } from 'next/server';
import { acquireLock, releaseLock } from '@/lib/ai-insight/lock';
import { runSectionAnalysis } from '@/lib/ai-insight/orchestrator';
import { upsertSectionInsight } from '@/lib/ai-insight/storage';
import { SECTION_COMPONENTS } from '@/lib/ai-insight/prompts';
import type { AnalyzeRequest, SectionKey } from '@/lib/ai-insight/types';

// Store active abort controllers by section key for cancellation
const activeControllers = new Map<string, AbortController>();

export { activeControllers };

export async function POST(req: NextRequest) {
  const body = (await req.json()) as AnalyzeRequest;
  const { page, section_key, date_range, fiscal_period, user_name } = body;

  // Validate section key
  if (!SECTION_COMPONENTS[section_key as SectionKey]) {
    return new Response(
      JSON.stringify({ error: `Invalid section_key: ${section_key}` }),
      { status: 400, headers: { 'Content-Type': 'application/json' } },
    );
  }

  // Try to acquire global lock
  const { acquired, status } = await acquireLock(user_name, section_key);
  if (!acquired) {
    return new Response(
      JSON.stringify({
        error: 'Analysis is currently running',
        locked_by: status.locked_by,
        section_key: status.section_key,
      }),
      { status: 409, headers: { 'Content-Type': 'application/json' } },
    );
  }

  // Set up abort controller
  const controller = new AbortController();
  activeControllers.set(section_key, controller);

  // SSE stream
  const stream = new ReadableStream({
    async start(streamController) {
      const encoder = new TextEncoder();

      function sendEvent(event: string, data: Record<string, unknown>) {
        streamController.enqueue(
          encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`),
        );
      }

      const startTime = Date.now();

      try {
        const result = await runSectionAnalysis(
          section_key as SectionKey,
          date_range,
          controller,
          (component, status, message) => {
            sendEvent('progress', { component, status, message });
          },
          fiscal_period ?? null,
        );

        const analysisTimeS = parseFloat(((Date.now() - startTime) / 1000).toFixed(1));

        // Store results in DB
        const sectionId = await upsertSectionInsight({
          page,
          sectionKey: section_key,
          summaryJson: result.summary,
          analysisTimeS,
          tokenCount: result.totalTokens,
          costUsd: result.totalCost,
          dateRange: date_range,
          fiscalPeriod: fiscal_period ?? null,
          generatedBy: user_name,
          components: result.components,
        });

        sendEvent('complete', {
          section_id: sectionId,
          analysis_time_s: analysisTimeS,
          token_count: result.totalTokens,
          cost_usd: parseFloat(result.totalCost.toFixed(4)),
        });
      } catch (err) {
        if (controller.signal.aborted) {
          const msg = err instanceof Error && err.message.includes('timed out')
            ? 'Analysis timed out. Please try again.'
            : 'Analysis cancelled by user';
          sendEvent('cancelled', { message: msg });
        } else {
          console.error('Analysis error:', err);
          sendEvent('error', {
            message: err instanceof Error ? err.message : 'Analysis failed',
          });
        }
      } finally {
        activeControllers.delete(section_key);
        await releaseLock();
        streamController.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}
