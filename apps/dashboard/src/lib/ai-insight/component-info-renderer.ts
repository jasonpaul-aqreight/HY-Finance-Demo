import {
  COMPONENT_INFO_SOURCE,
  type ComponentInfo,
} from './component-info';
import { renderThresholdText } from './threshold-config';

async function renderInfoField(componentKey: string, value?: string): Promise<string | undefined> {
  if (!value) return undefined;
  return renderThresholdText(value, componentKey);
}

export async function getRenderedComponentInfo(componentKey: string): Promise<ComponentInfo | null> {
  const info = COMPONENT_INFO_SOURCE[componentKey];
  if (!info) return null;

  return {
    name: info.name,
    whatItMeasures: await renderInfoField(componentKey, info.whatItMeasures) ?? info.whatItMeasures,
    formula: await renderInfoField(componentKey, info.formula),
    indicator: await renderInfoField(componentKey, info.indicator),
    about: await renderInfoField(componentKey, info.about),
  };
}
