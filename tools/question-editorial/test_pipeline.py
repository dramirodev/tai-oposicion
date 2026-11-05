import copy
import hashlib
import importlib.util
from pathlib import Path
import subprocess
import sys
import json
import tempfile
import unittest

module = importlib.util.spec_from_file_location('pipeline', Path(__file__).with_name('pipeline.py'))
pipeline = importlib.util.module_from_spec(module)
module.loader.exec_module(pipeline)


class PipelineTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.root = Path(self.tmp.name)
        quote = 'El protocolo TCP ofrece un servicio orientado a conexión.'
        self.source = self.root / 'temario.txt'
        self.source.write_text('Primera página\f' + quote)
        self.spec = dict(id='GEN-TEST-1', topic='T4.07', section='TCP', concept='conexión',
                         pattern='FAM', prompt='¿Qué protocolo establece conexión?',
                         options=['TCP', 'UDP', 'ICMP', 'ARP'], correct=0, solution='TCP',
                         explanation='TCP establece conexión según el pasaje.',
                         rationales=['Establece conexión.', 'Es datagrama.', 'Control de IP.', 'Resuelve MAC.'],
                         reference=dict(path='temario.txt', sha256=hashlib.sha256(self.source.read_bytes()).hexdigest(),
                                        page=2, quote=quote),
                         cognitiveDemand='distinguir', difficulty=1, author='generador')

    def run_candidate(self, spec=None, existing=(), review=None):
        return pipeline.generate_candidate(spec or self.spec, self.root, existing, review)

    def test_requires_independent_review_and_keeps_publication_excluded(self):
        result = self.run_candidate()
        self.assertEqual(result['editorial']['state'], 'pending_review')
        self.assertEqual(result['question']['np'], 1)
        review = dict(revision=result['editorial']['revision'], reviewer='editor', date='2026-11-05',
                      blindSolution='TCP', sourceVerified=True, uniqueAnswer=True,
                      rationalesVerified=True, decision='accepted')
        self.assertEqual(self.run_candidate(review=review)['editorial']['state'], 'accepted')
        review['reviewer'] = 'generador'
        with self.assertRaises(ValueError):
            self.run_candidate(review=review)

    def test_document_page_and_revision_are_checked(self):
        for field, value in [('page', 1), ('sha256', 'wrong'), ('path', '../outside.txt')]:
            spec = copy.deepcopy(self.spec)
            spec['reference'][field] = value
            with self.subTest(field=field), self.assertRaises(ValueError):
                self.run_candidate(spec)

    def test_duplicate_content_survives_permutation(self):
        old = dict(i='OTHER', q=self.spec['prompt'], a=list(reversed(self.spec['options'])))
        with self.assertRaises(ValueError):
            self.run_candidate(existing=[old])

    def test_invalid_schema_and_key(self):
        for field, value in [('options', ['TCP'] * 4), ('correct', True), ('solution', 'UDP'),
                             ('pattern', 'UNPROVEN'), ('rationales', ['ok']), ('rationales', 'abcd'), ('difficulty', 0)]:
            spec = dict(self.spec, **{field: value})
            with self.subTest(field=field), self.assertRaises(ValueError):
                self.run_candidate(spec)

    def test_conflicts_and_equivalent_options_cannot_be_accepted(self):
        for flag in ('conflictingSources', 'missingMaterial', 'outsideCurriculum',
                     'confirmedContradiction', 'equivalentOptionPairs'):
            spec = dict(self.spec, **{flag: True})
            self.assertEqual(self.run_candidate(spec)['editorial']['state'], 'rejected')

    def test_cli_rejects_empty_bank_and_publication_directory(self):
        spec = self.root / 'spec.json'
        spec.write_text(json.dumps(self.spec))
        command = [sys.executable, str(Path(__file__).with_name('pipeline.py')), str(spec),
                   '--curriculum-root', str(self.root), '--bank', str(self.root),
                   '--output', str(self.root / 'candidate.json')]
        self.assertNotEqual(subprocess.run(command, capture_output=True).returncode, 0)
        (self.root / 'meta.json').write_text('{}')
        (self.root / 'T4.07.json').write_text('[{"i":"old","q":"different","a":["a","b","c","d"]}]')
        self.assertNotEqual(subprocess.run(command, capture_output=True).returncode, 0)

    def test_independent_rejection_can_disagree_with_solution(self):
        revision = self.run_candidate()['editorial']['revision']
        review = dict(revision=revision, reviewer='editor', date='2026-11-05',
                      decision='rejected', reason='Dos opciones defendibles', blindSolution='UDP')
        self.assertEqual(self.run_candidate(review=review)['editorial']['state'], 'rejected')

    def test_review_is_invalidated_when_content_changes(self):
        result = self.run_candidate()
        changed = dict(self.spec, explanation='Explicación cambiada')
        review = dict(revision=result['editorial']['revision'], reviewer='editor', date='2026-11-05',
                      blindSolution='TCP', sourceVerified=True, uniqueAnswer=True,
                      rationalesVerified=True, decision='accepted')
        with self.assertRaises(ValueError):
            self.run_candidate(changed, review=review)


if __name__ == '__main__':
    unittest.main()
