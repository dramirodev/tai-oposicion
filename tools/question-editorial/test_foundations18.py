"""Foundations18 signed documentary corrections and one real BFS oracle.

No Windows/Word/DBMS runtime or current legal network check is claimed in CI.
Version/date scopes and primary citations are preserved in the signed ledger.
"""
from collections import deque
import json
import unittest
from historical_bank import EDITORIAL
import test_m7_replay

LEDGER=json.loads((EDITORIAL/'reviewed-foundations18.json').read_text())

class Foundations18Tests(unittest.TestCase):
    def test_exact_replay_drift_and_prior_boundary(self):
        test_m7_replay.M7ReplayTests.check_batch(self,'reviewed-foundations18',18,2,0)

    def test_only_signed_type_changes_no_flag_removals_and_held_ids_excluded(self):
        self.assertEqual({e['id'] for e in LEDGER['metadataEdits']},{'GEN-T2.03-105.v2','GEN-T2.04-87'})
        held={q['id'] for q in LEDGER['held']}
        self.assertIn('L2025A-P1-20',held)
        self.assertIn('GEN-T1.08-73',held)
        self.assertIn('AT202-P1-45',held)
        self.assertFalse(held&{q['id'] for q in LEDGER['questions']})
        for q in LEDGER['questions']:
            self.assertEqual(q['after'].get('np'),q['before'].get('np'))
            self.assertTrue(q['primary'])
            self.assertTrue(q['sourceDiscrepancy'])

    def test_breadth_first_depth_order_without_heuristic(self):
        edges={'S':['A','B'],'A':['C','D'],'B':['E'],'C':['G'],'D':[],'E':['F'],'F':[],'G':[]}
        queue=deque([('S',0)]);visited=set();trace=[]
        while queue:
            node,depth=queue.popleft()
            if node in visited:continue
            visited.add(node);trace.append((node,depth))
            queue.extend((child,depth+1) for child in edges[node])
        self.assertEqual([n for n,_ in trace],['S','A','B','C','D','E','G','F'])
        self.assertTrue(all(a[1]<=b[1] for a,b in zip(trace,trace[1:])))
        row=next(q['after'] for q in LEDGER['questions'] if q['id']=='GEN-T2.03-73.v1')
        self.assertEqual(row['a'][row['c']],'Búsqueda en anchura.')
