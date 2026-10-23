import sys, json
# uso: fix.py T id campo valor
t,i,f,v=sys.argv[1:5]
p=f'public/cards/{t}.json'; d=json.load(open(p))
for c in d:
    if c['id']==f'FC-{t}-{int(i):03d}': c[f]=v
json.dump(d,open(p,'w'),ensure_ascii=False,indent=1)
