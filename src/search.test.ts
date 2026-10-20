import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { searchPositions } from './search';
import { checkProfile, emptyFilters, emptyProfile, matches, type Dataset } from './filter';
import { matchMajor } from './major';
const data: Dataset = JSON.parse(readFileSync(new URL('../public/positions.json', import.meta.url), 'utf8'));
test('worker search retains ordering, profile exclusions and empty result semantics', () => {
  for (const mode of ['profile', 'raw'] as const) {
    const filters = {...emptyFilters, major:'软件工程', majorId:'ug:080902', education:'仅限本科'};
    const profile = {...emptyProfile, education:'硕士研究生'};
    const effective = mode === 'profile' ? {...filters, education:''} : filters;
    const base = data.rows.filter(p => matches(p,effective));
    const expected = base.filter(p => mode === 'raw' || !checkProfile(p,profile).some(c=>c.status==='fail'));
    const result = searchPositions(data.rows,{filters,profile,mode});
    assert.deepEqual(result.indices.map(i=>data.rows[i].id),expected.map(p=>p.id));
    assert.equal(result.excluded,base.length-expected.length);
  }
  assert.deepEqual(searchPositions(data.rows,{filters:{...emptyFilters,query:'不存在xyz'},profile:emptyProfile,mode:'raw'}).indices,[]);
});
test('major cache respects department, education, unlimited flag and major changes', () => {
  const p = {...data.rows[0],values:[...data.rows[0].values]};
  p.values[12]='统计学类'; p.values[13]='本科及以上'; p.values[1]='国家税务总局北京市税务局';
  assert.equal(matchMajor(p,'ug:020102').status,'match');
  p.values[1]='其他部门'; assert.equal(matchMajor(p,'ug:020102').status,'none');
  p.values[12]='不限'; assert.equal(matchMajor(p,'ug:080902',true).status,'match');
  assert.equal(matchMajor(p,'ug:080902',false).status,'none');
  p.values[13]='仅限硕士研究生'; assert.equal(matchMajor(p,'ug:080902',true).status,'none');
});
