"""Offline wave2 evidence contracts, executable examples and guarded replay."""
import hashlib
import json
from pathlib import Path
import sqlite3
import subprocess
import sys
import tempfile
import unittest
from historical_bank import copy_release_boundary

ROOT = Path(__file__).resolve().parents[2]
EDITORIAL = ROOT / 'scripts/bank-editorial'
LEDGER = json.loads((EDITORIAL / 'reviewed-wave2.json').read_text())
QUESTIONS = {q['id']: q for q in LEDGER['questions']}

def encode(value):
    return json.dumps(value, ensure_ascii=False, separators=(',', ':')).encode()

def sha(value):
    return hashlib.sha256(value).hexdigest()


class Wave2Tests(unittest.TestCase):
    def test_scope_evidence_and_full_rows(self):
        self.assertEqual(len(LEDGER['questions']), 129)
        self.assertEqual(len(QUESTIONS), 129)
        self.assertEqual(len(LEDGER['files']), 27)
        self.assertEqual(len({q['topic'] for q in QUESTIONS.values()}), 26)
        self.assertEqual(LEDGER['sampleFiles'], {})
        self.assertFalse(any(q['inSample'] for q in QUESTIONS.values()))
        metadata = json.loads((ROOT / 'public/data/meta.json').read_text())
        for q in QUESTIONS.values():
            with self.subTest(id=q['id']):
                for side in ('before', 'after'):
                    self.assertEqual(sha(encode(q[side])), q[side+'Sha256'])
                    self.assertEqual(q[side]['i'], q['id'])
                    self.assertEqual(q[side]['t'], q['topic'])
                after = q['after']
                self.assertEqual(len(after['a']), 4)
                self.assertEqual(len(set(after['a'])), 4)
                self.assertIn(after['c'], range(4))
                self.assertIn(after['k'], ('D', 'I', 'C', 'K'))
                self.assertEqual(metadata[q['id']][2], after['k'])
                self.assertEqual(len(q['reviewedOptions']), 4)
                self.assertTrue(all(q['reviewedOptions']))
                ref = q['reference']
                self.assertRegex(ref['sha256'], r'^[a-f0-9]{64}$')
                self.assertGreater(ref['page'], 0)
                self.assertTrue(ref['quote'])
                self.assertEqual(after['u'], f"{ref['quote']} [p. {ref['page']}]")
                sample = json.loads((ROOT / 'public/sample' / (q['topic']+'.json')).read_text())
                self.assertNotIn(q['id'], {row['i'] for row in sample})
        blocked = [q['id'] for q in QUESTIONS.values() if q['after'].get('np') == 1]
        self.assertEqual(blocked, ['GEN-T3.03-48'])
        php = QUESTIONS[blocked[0]]
        self.assertEqual(php['after']['w'], 1)
        self.assertFalse(php['resolved'])
        self.assertEqual(len(LEDGER['metadataEdits']), 60)
        self.assertEqual(len({q['id'] for q in LEDGER['metadataEdits']}), 60)
        for edit in LEDGER['metadataEdits']:
            self.assertEqual(edit['index'], 2)
            self.assertNotEqual(edit['before'][2], edit['after'][2])
            self.assertEqual(edit['before'][:2]+edit['before'][3:], edit['after'][:2]+edit['after'][3:])
            for side in ('before', 'after'):
                self.assertEqual(sha(encode(edit[side])), edit[side+'Sha256'])
        for name, fingerprints in LEDGER['files'].items():
            raw = (ROOT / 'public/data' / name).read_bytes()
            self.assertEqual(sha(raw), fingerprints['afterSha256'])
            rows = json.loads(raw)
            before = json.loads(raw)
            edits = LEDGER['metadataEdits'] if name == 'meta.json' else [q for q in QUESTIONS.values() if q['topic']+'.json' == name]
            positions = {key: key for key in rows} if isinstance(rows, dict) else {q['i']: i for i, q in enumerate(rows)}
            self.assertEqual(len(positions), len(rows))
            for edit in edits:
                index = positions[edit['id']]
                self.assertEqual(rows[index], edit['after'])
                before[index] = edit['before']
            self.assertEqual(sha(encode(before)+raw[len(raw.rstrip()):]), fingerprints['beforeSha256'])

    def test_replay_rollback_drift_partial_and_symlink(self):
        with tempfile.TemporaryDirectory() as temporary:
            folder = copy_release_boundary(Path(temporary), 'reviewed-wave2')
            names = list(LEDGER['files'])
            original = {name: (folder/name).read_bytes() for name in names}
            def run(mode):
                return subprocess.run([sys.executable, str(EDITORIAL/'replay.py'), '--candidate-dir', temporary,
                                       '--batch', 'reviewed-wave2', '--include-sample', mode], capture_output=True, text=True)
            def hashes():
                return {name: sha((folder/name).read_bytes()) for name in names}
            def success(mode, count):
                result = run(mode)
                self.assertEqual(result.returncode, 0, result.stderr)
                self.assertEqual(result.stdout, f'{count} preguntas modificadas.\n')
            success('--rollback', 129)
            self.assertEqual(hashes(), {n: f['beforeSha256'] for n, f in LEDGER['files'].items()})
            baseline = {name: (folder/name).read_bytes() for name in names}
            success('--rollback', 0)
            damaged = folder/names[-1]
            damaged.write_bytes(baseline[names[-1]]+b' ')
            dirty = hashes()
            self.assertIn('Deriva externa', run('--apply').stderr)
            self.assertEqual(hashes(), dirty)
            damaged.write_bytes(baseline[names[-1]])
            success('--apply', 129)
            self.assertEqual({n: (folder/n).read_bytes() for n in names}, original)
            success('--apply', 0)
            success('--rollback', 129)
            first = names[0]
            (folder/first).write_bytes(original[first])
            result = run('--apply')
            self.assertEqual(result.returncode, 0, result.stderr)
            self.assertEqual({n: (folder/n).read_bytes() for n in names}, original)
            success('--rollback', 129)
            self.assertEqual({n: (folder/n).read_bytes() for n in names}, baseline)
            damaged.unlink(); damaged.symlink_to(folder/first)
            self.assertIn('Falta una copia ordinaria', run('--apply').stderr)
            self.assertEqual((folder/first).read_bytes(), baseline[first])

    def test_numeric_and_boolean_oracles(self):
        # Values derive from units/arithmetic, not the ledger's answer index.
        cases = [('AS04-P1-27', 2**80, [10**18, 2**70, 10**15, 1024**8]),
                 ('AS07-P1-36', 1000**8, [10**18, 10**21, 10**24, 10**27]),
                 ('AS11-P1-33', 1024*2**50, [2**60, 2**80, 2**50, 2**70]),
                 ('AS04-P1-31', 10, [5, 2*5, 4.8, 15*480/1000]),
                 ('AS08-P1-43', 2**63, [2*10**12, 8*2**60, 4*10**12, 4*10**18])]
        labels = {
            'AS04-P1-27': ['1 ExaByte.', '1 ZebiByte.', '1 PetaByte.', '1 YobiByte.'],
            'AS07-P1-36': ['10^18 bytes.', '10^21 bytes.', '10^24 bytes.', '10^27 bytes.'],
            'AS11-P1-33': ['1 Exbibyte.', '1 Yobibyte.', '1 Pebibyte.', '1 Zebibyte.'],
            'AS04-P1-31': ['La misma que la de USB 3.0.', '10 Gbit/s: el doble que USB 3.1 Gen 1.', '4,8 Gbit/s.', '15 veces la de USB 2.0 (480 Mbit/s).'],
            'AS08-P1-43': ['2 TB.', '2^63 bytes (8 EiB).', '4 TB.', '4 EB.'],
        }
        for identifier, expected, options in cases:
            self.assertEqual(QUESTIONS[identifier]['after']['a'], labels[identifier])
            matches = [i for i, value in enumerate(options) if value == expected]
            self.assertEqual(matches, [QUESTIONS[identifier]['after']['c']], identifier)
        truth = [(10>8) or (d>10) and not ((d<10) and (9>8)) for d in (5,7,9,11)]
        self.assertEqual(truth, [True]*4)
        q = QUESTIONS['AS05G-P1-82']['after']
        self.assertEqual(q['a'][q['c']], 'Para los cuatro valores.')
        self.assertFalse((0>8) or (-1>0) and not ((-1<0) and (9>8)))

    def test_sql_null_projection_and_self_reference(self):
        with sqlite3.connect(':memory:') as db:
            db.executescript('CREATE TABLE ciudadanos(dni INT); CREATE TABLE viviendas(dni INT); INSERT INTO ciudadanos VALUES(1),(2); INSERT INTO viviendas VALUES(1),(3);')
            query = 'SELECT * FROM ciudadanos LEFT OUTER JOIN viviendas ON ciudadanos.dni=viviendas.dni WHERE viviendas.dni '
            self.assertEqual(db.execute(query+'=NULL').fetchall(), [])
            self.assertEqual(db.execute(query+'IS NULL').fetchall(), [(2,None)])
            q = QUESTIONS['AS08-P1-64']['after']; self.assertEqual(q['a'][q['c']], 'Ninguna fila.')
            db.executescript("CREATE TABLE fuente(id INT, departamento TEXT); INSERT INTO fuente VALUES(1,'A'),(2,'A'),(3,'B');")
            self.assertEqual(len(db.execute('SELECT departamento FROM fuente').fetchall()), 3)
            self.assertEqual(db.execute('SELECT DISTINCT departamento FROM fuente ORDER BY departamento').fetchall(), [('A',),('B',)])
            q = QUESTIONS['AT302-P1-18']['after']; self.assertEqual(q['a'][q['c']], 'Proyección.')
            db.execute('PRAGMA foreign_keys=ON')
            db.executescript('CREATE TABLE empleado(id INT NOT NULL PRIMARY KEY, jefe_id INT REFERENCES empleado(id)); INSERT INTO empleado VALUES(1,NULL),(2,1),(3,3);')
            with self.assertRaises(sqlite3.IntegrityError):
                db.execute('INSERT INTO empleado VALUES(4,999)')
            q = QUESTIONS['AS11B-P1-R-03']['after']
            self.assertEqual(q['k'], 'I')
            self.assertEqual(q['a'][q['c']], 'Nunca tiene sentido definir una clave ajena porque no existe otra tabla.')
