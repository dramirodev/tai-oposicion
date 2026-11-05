"""Candidate generation with immutable sources and an explicit editorial decision.

Run with --help. No network, publication, or student data access.
"""
import argparse
import hashlib
import json
from pathlib import Path
import re
import subprocess
import unicodedata

PATTERNS = json.loads(Path(__file__).with_name('patterns.json').read_text())['patterns']
STAGES = ['topic', 'section', 'retrieval', 'concept', 'pattern', 'stem', 'solution',
          'distractors', 'explanation', 'reference', 'structure', 'semantics',
          'duplicates', 'quality', 'decision']


def fingerprint(value):
    payload = json.dumps(value, ensure_ascii=False, sort_keys=True, separators=(',', ':'))
    return hashlib.sha256(payload.encode()).hexdigest()


def normalized(value):
    return ' '.join(unicodedata.normalize('NFC', value).split())


def source_page(reference, root):
    path = (root / reference['path']).resolve()
    if not path.is_relative_to(root.resolve()):
        raise ValueError('Source must belong to the declared curriculum root')
    if hashlib.sha256(path.read_bytes()).hexdigest() != reference['sha256']:
        raise ValueError('Source revision changed')
    if path.suffix.lower() == '.pdf':
        text = subprocess.run(['pdftotext', '-layout', str(path), '-'],
                              check=True, capture_output=True, text=True).stdout
    elif path.suffix.lower() == '.txt':
        text = path.read_text()
    else:
        raise ValueError('Source must be a PDF or a paginated text export')
    pages = text.split('\f')
    if pages and not pages[-1].strip():
        pages.pop()
    page = reference['page']
    if type(page) is not int or not 1 <= page <= len(pages):
        raise ValueError('Physical page is outside the source')
    quote = reference['quote']
    if not isinstance(quote, str) or len(normalized(quote)) < 25:
        raise ValueError('Source quote is missing or too short')
    if normalized(quote) not in normalized(pages[page - 1]):
        raise ValueError('Quote does not occur on the stated physical page')
    return pages[page - 1]


