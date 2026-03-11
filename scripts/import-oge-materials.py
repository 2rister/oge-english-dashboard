from __future__ import annotations

import json
import os
import re
import sys
import urllib.error
import urllib.request
from pathlib import Path

from pypdf import PdfReader


ROOT_DIR = Path(__file__).resolve().parent.parent
ENV_PATH = ROOT_DIR / ".env"
DEFAULT_PDF = ROOT_DIR / "oge files" / "Sbornik_variantov_OGE_na_osnove_FIPI.pdf"
SOURCE_TITLE = "Сборник вариантов ОГЭ на основе открытого банка заданий ФИПИ"
REQUIRED_COLLECTIONS = {
    "student_summaries",
    "student_results",
    "oge_variants",
    "oge_variant_answers",
}

GRAMMAR_TOPICS = {
    20: "Past Simple / степени сравнения / множественное число",
    21: "Past Simple / отрицательные формы / Past Continuous",
    22: "Passive Voice / степени сравнения / Past Simple",
    23: "Past Simple / нестандартное множественное число / отрицание",
    24: "Past Simple / степени сравнения / отрицательные формы",
    25: "Present Perfect / местоимения / Past Simple",
    26: "Порядковые числительные / местоимения / отрицательные формы",
    27: "Past Perfect / Past Simple / степени сравнения",
    28: "Present Perfect / нестандартное множественное число",
}

WORD_FORMATION_TOPICS = {
    29: "Существительные: -tion / -ance / -ment / -er",
    30: "Прилагательные: -ous / -ful / -al / -ive / -able",
    31: "Существительные: -er / -or / -ist / -ness / -ion",
    32: "Прилагательные: -able / -ful / -ous / -ive / -ing / -ed",
    33: "Отрицательные префиксы и прилагательные: un- / im- / in-",
    34: "Отрицательные префиксы: un- / im- / in- / dis- / ir-",
}


def main() -> None:
    env = load_env(ENV_PATH)
    pb_url = env.get("PB_URL", "http://127.0.0.1:8091").rstrip("/")
    admin_email = env.get("PB_ADMIN_EMAIL", "")
    admin_password = env.get("PB_ADMIN_PASSWORD", "")
    pdf_path = Path(env.get("OGE_PDF_FILE", str(DEFAULT_PDF)))
    if not pdf_path.is_absolute():
        pdf_path = (ROOT_DIR / pdf_path).resolve()

    if not admin_email or not admin_password:
        raise RuntimeError("PB_ADMIN_EMAIL and PB_ADMIN_PASSWORD are required.")
    if not pdf_path.exists():
        raise RuntimeError(f"PDF file not found: {pdf_path}")

    parsed = parse_pdf(pdf_path)
    print(f"Parsed {len(parsed['variants'])} variants and {len(parsed['answers'])} answers from {pdf_path.name}")

    token = authenticate(pb_url, admin_email, admin_password)
    verify_collections(pb_url, token)
    replace_collection(pb_url, "oge_variant_answers", parsed["answers"], token)
    replace_collection(pb_url, "oge_variants", parsed["variants"], token)
    print("OGE materials import completed.")


def parse_pdf(pdf_path: Path) -> dict[str, list[dict[str, object]]]:
    reader = PdfReader(str(pdf_path))
    texts = [(page.extract_text() or "").replace("\x00", " ") for page in reader.pages]
    answer_page_start = find_answer_page_start(texts)
    answer_page_end = len(texts)

    variant_ranges = find_variant_ranges(texts, answer_page_start)
    answer_map = parse_answers(texts[answer_page_start - 1 : answer_page_end])

    variants = []
    answers = []

    for variant_number, page_start, page_end in variant_ranges:
      content = "\n\n".join(texts[page_start - 1 : page_end]).strip()
      analysis_text = extract_analysis_text(content)
      parts = split_text(analysis_text, 4500, 3)
      variants.append({
          "variantNumber": variant_number,
          "sourceTitle": SOURCE_TITLE,
          "sourceFile": str(pdf_path.relative_to(ROOT_DIR)),
          "pageStart": page_start,
          "pageEnd": page_end,
          "pageCount": page_end - page_start + 1,
          "answerPageStart": answer_page_start,
          "answerPageEnd": answer_page_end,
          "contentText": f"Аналитический фрагмент варианта {variant_number}: Чтение + задания 20–34",
          "contentPart1": parts[0],
          "contentPart2": parts[1],
          "contentPart3": parts[2],
      })

      for task_number, answer in sorted(answer_map.get(variant_number, {}).items()):
          answers.append({
              "answerKey": f"variant-{variant_number}-task-{task_number}",
              "variantNumber": variant_number,
              "taskNumber": task_number,
              "section": section_for_task(task_number),
              "topic": topic_for_task(task_number),
              "answer": answer,
              "sourceFile": str(pdf_path.relative_to(ROOT_DIR)),
          })

    return {"variants": variants, "answers": answers}


def find_answer_page_start(texts: list[str]) -> int:
    for index, text in enumerate(texts, start=1):
        head = "\n".join(text.splitlines()[:12])
        if "Оглавление" in head:
            continue
        if re.search(r"(^|\n)\s*Ответы\s*($|\n)", head):
            return index
    raise RuntimeError("Could not find the 'Ответы' section in the PDF.")


