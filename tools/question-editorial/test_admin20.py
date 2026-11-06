"""Admin20 full-row evidence/replay; models are not service or hardware executions."""
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
LEDGER = json.loads((EDITORIAL / 'reviewed-admin20.json').read_text())
QUESTIONS = {q['id']: q for q in LEDGER['questions']}


def encode(value):
    return json.dumps(value, ensure_ascii=False, separators=(',', ':')).encode()


def sha(value):
    return hashlib.sha256(value).hexdigest()


class Admin20Tests(unittest.TestCase):
    def test_scope_full_rows_metadata_and_samples(self):
        self.assertEqual(len(QUESTIONS), 20)
        self.assertEqual(len(LEDGER['files']), 5)
        self.assertEqual(set(LEDGER['sampleFiles']), {'T4.03.json'})
        self.assertEqual({q['id'] for q in QUESTIONS.values() if q['inSample']},
                         {'AS11B-P1-87', 'GEN-T4.03-05'})
        self.assertEqual(len(LEDGER['metadataEdits']), 11)
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
        for folder, files in [('data', LEDGER['files']), ('sample', LEDGER['sampleFiles'])]:
            for name, hashes in files.items():
                self.assertEqual(sha((ROOT/'public'/folder/name).read_bytes()), hashes['afterSha256'])

    def test_replay_atomic_drift_symlink_idempotence_and_boundaries(self):
        with tempfile.TemporaryDirectory() as temporary:
            folder = copy_release_boundary(Path(temporary), 'reviewed-admin20')
            paths = [folder/n for n in LEDGER['files']]+[folder/'sample'/n for n in LEDGER['sampleFiles']]
            snapshot = lambda: {str(p.relative_to(folder)): p.read_bytes() for p in paths}
            original = snapshot()
            def run(mode):
                return subprocess.run([sys.executable,str(EDITORIAL/'replay.py'),'--candidate-dir',temporary,
                                       '--batch','reviewed-admin20','--include-sample',mode],capture_output=True,text=True)
            def success(mode, count):
                result=run(mode)
                self.assertEqual(result.returncode,0,result.stderr)
                self.assertEqual(result.stdout,f'{count} preguntas modificadas.\n')
            success('--rollback',22) # 20 bank rows plus two public copies.
            baseline=snapshot()
            for name,h in LEDGER['files'].items():self.assertEqual(sha((folder/name).read_bytes()),h['beforeSha256'])
            for name,h in LEDGER['sampleFiles'].items():self.assertEqual(sha((folder/'sample'/name).read_bytes()),h['beforeSha256'])
            success('--rollback',0)
            damaged=folder/'meta.json';damaged.write_bytes(damaged.read_bytes()+b' ')
            dirty=snapshot();self.assertIn('Deriva externa',run('--apply').stderr);self.assertEqual(snapshot(),dirty)
            damaged.write_bytes(baseline['meta.json'])
            sample=folder/'sample/T4.03.json';sample.write_bytes(sample.read_bytes()+b' ')
            dirty=snapshot();self.assertIn('Deriva externa',run('--apply').stderr);self.assertEqual(snapshot(),dirty)
            sample.write_bytes(baseline['sample/T4.03.json'])
            success('--apply',22);self.assertEqual(snapshot(),original);success('--apply',0)
            success('--rollback',22)
            (folder/'T4.01.json').write_bytes(original['T4.01.json'])
            self.assertEqual(run('--apply').returncode,0);self.assertEqual(snapshot(),original)
            success('--rollback',22)
            sample.unlink();sample.symlink_to(folder/'T4.01.json')
            self.assertIn('Falta una copia ordinaria',run('--apply').stderr)
            self.assertEqual((folder/'T4.01.json').read_bytes(),baseline['T4.01.json'])
        # The previous release boundary must be reconstructed without rewriting its ledger.
        previous=json.loads((EDITORIAL/'reviewed-wave2.json').read_text())
        with tempfile.TemporaryDirectory() as temporary:
            boundary=copy_release_boundary(Path(temporary),'reviewed-wave2')
            for name,h in previous['files'].items():self.assertEqual(sha((boundary/name).read_bytes()),h['afterSha256'])

    def test_word_count_real_command_and_passwd_fixture(self):
        # Host wc (BSD on macOS, GNU on Linux), no claim of a cross-platform service runtime.
        result=subprocess.run(['wc','-w'],input='uno dos\ntres\n',capture_output=True,text=True,check=True)
        self.assertEqual(int(result.stdout),3)
        wc=QUESTIONS['AT401-P1-16']['after'];self.assertEqual(wc['a'][wc['c']],'wc.')
        shell='ana:x:1000:1000::/home/ana:/bin/zsh'.split(':')[6]
        q=QUESTIONS['GEN-T4.04-24.v2']['after'];self.assertEqual(q['a'][q['c']],shell)

    def test_illustrative_models_not_backup_raid_or_windows_runtimes(self):
        full={'a':1,'b':1};prior={'a':2,'b':1};current={'a':2,'b':2}
        self.assertEqual({k for k in current if current[k]!=full[k]},{'a','b'})
        self.assertEqual({k for k in current if current[k]!=prior[k]},{'b'})
        q=QUESTIONS['AS10-P1-81']['after'];self.assertEqual(q['a'][q['c']],'Diferencial.')
        copies=[list(range(10)) for _ in range(4)]
        self.assertEqual(len(set(v for disk in copies for v in disk)),10)
        q=QUESTIONS['GEN-T4.02-42.v1']['after'];self.assertEqual(q['a'][q['c']],'1 TB, según la fórmula C = d.')
        # RPO is a loss window, not an interruption duration; RTA need not equal the objective.
        incident=12;restorable=10;self.assertEqual(incident-restorable,2)
        self.assertEqual([actual<6 for actual in (4,6,8)],[True,False,False])
        q=QUESTIONS['GEN-T4.02-109.v2']['after'];self.assertTrue(q['a'][q['c']].startswith('RTA puede ser menor, igual o mayor'))
        state={}
        for v in ('local','site','domain','ou'):state['setting']=v
        self.assertEqual(state['setting'],'ou')
        q=QUESTIONS['GEN-T4.01-05.v1']['after'];self.assertEqual(q['a'][q['c']],'La última aplicada.')
