"""Reviewed web25: exact replay and explicit documentary/runtime limits."""
import hashlib
import json
from pathlib import Path
import subprocess
import sys
import tempfile
import unittest
from historical_bank import copy_release_boundary
ROOT=Path(__file__).resolve().parents[2]
EDITORIAL=ROOT/'scripts/bank-editorial'
BATCH='reviewed-web25'
LEDGER=json.loads((EDITORIAL/(BATCH+'.json')).read_text())
QUESTIONS={q['id']:q for q in LEDGER['questions']}
def sha(b):return hashlib.sha256(b).hexdigest()
def encode(x):return json.dumps(x,ensure_ascii=False,separators=(',',':')).encode()
class Web25Tests(unittest.TestCase):
    def test_full_rows_types_sources_and_samples(self):
        self.assertEqual(len(QUESTIONS), 25)
        self.assertEqual(set(LEDGER['files']), {'T3.08.json','meta.json'})
        self.assertEqual(len(LEDGER['metadataEdits']), 16)
        self.assertEqual(LEDGER['sampleFiles'], {})
        meta=json.loads((ROOT/'public/data/meta.json').read_text())
        for q in QUESTIONS.values():
            rows=json.loads((ROOT/'public/data'/(q['topic']+'.json')).read_text())
            row=next(r for r in rows if r['i']==q['id'])
            self.assertEqual(row,q['after'])
            self.assertEqual(len(set(row['a'])),4)
            self.assertEqual(len(q['reviewedOptions']),4)
            self.assertTrue(all(isinstance(s,str) and s for s in q['reviewedOptions']))
            self.assertTrue(q['primary'])
            self.assertEqual(meta[q['id']][2],row['k'])
            ref=q['reference'];self.assertEqual(row['u'],f"{ref['quote']} [p. {ref['page']}]")
            self.assertTrue(ref['pdf'].startswith('01_Temario/'))
            for side in ('before','after'):self.assertEqual(sha(encode(q[side])),q[side+'Sha256'])
            samples=json.loads((ROOT/'public/sample'/(q['topic']+'.json')).read_text())
            self.assertNotIn(q['id'],{s['i'] for s in samples})
        for e in LEDGER['metadataEdits']:
            self.assertEqual(e['index'],2)
            self.assertEqual(e['before'][:2]+e['before'][3:],e['after'][:2]+e['after'][3:])
            for side in ('before','after'):self.assertEqual(sha(encode(e[side])),e[side+'Sha256'])

    def test_replay_boundary_idempotence_drift_and_symlink(self):
        with tempfile.TemporaryDirectory() as temporary:
            folder=copy_release_boundary(Path(temporary),BATCH)
            snapshot=lambda:{n:(folder/n).read_bytes() for n in LEDGER['files']}
            original=snapshot()
            def run(mode):return subprocess.run([sys.executable,str(EDITORIAL/'replay.py'),'--candidate-dir',temporary,'--batch',BATCH,'--include-sample',mode],capture_output=True,text=True)
            def success(mode,count):
                result=run(mode);self.assertEqual(result.returncode,0,result.stderr);self.assertEqual(result.stdout,f'{count} preguntas modificadas.\n')
            success('--rollback',25);before=snapshot()
            for n,h in LEDGER['files'].items():
                self.assertEqual(sha(before[n]),h['beforeSha256']);self.assertEqual(sha(original[n]),h['afterSha256'])
            for n in LEDGER['files']:
                if n=='meta.json':continue
                old,new=json.loads(before[n]),json.loads(original[n])
                self.assertEqual([q['i'] for q in old],[q['i'] for q in new])
                self.assertEqual({a['i'] for a,b in zip(old,new) if a!=b},{q['id'] for q in QUESTIONS.values() if q['topic']+'.json'==n})
            success('--rollback',0)
            (folder/'meta.json').write_bytes(before['meta.json']+b' ')
            dirty=snapshot();self.assertIn('Deriva externa',run('--apply').stderr);self.assertEqual(snapshot(),dirty)
            (folder/'meta.json').write_bytes(before['meta.json'])
            success('--apply',25);self.assertEqual(snapshot(),original);success('--apply',0)
            success('--rollback',25)
            topic=next(n for n in LEDGER['files'] if n!='meta.json')
            (folder/topic).unlink();(folder/topic).symlink_to(folder/'meta.json')
            self.assertIn('Falta una copia ordinaria',run('--apply').stderr)
            self.assertEqual((folder/'meta.json').read_bytes(),before['meta.json'])

    def test_python_slice_and_json_four_alternatives(self):
        q=QUESTIONS['AT308-P1-68']['after']
        result=subprocess.check_output([sys.executable,'-c','a=list("confidencial");print(a[:-9])'],text=True).strip()
        self.assertEqual([result==a for a in q['a']],[True,False,False,False])
        q=QUESTIONS['AS08B-P1-R-03']['after'];valid=[]
        for a in q['a']:
            try:v=json.loads(a);valid.append(isinstance(v,list) and all(isinstance(x,str) for x in v))
            except ValueError:valid.append(False)
        self.assertEqual(valid,[True,False,False,False])
        self.assertNotIn('APK',QUESTIONS['AT308-P1-87']['after']['q'])
        # PHP and browser semantics are documentary: no substituted runtime.

    def test_javascript_scope_with_real_node(self):
        script = '''const assert=require('node:assert/strict');
assert.equal((function(){var local=3;return local})(),3);
assert.throws(()=>Function('"use strict";{let local=3;}return local;')(),ReferenceError);
const object={x:1};object.x=2;assert.equal(object.x,2);
assert.throws(()=>Function('var 1x=2'),SyntaxError);
'''
        result=subprocess.run(['node','-e',script],capture_output=True,text=True)
        self.assertEqual(result.returncode,0,result.stderr)
        self.assertEqual(QUESTIONS['AT308-P1-76']['after']['c'],1)
