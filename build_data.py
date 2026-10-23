import json,re,collections,os
B='/mnt/user-data/outputs/BANCO_PREGUNTAS/'
U='/mnt/user-data/uploads/outputs/BANCO_PREGUNTAS/'
OUT='public/data/'
NOMBRES={}
for f in os.listdir('/mnt/user-data/uploads/TEMARIO_OPOSICION/BANCO_PREGUNTAS/temario_txt'):
    m=re.match(r'(T\d\.\d\d) (.+?) - ',f)
    if m and m.group(1) not in NOMBRES: NOMBRES[m.group(1)]=m.group(2)
NOMBRES['T2.05']='SGBD'; NOMBRES['T3.06']='Java y .NET'; NOMBRES['T3.08']='Aplicaciones Web'
NOMBRES['T1.01']='Constitución Española'
L=json.load(open(B+'banco_literal.json'))['preguntas']
A=json.load(open(B+'banco_academia.json'))['preguntas']
G=[]
import glob
for f in sorted(glob.glob(B+'generadas/banco_generado_T*.json')):
    G+=json.load(open(f))['preguntas']
temas=collections.defaultdict(list); sup_q=collections.defaultdict(list)
def cita(q):
    cs=[c['texto'] for c in q.get('cita_temario',[])]
    s=' … '.join(cs[:2]); return s[:420]
def conv(q,o):
    l='abcd'
    d={'i':q['id'],'t':q.get('tema') or 'T?','o':o,'q':q['enunciado'],'a':[q['opciones'][x] for x in l],'c':l.index(q['correcta']),
       'k':q.get('tipo'),'x':q.get('trampas') or [],'d':q.get('dificultad')}
    if o=='G':
        d['f']=q.get('familia'); d['u']=cita(q); d['v']=0 if q['revision']['estado']=='verificada' else 1
    else:
        if q.get('nota'): d['n']=str(q['nota'])[:300]
        if o=='O':
            d['y']=q['convocatoria']; 
            if q.get('plantilla')!='definitiva': d['p']=1
            if q.get('reserva'): d['r']=1
        if o=='A' and q.get('tema_dudoso'): d['z']=1
    if q.get('caducable'): d['w']=1
    if q.get('supuesto_id'): d['s']=q['supuesto_id']
    if q.get('contexto_previo'): d['cp']=q['contexto_previo']
    return d
for q in L: 
    d=conv(q,'O'); (sup_q[q['supuesto_id']] if q.get('supuesto_id') else temas[d['t']]).append(d)
for q in A:
    d=conv(q,'A'); (sup_q[q['supuesto_id']] if q.get('supuesto_id') else temas[d['t']]).append(d)
for q in G:
    d=conv(q,'G'); temas[d['t']].append(d)
peso=collections.Counter()
for t,l in temas.items():
    peso[t]=sum(1 for x in l if x['o']=='O' and not x.get('r'))
idx={'temas':[]}
for t in sorted(temas):
    json.dump(temas[t],open(f'{OUT}{t}.json','w'),ensure_ascii=False,separators=(',',':'))
    c=collections.Counter(x['o'] for x in temas[t])
    idx['temas'].append({'w':peso[t],'id':t,'nombre':NOMBRES.get(t,t),'n':len(temas[t]),'O':c['O'],'A':c['A'],'G':c['G']})
S=json.load(open(U+'supuestos.json')); SA=json.load(open(U+'supuestos_academia.json'))
sup={}
for k,v in list(S.items())+list(SA.items()):
    sup[k]={'conv':v.get('convocatoria'),'texto':v['texto'],'q':sup_q.get(k,[])}
json.dump(sup,open(OUT+'supuestos.json','w'),ensure_ascii=False,separators=(',',':'))
# meta compacta para estadísticas y selección rápida
meta={}
for t in temas:
    for x in temas[t]: meta[x['i']]=[t,x['o'],x['k'] or '',x['x'],x['d'] or 0]
json.dump(meta,open(OUT+'meta.json','w'),separators=(',',':'))
idx['n']=sum(len(v) for v in temas.values()); idx['nsup']=sum(len(v['q']) for v in sup.values())
json.dump(idx,open(OUT+'index.json','w'),ensure_ascii=False,separators=(',',':'))
print(idx['n'],idx['nsup'],len(sup)); print(os.popen('du -sh public/data').read()); print([ (t['id'],t['nombre'],t['n']) for t in idx['temas']][:40])
