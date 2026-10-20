import {test} from 'node:test';
import assert from 'node:assert/strict';
import {checkEnglishScores,emptyScores} from './english-score';
import {emptyFilters,emptyProfile,type Position} from './filter';
import {restorePreferences} from './storage';
import {searchPositions} from './search';
const position=(text:string):Position=>({id:'test',row:1,sheet:'',values:Array.from({length:27},(_,i)=>i===22?text:i===13?'本科及以上':'')});
const check=(text:string,scores:Partial<typeof emptyScores>,education='本科')=>checkEnglishScores(position(text),{...emptyScores,...scores},education)?.status;
test('personal scores exclude higher requirements and retain equality and blanks',()=>{
 assert.equal(check('大学英语四级425分及以上',{cet4:'424'}),'fail');
 assert.equal(check('大学英语四级425分及以上',{cet4:'425'}),'pass');
 assert.equal(check('英语六级550分及以上',{cet6:'500'}),'fail');
 assert.equal(check('英语六级超过500分',{cet6:'500'}),'fail');
 assert.equal(check('英语六级不低于500分',{cet6:'500'}),'pass');
 assert.equal(check('英语六级550分及以上',{cet4:'600'}),'review');
 assert.equal(check('英语六级550分及以上',{cet6:'0'}),'fail');
 assert.equal(check('',{cet4:'500'}),'review');
 assert.equal(check('英语六级550分及以上',{}),undefined);
});
test('undergraduate/graduate branches use the entered education',()=>{
 const text='本科生大学英语四级考试425分及以上，研究生大学英语六级考试425分及以上';
 assert.equal(check(text,{cet4:'500',cet6:'400'},'本科'),'pass');
 assert.equal(check(text,{cet4:'500',cet6:'400'},'硕士研究生'),'fail');
 assert.equal(check(text,{cet4:'500',cet6:'400'},''),'review');
});
test('alternatives can rescue a low CET score and AND requires both',()=>{
 const text='大学英语六级550分及以上，或雅思7分及以上、托福100分及以上（满足其一即可）';
 assert.equal(check(text,{cet6:'500',ielts:'7',toefl:'0'}),'pass');
 assert.equal(check(text,{cet6:'500',ielts:'6',toefl:'90'}),'fail');
 assert.equal(check(text,{cet6:'500'}),'review');
 assert.equal(check('英语四级425分及以上且英语六级500分及以上',{cet4:'500',cet6:'480'}),'fail');
 assert.equal(check('英语六级550分及以上或英语专业八级合格',{cet6:'500',tem8:'已通过'}),'pass');
});
test('old score scales, abbreviations, exceptions and subscores are conservative',()=>{
 assert.equal(check('大学英语六级（CET6）425分及以上',{cet6:'424'}),'fail');
 assert.equal(check('大学英语四级60分（100分制）或425分（710分制）及以上',{cet4:'420'}),'fail');
 assert.equal(check('大学英语四级60分（100分制）或425分（710分制）及以上',{cet4:'500'}),'pass');
 assert.equal(check('大学英语四级60分及以上',{cet4:'500'}),'review');
 assert.equal(check('雅思总分7分且单项6.5分以上',{ielts:'7'}),'review');
 assert.equal(check('英语六级550分及以上，相关专业可放宽',{cet6:'500'}),'review');
});
test('scores are validated on restore and participate only in profile mode',()=>{
 const restored=restorePreferences({profile:{cet4:'500',cet6:'999',ielts:'7',tem8:'已通过'}}).profile;
 assert.equal(restored.cet4,'500');assert.equal(restored.cet6,'');assert.equal(restored.tem8,'已通过');
 const rows=[position('英语四级550分及以上'),position('英语四级425分及以上')];
 const query={filters:emptyFilters,profile:{...emptyProfile,cet4:'500'}};
 assert.deepEqual(searchPositions(rows,{...query,mode:'profile'}),{indices:[1],excluded:1});
 assert.deepEqual(searchPositions(rows,{...query,mode:'raw'}),{indices:[0,1],excluded:0});
});
test('profile mode ignores previously selected English text categories and uses scores directly',()=>{
 const rows=[position('英语四级550分及以上'),position('英语四级425分及以上'),position('无其他备注')];
 const filters={...emptyFilters,english:'cet6'};
 const profile={...emptyProfile,cet4:'500'};
 assert.deepEqual(searchPositions(rows,{filters,profile,mode:'profile'}),{indices:[1,2],excluded:1});
 assert.deepEqual(searchPositions(rows,{filters,profile:emptyProfile,mode:'profile'}),{indices:[0,1,2],excluded:0});
 assert.deepEqual(searchPositions(rows,{filters,profile,mode:'raw'}),{indices:[],excluded:0});
});
