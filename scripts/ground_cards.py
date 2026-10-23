#!/usr/bin/env python3
"""Comprueba que las respuestas de las tarjetas curadas figuran en el temario del tema.
Uso: python3 scripts/ground_cards.py [T1.01 ...]   (sin argumentos: todos los temas con tarjetas)
Marca "revisar": true en las tarjetas cuya respuesta no se encuentra bien en el texto (la app no las muestra hasta confirmarlas).
Con --report solo informa, sin modificar ficheros."""
import json, glob, os, re, sys, unicodedata
TEM = os.environ.get('TEMARIO_DIR', '/mnt/user-data/uploads/TEMARIO_OPOSICION/BANCO_PREGUNTAS/temario_txt')
CARDS = os.path.join(os.path.dirname(__file__), '..', 'public', 'cards')
STOP = set('de la el los las un una unos unas y o u en a al del por con para que se su sus es son ser como mas menos entre sobre sin lo le les no ni si frente este esta estos estas ese esa cada todo todos toda todas otro otra ante bajo desde hasta segun tras'.split())
def norm(s):
    s = unicodedata.normalize('NFD', s.lower()); s = ''.join(c for c in s if unicodedata.category(c) != 'Mn')
    return re.sub(r'[^a-z0-9]+', ' ', s).strip()
def texto_tema(t):
    out = []
    for f in sorted(glob.glob(os.path.join(TEM, t + ' *'))):
        out.append(open(f, encoding='utf-8', errors='ignore').read())
    # también el banco de preguntas del tema: respuestas correctas, notas y citas (ya verificadas)
    bf = os.path.join(os.path.dirname(__file__), '..', 'public', 'data', t + '.json')
    if os.path.exists(bf):
        for q in json.load(open(bf)):
            out.append(q['a'][q['c']]); out.append(q.get('n') or ''); out.append(q.get('u') or ''); out.append(q['q'])
    return norm(' '.join(out))
def check(card, txt):
    a = norm(card['a']); words = [w for w in a.split() if w not in STOP and (len(w) >= 4 or w.isdigit())]
    if not words: return 1.0, []
    miss = [w for w in words if (' ' + w) not in txt and (w + ' ') not in txt and w not in txt]
    nums = [w for w in words if w.isdigit() and w in miss]
    return 1 - len(miss) / len(words), miss
def main():
    args = [a for a in sys.argv[1:] if not a.startswith('--')]; report = '--report' in sys.argv
    files = [os.path.join(CARDS, t + '.json') for t in args] if args else sorted(glob.glob(os.path.join(CARDS, 'T*.json')))
    for f in files:
        t = os.path.basename(f)[:-5]; cards = json.load(open(f)); txt = texto_tema(t)
        if not txt: print(t, 'SIN TEMARIO'); continue
        bad = 0
        for c in cards:
            ratio, miss = check(c, txt)
            if ratio < 0.7:
                bad += 1; print(f'  {c["id"]} {ratio:.0%} faltan {miss[:6]} | a: {c["a"][:80]}')
                if not report: c['revisar'] = True
            elif 'revisar' in c and not report and c.get('_g'):
                c.pop('revisar', None)
        if not report: json.dump(cards, open(f, 'w'), ensure_ascii=False, indent=1)
        print(t, f'{len(cards)} tarjetas, {bad} a revisar')
if __name__ == '__main__': main()
