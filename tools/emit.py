import json, os, sys
OUT = os.path.join(os.path.dirname(__file__), '..', 'public', 'cards')
def emit(t, rows):
    """rows: (tipo, q, a, ref[, caduca])"""
    cards = []
    for k, r in enumerate(rows, 1):
        c = {"id": f"FC-{t}-{k:03d}", "t": t, "tipo": r[0], "q": r[1], "a": r[2], "ref": r[3], "src": "curada"}
        if len(r) > 4 and r[4]: c["caduca"] = True
        cards.append(c)
    os.makedirs(OUT, exist_ok=True)
    json.dump(cards, open(os.path.join(OUT, f"{t}.json"), 'w'), ensure_ascii=False, indent=1)
    idx = os.path.join(OUT, 'index.json')
    d = json.load(open(idx)) if os.path.exists(idx) else {"temas": {}}
    d["temas"][t] = len(cards); d["temas"] = dict(sorted(d["temas"].items()))
    json.dump(d, open(idx, 'w'), ensure_ascii=False)
    print(t, len(cards), 'tarjetas;', sum(1 for c in cards if c['tipo'] in ('contraste', 'intrusa')), 'contraste/intrusa')
