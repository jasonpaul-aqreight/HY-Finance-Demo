import { BATCH_SECTIONS } from './batch-scope';
import {
  BatchAlreadyRunningError,
  createBatchRun,
  finishBatchRun,
  updateBatchProgress,
  type BatchRun,
  type BatchSectionError,
} from './batch-store';
import { runSectionAnalysis } from './orchestrator';
import { upsertSectionInsight } from './storage';

let isBatchInProcess = false;

export function isInsightBatchInProcess(): boolean {
  return isBatchInProcess;
}

export function getBatchDelayMs(): number {
  const parsed = Number(process.env.AI_INSIGHT_BATCH_DELAY_MS ?? 5000);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : 5000;
}

export async function runInsightBatch(triggeredBy = 'admin'): Promise<BatchRun> {
  if (isBatchInProcess) {
    throw new BatchAlreadyRunningError();
  }

  isBatchInProcess = true;
  let batchId: number | null = null;
  let totalCostUsd = 0;
  let totalTokens = 0;
  let sectionsCompleted = 0;
  let sectionsFailed = 0;
  const sectionErrors: BatchSectionError[] = [];

  try {
    const batch = await createBatchRun(triggeredBy, BATCH_SECTIONS.length);
    batchId = batch.id;

    for (const [index, scope] of BATCH_SECTIONS.entries()) {
      await updateBatchProgress(batch.id, {
        currentSection: scope.sectionKey,
        sectionsCompleted,
        sectionsFailed,
        totalCostUsd,
        totalTokens,
        sectionErrors,
      });

      const startedAt = Date.now();
      try {
        const { dateRange, fiscalPeriod } = await scope.resolve();
        const abortController = new AbortController();
        const result = await runSectionAnalysis(
          scope.sectionKey,
          dateRange,
          abortController,
          () => {},
          fiscalPeriod,
        );

        totalCostUsd += result.totalCost;
        totalTokens += result.totalTokens;

        await upsertSectionInsight({
          page: scope.page,
          sectionKey: scope.sectionKey,
          summaryJson: result.summary,
          analysisTimeS: Number(((Date.now() - startedAt) / 1000).toFixed(1)),
          tokenCount: result.totalTokens,
          costUsd: result.totalCost,
          dateRange,
          fiscalPeriod,
          generatedBy: triggeredBy,
          components: result.components,
        });
      } catch (err) {
        sectionsFailed++;
        sectionErrors.push({
          sectionKey: scope.sectionKey,
          message: err instanceof Error ? err.message : String(err),
        });
      } finally {
        sectionsCompleted++;
        await updateBatchProgress(batch.id, {
          currentSection: scope.sectionKey,
          sectionsCompleted,
          sectionsFailed,
          totalCostUsd,
          totalTokens,
          sectionErrors,
        });
      }

      if (index < BATCH_SECTIONS.length - 1) {
        const delayMs = getBatchDelayMs();
        if (delayMs > 0) await sleep(delayMs);
      }
    }

    return finishBatchRun(batch.id, {
      status: sectionsFailed > 0 ? 'partial' : 'success',
      totalCostUsd,
      totalTokens,
      sectionsCompleted,
      sectionsFailed,
      sectionErrors,
    });
  } catch (err) {
    if (batchId !== null) {
      await finishBatchRun(batchId, {
        status: 'error',
        errorMessage: err instanceof Error ? err.message : String(err),
        totalCostUsd,
        totalTokens,
        sectionsCompleted,
        sectionsFailed,
        sectionErrors,
      });
    }
    throw err;
  } finally {
    isBatchInProcess = false;
  }
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
