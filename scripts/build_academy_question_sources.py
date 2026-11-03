"""Generate exact question-to-academy-test page candidates; never infer a syllabus section."""

from __future__ import annotations

import json
import argparse
import shutil
import subprocess
import unicodedata
from pathlib import Path
from typing import Any

try:
    from scripts.build_academy_curriculum import DEFAULT_SOURCE, build_catalog
except ModuleNotFoundError:
    from build_academy_curriculum import DEFAULT_SOURCE, build_catalog

DEFAULT_OUTPUT = Path("src/core/domain/academy-question-source-candidates.generated.ts")


def normalized_stem(value: str) -> str:
    """Normalize Unicode, case and whitespace only; preserve punctuation and wording."""
    value = unicodedata.normalize("NFKC", value).casefold()
    return "".join(character for character in value if not character.isspace())


def question_revision(statement: str, options: list[str]) -> str:
    """Match the application's FNV-1a revision over UTF-16 code units."""
    content = "\0".join([statement, *options])
    encoded = content.encode("utf-16-le", errors="surrogatepass")
    value = 2166136261
    for index in range(0, len(encoded), 2):
        code_unit = encoded[index] | (encoded[index + 1] << 8)
        value ^= code_unit
        value = (value * 16777619) & 0xFFFFFFFF
    return f"fnv1a-{value:08x}"


def build_candidates(
    curriculum: dict[str, Any], question_root: Path, source_root: Path, pdftotext: str,
) -> dict[str, Any]:
    sources: list[dict[str, Any]] = []
    test_material_count = 0
    skipped_material_paths: list[str] = []
    for topic in curriculum["topics"]:
        for material in topic["files"]:
            if material.get("kind") != "test" or not material.get("sha256"):
                continue
            test_material_count += 1
            path = source_root / material["path"]
            if not path.is_file():
                skipped_material_paths.append(material["path"])
                continue
            result = subprocess.run(
                [pdftotext, "-layout", str(path), "-"], check=False,
                capture_output=True, text=True, encoding="utf-8", errors="replace",
            )
            if result.returncode:
                skipped_material_paths.append(material["path"])
                continue
            pages = result.stdout.split("\f")
            sources.append({
                "topicId": topic["id"], "path": material["path"],
                "sourceHash": material["sha256"],
                "pageText": [normalized_stem(page) for page in pages],
            })

    candidates: dict[str, dict[tuple[str, str], dict[str, Any]]] = {}
    for question_path in sorted(question_root.glob("T*.json")):
        try:
            questions = json.loads(question_path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            continue
        if not isinstance(questions, list):
            continue
        for question in questions:
            if not isinstance(question, dict) or not isinstance(question.get("i"), str):
                continue
            statement, options = question.get("q"), question.get("a")
            topic_id = question.get("t")
            if not isinstance(statement, str) or not isinstance(options, list) or not all(isinstance(option, str) for option in options):
                continue
            if not isinstance(topic_id, str):
                continue
            stem = normalized_stem(statement)
            if not stem:
                continue
            revision = question_revision(statement, options)
            identity = (revision, topic_id)
            by_revision = candidates.setdefault(question["i"], {})
            candidate = by_revision.setdefault(identity, {
                "questionId": question["i"], "questionTopicId": topic_id,
                "contentRevision": revision, "sources": [],
            })
            for source in sources:
                pages = [index + 1 for index, text in enumerate(source["pageText"]) if stem in text]
                if pages:
                    candidate["sources"].append({
                        "testMaterialTopicId": source["topicId"], "path": source["path"],
                        "sourceHash": source["sourceHash"], "pages": pages,
                    })

    output: dict[str, list[dict[str, Any]]] = {}
    material_references: list[dict[str, str]] = []
    material_ids: dict[tuple[str, str, str], int] = {}
    for question_id, entries in candidates.items():
        matches = [entry for entry in entries.values() if entry["sources"]]
        if matches:
            compact_matches = []
            for entry in matches:
                references = []
                for source in entry["sources"]:
                    identity = (source["testMaterialTopicId"], source["path"], source["sourceHash"])
                    if identity not in material_ids:
                        material_ids[identity] = len(material_references)
                        material_references.append({"topicId":identity[0], "path":identity[1], "sourceHash":identity[2]})
                    references.append({"materialIndex":material_ids[identity], "pages":source["pages"]})
                compact_matches.append({
                    "questionTopicId":entry["questionTopicId"], "contentRevision":entry["contentRevision"],
                    "sources":references,
                })
            output[question_id] = compact_matches
    return {
        "schemaVersion": 1,
        "matching": "exact question statement after NFKC/casefold/whitespace removal; punctuation retained",
        "materials": material_references,
        "questions": output,
        "testMaterialCount": test_material_count,
        "processedTestMaterials": len(sources),
        "skippedTestMaterialPaths": skipped_material_paths,
        "skippedTestMaterials": len(skipped_material_paths),
        "matchedQuestionIds": len(output),
    }


def render_typescript(candidates: dict[str, Any]) -> str:
    data = candidates
    return (
        "// Generated from local public/data question bank and Google Drive academy test PDFs. Do not edit.\n"
        "import type { AcademyQuestionSourceCandidateIndex } from './academy-question-source-candidates.js';\n"
        "export const academyQuestionSourceCandidates: AcademyQuestionSourceCandidateIndex = "
        + json.dumps(data, ensure_ascii=False, separators=(",", ":"))
        + ";\n"
    )


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, default=DEFAULT_SOURCE)
    parser.add_argument("--app-index", type=Path, default=Path("public/data/index.json"))
    parser.add_argument("--questions", type=Path, default=Path("public/data"))
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    arguments = parser.parse_args()
    pdftotext = shutil.which("pdftotext")
    if not pdftotext:
        parser.error("No se encuentra pdftotext; instala Poppler para localizar las preguntas.")
    curriculum = build_catalog(arguments.source, arguments.app_index, pdftotext)
    candidates = build_candidates(curriculum, arguments.questions, arguments.source, pdftotext)
    arguments.output.parent.mkdir(parents=True, exist_ok=True)
    arguments.output.write_text(render_typescript(candidates), encoding="utf-8")
    print(
        f"Candidatos de fuente generados: {arguments.output} · "
        f"{candidates['processedTestMaterials']}/{candidates['testMaterialCount']} PDF de test procesados · "
        f"{candidates['matchedQuestionIds']} IDs de pregunta · "
        f"{candidates['skippedTestMaterials']} PDF omitidos"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
