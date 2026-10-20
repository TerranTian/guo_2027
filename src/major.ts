import data from './catalog-data.json';
import type { Position } from './filter';
export const catalogue = data.entries;
export const majorSources = data.sources;
export type Major = typeof catalogue[number];
export type MajorMatch = { status: 'match' | 'review' | 'none'; reason: string; sourceId: string };
const knownNames = new Set(catalogue.map(e => e.name));
const knownTerms = new Set(catalogue.flatMap(e => [e.name, ...e.parents.map(p => p.name)]));
const byId = new Map(catalogue.map(e => [e.id, e]));
export const getMajor = (id: string) => byId.get(id);
const normalize = (s: string) => s.replace(/\s/g, '').replaceAll('(', '（').replaceAll(')', '）');
const baseName = (s: string) => normalize(s).split(/[（\[]/)[0];
const taxNames = new Set(data.taxGroups.map(g => g.name));
const taxByMajor = new Map<string, {name:string;code:string;note:string}[]>();
for (const group of data.taxGroups) for (const member of group.members) {
  const name = baseName(member);
  taxByMajor.set(name, [...(taxByMajor.get(name) || []), {name:group.name,code:'',note:member}]);
}
const ambiguousGraduateNames = new Set(catalogue.filter(e => e.level === '研究生' && catalogue.some(other => other.level === e.level && other.name === e.name && other.code !== e.code)).map(e => e.name));
function terms(text: string) {
  let depth = 0, start = 0; const result: string[] = [];
  for (let i = 0; i < text.length; i++) {
    if ('（(['.includes(text[i])) depth++;
    if ('）)]'.includes(text[i])) depth = Math.max(0, depth - 1);
    if (!depth && /[、，,；;\n]/.test(text[i])) { result.push(text.slice(start, i)); start = i + 1; }
  }
  return [...result, text.slice(start)].map(normalize).filter(Boolean);
}
function scoped(text: string, level: string) {
  const headings = [...text.matchAll(/(大学本科|职业本科|本科|硕士研究生|博士研究生|研究生|大专|专科)\s*[：:]/g)];
  if (!headings.length) return text;
  return headings.flatMap((h, i) => {
    const stage = h[1].includes('研究生') ? '研究生' : /大专|专科/.test(h[1]) ? '大专' : '本科';
    return stage === (level === '职业本科' ? '本科' : level) ? [text.slice(h.index! + h[0].length, headings[i+1]?.index).replace(/[；;，,\s]+$/, '')] : [];
  }).join('；');
}
function hasNode(term: string, node: {code: string; name: string}) {
  const codes: string[] = term.match(/(?<![\dA-Za-z])\d{2,6}[TK]*(?![\dA-Za-z])/g) || [];
  if (codes.length) {
    const named = baseName(term).replace(/\d{2,6}[TK]*/g, '').replace(/[：:。.]/g, '');
    if (knownTerms.has(named) && named !== node.name) return false;
    return codes.includes(node.code) || codes.includes(node.code.replace(/[TK]+$/, ''));
  }
  return baseName(term).replace(/^(?:限|仅限)/, '').replace(/(?:专业|学科门类)$/, '') === node.name || baseName(term) === node.name;
}
// Only the active major is retained; identical requirements share one computation.
let cachedMajor = '';
const matchCache = new Map<string, MajorMatch>();
export function matchMajor(p: Position, id: string, includeUnlimited = true): MajorMatch {
  const selection = `${id}:${includeUnlimited}`;
  if (selection !== cachedMajor) { matchCache.clear(); cachedMajor = selection; }
  const key = JSON.stringify([p.values[12], p.values[13], p.values[1].startsWith('国家税务总局')]);
  const cached = matchCache.get(key);
  if (cached) return cached;
  const result = computeMajor(p, id, includeUnlimited);
  if (matchCache.size >= 20000) matchCache.clear();
  matchCache.set(key, result);
  return result;
}
function computeMajor(p: Position, id: string, includeUnlimited: boolean): MajorMatch {
  const major = getMajor(id);
  const no = {status: 'none' as const, reason: '未找到目录匹配依据', sourceId: major?.sourceId || ''};
  if (!major) return no;
  const education = p.values[13];
  const stage = major.level === '职业本科' ? '本科' : major.level;
  if ((stage === '大专' && /本科|研究生/.test(education) && !education.includes('大专')) || (education === '仅限本科' && stage !== '本科') || (education === '仅限大专' && stage !== '大专') || (/^仅限[硕博]士研究生$|^硕士研究生及以上$/.test(education) && stage !== '研究生')) return no;
  const text = scoped(p.values[12], major.level);
  if (includeUnlimited && /^(?:专业不限|不限专业|不限|无限制)[。\s]*$/.test(text.trim())) return {status:'match',reason:'原表对应学历阶段不限专业',sourceId:major.sourceId};
  const isTax = p.values[1].startsWith('国家税务总局');
  const taxGroups = isTax && stage !== '大专' ? taxByMajor.get(major.name) || [] : [];
  const nodes = [{name:major.name,code:major.code,note:'',direct:true}, ...major.parents.map(n => ({...n,note:'',direct:false})), ...taxGroups.map(n => ({...n,direct:false}))];
  for (const term of terms(text)) {
    for (const node of nodes) {
      // A department's own named category takes precedence over Ministry taxonomy.
      if (isTax && !node.direct && taxNames.has(node.name) && !taxGroups.some(g => g.name === node.name)) continue;
      if (!hasNode(term,node)) continue;
      const qualifier = term.match(/[（\[](.+)[）\]]/)?.[1] || '';
      if (/不含|不包括|除外/.test(qualifier) && qualifier.includes(major.name)) continue;
      const listed = terms(qualifier.replace(/^(?:仅限|限于|含|包括)[：:]?/, '')).map(baseName);
      if (!node.direct && listed.length > 0 && listed.every(n => knownNames.has(n)) && !listed.includes(major.name)) continue;
      const narrowed = /方向|仅限|限于|不含|不包括|除外|研究方向/.test(term) || (!!qualifier && !/^\d+[TK]*$/.test(qualifier));
      const tax = taxGroups.some(g => g.name === node.name);
      const ambiguousName = node.direct && major.level === '研究生' && !/\d{4,6}/.test(term) && ambiguousGraduateNames.has(major.name);
      const review = major.historical || narrowed || ambiguousName || (tax && /注[：:]|指所学/.test(node.note));
      return {status:review?'review':'match',sourceId:tax?'tax':major.sourceId,reason:`${review?'待核对':'目录匹配'}：${major.name}（${major.code}）${node.direct?' → 原文专业':` → ${node.name}`}；${major.level}${review?'。存在历史口径、同名代码或附加限制，请核对原文。':''}`};
    }
  }
  return no;
}
