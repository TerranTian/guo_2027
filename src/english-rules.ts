import { englishRequirements } from './english';
import type { Position } from './filter';
export type EnglishExam = 'cet4' | 'cet6' | 'ielts' | 'toefl' | 'tem4' | 'tem8';
export type EnglishRule =
 | { kind:'score'; exam:EnglishExam; minimum:number; strict:boolean }
 | { kind:'certificate'; exam:EnglishExam }
 | { kind:'unknown'; reason:string }
 | { kind:'all'|'any'; rules:EnglishRule[] };
export type EnglishBranch = { education:'all'|'本科'|'研究生'|'硕士研究生'|'博士研究生'; evidence:string; rule:EnglishRule };
export type CompiledEnglish = { version:1; branches:EnglishBranch[] };
const unknown=(reason:string):EnglishRule=>({kind:'unknown',reason});
const examPattern=/大学英语(?:等级)?(?:考试)?[四六46]级|英语等级(?:考试)?[四六46]级|英语[四六46]级|(?:英语专业|专业英语|专业)[四八48]级|CET[\s－-]*[46]|TEM[\s－-]*[48]|雅思|IELTS|(?:新)?托福|TOEFL|[四六八468]级/gi;
const cache=new Map<string,CompiledEnglish>();
export function installEnglishRules(rules?:Record<string,CompiledEnglish>) {
 cache.clear();
 for(const [source,rule] of Object.entries(rules || {})) if(rule.version===1 && Array.isArray(rule.branches)) cache.set(source,rule);
}
function exam(label:string,previous?:EnglishExam):EnglishExam {
 if(/雅思|IELTS/i.test(label)) return 'ielts';
 if(/托福|TOEFL/i.test(label)) return 'toefl';
 if(/专业|TEM/i.test(label)||(/^[四八48]级$/.test(label)&&previous?.startsWith('tem'))) return /[八8]/.test(label)?'tem8':'tem4';
 return /[六6]/.test(label)?'cet6':'cet4';
}
function parseClause(source:string):EnglishRule {
 let text=source.normalize('NFKC').replace(/\s+/g,'');
 // These notes remove expiry constraints, not the score requirement itself.
 text=text.replace(/(?:雅思[、,，]?托福|托福或雅思|雅思或托福)?(?:考试)?(?:成绩)?(?:不要求有效期|不限有效期)/g,'').replace(/不限有效期|不要求有效期/g,'');
 text=text.split(/请在|报名时|报名表|网上报名|请注明|请备注/)[0];
 text=text.replace(/^(?:\d+[.、])?(?:2027届高校毕业生|应届高校毕业生)[,，]/,'');
 if(/除|放宽|优先|不要求|不作要求|无需|免|不受|不高于|不超过|至多|条件之一|条件中的|[①②]|应届|非应届/.test(text)) return unknown('存在例外、身份分支或未完整展开的替代条件');
 if(/日语|俄语|法语|德语|PETS|全国英语等级考试|翻译专业资格|CATTI|ICAO/i.test(text)) return unknown('存在未支持的外语考试或替代资格');
 const found=[...text.matchAll(examPattern)];
 if(!found.length) return unknown('未识别出可量化的英语成绩门槛');
 const items:{exam:EnglishExam;tail:string}[]=[];
 for(let i=0;i<found.length;i++) {
  const m=found[i], key=exam(m[0],items.at(-1)?.exam);
  const tail=text.slice(m.index!+m[0].length,found[i+1]?.index);
  if(items.at(-1)?.exam===key) items[items.length-1].tail+=tail;
  else items.push({exam:key,tail});
 }
 const atoms=items.map(({exam:key,tail}):EnglishRule=>{
  if(key==='tem4'||key==='tem8') {
   if(items.filter(i=>i.exam.startsWith('tem')).length>1 && /良好|优秀/.test(text)) return unknown('专业英语证书包含等级要求，需核对是否共同适用');
   if(/良好|优秀|[7-9]\d分|100分/.test(tail)) return unknown(`${key.toUpperCase()}要求具体分数或等级，已通过信息不足`);
   return {kind:'certificate',exam:key};
  }
  const max=key==='ielts'?9:key==='toefl'?120:710;
  const candidates=[...tail.matchAll(/(\d+(?:\.\d+)?)(?:分(?!制)|(?=及以上|以上|及以下|以下|\(含\)))/g)]
   .filter(m=>!/[（(]$/.test(tail.slice(0,m.index)))
   .map(m=>({n:+m[1],index:m.index!})).filter(m=>m.n<=max && (!key.startsWith('cet')||m.n>100));
  if(!candidates.length) return unknown(`${key.toUpperCase()}只有合格描述、旧百分制或未给出可识别分数`);
  // The first total score can be compared even when an additional subscore needs review.
  const subscore=/单项|小分|每项|听力|阅读|口语|写作/.test(tail);
  if(new Set(candidates.map(m=>m.n)).size>1&&!subscore) return unknown(`${key.toUpperCase()}出现多个分数，需核对关系`);
  const first=candidates[0];
  const prefix=tail.slice(0,first.index).replace(/不低于|不小于/g,'');
  const rule:EnglishRule={kind:'score',exam:key,minimum:first.n,strict:/超过|高于|大于/.test(prefix)};
  if(/以下|至多|最多/.test(tail.slice(first.index))) return unknown('出现上限或范围要求');
  return subscore||/有效期|年内|有效成绩/.test(tail)?{kind:'all',rules:[rule,unknown('还需核对单项成绩或成绩有效期')]}:rule;
 });
 if(atoms.length===1) return atoms[0];
 const or=/或|亦可|也可|符合其一|满足其一|满足其中|任一|之一|符合|其中一项/.test(text);
 const and=/且|同时(?:须|需|满足|达到|通过)|均需|均须/.test(text);
 if(or&&and) return unknown('同时含“或”与“且”，需核对组合关系');
 if(!or&&!and) return unknown('并列的多个考试未明确替代或共同满足关系');
 return {kind:or?'any':'all',rules:atoms};
}
export function compileEnglish(remarks:string):CompiledEnglish {
 const cached=cache.get(remarks); if(cached) return cached;
 const p={values:Array.from({length:27},(_,i)=>i===22?remarks:'')} as Position;
 const evidence=englishRequirements(p).evidence;
 const branches:EnglishBranch[]=[];
 // Keep alternatives outside the English snippet from becoming a false rejection.
 const incompleteAlternative=/以下[两二2三3]个?条件|下列[两二2三3]个?条件|[①②]/.test(remarks);
 for(const raw of evidence) {
  if(incompleteAlternative) { branches.push({education:'all',evidence:raw,rule:unknown('原文包含多条替代条件，需要一起核对')}); continue; }
  const text=raw.normalize('NFKC');
  const heads=[...text.matchAll(/本科(?:生|学历)?|研究生(?:学历)?|硕士(?:研究生)?|博士(?:研究生)?/g)]
   .filter(h=>/^(?:须|需|应|要求|的|[:：])*?(?:通过|取得|具备|达到|大学|英语|CET|TEM)/i.test(text.slice(h.index!+h[0].length)));
  if(!heads.length) { branches.push({education:'all',evidence:raw,rule:parseClause(raw)}); continue; }
  if(/本科阶段|本科期间|各学历|各阶段|均须|均需/.test(text)) {branches.push({education:'all',evidence:raw,rule:unknown('涉及多个学习阶段的共同要求')});continue;}
  heads.forEach((h,i)=>{
   const education=h[0].startsWith('本科')?'本科':h[0].startsWith('硕士')?'硕士研究生':h[0].startsWith('博士')?'博士研究生':'研究生';
   const segment=text.slice(h.index!+h[0].length,heads[i+1]?.index);
   branches.push({education,evidence:segment,rule:parseClause(segment)});
  });
 }
 const result:CompiledEnglish={version:1,branches};
 if(cache.size>=20000)cache.clear();cache.set(remarks,result);return result;
}
const names:Record<EnglishExam,string>={cet4:'大学英语四级',cet6:'大学英语六级',ielts:'雅思',toefl:'托福',tem4:'英语专四',tem8:'英语专八'};
export function describeEnglishRule(rule:EnglishRule):string {
 if(rule.kind==='unknown')return `待核对：${rule.reason}`;
 if(rule.kind==='certificate')return `${names[rule.exam]}通过`;
 if(rule.kind==='score')return `${names[rule.exam]} ${rule.strict?'>':'≥'} ${rule.minimum}分`;
 return `${rule.kind==='any'?'满足任一':'同时满足'}（${rule.rules.map(describeEnglishRule).join('；')}）`;
}
