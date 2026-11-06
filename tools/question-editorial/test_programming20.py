"""Programming20: immutable full-row replay plus portable C/C++ regressions.

Jakarta and the two historical attributions are documentary checks, not SDK
executions. These tests need neither Drive PDFs nor network access.
"""
import hashlib
import json
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest
from historical_bank import copy_release_boundary

ROOT = Path(__file__).resolve().parents[2]
EDITORIAL = ROOT / 'scripts/bank-editorial'
LEDGER = json.loads((EDITORIAL / 'reviewed-programming20.json').read_text())
QUESTIONS = {q['id']: q for q in LEDGER['questions']}


def encode(value):
    return json.dumps(value, ensure_ascii=False, separators=(',', ':')).encode()


def sha(value):
    return hashlib.sha256(value).hexdigest()


class Programming20Tests(unittest.TestCase):
    def test_scope_evidence_and_only_seven_catalog_types(self):
        self.assertEqual(len(QUESTIONS), 20)
        self.assertEqual(set(LEDGER['files']), {'T3.06.json', 'meta.json'})
        self.assertEqual(LEDGER['sampleFiles'], {})
        self.assertEqual(len(LEDGER['metadataEdits']), 7)
        rows = json.loads((ROOT/'public/data/T3.06.json').read_text())
        by_id = {r['i']: r for r in rows}
        self.assertEqual(len(rows), len(by_id))
        samples = json.loads((ROOT/'public/sample/T3.06.json').read_text())
        self.assertFalse(set(QUESTIONS) & {r['i'] for r in samples})
        meta = json.loads((ROOT/'public/data/meta.json').read_text())
        for id, q in QUESTIONS.items():
            with self.subTest(id=id):
                self.assertEqual(q['topic'], 'T3.06')
                self.assertFalse(q['inSample'])
                self.assertEqual(by_id[id], q['after'])
                self.assertEqual(len(set(q['after']['a'])), 4)
                self.assertIn(q['after']['c'], range(4))
                self.assertIn(q['after']['k'], 'DICK')
                self.assertEqual(meta[id][2], q['after']['k'])
                self.assertEqual(len(q['reviewedOptions']), 4)
                self.assertTrue(all(isinstance(r, str) and r for r in q['reviewedOptions']))
                ref = q['reference']
                self.assertEqual(q['after']['u'], f"{ref['quote']} [p. {ref['page']}]")
                self.assertRegex(ref['sha256'], r'^[0-9a-f]{64}$')
                self.assertIn('Resumen', ref['role'])
                self.assertTrue(q['primary'])
                for side in ('before', 'after'):
                    self.assertEqual(sha(encode(q[side])), q[side+'Sha256'])
                for key in set(q['before']) | set(q['after']):
                    if key not in {'q', 'a', 'c', 'k', 'n', 'u'}:
                        self.assertEqual(q['before'].get(key), q['after'].get(key))
        changed_types = {id for id,q in QUESTIONS.items() if q['before']['k'] != q['after']['k']}
        self.assertEqual(changed_types, {e['id'] for e in LEDGER['metadataEdits']})
        for edit in LEDGER['metadataEdits']:
            self.assertEqual(edit['index'], 2)
            self.assertEqual(edit['topic'], 'T3.06')
            self.assertEqual(edit['before'][:2]+edit['before'][3:], edit['after'][:2]+edit['after'][3:])
            for side in ('before', 'after'):
                self.assertEqual(sha(encode(edit[side])), edit[side+'Sha256'])

    def test_replay_exact_bytes_id_order_drift_partial_symlink(self):
        with tempfile.TemporaryDirectory() as temporary:
            folder = copy_release_boundary(Path(temporary), 'reviewed-programming20')
            def snapshot():
                return {n: (folder/n).read_bytes() for n in LEDGER['files']}
            def run(mode):
                return subprocess.run([sys.executable, str(EDITORIAL/'replay.py'), '--candidate-dir', temporary,
                    '--batch', 'reviewed-programming20', '--include-sample', mode], capture_output=True, text=True)
            def success(mode, count):
                result = run(mode)
                self.assertEqual(result.returncode, 0, result.stderr)
                self.assertEqual(result.stdout, f'{count} preguntas modificadas.\n')
            after = snapshot()
            success('--rollback', 20)
            before = snapshot()
            for name, hashes in LEDGER['files'].items():
                self.assertEqual(sha(before[name]), hashes['beforeSha256'])
                self.assertEqual(sha(after[name]), hashes['afterSha256'])
            old, new = json.loads(before['T3.06.json']), json.loads(after['T3.06.json'])
            self.assertEqual([q['i'] for q in old], [q['i'] for q in new])
            self.assertEqual({a['i'] for a,b in zip(old,new) if a != b}, set(QUESTIONS))
            success('--rollback', 0)
            (folder/'meta.json').write_bytes(before['meta.json']+b' ')
            dirty = snapshot()
            self.assertIn('Deriva externa', run('--apply').stderr)
            self.assertEqual(snapshot(), dirty)
            (folder/'meta.json').write_bytes(before['meta.json'])
            success('--apply', 20)
            self.assertEqual(snapshot(), after)
            success('--apply', 0)
            success('--rollback', 20)
            (folder/'T3.06.json').write_bytes(after['T3.06.json'])
            success('--apply', 0)  # Topic already applied; catalog still gets repaired.
            self.assertEqual(snapshot(), after)
            success('--rollback', 20)
            (folder/'T3.06.json').unlink()
            (folder/'T3.06.json').symlink_to(folder/'meta.json')
            self.assertIn('Falta una copia ordinaria', run('--apply').stderr)
            self.assertEqual((folder/'meta.json').read_bytes(), before['meta.json'])

    def test_documentary_contracts_and_switch_scope(self):
        # Independent reviewed concepts; no claimed Servlet/JPA runtime execution.
        contracts = {
            'AT306-P1-53': (2, 'inline no obliga'),
            'GEN-T3.06-03.v1': (3, '_Atomic'),
            'GEN-T3.06-10.v1': (0, 'interno o externo'),
            'GEN-T3.06-13.v1': (0, 'float.'),
            'GEN-T3.06-13.v2': (2, 'long double.'),
            'GEN-T3.06-23.v2': (0, 'No exige un orden'),
            'GEN-T3.06-40.v2': (0, 'añade un carácter de nueva línea'),
            'GEN-T3.06-47': (2, 'definida por la implementación'),
            'GEN-T3.06-47.v1': (0, 'no existe un primer directorio universal'),
            'GEN-T3.06-57.v2': (2, '<iostream>'),
            'GEN-T3.06-59.v1': (1, 'sin anteponer enum'),
            'GEN-T3.06-65.v1': (0, 'std::bad_alloc'),
            'GEN-T3.06-68.v1': (1, 'inicializador de miembro del constructor'),
            'GEN-T3.06-01.v1': (3, 'Dennis Ritchie'),
            'GEN-T3.06-49.v1': (3, '1979'),
            'GEN-T3.06-274': (3, 'super.init(config)'),
            'GEN-T3.06-329': (2, 'constructor'),
            'GEN-T3.06-332.v2': (3, 'varias'),
            'GEN-T3.06-337.v2': (1, 'inverso'),
            'GEN-T3.06-362.v2': (3, 'JAR'),
        }
        self.assertEqual(set(contracts), set(QUESTIONS))
        for id, (key, text) in contracts.items():
            with self.subTest(id=id):
                row = QUESTIONS[id]['after']
                self.assertEqual(row['c'], key)
                self.assertIn(text.casefold(), row['a'][key].casefold())
        switch = QUESTIONS['GEN-T3.06-23.v2']['after']
        self.assertEqual(switch['k'], 'D')
        self.assertIn('si existe una etiqueta case cuyo valor coincide', switch['a'][0])

    def test_c_and_cpp_semantic_oracles(self):
        cc = shutil.which('clang') or shutil.which('gcc')
        cpp = shutil.which('clang++') or shutil.which('g++')
        if not cc or not cpp:
            self.skipTest('C/C++ compiler unavailable; documentary checks still run')
        cases = [
            ('atomic', 'c', '#include <stdatomic.h>\nint main(void){_Atomic int x=2; return x!=2;}', True, ''),
            ('atomic_case', 'c', 'int main(void){_atomic int x=2; return x;}', False, ''),
            ('float', 'c', 'int main(void){float a=1,b=2; _Static_assert(_Generic(a+b,float:1,default:0),"float"); return 0;}', True, ''),
            ('long_double', 'c', 'int main(void){double a=1; long double b=2; _Static_assert(_Generic(a+b,long double:1,default:0),"long double"); return 0;}', True, ''),
            ('puts', 'c', '#include <stdio.h>\nint main(void){return puts("TAI")<0;}', True, 'TAI\n'),
            ('switch', 'c', 'int main(void){int x=0; switch(7){case 9:x=9;break;case 7:x=7;break;case 1:x=1;} if(x!=7)return 1; switch(8){case 1:return 2;} return 0;}', True, ''),
            ('linkage', 'c', 'int external=1; static int internal=2; int main(void){return external+internal!=3;}', True, ''),
            ('cpp_features', 'cpp', '#include <iostream>\nenum Color{red}; class C{int n=3; friend int get(C c){return c.n;}}; inline int f(){return 1;} int main(){bool b=true; Color c=red; std::cout << get(C{}); return !(b && c==red && f()==1);}', True, '3'),
            ('default_restriction', 'cpp', 'void f(int a=1,int b); int main(){return 0;}', False, ''),
            ('member_initializer', 'cpp', 'struct C{int x=2; C():x(5){}}; int main(){return C{}.x!=5;}', True, ''),
            # Fault injection demonstrates exception propagation, not real exhaustion.
            ('new_exception', 'cpp', '#include <new>\n#include <cstddef>\nvoid* operator new(std::size_t){throw std::bad_alloc();} int main(){try{auto p=new int; (void)p;}catch(const std::bad_alloc&){return 0;}return 1;}', True, ''),
        ]
        with tempfile.TemporaryDirectory() as temporary:
            folder = Path(temporary)
            (folder/'probe.h').write_text('#define VALUE 3\n')
            cases.extend((name, 'c', f'#include {header}\nint main(void){{return VALUE!=3;}}', True, '')
                         for name,header in [('quote_include','"probe.h"'),('angle_include','<probe.h>')])
            for name, language, source, valid, stdout in cases:
                with self.subTest(case=name):
                    path = folder/(name+'.'+language); path.write_text(source)
                    exe = folder/name
                    result = subprocess.run([cc if language=='c' else cpp,
                        '-std=c2x' if language=='c' else '-std=c++23', '-O0', '-fno-inline',
                        '-I', str(folder), str(path), '-o', str(exe)], capture_output=True, text=True)
                    self.assertEqual(result.returncode==0, valid, result.stderr)
                    if valid:
                        execution = subprocess.run([str(exe)],capture_output=True,text=True)
                        self.assertEqual(execution.returncode,0,execution.stderr)
                        self.assertEqual(execution.stdout,stdout)
