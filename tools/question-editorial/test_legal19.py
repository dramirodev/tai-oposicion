"""Legal19 full-row evidence/replay; models are not service or hardware executions."""
import hashlib
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from historical_bank import copy_release_boundary

ROOT = Path(__file__).resolve().parents[2]
EDITORIAL = ROOT / 'scripts/bank-editorial'
LEDGER = json.loads((EDITORIAL / 'reviewed-legal19.json').read_text())
QUESTIONS = {q['id']: q for q in LEDGER['questions']}


def encode(value):
    return json.dumps(value, ensure_ascii=False, separators=(',', ':')).encode()


def sha(value):
    return hashlib.sha256(value).hexdigest()


class Legal19Tests(unittest.TestCase):
    def test_scope_full_rows_metadata_and_samples(self):
        self.assertEqual(len(QUESTIONS), 19)
        self.assertEqual(len(LEDGER['files']), 7)
        self.assertEqual(set(LEDGER['sampleFiles']), {'T1.07.json'})
        self.assertEqual({q['id'] for q in QUESTIONS.values() if q['inSample']},
                         {'AT107-P1-59'})
        self.assertEqual(len(LEDGER['metadataEdits']), 6)
        meta = json.loads((ROOT / 'public/data/meta.json').read_text())
        for q in QUESTIONS.values():
            with self.subTest(id=q['id']):
                for side in ('before', 'after'):
                    self.assertEqual(sha(encode(q[side])), q[side+'Sha256'])
                row = next(x for x in json.loads((ROOT/'public/data'/(q['topic']+'.json')).read_text()) if x['i']==q['id'])
                self.assertEqual(row, q['after'])
                self.assertEqual(len(row['a']), 4)
                self.assertEqual(len(set(row['a'])), 4)
                self.assertEqual(len(q['reviewedOptions']), 4)
                self.assertTrue(all(isinstance(r, str) and r for r in q['reviewedOptions']))
                self.assertEqual(meta[q['id']][2], row['k'])
                ref = q['reference']
                self.assertEqual(row['u'], f"{ref['quote']} [p. {ref['page']}]")
                samples = json.loads((ROOT/'public/sample'/(q['topic']+'.json')).read_text())
                copies = [s for s in samples if s['i']==q['id']]
                self.assertEqual(copies, [row] if q['inSample'] else [])
        for edit in LEDGER['metadataEdits']:
            self.assertEqual(edit['index'], 2)
            self.assertEqual(edit['topic'], QUESTIONS[edit['id']]['topic'])
            self.assertEqual(edit['before'][:2]+edit['before'][3:], edit['after'][:2]+edit['after'][3:])
            for side in ('before', 'after'):
                self.assertEqual(sha(encode(edit[side])), edit[side+'Sha256'])
        with tempfile.TemporaryDirectory() as temporary:
            boundary = copy_release_boundary(Path(temporary), 'reviewed-legal19')
            for subdir, files in [('', LEDGER['files']), ('sample', LEDGER['sampleFiles'])]:
                for name, hashes in files.items():
                    self.assertEqual(sha((boundary/subdir/name).read_bytes()), hashes['afterSha256'])

    def test_replay_atomic_drift_symlink_idempotence_and_boundaries(self):
        with tempfile.TemporaryDirectory() as temporary:
            folder = copy_release_boundary(Path(temporary), 'reviewed-legal19')
            paths = [folder/n for n in LEDGER['files']]+[folder/'sample'/n for n in LEDGER['sampleFiles']]
            snapshot = lambda: {str(p.relative_to(folder)): p.read_bytes() for p in paths}
            original = snapshot()
            def run(mode):
                return subprocess.run([sys.executable,str(EDITORIAL/'replay.py'),'--candidate-dir',temporary,
                                       '--batch','reviewed-legal19','--include-sample',mode],capture_output=True,text=True)
            def success(mode, count):
                result=run(mode)
                self.assertEqual(result.returncode,0,result.stderr)
                self.assertEqual(result.stdout,f'{count} preguntas modificadas.\n')
            success('--rollback',20) # 19 bank rows plus one public copy.
            baseline=snapshot()
            for name,h in LEDGER['files'].items():self.assertEqual(sha((folder/name).read_bytes()),h['beforeSha256'])
            for name,h in LEDGER['sampleFiles'].items():self.assertEqual(sha((folder/'sample'/name).read_bytes()),h['beforeSha256'])
            success('--rollback',0)
            damaged=folder/'meta.json';damaged.write_bytes(damaged.read_bytes()+b' ')
            dirty=snapshot();self.assertIn('Deriva externa',run('--apply').stderr);self.assertEqual(snapshot(),dirty)
            damaged.write_bytes(baseline['meta.json'])
            sample=folder/'sample/T1.07.json';sample.write_bytes(sample.read_bytes()+b' ')
            dirty=snapshot();self.assertIn('Deriva externa',run('--apply').stderr);self.assertEqual(snapshot(),dirty)
            sample.write_bytes(baseline['sample/T1.07.json'])
            success('--apply',20);self.assertEqual(snapshot(),original);success('--apply',0)
            success('--rollback',20)
            (folder/'T1.04.json').write_bytes(original['T1.04.json'])
            self.assertEqual(run('--apply').returncode,0);self.assertEqual(snapshot(),original)
            success('--rollback',20)
            sample.unlink();sample.symlink_to(folder/'T1.04.json')
            self.assertIn('Falta una copia ordinaria',run('--apply').stderr)
            self.assertEqual((folder/'T1.04.json').read_bytes(),baseline['T1.04.json'])
        # The previous release boundary must be reconstructed without rewriting its ledger.
        previous=json.loads((EDITORIAL/'reviewed-admin20.json').read_text())
        with tempfile.TemporaryDirectory() as temporary:
            boundary=copy_release_boundary(Path(temporary),'reviewed-admin20')
            for name,h in previous['files'].items():self.assertEqual(sha((boundary/name).read_bytes()),h['afterSha256'])

    def test_legal_scope_and_previous_rows_unchanged(self):
        self.assertNotIn('GEN-T1.08-73', QUESTIONS)
        for id in ('AT107-P1-08', 'GEN-T1.07-41.v1'):
            row = QUESTIONS[id]['after']
            self.assertIn('vigente', row['q'])
            self.assertIn('Congreso', row['q'])
            self.assertEqual(row['c'], 2)
        self.assertEqual(QUESTIONS['AT107-P1-59']['after']['c'], 3)
        self.assertEqual(QUESTIONS['AT107-P1-61']['after']['c'], 3)
        self.assertEqual(QUESTIONS['AT107-P1-62']['after']['c'], 3)
        self.assertIn('una de las condiciones', QUESTIONS['GEN-T1.08-36']['after']['q'])
        previous = set()
        for name in ('reviewed-19','reviewed-followup','reviewed-wave2','reviewed-admin20'):
            for q in json.loads((EDITORIAL/(name+'.json')).read_text())['questions']:
                self.assertNotIn(q['id'], QUESTIONS)
                row = next(r for r in json.loads((ROOT/'public/data'/(q['topic']+'.json')).read_text()) if r['i']==q['id'])
                self.assertEqual(row, q['after'])
                previous.add(q['id'])
        self.assertEqual(len(previous), 204)  # Includes the retained PHP study-only row.
