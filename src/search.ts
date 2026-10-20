import { checkProfile, matches, type Filters, type Position, type Profile } from './filter';
export type SearchQuery = { filters: Filters; profile: Profile; mode: 'profile' | 'raw' };
export function searchPositions(rows: Position[], query: SearchQuery) {
  const f = query.mode === 'profile' ? { ...query.filters, education: '', degree: '', politics: '', years: '', project: '', english: '' } : query.filters;
  const indices: number[] = [];
  let excluded = 0;
  rows.forEach((p, i) => {
    if (!matches(p, f)) return;
    if (query.mode === 'profile' && checkProfile(p, query.profile).some(c => c.status === 'fail')) excluded++;
    else indices.push(i);
  });
  return { indices, excluded };
}
