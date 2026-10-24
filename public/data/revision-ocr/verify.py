#!/usr/bin/env python3
"""Comprueba la revisión contra una copia previa: --baseline /ruta/copia.
No modifica datos. Puede usarse con la copia extraída del tar de seguridad.
"""
import argparse, collections, hashlib, json, pathlib
p=argparse.ArgumentParser();p.add_argument('--baseline',required=True);p.add_argument('--allow-documented-answer-changes',action='store_true');p.add_argument('--allow-documented-editorial-changes',action='store_true');args=p.parse_args()
root=pathlib.Path(__file__).resolve().parents[3];base=pathlib.Path(args.baseline)
modified=[];counts=collections.Counter();files=0;changed_c=[]
allowed={'AS12B-S1-02':(1,0)} if args.allow_documented_answer_changes else {}
evidence={x['id']:x for x in json.loads((pathlib.Path(__file__).parent/'dudosas-revision.json').read_text())} if allowed else {}
editorial={x['id']:x for x in json.loads((pathlib.Path(__file__).parent/'editorial-13.json').read_text())} if args.allow_documented_editorial_changes else {}
if args.allow_documented_answer_changes and editorial:
 allowed.update({'AS12B-S2-12':(1,2),'AT309-P1-12':(3,2)})
 evidence.update(editorial)
duplicates={'AS05G-P1-60','AS08B-P1-R-01','AS11B-P1-70'} if editorial else set()
exclusions={x['id']:x for x in json.loads((pathlib.Path(__file__).parent/'exclusion-puntuable.json').read_text())} if editorial else {}
for ident, x in exclusions.items():editorial[ident]['after']=x['after']
for folder in ['data','cards']:
 for old in sorted((base/'public'/folder).glob('*.json')):
  rel=old.relative_to(base);new=root/rel
  a=json.loads(old.read_text());b=json.loads(new.read_text());files+=1
  if old.name in ['index.json','meta.json']:
   assert old.read_bytes()==new.read_bytes(),str(rel)+' índice modificado'
  def questions(d):
   if isinstance(d,list):return d
   if old.name=='supuestos.json':
    assert list(d)==list(a),str(rel)+' orden de supuestos modificado'
    return [q for s in d.values() for q in s['q']]
   return []
  aa=questions(a);bb=questions(b)
  if aa:
   assert len(aa)==len(bb),str(rel)+' recuento'
   assert [q.get('i',q.get('id')) for q in aa]==[q.get('i',q.get('id')) for q in bb],str(rel)+' ids/orden'
  counts[folder]+=len(aa)
  for x,y in zip(aa,bb):
   if x.get('c')!=y.get('c'):
    ident=x.get('i');assert allowed.get(ident)==(x.get('c'),y.get('c')),str(rel)+' clave sin autorización documental'
    assert evidence[ident]['after']==y and evidence[ident]['sources'] and evidence[ident]['technical_sources']
    changed_c.append({'id':ident,'before':x.get('c'),'after':y.get('c')})
   if x==y:continue
   assert len(x.get('a',[]))==len(y.get('a',[])) if isinstance(x.get('a'),list) else True
   assert set(y)-set(x)<= ({'n','np'} if x.get('i') in exclusions else {'n'}),str(rel)+' campos añadidos inesperados'
   assert all(x[k]==y.get(k) for k in x if k not in ['q','a','n','u','ref']+(['c'] if x.get('i') in allowed else [])+(['k'] if x.get('i') in editorial else [])+(['np'] if x.get('i') in exclusions else [])),str(rel)+' metadatos cambiados'
   if x.get('i') in editorial:
    assert editorial[x['i']]['after']==y,str(rel)+' discrepancia con registro editorial'
   if isinstance(y.get('a'),list):
    assert isinstance(y['c'],int) and 0<=y['c']<len(y['a'])
    assert all(s.strip() for s in y['a'])
    if x.get('i') in duplicates:
     assert x['a']==y['a'] and x['c']==y['c'] and 'ADVERTENCIA' in y.get('n',''),str(rel)+' duplicado alterado sin respaldo'
    else:assert len(y['a'])==len(set(s.strip() for s in y['a'])),str(rel)+' duplicados'
   modified.append({'file':str(rel),'id':y.get('i',y.get('id'))})
  if old.name=='supuestos.json':
   for sid in a:
    assert set(a[sid])==set(b[sid]),sid+' campos de contexto'
    assert all(a[sid][k]==b[sid][k] for k in a[sid] if k not in ['q','texto']),sid+' metadatos de contexto'
  if a!=b:
   # Se admite el salto final, pero no espacios de serialización.
   assert new.read_text().rstrip('\n')==json.dumps(b,ensure_ascii=False,separators=(',',':')),str(rel)+' formato no compacto'
print(json.dumps({'ok':True,'json_files':files,'records':dict(counts),'modified_question_or_card_records':len(modified),'changed_c':len(changed_c),'answer_changes':changed_c,'documented_duplicate_exceptions':sorted(duplicates),'modified':modified},ensure_ascii=False,indent=2))
