"""Verify and undo citation-only overlays without changing the reviewed release."""
import hashlib
import json
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
LEDGERS = ROOT / 'scripts/bank-editorial/citations'


def digest(value):
    return hashlib.sha256(value).hexdigest()


def encode(value):
    return json.dumps(value, ensure_ascii=False, separators=(',', ':')).encode('utf-8')


def citation_base(name, raw, *, sample=False, ledger_directory=None, expected_base_hash=None):
    """Return exact pre-citation bytes, rejecting any unreviewed field/file drift."""
    directory = Path(ledger_directory) if ledger_directory is not None else LEDGERS
    if Path(name).name != name or not name.endswith('.json'):
        raise ValueError('Invalid citation file name')
    path = directory / name
    if not path.exists():
        return raw
    if path.is_symlink() or not path.is_file():
        raise ValueError('Invalid citation ledger file')
    ledger = json.loads(path.read_text())
    if ledger.get('schemaVersion') != 1 or not isinstance(ledger.get('topicId'), str) or ledger['topicId'] + '.json' != name:
        raise ValueError('Invalid citation ledger schema/topic')
    edits = ledger.get('questions', [])
    if not edits or len({edit['id'] for edit in edits}) != len(edits):
        raise ValueError('Missing or duplicate citation edit')
    by_id = {}
    for edit in edits:
        before, after = edit['before'], edit['after']
        if (before.get('i') != edit['id'] or before.get('t') != ledger['topicId']
                or before.get('u') or not isinstance(after.get('u'), str) or not after['u'].strip()
                or after != {**before, 'u': after['u']}):
            raise ValueError('Citation overlays may only add u to an unchanged question')
        if digest(encode(before)) != edit['beforeSha256'] or digest(encode(after)) != edit['afterSha256']:
            raise ValueError('Citation record fingerprint drift')
        by_id[edit['id']] = edit
    boundary = ledger.get('sample') if sample else ledger['file']
    if boundary is None:
        return raw
    if not sample:
        if expected_base_hash is None:
            release = json.loads((ROOT / 'scripts/bank-editorial/release.json').read_text())
            expected_base_hash = release['files'][name]['approvedSha256']
        if boundary['beforeSha256'] != expected_base_hash:
            raise ValueError('Citation base is not the approved release: ' + name)
    if digest(raw) != boundary['afterSha256']:
        raise ValueError('Citation file fingerprint drift: ' + name)
    rows = json.loads(raw)
    if not isinstance(rows, list) or len({row['i'] for row in rows}) != len(rows):
        raise ValueError('Invalid citation bank rows')
    present = {row['i'] for row in rows}
    if not sample and not set(by_id).issubset(present):
        raise ValueError('Missing citation question')
    for index, row in enumerate(rows):
        edit = by_id.get(row['i'])
        if edit is not None:
            if row != edit['after']:
                raise ValueError('Unapproved citation question drift: ' + row['i'])
            rows[index] = edit['before']
    ending = raw[len(raw.rstrip()):]
    result = encode(rows) + ending
    if digest(result) != boundary['beforeSha256']:
        raise ValueError('Citation base fingerprint drift: ' + name)
    return result
