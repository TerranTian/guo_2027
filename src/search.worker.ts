import { installEnglishRules, type CompiledEnglish } from './english-rules';
import { searchPositions, type SearchQuery } from './search';
import type { Position } from './filter';
let rows: Position[] = [];
self.onmessage = (event: MessageEvent<{ rows?: Position[]; englishRules?: Record<string,CompiledEnglish>; query?: SearchQuery; requestId: number }>) => {
  const { query, requestId } = event.data;
  if (event.data.rows) { rows = event.data.rows; installEnglishRules(event.data.englishRules); }
  if (query) self.postMessage({ requestId, ...searchPositions(rows, query) });
};
