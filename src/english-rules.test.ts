import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {compileEnglish,describeEnglishRule,installEnglishRules} from './english-rules';
import {checkEnglishScores,emptyScores,type EnglishScores} from './english-score';
import type {Dataset,Position} from './filter';
const data:Dataset=JSON.parse(readFileSync(new URL('../public/positions.json',import.meta.url),'utf8'));
const p=(text:string):Position=>({id:'test',row:1,sheet:'',values:Array.from({length:27},(_,i)=>i===22?text:'')});
const low:EnglishScores={cet4:'300',cet6:'300',ielts:'3',toefl:'30',tem4:'未通过',tem8:'未通过'};
const check=(text:string,values:Partial<EnglishScores>={},education='本科')=>checkEnglishScores(p(text),{...low,...values},education)?.status;
test('real recruitment shorthand and shared certificate conditions are interpreted',()=>{
 const text='要求大学英语四级成绩在425分及以上（雅思成绩在6分及以上、托福成绩在80分及以上、取得英语专业四级或专业八级合格证书亦可）';
 assert.equal(check(text),'fail');
 assert.equal(check(text,{tem4:'已通过'}),'pass');
 assert.equal(check(text,{ielts:'6'}),'pass');
 assert.equal(check('大学英语等级考试四级500分以上或六级425分以上',{cet4:'480',cet6:'425'}),'pass');
 assert.equal(check('大学英语等级考试四级500分以上或六级425分以上',{cet4:'480',cet6:'424'}),'fail');
 assert.equal(check('通过英语专业八级',{tem8:'已通过'}),'pass');
 assert.equal(check('通过英语专业八级'),'fail');
 assert.equal(check('英语六级425分及以上或通过英语专业4级或8级',{tem8:'已通过'}),'pass');
});
test('no score unit, expiry exemption, expert grades and strict comparisons stay separate',()=>{
 assert.equal(check('雅思6.5以上或托福90分以上',{ielts:'6.5'}),'pass');
 assert.equal(check('英语六级425分及以上或雅思6.5分及以上（雅思不限有效期）'),'fail');
 assert.equal(check('英语六级不小于500分',{cet6:'500'}),'pass');
 assert.equal(check('英语六级大于500分',{cet6:'500'}),'fail');
 assert.equal(check('英语专业八级良好及以上',{tem8:'已通过'}),'review');
 assert.equal(check('雅思总分7分及以上且单项6分及以上',{ielts:'6.5'}),'fail');
 assert.equal(check('雅思总分7分及以上且单项6分及以上',{ielts:'7'}),'review');
});
test('education branches and unrelated study mentions are not confused',()=>{
 const text='本科学历大学英语四级425分及以上（雅思6分亦可），研究生学历大学英语六级425分及以上（雅思6.5分亦可）';
 assert.equal(check(text,{cet4:'500',cet6:'400'},'本科'),'pass');
 assert.equal(check(text,{cet4:'500',cet6:'400'},'硕士研究生'),'fail');
 assert.equal(check(text,{cet4:'500',cet6:'400'},''),'review');
 assert.equal(check('本科、硕士阶段均为体育学相关专业，大学英语四级425分及以上',{cet4:'400'},'硕士研究生'),'fail');
 const levels='硕士研究生英语六级425分及以上，博士研究生英语六级500分及以上';
 assert.equal(check(levels,{cet6:'450'},'硕士研究生'),'pass');
 assert.equal(check(levels,{cet6:'450'},'博士研究生'),'fail');
});
test('unhandled alternatives and exceptions cannot become a definite rejection',()=>{
 assert.equal(check('外语须符合以下2个条件之一：①英语六级550分及以上；②国外博士学位'),'review');
 assert.equal(check('大学英语六级425分以上或全国英语等级考试五级'),'review');
 assert.equal(check('除外国语言文学类外其他专业大学英语四级425分及以上'),'review');
 assert.equal(check('英语六级500分及以上或雅思7分及以上且托福100分及以上'),'review');
});
test('precomputed rules round-trip with equivalent results and actual source provenance',()=>{
 const row=data.rows.find(p=>p.id==='132105:300145007001')!;
 const compiled=compileEnglish(row.values[22]);
 assert.ok(compiled.branches.some(b=>describeEnglishRule(b.rule).includes('满足任一')));
 const before=checkEnglishScores(row,low,'本科');
 assert.equal(before?.status,'fail');
 installEnglishRules(JSON.parse(JSON.stringify({[row.values[22]]:compiled})));
 assert.deepEqual(checkEnglishScores(row,low,'本科'),before);
 installEnglishRules();
 assert.equal(compileEnglish('未提及任何外语').branches.length,0);
 assert.equal(checkEnglishScores(p(''),{...emptyScores,cet4:'500'},'本科')?.status,'review');
});
test('expiry notes and shared advanced certificate grades do not invent alternative exams',()=>{
 assert.equal(check('大学英语六级425分及以上或雅思6.5分及以上（雅思托福不限有效期）'),'fail');
 assert.equal(check('大学英语六级425分及以上，或雅思6.5分及以上，托福或雅思考试成绩不要求有效期（报名时，请备注具体英语等级和分数）'),'fail');
 assert.equal(check('英语专业四级或专业八级良好及以上',{tem4:'已通过'}),'review');
 const result=checkEnglishScores(p('大学英语六级550分以上或雅思7分以上'),{...emptyScores,cet6:'500'},'本科');
 assert.equal(result?.status,'review');
 assert.ok(result?.summary.includes('雅思未填写'));
});
