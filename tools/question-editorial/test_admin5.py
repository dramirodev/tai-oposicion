"""Five documented repairs: exact replay, preservation, and bounded real oracles.

Linux dpkg reads only a private status fixture; no installation, package network,
production database or server configuration is used. Other products are supported
by the documented primary sources, not claimed as locally executed runtimes.
"""
import hashlib
import json
import os
from pathlib import Path
import shlex
import shutil
import subprocess
import sys
import tempfile
import unittest
from historical_bank import ROOT, EDITORIAL, ORDER, copy_release_boundary

LEDGER = json.loads((EDITORIAL/'reviewed-admin5.json').read_text())
ROWS = {q['id']:q for q in LEDGER['questions']}
def sha(b): return hashlib.sha256(b).hexdigest()
def encode(v): return json.dumps(v,ensure_ascii=False,separators=(',',':')).encode()
def rows(name, data):
    value = json.loads(data)
    return [q for s in value.values() for q in s['q']] if name == 'supuestos.json' else value


class Admin5Tests(unittest.TestCase):
    def test_exact_replay_context_and_preflight(self):
        self.assertEqual(len(ROWS),5)
        self.assertEqual(LEDGER['metadataEdits'],[])
        self.assertEqual(LEDGER['sampleFiles'],{})
        with tempfile.TemporaryDirectory() as tmp:
            folder = copy_release_boundary(Path(tmp),'reviewed-admin5')
            snapshot = lambda:{n:(folder/n).read_bytes() for n in LEDGER['files']}
            final = snapshot()
            def run(mode):
                return subprocess.run([sys.executable,str(EDITORIAL/'replay.py'),'--candidate-dir',tmp,
                                       '--batch','reviewed-admin5',mode],capture_output=True,text=True)
            def ok(mode,count):
                p = run(mode)
                self.assertEqual(p.returncode,0,p.stderr)
                self.assertEqual(p.stdout,f'{count} preguntas modificadas.\n')
            ok('--rollback',5)
            initial = snapshot()
            ok('--rollback',0)
            for name, hashes in LEDGER['files'].items():
                self.assertEqual(sha(initial[name]),hashes['beforeSha256'])
                self.assertEqual(sha(final[name]),hashes['afterSha256'])
                old,new = rows(name,initial[name]),rows(name,final[name])
                self.assertEqual([q['i'] for q in old],[q['i'] for q in new])
                changed = {b['i'] for b,a in zip(old,new) if b != a}
                expected = {q['id'] for q in ROWS.values() if Path(q['storageFile']).name == name}
                self.assertEqual(changed,expected)
                for b,a in zip(old,new):
                    if b['i'] not in expected:
                        continue
                    entry = ROWS[b['i']]
                    self.assertEqual((b,a),(entry['before'],entry['after']))
                    self.assertEqual(sha(encode(b)),entry['beforeSha256'])
                    self.assertEqual(sha(encode(a)),entry['afterSha256'])
                    for key in ['i','t','o','c','k','x','d','f','v','s','y','r','w','np','p']:
                        self.assertEqual(a.get(key),b.get(key),key)
                    self.assertEqual(len(set(a['a'])),4)
                    self.assertEqual(len(entry['reviewedOptions']),4)
                    self.assertTrue(all(entry['reviewedOptions']))
                    ref = entry['reference']
                    self.assertEqual(a['u'],f"{ref['quote']} [p. {ref['page']}]")
                    self.assertRegex(ref['sha256'],r'^[a-f0-9]{64}$')
                    self.assertTrue(entry['primary'])
                if name == 'supuestos.json':
                    self.assertEqual(len(new),417)
                    oldcases,newcases = json.loads(initial[name]),json.loads(final[name])
                    self.assertEqual(list(oldcases),list(newcases))
                    for sid in oldcases:
                        self.assertEqual({k:v for k,v in oldcases[sid].items() if k != 'q'},
                                         {k:v for k,v in newcases[sid].items() if k != 'q'})
                    for e in (q for q in ROWS.values() if q.get('scenarioId')):
                        text = newcases[e['scenarioId']]['texto']
                        self.assertTrue(text)
                        self.assertEqual(text,e['context']['supTexto'])
                        self.assertEqual(sha(text.encode()),e['context']['contextSha256'])
                        for side in ['before','after']:
                            envelope = {'scenarioId':e['scenarioId'],'supTexto':text,'question':e[side]}
                            self.assertEqual(sha(encode(envelope)),e['context'][side+'ContextualSha256'])
            # Even a late file drift must abort before replacing the first file.
            (folder/'supuestos.json').write_bytes(initial['supuestos.json']+b' ')
            dirty = snapshot()
            self.assertNotEqual(run('--apply').returncode,0)
            self.assertEqual(snapshot(),dirty)
            (folder/'supuestos.json').write_bytes(initial['supuestos.json'])
            (folder/'T3.10.json').write_bytes(final['T3.10.json'])
            ok('--apply',4)
            self.assertEqual(snapshot(),final)
            ok('--apply',0)
            ok('--rollback',5)
            self.assertEqual(snapshot(),initial)
            ordinary = folder/'ordinary.json'
            (folder/'supuestos.json').rename(ordinary)
            (folder/'supuestos.json').symlink_to(ordinary)
            dirty = snapshot()
            self.assertNotEqual(run('--apply').returncode,0)
            self.assertEqual(snapshot(),dirty)

    def test_all_previous408_and_study_only_php_preserved(self):
        checked = 0
        successors = ORDER[ORDER.index('reviewed-admin5'):]
        for path in EDITORIAL.glob('reviewed-*.json'):
            if path.stem in successors:
                continue
            ledger = json.loads(path.read_text())
            for e in ledger if isinstance(ledger,list) else ledger['questions']:
                topic = e.get('topic','T4.07' if path.stem == 'reviewed-T4.07' else 'T3.08')
                name = Path(e.get('storageFile',topic+'.json')).name
                actual = next(q for q in rows(name,(ROOT/'public/data'/name).read_bytes()) if q['i'] == e['id'])
                self.assertEqual(sha(encode(actual)),e['afterSha256'],e['id'])
                checked += 1
        self.assertEqual(checked,409)
        php = next(q for q in json.loads((ROOT/'public/data/T3.03.json').read_text()) if q['i'] == 'GEN-T3.03-48')
        self.assertEqual((php['np'],php['w']),(1,1))

    def test_actual_whitebox_result_checks_can_detect_defect(self):
        script = r'''
const exercise=bug=>{const visited=new Set();const f=x=>{if(x>=0){visited.add('nonnegative');return x+(bug?2:1);}visited.add('negative');return -x;};const actual=[1,-1].map(f);return {branches:[...visited],actual};};
process.stdout.write(JSON.stringify({good:exercise(false),bad:exercise(true)}));
'''
        p = subprocess.run(['node','-e',script],capture_output=True,text=True,check=True)
        value = json.loads(p.stdout)
        self.assertEqual(value['good']['branches'],['nonnegative','negative'])
        self.assertEqual(value['bad']['branches'],value['good']['branches'])
        self.assertEqual(value['good']['actual'],[2,1])
        self.assertEqual(value['bad']['actual'],[3,1])
        # This is a concrete counterexample, not proof that coverage is sufficient.
        self.assertIn('estructura interna',ROWS['GEN-T3.10-144.v2']['after']['a'][0])
        self.assertIn('discrepancy',ROWS['GEN-T3.10-144.v2'])

    @unittest.skipUnless(sys.platform.startswith('linux') and shutil.which('dpkg'),
                         'Actual Linux dpkg oracle runs in Ubuntu CI; unavailable on macOS')
    def test_actual_dpkg_installed_version_uses_private_status_database(self):
        command, grep = ROWS['L2018S-S2-13']['after']['a'][1].split(' | ')
        self.assertEqual(shlex.split(command),['dpkg','-s','nginx'])
        self.assertEqual(shlex.split(grep),['grep','^Version:'])
        with tempfile.TemporaryDirectory() as tmp:
            status = Path(tmp)/'status'
            status.write_text('Package: nginx\nStatus: install ok installed\nPriority: optional\n'
                              'Section: httpd\nInstalled-Size: 1\nMaintainer: Fixture <fixture@example.test>\n'
                              'Architecture: all\nVersion: 1.2.3-1\nDescription: isolated query fixture\n\n')
            before = status.read_bytes()
            env = {**os.environ,'DPKG_ADMINDIR':tmp,'LC_ALL':'C','DPKG_COLORS':'never'}
            result = subprocess.run(shlex.split(command),env=env,capture_output=True,text=True,check=True)
            selected = subprocess.run(shlex.split(grep),input=result.stdout,capture_output=True,text=True,check=True)
            self.assertEqual(selected.stdout,'Version: 1.2.3-1\n')
            self.assertEqual(status.read_bytes(),before)