def find_variant_ranges(texts: list[str], answer_page_start: int) -> list[tuple[int, int, int]]:
    starts: list[tuple[int, int]] = []
    for index, text in enumerate(texts[: answer_page_start - 1], start=1):
        head = "\n".join(text.splitlines()[:12])
        if "Оглавление" in head:
            continue
        match = re.search(r"(^|\n)\s*Вариант\s+(\d+)\s*($|\n)", head)
        if match:
            starts.append((int(match.group(2)), index))

    deduped: list[tuple[int, int]] = []
    seen = set()
    for variant_number, page_start in sorted(starts, key=lambda item: item[0]):
        if variant_number in seen:
            continue
        seen.add(variant_number)
        deduped.append((variant_number, page_start))

    ranges: list[tuple[int, int, int]] = []
    for position, (variant_number, page_start) in enumerate(deduped):
        next_start = deduped[position + 1][1] if position + 1 < len(deduped) else answer_page_start
        ranges.append((variant_number, page_start, next_start - 1))
    return ranges


def parse_answers(answer_texts: list[str]) -> dict[int, dict[int, str]]:
    text = "\n".join(answer_texts)
    answers: dict[int, dict[int, str]] = {}

    for variant_number in range(1, 16):
        next_variant = variant_number + 1
        pattern = rf"Вариант\s+{variant_number}\s+(.*?)(?=Вариант\s+{next_variant}\b|$)"
        match = re.search(pattern, text, re.S)
        if not match:
            continue

        block = match.group(1)
        pairs = re.findall(r"(\d+)\.\s*([A-ZА-Я0-9]+)", block)
        answers[variant_number] = {int(task): answer for task, answer in pairs}

    return answers


def section_for_task(task_number: int) -> str:
    if 1 <= task_number <= 11:
        return "listening"
    if 12 <= task_number <= 19:
        return "reading"
    if 20 <= task_number <= 28:
        return "grammar"
    if 29 <= task_number <= 34:
        return "vocabulary"
    return "other"


def topic_for_task(task_number: int) -> str:
    if task_number in GRAMMAR_TOPICS:
        return GRAMMAR_TOPICS[task_number]
    if task_number in WORD_FORMATION_TOPICS:
        return WORD_FORMATION_TOPICS[task_number]
    if 12 <= task_number <= 19:
        return "Чтение / соответствие текстов / true-false-not stated"
    return ""


def extract_analysis_text(content: str) -> str:
    reading_start = content.find("Раздел 2. Чтение")
    writing_start = content.find("Раздел 4. Задания по письму")
    if reading_start != -1 and writing_start != -1 and reading_start < writing_start:
        return content[reading_start:writing_start].strip()
    return content[:5000].strip()


def split_text(content: str, chunk_size: int, chunks_count: int) -> list[str]:
    parts = [content[index : index + chunk_size] for index in range(0, len(content), chunk_size)]
    if len(parts) > chunks_count:
        raise RuntimeError("Analysis text is too large for the configured content parts.")
    while len(parts) < chunks_count:
        parts.append("")
    return parts


def authenticate(pb_url: str, email: str, password: str) -> str:
    payload = {"identity": email, "password": password}
    response = request_json(
        pb_url,
        "/api/collections/_superusers/auth-with-password",
        method="POST",
        body=payload,
    )
    return str(response["token"])


def verify_collections(pb_url: str, token: str) -> None:
    response = request_json(pb_url, "/api/collections?perPage=200", token=token)
    existing = {item["name"] for item in response.get("items", [])}
    missing = REQUIRED_COLLECTIONS - existing
    if missing:
        raise RuntimeError(f"Missing PocketBase collections: {', '.join(sorted(missing))}.")


def replace_collection(pb_url: str, collection: str, records: list[dict[str, object]], token: str) -> None:
    existing = list_all(pb_url, collection, token)
    for record in existing:
        request_json(pb_url, f"/api/collections/{collection}/records/{record['id']}", method="DELETE", token=token)
    for record in records:
        request_json(pb_url, f"/api/collections/{collection}/records", method="POST", token=token, body=record)


def list_all(pb_url: str, collection: str, token: str) -> list[dict[str, object]]:
    items: list[dict[str, object]] = []
    page = 1
    while True:
        response = request_json(pb_url, f"/api/collections/{collection}/records?page={page}&perPage=200", token=token)
        items.extend(response.get("items", []))
        if response.get("page", 1) >= response.get("totalPages", 1) or not response.get("items"):
            break
        page += 1
    return items


def request_json(
    pb_url: str,
    resource: str,
    *,
    method: str = "GET",
    token: str = "",
    body: dict[str, object] | None = None,
) -> dict[str, object]:
    url = f"{pb_url}{resource}"
    data = json.dumps(body).encode("utf-8") if body is not None else None
    request = urllib.request.Request(
        url,
        data=data,
        method=method,
        headers={
            "Accept": "application/json",
            "Content-Type": "application/json",
            **({"Authorization": f"Bearer {token}"} if token else {}),
        },
    )
    try:
        with urllib.request.urlopen(request) as response:
            raw = response.read().decode("utf-8")
            return json.loads(raw) if raw else {}
    except urllib.error.HTTPError as error:
        raw = error.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"PocketBase {error.code}: {raw}") from error


def load_env(env_path: Path) -> dict[str, str]:
    values: dict[str, str] = {}
    if not env_path.exists():
        return values
    for line in env_path.read_text(encoding="utf-8").splitlines():
        line = line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, value = line.split("=", 1)
        values[key] = value
    return values


if __name__ == "__main__":
    try:
        main()
    except Exception as error:
        print(str(error), file=sys.stderr)
        sys.exit(1)
