"""Web23 follows languages17 and preserves its release boundary."""
import unittest
from reviewed_nested_checks import check_batch

class Web23Tests(unittest.TestCase):
    def test_rows_metadata_unaffected_questions_and_exact_replay(self):
        check_batch(self,'reviewed-web23',23,0,21)
