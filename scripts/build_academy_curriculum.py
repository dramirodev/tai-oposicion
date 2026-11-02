#!/usr/bin/env python3
"""Index the student's academy folder into a source-backed, reviewable curriculum.

Only titles from PDF tables of contents and file metadata are emitted; document
body text is never copied into the application bundle. Requires Poppler's
pdftotext command. The output can be regenerated when the Drive folder changes.
"""

from __future__ import annotations

import argparse
import hashlib
import json
import re
import shutil
import subprocess
import sys
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

TOPIC_FOLDER = re.compile(r"^(T\d+\.\d{2})\s+(.+)$")
TOC_LINE = re.compile(r"^\s*(.*?)\s*\.{3,}\s*(\d{1,4})\s*$")
DEFAULT_SOURCE = Path("/Volumes/SSD/Google Drive/TEMARIO_OPOSICION/01_Temario")
DEFAULT_OUTPUT = Path("src/core/domain/academy-curriculum.generated.ts")


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as source:
        for chunk in iter(lambda: source.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()


def material_kind(path: Path) -> str:
    name = path.stem.casefold()
    if path.suffix.casefold() in {".md", ".txt"}:
        return "notes"
    if "temario" in name:
        return "syllabus"
    if "repaso" in name or "resumen" in name:
        return "review"
    if "test" in name or "pregunta" in name:
        return "test"
    if "ejercicio" in name or path.suffix.casefold() in {".sql", ".xlsx"}:
        return "exercise"
    if path.suffix.casefold() in {".m4a", ".mp3", ".wav", ".ogg"}:
        return "audio"
    return "other"


def extract_outline(path: Path, pdftotext: str) -> tuple[list[dict[str, Any]], str | None]:
    result = subprocess.run(
        [pdftotext, "-layout", str(path), "-"],
        check=False,
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
    )
    if result.returncode:
        return [], "pdftotext-error"

    lines = result.stdout.splitlines()
    index_at = next((i for i, line in enumerate(lines) if line.strip().casefold() in {"índice", "indice"}), None)
    if index_at is None:
        return [], "index-not-found"

    sections: list[dict[str, Any]] = []
    for line in lines[index_at + 1 :]:
        match = TOC_LINE.match(line)
        if not match:
            if line.startswith("\f") and sections:
                break
            continue
        title = re.sub(r"\s+", " ", match.group(1)).strip(" .\t")
        index_label = re.sub(r"\s+", "", title).casefold()
        if not title or index_label in {"índice", "indice"}:
            continue
        sections.append({"title": title, "printedPage": int(match.group(2))})

    return sections, None if sections else "index-has-no-extractable-entries"


def outline_fingerprints(sections: list[dict[str, Any]]) -> tuple[str, str]:
    """Fingerprint extracted headings and headings plus pages, never document body."""
    headings: list[str] = []
    canonical: list[list[Any]] = []
    for section in sections:
        title = re.sub(r"\s+", " ", section["title"]).strip().casefold()
        if re.sub(r"\s+", "", title) in {"índice", "indice"}:
            continue
        headings.append(title)
        canonical.append([title, section["printedPage"]])
    return (
        hashlib.sha256(json.dumps(headings, ensure_ascii=False, separators=(",", ":")).encode("utf-8")).hexdigest(),
        hashlib.sha256(json.dumps(canonical, ensure_ascii=False, separators=(",", ":")).encode("utf-8")).hexdigest(),
    )


def build_catalog(source_root: Path, app_index_path: Path, pdftotext: str) -> dict[str, Any]:
    if not source_root.is_dir():
        raise ValueError(f"No existe la carpeta de temario: {source_root}")
    if not pdftotext:
        raise ValueError("No se encuentra pdftotext; instala Poppler para extraer los índices.")

    app_index = json.loads(app_index_path.read_text(encoding="utf-8"))
    app_topics = {topic["id"]: topic for topic in app_index.get("temas", []) if isinstance(topic, dict) and isinstance(topic.get("id"), str)}
    folders = sorted(path for path in source_root.iterdir() if path.is_dir() and not path.name.startswith("."))
    topics: list[dict[str, Any]] = []
    seen_codes: set[str] = set()

    for folder in folders:
        match = TOPIC_FOLDER.match(folder.name)
        if not match:
            continue
        topic_id, topic_name = match.groups()
        if topic_id in seen_codes:
            raise ValueError(f"Código duplicado en la carpeta fuente: {topic_id}")
        seen_codes.add(topic_id)

        files: list[dict[str, Any]] = []
        sections: list[dict[str, Any]] = []
        outline_documents = 0
        file_counts: dict[str, int] = {}
        documents = sorted(path for path in folder.rglob("*") if path.is_file() and not path.name.startswith("."))
        for path in documents:
            relative_path = path.relative_to(source_root).as_posix()
            kind = material_kind(path)
            extracted: list[dict[str, Any]] = []
            issue: str | None = None
            if path.suffix.casefold() == ".pdf" and kind != "test":
                extracted, issue = extract_outline(path, pdftotext)
                if extracted and kind == "other":
                    kind = "syllabus"
            file_counts[kind] = file_counts.get(kind, 0) + 1
            if kind not in {"syllabus", "review", "notes", "exercise", "audio", "test"}:
                continue
            entry: dict[str, Any] = {
                "path": relative_path,
                "name": path.name,
                "kind": kind,
                "extension": path.suffix.casefold(),
                "sizeBytes": path.stat().st_size,
            }
            if kind in {"syllabus", "review", "notes", "exercise", "test"}:
                entry["sha256"] = sha256_file(path)

            if path.suffix.casefold() == ".pdf":
                entry["outlineStatus"] = "not-extracted-test" if kind == "test" else ("extracted" if extracted else issue)
                if extracted:
                    entry["outlineStructureFingerprint"], entry["outlineFingerprint"] = outline_fingerprints(extracted)
                    if kind == "syllabus":
                        outline_documents += 1
                    entry["outlineEntryCount"] = len(extracted)
                    for ordinal, section in enumerate(extracted, start=1):
                        stable_text = "|".join((topic_id, relative_path, str(section["printedPage"]), section["title"].casefold()))
                        section_id = "ci-" + hashlib.sha256(stable_text.encode("utf-8")).hexdigest()[:20]
                        sections.append({
                            "id": section_id,
                            "topicId": topic_id,
                            "title": section["title"],
                            "materialPath": relative_path,
                            "printedPage": section["printedPage"],
                            "sourceOrdinal": ordinal,
                            "sourceHash": entry["sha256"],
                            "materialKind": kind,
                            "outlineStructureFingerprint": entry["outlineStructureFingerprint"],
                            "outlineFingerprint": entry["outlineFingerprint"],
                            "verification": "extracted-needs-review",
                        })
            files.append(entry)

        syllabus_files = [file for file in files if file["kind"] == "syllabus"]
        alternatives = [file for file in syllabus_files if "alternativa" in file["name"].casefold()]
        primary_syllabus = [file for file in syllabus_files if "alternativa" not in file["name"].casefold()]
        if not syllabus_files:
            source_status = "no-syllabus-file"
        elif not primary_syllabus:
            source_status = "alternative-only"
        elif len(primary_syllabus) > 1:
            source_status = "multiple-volumes-or-syllabi"
        elif alternatives:
            source_status = "primary-and-alternative"
        elif not outline_documents:
            source_status = "syllabus-without-extractable-outline"
        else:
            source_status = "outline-extracted-needs-review"

        topics.append({
            "id": topic_id,
            "name": topic_name,
            "folder": folder.name,
            "appCatalogMatch": topic_id in app_topics,
            "appCatalogName": app_topics.get(topic_id, {}).get("nombre"),
            "sourceStatus": source_status,
            "sourceFileCounts": file_counts,
            "files": files,
            "sections": sections,
        })

    return {
        "schemaVersion": 1,
        "generatedAt": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "authority": "Google Drive/TEMARIO_OPOSICION/01_Temario",
        "extraction": "Poppler pdftotext -layout; only PDF index lines are copied, never document body text",
        "topics": topics,
        "unmatchedAppTopicIds": sorted(set(app_topics) - seen_codes),
        "sourceTopicIdsMissingFromAppCatalog": sorted(seen_codes - set(app_topics)),
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, default=DEFAULT_SOURCE, help="Carpeta original del temario en Drive")
    parser.add_argument("--app-index", type=Path, default=Path("public/data/index.json"))
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    arguments = parser.parse_args()
    pdftotext = shutil.which("pdftotext")
    try:
        catalog = build_catalog(arguments.source, arguments.app_index, pdftotext or "")
    except (OSError, ValueError, json.JSONDecodeError) as error:
        print(f"Error: {error}", file=sys.stderr)
        return 1

    arguments.output.parent.mkdir(parents=True, exist_ok=True)
    topic_output = arguments.output.parent / arguments.output.stem
    topic_output.mkdir(parents=True, exist_ok=True)
    for topic in catalog["topics"]:
        topic_file = topic_output / f"{topic['id']}.generated.ts"
        topic_file.write_text(
            "// Generado con scripts/build_academy_curriculum.py; no editar manualmente.\n"
            "import type { AcademyCurriculumTopic } from '../academy-curriculum-types.js';\n"
            "export const academyCurriculumTopic = " + json.dumps(topic, ensure_ascii=False, indent=2)
            + " as const satisfies AcademyCurriculumTopic;\n",
            encoding="utf-8",
        )
    loaders = "\n".join(
        f'  "{topic["id"]}": () => import("./{topic_output.name}/{topic["id"]}.generated.js"),'
        for topic in catalog["topics"]
    )
    arguments.output.write_text(
        "// Generado con scripts/build_academy_curriculum.py; no editar manualmente.\n"
        "import type { AcademyCurriculumTopic } from './academy-curriculum-types.js';\n"
        "type AcademyCurriculumModule = { academyCurriculumTopic: AcademyCurriculumTopic };\n"
        "export const academyCurriculumTopicLoaders: Record<string, () => Promise<AcademyCurriculumModule>> = {\n"
        f"{loaders}\n}};\n",
        encoding="utf-8",
    )
    matched = sum(topic["appCatalogMatch"] for topic in catalog["topics"])
    sections = sum(len(topic["sections"]) for topic in catalog["topics"])
    print(f"Catálogo generado: {arguments.output} · {len(catalog['topics'])} carpetas · {matched} IDs mapeados · {sections} entradas de índice")
    if catalog["unmatchedAppTopicIds"] or catalog["sourceTopicIdsMissingFromAppCatalog"]:
        print(f"IDs solo en app: {catalog['unmatchedAppTopicIds']}; solo en Drive: {catalog['sourceTopicIdsMissingFromAppCatalog']}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
