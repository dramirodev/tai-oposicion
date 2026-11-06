"""Two source-adjudicated network repairs: reproducibility and legacy integrity.

Semantic evidence is the visual temario and checked IEEE/RFC documents in the
ledger. These tests verify the data contract and reversible transformation;
they do not substitute a normative review or claim a hardware/IKE runtime.
"""
import hashlib
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from historical_bank import ROOT, EDITORIAL, ORDER, copy_release_boundary

LEDGER = json.loads((EDITORIAL/'reviewed-network2.json').read_text())
SHA = lambda data: hashlib.sha256(data).hexdigest()
ENCODE = lambda value: json.dumps(value,ensure_ascii=False,separators=(',',':')).encode()

class Network2Tests(unittest.TestCase):
    def test_exact_content_and_legacy_contracts(self):
        self.assertEqual(len(LEDGER['questions']),2)
        self.assertEqual(LEDGER['metadataEdits'],[])
        self.assertEqual(LEDGER['sampleFiles'],{})
        changed = {q['id']:q for q in LEDGER['questions']}
        for entry in changed.values():
            actual = next(q for q in json.loads((ROOT/entry['storageFile']).read_bytes()) if q['i']==entry['id'])
            self.assertEqual(SHA(ENCODE(actual)),entry['afterSha256'],entry['id'])
            self.assertEqual(actual,entry['after'])
            for key in set(entry['before']) | set(entry['after']):
                if key not in ('q','n','u'):
                    self.assertEqual(entry['before'].get(key),entry['after'].get(key),key)
            self.assertEqual(len(set(actual['a'])),4)
            self.assertEqual(len(entry['reviewedOptions']),4)
            self.assertTrue(entry['discrepancy'])
            self.assertTrue(entry['reference']['visualCheck'])
            self.assertEqual(actual['u'],f"{entry['reference']['quote']} [p. {entry['reference']['page']}]")
        checked=0
        successors=ORDER[ORDER.index('reviewed-network2'):]
        for path in EDITORIAL.glob('reviewed-*.json'):
            if path.stem in successors: continue
            ledger=json.loads(path.read_text())
            for entry in ledger if isinstance(ledger,list) else ledger['questions']:
                topic=entry.get('topic','T4.07' if path.stem=='reviewed-T4.07' else 'T3.08')
                name=Path(entry.get('storageFile',topic+'.json')).name
                data=json.loads((ROOT/'public/data'/name).read_bytes())
                rows=[q for scenario in data.values() for q in scenario['q']] if name=='supuestos.json' else data
                actual=next(q for q in rows if q['i']==entry['id'])
                self.assertEqual(SHA(ENCODE(actual)),entry['afterSha256'],entry['id'])
                checked+=1
        self.assertEqual(checked,414) # 413 repaired plus explicitly non-scoring PHP.
        php=next(q for q in json.loads((ROOT/'public/data/T3.03.json').read_bytes()) if q['i']=='GEN-T3.03-48')
        self.assertEqual((php['np'],php['w']),(1,1))

    def test_atomic_preflight_idempotence_partial_resume_and_rollback(self):
        with tempfile.TemporaryDirectory() as tmp:
            folder=copy_release_boundary(Path(tmp),'reviewed-network2')
            snapshot=lambda:{name:(folder/name).read_bytes() for name in LEDGER['files']}
            final=snapshot()
            def run(mode):
                return subprocess.run([sys.executable,str(EDITORIAL/'replay.py'),'--candidate-dir',tmp,'--batch','reviewed-network2',mode],capture_output=True,text=True)
            def ok(mode,count):
                result=run(mode)
                self.assertEqual(result.returncode,0,result.stderr)
                self.assertEqual(result.stdout,f'{count} preguntas modificadas.\n')
            ok('--rollback',2);initial=snapshot();ok('--rollback',0)
            for name,hashes in LEDGER['files'].items():
                self.assertEqual(SHA(initial[name]),hashes['beforeSha256'])
                self.assertEqual(SHA(final[name]),hashes['afterSha256'])
                old,new=json.loads(initial[name]),json.loads(final[name])
                self.assertEqual([q['i'] for q in old],[q['i'] for q in new])
                self.assertEqual({b['i'] for b,a in zip(old,new) if b!=a},
                                 {e['id'] for e in LEDGER['questions'] if Path(e['storageFile']).name==name})
            # The late file must be checked before the first file can be changed.
            names=list(LEDGER['files']);last=folder/names[-1]
            last.write_bytes(initial[names[-1]]+b' ');dirty=snapshot()
            self.assertNotEqual(run('--apply').returncode,0)
            self.assertEqual(snapshot(),dirty)
            last.write_bytes(initial[names[-1]])
            (folder/names[0]).write_bytes(final[names[0]])
            ok('--apply',1);self.assertEqual(snapshot(),final)
            ok('--apply',0);ok('--rollback',2);self.assertEqual(snapshot(),initial)
            ordinary=folder/'ordinary.json';last.rename(ordinary);last.symlink_to(ordinary)
            dirty=snapshot();self.assertNotEqual(run('--apply').returncode,0);self.assertEqual(snapshot(),dirty)
