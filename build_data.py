"""Genera public/data a partir de los bancos originales. Consulta --help para configurar rutas."""
import argparse
import collections
import json
import os
import re
from pathlib import Path

ROOT = Path(__file__).resolve().parent


def arguments():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--bank-dir', type=Path, default=Path(os.environ.get('BANK_DIR', ROOT.parent / 'BANCO_PREGUNTAS')),
                        help='Banco con banco_literal.json, banco_academia.json y generadas/ (env BANK_DIR).')
    parser.add_argument('--supuestos-dir', type=Path, default=os.environ.get('SUPUESTOS_DIR'),
                        help='Carpeta con supuestos.json y supuestos_academia.json (env SUPUESTOS_DIR; por defecto bank-dir).')
    parser.add_argument('--temario-dir', type=Path, default=os.environ.get('TEMARIO_DIR'),
                        help='Textos del temario (env TEMARIO_DIR; por defecto bank-dir/temario_txt).')
    parser.add_argument('--out-dir', type=Path, default=Path(os.environ.get('OUT_DIR', ROOT / 'public' / 'data')),
                        help='Salida (env OUT_DIR; por defecto public/data junto al script).')
    args = parser.parse_args()
    args.supuestos_dir = args.supuestos_dir or args.bank_dir
    args.temario_dir = args.temario_dir or args.bank_dir / 'temario_txt'
    return parser, args


def load_json(file):
    with file.open(encoding='utf-8') as handle:
        return json.load(handle)


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


def generate(args):
    # Leer y transformar todas las entradas antes de abrir archivos de salida.
    literal = load_json(args.bank_dir / 'banco_literal.json')['preguntas']
    academia = load_json(args.bank_dir / 'banco_academia.json')['preguntas']
    supuestos = load_json(args.supuestos_dir / 'supuestos.json')
    supuestos_academia = load_json(args.supuestos_dir / 'supuestos_academia.json')
    if not (args.bank_dir / 'generadas').is_dir():
        raise ValueError(f"Falta la carpeta de preguntas generadas: {args.bank_dir / 'generadas'}")
    nombres = {}
    for file in sorted(args.temario_dir.iterdir()):
        match = re.match(r'(T\d\.\d\d) (.+?) - ', file.name)
        if match:
            nombres.setdefault(match.group(1), match.group(2))
    nombres.update({'T1.01': 'Constitución Española', 'T2.05': 'SGBD',
                    'T3.06': 'Java y .NET', 'T3.08': 'Aplicaciones Web'})
    generadas = []
    for file in sorted((args.bank_dir / 'generadas').glob('banco_generado_T*.json')):
        generadas.extend(load_json(file)['preguntas'])
    temas, sup_q, aliases = collections.defaultdict(list), collections.defaultdict(list), {}
    for questions, origen in [(literal, 'O'), (academia, 'A'), (generadas, 'G')]:
        for question in questions:
            data = conv(question, origen)
            if origen != 'G' and question.get('supuesto_id'):
                sup_q[question['supuesto_id']].append(data)
            else:
                temas[data['t']].append(data)
            for alias_id in question.get('ids_duplicados', []):
                if alias_id == question['id'] or alias_id in aliases:
                    raise ValueError(f"ID alias inválido o repetido: {alias_id}")
                aliases[alias_id] = question
    output, idx, meta = {}, {'temas': []}, {}
    for tema in sorted(temas):
        questions = temas[tema]
        output[f'{tema}.json'] = questions
        count = collections.Counter(q['o'] for q in questions)
        idx['temas'].append({'w': sum(q['o'] == 'O' and not q.get('r') for q in questions),
                             'id': tema, 'nombre': nombres.get(tema, tema), 'n': len(questions),
                             'O': count['O'], 'A': count['A'], 'G': count['G']})
        for q in questions:
            meta[q['i']] = [tema, q['o'], q['k'] or '', q['x'], q['d'] or 0]
    for alias_id, question in aliases.items():
        canonical_id = question['id']
        if alias_id in meta:
            raise ValueError(f"ID alias ya utilizado por otra pregunta: {alias_id}")
        if canonical_id not in meta:
            raise ValueError(f"El destino del alias no está en el banco: {canonical_id}")
        meta[alias_id] = [*meta[canonical_id], canonical_id]
    sup = {}
    for key, value in list(supuestos.items()) + list(supuestos_academia.items()):
        sup[key] = {'conv': value.get('convocatoria'), 'texto': value['texto'], 'q': sup_q.get(key, [])}
    idx['n'] = sum(len(q) for q in temas.values())
    idx['nsup'] = sum(len(v['q']) for v in sup.values())
    output.update({'supuestos.json': sup, 'meta.json': meta, 'index.json': idx})
    return output


def main():
    parser, args = arguments()
    try:
        output = generate(args)
        # Serializar también antes de escribir: una entrada inválida no debe truncar el banco existente.
        encoded = {name: json.dumps(data, ensure_ascii=False, separators=(',', ':')) for name, data in output.items()}
        args.out_dir.mkdir(parents=True, exist_ok=True)
        for name, text in encoded.items():
            (args.out_dir / name).write_text(text, encoding='utf-8')
    except (OSError, ValueError, KeyError, TypeError, IndexError) as error:
        parser.error(f'No se pudo generar el banco: {error}')
    idx = output['index.json']
    print(f"{idx['n']} preguntas, {idx['nsup']} de supuestos, {len(output['supuestos.json'])} supuestos")
    print(f"Salida: {args.out_dir.resolve()}")


if __name__ == '__main__':
    main()
