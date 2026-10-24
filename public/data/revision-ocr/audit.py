#!/usr/bin/env python3
"""Detector conservador OCR; no modifica datos. Python 3, sin dependencias.
Uso: python3 public/data/revision-ocr/audit.py [--output DIRECTORIO]
La muestra usa semilla fija 20183321 y excluye candidatos.
"""
import argparse, collections, difflib, json, pathlib, random, re
ROOT = pathlib.Path(__file__).resolve().parents[3]
P = argparse.ArgumentParser(); P.add_argument('--root', help='Raíz alternativa (p. ej., copia anterior a la revisión)'); P.add_argument('--output', default='/tmp/pwa-tai-audit'); args=P.parse_args()
ROOT=pathlib.Path(args.root).resolve() if args.root else ROOT
out=pathlib.Path(args.output);out.mkdir(parents=True,exist_ok=True)
records=[]
for folder in ['data','cards']:
 for path in sorted((ROOT/'public'/folder).glob('T*.json')):
  for j,q in enumerate(json.loads(path.read_text(encoding='utf-8'))):
   records.append({'file':str(path.relative_to(ROOT)), 'pos':j, 'id':q.get('i',q.get('id')), 'kind':folder, 'record':q})
for sid,s in json.loads((ROOT/'public/data/supuestos.json').read_text(encoding='utf-8')).items():
 records.append({'file':'public/data/supuestos.json','id':sid,'kind':'contexto','record':{'q':s.get('texto','')}})
 for j,q in enumerate(s.get('q',[])):
  records.append({'file':'public/data/supuestos.json','pos':j,'group':sid,'id':q['i'],'kind':'supuesto','record':q})
def strings(q):
 for key in ['q','a','n','u','ref']:
  v=q.get(key,[])
  for s in ([v] if isinstance(v,str) else v if isinstance(v,list) else []):
   if isinstance(s,str): yield key,s
