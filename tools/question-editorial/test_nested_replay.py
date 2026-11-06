"""Nested transport replay; no runtime-proof hash substitution or external PDFs."""
import copy
import hashlib
import importlib.util
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

ROOT = Path(__file__).resolve().parents[2]
spec = importlib.util.spec_from_file_location('nested_replay', ROOT/'scripts/bank-editorial/replay.py')
replay = importlib.util.module_from_spec(spec)
spec.loader.exec_module(replay)


def digest(data):
    return hashlib.sha256(data).hexdigest()


def row(id, scenario, answer=0):
    return {'i': id, 't': 'T3.06', 's': scenario, 'q': 'Example?', 'a': ['A','B','C','D'], 'c': answer}


class NestedReplayTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.base = Path(self.temp.name)
        self.folder = self.base/'candidate'; self.folder.mkdir()
        self.ledgers = self.base/'ledgers'; self.ledgers.mkdir()
        self.a = row('Q-A','CASE-A'); self.b = row('Q-B','CASE-B')
        self.before = {'CASE-A': {'conv':'exam','texto':'','q':[self.a, row('KEEP-A','CASE-A')]},
                       'CASE-B': {'conv':'other','texto':'Keep accents á and whitespace.\n','q':[self.b]},
                       'OFFICIAL': {'conv':'official','texto':'original','q':[dict(row('VOID','OFFICIAL'),np=1)]}}
        self.after = copy.deepcopy(self.before)
        self.after['CASE-A']['q'][0]['c']=2
        self.after['CASE-B']['q'][0]['n']='Explanation'
        questions=[]
        for scenario,id in [('CASE-A','Q-A'),('CASE-B','Q-B')]:
            old=self.before[scenario]['q'][0];new=self.after[scenario]['q'][0];text=self.before[scenario]['texto']
            context={'scenarioId':scenario,'storageFile':'public/data/supuestos.json','supTexto':text,
                     'contextSha256':digest(text.encode())}
            for side,value in [('before',old),('after',new)]:
                context[side+'ContextualSha256']=replay.sha256({'scenarioId':scenario,'supTexto':text,'question':value})
            questions.append({'id':id,'topic':'T3.06','storageFile':'public/data/supuestos.json',
                 'scenarioId':scenario,'before':old,'after':new,'beforeSha256':replay.sha256(old),
                 'afterSha256':replay.sha256(new),'context':context})
        self.raw_before=replay.encode(self.before)+b'\n'
        self.raw_after=replay.encode(self.after)+b'\n'
        self.meta_before={'Q-A':['T3.06','A','D',[],0]}
        self.meta_after={'Q-A':['T3.06','A','K',[],0]}
        self.ledger={'questions':questions,'metadataEdits':[{'id':'Q-A','topic':'T3.06',
          'before':self.meta_before['Q-A'],'after':self.meta_after['Q-A'],
          'beforeSha256':replay.sha256(self.meta_before['Q-A']),'afterSha256':replay.sha256(self.meta_after['Q-A'])}],
          'files':{'supuestos.json':{'beforeSha256':digest(self.raw_before),'afterSha256':digest(self.raw_after)},
                   'meta.json':{'beforeSha256':digest(replay.encode(self.meta_before)),'afterSha256':digest(replay.encode(self.meta_after))}},'sampleFiles':{}}
        self.reset()
        self.addCleanup(patch.stopall)
        patch.object(replay,'HERE',self.ledgers).start()
        patch.dict(replay.REVIEWED_BATCHES,{'fixture':'fixture.json'}).start()

    def reset(self):
        (self.folder/'supuestos.json').write_bytes(self.raw_before)
        (self.folder/'meta.json').write_bytes(replay.encode(self.meta_before))

    def run_replay(self,reverse=False):
        (self.ledgers/'fixture.json').write_text(json.dumps(self.ledger))
        return replay.replay(self.folder,reverse,'fixture')

    def snapshot(self):
        return {p.name:p.read_bytes() for p in self.folder.iterdir() if p.is_file()}

    def test_forward_rollback_idempotence_preserves_all_context_and_official(self):
        self.assertEqual(self.run_replay(),2)
        self.assertEqual((self.folder/'supuestos.json').read_bytes(),self.raw_after)
        actual=json.loads((self.folder/'supuestos.json').read_bytes())
        self.assertEqual(list(actual),list(self.before))
        self.assertEqual(actual['OFFICIAL'],self.before['OFFICIAL'])
        for id in actual:
            self.assertEqual(actual[id]['texto'],self.before[id]['texto'])
            self.assertEqual([q['i'] for q in actual[id]['q']],[q['i'] for q in self.before[id]['q']])
        self.assertEqual(self.run_replay(),0)
        self.assertEqual(self.run_replay(True),2)
        self.assertEqual((self.folder/'supuestos.json').read_bytes(),self.raw_before)
        self.assertEqual(self.run_replay(True),0)

    def test_all_preflight_before_write_and_partial_files_resume(self):
        (self.folder/'meta.json').write_bytes(b'{}')
        before=self.snapshot()
        with self.assertRaisesRegex(ValueError,'Deriva externa'):self.run_replay()
        self.assertEqual(self.snapshot(),before)
        self.reset()
        (self.folder/'supuestos.json').write_bytes(self.raw_after)
        self.assertEqual(self.run_replay(),0)
        self.assertEqual(json.loads((self.folder/'meta.json').read_bytes()),self.meta_after)
        self.assertEqual(self.run_replay(True),2)
        self.assertEqual((self.folder/'supuestos.json').read_bytes(),self.raw_before)

    def test_context_location_and_hash_guards_even_when_already_applied(self):
        self.run_replay()
        saved=copy.deepcopy(self.ledger)
        mutations=[lambda q:q.update(scenarioId='CASE-B'),
                   lambda q:q.update(storageFile='public/data/T3.06.json'),
                   lambda q:q['context'].update(supTexto='changed'),
                   lambda q:q['context'].update(contextSha256='0'*64),
                   lambda q:q['context'].update(scenarioId='CASE-B'),
                   lambda q:q['context'].update(storageFile='public/data/other.json'),
                   lambda q:q['context'].pop('supTexto'),
                   lambda q:q['context'].update(afterContextualSha256='0'*64),
                   lambda q:q['after'].update(s='CASE-B'),
                   lambda q:q['after'].update(supTexto='')]
        for mutate in mutations:
            with self.subTest(mutation=mutate):
                self.ledger=copy.deepcopy(saved);mutate(self.ledger['questions'][0]);before=self.snapshot()
                with self.assertRaises((ValueError,KeyError)):self.run_replay()
                self.assertEqual(self.snapshot(),before)

    def test_duplicate_ids_in_catalog_or_ledger_and_context_drift(self):
        before=self.snapshot();self.ledger['questions'].append(copy.deepcopy(self.ledger['questions'][0]))
        with self.assertRaisesRegex(ValueError,'duplicados'):self.run_replay()
        self.assertEqual(before,self.snapshot());self.ledger['questions'].pop()
        for mutation in ('duplicate','context'):
            data=copy.deepcopy(self.before)
            if mutation=='duplicate':data['CASE-B']['q'].append(dict(self.a,s='CASE-B'))
            else:data['CASE-A']['texto']='drift'
            raw=replay.encode(data);(self.folder/'supuestos.json').write_bytes(raw)
            # Rebased file hashes must not bypass individual context or uniqueness checks.
            self.ledger['files']['supuestos.json']['beforeSha256']=digest(raw)
            before=self.snapshot()
            with self.assertRaises(ValueError):self.run_replay()
            self.assertEqual(before,self.snapshot())

    def test_symlink_and_transport_runtime_hash_are_distinct(self):
        external=self.base/'untouched.json';external.write_bytes(self.raw_before)
        (self.folder/'supuestos.json').unlink();(self.folder/'supuestos.json').symlink_to(external)
        with self.assertRaisesRegex(ValueError,'copia ordinaria'):self.run_replay()
        self.assertEqual(external.read_bytes(),self.raw_before)
        q=self.ledger['questions'][0]
        runtime=json.dumps({**q['after'],'supTexto':''},sort_keys=True,ensure_ascii=False,separators=(',',':')).encode()
        self.assertNotEqual(digest(runtime),q['afterSha256'])
        self.assertNotEqual(digest(runtime),q['context']['afterContextualSha256'])


