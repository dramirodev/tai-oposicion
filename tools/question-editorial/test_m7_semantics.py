"""Portable M7 oracles: SQL literal queries, a documented date model and safe find.

Provenance: independently reviewed development11/system20 proposal oracles.
SQLite is not used to certify Oracle syntax. The find action prints, never deletes.
Other factual rows remain documentary reviews with cited source hashes in ledgers.
"""
import json
import math
from pathlib import Path
import shutil
import sqlite3
import subprocess
import tempfile
import unittest
from historical_bank import EDITORIAL

ROWS={q['id']:q['after'] for batch in ('reviewed-development11','reviewed-systems20')
      for q in json.loads((EDITORIAL/(batch+'.json')).read_text())['questions']}

class M7SemanticTests(unittest.TestCase):
    def test_correlated_exists_four_literal_alternatives(self):
        with sqlite3.connect(':memory:') as db:
            db.execute('CREATE TABLE SPJ(S TEXT NOT NULL,P TEXT NOT NULL,J TEXT NOT NULL)')
            db.executemany('INSERT INTO SPJ VALUES(?,?,?)',[('S1','P1','J1'),('S2','P2','J2'),('S3','P1','J3'),('S3','P3','J4')])
            q=ROWS['AT304-P1-35'];expected=[('J1',),('J2',),('J3',)]
            results=[sorted(db.execute(sql).fetchall())==expected for sql in q['a']]
            self.assertEqual(results,[False,False,False,True]);self.assertEqual(q['c'],3)

    def test_left_join_zero_homonyms_null_keys_four_literal_alternatives(self):
        q=ROWS['AS05G-P1-91']
        self.assertIn('DNI TEXT PRIMARY KEY NOT NULL',q['q']);self.assertIn('id INTEGER PRIMARY KEY',q['q'])
        with sqlite3.connect(':memory:') as db:
            db.executescript('CREATE TABLE Empleados(DNI TEXT PRIMARY KEY NOT NULL,nombre TEXT);CREATE TABLE Incidencias(id INTEGER PRIMARY KEY,fecha TEXT,DNI TEXT,decision TEXT);')
            db.executemany('INSERT INTO Empleados VALUES(?,?)',[('1','Ana'),('2','Ana'),('3','Luis'),('4','Eva')])
            with self.assertRaises(sqlite3.IntegrityError):db.execute("INSERT INTO Empleados VALUES(NULL,'invalid')")
            db.executemany('INSERT INTO Incidencias VALUES(?,?,?,?)',[(1,'2019-01-01','1','RESUELTA'),(2,'2019-12-31','1','RESUELTA'),(3,'2019-06-01','2','ABIERTA'),(4,'2020-01-01','3','RESUELTA')])
            expected=[('1','Ana',2),('2','Ana',0),('3','Luis',0),('4','Eva',0)]
            self.assertEqual([sorted(db.execute(sql).fetchall())==expected for sql in q['a']],[False,False,False,True])
            self.assertEqual(q['c'],3)

    def test_half_open_date_interval_relational_model_not_oracle_runtime(self):
        with sqlite3.connect(':memory:') as db:
            db.executescript('CREATE TABLE PACIENTE(ID_PACIENTE INTEGER PRIMARY KEY,NOMBRE TEXT,APELLIDOS TEXT,RIESGO TEXT);CREATE TABLE CITA_MEDICA(ID_CITA INTEGER PRIMARY KEY,ID_PACIENTE INTEGER,FECHA_CITA TEXT,ID_CENTRO INTEGER);')
            db.executemany('INSERT INTO PACIENTE VALUES(?,?,?,?)',[(i,'P'+str(i),'A','BAJO' if i==3 else 'ALTO') for i in range(1,6)])
            db.executemany('INSERT INTO CITA_MEDICA VALUES(?,?,?,?)',[(1,1,'2021-02-28 12:00:00',2),(2,2,'2021-03-01 00:00:00',2),(3,4,'2021-02-20 12:00:00',3)])
            q=ROWS['AS02-P1-76'];sql=q['q'].split('\n',1)[1]
            sql=sql.replace("DATE '2021-02-16'","'2021-02-16'").replace("DATE '2021-03-01'","'2021-03-01'")
            self.assertEqual(db.execute(sql).fetchall(),[('P2','A'),('P4','A'),('P5','A')]);self.assertEqual(q['c'],2)

    def test_find_selection_real_no_deletion(self):
        executable=shutil.which('find');self.assertIsNotNone(executable)
        with tempfile.TemporaryDirectory() as tmp:
            root=Path(tmp);(root/'user/nested').mkdir(parents=True);(root/'folder.mpg').mkdir()
            for n in ('root.mpg','user/movie.mpg','user/nested/space name.mpg','user/notes.txt'):(root/n).write_text('fixture')
            expected={str(root/n) for n in ('root.mpg','user/movie.mpg','user/nested/space name.mpg')}
            def select(kind,pattern):
                return set(subprocess.check_output([executable,str(root),'-type',kind,'-name',pattern,'-exec','printf','%s\n','{}',';'],text=True).splitlines())
            results=[{str(p) for p in root.glob('*.mpg') if p.is_file()},select('f','*.mpg'),select('d','*.mpg'),select('f','.mpg')]
            self.assertEqual([r==expected for r in results],[False,True,False,False]);self.assertEqual(ROWS['AS04-P1-71']['c'],1)
            self.assertTrue(all(Path(p).exists() for p in expected))

    def test_gnu_find_age_rounding_model_not_gnu_execution(self):
        fixtures=[('recent',2.9,4.1),('three',3.1,1.1),('six',6.9,1.1),('seven',7.1,8.1)]
        options=[set() for _ in range(4)]
        for name,mtime,atime in fixtures:
            m,a=math.floor(mtime),math.floor(atime)
            for i,ok in enumerate((m>2 and a>7,a>2 and a<7,m>2 and m<7,m<2 and m>7)):
                if ok:options[i].add(name)
        self.assertEqual([o=={'three','six'} for o in options],[False,False,True,False]);self.assertEqual(ROWS['AS05G-P1-58']['c'],2)

    def test_signature_sender_private_key_and_tamper_rejection(self):
        node=shutil.which('node');self.assertIsNotNone(node)
        code="""const {generateKeyPairSync,sign,verify}=require('node:crypto');
const a=generateKeyPairSync('ed25519'),b=generateKeyPairSync('ed25519');
const m=Buffer.from('fixture'),s=sign(null,m,a.privateKey);
let rejected=false;try{sign(null,m,b.publicKey)}catch{rejected=true}
console.log(JSON.stringify([verify(null,m,a.publicKey,s),verify(null,m,b.publicKey,s),verify(null,Buffer.from('changed'),a.publicKey,s),rejected]));"""
        self.assertEqual(json.loads(subprocess.check_output([node,'-e',code],text=True)),[True,False,False,True])
