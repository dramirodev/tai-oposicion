import json
import os
import tempfile
import unittest
from pathlib import Path

from scripts.build_academy_curriculum import build_catalog


class AcademyCurriculumBuildTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name)
        self.source = self.root / "academy"
        self.source.mkdir()
        self.app_index = self.root / "app-index.json"
        self.app_index.write_text(json.dumps({"temas": [{"id": "T1.01", "nombre": "Tema app"}]}), encoding="utf-8")
        self.pdftotext = self.root / "pdftotext"
        self.pdftotext.write_text(
            "#!/usr/bin/env python3\n"
            "print('ÍNDICE')\n"
            "print('  1. APARTADO DE PRUEBA ............................................................. 2')\n",
            encoding="utf-8",
        )
        self.pdftotext.chmod(0o755)

    def tearDown(self):
        self.temp.cleanup()

    def topic_folder(self, folder_name, file_names):
        folder = self.source / folder_name
        folder.mkdir()
        for name in file_names:
            (folder / name).write_bytes(b"source fixture")
        return folder

    def test_indexes_future_topic_ids_without_topic_specific_rules(self):
        self.topic_folder("T5.19 Tema nuevo", ["documento.pdf"])
        result = build_catalog(self.source, self.app_index, str(self.pdftotext))
        topic = result["topics"][0]
        self.assertEqual(topic["id"], "T5.19")
        self.assertFalse(topic["appCatalogMatch"])
        self.assertEqual(topic["sourceStatus"], "outline-extracted-needs-review")
        self.assertEqual(topic["sections"][0]["title"], "1. APARTADO DE PRUEBA")
        self.assertEqual(result["sourceTopicIdsMissingFromAppCatalog"], ["T5.19"])

    def test_keeps_multiple_volumes_separate_and_section_ids_stable(self):
        self.topic_folder("T1.01 Tema app", ["Temario parte 1.pdf", "Temario parte 2.pdf"])
        first = build_catalog(self.source, self.app_index, str(self.pdftotext))["topics"][0]
        second = build_catalog(self.source, self.app_index, str(self.pdftotext))["topics"][0]
        self.assertEqual(first["sourceStatus"], "multiple-volumes-or-syllabi")
        self.assertEqual(len(first["sections"]), 2)
        self.assertNotEqual(first["sections"][0]["id"], first["sections"][1]["id"])
        self.assertEqual(first["sections"][0]["id"], second["sections"][0]["id"])
        self.assertEqual(first["sections"][0]["outlineStructureFingerprint"], first["sections"][1]["outlineStructureFingerprint"])
        self.assertEqual(first["sections"][0]["outlineFingerprint"], first["sections"][1]["outlineFingerprint"])

    def test_indexes_supplementary_pdf_without_calling_it_a_syllabus(self):
        self.topic_folder("T3.06 Tema app", ["Resumen - Java.pdf"])
        topic = build_catalog(self.source, self.app_index, str(self.pdftotext))["topics"][0]
        self.assertEqual(topic["sourceStatus"], "no-syllabus-file")
        self.assertEqual(topic["sections"][0]["materialKind"], "review")
        self.assertEqual(topic["sections"][0]["title"], "1. APARTADO DE PRUEBA")

    def test_plain_text_named_temario_is_not_counted_as_a_syllabus_pdf(self):
        self.topic_folder("T1.01 Tema app", ["Temario.txt"])
        topic = build_catalog(self.source, self.app_index, str(self.pdftotext))["topics"][0]
        self.assertEqual(topic["files"][0]["kind"], "notes")
        self.assertEqual(topic["sourceStatus"], "no-syllabus-file")


if __name__ == "__main__":
    unittest.main()
