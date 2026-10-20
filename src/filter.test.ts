import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { emptyFilters, emptyProfile, checkProfile, extractAlerts, retainLocations, matches, toCsv, type Dataset } from './filter.ts';
import { restorePreferences } from './storage.ts';
const data: Dataset = JSON.parse(readFileSync(new URL('../public/positions.json', import.meta.url), 'utf8'));

test('all four source sheets, identifiers, columns and recruitment totals are retained', () => {
  assert.equal(data.rows.length, 19426);
  assert.equal(data.sources.length, 4);
  assert.equal(data.headers.length, 27);
  assert.equal(new Set(data.rows.map(p => p.id)).size, 19426);
  assert.ok(data.rows.every(p => p.values.length === 27 && /^\d{12}$/.test(p.values[8])));
  assert.equal(data.rows.reduce((sum, p) => sum + +p.values[11], 0), 35691);
  assert.equal(data.rows.filter(p => matches(p, emptyFilters)).length, data.rows.length);
});
test('combined search matches every condition without confusing education requirements', () => {
  const f = { ...emptyFilters, location: '北京市', majorMode: 'keyword', major: '计算机', education: '本科及以上', politics: '不限', years: '无限制', test: '否' };
  const expected = data.rows.filter(p => p.values[20].includes('北京市') && p.values[12].includes('计算机') && p.values[13] === '本科及以上' && p.values[15] === '不限' && p.values[16] === '无限制' && p.values[18] === '否');
  assert.ok(expected.length > 0);
  assert.deepEqual(data.rows.filter(p => matches(p, f)), expected);
  assert.equal(data.rows.filter(p => matches(p, { ...emptyFilters, query: '中央办公厅 100110001001' })).length, 1);
  assert.equal(data.rows.filter(p => matches(p, { ...emptyFilters, query: '不存在的职位xyz' })).length, 0);
  assert.equal(matches(data.rows[0], { ...emptyFilters, education: '本科及以上' }), false);
});
test('CSV preserves multiline text, quotes, BOM and neutralizes spreadsheet formulas', () => {
  const row = { ...data.rows[0], values: ['00123', 'a,"b"\nc', '=1+1'] };
  assert.equal(toCsv(['编号', '备注', '值'], [row]), '\uFEFF"编号","备注","值"\r\n"00123","a,""b""\nc","\'=1+1"');
});

