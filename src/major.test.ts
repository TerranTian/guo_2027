import { test } from 'node:test';
import assert from 'node:assert/strict';
import { catalogue, getMajor, matchMajor } from './major';
import { emptyFilters, matches, type Position } from './filter';
import { restorePreferences } from './storage';
function position(major:string, department='', education='本科及以上'):Position {
 const values=Array(27).fill(''); values[12]=major; values[1]=department; values[13]=education;
 return {id:'test',sheet:'',row:1,values};
}
const software='ug:080902';
test('catalogue codes, provenance and hierarchy are retained without invented parents',()=>{
 assert.equal(catalogue.length,2600);
 assert.deepEqual(getMajor(software)?.parents.map(p=>p.name),['计算机类','工学']);
 assert.deepEqual(getMajor('ug:140001TK')?.parents.map(p=>p.name),['交叉学科']);
 assert.equal(new Set(catalogue.map(e=>e.id)).size,catalogue.length);
});
test('undergraduate major expands to explicit ancestors without substring or code-prefix matches',()=>{
 for(const text of ['软件工程','计算机类','计算机类（0809）','工学','080902']) assert.equal(matchMajor(position(text),software).status,'match',text);
 for(const text of ['网络工程','软件工程技术','0809021','0835软件工程','080902电路与系统','0809电子科学与技术','0814Z2消防工程']) assert.equal(matchMajor(position(text),software).status,'none',text);
});
test('scope, education, narrowing and exclusions do not accept incompatible majors',()=>{
 for(const text of ['本科：法学；研究生：软件工程','计算机类（网络工程、信息安全）','计算机类（不含软件工程）']) assert.equal(matchMajor(position(text),software).status,'none',text);
 assert.equal(matchMajor(position('本科：计算机类；研究生：法学'),software).status,'match');
 assert.equal(matchMajor(position('计算机类（仅限人工智能方向）'),software).status,'review');
 assert.equal(matchMajor(position('软件工程','','仅限硕士研究生'),software).status,'none');
 assert.equal(matchMajor(position('计算机类'), 'voc:510203').status,'none');
 assert.equal(matchMajor(position('金融学（020301）'),'ug:020301K').status,'match');
});
test('academic and professional graduate codes are distinct and ambiguous names require review',()=>{
 assert.equal(matchMajor(position('软件工程（0835）'),'fields:085405').status,'none');
 assert.equal(matchMajor(position('电子信息（0854）'),'fields:085405').status,'match');
 assert.equal(matchMajor(position('软件工程'),'fields:085405').status,'review');
 assert.equal(matchMajor(position('计算机科学与技术'),'legacy:081203').status,'review');
});
test('department mapping supports overlapping tax groups only for tax positions',()=>{
 for(const text of ['经济学类','统计学类']) {
  const m=matchMajor(position(text,'国家税务总局北京市税务局'),'ug:020102');
  assert.equal(m.status,'match'); assert.equal(m.sourceId,'tax');
 }
 assert.equal(matchMajor(position('统计学类','其他部门'),'ug:020102').status,'none');
 assert.equal(matchMajor(position('英语相关专业','国家税务总局北京市税务局'),'ug:050261').status,'review');
});
test('unrestricted switch, explicit selection and legacy preference migration',()=>{
 assert.equal(matchMajor(position('不限'),software,false).status,'none');
 assert.equal(matchMajor(position('本科：不限；研究生：法学'),software).status,'match');
 assert.equal(matches(position('计算机类'),{...emptyFilters,major:'软件工程'}),false);
 assert.equal(matches(position('计算机类'),{...emptyFilters,major:'软件工程',majorId:software}),true);
 assert.equal(restorePreferences({filters:{major:'计算机'}}).filters.majorMode,'keyword');
});
