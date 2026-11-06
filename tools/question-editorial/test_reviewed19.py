"""Verify the release ledger, answers and reversible transformations without the Drive PDFs."""
import hashlib
import json
from pathlib import Path
import shutil
import subprocess
import sys
from tempfile import TemporaryDirectory
import unittest


ROOT = Path(__file__).resolve().parents[2]
EDITORIAL = ROOT / 'scripts' / 'bank-editorial'
DATA = ROOT / 'public' / 'data'
LEDGER = json.loads((EDITORIAL / 'reviewed-19.json').read_text())


class Reviewed19Tests(unittest.TestCase):
    def test_answers_and_editorial_evidence(self):
        verifier = Path(__file__).with_name('reviewed19') / 'check.py'
        case = subprocess.run([sys.executable, str(verifier)], check=True, capture_output=True, text=True)
        results = {line.split()[0] for line in case.stdout.splitlines()}
        self.assertEqual(len(results), 19)
        self.assertEqual(results, {q['id'] for q in LEDGER['questions']})
        self.assertNotIn('GEN-T4.08-20.v1', results)
        for item in LEDGER['questions']:
            with self.subTest(question=item['id']):
                self.assertEqual(len(item['reviewedOptions']), 4)
                self.assertTrue(all(item['reviewedOptions']))
                self.assertEqual(item['after']['u'], f"{item['reference']['quote']} [p. {item['reference']['page']}]")
                self.assertRegex(item['reference']['sha256'], r'^[a-f0-9]{64}$')
                sample = json.loads((ROOT/'public'/'sample'/(item['topic']+'.json')).read_text())
                self.assertNotIn(item['id'], {q['i'] for q in sample})

    def test_guarded_round_trip(self):
        with TemporaryDirectory() as temp:
            folder = Path(temp)
            names = list(LEDGER['files'])
            self.assertEqual(len(names), 5)
            later = json.loads((EDITORIAL / 'reviewed-followup.json').read_text())
            for name in set(names) | set(later['files']):
                shutil.copyfile(DATA/name, folder/name)
            # Test this historical release at its own boundary: undo the independently
            # reviewed successor on the temporary copy before replaying the original 19.
            subprocess.run([sys.executable, str(EDITORIAL/'replay.py'), '--candidate-dir', temp,
                            '--batch', 'reviewed-followup', '--rollback'], check=True, capture_output=True)

            def run(mode):
                return subprocess.run([sys.executable, str(EDITORIAL/'replay.py'), '--candidate-dir', temp,
                                       '--batch', 'reviewed-19', mode], capture_output=True, text=True)

            def hashes():
                return {n: hashlib.sha256((folder/n).read_bytes()).hexdigest() for n in names}

            approved = hashes()
            self.assertEqual(approved, {n:f['afterSha256'] for n, f in LEDGER['files'].items()})
            self.assertTrue(run('--rollback').stdout.startswith('19 '))
            self.assertEqual(hashes(), {n:f['beforeSha256'] for n, f in LEDGER['files'].items()})
            self.assertTrue(run('--rollback').stdout.startswith('0 '))
            damaged = folder/names[-1]
            original = damaged.read_bytes()
            damaged.write_bytes(original+b' ')
            drift = hashes()
            self.assertIn('Deriva externa', run('--apply').stderr)
            self.assertEqual(hashes(), drift)
            damaged.write_bytes(original)
            self.assertTrue(run('--apply').stdout.startswith('19 '))
            self.assertTrue(run('--apply').stdout.startswith('0 '))
            self.assertEqual(hashes(), approved)
