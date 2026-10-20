"""Rebuild the local catalogue from archived official sources. No inferred categories."""
import json,re,hashlib,zipfile
from pathlib import Path
from html.parser import HTMLParser
import xml.etree.ElementTree as ET
root=Path(__file__).resolve().parents[1]; folder=root/'data/catalog/sources'
sources=[]; entries=[]
def source(id,file,title,url):
 sources.append(dict(id=id,title=title,url=url,sha256=hashlib.sha256((folder/file).read_bytes()).hexdigest()))
def add(id,level,code,name,parents,note='',historical=False):
 entries.append(dict(id=f'{id}:{code}',sourceId=id,level=level,code=code,name=name,parents=parents,note=note,historical=historical))
def parse(lines,id,level,legacy=False):
 nodes={}
 for line in lines:
  m=re.match(r'^\s*(\d{2}|\d{4}|\d{6}[TK]*)\s+(.+?)\s*$',line)
  if not m: continue
  code,text=m.groups(); text=re.sub(r'^学科门类[：:]\s*','',text).strip()
  name=re.split(r'[（(＊*]',text)[0].strip()
  if not name: continue
  parents=[dict(code=p,name=nodes[p]) for p in [code[:4],code[:2]] if p!=code and p in nodes]
  nodes[code]=name
  if len(code)>=6 or (level=='研究生' and len(code)==4 and not legacy): add(id,level,code,name,parents,text[len(name):],legacy)
source('ug','undergraduate-2026.pdf','教育部本科专业目录（2026）','https://www.moe.gov.cn/srcsite/A08/moe_1034/s3882/202604/W020260427440749576927.pdf')
parse((folder/'undergraduate-2026.txt').read_text().splitlines(),'ug','本科')
source('pg','graduate-2022.pdf','研究生教育学科专业目录（2022）','https://www.moe.gov.cn/srcsite/A22/s7065/202209/t20220914_660828.html')
parse((folder/'graduate-2022.txt').read_text().splitlines(),'pg','研究生')
class HTML(HTMLParser):
 def __init__(self,text):
  super().__init__(); self.text=[]; self.rows=[]; self.row=[]; self.cell=None; self.feed(text)
 def handle_starttag(self,tag,attrs):
  if tag=='tr': self.row=[]
  if tag in ('td','th'): self.cell=[]
 def handle_data(self,data):
  self.text.append(data)
  if self.cell is not None: self.cell.append(data)
 def handle_endtag(self,tag):
  if tag in ('td','th') and self.cell is not None: self.row.append(''.join(''.join(self.cell).split())); self.cell=None
  if tag=='tr' and self.row: self.rows.append(self.row)
source('legacy','graduate-1997.html','研究生历史专业目录（1997，需核对现行口径）','https://www.moe.gov.cn/srcsite/A22/moe_833/moe_834/200512/t20051223_88437.html')
parse(HTML((folder/'graduate-1997.html').read_text()).text,'legacy','研究生',True)
source('fields','graduate-adjustments-2025.html','专业学位领域对应关系（2025）','https://www.moe.gov.cn/srcsite/A22/s7065/202209/t20220914_660828.html')
sources[-1]['url']='https://www.moe.gov.cn/srcsite/A22/s7065/202506/t20250611_1193766.html'
for row in HTML((folder/'graduate-adjustments-2025.html').read_text()).rows:
 if len(row)==4 and re.fullmatch(r'08[56]\d{3}',row[0]):
  parent=next((e for e in entries if e['sourceId']=='pg' and e['code']==row[0][:4]),None)
  if parent: add('fields','研究生',row[0],re.split('[（(]',row[1])[0],[dict(code=parent['code'],name=parent['name']),*parent['parents']],row[1])
source('voc','vocational-2026.docx','职业教育专业目录（2026年7月更新）','https://www.moe.gov.cn/s78/A07/zcs_ztzl/2017_zt06/17zt06_bznr/zhijiao/202607/P020260714589584937536.docx')
ns={'w':'http://schemas.openxmlformats.org/wordprocessingml/2006/main'}
with zipfile.ZipFile(folder/'vocational-2026.docx') as z: doc=ET.fromstring(z.read('word/document.xml'))
for table,level in zip(doc.findall('.//w:tbl',ns)[1:],['大专','职业本科']):
 nodes={}
 for tr in table.findall('w:tr',ns):
  cells=[''.join(t.text or '' for t in c.findall('.//w:t',ns)).strip() for c in tr.findall('w:tc',ns)]
  if len(cells)==1:
   m=re.match(r'(\d{2,4})(.+)',cells[0])
   if m: nodes[m[1]]=m[2]
  elif len(cells)>=3 and re.fullmatch(r'\d{6}',cells[1]):
   code=cells[1]; add('voc',level,code,cells[2],[dict(code=p,name=nodes[p]) for p in [code[:4],code[:2]] if p in nodes])
source('tax','tax-2027.html','税务系统2027年度专业参考目录','https://shanghai.chinatax.gov.cn/xxgk/rsxx/202610/t481766.html')
def split(text):
 result=[]; depth=0; start=0
 for i,c in enumerate(text):
  if c in '（([': depth+=1
  if c in '）)]': depth=max(0,depth-1)
  if c=='，' and not depth: result.append(text[start:i]); start=i+1
 return [*result,text[start:]]
groups=[dict(name=r[1],members=split(r[2])) for r in HTML((folder/'tax-2027.html').read_text()).rows if len(r)==3 and r[0].isdigit()]
assert len(groups)==53
assert any(e['code']=='080902' for e in entries)
assert any(e['code']=='085405' for e in entries)
assert len({e['id'] for e in entries})==len(entries)
(root/'src/catalog-data.json').write_text(json.dumps(dict(sources=sources,entries=entries,taxGroups=groups),ensure_ascii=False,separators=(',',':'))+'\n')
from collections import Counter
print(Counter(e['sourceId'] for e in entries), 'tax groups',len(groups))
