import { englishOptions } from './english';
import { emptyFilters, emptyProfile, profileOptions, type Filters, type Profile } from './filter';
export function readLocal(key: string): unknown {
  try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch { return null; }
}
export function stringList(value: unknown): string[] {
  return Array.isArray(value) ? [...new Set(value.filter((v): v is string => typeof v === 'string'))] : [];
}
export function stringMap(value: unknown): Record<string, string> {
  return value && typeof value === 'object' && !Array.isArray(value) ? Object.fromEntries(Object.entries(value).filter(([, v]) => typeof v === 'string')) : {};
}
export function restorePreferences(value: unknown): { filters: Filters; profile: Profile; mode: 'profile' | 'raw' } {
  const result = { filters: { ...emptyFilters }, profile: { ...emptyProfile }, mode: 'profile' as 'profile' | 'raw' };
  if (!value || typeof value !== 'object') return result;
  const obj = value as Record<string, unknown>;
  if (obj.mode === 'raw') result.mode = 'raw';
  if (obj.filters && typeof obj.filters === 'object') {
    const values = obj.filters as Record<string, unknown>;
    if (!values.majorMode && values.major) result.filters.majorMode = 'keyword';
    for (const key of Object.keys(emptyFilters) as (keyof Filters)[]) {
      if (key === 'regions') result.filters.regions = stringList(values.regions);
      else if (key === 'includeUnlimited') { if (typeof values[key] === 'boolean') result.filters[key] = values[key]; }
      else if (typeof values[key] === 'string') result.filters[key] = values[key];
    }
  }
  if (!['catalog', 'keyword'].includes(result.filters.majorMode)) result.filters.majorMode = 'catalog';
  if (!['本科', '研究生', '大专', '职业本科'].includes(result.filters.majorLevel)) result.filters.majorLevel = '本科';
  if (!englishOptions.some(o => o.value === result.filters.english)) result.filters.english = '';
  if (obj.profile && typeof obj.profile === 'object') {
    const values = obj.profile as Record<string, unknown>;
    for (const key of Object.keys(emptyProfile) as (keyof Profile)[]) {
      if (typeof values[key] === 'string' && profileOptions[key].includes(values[key])) result.profile[key] = values[key];
    }
  }
  return result;
}