test('personal education includes compatible ranges but never treats a higher degree as universally eligible', () => {
  const accepted = (education: string) => data.rows.filter(p => !checkProfile(p, { ...emptyProfile, education }).some(c => c.status === 'fail'));
  const bachelor = accepted('本科');
  assert.equal(bachelor.length, data.rows.filter(p => ['仅限本科', '本科及以上', '本科或硕士研究生', '大专及以上', '大专或本科'].includes(p.values[13])).length);
  assert.ok(accepted('博士研究生').every(p => !['仅限本科', '仅限硕士研究生', '本科或硕士研究生'].includes(p.values[13])));
  const unknown = fixture({ 13: '由招录机关确定' });
  assert.equal(checkProfile(unknown, { ...emptyProfile, education: '本科' })[0].status, 'review');
});
test('politics, minimum experience and degree are evaluated independently', () => {
  const p = fixture({ 13: '本科及以上', 14: '与最高学历相对应的学位', 15: '中共党员或共青团员', 16: '二年', 17: '无限制' });
  assert.ok(checkProfile(p, { ...emptyProfile, education: '本科', degree: '学士', politics: '中共党员', years: '三年' }).every(c => c.status === 'pass'));
  assert.equal(checkProfile(p, { ...emptyProfile, years: '一年' })[0].status, 'fail');
  assert.equal(checkProfile(p, { ...emptyProfile, education: '硕士研究生', degree: '学士' }).find(c => c.label === '学位')?.status, 'fail');
  assert.equal(checkProfile(p, { ...emptyProfile, degree: '硕士' })[0].status, 'review');
  assert.equal(checkProfile(p, { ...emptyProfile, politics: '群众' })[0].status, 'fail');
});
test('project experience does not silently accept missing service duration', () => {
  const p = fixture({ 17: '在军队服役5年（含）以上的高校毕业生退役士兵' });
  assert.equal(checkProfile(p, { ...emptyProfile, project: '无项目经历' })[0].status, 'fail');
  assert.equal(checkProfile(p, { ...emptyProfile, project: '高校毕业生退役士兵' })[0].status, 'review');
  assert.equal(checkProfile(p, { ...emptyProfile, project: '三支一扶' })[0].status, 'fail');
});
test('remarks distinguish explicit restrictions from mentions, exceptions and missing data', () => {
  const nonFresh = { ...emptyProfile, graduation: '非应届毕业生' };
  for (const text of ['限2027届高校毕业生报考。', '招考对象为2027届高校毕业生。', '仅限应届毕业生。']) {
    assert.equal(checkProfile(fixture({ 22: text }), nonFresh)[0].status, 'fail', text);
  }
  for (const text of ['', '非2027届高校毕业生须有相关工作经历。', '不限应届毕业生。', '限2027届或2026届毕业生。', '应届毕业生优先。', '限2027届高校毕业生。退役士兵不受毕业届别限制。']) {
    assert.equal(checkProfile(fixture({ 22: text }), nonFresh)[0].status, 'review', text);
  }
  assert.equal(checkProfile(fixture({ 22: '工作任务重，限男性。' }), { ...emptyProfile, gender: '女' })[0].status, 'fail');
  for (const text of ['适合男性。', '男性优先。', '不限男性或女性。', '']) {
    assert.equal(checkProfile(fixture({ 22: text }), { ...emptyProfile, gender: '女' })[0].status, 'review', text);
  }
});
test('professional keywords optionally include wholly unrestricted positions, not conditional unrestricted branches', () => {
  const f = { ...emptyFilters, majorMode: 'keyword', major: '法学' };
  assert.equal(matches(fixture({ 12: '专业不限' }), f), true);
  assert.equal(matches(fixture({ 12: '专业不限' }), { ...f, includeUnlimited: false }), false);
  assert.equal(matches(fixture({ 12: '本科专业不限，研究生：计算机科学与技术' }), f), false);
  assert.equal(matches(fixture({ 12: '0301法学' }), f), true);
});
test('region alternatives combine with work locality, not settlement or remarks', () => {
  const p = fixture({ 20: '浙江省杭州市西湖区', 21: '北京市', 22: '可前往上海市出差' });
  assert.equal(matches(p, { ...emptyFilters, regions: ['浙江省', '江苏省'], location: '西湖区' }), true);
  assert.equal(matches(p, { ...emptyFilters, regions: ['北京市'] }), false);
  assert.equal(matches(p, { ...emptyFilters, location: '上海市' }), false);
});
test('alert excerpts come directly from remarks and never classify missing words as unlimited', () => {
  const p = fixture({ 22: '限2027届高校毕业生；最低服务期5年。大学英语六级425分及以上。' });
  const alerts = extractAlerts(p);
  assert.deepEqual(alerts.map(a => a.key), ['graduate', 'language', 'service']);
  assert.ok(alerts.every(a => a.evidence.every(e => p.values[22].includes(e))));
  assert.equal(extractAlerts(fixture({ 22: '' })).length, 0);
  assert.equal(matches(p, { ...emptyFilters, alert: 'service' }), true);
});
test('stored preferences tolerate invalid JSON shapes and retain explicit include-unlimited choices', () => {
  assert.deepEqual(restorePreferences(null).profile, emptyProfile);
  const restored = restorePreferences({ mode: 'raw', filters: { includeUnlimited: false, regions: ['北京市', '北京市', 4], degree: null }, profile: { education: '本科', gender: 'bad', years: {} } });
  assert.equal(restored.mode, 'raw');
  assert.equal(restored.filters.includeUnlimited, false);
  assert.deepEqual(restored.filters.regions, ['北京市']);
  assert.equal(restored.profile.education, '本科');
  assert.equal(restored.profile.gender, '');
});

function fixture(values: Record<number, string>) {
  const p = { ...data.rows[0], values: [...data.rows[0].values] };
  for (const [index, value] of Object.entries(values)) p.values[+index] = value;
  return p;
}
test('multiple cities and districts are OR alternatives within selected provinces', () => {
  const make = (work: string, settlement = '') => ({...data.rows[0], values: data.rows[0].values.map((v,i)=>i===20?work:i===21?settlement:v)});
  const f = {...emptyFilters,location:' 海淀区，朝阳区、 西湖区; ',regions:['北京市']};
  assert.equal(matches(make('北京市海淀区'),f),true);
  assert.equal(matches(make('北京市朝阳区'),f),true);
  assert.equal(matches(make('北京市东城区','北京市海淀区'),f),false);
  assert.equal(matches(make('浙江省杭州市西湖区'),f),false);
  assert.equal(matches(make('浙江省杭州市西湖区'),{...f,regions:[]}),true);
  assert.equal(matches(make('北京市东城区'),{...emptyFilters,location:'， 、 ; '}),true);
});

test('province changes retain valid selected districts and remove only out-of-scope selections', () => {
  const locations = ['北京市海淀区','北京市朝阳区','浙江省杭州市西湖区'];
  const selected = '北京市海淀区、北京市朝阳区、浙江省杭州市西湖区';
  assert.equal(retainLocations(selected,['北京市','浙江省'],locations),selected);
  assert.equal(retainLocations(selected,['北京市'],locations),'北京市海淀区、北京市朝阳区');
  assert.equal(retainLocations(selected,[],locations),'');
  assert.equal(retainLocations('海淀区, 朝阳区',['北京市'],locations),'海淀区、朝阳区');
});
