import sys, json; sys.path.insert(0,'tools')
from emit import emit
t=sys.argv[1]; drop=sys.argv[2:]
d=json.load(open(f'public/cards/{t}.json'))
rows=[(c['tipo'],c['q'],c['a'],c['ref'],c.get('caduca')) for c in d if not any(x in c['q'] for x in drop)]
emit(t,rows)
