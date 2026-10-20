import { compileEnglish, describeEnglishRule, type EnglishRule } from './english-rules';
import type { Check, Position } from './filter';
import { englishRequirements } from './english';
export const scoreFields = { cet4: { label:'大学英语四级成绩', max:710 }, cet6: { label:'大学英语六级成绩', max:710 }, ielts: { label:'雅思总分', max:9 }, toefl: { label:'托福总分', max:120 } };
export type ScoreKey = keyof typeof scoreFields;
export type EnglishScores = Record<ScoreKey,string> & { tem4:string; tem8:string };
export const emptyScores: EnglishScores = {cet4:'',cet6:'',ielts:'',toefl:'',tem4:'',tem8:''};
export function validScore(key:ScoreKey, value:unknown): value is string {
 return typeof value==='string' && /^\d+(?:\.\d+)?$/.test(value) && +value>=0 && +value<=scoreFields[key].max && (key==='ielts' || Number.isInteger(+value));
}
function evaluate(rule:EnglishRule,scores:EnglishScores):Check['status'] {
 if(rule.kind==='unknown') return 'review';
 if(rule.kind==='certificate') {
  const value=scores[rule.exam];
  return value==='已通过'?'pass':value==='未通过'?'fail':'review';
 }
 if(rule.kind==='score') {
  if(!(rule.exam in scoreFields))return 'review';
  const key=rule.exam as ScoreKey,value=scores[key];
  if(!validScore(key,value))return 'review';
  return (rule.strict?+value>rule.minimum:+value>=rule.minimum)?'pass':'fail';
 }
 const statuses=rule.rules.map(r=>evaluate(r,scores));
 if(rule.kind==='any')return statuses.includes('pass')?'pass':statuses.includes('review')?'review':'fail';
 return statuses.includes('fail')?'fail':statuses.includes('review')?'review':'pass';
}
function missingExams(rule:EnglishRule,scores:EnglishScores):string[] {
 if(rule.kind==='unknown')return [];
 if('rules' in rule)return rule.rules.flatMap(r=>missingExams(r,scores));
 return !scores[rule.exam]?[({cet4:'四级',cet6:'六级',ielts:'雅思',toefl:'托福',tem4:'专四',tem8:'专八'})[rule.exam]]:[];
}
export function checkEnglishScores(p:Position, scores:EnglishScores,education:string):(Check & {summary:string}) | undefined {
 const entered = (Object.keys(emptyScores) as (keyof EnglishScores)[]).map(key => [key,scores[key] || ''] as const).filter(([,v]) => v);
 if(!entered.length) return;
 const evidence=englishRequirements(p).evidence;
 const compiled=compileEnglish(p.values[22]);
 const applicable=compiled.branches.filter(b=>b.education==='all'||b.education===education||(b.education==='研究生'&&education.includes('研究生')));
 const needsEducation=compiled.branches.some(b=>b.education!=='all')&&!education;
 const statuses=applicable.map(b=>evaluate(b.rule,scores));
 if(needsEducation)statuses.push('review');
 const status=statuses.includes('fail')?'fail':!statuses.length||statuses.includes('review')?'review':'pass';
 const missing=[...new Set(applicable.flatMap(b=>missingExams(b.rule,scores)))];
 const summary=status==='fail'?'英语成绩 / 证书未达到明确要求':status==='pass'?'英语成绩门槛初步相符':needsEducation?'英语待核对：请填写最高学历以匹配相应分支':missing.length?`英语待核对：${missing.join('、')}未填写；填0或未通过可明确排除不满足的分支`:!evidence.length?'备注未提及英语，保留待核对':'英语待核对：存在例外、单项成绩或无法量化的要求';
 const requirements=applicable.map(b=>`${b.education==='all'?'通用':b.education}：${describeEnglishRule(b.rule)}`).join('；');
 const filled=entered.map(([k,v])=>`${k.toUpperCase()}：${v==='0'?'未参加 / 无成绩':v}`).join('，');
 return {label:'英语成绩',status,summary,reason:`${filled}。${summary}。${requirements?' 识别规则：'+requirements:''}${evidence.length?' 原文：'+evidence.join('；'):''}`};
}
