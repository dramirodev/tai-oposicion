"""Follow-up evidence and exact reversible bank/sample compatibility."""
import hashlib
import importlib.util
import json
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest
from historical_bank import copy_release_boundary

ROOT = Path(__file__).resolve().parents[2]
EDITORIAL = ROOT/'scripts/bank-editorial'
LEDGER = json.loads((EDITORIAL/'reviewed-followup.json').read_text())
encode = lambda value: json.dumps(value,ensure_ascii=False,separators=(',',':')).encode()
sha = lambda data: hashlib.sha256(data).hexdigest()


class FollowupTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.historical = tempfile.TemporaryDirectory()
        cls.addClassCleanup(cls.historical.cleanup)
        cls.boundary = copy_release_boundary(Path(cls.historical.name), 'reviewed-followup')

    def test_complete_evidence_and_exact_scope(self):
        self.assertEqual(len(LEDGER['questions']),36)
        self.assertEqual(len({q['id'] for q in LEDGER['questions']}),36)
        self.assertEqual(sum(q['priority']=='P0' for q in LEDGER['questions']),31)
        self.assertEqual(sum(q['inSample'] for q in LEDGER['questions']),2)
        previous = json.loads((EDITORIAL/'reviewed-19.json').read_text())
        self.assertFalse({q['id'] for q in previous['questions']} & {q['id'] for q in LEDGER['questions']})
        for name,info in LEDGER['files'].items():
            raw=(self.boundary/name).read_bytes()
            self.assertEqual(sha(raw),info['afterSha256'])
            after=json.loads(raw);before=json.loads(raw)
            if name == 'meta.json':
                self.assertEqual(set(after),set(before))
                for edit in LEDGER['metadataEdits']:
                    self.assertEqual(after[edit['id']],edit['after'])
                    self.assertEqual(edit['before'][:2]+edit['before'][3:],edit['after'][:2]+edit['after'][3:])
                    before[edit['id']]=edit['before']
                self.assertEqual(after.get('_by'),before.get('_by'))
            else:
                by_id={q['i']:i for i,q in enumerate(after)}
                self.assertEqual(len(by_id),len(after))
                for q in LEDGER['questions']:
                    if q['topic']+'.json' != name:continue
                    self.assertEqual(after[by_id[q['id']]],q['after'])
                    before[by_id[q['id']]]=q['before']
                self.assertEqual([q['i'] for q in after],[q['i'] for q in before])
            self.assertEqual(sha(encode(before)+raw[len(raw.rstrip()):]),info['beforeSha256'])
        for q in LEDGER['questions']:
            with self.subTest(q=q['id']):
                self.assertEqual(sha(encode(q['before'])),q['beforeSha256'])
                self.assertEqual(sha(encode(q['after'])),q['afterSha256'])
                self.assertEqual(len(q['after']['a']),4)
                self.assertEqual(len(set(q['after']['a'])),4)
                self.assertIn(q['after']['c'],range(4))
                self.assertEqual(len(q['reviewedOptions']),4)
                self.assertTrue(all(q['reviewedOptions']))
                metadata=json.loads((self.boundary/'meta.json').read_text())
                self.assertEqual(metadata[q['id']][2],q['after']['k'])
                ref=q['reference'];self.assertRegex(ref['sha256'],r'^[a-f0-9]{64}$')
                self.assertTrue(ref['page']>0 and ref['quote'])
                self.assertEqual(q['after']['u'],f"{ref['quote']} [p. {ref['page']}]")
                if q['inSample']:
                    sample=json.loads((self.boundary/'sample'/(q['topic']+'.json')).read_text())
                    self.assertEqual(next(x for x in sample if x['i']==q['id']),q['after'])

    def test_independent_execution_examples(self):
        spec=importlib.util.spec_from_file_location('followup_oracle',Path(__file__).with_name('followup')/'check.py')
        module=importlib.util.module_from_spec(spec);spec.loader.exec_module(module)
        answers=module.check()
        self.assertEqual(len(answers),15)
        questions={q['id']:q for q in LEDGER['questions']}
        for identifier,answer in answers.items():
            self.assertEqual(questions[identifier]['after']['c'],answer,identifier)

    def test_replay_and_rollback_include_samples_and_reject_drift(self):
        with tempfile.TemporaryDirectory() as temp:
            folder=Path(temp);(folder/'sample').mkdir()
            files={name:info for name,info in LEDGER['files'].items()}
            files.update({'sample/'+name:info for name,info in LEDGER['sampleFiles'].items()})
            for name in files:
                src=self.boundary/name
                shutil.copyfile(src,folder/name)
            def run(mode):return subprocess.run([sys.executable,str(EDITORIAL/'replay.py'),'--batch','reviewed-followup','--candidate-dir',temp,'--include-sample',mode],capture_output=True,text=True)
            def fingerprints():return {n:sha((folder/n).read_bytes()) for n in files}
            approved=fingerprints()
            self.assertEqual(approved,{n:x['afterSha256'] for n,x in files.items()})
            self.assertTrue(run('--rollback').stdout.startswith('38 '))
            self.assertEqual(fingerprints(),{n:x['beforeSha256'] for n,x in files.items()})
            self.assertTrue(run('--rollback').stdout.startswith('0 '))
            name=list(files)[-1];original=(folder/name).read_bytes();(folder/name).write_bytes(original+b' ')
            dirty=fingerprints();self.assertIn('Deriva externa',run('--apply').stderr);self.assertEqual(fingerprints(),dirty)
            (folder/name).write_bytes(original)
            self.assertTrue(run('--apply').stdout.startswith('38 '))
            self.assertEqual(fingerprints(),approved)
            self.assertTrue(run('--apply').stdout.startswith('0 '))
            # Simulate a crash after one topic; accepted before/after hashes recover deterministically.
            self.assertTrue(run('--rollback').stdout.startswith('38 '))
            first=next(iter(LEDGER['files']));shutil.copyfile(self.boundary/first,folder/first)
            self.assertEqual(run('--apply').returncode,0)
            self.assertEqual(fingerprints(),approved)
            target=folder/name;target.unlink();target.symlink_to(folder/first)
            self.assertIn('Falta una copia ordinaria',run('--rollback').stderr)