def generate_candidate(spec, curriculum_root, existing=(), review=None):
    """Use authored concepts/options to construct a candidate for a known pattern.

    A builder or an editor supplies the concept, independent solution and four
    alternatives. The pipeline never infers factual validity from confidence.
    """
    for field in ('id', 'topic', 'section', 'concept', 'pattern', 'prompt', 'options',
                  'correct', 'solution', 'explanation', 'rationales', 'reference',
                  'cognitiveDemand', 'difficulty', 'author'):
        if field not in spec or spec[field] in ('', None, []):
            raise ValueError('Missing field: ' + field)
    if not re.fullmatch(r'T[1-4]\.\d{2}', spec['topic']):
        raise ValueError('Invalid topic')
    pattern = next((p for p in PATTERNS if p['id'] == spec['pattern']), None)
    if not pattern:
        raise ValueError('Pattern has no audited evidence')
    if not isinstance(spec['options'], list) or len(spec['options']) != 4:
        raise ValueError('Exactly four options are required')
    if any(not isinstance(o, str) or not o.strip() for o in spec['options']):
        raise ValueError('Options must contain text')
    if len({normalized(o) for o in spec['options']}) != 4:
        raise ValueError('Duplicate options')
    if type(spec['correct']) is not int or spec['correct'] not in range(4):
        raise ValueError('Correct answer index is invalid')
    if normalized(spec['solution']) != normalized(spec['options'][spec['correct']]):
        raise ValueError('Independent solution disagrees with the answer key')
    if not isinstance(spec['rationales'], list) or len(spec['rationales']) != 4 or any(not isinstance(r, str) or not r.strip() for r in spec['rationales']):
        raise ValueError('Explain each option, including all three distractors')
    if type(spec['difficulty']) is not int or spec['difficulty'] not in range(1, 4):
        raise ValueError('Difficulty must be an editorial estimate from 1 to 3')
    source_page(spec['reference'], curriculum_root)
    question = dict(i=spec['id'], t=spec['topic'], o='G', q=spec['prompt'],
                    a=spec['options'], c=spec['correct'], d=spec['difficulty'],
                    n=spec['explanation'], np=1)
    semantic = fingerprint([normalized(question['q']), sorted(normalized(a) for a in question['a'])])
    for old in existing:
        if old['i'] == question['i']:
            raise ValueError('ID is already present in the bank')
        other = fingerprint([normalized(old['q']), sorted(normalized(a) for a in old['a'])])
        if semantic == other:
            raise ValueError('Exact content duplicate, including permuted options')
    revision = fingerprint(spec)
    problems = []
    for flag in ('conflictingSources', 'missingMaterial', 'outsideCurriculum', 'confirmedContradiction'):
        if spec.get(flag):
            problems.append(flag)
    equivalent = spec.get('equivalentOptionPairs', [])
    if equivalent:
        problems.append('equivalentOptions')
    status = 'rejected' if problems else 'pending_review'
    if review and not problems:
        identity_valid = (review.get('revision') == revision
                          and review.get('reviewer') and review['reviewer'] != spec['author']
                          and review.get('date'))
        accepted = (review.get('decision') == 'accepted'
                    and review.get('blindSolution') == spec['solution']
                    and review.get('sourceVerified') is True
                    and review.get('uniqueAnswer') is True
                    and review.get('rationalesVerified') is True)
        rejected = review.get('decision') == 'rejected' and bool(review.get('reason'))
        if not identity_valid or not (accepted or rejected):
            raise ValueError('Review must match the full revision and justify its decision')
        status = review['decision']
    longest = max(len(o.split()) for o in question['a'])
    length_cue = len(question['a'][question['c']].split()) == longest
    manifest = dict(schemaVersion=1, revision=revision, topic=spec['topic'],
                    section=spec['section'], concept=spec['concept'], reference=spec['reference'],
                    pattern=pattern, cognitiveDemand=spec['cognitiveDemand'],
                    difficultyKind='editorial_estimate', author=spec['author'],
                    state=status, rationales=spec['rationales'], review=review,
                    quality={'correctOptionIsLongest': length_cue, 'problems': problems},
                    stages=[dict(stage=s, state='completed' if s not in ('semantics', 'decision')
                                 or status == 'accepted' else status) for s in STAGES])
    # Even an accepted candidate remains excluded until the publisher approves a
    # versioned bank transformation. Its metadata never authorizes remote writes.
    return dict(question=question, editorial=manifest)


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('spec', type=Path)
    parser.add_argument('--curriculum-root', type=Path, required=True)
    parser.add_argument('--bank', type=Path, required=True)
    parser.add_argument('--review', type=Path)
    parser.add_argument('--output', type=Path, required=True)
    args = parser.parse_args()
    if not args.bank.is_dir() or not (args.bank / 'meta.json').is_file():
        parser.error('An existing bank with meta.json is required')
    output = args.output.resolve()
    public = Path(__file__).resolve().parents[2] / 'public'
    if output.is_relative_to(public) or output.is_relative_to(args.bank.resolve()):
        parser.error('Candidate output must be outside public and the input bank')
    bank = []
    for path in args.bank.glob('T*.json'):
        bank.extend(json.loads(path.read_text()))
    scenarios = args.bank / 'supuestos.json'
    if scenarios.exists():
        for scenario in json.loads(scenarios.read_text()).values():
            bank.extend(scenario['q'])
    if not bank:
        parser.error('The input bank has no questions')
    spec = json.loads(args.spec.read_text())
    if spec.get('id') in json.loads((args.bank / 'meta.json').read_text()):
        parser.error('ID or historical alias already belongs to the bank')
    result = generate_candidate(spec, args.curriculum_root, bank,
                                json.loads(args.review.read_text()) if args.review else None)
    # Exclusive creation prevents accidentally replacing an approved record.
    with args.output.open('x') as target:
        json.dump(result, target, ensure_ascii=False, indent=2)
        target.write('\n')
    print(result['editorial']['state'])


if __name__ == '__main__':
    main()
