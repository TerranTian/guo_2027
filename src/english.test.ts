import { test } from 'node:test';
import assert from 'node:assert/strict';
import { englishRequirements } from './english';
import { emptyFilters, matches, type Position } from './filter';
import { restorePreferences } from './storage';
const position = (remarks:string): Position => ({id:'1',sheet:'',row:1,values:Array.from({length:27},(_,i)=>i===22?remarks:'')});
test('English categories preserve alternatives, scores and education branches',()=>{
 const text='本科生大学英语四级考试425分及以上，研究生大学英语六级考试425分及以上（雅思6.5分或托福90分亦可）';
 const result=englishRequirements(position(text));
 assert.deepEqual(result.kinds,['cet4','cet6','ielts','toefl']);
 assert.deepEqual(result.evidence,[text]);
 for(const english of result.kinds) assert.equal(matches(position(text),{...emptyFilters,english}),true);
});
test('professional English is distinct from college English and abbreviations work',()=>{
 assert.deepEqual(englishRequirements(position('英语专业四级或专业八级合格')).kinds,['tem4','tem8']);
 assert.deepEqual(englishRequirements(position('CET-4、CET6、TEM－4、TEM8、IELTS、TOEFL')).kinds,['cet4','cet6','tem4','tem8','ielts','toefl']);
});
test('absence, explicit unrestricted and other English descriptions stay distinct',()=>{
 assert.deepEqual(englishRequirements(position('计算机四级；法语六级；俄语专业八级')).kinds,['unmentioned']);
 assert.deepEqual(englishRequirements(position('英语无要求')).kinds,['unrestricted']);
 assert.deepEqual(englishRequirements(position('具有良好的英语口语能力')).kinds,['other']);
 assert.deepEqual(englishRequirements(position('英语专业八级证书不作要求')).kinds,['tem8']);
 assert.equal(matches(position(''),{...emptyFilters,english:'unrestricted'}),false);
});
test('English filters restore safely and default to no filtering',()=>{
 assert.equal(restorePreferences({filters:{english:'cet6'}}).filters.english,'cet6');
 assert.equal(restorePreferences({filters:{english:'bad'}}).filters.english,'');
 assert.equal(restorePreferences({filters:{query:'北京'}}).filters.english,'');
});
