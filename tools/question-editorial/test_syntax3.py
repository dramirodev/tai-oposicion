"""Three source-backed syntax repairs: actual runtimes plus exact guarded replay.

No network, original PDFs, production data, credentials or model calls. chmod is
the host's real implementation: assertions cover both BSD and GNU behavior.
"""
import hashlib
import json
from pathlib import Path
import re
import shlex
import stat
import subprocess
import sys
import tempfile
import unittest
from historical_bank import ROOT, EDITORIAL, copy_release_boundary

LEDGER = json.loads((EDITORIAL / 'reviewed-syntax3.json').read_text())
ROWS = {q['id']: q for q in LEDGER['questions']}


class Syntax3Tests(unittest.TestCase):
    def test_exact_replay_rollback_and_preserved_records(self):
        self.assertEqual(set(ROWS), {'AS12B-S2-08', 'L2019-S1-08', 'L2025X-S1-04'})
        self.assertEqual(LEDGER['metadataEdits'], [])
        self.assertEqual(LEDGER['sampleFiles'], {})
        sha = lambda b: hashlib.sha256(b).hexdigest()
        encode = lambda v: json.dumps(v, ensure_ascii=False, separators=(',', ':')).encode()
        with tempfile.TemporaryDirectory() as tmp:
            folder = copy_release_boundary(Path(tmp), 'reviewed-syntax3')
            target = folder / 'supuestos.json'
            after = target.read_bytes()
            def run(mode, expected):
                p = subprocess.run([sys.executable, str(EDITORIAL / 'replay.py'), '--candidate-dir', tmp,
                                    '--batch', 'reviewed-syntax3', mode], capture_output=True, text=True)
                self.assertEqual(p.returncode, 0, p.stderr)
                self.assertEqual(p.stdout, f'{expected} preguntas modificadas.\n')
            run('--rollback', 3)
            before = target.read_bytes()
            run('--rollback', 0)
            self.assertEqual(sha(before), LEDGER['files']['supuestos.json']['beforeSha256'])
            self.assertEqual(sha(after), LEDGER['files']['supuestos.json']['afterSha256'])
            old, new = json.loads(before), json.loads(after)
            self.assertEqual(list(old), list(new))
            self.assertEqual(sum(len(s['q']) for s in new.values()), 417)
            changed = set()
            for sid in old:
                self.assertEqual({k:v for k,v in old[sid].items() if k != 'q'},
                                 {k:v for k,v in new[sid].items() if k != 'q'})
                self.assertEqual([q['i'] for q in old[sid]['q']], [q['i'] for q in new[sid]['q']])
                for a, b in zip(old[sid]['q'], new[sid]['q']):
                    if a != b:
                        changed.add(a['i'])
                        entry = ROWS[a['i']]
                        self.assertEqual((a, b), (entry['before'], entry['after']))
                        self.assertEqual({k:v for k,v in a.items() if k not in ('q','n','u')},
                                         {k:v for k,v in b.items() if k not in ('q','n','u')})
                        self.assertEqual(len(entry['reviewedOptions']), 4)
                        self.assertTrue(all(entry['reviewedOptions']))
                        ref = entry['reference']
                        self.assertEqual(b['u'], f"{ref['quote']} [p. {ref['page']}]")
                        context = entry['context']
                        self.assertEqual(context['supTexto'], new[sid]['texto'])
                        self.assertEqual(context['contextSha256'], sha(new[sid]['texto'].encode()))
                        for side, q in [('before', a), ('after', b)]:
                            self.assertEqual(sha(encode(q)), entry[side+'Sha256'])
                            envelope = {'scenarioId':sid, 'supTexto':new[sid]['texto'], 'question':q}
                            self.assertEqual(sha(encode(envelope)), context[side+'ContextualSha256'])
            self.assertEqual(changed, set(ROWS))
            self.assertEqual(sorted(len(q['context']['supTexto']) > 0 for q in ROWS.values()), [False,True,True])
            run('--apply', 3)
            self.assertEqual(target.read_bytes(), after)
            run('--apply', 0)

    def test_context_drift_and_symlink_rejected_before_writes(self):
        with tempfile.TemporaryDirectory() as tmp:
            folder = copy_release_boundary(Path(tmp), 'reviewed-syntax3')
            target = folder / 'supuestos.json'
            data = json.loads(target.read_text())
            data['L2019-S1']['texto'] += ' drift'
            target.write_text(json.dumps(data, ensure_ascii=False))
            def rejected():
                snapshot = target.read_bytes()
                p = subprocess.run([sys.executable, str(EDITORIAL / 'replay.py'), '--candidate-dir', tmp,
                                    '--batch', 'reviewed-syntax3', '--rollback'], capture_output=True, text=True)
                self.assertNotEqual(p.returncode, 0)
                self.assertEqual(target.read_bytes(), snapshot)
            rejected()
            ordinary = folder / 'ordinary.json'
            target.rename(ordinary)
            target.symlink_to(ordinary)
            rejected()

    def test_actual_javascript_parser_and_values(self):
        script = r'''
const {Script,runInNewContext}=require('node:vm');
const rows=JSON.parse(require('node:fs').readFileSync(0,'utf8'));
const functionCode=q=>q.match(/(?:Function|function) prueba\(\).*$/s)[0];
const body=q=>q.match(/const menuAdministrador = .*?; const menuGestor = .*?;/s)[0]+' '+q.match(/return \[.*?\]/s)[0];
const f=rows['L2019-S1-08'], a=rows['L2025X-S1-04'];
const invalid=[];
for (const source of [functionCode(f.before.q), '(function(){'+body(a.before.q)+'})()']) {
 try {new Script(source);invalid.push(false);} catch(e){invalid.push(e.name==='SyntaxError');}
}
const value=runInNewContext(functionCode(f.after.q)+'; prueba();',{}, {timeout:1000});
const arrays=body(a.after.q);
const result=runInNewContext('(function(){'+arrays.replace('return ', 'const result=')+'; return {result,menuAdministrador,menuGestor};})()',{}, {timeout:1000});
process.stdout.write(JSON.stringify({invalid,value,...result}));
'''
        p = subprocess.run(['node', '-e', script], input=json.dumps(ROWS), text=True, capture_output=True, check=True)
        actual = json.loads(p.stdout)
        self.assertEqual(actual['invalid'], [True,True])
        f = ROWS['L2019-S1-08']['after']
        self.assertEqual([i for i,a in enumerate(f['a']) if int(a) == actual['value']], [f['c']])
        self.assertEqual(actual['value'], 9)
        self.assertEqual(actual['result'], actual['menuAdministrador'] + actual['menuGestor'])
        self.assertEqual(actual['menuAdministrador'], ['Usuarios','Permisos'])
        self.assertEqual(actual['menuGestor'], ['Notificaciones','Usuarios','Asientos registrales'])
        self.assertEqual(actual['result'].count('Usuarios'), 2)
        self.assertEqual(ROWS['L2025X-S1-04']['after']['c'], 3)

    def test_actual_typescript_compiler_on_ledger_literals(self):
        entry = ROWS['L2025X-S1-04']
        self.assertTrue(entry['after']['q'].startswith('Dentro de un método'))
        with tempfile.TemporaryDirectory() as tmp:
            folder = Path(tmp)
            (folder / 'types').mkdir()
            for side, succeeds in [('before',False), ('after',True)]:
                q = entry[side]['q']
                declarations = re.search(r'const menuAdministrador = .*?; const menuGestor = .*?;', q).group()
                expression = re.search(r'return \[.*?\]', q).group()
                source = folder / (side+'.ts')
                source.write_text('class Example { menu() { '+declarations+' '+expression+'; } }')
                p = subprocess.run(['node', str(ROOT/'node_modules/typescript/bin/tsc'), '--noEmit',
                                    '--target','ES2020','--strict','--skipLibCheck','--typeRoots',str(folder/'types'),str(source)],
                                   capture_output=True, text=True)
                self.assertEqual(p.returncode == 0, succeeds, p.stdout+p.stderr)
                if not succeeds:
                    self.assertIn('TS1127', p.stdout)

    def test_actual_chmod_unique_corrected_option(self):
        entry = ROWS['AS12B-S2-08']
        with tempfile.TemporaryDirectory() as tmp:
            target = Path(tmp) / 'test'
            target.write_text('isolated fixture')
            modes = {}
            for side in ('before','after'):
                target.chmod(0o641)
                command = re.search(r'comando (chmod .*? test) los permisos', entry[side]['q']).group(1)
                result = subprocess.run(shlex.split(command), cwd=tmp, capture_output=True, text=True)
                modes[side] = stat.filemode(target.stat().st_mode)
                if side == 'after':
                    self.assertEqual(result.returncode, 0, result.stderr)
                    self.assertEqual(stat.S_IMODE(target.stat().st_mode), 0o721)
            row = entry['after']
            self.assertNotIn(modes['before'], row['a'])
            self.assertEqual([i for i,a in enumerate(row['a']) if a == modes['after']], [row['c']])

    def test_all_405_previous_repairs_and_php_unchanged(self):
        checked = 0
        for path in EDITORIAL.glob('reviewed-*.json'):
            if path.stem == 'reviewed-syntax3':
                continue
            ledger = json.loads(path.read_text())
            for q in ledger if isinstance(ledger, list) else ledger['questions']:
                topic = q.get('topic', 'T4.07' if path.stem == 'reviewed-T4.07' else 'T3.08')
                data = json.loads((ROOT/q.get('storageFile', 'public/data/'+topic+'.json')).read_text())
                records = [r for s in data.values() for r in s['q']] if isinstance(data, dict) else data
                actual = next(r for r in records if r['i'] == q['id'])
                digest = hashlib.sha256(json.dumps(actual,ensure_ascii=False,separators=(',',':')).encode()).hexdigest()
                self.assertEqual(digest, q['afterSha256'], q['id'])
                checked += 1
        self.assertEqual(checked, 406)