freq=collections.Counter(w.lower() for r in records for k,s in strings(r['record']) for w in re.findall(r'\b[^\W\d_]+\b',s))
# Diccionario interno reproducible: palabras recurrentes del banco + términos técnicos.
lexicon={w for w,n in freq.items() if n>=3}|set('tar grep chmod chown ls awk sed nvme twain ips va tn xor xnor nand nor javascript postgresql dniedroid'.split())
known=re.compile(r'Enrrelación|aXxORb|aXxXNORb|AaNORb|aNANDb|axXORb|aXxNORb|tartví|tarxvffichero|tar cví|taraví|fichero,\s*tar|EnPostgreSQL|accesoLa|sentenciaSELECT|SeCorresponde|JavScript|OLastiName|OFirsiName|DNle|SImpleDB')
extra=re.compile(r'\b(?:Enrrelación|Enrelación|Enel|Enun|Enuna|Enlos|Enla|Enlaweb|Ensuorganismo|Conrespecto|Deentre|Delas|Latecnología|Laespecificación|Lautilidad|Esun|Esnula|Esorientado|Esel|Eseldirectorio|Elconjunto|Elobjeto|Elproceso|Elderecho|Lostres|Noes|Através|Siademás|Seestá|Eldepartamento|Deacuerdo|Elevento|siembre|Rrepara|sanSAN|VWVHERE|CAJES|NVist|Isb_release|netuser|gittag|ren\*|Copy-ltem|Get-ltem|Mobilelron|hret|htips|maxlengih|Javacript|Codad|REC 8446|contro!|tormativas|Cif)\b|[¡|]P\b|¡Query|[¡|]ip|\b(?:ls|mount|grep|tar|ssh)\s+[–—−]|\b(?:arp|lsof|Isof|netstat)-[a-z]|\b(?:1S|\|S) null|\bCH en \.Net|MySq!|flength=|\bSlongitud|\bflongitud|^\s*(?:%\. |¿ c |\d+ [A-Z] |Stream\)\.|Gobierno\. Conforme|Exchange alojado|Curso \(idAccion|GROUP BY Ciudadano|INT NOT NULL\)|TERMINATED BY)')
command=re.compile(r'\b(?:tar[txcavír]+|ls[la]{1,3}|chmod[0-7]{3,4}|grep[invr]+)\b',re.I)
candidates=[]
for r in records:
 q=r['record'];reasons=[]
 if str(r['id']).startswith(('L2018','P2018')):reasons.append('cohorte de exámenes escaneados 2018: cotejo visual integral')
 if r['kind']=='cards' and 'Agencia de Ciberseguridad de la UE' in q.get('q','') and q.get('a')!='ENISA':reasons.append('respuesta de tarjeta no corresponde a la entidad preguntada')
 for k,s in strings(q):
  if k=='n' and re.search(r'ocr|deforma',s,re.I):reasons.append('nota OCR/deformación')
  if '\ufffd' in s or re.search(r'[\x00-\x08\x0b\x0c\x0e-\x1f\u00a0\u200b\ufeff]',s):reasons.append(k+': carácter invisible/control/sustitución')
  if extra.search(s):reasons.append(k+': patrón ampliado de corrupción/espaciado')
  if k=='n' and re.search(r'DUDOSA',s):reasons.append('nota de duda preexistente')
  if known.search(s):reasons.append(k+': secuencia sospechosa conocida')
  if command.search(s):reasons.append(k+': comando pegado/opción sospechosa')
  if re.search(r'\b(?:tar|ls|grep|chmod)\s+[–—−]',s):reasons.append(k+': guion tipográfico en comando')
  if s.count('(')!=s.count(')') or s.count('[')!=s.count(']'):reasons.append(k+': delimitadores desequilibrados')
  if s.count('"')%2:reasons.append(k+': comillas dobles impares')
  for w in re.findall(r'\b[^\W\d_]+\b',s):
   if w.lower() not in lexicon and re.search(r'[a-záéíóúñ][A-Z][a-záéíóúñ]|[a-záéíóúñ]{2}[A-Z]{2}',w):
    reasons.append(k+': palabra rara con caja mixta: '+w)
  if re.search(r'\b(?:MMVe|TWING|HHP|MMD|VN|TA)\b',s):reasons.append(k+': sigla a cotejar (posible distractor)')
 a=q.get('a'); c=q.get('c')
 if isinstance(a,list):
  if type(c) is not int or not 0<=c<len(a):reasons.append('índice correcto fuera de rango')
  for j,x in enumerate(a):
   if not isinstance(x,str):
    reasons.append('opción no textual');continue
   if not x.strip():reasons.append('opción vacía')
   for y in a[j+1:]:
    if not isinstance(y,str):continue
    nx=re.sub(r'\W','',x).casefold();ny=re.sub(r'\W','',y).casefold()
    if nx==ny:reasons.append('opciones duplicadas normalizadas')
    elif len(nx)>18 and len(ny)>18 and difflib.SequenceMatcher(None,nx,ny,autojunk=False).ratio()>=.965:reasons.append('opciones casi iguales (>=0.965)')
 if reasons:candidates.append(dict(r,reasons=sorted(set(reasons))))
candidate_keys={(x['file'],x.get('pos')) for x in candidates}
non=[r for r in records if r['kind']=='data' and (r['file'],r['pos']) not in candidate_keys]
sample=random.Random(20183321).sample(non,min(300,len(non)))
for name,data in [('candidatos',candidates),('muestra-300',sample)]:
 (out/(name+'.json')).write_text(json.dumps(data,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
 with (out/(name+'.txt')).open('w',encoding='utf-8') as f:
  for r in data:
   q=r['record'];f.write(r['file']+' '+str(r['id'])+' '+str(r.get('reasons',[]))+'\n'+json.dumps(q,ensure_ascii=False)+'\n')
summary={'counts':dict(collections.Counter(r['kind'] for r in records)), 'candidates':len(candidates),'sample':len(sample),'seed':20183321,'reasons':dict(collections.Counter(s for r in candidates for s in r['reasons']))}
(out/'resumen.json').write_text(json.dumps(summary,ensure_ascii=False,indent=2)+'\n',encoding='utf-8');print(json.dumps(summary,ensure_ascii=False,indent=2))
