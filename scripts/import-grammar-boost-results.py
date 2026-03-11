from __future__ import annotations

import json
import sys
import urllib.error
import urllib.parse
import urllib.request
from pathlib import Path


ROOT_DIR = Path(__file__).resolve().parent.parent
ENV_PATH = ROOT_DIR / ".env"
DEFAULT_RESULTS_PATH = ROOT_DIR / "boost outputs" / "grammar-boost-results.txt"


def main() -> None:
    env = load_env(ENV_PATH)
    results_path = Path(sys.argv[1]).resolve() if len(sys.argv) > 1 else DEFAULT_RESULTS_PATH
    if not results_path.exists():
        raise RuntimeError(
            f"Results file not found: {results_path}. "
            "Expected lines like 'Безбородкин 11100100' or 'Безбородкин Иван 11100100'."
        )

    base_url = env.get("PB_URL", "http://127.0.0.1:8091").rstrip("/")
    email = env.get("PB_ADMIN_EMAIL", "")
    password = env.get("PB_ADMIN_PASSWORD", "")

    token = authenticate(base_url, email, password)
    updates = parse_results(results_path)
    records = list_all(base_url, "student_grammar_boosts", token)
    by_full_name = {normalize_name(str(record["fullName"])): record for record in records}

    applied = 0
    for full_name, mask in updates:
        key = normalize_name(full_name)
        record = by_full_name.get(key)
        if not record:
            record = find_by_prefix(records, key)
        if not record:
            raise RuntimeError(f"Student not found in student_grammar_boosts: {full_name}")

        task_count = int(record.get("taskCount", 0) or 0)
        if task_count <= 0:
            raise RuntimeError(f"Record has invalid taskCount for {record.get('fullName')}")
        if len(mask) != task_count:
            raise RuntimeError(
                f"Mask length mismatch for {record.get('fullName')}: expected {task_count}, got {len(mask)} ({mask})"
            )

        body = {
            "answerMask": mask,
            "correctCount": mask.count("1"),
            "status": "checked",
        }
        request_json(
            base_url,
            f"/api/collections/student_grammar_boosts/records/{record['id']}",
            method="PATCH",
            token=token,
            body=body,
        )
        applied += 1

    print(f"Updated {applied} grammar boost results from {results_path}")


def parse_results(path: Path) -> list[tuple[str, str]]:
    updates: list[tuple[str, str]] = []
    for raw_line in path.read_text("utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#"):
            continue
        try:
            full_name, mask = line.rsplit(" ", 1)
        except ValueError as error:
            raise RuntimeError(f"Invalid line: {line}") from error
        if not mask or any(char not in {"0", "1"} for char in mask):
            raise RuntimeError(f"Invalid answer mask in line: {line}")
        updates.append((full_name.strip(), mask.strip()))
    return updates


def find_by_prefix(records: list[dict[str, object]], key: str) -> dict[str, object] | None:
    matches = [record for record in records if normalize_name(str(record.get("fullName", ""))).startswith(key)]
    if len(matches) == 1:
        return matches[0]
    return None


def normalize_name(value: str) -> str:
    return " ".join(value.lower().replace("ё", "е").split())


def load_env(path: Path) -> dict[str, str]:
    env: dict[str, str] = {}
    if not path.exists():
        return env
    for line in path.read_text("utf-8").splitlines():
        stripped = line.strip()
        if not stripped or stripped.startswith("#") or "=" not in stripped:
            continue
        key, value = stripped.split("=", 1)
        env[key.strip()] = value.strip()
    return env


def authenticate(base_url: str, email: str, password: str) -> str:
    if not email or not password:
        raise RuntimeError("PB_ADMIN_EMAIL and PB_ADMIN_PASSWORD are required.")

    payload = {"identity": email, "password": password}
    response = request_json(
        base_url,
        "/api/collections/_superusers/auth-with-password",
        method="POST",
        body=payload,
    )
    return str(response["token"])


def list_all(base_url: str, collection: str, token: str) -> list[dict[str, object]]:
    items: list[dict[str, object]] = []
    page = 1
    while True:
        response = request_json(
            base_url,
            f"/api/collections/{collection}/records?page={page}&perPage=200&sort=fullName",
            token=token,
        )
        items.extend(response.get("items", []))
        if page >= response.get("totalPages", 1):
            break
        page += 1
    return items


def request_json(
    base_url: str,
    resource: str,
    *,
    method: str = "GET",
    token: str = "",
    body: dict[str, object] | None = None,
) -> dict[str, object]:
    request = urllib.request.Request(
        f"{base_url}{resource}",
        data=json.dumps(body).encode("utf-8") if body is not None else None,
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
