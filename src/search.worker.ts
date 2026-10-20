import { searchPositions, type SearchQuery } from './search';
import type { Position } from './filter';
let rows: Position[] = [];
self.onmessage = (event: MessageEvent<{ rows?: Position[]; query?: SearchQuery; requestId: number }>) => {
  const { query, requestId } = event.data;
  if (event.data.rows) rows = event.data.rows;
  if (query) self.postMessage({ requestId, ...searchPositions(rows, query) });
};
