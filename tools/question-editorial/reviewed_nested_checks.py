"""Shared assertions for mixed-storage editorial release boundaries (offline)."""
import hashlib
import json
from pathlib import Path
import subprocess
import sys
import tempfile
from historical_bank import ROOT, EDITORIAL, copy_release_boundary


def check_batch(test, batch, count, nested_count, metadata_count):
    ledger=json.loads((EDITORIAL/(batch+'.json')).read_text())
    test.assertEqual(len(ledger['questions']),count)
    test.assertEqual(len(ledger['metadataEdits']),metadata_count)
    test.assertEqual(ledger['sampleFiles'],{})
    sha=lambda b:hashlib.sha256(b).hexdigest()
    encode=lambda x:json.dumps(x,ensure_ascii=False,separators=(',',':')).encode()
    with tempfile.TemporaryDirectory() as temporary:
        folder=copy_release_boundary(Path(temporary),batch)
        names=ledger['files']
        snapshot=lambda:{n:(folder/n).read_bytes() for n in names}
        after=snapshot()
        nested=[q for q in ledger['questions'] if q.get('storageFile')=='public/data/supuestos.json']
        test.assertEqual(len(nested),nested_count)
        for q in nested:
            context=q['context']
            test.assertEqual(context['supTexto'],'')
            test.assertEqual(context['contextSha256'],sha(b''))
            for side in ('before','after'):
                envelope={'scenarioId':q['scenarioId'],'supTexto':context['supTexto'],'question':q[side]}
                test.assertEqual(sha(encode(envelope)),context[side+'ContextualSha256'])
                runtime=json.dumps({**q[side],'supTexto':context['supTexto']},sort_keys=True,ensure_ascii=False,separators=(',',':')).encode()
                test.assertNotEqual(sha(runtime),q[side+'Sha256'])
                test.assertNotEqual(sha(runtime),context[side+'ContextualSha256'])
        def rows(data,name):
            value=json.loads(data[name])
            return [q for case in value.values() for q in case['q']] if name=='supuestos.json' else value
        for q in ledger['questions']:
            name=Path(q.get('storageFile',q['topic']+'.json')).name
            test.assertEqual(next(r for r in rows(after,name) if r['i']==q['id']),q['after'])
            for side in ('before','after'):test.assertEqual(sha(encode(q[side])),q[side+'Sha256'])
            test.assertEqual(len(q['after']['a']),4)
            test.assertEqual(len(q['reviewedOptions']),4)
            test.assertTrue(all(isinstance(r,str) and r.strip() for r in q['reviewedOptions']))
            ref=q['reference'];test.assertEqual(q['after']['u'],f"{ref['quote']} [p. {ref['page']}]")
            test.assertRegex(ref['sha256'],r'^[a-f0-9]{64}$')
            test.assertTrue(ref['pdf'].startswith('01_Temario/'))
            test.assertTrue(q['primary']);test.assertFalse(q['inSample'])
            for sample in (ROOT/'public/sample').glob('T*.json'):
                test.assertNotIn(q['id'],{r['i'] for r in json.loads(sample.read_text())})
        for e in ledger['metadataEdits']:
            test.assertEqual(e['index'],2)
            test.assertEqual(e['before'][:2]+e['before'][3:],e['after'][:2]+e['after'][3:])
            test.assertEqual(json.loads(after['meta.json'])[e['id']][2],e['after'][2])
        def run(mode,expected):
            p=subprocess.run([sys.executable,str(EDITORIAL/'replay.py'),'--candidate-dir',temporary,'--batch',batch,'--include-sample',mode],capture_output=True,text=True)
            test.assertEqual(p.returncode,0,p.stderr);test.assertEqual(p.stdout,f'{expected} preguntas modificadas.\n')
        run('--rollback',count);before=snapshot();run('--rollback',0)
        for name,h in names.items():
            test.assertEqual(sha(before[name]),h['beforeSha256']);test.assertEqual(sha(after[name]),h['afterSha256'])
            if name=='meta.json':continue
            old,new=rows(before,name),rows(after,name)
            test.assertEqual([q['i'] for q in old],[q['i'] for q in new])
            actual={a['i'] for a,b in zip(old,new) if a!=b}
            expected={q['id'] for q in ledger['questions'] if Path(q.get('storageFile',q['topic']+'.json')).name==name}
            test.assertEqual(actual,expected)
            if name=='supuestos.json':
                test.assertEqual(len(old),417)
                oldcases,newcases=json.loads(before[name]),json.loads(after[name])
                test.assertEqual(list(oldcases),list(newcases))
                for sid in oldcases:
                    test.assertEqual({k:v for k,v in oldcases[sid].items() if k!='q'},{k:v for k,v in newcases[sid].items() if k!='q'})
                for official in (q for q in old if q['i'].startswith('L2025')):
                    test.assertEqual(official,next(q for q in new if q['i']==official['i']))
                test.assertEqual(next(q for q in new if q['i']=='L2025A-S1-R-02')['np'],1)
        run('--apply',count);test.assertEqual(snapshot(),after);run('--apply',0)
