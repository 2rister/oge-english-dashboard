from __future__ import annotations

import json
import re
import urllib.error
import urllib.request
from pathlib import Path

from pypdf import PdfReader


ROOT_DIR = Path(__file__).resolve().parent.parent
ENV_PATH = ROOT_DIR / ".env"
DEFAULT_TASKS_PDF = ROOT_DIR / "oge files" / "23 gram" / "Vse_zadania_iz_otkrytogo_banka_zadaniy_FIPI_po_razdelu_Gram.pdf"
DEFAULT_ANSWERS_PDF = ROOT_DIR / "oge files" / "23 gram" / "23 ak.pdf"
SOURCE_TITLE = "ФИПИ 2023: банк заданий по грамматике и словообразованию"
SECTION = "grammar_vocabulary_bank"
YEAR = 2023
REQUIRED_COLLECTIONS = {
    "oge_grammar_variants",
    "oge_grammar_tasks",
}
SHORT_PRONOUN_CUES = {"I", "HE", "SHE", "IT", "WE", "YOU", "THEY", "ME", "HIM", "HER", "US", "THEM"}
TASK_TOPIC_MAP = {
    20: "Грамматика: видовременные формы / базовые формы глагола",
    21: "Грамматика: пассивный залог / длительные формы / согласование времен",
    22: "Грамматика: модальные формы / условные конструкции / формы глагола",
    23: "Грамматика: степени сравнения / числительные / местоимения",
    24: "Грамматика: местоимения / притяжательные формы / личные формы",
    25: "Грамматика: множественное число / исключения / существительные",
    26: "Грамматика: словообразование числительных / порядковые формы",
    27: "Грамматика: пассивный залог / причастия / формы глагола",
    28: "Грамматика: сравнительные конструкции / лексико-грамматические формы",
}


def main() -> None:
    env = load_env(ENV_PATH)
    pb_url = env.get("PB_URL", "http://127.0.0.1:8091").rstrip("/")
    admin_email = env.get("PB_ADMIN_EMAIL", "")
    admin_password = env.get("PB_ADMIN_PASSWORD", "")
    tasks_pdf = resolve_path(env.get("OGE_GRAMMAR_PDF_FILE", str(DEFAULT_TASKS_PDF)))
    answers_pdf = resolve_path(env.get("OGE_GRAMMAR_ANSWERS_FILE", str(DEFAULT_ANSWERS_PDF)))

    if not admin_email or not admin_password:
        raise RuntimeError("PB_ADMIN_EMAIL and PB_ADMIN_PASSWORD are required.")
    if not tasks_pdf.exists():
        raise RuntimeError(f"Tasks PDF file not found: {tasks_pdf}")
    if not answers_pdf.exists():
        raise RuntimeError(f"Answers PDF file not found: {answers_pdf}")

    parsed = parse_grammar_bank(tasks_pdf, answers_pdf)
    print(f"Parsed {len(parsed['variants'])} grammar variants and {len(parsed['tasks'])} grammar tasks")

    token = authenticate(pb_url, admin_email, admin_password)
    verify_collections(pb_url, token)
    replace_collection(pb_url, "oge_grammar_tasks", parsed["tasks"], token)
    replace_collection(pb_url, "oge_grammar_variants", parsed["variants"], token)
    print("Grammar bank import completed.")


def parse_grammar_bank(tasks_pdf: Path, answers_pdf: Path) -> dict[str, list[dict[str, object]]]:
    task_reader = PdfReader(str(tasks_pdf))
    answer_reader = PdfReader(str(answers_pdf))
    answer_map = parse_answer_key(answer_reader)
    page_texts = [normalize_text(page.extract_text() or "") for page in task_reader.pages]
    page_map = build_variant_page_map(page_texts)
    variant_blocks = parse_variant_blocks(page_texts)

    variants: list[dict[str, object]] = []
    tasks: list[dict[str, object]] = []

    for variant_number, text in variant_blocks:
        parsed_tasks = parse_tasks_from_page(text)
        answers = answer_map.get(variant_number, [])
        if len(parsed_tasks) != len(answers):
            raise RuntimeError(
                f"Variant {variant_number}: tasks count {len(parsed_tasks)} does not match answers count {len(answers)}."
            )

        variants.append(
            {
                "variantNumber": variant_number,
                "year": YEAR,
                "section": SECTION,
                "sourceTitle": SOURCE_TITLE,
                "sourceFile": relative_path(tasks_pdf),
                "answersSourceFile": relative_path(answers_pdf),
                "pageNumber": page_map.get(variant_number, variant_number),
                "tasksCount": len(parsed_tasks),
                "contentText": text.strip(),
            }
        )

        for order_index, (task, answer) in enumerate(zip(parsed_tasks, answers), start=1):
            task_number = 19 + order_index
            tasks.append(
                {
                    "taskKey": f"grammar-bank-{YEAR}-variant-{variant_number}-task-{task_number}",
                    "variantNumber": variant_number,
                    "taskNumber": task_number,
                    "orderIndex": order_index,
                    "year": YEAR,
                    "section": SECTION,
                    "topic": TASK_TOPIC_MAP.get(task_number, "Грамматика / словообразование"),
                    "cueWord": task["cueWord"],
                    "promptText": task["promptText"],
                    "answer": answer,
                    "sourceFile": relative_path(tasks_pdf),
                    "answersSourceFile": relative_path(answers_pdf),
                }
            )

    return {"variants": variants, "tasks": tasks}


