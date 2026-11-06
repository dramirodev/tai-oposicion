"""Reconstruct a release boundary using only checked-in successor ledgers.

Always operates on a caller-owned temporary directory, through the real guarded
replay. Historical fingerprints remain immutable; no PDF or network is needed.
"""
import json
from pathlib import Path
import shutil
import subprocess
import sys

ROOT = Path(__file__).resolve().parents[2]
EDITORIAL = ROOT / 'scripts/bank-editorial'
sys.path.insert(0, str(ROOT / 'scripts'))
from citation_release import citation_base
ORDER = ('reviewed-19', 'reviewed-followup', 'reviewed-wave2', 'reviewed-admin20', 'reviewed-legal19', 'reviewed-programming20', 'reviewed-web25', 'reviewed-architecture20', 'reviewed-languages17', 'reviewed-web23', 'reviewed-development11', 'reviewed-systems20', 'reviewed-foundations18', 'reviewed-systems16', 'reviewed-syntax3', 'reviewed-admin5', 'reviewed-network2')


def copy_release_boundary(folder, batch):
    position = ORDER.index(batch)
    ledgers = {name: json.loads((EDITORIAL / (name + '.json')).read_text())
               for name in ORDER[position:]}
    names = {name for ledger in ledgers.values() for name in ledger['files']}
    samples = {name for ledger in ledgers.values() for name in ledger.get('sampleFiles', {})}
    for name in names:
        (folder / name).write_bytes(citation_base(name, (ROOT / 'public/data' / name).read_bytes()))
    (folder / 'sample').mkdir()
    for name in samples:
        (folder / 'sample' / name).write_bytes(citation_base(name, (ROOT / 'public/sample' / name).read_bytes(), sample=True))
    for successor in reversed(ORDER[position + 1:]):
        subprocess.run([sys.executable, str(EDITORIAL / 'replay.py'),
                        '--candidate-dir', str(folder), '--batch', successor,
                        '--include-sample', '--rollback'], check=True, capture_output=True, text=True)
    return folder
