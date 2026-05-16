import {
  DEFAULT_COMPONENT_PROMPTS,
  DEFAULT_GLOBAL_SYSTEM,
  DEFAULT_SUMMARY_SYSTEM,
} from './prompts-defaults';
import {
  SECTION_COMPONENTS,
  SECTION_NAMES,
  SECTION_PAGE,
} from './prompts';

export type PromptConfigCategory = 'system' | 'component';
export type PromptConfigComponentType = 'kpi' | 'chart' | 'table' | 'breakdown';

export interface PromptConfigRow {
  promptKey: string;
  promptText: string;
  renderedPromptText: string;
  category: PromptConfigCategory;
  page: string | null;
  sectionKey: string | null;
  sectionName: string | null;
  componentType: PromptConfigComponentType | null;
  displayName: string;
  sortOrder: number;
  updatedAt: string;
  updatedBy: string | null;
  thresholdGroups: [];
}

interface PromptConfigSeedRow {
  promptKey: string;
  promptText: string;
  category: PromptConfigCategory;
  page: string | null;
  sectionKey: string | null;
  sectionName: string | null;
  componentType: PromptConfigComponentType | null;
  displayName: string;
  sortOrder: number;
}

function toPromptConfigRow(row: PromptConfigSeedRow, updatedAt: string): PromptConfigRow {
  return {
    ...row,
    renderedPromptText: row.promptText,
    updatedAt,
    updatedBy: 'code',
    thresholdGroups: [],
  };
}

export function buildPromptConfigRows(): PromptConfigRow[] {
  const updatedAt = new Date().toISOString();
  const rows: PromptConfigSeedRow[] = [
    {
      promptKey: 'component_analysis',
      promptText: DEFAULT_GLOBAL_SYSTEM,
      category: 'system',
      page: 'finance',
      sectionKey: null,
      sectionName: null,
      componentType: null,
      displayName: 'Component Analysis',
      sortOrder: 0,
    },
    {
      promptKey: 'summary_analysis',
      promptText: DEFAULT_SUMMARY_SYSTEM,
      category: 'system',
      page: 'finance',
      sectionKey: null,
      sectionName: null,
      componentType: null,
      displayName: 'Summary Analysis',
      sortOrder: 1,
    },
    {
      promptKey: 'hr_component_analysis',
      promptText: '',
      category: 'system',
      page: 'hr',
      sectionKey: null,
      sectionName: null,
      componentType: null,
      displayName: 'Component Analysis',
      sortOrder: 2,
    },
    {
      promptKey: 'hr_summary_analysis',
      promptText: '',
      category: 'system',
      page: 'hr',
      sectionKey: null,
      sectionName: null,
      componentType: null,
      displayName: 'Summary Analysis',
      sortOrder: 3,
    },
  ];

  for (const sectionKey of Object.keys(SECTION_COMPONENTS) as Array<keyof typeof SECTION_COMPONENTS>) {
    SECTION_COMPONENTS[sectionKey].forEach((component, index) => {
      const promptText = DEFAULT_COMPONENT_PROMPTS[component.key];
      if (!promptText) return;

      rows.push({
        promptKey: component.key,
        promptText,
        category: 'component',
        page: SECTION_PAGE[sectionKey],
        sectionKey,
        sectionName: SECTION_NAMES[sectionKey],
        componentType: component.type,
        displayName: component.name,
        sortOrder: index + 1,
      });
    });
  }

  return rows.map((row) => toPromptConfigRow(row, updatedAt));
}