def normalize_text(text: str) -> str:
    return text.replace("\x00", " ").replace("\u00a0", " ")


def build_variant_page_map(page_texts: list[str]) -> dict[int, int]:
    page_map: dict[int, int] = {}
    for page_index, text in enumerate(page_texts, start=1):
        match = re.search(r"Вариант\s+(\d+)", text)
        if match:
            page_map[int(match.group(1))] = page_index
    return page_map


def parse_variant_blocks(page_texts: list[str]) -> list[tuple[int, str]]:
    full_text = "\n".join(page_texts)
    blocks: list[tuple[int, str]] = []
    for match in re.finditer(r"Вариант\s+(\d+)\s*(.*?)(?=Вариант\s+\d+|$)", full_text, re.S):
        variant_number = int(match.group(1))
        content = f"Вариант {variant_number}\n{match.group(2).strip()}".strip()
        blocks.append((variant_number, content))
    if not blocks:
        raise RuntimeError("Could not find grammar bank variants in the tasks PDF.")
    return blocks


def parse_tasks_from_page(text: str) -> list[dict[str, str]]:
    lines = split_embedded_cue_lines(text)
    start_index = next((index for index, line in enumerate(lines) if re.fullmatch(r"Вариант\s+\d+", line)), -1)
    content_lines = lines[start_index + 1 :] if start_index != -1 else lines
    parsed = search_tasks(content_lines, 0, [], [])
    if parsed is None:
        raise RuntimeError("Could not reliably split grammar bank page into 9 tasks.")
    return parsed


def is_cue_word(line: str) -> bool:
    return bool(re.fullmatch(r"[A-Z][A-Z' ]{0,40}", line))


def has_gap(text: str) -> bool:
    return bool(re.search(r"_{5,}", text))


def search_tasks(
    lines: list[str],
    index: int,
    buffer: list[str],
    tasks: list[dict[str, str]],
) -> list[dict[str, str]] | None:
    if len(tasks) > 9:
        return None

    if index >= len(lines):
        if len(tasks) == 9 and not " ".join(buffer).strip():
            return tasks
        return None

    line = lines[index]
    buffer_text = " ".join(buffer).strip()

    if is_cue_word(line) and has_gap(buffer_text):
        prompt = buffer_text
        if prompt:
            parsed = search_tasks(
                lines,
                index + 1,
                [],
                [*tasks, {"promptText": prompt, "cueWord": line}],
            )
            if parsed is not None:
                return parsed

    return search_tasks(lines, index + 1, [*buffer, line], tasks)


def split_embedded_cue_lines(text: str) -> list[str]:
    normalized_lines: list[str] = []
    for raw_line in text.splitlines():
        line = raw_line.strip()
        if not line:
            continue

        match = re.match(r"^(.*\S)\s+([A-Z][A-Z' ]{0,40})$", line)
        if match and not is_cue_word(match.group(1)):
            normalized_lines.append(match.group(1).strip())
            normalized_lines.append(match.group(2).strip())
            continue

        normalized_lines.append(line)

    merged_lines: list[str] = []
    for line in normalized_lines:
        if merged_lines and is_cue_word(merged_lines[-1]) and is_cue_word(line):
            merged_lines[-1] = f"{merged_lines[-1]} {line}"
            continue
        merged_lines.append(line)

    return merged_lines


def parse_answer_key(reader: PdfReader) -> dict[int, list[str]]:
    text = "\n".join((page.extract_text() or "") for page in reader.pages)
    answers: dict[int, list[str]] = {}

    for match in re.finditer(r"Вариант\s+(\d+):\s*(.*?)(?=Вариант\s+\d+:|$)", text, re.S):
        variant_number = int(match.group(1))
        raw_block = re.sub(r"\s+", " ", match.group(2)).strip()
        items = [item.strip() for item in raw_block.split(",") if item.strip()]
        answers[variant_number] = items

    return answers


def relative_path(path: Path) -> str:
    return str(path.relative_to(ROOT_DIR))


def resolve_path(raw_path: str) -> Path:
    path = Path(raw_path)
    if not path.is_absolute():
        path = (ROOT_DIR / path).resolve()
    return path


def load_env(file_path: Path) -> dict[str, str]:
    if not file_path.exists():
        return {}

    env: dict[str, str] = {}
    for line in file_path.read_text("utf-8").splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith("#") or "=" not in stripped:
            continue
        key, value = stripped.split("=", 1)
        env[key.strip()] = value.strip()
    return env


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
            "Content-Type": "application/json",
            "Accept": "application/json",
            **({"Authorization": f"Bearer {token}"} if token else {}),
        },
    )
    try:
        with urllib.request.urlopen(request) as response:
            raw = response.read().decode("utf-8")
            return json.loads(raw) if raw else {}
    except urllib.error.HTTPError as error:
        detail = error.read().decode("utf-8", errors="replace")
        raise RuntimeError(f"PocketBase {error.code}: {detail}") from error


if __name__ == "__main__":
    main()
