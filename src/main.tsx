import React, { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { createRoot } from 'react-dom/client';
import { alertOptions, checkProfile, emptyFilters, emptyProfile, extractAlerts, locationTerms, retainLocations, matches, profileOptions, provinces, toCsv, unlimitedMajor, type Dataset, type Filters, type Position, type Profile } from './filter';
import { readLocal, restorePreferences, stringList, stringMap } from './storage';
import './style.css';
import { installEnglishRules, compileEnglish, describeEnglishRule } from './english-rules';
import { checkEnglishScores, scoreFields, type ScoreKey } from './english-score';
import { englishOptions, englishRequirements } from './english';
import { useSearch } from './useSearch';
import { MajorPicker } from './MajorPicker';
import { matchMajor, majorSources } from './major';

const labels: Record<string, string> = { query: '关键词', major: '专业', location: '城市 / 区县', education: '学历要求', degree: '学位要求', politics: '政治面貌要求', years: '基层工作最低年限', project: '基层项目要求', category: '招录类别', department: '招录部门', exam: '考试类别', test: '面试阶段专业能力测试', alert: '备注关注项', english: '英语要求' };
const profileLabels: Record<keyof Profile, string> = { education: '我的最高学历', degree: '对应学位', politics: '我的政治面貌', years: '我的基层工作年限', project: '我的基层项目经历', graduation: '我的毕业身份', gender: '我的性别', cet4: '四级成绩', cet6: '六级成绩', ielts: '雅思总分', toefl: '托福总分', tem4: '专四', tem8: '专八' };
const number = (n: number) => n.toLocaleString('zh-CN');
const display = (v: string) => v || '原表未填写';
const compareFields = [1, 2, 4, 20, 11, 13, 14, 12, 15, 16, 17, 10, 18, 19, 22];

function Modal({ title, onClose, children, className = '' }: { title: string; onClose: () => void; children: ReactNode; className?: string }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current!;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden'; dialog.showModal();
    return () => { dialog.close(); document.body.style.overflow = previous; };
  }, []);
  return <dialog ref={ref} className={className} aria-label={title} onCancel={e => { e.preventDefault(); onClose(); }} onClick={e => { if (e.target === e.currentTarget) { const r = e.currentTarget.getBoundingClientRect(); if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) onClose(); } }}>{children}</dialog>;
}
function EnglishMatchEvidence({position,profile}:{position:Position;profile:Profile}) {
  const check=checkEnglishScores(position,profile,profile.education);
  return check ? <p className="match-evidence">{check.summary}</p> : null;
}
function App() {
  const [data, setData] = useState<Dataset>();
  const [error, setError] = useState('');
  const [initial] = useState(() => restorePreferences(readLocal('guo-preferences-2027-v2')));
  const [filters, setFilters] = useState(initial.filters);
  const [profile, setProfile] = useState(initial.profile);
  const [mode, setMode] = useState(initial.mode);
  const queryState = useMemo(() => ({ filters, profile, mode }), [filters, profile, mode]);
  const deferred = queryState;
  const search = useSearch(data, queryState);
  const [tab, setTab] = useState('all');
  const [sort, setSort] = useState('default');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Position>();
  const [mobileFilters, setMobileFilters] = useState(false);
  const filterButton = useRef<HTMLButtonElement>(null);
  const resultsTop = useRef<HTMLDivElement>(null);
  const [notice, setNotice] = useState('');
  const [saved, setSaved] = useState(() => stringList(readLocal('guo-saved')));
  const [notes, setNotes] = useState(() => stringMap(readLocal('guo-notes-2027')));
  const [compared, setCompared] = useState<string[]>([]);
  const [compareOpen, setCompareOpen] = useState(false);
  const [differences, setDifferences] = useState(false);
  const [sourceOpen, setSourceOpen] = useState(false);
  useEffect(() => {
    const controller = new AbortController();
    fetch(`${import.meta.env.BASE_URL}positions.json`, { signal: controller.signal }).then(r => { if (!r.ok) throw new Error(); return r.json(); })
      .then((loaded: Dataset) => {
        if (!Array.isArray(loaded.rows) || !Array.isArray(loaded.headers) || loaded.headers.length !== 27 || !loaded.rows.every(p => typeof p.id === 'string' && p.values.length === 27 && p.values.every(v => typeof v === 'string'))) throw new Error('Invalid data');
        installEnglishRules(loaded.englishRules);
        setData(loaded); const valid = new Set(loaded.rows.map(p => p.id)); setSaved(ids => ids.filter(id => valid.has(id)));
      }).catch(e => { if (e.name !== 'AbortError') setError('职位数据加载失败，请检查连接或数据文件后重试。'); });
    return () => controller.abort();
  }, []);
  useEffect(() => {
    try { localStorage.setItem('guo-saved', JSON.stringify(saved)); localStorage.setItem('guo-notes-2027', JSON.stringify(notes)); localStorage.setItem('guo-preferences-2027-v2', JSON.stringify({ filters, profile, mode })); }
    catch { setNotice('浏览器无法保存数据，本次收藏、备注和筛选可能无法在关闭后保留。'); }
  }, [saved, notes, filters, profile, mode]);
  const byId = useMemo(() => new Map(data?.rows.map(p => [p.id, p]) || []), [data]);
  const options = useMemo(() => Object.fromEntries([13, 14, 15, 16, 10, 1].map(col => [col, [...new Set(data?.rows.map(p => p.values[col]) || [])].filter(Boolean).sort((a,b) => a.localeCompare(b, 'zh-CN'))])), [data]);
  const workLocations = useMemo(() => [...new Set(data?.rows.map(p => p.values[20]).filter(Boolean) || [])].sort((a,b) => a.localeCompare(b,'zh-CN')), [data]);
  const locations = useMemo(() => filters.regions.length ? workLocations.filter(place => filters.regions.some(region => place.includes(region))) : [], [workLocations, filters.regions]);
  const selectedLocations = useMemo(() => [...new Set(locationTerms(filters.location))], [filters.location]);
  const locationOptions = useMemo(() => locations.map(place => <option key={place} disabled={selectedLocations.includes(place)}>{place}</option>), [locations, selectedLocations]);
  const searchResult = useMemo(() => ({
    result: search.response && search.response.data === data ? search.response.indices.map(i => data!.rows[i]) : [],
    excluded: search.response?.excluded || 0,
  }), [data, search.response]);
  // Favorites are a stable shortlist: changing search filters must not hide saved positions.
  const result = useMemo(() => {
    const rows = tab === 'saved' ? (data?.rows || []).filter(p => saved.includes(p.id)) : [...searchResult.result];
    return sort === 'count' ? rows.sort((a,b) => +b.values[11] - +a.values[11]) : rows;
  }, [data, searchResult, tab, saved, sort]);
  const comparison = compared.map(id => byId.get(id)).filter((p): p is Position => !!p);
  const totalPeople = useMemo(() => data?.rows.reduce((n,p) => n + +p.values[11], 0) || 0, [data]);
  const people = useMemo(() => result.reduce((n,p) => n + +p.values[11], 0), [result]);
  const pageCount = Math.max(1, Math.ceil(result.length / 20));
  const currentPage = Math.min(page, pageCount);
  const visible = result.slice((currentPage - 1) * 20, currentPage * 20);
  const active: { key: string; label: string; clear: () => void }[] = Object.entries(filters).flatMap(([k, v]) => {
    if (['majorMode','majorId','majorLevel','location'].includes(k) || k === 'includeUnlimited' || k === 'regions' || !v || (mode === 'profile' && ['education','degree','politics','years','project','english'].includes(k))) return [];
    return [{ key: k, label: `${labels[k]}：${k === 'english' ? englishOptions.find(o => o.value === v)?.label || v : k === 'alert' ? alertOptions.find(a => a.value === v)?.label || v : v}`, clear: () => k === 'major' ? setFilters(f => ({...f,major:'',majorId:''})) : change(k as keyof Filters, '') }];
  });
  filters.regions.forEach(r => active.push({ key: r, label: r, clear: () => changeRegions(filters.regions.filter(v => v !== r)) }));
  selectedLocations.forEach(place => active.push({ key: `location-${place}`, label: place, clear: () => change('location', selectedLocations.filter(v => v !== place).join('、')) }));
  if (mode === 'profile') Object.entries(profile).forEach(([k,v]) => { if (v) active.push({ key: `profile-${k}`, label: `${profileLabels[k as keyof Profile]}：${v}`, clear: () => changeProfile(k as keyof Profile, '') }); });
  function change<K extends keyof Filters>(key: K, value: Filters[K]) { setFilters(f => ({ ...f, [key]: value })); setPage(1); }
  function changeRegions(regions: string[]) {
    setFilters(f => ({...f, regions, location: data ? retainLocations(f.location, regions, workLocations) : f.location}));
    setPage(1);
  }
  function changeProfile(key: keyof Profile, value: string) { setProfile(p => ({ ...p, [key]: value })); setPage(1); }
  function favorite(p: Position) { setSaved(s => s.includes(p.id) ? s.filter(id => id !== p.id) : [...s, p.id]); }
  function reset() { setFilters({ ...emptyFilters, regions: [] }); setProfile({ ...emptyProfile }); setPage(1); }
  function toggleCompare(p: Position) {
    if (compared.includes(p.id)) setCompared(s => s.filter(id => id !== p.id));
    else if (compared.length < 4) setCompared(s => [...s, p.id]);
    else setNotice('最多对比 4 个职位，请先移除一个。');
  }
  function exportRows(rows = result, name = tab === 'saved' ? '收藏' : '筛选') {
    if (!data) return;
    const withMajor = filters.majorMode === 'catalog' && !!filters.majorId;
    const header = [...data.headers, '我的备注', ...(withMajor ? ['专业匹配依据', '专业目录来源'] : [])];
    const csv = toCsv(header, rows.map(p => {
      const evidence = withMajor ? matchMajor(p, filters.majorId, filters.includeUnlimited) : undefined;
      return { ...p, values: [...p.values, notes[p.id] || '', ...(evidence ? [evidence.reason, majorSources.find(s => s.id === evidence.sourceId)?.url || ''] : [])] };
    }));
    const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv;charset=utf-8;' }));
    const a = document.createElement('a'); a.href = url; a.download = `2027国考-${name}-${rows.length}条.csv`; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
    setNotice(`已导出 ${number(rows.length)} 条职位，含完整要求和我的备注。`);
  }
  function select(key: keyof Filters, values: string[], title = labels[key]) {
    return <label className="field">{title}<select value={String(filters[key])} onChange={e => change(key, e.target.value as never)}><option value="">不限筛选</option>{values.map(v => <option key={v}>{v}</option>)}</select></label>;
  }
  function profileSelect(key: keyof typeof profileOptions) {
    return <label className="field">{profileLabels[key]}<select value={profile[key]} onChange={e => changeProfile(key, e.target.value)}><option value="">暂不填写</option>{profileOptions[key].map(v => <option key={v}>{v}</option>)}</select></label>;
  }
  function scoreInput(key: ScoreKey) {
    return <label className="field" key={key}>{scoreFields[key].label}<input aria-label={scoreFields[key].label} type="number" min="0" max={scoreFields[key].max} step={key === 'ielts' ? '0.5' : '1'} placeholder={`未填写（0–${scoreFields[key].max}）`} value={profile[key]} onChange={e => { const v = e.target.value; if (v === '' || (Number.isFinite(+v) && +v >= 0 && +v <= scoreFields[key].max)) changeProfile(key,v); }}/></label>;
  }
  function movePage(value: number) { setPage(value); resultsTop.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }); }
  function noteField(p: Position) {
    return <label className="note-field">我的选岗备注 <small>自动保存到本机 · {saved.includes(p.id) ? '已在收藏夹' : '保存备注会加入收藏'}</small><textarea maxLength={1000} rows={3} value={notes[p.id] || ''} placeholder="例如：优先考虑；专业口径待电话咨询…" onChange={e => { setNotes(n => ({ ...n, [p.id]: e.target.value })); if (e.target.value && !saved.includes(p.id)) setSaved(s => s.includes(p.id) ? s : [...s, p.id]); }}/></label>;
  }
  const selectedChecks = selected ? checkProfile(selected, profile) : [];
  return <>
    <header><div className="header-inner"><a className="brand" href="./"><span className="brand-icon">选</span>选个好职位<span className="brand-sub">2027 国考职位库</span></a><button className="source-pill" onClick={() => setSourceOpen(true)}><i/> 数据说明 ↗</button></div></header>
    <main>
      <section className="hero"><div><div className="eyebrow">2027 国家公务员考试 · 职位初筛</div><h1>把适合的职位，留在眼前。</h1><p>先核对条件，再比较选择。<br className="mobile-break"/>每一条要求，都能回到原表查看。</p></div><div className="hero-stats"><div><strong>{data ? number(data.rows.length) : '—'}</strong><span>招考职位</span></div><div><strong>{data ? number(totalPeople) : '—'}</strong><span>计划招录人数</span></div><span className="stat-decoration">↗</span></div></section>
      <div className="workspace">
        <button ref={filterButton} className="mobile-filter-toggle" aria-expanded={mobileFilters} aria-controls="filters" onClick={() => setMobileFilters(v => !v)}>{mobileFilters ? '收起' : '展开'}筛选条件 {active.length ? `(${active.length})` : ''}</button>
        <aside id="filters" className={mobileFilters ? 'filters expanded' : 'filters'}>
          <div className="filter-heading"><h2>找到我的职位</h2><button className="text-button" onClick={reset}>重置全部</button></div>
          <div className="filter-body">
            <div className="mode-switch" role="group" aria-label="筛选模式"><button aria-pressed={mode === 'profile'} onClick={() => { setMode('profile'); setPage(1); }}>按我的条件</button><button aria-pressed={mode === 'raw'} onClick={() => { setMode('raw'); setPage(1); }}>按职位原文</button></div>
            <p className="mode-help">{mode === 'profile' ? '填写自己的条件，兼容“不限”等要求。未填写的条件不参与初筛。' : '精确选择职位表中的要求，不等同于按个人资格匹配。'}</p>
            {mode === 'profile' ? <>{profileSelect('education')}{profileSelect('degree')}{profileSelect('politics')}{profileSelect('graduation')}<div className="filter-section-title">我的英语成绩</div>{(['cet4','cet6'] as ScoreKey[]).map(scoreInput)}<details className="personal-more"><summary>其他英语成绩 / 证书 <span>＋</span></summary>{(['ielts','toefl'] as ScoreKey[]).map(scoreInput)}{(['tem4','tem8'] as const).map(key => <label className="field" key={key}>{profileLabels[key]}<select value={profile[key]} onChange={e => changeProfile(key,e.target.value)}><option value="">暂不填写</option><option>已通过</option><option>未通过</option></select></label>)}</details><p className="field-help">填写成绩后自动筛选，无需另选英语要求。四、六级按710分制填写。留空表示未填写，0表示未参加或无成绩；有替代证书但未填写时保留待核对。填写最高学历可区分本科与研究生要求。</p><details className="personal-more"><summary>身份与经历 <span>＋</span></summary>{profileSelect('years')}{profileSelect('project')}{profileSelect('gender')}<p className="field-help">毕业身份、项目年限及备注中的例外条件，需按招录机关口径确认。</p></details></> : <>{select('education', options[13] || [])}{select('degree', options[14] || [])}{select('politics', options[15] || [])}{select('years', options[16] || [])}{select('project', ['无限制', ...profileOptions.project.filter(p => p !== '无项目经历')])}</>}
            <div className="filter-section-title">专业与地点</div>
            <MajorPicker filters={filters} onChange={patch => { setFilters(f => ({...f,...patch})); setPage(1); }}/>

            <label className="check-field"><input type="checkbox" checked={filters.includeUnlimited} onChange={e => change('includeUnlimited', e.target.checked)}/>同时包含对应学历不限专业的职位</label>
            <label className="field">工作省份 <small>可添加多个，满足其中一个即可</small><select aria-label="添加工作省份" value="" onChange={e => { if (e.target.value && !filters.regions.includes(e.target.value)) { changeRegions([...filters.regions, e.target.value]); } }}><option value="">{filters.regions.length ? '继续添加省份' : '全国 · 添加省份'}</option>{provinces.map(p => <option key={p} disabled={filters.regions.includes(p)}>{p}</option>)}</select></label>
            {!!filters.regions.length && <div className="region-chips">{filters.regions.map(r => <button key={r} aria-label={`移除地区 ${r}`} onClick={() => { changeRegions(filters.regions.filter(v => v !== r)); }}>{r} ×</button>)}</div>}
            <label className="field">城市 / 区县 <small>可添加多个，满足其中一个即可</small><select aria-label="添加城市或区县" value="" disabled={!filters.regions.length || !locations.length} onChange={e => { if (e.target.value && !selectedLocations.includes(e.target.value)) change('location', [...selectedLocations,e.target.value].join('、')); }}><option value="">{!filters.regions.length ? '请先选择工作省份' : !locations.length ? '暂无可选工作地点' : selectedLocations.length ? '继续添加城市 / 区县' : '全部城市 / 区县 · 添加地点'}</option>{locationOptions}</select><small>选项来自职位表的工作地点；仅显示已选省份内的地点。</small></label>
            {!!selectedLocations.length && <div className="region-chips">{selectedLocations.map(place => <button key={place} aria-label={`移除工作地点 ${place}`} onClick={() => change('location', selectedLocations.filter(v => v !== place).join('、'))}>{place} ×</button>)}</div>}
            {mode === 'raw' && <label className="field">英语原文类型<select aria-label="英语原文类型" value={filters.english} onChange={e => change('english', e.target.value)}><option value="">全部英语要求</option>{englishOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}</select><small>按备注原文提及筛选；未提及不等于不限。分数、学历分段及替代证书见详情。</small></label>}
            <details><summary>部门与其他条件 <span>＋</span></summary>{select('department', options[1] || [])}{select('category', data?.sources.map(s => s.name) || [])}{select('exam', options[10] || [])}{select('test', ['是', '否'])}<label className="field">备注关注项<select value={filters.alert} onChange={e => change('alert', e.target.value)}><option value="">全部职位</option>{alertOptions.map(a => <option value={a.value} key={a.value}>原文提及{a.label}</option>)}</select><small>按原文提及筛选，不代表已认定限制。</small></label></details>
            <div className="filter-tip"><span>ⓘ</span><p>初筛结果仍需核对专业、备注与公告。条件与收藏仅保存在此浏览器。</p></div>
            <button className="mobile-done primary" onClick={() => { setMobileFilters(false); filterButton.current?.focus(); }}>收起筛选 · 查看结果</button>
          </div>
        </aside>
        <section className="results" aria-label="职位列表">
          <div className="result-tabs"><div role="tablist" aria-label="浏览范围"><button role="tab" aria-selected={tab === 'all'} className={tab === 'all' ? 'selected' : ''} onClick={() => { setTab('all'); setPage(1); }}>职位初筛</button><button role="tab" aria-selected={tab === 'saved'} className={tab === 'saved' ? 'selected' : ''} onClick={() => { setTab('saved'); setPage(1); }}>我的收藏 <span>{saved.length}</span></button></div><button className="export" disabled={!result.length || (tab === 'all' && search.pending)} onClick={() => exportRows()}>↓ 导出{tab === 'saved' ? '收藏' : '结果'}</button></div>
          {tab === 'all' ? <><div className="search-bar"><span aria-hidden="true">⌕</span><input aria-label="搜索职位" placeholder="搜部门、职位、代码或备注，空格分隔多个关键词" value={filters.query} onChange={e => change('query', e.target.value)}/>{filters.query && <button aria-label="清空搜索" onClick={() => change('query', '')}>×</button>}</div>
          {!!active.length && <div className="chips">{active.map(a => <button key={a.key} onClick={a.clear}>{a.label} <span>×</span></button>)}<button className="clear-all" onClick={reset}>清空条件</button></div>}
          <div className="result-guidance"><span>ⓘ</span><p>{mode === 'profile' ? `仅按已填写条件初筛${searchResult.excluded ? `，排除 ${number(searchResult.excluded)} 个明确不匹配职位` : ''}。专业和备注中的其他要求，请逐项确认。` : '当前按原表要求精确筛选；若要填写自己的条件，请切换左侧模式。'}</p></div></> : <div className="result-guidance"><span>★</span><p>这里显示全部收藏，不受左侧筛选影响。可添加备注、加入对比，集中做选择。</p></div>}
          <div className="result-summary" ref={resultsTop}><p aria-live="polite">{!data ? '正在读取职位…' : search.pending && tab === 'all' ? '正在更新查询结果…' : <>共 <b>{number(result.length)}</b> 个职位 <span>· 招录 {number(people)} 人</span></>}</p><select aria-label="排序方式" value={sort} onChange={e => { setSort(e.target.value); setPage(1); }}><option value="default">原表顺序</option><option value="count">招录人数最多</option></select></div>
          {(error || search.error) ? <div className="empty"><h3>{error || search.error}</h3><button className="primary" onClick={() => window.location.reload()}>重新加载</button></div> : !data ? <div className="empty">正在整理职位信息…</div> : search.pending && tab === 'all' && !result.length ? <div className="empty">正在匹配职位…</div> : !result.length ? <div className="empty"><div className="empty-icon">⌕</div><h3>{tab === 'saved' ? '把心仪的职位留在这里' : '暂时没有匹配的职位'}</h3><p>{tab === 'saved' ? '点击职位旁的星标，方便之后比较和记录。' : '请先选择目录中的具体专业，或删除单个条件；未收录的专业可切换原文搜索。'}</p><button className="primary" onClick={() => { if (tab === 'saved') setTab('all'); else reset(); }}> {tab === 'saved' ? '返回职位初筛' : '清空全部条件'}</button></div> : <div className="cards">{visible.map(p => {
            const alerts = extractAlerts(p);
            return <article className="job-card" key={p.id}><div className="card-top"><span className="department">{p.values[1]}</span><button className={`save ${saved.includes(p.id) ? 'is-saved' : ''}`} aria-label={`${saved.includes(p.id) ? '取消收藏' : '收藏'} ${p.values[4]} ${p.id}`} aria-pressed={saved.includes(p.id)} onClick={() => favorite(p)}>{saved.includes(p.id) ? '★' : '☆'}</button></div><div className="job-title-row"><button className="job-title" onClick={() => setSelected(p)}>{p.values[4]}</button><span className="hiring">招 <b>{p.values[11]}</b> 人</span></div><p className="bureau">{p.values[2]}<span>·</span><span className="code">{p.values[8]}</span></p><div className="tags"><span>⌖ {p.values[20]}</span><span>{p.values[13]}</span><span>{p.values[15]}</span><span>{p.values[16] === '无限制' ? '不限基层年限' : `基层 ${p.values[16]}`}</span></div><div className="major"><span>专业要求</span><p>{display(p.values[12])}</p></div>
            {tab === 'all' && !search.pending && deferred.filters.major.trim() && <p className="match-evidence">{deferred.filters.majorMode === 'catalog' ? matchMajor(p, deferred.filters.majorId, deferred.filters.includeUnlimited).reason : unlimitedMajor(p.values[12]) ? '已包含：原表完全不限专业' : `专业原文包含“${deferred.filters.major.trim()}” · 学历阶段需核对`}</p>}
            {tab === 'all' && mode === 'profile' && !search.pending && <EnglishMatchEvidence position={p} profile={profile}/>}
            {(alerts.length > 0 || p.values[17] !== '无限制') && <button className="alert-preview" onClick={() => setSelected(p)}><span>需留意</span><span>{[...(p.values[17] !== '无限制' ? ['基层项目要求'] : []), ...alerts.map(a => a.label)].slice(0,3).join(' · ')}{alerts.length + +(p.values[17] !== '无限制') > 3 ? ' …' : ''}</span><span>›</span></button>}
            {saved.includes(p.id) && <button className={`note-preview ${notes[p.id] ? 'has-note' : ''}`} onClick={() => setSelected(p)}>{notes[p.id] ? `✎ ${notes[p.id]}` : '＋ 添加选岗备注'}</button>}
            <div className="card-bottom"><span>面试阶段{p.values[18] === '是' ? '有' : '无'}专业测试 · 比例 {p.values[19]}</span><div className="card-actions"><button className={compared.includes(p.id) ? 'in-compare' : ''} aria-pressed={compared.includes(p.id)} aria-label={`对比 ${p.values[4]} ${p.id}`} onClick={() => toggleCompare(p)}>{compared.includes(p.id) ? '✓ 已选' : '＋ 对比'}</button><button onClick={() => setSelected(p)}>详情 ↗</button></div></div></article>;
          })}</div>}
          {!!result.length && <nav className="pagination" aria-label="分页"><span>每页 20 条</span><div><button disabled={currentPage === 1} onClick={() => movePage(currentPage - 1)}>上一页</button><label><input aria-label="页码" type="number" min="1" max={pageCount} value={currentPage} onChange={e => movePage(Math.max(1, Math.min(pageCount, Number(e.target.value) || 1)))}/> / {pageCount}</label><button disabled={currentPage === pageCount} onClick={() => movePage(currentPage + 1)}>下一页</button></div></nav>}
        </section>
      </div>
      <footer><span>2027 国考 · 选个好职位</span><span>来源：{data?.file || 'data.xls'} · 原表静态数据 · 资格条件以招录机关解释为准</span></footer>
    </main>
    {!!comparison.length && <div className="compare-dock" aria-label="职位对比栏"><div className="compare-picks">{comparison.map((p,i) => <button key={p.id} aria-label={`移除对比 ${p.values[1]} ${p.values[8]}`} onClick={() => toggleCompare(p)} title={`${p.values[1]} · ${p.values[4]} · ${p.values[8]}`}>{i+1}. {p.values[1]} · {p.values[8].slice(-4)} <span>×</span></button>)}</div><div><span>{comparison.length}/4</span><button className="text-button" onClick={() => setCompared([])}>清空</button><button className="primary" disabled={comparison.length < 2} onClick={() => setCompareOpen(true)}>开始对比</button></div></div>}
    {notice && <div className="toast" role="status">{notice}<button aria-label="关闭提示" onClick={() => setNotice('')}>×</button></div>}
    {selected && <Modal title="职位详情" onClose={() => setSelected(undefined)}><div className="detail-header"><div><span className="eyebrow">2027 国考 · 职位详情</span><h2>{selected.values[4]}</h2><p>{selected.values[1]} · {selected.values[2]}</p></div><button className="close" aria-label="关闭详情" onClick={() => setSelected(undefined)}>×</button></div><div className="detail-content">
      {filters.majorMode === 'catalog' && filters.majorId && <section className="checks"><h3>专业目录匹配依据</h3><p>{matchMajor(selected, filters.majorId, filters.includeUnlimited).reason}</p>{majorSources.filter(s => s.id === matchMajor(selected, filters.majorId, filters.includeUnlimited).sourceId).map(s => <a key={s.id} href={s.url} target="_blank" rel="noreferrer">{s.title} ↗</a>)}<p className="field-help">目录匹配用于初筛；方向、学习经历及招录部门解释仍需核对。</p></section>}
      {mode === 'profile' && selectedChecks.length > 0 && <section className="checks"><h3>我的条件核对 <span>仅核对已填写项</span></h3>{selectedChecks.map(c => <div className={`check-row ${c.status}`} key={c.label}><strong>{c.status === 'pass' ? '✓ 初步相符' : c.status === 'fail' ? '× 不匹配' : '○ 待核对'} · {c.label}</strong><p>{c.reason}</p></div>)}<p className="field-help">年龄、资格证书等未在此自动判定；初步相符不代表通过资格审查。</p></section>}
      <section className="checks"><h3>英语规则与原文</h3>{compileEnglish(selected.values[22]).branches.map((b,i) => <p key={`rule-${i}`}><strong>{b.education === 'all' ? '通用要求' : b.education}：</strong>{describeEnglishRule(b.rule)}</p>)}{englishRequirements(selected).evidence.length ? englishRequirements(selected).evidence.map((text, i) => <p key={i}>{text}</p>) : <p>备注未提及英语，不代表招录公告没有要求。</p>}<p className="field-help">按原文核对分数、有效期、学历阶段及“或 / 且”等条件；成绩初筛只排除明确不符项，复杂条件仍需核对。</p></section>
      {extractAlerts(selected).length > 0 && <section className="attention"><h3>重点核对 <span>以下摘自原表备注</span></h3>{extractAlerts(selected).map(a => <details key={a.key}><summary>{a.label}<span>{a.evidence.length} 处原文</span></summary>{a.evidence.map((e,i) => <p key={i}>{e}</p>)}</details>)}</section>}
      {noteField(selected)}<h3 className="original-heading">完整招考要求</h3><dl>{data?.headers.map((h,i) => <div key={h} className={[7,12,17,22].includes(i) ? 'wide' : ''}><dt>{h}</dt><dd>{display(selected.values[i])}</dd></div>)}</dl><p className="provenance">来源：{data?.file} / {selected.sheet} / 第 {selected.row} 行</p></div><div className="detail-footer"><button aria-pressed={compared.includes(selected.id)} onClick={() => toggleCompare(selected)}>{compared.includes(selected.id) ? '✓ 已加入对比' : '＋ 加入对比'}</button><button className="primary" onClick={() => favorite(selected)}>{saved.includes(selected.id) ? '★ 已收藏 · 点击取消' : '☆ 收藏这个职位'}</button></div></Modal>}
    {compareOpen && <Modal title="职位对比" className="compare-modal" onClose={() => setCompareOpen(false)}><div className="detail-header"><div><span className="eyebrow">把关键差异放在一起</span><h2>职位对比 <small>{comparison.length} 个职位</small></h2></div><button className="close" aria-label="关闭对比" onClick={() => setCompareOpen(false)}>×</button></div><div className="compare-toolbar"><label className="check-field"><input type="checkbox" checked={differences} onChange={e => setDifferences(e.target.checked)}/>只看不同项</label><button className="export" onClick={() => exportRows(comparison, '对比')}>↓ 导出对比职位</button></div><p className="compare-hint">不同要求以浅绿色标出；横向滑动查看所有职位。</p><div className="comparison-scroll" tabIndex={0} role="region" aria-label="职位对比表，可横向滚动"><table><thead><tr><th scope="col">对比项目</th>{comparison.map((p,i) => <th scope="col" key={p.id}><span>职位 {i+1}</span><strong>{p.values[4]}</strong><small>{p.values[0]} / {p.values[8]}</small></th>)}</tr></thead><tbody>{compareFields.filter(i => !differences || new Set(comparison.map(p => p.values[i])).size > 1).map(i => <tr key={i} className={new Set(comparison.map(p => p.values[i])).size > 1 ? 'different' : ''}><th scope="row">{data?.headers[i]}</th>{comparison.map(p => <td key={p.id}>{display(p.values[i])}</td>)}</tr>)}{(!differences || new Set(comparison.map(p => notes[p.id] || '')).size > 1) && <tr><th scope="row">我的备注</th>{comparison.map(p => <td key={p.id}>{notes[p.id] || '暂无备注'}</td>)}</tr>}</tbody></table></div><div className="detail-footer"><span>专业、备注及服务条件请一起比较。</span><button className="primary" onClick={() => setCompareOpen(false)}>继续选岗</button></div></Modal>}
    {sourceOpen && <Modal title="数据与使用说明" onClose={() => setSourceOpen(false)}><div className="detail-header"><h2>数据与使用说明</h2><button className="close" aria-label="关闭数据说明" onClick={() => setSourceOpen(false)}>×</button></div><div className="detail-content source-content"><h3>2027 年国考职位表</h3><p>来源为本地 {data?.file || 'data.xls'}。保留全部 27 个原始字段，详情展示对应工作表及行号。</p>{data?.sources.map(s => <p key={s.name}>{s.name}：{number(s.count)} 个职位</p>)}<p>数据导入时间：{data?.importedAt ? new Date(data.importedAt).toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai', hour12: false }) : '未记录'}（北京时间，不代表官方发布时间）</p><p>文件版本：<code>{data?.sourceHash?.slice(0,16) || '未记录'}</code></p><h3>怎样使用初筛结果</h3><p>个人条件模式仅排除已填写项中明确不匹配的要求。未填写、未明确识别的条件保留待核对。已接入本科、研究生、职业教育及税务系统专业目录。按所选条目的名称、代码及目录上下级关系匹配；历史专业、同名代码和附加限制显示待核对。也可切换原文关键词搜索。</p><p>“面试阶段无专业测试”只对应原表该字段，不代表没有专业科目笔试。应届认定、学历经历、专业范围等请核对招录公告及招录机关解释。</p><h3>专业目录来源</h3>{majorSources.map(s => <p key={s.id}><a href={s.url} target="_blank" rel="noreferrer">{s.title} ↗</a></p>)}<h3>收藏与导出</h3><p>收藏、备注和筛选条件仅保存在当前浏览器。CSV 导出包含完整原文与备注；Excel 导入时将代码列设为文本，可保留前导零。</p><h3>当前数据范围</h3><p>这是职位表的静态版本，不含实时报名人数、竞争比、历年进面分数或报名进度。</p></div></Modal>}
  </>;
}

createRoot(document.getElementById('root')!).render(<React.StrictMode><App/></React.StrictMode>);
