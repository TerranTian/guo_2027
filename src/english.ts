import type { Position } from './filter';
export const englishOptions = [
  { value: 'unmentioned', label: '备注未提及英语' },
  { value: 'unrestricted', label: '原文明示不要求英语' },
  { value: 'cet4', label: '原文提及大学英语四级 / CET-4' },
  { value: 'cet6', label: '原文提及大学英语六级 / CET-6' },
  { value: 'tem4', label: '原文提及英语专业四级 / TEM-4' },
  { value: 'tem8', label: '原文提及英语专业八级 / TEM-8' },
  { value: 'ielts', label: '原文提及雅思 / IELTS' },
  { value: 'toefl', label: '原文提及托福 / TOEFL' },
  { value: 'other', label: '其他英语描述（口语、测试等）' },
];
const rules: [string, RegExp][] = [
  ['cet4', /(?:大学英语(?:等级)?(?:考试)?|英语等级(?:考试)?|英语)(?:四|4)级|\bCET[\s－-]*4\b/i],
  ['cet6', /(?:大学英语(?:等级)?(?:考试)?|英语等级(?:考试)?|英语)(?:六|6)级|\bCET[\s－-]*6\b/i],
  ['tem4', /(?:英语专业|专业英语|专业)(?:四|4)级|\bTEM[\s－-]*4\b/i],
  ['tem8', /(?:英语专业|专业英语|专业)(?:八|8)级|\bTEM[\s－-]*8\b/i],
  ['ielts', /雅思|\bIELTS\b/i],
  ['toefl', /托福|\bTOEFL\b/i],
];
const mentioned = /英语|雅思|托福|\b(?:CET|TEM)[\s－-]*[468]\b|\bIELTS\b|\bTOEFL\b|专业[四八48]级/i;
const unlimited = /(?:无|不作|不做|不设|没有)英语(?:水平|等级|成绩)?要求|英语(?:水平|等级|成绩)?(?:不作要求|不做要求|不限|无要求)|不要求(?:提供|取得|具有|具备)?英语(?:水平|等级|成绩|证书)/;
export type EnglishEvidence = { kinds: string[]; evidence: string[] };
const cache = new Map<string, EnglishEvidence>();
export function englishRequirements(p: Position): EnglishEvidence {
  const remarks = p.values[22];
  const cached = cache.get(remarks);
  if (cached) return cached;
  // Preserve decimal scores, alternatives and education-specific clauses verbatim.
  const evidence = remarks.split(/[。；;\n]+/).map(s => s.trim()).filter(s => mentioned.test(s));
  const text = evidence.join('；');
  const kinds = rules.filter(([,pattern]) => pattern.test(text)).map(([key]) => key);
  if (!evidence.length) kinds.push('unmentioned');
  if (unlimited.test(text)) kinds.push('unrestricted');
  if (evidence.length && !kinds.length) kinds.push('other');
  const result = { kinds, evidence };
  if (cache.size >= 20000) cache.clear();
  cache.set(remarks, result);
  return result;
}
