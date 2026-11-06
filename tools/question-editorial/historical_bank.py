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
ORDER = ('reviewed-19', 'reviewed-followup', 'reviewed-wave2', 'reviewed-admin20', 'reviewed-legal19', 'reviewed-programming20')


def copy_release_boundary(folder, batch):
    position = ORDER.index(batch)
    ledgers = {name: json.loads((EDITORIAL / (name + '.json')).read_text())
               for name in ORDER[position:]}
    names = {name for ledger in ledgers.values() for name in ledger['files']}
    samples = {name for ledger in ledgers.values() for name in ledger.get('sampleFiles', {})}
    for name in names:
        shutil.copyfile(ROOT / 'public/data' / name, folder / name)
    (folder / 'sample').mkdir()
    for name in samples:
        shutil.copyfile(ROOT / 'public/sample' / name, folder / 'sample' / name)
    for successor in reversed(ORDER[position + 1:]):
        subprocess.run([sys.executable, str(EDITORIAL / 'replay.py'),
                        '--candidate-dir', str(folder), '--batch', successor,
                        '--include-sample', '--rollback'], check=True, capture_output=True, text=True)
    return folder
