"""M7 exact transformations on temporary candidates, without Drive or network.

Historical ledger SHA values never get rebased. Runtime SQL/model limitations are
covered separately; these tests verify signed raw transport and release behavior.
"""
import hashlib
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from historical_bank import ROOT, EDITORIAL, ORDER, copy_release_boundary

BATCHES=('reviewed-development11','reviewed-systems20')
def sha(b):return hashlib.sha256(b).hexdigest()
def encode(x):return json.dumps(x,ensure_ascii=False,separators=(',',':')).encode()
def flatten(x):
    if isinstance(x,list):return [q for item in x for q in flatten(item)]
    if isinstance(x,dict):return [x] if 'i' in x else [q for v in x.values() for q in flatten(v)]
    return []

class M7ReplayTests(unittest.TestCase):
    def check_batch(self,batch,count,metadata_count,sample_count):
        ledger=json.loads((EDITORIAL/(batch+'.json')).read_text())
        self.assertEqual(len(ledger['questions']),count)
        self.assertEqual(len(ledger['metadataEdits']),metadata_count)
        self.assertEqual(len(ledger['sampleFiles']),sample_count)
        with tempfile.TemporaryDirectory() as tmp:
            folder=copy_release_boundary(Path(tmp),batch)
            paths=list(ledger['files'])+['sample/'+n for n in ledger['sampleFiles']]
            snapshot=lambda:{n:(folder/n).read_bytes() for n in paths}
            final=snapshot()
            def run(mode):return subprocess.run([sys.executable,str(EDITORIAL/'replay.py'),'--candidate-dir',tmp,'--batch',batch,'--include-sample',mode],capture_output=True,text=True)
            def ok(mode,expected):
                result=run(mode);self.assertEqual(result.returncode,0,result.stderr)
                self.assertEqual(result.stdout,f'{expected} preguntas modificadas.\n')
            for q in ledger['questions']:
                name=Path(q['storageFile']).name
                actual=next(r for r in flatten(json.loads(final[name])) if r['i']==q['id'])
                self.assertEqual(actual,q['after'])
                for side in ('before','after'):self.assertEqual(sha(encode(q[side])),q[side+'Sha256'])
                self.assertEqual(len(q['reviewedOptions']),4)
                self.assertTrue(all(isinstance(s,str) and s for s in q['reviewedOptions']))
                self.assertEqual(len(set(q['after']['a'])),4)
                ref=q['reference'];self.assertEqual(q['after']['u'],f"{ref['quote']} [p. {ref['page']}]")
                self.assertRegex(ref['sha256'],r'^[a-f0-9]{64}$')
                self.assertNotEqual(q['after'].get('np'),1)
                if q.get('context'):
                    context=q['context'];self.assertEqual(context['supTexto'],'')
                    self.assertEqual(context['contextSha256'],sha(b''))
                    for side in ('before','after'):
                        envelope={'scenarioId':q['scenarioId'],'supTexto':'','question':q[side]}
                        self.assertEqual(sha(encode(envelope)),context[side+'ContextualSha256'])
                        canonical=json.dumps({**q[side],'supTexto':''},sort_keys=True,ensure_ascii=False,separators=(',',':')).encode()
                        self.assertNotEqual(sha(canonical),context[side+'ContextualSha256'])
            for e in ledger['metadataEdits']:
                self.assertEqual(e['index'],2)
                self.assertEqual(e['before'][:2]+e['before'][3:],e['after'][:2]+e['after'][3:])
            total=count+sample_count
            ok('--rollback',total);initial=snapshot();ok('--rollback',0)
            fingerprints={**ledger['files'],**{'sample/'+n:h for n,h in ledger['sampleFiles'].items()}}
            for name,h in fingerprints.items():
                self.assertEqual(sha(initial[name]),h['beforeSha256']);self.assertEqual(sha(final[name]),h['afterSha256'])
                if name=='meta.json':continue
                a,b=flatten(json.loads(initial[name])),flatten(json.loads(final[name]))
                self.assertEqual([q['i'] for q in a],[q['i'] for q in b])
                expected={q['id'] for q in ledger['questions'] if ('sample/'+Path(q['storageFile']).name if name.startswith('sample/') and q['inSample'] else Path(q['storageFile']).name)==name}
                self.assertEqual({q['i'] for q,r in zip(a,b) if q!=r},expected)
                if name=='supuestos.json':
                    self.assertEqual(len(a),417)
                    self.assertEqual(next(q for q in b if q['i']=='L2025A-S1-R-02')['np'],1)
                    old,new=json.loads(initial[name]),json.loads(final[name]);self.assertEqual(list(old),list(new))
                    for sid in old:self.assertEqual({k:v for k,v in old[sid].items() if k!='q'},{k:v for k,v in new[sid].items() if k!='q'})
            (folder/'meta.json').write_bytes(initial['meta.json']+b' ')
            dirty=snapshot();self.assertIn('Deriva externa',run('--apply').stderr);self.assertEqual(snapshot(),dirty)
            (folder/'meta.json').write_bytes(initial['meta.json'])
            # Resume a partially replaced topic while other files remain at before.
            first=next(n for n in ledger['files'] if n!='meta.json')
            (folder/first).write_bytes(final[first])
            partial=sum(1 for q in ledger['questions'] if Path(q['storageFile']).name==first)
            ok('--apply',total-partial);self.assertEqual(snapshot(),final);ok('--apply',0)
            ok('--rollback',total)
            # Even a sample failure must be detected before any data writes.
            symlink='sample/'+next(iter(ledger['sampleFiles'])) if sample_count else first
            (folder/symlink).unlink();(folder/symlink).symlink_to(folder/'meta.json')
            dirty=snapshot();self.assertIn('copia ordinaria',run('--apply').stderr);self.assertEqual(snapshot(),dirty)

    def test_development11(self):self.check_batch(BATCHES[0],11,4,0)
    def test_systems20_with_one_sample(self):self.check_batch(BATCHES[1],20,11,1)

    def test_chain_preserves_prior340_and_release_original_fingerprints(self):
        with tempfile.TemporaryDirectory() as tmp:
            folder=copy_release_boundary(Path(tmp),BATCHES[0])
            # Boundary is after development11; its predecessors remain exact.
            eligible=0
            for ledger_path in EDITORIAL.glob('reviewed-*.json'):
                if ledger_path.stem in ORDER[ORDER.index(BATCHES[0]):]:continue
                ledger=json.loads(ledger_path.read_text())
                for q in ledger if isinstance(ledger,list) else ledger['questions']:
                    topic=q.get('topic','T4.07' if ledger_path.stem=='reviewed-T4.07' else 'T3.08')
                    file=Path(q.get('storageFile',topic+'.json')).name
                    target=folder/file if (folder/file).exists() else ROOT/'public/data'/file
                    actual=next(r for r in flatten(json.loads(target.read_text())) if r['i']==q['id'])
                    self.assertEqual(sha(encode(actual)),q['afterSha256'],q['id'])
                    eligible+=actual.get('np')!=1
            self.assertEqual(eligible,340)
        # These immutable source hashes belong to reconstruction; approval changes
        # must not become source-build fingerprints.
        release=json.loads((EDITORIAL/'release.json').read_text())
        for batch in BATCHES:
            self.assertIn('scripts/bank-editorial/'+batch+'.json',release['editorialEvidence'])
        self.assertNotEqual(release['files']['supuestos.json']['approvedSha256'],release['files']['supuestos.json']['sourceBuildSha256'])
