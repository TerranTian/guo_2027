import { catalogue, getMajor, majorSources } from './major';
import type { Filters } from './filter';
export function MajorPicker({filters:f,onChange}:{filters:Filters;onChange:(patch:Partial<Filters>)=>void}) {
 const selected=getMajor(f.majorId);
 const options=f.major.trim()?catalogue.filter(e=>e.level===f.majorLevel && (e.name.includes(f.major.trim())||e.code.includes(f.major.trim()))).slice(0,30):[];
 return <div className="major-picker"><label className="field">专业匹配方式<select value={f.majorMode} onChange={e=>onChange({majorMode:e.target.value,majorId:'',major:''})}><option value="catalog">按专业目录匹配</option><option value="keyword">按原文关键词搜索</option></select></label>
 {f.majorMode==='catalog' && <label className="field">报考专业的学历层次<select value={f.majorLevel} onChange={e=>onChange({majorLevel:e.target.value,majorId:'',major:''})}>{['本科','研究生','大专','职业本科'].map(l=><option key={l}>{l}</option>)}</select></label>}
 <label className="field">{f.majorMode==='catalog'?'我的专业名称 / 代码':'专业关键词'}<input value={f.major} placeholder="例如：软件工程、080902" onChange={e=>onChange({major:e.target.value,majorId:''})}/></label>
 {f.majorMode==='catalog' && !selected && f.major.trim() && <div className="major-options" aria-label="专业目录候选"><p className="field-help">请选择具体目录条目后查看结果</p>{options.map(e=><button key={e.id} onClick={()=>onChange({majorId:e.id,major:e.name})}>{e.name} · {e.code}<small>{e.historical?'历史目录 · 待核对':majorSources.find(s=>s.id===e.sourceId)?.title}</small></button>)}{!options.length && <p>目录暂未收录，可切换原文搜索。</p>}</div>}
 {selected && f.majorMode==='catalog' && <div className="major-path"><strong>{selected.name} · {selected.code}</strong><p>{selected.parents.map(p=>p.name).join(' → ') || '目录未列出上级类别'}</p><a href={majorSources.find(s=>s.id===selected.sourceId)?.url} target="_blank" rel="noreferrer">查看目录依据 ↗</a><p>税务职位优先按税务参考目录；附加限制保留为待核对。</p></div>}
 </div>;
}
