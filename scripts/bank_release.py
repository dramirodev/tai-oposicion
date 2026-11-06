"""Compare the imported bank to the reviewed release before exposing any file."""
import hashlib
import json
from pathlib import Path

from scripts.citation_release import citation_base


ROOT = Path(__file__).resolve().parents[1]
RELEASE = ROOT / 'scripts' / 'bank-editorial' / 'release.json'
PUBLISHED = ROOT / 'public' / 'data'


def encode(value):
    return json.dumps(value, ensure_ascii=False, separators=(',', ':')).encode('utf-8')


def digest(data):
    return hashlib.sha256(data).hexdigest()


def question_rows(name, value):
    if name == 'supuestos.json':
        return (q for scenario in value.values() for q in scenario['q'])
    if isinstance(value, list):
        return iter(value)
    return iter(())


def prepare_bank(generated, destination):
    manifest = json.loads(RELEASE.read_text(encoding='utf-8'))
    if manifest.get('schemaVersion') != 1 or not manifest.get('files'):
        raise ValueError('Manifiesto de revisión del banco ausente o incompatible.')
    files = manifest['files']
    published_names = {path.name for path in PUBLISHED.glob('*.json')}
    if published_names != set(files):
        raise ValueError('El inventario del banco local no coincide con su manifiesto editorial.')

    # Keep the approved bytes for reproducible imports. Historical Drive exports predate
    # corrections to options, answers, notes, citations, scoring flags and ID aliases.
    approved = {}
    approved_rows = {}
    for name, entry in files.items():
        data = (PUBLISHED / name).read_bytes()
        if digest(citation_base(name, data)) != entry['approvedSha256']:
            raise ValueError(f'El banco aprobado difiere del manifiesto editorial: {name}')
        approved[name] = data
        for question in question_rows(name, json.loads(data)):
            approved_rows[question['i']] = question

    candidate = {}
    unreviewed = set(files) - set(generated)
    for name, value in generated.items():
        raw = encode(value)
        entry = files.get(name)
        if entry and digest(raw) in (entry['sourceBuildSha256'], entry['approvedSha256']):
            candidate[name] = approved[name]
            continue
        unreviewed.add(name)
        # Unknown imports are drafts. A literal-source match or an external
        # revision.estado cannot approve a new/changed question for assessment.
        for question in question_rows(name, value):
            previous = approved_rows.get(question['i'])
            if previous and previous.get('np'):
                question['np'] = 1
            if question['o'] == 'G' and previous != question:
                question['v'] = 1
        candidate[name] = encode(value)

    if destination.resolve() == PUBLISHED.resolve() and unreviewed:
        changed = ', '.join(sorted(unreviewed))
        raise ValueError(f'Reconstrucción sin aprobación editorial: {changed}. '
                         'Utilice --out-dir fuera de public para revisar el candidato.')
    return candidate, unreviewed
