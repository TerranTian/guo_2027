import { englishRequirements } from './english';
import { matchMajor } from './major';
export type Position = { id: string; sheet: string; row: number; values: string[] };
export type Dataset = { headers: string[]; rows: Position[]; sources: { name: string; count: number }[]; file: string; year?: number; importedAt?: string; sourceHash?: string };
export type Filters = { query: string; major: string; majorMode: string; majorId: string; majorLevel: string; location: string; regions: string[]; includeUnlimited: boolean; education: string; degree: string; politics: string; years: string; project: string; category: string; department: string; exam: string; test: string; alert: string; english: string };
export const emptyFilters: Filters = { query: '', major: '', majorMode: 'catalog', majorId: '', majorLevel: '本科', location: '', regions: [], includeUnlimited: true, education: '', degree: '', politics: '', years: '', project: '', category: '', department: '', exam: '', test: '', alert: '', english: '' };
export const profileOptions = {
  education: ['大专', '本科', '硕士研究生', '博士研究生'],
  degree: ['无学位', '学士', '硕士', '博士'],
  politics: ['中共党员', '共青团员', '群众'],
  years: ['不足一年', '一年', '二年', '三年', '四年', '五年及以上'],
  project: ['无项目经历', '大学生村官', '三支一扶', '特岗教师', '西部计划', '高校毕业生退役士兵'],
  graduation: ['2027届毕业生', '其他应届毕业生', '非应届毕业生'],
  gender: ['男', '女'],
};
export type Profile = Record<keyof typeof profileOptions, string>;
export const emptyProfile: Profile = { education: '', degree: '', politics: '', years: '', project: '', graduation: '', gender: '' };
export const provinces = '北京市 天津市 河北省 山西省 内蒙古自治区 辽宁省 吉林省 黑龙江省 上海市 江苏省 浙江省 安徽省 福建省 江西省 山东省 河南省 湖北省 湖南省 广东省 广西壮族自治区 海南省 重庆市 四川省 贵州省 云南省 西藏自治区 陕西省 甘肃省 青海省 宁夏回族自治区 新疆维吾尔自治区 香港特别行政区 澳门特别行政区 台湾省'.split(' ');
export const projectTerms: Record<string, string> = { 大学生村官: '大学生村官', 三支一扶: '三支一扶', 特岗教师: '特设岗位', 西部计划: '志愿服务西部', 高校毕业生退役士兵: '退役士兵' };
export const educationRules: Record<string, string[]> = {
  '仅限大专': ['大专'], '大专及以上': profileOptions.education, '大专或本科': ['大专', '本科'],
  '仅限本科': ['本科'], '本科及以上': ['本科', '硕士研究生', '博士研究生'],
  '本科或硕士研究生': ['本科', '硕士研究生'], '仅限硕士研究生': ['硕士研究生'],
  '硕士研究生及以上': ['硕士研究生', '博士研究生'], '仅限博士研究生': ['博士研究生'],
};
export type Alert = { key: string; label: string; evidence: string[] };
const alertRules: [string, string, RegExp][] = [
  ['graduate', '毕业届别 / 应届', /应届|20\d{2}届|择业期/],
  ['gender', '性别相关要求', /男性|女性|限男|限女|适合男|适合女/],
  ['language', '外语要求', /英语|外语|[四六八468]级|雅思|托福|CET|TEM/i],
  ['certificate', '资格 / 证书', /资格|证书|执业|驾驶证/],
  ['service', '服务期 / 服务年限', /最低服务|服务期|服务年限/],
  ['residence', '户籍 / 生源', /户籍|户口|生源/],
  ['physical', '体能 / 身体条件', /体能|身体条件|身高|视力|体检/],
  ['work', '工作安排', /夜班|值班|出差|艰苦|二次分配|驻外|加班/],
  ['study', '学习经历要求', /本科阶段|各学习阶段|各学历阶段|主修|最高学历|专业一致/],
];
export const alertOptions = alertRules.map(([value, label]) => ({ value, label }));
export function extractAlerts(p: Position): Alert[] {
  const snippets = p.values[22].split(/[。；;\n]+/).map(s => s.trim()).filter(Boolean);
  return alertRules.flatMap(([key, label, regex]) => {
    const evidence = snippets.filter(s => regex.test(s));
    return evidence.length ? [{ key, label, evidence }] : [];
  });
}
export function unlimitedMajor(text: string) { return /^(?:专业不限|不限专业|不限|无限制)[。\s]*$/.test(text.trim()); }
export function matches(p: Position, f: Filters) {
  const v = p.values;
  const query = f.query.trim().toLocaleLowerCase();
  const text = query ? v.join(' ').toLocaleLowerCase() : '';
  return (!query || query.split(/\s+/).every(q => text.includes(q)))
    && (!f.location || v[20].includes(f.location.trim()))
    && (!f.regions.length || f.regions.some(r => v[20].includes(r)))
    && (!f.education || v[13] === f.education)
    && (!f.degree || v[14] === f.degree)
    && (!f.politics || v[15] === f.politics)
    && (!f.years || v[16] === f.years)
    && (!f.project || (f.project === '无限制' ? v[17] === f.project : v[17].includes(projectTerms[f.project] || f.project)))
    && (!f.category || p.sheet === f.category)
    && (!f.department || v[1] === f.department)
    && (!f.exam || v[10] === f.exam)
    && (!f.test || v[18] === f.test)
    && (!f.english || englishRequirements(p).kinds.includes(f.english))
    && (f.majorMode === 'catalog' ? (!f.major.trim() && !f.majorId || (!!f.majorId && matchMajor(p, f.majorId, f.includeUnlimited).status !== 'none')) : (!f.major.trim() || v[12].toLocaleLowerCase().includes(f.major.trim().toLocaleLowerCase()) || (f.includeUnlimited && unlimitedMajor(v[12]))))
    && (!f.alert || extractAlerts(p).some(a => a.key === f.alert));
}
export type Check = { label: string; status: 'pass' | 'review' | 'fail'; reason: string };
// Only explicit, simple restrictions exclude a position. Complex prose remains for review.
function clearRestriction(text: string, pattern: RegExp) {
  if (/放宽|不受[^。；;]*限制|另有规定|例外|亦可|也可/.test(text)) return false;
  return text.split(/[。；;\n]+/).some(s => pattern.test(s) && !/或|除|不限|不限制|不受|放宽|优先|适合|建议/.test(s));
}
export function checkProfile(p: Position, profile: Profile): Check[] {
  const v = p.values, checks: Check[] = [];
  const add = (label: string, compatible: boolean | undefined, reason: string) => checks.push({ label, status: compatible === undefined ? 'review' : compatible ? 'pass' : 'fail', reason });
  if (profile.education) add('学历', educationRules[v[13]]?.includes(profile.education), `我的学历：${profile.education}；职位要求：${v[13]}`);
  if (profile.degree) {
    let ok: boolean | undefined;
    if (v[14] === '无要求') ok = true;
    else if (v[14] === '与最高学历相对应的学位') {
      const degree = ({ 大专: undefined, 本科: '学士', 硕士研究生: '硕士', 博士研究生: '博士' } as Record<string, string | undefined>)[profile.education];
      ok = degree ? degree === profile.degree : undefined;
    } else if (['学士', '硕士', '博士'].includes(v[14])) ok = v[14] === profile.degree;
    add('学位', ok, `我的学位：${profile.degree}；职位要求：${v[14]}${!profile.education ? '；请补充最高学历' : ''}`);
  }
  if (profile.politics) add('政治面貌', !['不限', '中共党员', '中共党员或共青团员'].includes(v[15]) ? undefined : v[15] === '不限' || v[15] === profile.politics || (v[15] === '中共党员或共青团员' && ['中共党员', '共青团员'].includes(profile.politics)), `我的政治面貌：${profile.politics}；职位要求：${v[15]}`);
  if (profile.years) {
    const minimum = ({ 无限制: 0, 一年: 1, 二年: 2, 三年: 3, 五年以上: 5 } as Record<string, number>)[v[16]];
    add('基层工作年限', minimum === undefined ? undefined : profileOptions.years.indexOf(profile.years) >= minimum, `我的基层经历：${profile.years}；最低要求：${v[16]}。相关岗位经历另见备注。`);
  }
  if (profile.project) {
    const ok = v[17] === '无限制' ? true : profile.project === '无项目经历' ? false : v[17].includes(projectTerms[profile.project]);
    add('基层项目经历', ok ? (v[17] === '无限制' ? true : undefined) : false, `我的项目：${profile.project}；职位要求：${v[17]}${ok && v[17] !== '无限制' ? '。项目年限、考核及身份需核对。' : ''}`);
  }
  if (profile.graduation) {
    const currentOnly = clearRestriction(v[22], /(?:仅限|限|招考对象为|面向)\s*2027届(?:普通)?(?:高校)?毕业生/);
    const freshOnly = clearRestriction(v[22], /(?:仅限|限|招考对象为|面向)\s*应届(?:普通)?(?:高校)?毕业生/);
    const failed = (currentOnly && profile.graduation !== '2027届毕业生') || (freshOnly && profile.graduation === '非应届毕业生');
    add('毕业身份', failed ? false : undefined, `${currentOnly ? '备注明确限2027届毕业生' : freshOnly ? '备注明确限应届毕业生' : '未识别出单一毕业身份限制'}；应届认定及其他条件请核对备注和招录公告。`);
  }
  if (profile.gender) {
    const male = clearRestriction(v[22], /(?:仅限|限)(?:男性|男生|男)(?:报考|考生|[，,。；;\s]|$)/);
    const female = clearRestriction(v[22], /(?:仅限|限)(?:女性|女生|女)(?:报考|考生|[，,。；;\s]|$)/);
    const failed = male !== female && (male ? profile.gender === '女' : profile.gender === '男');
    add('性别', failed ? false : undefined, male !== female ? `备注明确${male ? '限男性' : '限女性'}，其余条件需核对。` : '未识别出单一性别限制，请核对原文；未提及不等于不限。');
  }
  return checks;
}
export function toCsv(headers: string[], rows: Position[]) {
  const escape = (value: string) => `"${(/^[=+\-@\t\r]/.test(value) ? "'" + value : value).replaceAll('"', '""')}"`;
  return '\uFEFF' + [headers, ...rows.map(p => p.values)].map(row => row.map(escape).join(',')).join('\r\n');
}
