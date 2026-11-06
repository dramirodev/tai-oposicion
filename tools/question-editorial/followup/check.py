"""Independent examples for the reviewed follow-up; no network or bank writes."""
from fractions import Fraction
from itertools import permutations
from pathlib import Path
import os
import shutil
import sqlite3
import stat
import subprocess
import tempfile


def check():
    results = {}
    with tempfile.TemporaryDirectory() as temp:
        permissions = []
        for index, mask in enumerate([0o741, 0o036, 0o022, 0o713]):
            old = os.umask(mask)
            try:
                directory = Path(temp) / str(index)
                directory.mkdir(mode=0o777)
            finally:
                os.umask(old)
            permissions.append(stat.S_IMODE(directory.stat().st_mode))
        assert permissions == [0o036, 0o741, 0o755, 0o064]
        results['AT204-P1-41'] = 1
    assert list(range(5))[0] == 0
    results['GEN-T2.03-07.v2'] = 1
    mapping = {'uno': 1}
    mapping['uno'] = 2
    assert mapping == {'uno': 2} and len(mapping) == 1
    results['GEN-T2.03-25.v1'] = 3
    assert sum(map(Fraction, [1, 4, 9])) / 3 == Fraction(14, 3)
    results['GEN-T2.03-62.v2'] = 1
    trace = []

    def factorial(n):
        trace.append(n)
        return 1 if n == 0 else n * factorial(n-1)
    assert factorial(4) == 24 and trace == [4, 3, 2, 1, 0]
    results['GEN-T2.03-70'] = 2
    assert 2**32 == 4294967296
    results['GEN-T2.04-75.v2'] = 1

    # Referential integrity, nullability and uniqueness enforce the explicit 1:1 case.
    db = sqlite3.connect(':memory:')
    db.executescript('PRAGMA foreign_keys=ON; CREATE TABLE plaza(id INTEGER PRIMARY KEY);'
                     'CREATE TABLE empleado(id INTEGER PRIMARY KEY, plaza_id INTEGER NOT NULL UNIQUE REFERENCES plaza(id));'
                     'INSERT INTO plaza VALUES(1),(2),(3);INSERT INTO empleado VALUES(100,1),(200,2);')
    for sql in ['INSERT INTO empleado VALUES(300,1)', 'INSERT INTO empleado VALUES(300,NULL)',
                'INSERT INTO empleado VALUES(300,99)']:
        try:
            db.execute(sql)
        except sqlite3.IntegrityError:
            pass
        else:
            raise AssertionError('Invalid 1:1 allocation accepted')
    assert db.execute('SELECT count(*) FROM plaza').fetchone()[0] == 3
    assert db.execute('SELECT count(*) FROM empleado').fetchone()[0] == 2
    results['GEN-T3.02-21.v1'] = 2
    pairs = db.execute('SELECT e.id,p.id FROM empleado e JOIN plaza p ON e.plaza_id=p.id ORDER BY e.id').fetchall()
    assert pairs == [(100,1),(200,2)]
    results['GEN-T3.02-55.v2'] = 1

    # A ternary join dependency can be irreducible to two pair projections.
    relation = set(permutations(range(3)))
    ab = {(a,b) for a,b,c in relation}
    bc = {(b,c) for a,b,c in relation}
    ac = {(a,c) for a,b,c in relation}
    all_values = {(a,b,c) for a in range(3) for b in range(3) for c in range(3)}
    restrictions = [lambda t:(t[0],t[1]) in ab, lambda t:(t[1],t[2]) in bc, lambda t:(t[0],t[2]) in ac]
    assert {t for t in all_values if all(f(t) for f in restrictions)} == relation
    for omitted in range(3):
        assert {t for t in all_values if all(f(t) for i,f in enumerate(restrictions) if i!=omitted)} > relation
    results['GEN-T3.02-66.v2'] = 1

    # Execute genuine Java and ask javac to reject direct abstract instantiation.
    jdk = Path(os.environ.get('JAVA_HOME', '/opt/homebrew/opt/openjdk@21'))
    java = str(jdk/'bin/java') if (jdk/'bin/java').exists() else shutil.which('java')
    javac = str(jdk/'bin/javac') if (jdk/'bin/javac').exists() else shutil.which('javac')
    with tempfile.TemporaryDirectory() as temp:
        source = Path(temp)/'Probe.java'
        source.write_text('''class Probe {
 abstract static class Figura {} static class Cuadrado extends Figura {}
 static class Contador { int valor=1; void incrementar(){valor++;} }
 public static void main(String[] args){
 System.out.println(new Cuadrado().getClass().getSimpleName());
 Contador x1=new Contador(),x2=new Contador();x1.incrementar();System.out.println(x2.valor);
 int i=3;System.out.println(i++);
 }}''')
        assert subprocess.check_output([java,str(source)],text=True).splitlines() == ['Cuadrado','1','3']
        source.write_text('abstract class Figura {} class Invalid { Figura f=new Figura(); }')
        invalid = subprocess.run([javac,str(source)],capture_output=True,text=True)
        assert invalid.returncode != 0 and 'abstract' in invalid.stderr.lower()
    results.update({'GEN-T3.05-21':1,'GEN-T3.05-23.v1':1,'AS09-P1-52':0})

    tree = {8:(3,10),3:(1,6),6:(4,7),10:(None,14),14:(13,None)}
    def postorder(node):
        if node is None:return []
        left,right=tree.get(node,(None,None))
        return postorder(left)+postorder(right)+[node]
    assert postorder(8)==[1,4,7,6,3,13,14,10,8]
    results['AS08B-P1-37']=2
    from collections import deque
    edges='A-B A-C C-D C-F F-L D-E D-I I-H E-K E-G K-J G-J'.split()
    adj={x:[] for x in 'ABCDEFGHIJKL'}
    for edge in edges:
        a,b=edge.split('-');adj[a].append(b);adj[b].append(a)
    def bfs(order):
        rank={x:i for i,x in enumerate(order)};todo=deque('A');seen={'A'};out=[]
        while todo:
            v=todo.popleft();out.append(v)
            for u in sorted(adj[v],key=rank.get):
                if u not in seen:seen.add(u);todo.append(u)
        return out
    candidates=['A B C I D F H E L G K J','A C F L D E K J G B I H','A B C D F I E L H G K J','A C F L B D E K J G I H']
    assert [i for i,sequence in enumerate(candidates) if bfs(sequence.split())==sequence.split()]==[2]
    results['AS10B-P1-40']=2
    # The standard-library IDNA encoder validates label length without a DNS lookup.
    assert ('a'*63).encode('idna') == b'a'*63
    try:
        ('a'*64).encode('idna')
    except UnicodeError:
        pass
    else:
        raise AssertionError('An overlong DNS label was accepted')
    results['GEN-T4.08-20.v1']=3
    return results

if __name__=='__main__':
    for identifier, answer in check().items():print(identifier, answer)
