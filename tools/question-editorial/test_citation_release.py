"""Citation-only overlays preserve approved release boundaries and fail closed."""
import copy
import json
from pathlib import Path
import sys
import tempfile
import unittest

ROOT = Path(__file__).resolve().parents[2]
sys.path.insert(0, str(ROOT / 'scripts'))
from citation_release import citation_base, digest, encode


class CitationReleaseTests(unittest.TestCase):
    def test_real_ledgers_restore_exact_approved_bytes_and_preserve_scoring(self):
        release = json.loads((ROOT / 'scripts/bank-editorial/release.json').read_text())
        for path in sorted((ROOT / 'scripts/bank-editorial/citations').glob('T*.json')):
            ledger = json.loads(path.read_text())
            raw = (ROOT / 'public/data' / path.name).read_bytes()
            self.assertEqual(digest(citation_base(path.name, raw)), release['files'][path.name]['approvedSha256'])
            for edit in ledger['questions']:
                self.assertEqual(edit['after'], {**edit['before'], 'u': edit['after']['u']})
                self.assertFalse(edit['before'].get('u'))
                self.assertTrue(edit['evidenceKeys'])
                self.assertTrue(all(key in ledger['sources'] for key in edit['evidenceKeys']))
                self.assertNotIn('<p><strong>', edit['after']['u'])
            citation_base(path.name, (ROOT / 'public/sample' / path.name).read_bytes(), sample=True)

    def test_rejects_field_file_identity_and_base_tampering(self):
        before = {'i': 'fixture', 't': 'T1.99', 'q': 'Question', 'a': ['A','B'], 'c': 0, 'o': 'A'}
        after = {**before, 'u': 'A literal source excerpt.'}
        base = encode([before]) + b'\n'
        current = encode([after]) + b'\n'
        ledger = {'schemaVersion': 1, 'topicId': 'T1.99',
                  'file': {'beforeSha256': digest(base), 'afterSha256': digest(current)},
                  'questions': [{'id': 'fixture', 'before': before, 'after': after,
                                 'beforeSha256': digest(encode(before)), 'afterSha256': digest(encode(after))}]}
        with tempfile.TemporaryDirectory() as temporary:
            folder = Path(temporary)
            def run(value, raw=current):
                (folder/'T1.99.json').write_text(json.dumps(value))
                return citation_base('T1.99.json', raw, ledger_directory=folder, expected_base_hash=digest(base))
            self.assertEqual(run(ledger), base)
            for mutate in [
                lambda x: x['questions'].append(copy.deepcopy(x['questions'][0])),
                lambda x: x['questions'][0]['after'].update(c=1),
                lambda x: x['questions'][0]['after'].update(np=0),
                lambda x: x['questions'][0]['before'].update(u='previous citation'),
                lambda x: x['file'].update(beforeSha256='0'*64),
                lambda x: x.update(topicId='T1.98'),
                lambda x: x['questions'][0].update(afterSha256='0'*64),
            ]:
                changed=copy.deepcopy(ledger); mutate(changed)
                with self.assertRaises(ValueError): run(changed)
            with self.assertRaises(ValueError): run(ledger, current+b' ')
            with self.assertRaises(ValueError): run(ledger, encode([{**after,'c':1}])+b'\n')
