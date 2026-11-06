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
}


def encode(value):
    return json.dumps(value, ensure_ascii=False, separators=(',', ':')).encode('utf-8')


def sha256(row):
    return hashlib.sha256(encode(row)).hexdigest()


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
    by_id = {key: key for key in rows} if metadata else {row['i']: index for index, row in enumerate(rows)}
    if len(by_id) != len(rows):
        raise ValueError('El tema contiene IDs duplicados.')
    changed = 0
    for edit in edits:
        index = by_id.get(edit['id'])
        if index is None:
            raise ValueError(f"Falta la pregunta {edit['id']}.")
        row = rows[index]
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
            elif row['i'] != edit['id'] or row['t'] + '.json' != topic:
                raise ValueError(f"ID o tema inesperado: {edit['id']}.")
            rows[index] = row
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
            prepared = [prepare(topic, ledger['metadataEdits'] if topic == 'meta.json' else
                                [q for q in ledger['questions'] if q['topic'] + '.json' == topic],
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
