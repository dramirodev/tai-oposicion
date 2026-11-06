"""Run independent reference examples. Writes only temporary compiler output."""
import base64
import hashlib
import json
import os
from pathlib import Path
import shutil
import socket
import sqlite3
import subprocess
import sys
import tempfile
import types
from xml.dom import minidom


HERE = Path(__file__).resolve().parent
ROOT = HERE.parents[2]
ledger = json.loads((ROOT / 'scripts/bank-editorial/reviewed-19.json').read_text())['questions']
selected = set(sys.argv[1:]) or {r['id'] for r in ledger}
answers = {}


def check(question_id, result, options):
    answers[question_id] = (result, options)


if any(x.startswith(('AT303', 'GEN-T3.03')) for x in selected):
    jdk = Path(os.environ.get('JAVA_HOME', '/opt/homebrew/opt/openjdk@21'))
    java = str(jdk / 'bin/java') if (jdk / 'bin/java').exists() else shutil.which('java')
    with tempfile.TemporaryDirectory() as tmp:
        out = subprocess.check_output([java, str(HERE / 'Probe.java'), tmp], text=True).splitlines()
    check('AT303-P1-09', int(out[0]), [1, 2, 3, 9])
    check('AT303-P1-13', json.loads(out[1]), [[2, 8, 22, 52], [0, 4, 14, 32], [1, 12], [0, 4, 14, 52]])
    check('AT303-P1-17', json.loads(out[2]), [[10, 8, 7, 3], [10, 9, 6, 3], [10, 8, 5, 1], [10, 5, 1]])
    check('AT303-P1-36', int(out[3]), [6, 5, 4, 3])
    assert out[4] == out[5]
    check('GEN-T3.03-47.v1', out[4], ['LOGICAL_OPERATOR', 'INT_LITERAL', 'PRIMITIVE_TYPE', 'BOOLEAN_LITERAL'])
    check('GEN-T3.03-74.v2', int(out[6]), [3, 4, 5, 6])

# Execute the question statements against actual SQLite tables.
db = sqlite3.connect(':memory:')
db.executescript("CREATE TABLE empleados(nombre,sueldo);INSERT INTO empleados VALUES ('Ana',80),('Luis',160);UPDATE empleados SET sueldo=sueldo*1.0125;")
check('GEN-T3.04-32', [round(row[0], 9) for row in db.execute('SELECT sueldo FROM empleados ORDER BY sueldo')], [[80, 160], [81, 160], [81, 162], [80, 162]])
db.executescript("DELETE FROM empleados;INSERT INTO empleados VALUES ('Ana',200),('Luis',100);")
check('GEN-T3.04-46.v1', [r[0] for r in db.execute('SELECT nombre FROM empleados ORDER BY sueldo ASC')], [['Luis', 'Ana'], ['Ana', 'Luis'], 'error', ['Luis']])
db.executescript('CREATE TABLE a(x);CREATE TABLE b(y);INSERT INTO a VALUES(1),(4);INSERT INTO b VALUES(2),(3);')
check('GEN-T3.04-51.v1', db.execute('SELECT x,y FROM a JOIN b ON x<y ORDER BY x,y').fetchall(), [[(1, 2), (1, 3)], [], [(1, 2), (1, 3), (4, 2), (4, 3)], [(4, 2), (4, 3)]])
db.executescript('DELETE FROM a; DELETE FROM b; INSERT INTO a VALUES(1),(2);INSERT INTO b VALUES(3),(4);')
check('GEN-T3.04-51.v2', db.execute('SELECT COUNT(*) FROM a INNER JOIN b ON a.x=b.y').fetchone()[0], [1, 0, 2, 4])

# Use real Python objects rather than comparing the wording of the alternatives.
code = compile('3+4', '<ejemplo>', 'eval')
assert eval(code) == 7
check('GEN-T3.08-1101.v1', type(code), [str, bytes, types.CodeType, os.PathLike])
check('GEN-T3.08-1110.v2', repr('{:3}'.format(7)), [repr('7  '), repr(' 7 '), repr('7'), repr('  7')])

def f(x):
    x.append(2)
    x = [9]

a = [1]
f(a)
check('GEN-T3.08-1133', a, [[9], [1], [1, 2], [1, 2, 9]])

class C:
    def fijar(self):
        self.x = 3

a, b = C(), C()
a.fijar()
check('GEN-T3.08-1140.v1', [hasattr(o, 'x') for o in (a, b, C)], [[False, True, False], [True, True, True], [True, True, False], [True, False, False]])
doc = minidom.parseString('<?xml version="1.0" standalone="no"?><r/>')
check('GEN-T3.08-58', doc.documentElement.tagName, ['rejected:no-dtd', 'r', 'rejected:empty', 'rejected:no'])
doc = minidom.parseString('<r><!-- aviso --><x/></r>')
assert doc.documentElement.firstChild.nodeType == doc.COMMENT_NODE
check('GEN-T3.08-60.v1', len(doc.getElementsByTagName('*')), [1, 2, 3, 4])
check('GEN-T3.07-170.v2', base64.urlsafe_b64encode(bytes.fromhex('fbff')).decode().rstrip('='), ['+/8=', '-_8=', '-_8', 'fbff'])
if 'AT408-P1-30' in selected:
    ruby = """
require 'resolv'
message = Resolv::DNS::Message.new(0)
record = Resolv::DNS::Resource::IN::A
2.times { message.add_question('test.', record) }
3.times { message.add_answer('test.', 30, record.new('127.0.0.1')) }
4.times { message.add_authority('test.', 30, record.new('127.0.0.1')) }
5.times { message.add_additional('test.', 30, record.new('127.0.0.1')) }
puts message.encode.unpack('n6').drop(2).join(',')
"""
    counts = subprocess.check_output(['ruby', '-e', ruby], text=True).strip()
    check('AT408-P1-30', counts, ['2,3,4,5', '0,2,3,4', '2,3,5,4', '2,4,3,5'])
check('AT408-P1-44', [socket.getservbyname(name, 'udp') for name in ['bootps', 'dhcpv6-server']], [[67, 546], [68, 547], [68, 546], [67, 547]])
verified = set()
for r in ledger:
    i = r['id']
    if i not in selected:
        continue
    (result, options) = answers[i]
    row = r['after']
    matches = [n for (n, opt) in enumerate(options) if opt == result]
    assert matches == [row['c']], (i, matches, result)
    published = next((q for q in json.loads((ROOT / f"public/data/{r['topic']}.json").read_text()) if q['i'] == i))
    assert published == row, i
    before = r['before']
    for (data, expected) in [(row, r['afterSha256']), (before, r['beforeSha256'])]:
        assert hashlib.sha256(json.dumps(data, ensure_ascii=False, separators=(',', ':')).encode()).hexdigest() == expected
    print(i, 'OK', chr(65 + matches[0]), repr(result))
    verified.add(i)
assert verified == selected, selected - verified