class CheckedInReplayTests(unittest.TestCase):
    def test_real_languages_web_chain_preserves_other_scenarios(self):
        from historical_bank import copy_release_boundary, citation_base
        with tempfile.TemporaryDirectory() as temporary:
            folder=copy_release_boundary(Path(temporary),'reviewed-web23')
            batches=('reviewed-languages17','reviewed-web23')
            ledgers={b:json.loads((replay.HERE/(b+'.json')).read_text()) for b in batches}
            names={n for ledger in ledgers.values() for n in ledger['files']}
            for name in names:
                if not (folder/name).exists():
                    (folder/name).write_bytes(citation_base(name, (ROOT/'public/data'/name).read_bytes()))
            snapshot=lambda:{n:(folder/n).read_bytes() for n in names}
            final=snapshot()
            for batch in reversed(batches):
                count=len(ledgers[batch]['questions'])
                self.assertEqual(replay.replay(folder,True,batch),count)
                self.assertEqual(replay.replay(folder,True,batch),0)
                for name,h in ledgers[batch]['files'].items():
                    self.assertEqual(digest((folder/name).read_bytes()),h['beforeSha256'])
            initial=snapshot()
            old,new=json.loads(initial['supuestos.json']),json.loads(final['supuestos.json'])
            self.assertEqual(list(old),list(new))
            expected={q['id'] for q in ledgers[batches[0]]['questions'] if q.get('storageFile')=='public/data/supuestos.json'}
            changed=set()
            for sid in old:
                self.assertEqual({k:v for k,v in old[sid].items() if k!='q'},
                                 {k:v for k,v in new[sid].items() if k!='q'})
                self.assertEqual([q['i'] for q in old[sid]['q']],[q['i'] for q in new[sid]['q']])
                changed.update(a['i'] for a,b in zip(old[sid]['q'],new[sid]['q']) if a!=b)
            self.assertEqual(changed,expected)
            self.assertEqual(len(changed),2)
            for batch in batches:
                self.assertEqual(replay.replay(folder,False,batch),len(ledgers[batch]['questions']))
                self.assertEqual(replay.replay(folder,False,batch),0)
            self.assertEqual(snapshot(),final)

    def test_legacy_registry_still_uses_sparse_patches(self):
        # Older ledgers are lists, not full-row reviewed envelopes.
        with tempfile.TemporaryDirectory() as temporary:
            base=Path(temporary);candidate=base/'candidate';candidate.mkdir()
            old={'i':'LEGACY','t':'T3.08','c':0};new=dict(old,c=1)
            (candidate/'T3.08.json').write_bytes(replay.encode([old]))
            (base/'legacy.json').write_text(json.dumps([{'id':'LEGACY','before':{'c':0},'after':{'c':1},
                'beforeSha256':replay.sha256(old),'afterSha256':replay.sha256(new)}]))
            with patch.object(replay,'HERE',base),patch.dict(replay.BATCHES,{'legacy':('T3.08.json','legacy.json')}):
                self.assertEqual(replay.replay(candidate,False,'legacy'),1)
                self.assertEqual(replay.replay(candidate,True,'legacy'),1)
                self.assertEqual((candidate/'T3.08.json').read_bytes(),replay.encode([old]))
