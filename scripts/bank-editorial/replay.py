"""Replay the audited question edits on a local candidate copy."""
import argparse
import fcntl
import hashlib
import json
import os
from pathlib import Path
from tempfile import NamedTemporaryFile


HERE = Path(__file__).resolve().parent
PROJECT = HERE.parents[1]
BATCHES = {
    'web': ('T3.08.json', 'reviewed-web.json'),
    'T3.08': ('T3.08.json', 'reviewed-T3.08.json'),
    'T4.07': ('T4.07.json', 'reviewed-T4.07.json'),
}


def encode(value):
    return json.dumps(value, ensure_ascii=False, separators=(',', ':')).encode('utf-8')


def sha256(row):
    return hashlib.sha256(encode(row)).hexdigest()


def replay(directory, reverse, batch):
    topic, ledger = BATCHES[batch]
    directory = directory.resolve(strict=True)
    if directory.is_relative_to(PROJECT) or any((parent / '.git').exists()
                                                for parent in (directory, *directory.parents)):
        raise ValueError('El candidato debe estar fuera del repositorio.')
    target = directory / topic
    if target.is_symlink() or not target.is_file():
        raise ValueError(f'Falta una copia ordinaria del tema {topic}.')
    # Lock a stable directory descriptor: the target inode is replaced on success.
    lock = os.open(directory, os.O_RDONLY)
    try:
        fcntl.flock(lock, fcntl.LOCK_EX)
        original = target.read_bytes()
        rows = json.loads(original)
        by_id = {row['i']: row for row in rows}
        if len(by_id) != len(rows):
            raise ValueError('El tema contiene IDs duplicados.')
        source, destination = ('after', 'before') if reverse else ('before', 'after')
        changed = 0
        for edit in json.loads((HERE / ledger).read_text(encoding='utf-8')):
            row = by_id.get(edit['id'])
            if row is None:
                raise ValueError(f"Falta la pregunta {edit['id']}.")
            current = sha256(row)
            if current == edit[destination + 'Sha256']:
                continue
            if current != edit[source + 'Sha256']:
                raise ValueError(f"Huella inesperada: {edit['id']}.")
            for field, value in edit[destination].items():
                if value is None:
                    row.pop(field, None)
                else:
                    row[field] = value
            if sha256(row) != edit[destination + 'Sha256']:
                raise ValueError(f"El parche no reproduce la huella de {edit['id']}.")
            changed += 1
        if changed:
            # Preserve the bank's terminal whitespace. No write occurs on a partial failure.
            trailing = original[len(original.rstrip()):]
            with NamedTemporaryFile(dir=directory, delete=False) as staging:
                tmp = Path(staging.name)
            try:
                tmp.write_bytes(encode(rows) + trailing)
                tmp.chmod(target.stat().st_mode & 0o777)
                tmp.replace(target)
            finally:
                tmp.unlink(missing_ok=True)
        return changed
    finally:
        os.close(lock)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--candidate-dir', type=Path, required=True)
    parser.add_argument('--batch', choices=BATCHES, default='web', help='Lote editorial sobre una copia de su tema.')
    action = parser.add_mutually_exclusive_group(required=True)
    action.add_argument('--apply', action='store_true')
    action.add_argument('--rollback', action='store_true')
    args = parser.parse_args()
    try:
        print(f'{replay(args.candidate_dir, args.rollback, args.batch)} preguntas modificadas.')
    except (KeyError, OSError, ValueError, TypeError) as error:
        parser.exit(1, f'{error}\n')


if __name__ == '__main__':
    main()
