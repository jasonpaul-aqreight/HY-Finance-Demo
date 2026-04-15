import { getPool } from '../postgres';
import type { SummaryJson, ComponentResult, DateRange, FiscalPeriod } from './types';

export async function upsertSectionInsight(params: {
  page: string;
  sectionKey: string;
  summaryJson: SummaryJson;
  analysisTimeS: number;
  tokenCount: number;
  costUsd: number;
  dateRange: DateRange | null;
  fiscalPeriod?: FiscalPeriod | null;
  generatedBy: string;
  components: ComponentResult[];
}): Promise<number> {
  const pool = getPool();
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // Delete existing section (cascades to components)
    await client.query(
      `DELETE FROM ai_insight_section WHERE page = $1 AND section_key = $2`,
      [params.page, params.sectionKey],
    );

    // Insert new section
    const { rows } = await client.query(
      `INSERT INTO ai_insight_section
         (page, section_key, summary_json, analysis_time_s, token_count, cost_usd,
          date_range_start, date_range_end, fiscal_year, fiscal_range, generated_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
       RETURNING id`,
      [
        params.page,
        params.sectionKey,
        JSON.stringify(params.summaryJson),
        params.analysisTimeS,
        params.tokenCount,
        params.costUsd,
        params.dateRange?.start ?? null,
        params.dateRange?.end ?? null,
        params.fiscalPeriod?.fiscalYear ?? null,
        params.fiscalPeriod?.range ?? null,
        params.generatedBy,
      ],
    );

    const sectionId = rows[0].id;

    // Insert components
    for (const comp of params.components) {
      await client.query(
        `INSERT INTO ai_insight_component
           (section_id, component_key, component_type, analysis_md, token_count)
         VALUES ($1, $2, $3, $4, $5)`,
        [sectionId, comp.component_key, comp.component_type, comp.analysis_md, comp.token_count],
      );
    }

    await client.query('COMMIT');
    return sectionId;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export async function getSectionInsight(sectionKey: string) {
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT id, page, section_key, summary_json, analysis_time_s, token_count,
            cost_usd, date_range_start, date_range_end, fiscal_year, fiscal_range,
            generated_by, generated_at
     FROM ai_insight_section
     WHERE section_key = $1`,
    [sectionKey],
  );
  return rows[0] ?? null;
}

export async function getComponentInsight(sectionKey: string, componentKey: string) {
  const pool = getPool();
  const { rows } = await pool.query(
    `SELECT c.id, c.component_key, c.component_type, c.analysis_md, c.token_count, c.generated_at,
            s.generated_by, s.date_range_start, s.date_range_end, s.fiscal_year, s.fiscal_range
     FROM ai_insight_component c
     JOIN ai_insight_section s ON s.id = c.section_id
     WHERE s.section_key = $1 AND c.component_key = $2`,
    [sectionKey, componentKey],
  );
  return rows[0] ?? null;
}
