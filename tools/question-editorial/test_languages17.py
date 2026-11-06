"""Languages17 mixed normal/scenario release boundary; no external sources."""
import unittest
from reviewed_nested_checks import check_batch

class Languages17Tests(unittest.TestCase):
    def test_rows_context_unaffected_questions_and_exact_replay(self):
        check_batch(self,'reviewed-languages17',17,2,10)
