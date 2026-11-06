"""Replay the audited question edits on a local candidate copy."""
import argparse
import fcntl
import hashlib
import json
import os
from pathlib import Path
from tempfile import TemporaryDirectory


HERE = Path(__file__).resolve().parent
PROJECT = HERE.parents[1]
BATCHES = {
    'web': ('T3.08.json', 'reviewed-web.json'),
    'T3.08': ('T3.08.json', 'reviewed-T3.08.json'),
    'T4.07': ('T4.07.json', 'reviewed-T4.07.json'),
}
REVIEWED_BATCHES = {
    'reviewed-19': 'reviewed-19.json',
    'reviewed-followup': 'reviewed-followup.json',
    'reviewed-wave2': 'reviewed-wave2.json',
    'reviewed-admin20': 'reviewed-admin20.json',
    'reviewed-legal19': 'reviewed-legal19.json',
    'reviewed-programming20': 'reviewed-programming20.json',
    'reviewed-web25': 'reviewed-web25.json',
    'reviewed-architecture20': 'reviewed-architecture20.json',
    'reviewed-languages17': 'reviewed-languages17.json',
    'reviewed-web23': 'reviewed-web23.json',
    'reviewed-development11': 'reviewed-development11.json',
    'reviewed-systems20': 'reviewed-systems20.json',
    'reviewed-foundations18': 'reviewed-foundations18.json',
    'reviewed-systems16': 'reviewed-systems16.json',
    'reviewed-syntax3': 'reviewed-syntax3.json',
    'reviewed-admin5': 'reviewed-admin5.json',
}


def encode(value):
    return json.dumps(value, ensure_ascii=False, separators=(',', ':')).encode('utf-8')


def sha256(row):
    return hashlib.sha256(encode(row)).hexdigest()


def storage_name(edit):
    """Ledger paths are provenance, never arbitrary candidate filesystem paths."""
    storage = edit.get('storageFile', 'public/data/' + edit['topic'] + '.json')
    allowed = ('public/data/' + edit['topic'] + '.json', 'public/data/supuestos.json')
    if storage not in allowed:
        raise ValueError(f"Almacenamiento inesperado: {edit['id']}.")
    return storage.removeprefix('public/data/')


def nested_index(scenarios):
    if not isinstance(scenarios, dict):
        raise ValueError('El catálogo de supuestos debe ser un objeto.')
    index = {}
    for scenario_id, scenario in scenarios.items():
        if not isinstance(scenario, dict) or not isinstance(scenario.get('texto'), str) or not isinstance(scenario.get('q'), list):
            raise ValueError(f'Supuesto mal formado: {scenario_id}.')
        for position, row in enumerate(scenario['q']):
            if not isinstance(row, dict) or not isinstance(row.get('i'), str) or row.get('s') != scenario_id:
                raise ValueError(f'Pregunta mal ubicada en supuesto: {scenario_id}.')
            if row['i'] in index:
                raise ValueError('El catálogo de supuestos contiene IDs duplicados.')
            index[row['i']] = (scenario_id, position)
    return index


def validate_context(edit, scenario_id, scenario):
    context = edit['context']
    if (edit.get('storageFile') != 'public/data/supuestos.json'
            or edit.get('scenarioId') != scenario_id
            or context.get('scenarioId') != scenario_id
            or context.get('storageFile') != edit['storageFile']
            or context.get('supTexto') != scenario['texto']):
        raise ValueError(f"Contexto o ubicación inesperados: {edit['id']}.")
    if hashlib.sha256(scenario['texto'].encode('utf-8')).hexdigest() != context.get('contextSha256'):
        raise ValueError(f"Huella de contexto inesperada: {edit['id']}.")
    for side in ('before', 'after'):
        row = edit[side]
        if (row.get('i') != edit['id'] or row.get('t') != edit['topic']
                or row.get('s') != scenario_id or 'supTexto' in row
                or sha256(row) != edit[side + 'Sha256']):
            raise ValueError(f"Registro raw inesperado: {edit['id']}.")
        # Transport envelope hashes preserve insertion order. They are NOT the app's
        # sorted canonical runtime proof of {...raw, supTexto}, even for empty text.
        envelope = {'scenarioId': scenario_id, 'supTexto': scenario['texto'], 'question': row}
        if sha256(envelope) != context.get(side + 'ContextualSha256'):
            raise ValueError(f"Huella contextual inesperada: {edit['id']}.")


