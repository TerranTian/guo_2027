/** Derive inspectable English rules without changing any original spreadsheet cells. */
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { compileEnglish, describeEnglishRule, type EnglishRule, type CompiledEnglish } from '../src/english-rules';
import type { Dataset } from '../src/filter';
const root=new URL('../',import.meta.url);
const file=new URL('public/positions.json',root);
const data:Dataset=JSON.parse(readFileSync(file,'utf8'));
const original=createHash('sha256').update(JSON.stringify(data.rows.map(p=>[p.id,p.sheet,p.row,p.values]))).digest('hex');
const rules:Record<string,CompiledEnglish>={};
const grouped=new Map<string,{source:string;rule:CompiledEnglish;positions:{id:string;sheet:string;row:number}[]}>();
const hasUnknown=(rule:EnglishRule):boolean=>rule.kind==='unknown'||(('rules' in rule)&&rule.rules.some(hasUnknown));
for(const p of data.rows){
 const source=p.values[22];const rule=compileEnglish(source);
 if(!rule.branches.length)continue;
 rules[source]=rule;
 const existing=grouped.get(source)||{source,rule,positions:[]};
 existing.positions.push({id:p.id,sheet:p.sheet,row:p.row});grouped.set(source,existing);
}
data.englishRules=rules;
const verified=createHash('sha256').update(JSON.stringify(data.rows.map(p=>[p.id,p.sheet,p.row,p.values]))).digest('hex');
if(verified!==original)throw new Error('Original cells changed');
writeFileSync(file,JSON.stringify(data));
const entries=[...grouped.values()].map(g=>({...g,needsReview:g.rule.branches.some(b=>hasUnknown(b.rule)),summary:g.rule.branches.map(b=>`${b.education}: ${describeEnglishRule(b.rule)}`)}));
const summary={totalPositions:data.rows.length,englishPositions:entries.reduce((n,g)=>n+g.positions.length,0),uniqueRemarks:entries.length,fullyStructuredPositions:entries.filter(g=>!g.needsReview).reduce((n,g)=>n+g.positions.length,0),reviewPositions:entries.filter(g=>g.needsReview).reduce((n,g)=>n+g.positions.length,0),originalCellsHash:original};
mkdirSync(new URL('data/',root),{recursive:true});
writeFileSync(new URL('data/english-rules-audit.json',root),JSON.stringify({version:1,summary,entries},null,2)+'\n');
console.log('English data preparation:',summary);
