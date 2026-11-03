import json
import tempfile
import unittest
from pathlib import Path

from scripts.build_academy_question_sources import build_candidates, normalized_stem, question_revision


class AcademyQuestionSourceCandidateTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.source = self.root / "academy"
        self.source.mkdir()
        self.questions = self.root / "questions"
        self.questions.mkdir()
        self.pdf = self.source / "T3.03 Test.pdf"
        self.pdf.write_bytes(b"test fixture")
        self.pdftotext = self.root / "pdftotext"
        self.pdftotext.write_text(
            "#!/usr/bin/env python3\n"
            "print('Portada\\fIndique el número de veces: for (i=0; i>0;)\\fIndique el número de veces: for (i=0; i>0;)')\n",
            encoding="utf-8",
        )
        self.pdftotext.chmod(0o755)

    def tearDown(self):
        self.temp.cleanup()

    def test_normalizes_unicode_case_and_whitespace_but_retains_punctuation(self):
        self.assertEqual(normalized_stem("¿Cuál  es?\n  ÁRBOL"), normalized_stem("¿cuál es? árbol"))
        self.assertNotEqual(normalized_stem("A > B"), normalized_stem("A >= B"))

    def test_revision_matches_application_fnv_over_utf16_code_units(self):
        self.assertEqual(question_revision(
            "Indique el número de veces que se ejecuta el cuerpo del siguiente bucle: int salto = 3; for (int i=0; i>0; i*=salto) System.out.println(i);",
            ["16.", "17.", "0.", "18."],
        ), "fnv1a-293085aa")

    def test_records_all_exact_pages_and_material_hash_without_section_assignment(self):
        question = {"i": "q-1", "t": "T3.03", "q": "Indique el número de veces: for (i=0; i>0;)", "a": ["0", "1"]}
        (self.questions / "T3.03.json").write_text(json.dumps([question], ensure_ascii=False), encoding="utf-8")
        curriculum = {"topics": [{"id": "T3.03", "files": [{
            "kind": "test", "path": "T3.03 Test.pdf", "sha256": "a" * 64,
        }]}]}
        result = build_candidates(curriculum, self.questions, self.source, str(self.pdftotext))
        candidate = result["questions"]["q-1"][0]
        source = result["materials"][candidate["sources"][0]["materialIndex"]]
        self.assertEqual(source, {"topicId":"T3.03", "path":"T3.03 Test.pdf", "sourceHash":"a" * 64})
        self.assertEqual(candidate["sources"][0]["pages"], [2, 3])
        self.assertNotIn("sectionId", candidate)
        self.assertEqual(result["processedTestMaterials"], 1)

    def test_reports_test_pdf_that_is_missing_instead_of_silently_counting_it(self):
        curriculum = {"topics": [{"id":"T3.03", "files":[{
            "kind":"test", "path":"missing.pdf", "sha256":"b" * 64,
        }]}]}
        result = build_candidates(curriculum, self.questions, self.source, str(self.pdftotext))
        self.assertEqual(result["testMaterialCount"], 1)
        self.assertEqual(result["processedTestMaterials"], 0)
        self.assertEqual(result["skippedTestMaterialPaths"], ["missing.pdf"])


if __name__ == "__main__":
    unittest.main()