def prepare(topic, edits, directory, reverse, fingerprints=None):
    target = directory / topic
    if target.is_symlink() or not target.is_file():
        raise ValueError(f'Falta una copia ordinaria del tema {topic}.')
    original = target.read_bytes()
    source, destination = ('after', 'before') if reverse else ('before', 'after')
    if fingerprints and hashlib.sha256(original).hexdigest() not in (
            fingerprints[source + 'Sha256'], fingerprints[destination + 'Sha256']):
        raise ValueError(f'Deriva externa en {topic}.')
    rows = json.loads(original)
    metadata = topic == 'meta.json' and isinstance(rows, dict)
    nested = topic == 'supuestos.json'
    by_id = nested_index(rows) if nested else {key: key for key in rows} if metadata else {row['i']: index for index, row in enumerate(rows)}
    if not nested and len(by_id) != len(rows):
        raise ValueError('El tema contiene IDs duplicados.')
    changed = 0
    for edit in edits:
        index = by_id.get(edit['id'])
        if index is None:
            raise ValueError(f"Falta la pregunta {edit['id']}.")
        container = rows
        if nested:
            scenario_id, index = index
            validate_context(edit, scenario_id, rows[scenario_id])
            container = rows[scenario_id]['q']
        row = container[index]
        current = sha256(row)
        if current == edit[destination + 'Sha256']:
            continue
        if current != edit[source + 'Sha256']:
            raise ValueError(f"Huella inesperada: {edit['id']}.")
        if fingerprints:
            # Reviewed ledgers contain complete rows, including missing/nullable fields.
            row = edit[destination]
            if metadata:
                if not isinstance(row, list) or len(row) < 5 or row[0] != edit['topic']:
                    raise ValueError(f"Metadatos inesperados: {edit['id']}.")
            elif row['i'] != edit['id'] or (not nested and row['t'] + '.json' != topic):
                raise ValueError(f"ID o tema inesperado: {edit['id']}.")
            container[index] = row
        else:
            for field, value in edit[destination].items():
                if value is None:
                    row.pop(field, None)
                else:
                    row[field] = value
        if sha256(row) != edit[destination + 'Sha256']:
            raise ValueError(f"El parche no reproduce la huella de {edit['id']}.")
        changed += 1
    result = encode(rows) + original[len(original.rstrip()):] if changed else original
    if fingerprints and hashlib.sha256(result).hexdigest() != fingerprints[destination + 'Sha256']:
        raise ValueError(f'La huella resultante de {topic} difiere del lote.')
    return target, result, changed


def replay(directory, reverse, batch, include_sample=False):
    directory = directory.resolve(strict=True)
    if directory.is_relative_to(PROJECT) or any((parent / '.git').exists()
                                                for parent in (directory, *directory.parents)):
        raise ValueError('El candidato debe estar fuera del repositorio.')
    lock = os.open(directory, os.O_RDONLY)
    try:
        fcntl.flock(lock, fcntl.LOCK_EX)
        if batch in REVIEWED_BATCHES:
            ledger = json.loads((HERE / REVIEWED_BATCHES[batch]).read_text(encoding='utf-8'))
            ids = [q['id'] for q in ledger['questions']]
            if len(set(ids)) != len(ids):
                raise ValueError('El lote contiene IDs duplicados.')
            if any(storage_name(q) not in ledger['files'] for q in ledger['questions']):
                raise ValueError('Falta la huella de un archivo del lote.')
            prepared = [prepare(topic, ledger['metadataEdits'] if topic == 'meta.json' else
                                [q for q in ledger['questions'] if storage_name(q) == topic],
                                directory, reverse, fingerprints)
                        for topic, fingerprints in ledger['files'].items()]
            if include_sample:
                sample = directory / 'sample'
                if sample.is_symlink() or not sample.is_dir():
                    raise ValueError('Falta una copia ordinaria del directorio sample.')
                prepared += [prepare(topic, [q for q in ledger['questions']
                                             if q.get('inSample') and q['topic'] + '.json' == topic],
                                     sample, reverse, fingerprints)
                             for topic, fingerprints in ledger.get('sampleFiles', {}).items()]
        else:
            topic, ledger = BATCHES[batch]
            edits = json.loads((HERE / ledger).read_text(encoding='utf-8'))
            prepared = [prepare(topic, edits, directory, reverse)]
        # All files are checked before staging. Interrupted writes can resume from either
        # of the two accepted hashes, or roll back to the prior release.
        with TemporaryDirectory(dir=directory) as staging:
            for index, (target, data, count) in enumerate(prepared):
                if count:
                    pending = Path(staging) / str(index)
                    pending.write_bytes(data)
                    pending.chmod(target.stat().st_mode & 0o777)
            for index, (target, _, count) in enumerate(prepared):
                if count:
                    (Path(staging) / str(index)).replace(target)
        return sum(count for target, _, count in prepared if target.name != 'meta.json')
    finally:
        os.close(lock)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--candidate-dir', type=Path, required=True)
    parser.add_argument('--batch', choices=[*BATCHES, *REVIEWED_BATCHES], default='web', help='Lote editorial sobre una copia de su tema.')
    parser.add_argument('--include-sample', action='store_true', help='Incluir las copias de muestra en candidate-dir/sample.')
    action = parser.add_mutually_exclusive_group(required=True)
    action.add_argument('--apply', action='store_true')
    action.add_argument('--rollback', action='store_true')
    args = parser.parse_args()
    try:
        print(f'{replay(args.candidate_dir, args.rollback, args.batch, args.include_sample)} preguntas modificadas.')
    except (KeyError, OSError, ValueError, TypeError) as error:
        parser.exit(1, f'{error}\n')


if __name__ == '__main__':
    main()
