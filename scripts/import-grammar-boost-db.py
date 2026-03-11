from __future__ import annotations

import json
import urllib.error
import urllib.request
from pathlib import Path


ROOT_DIR = Path(__file__).resolve().parent.parent
ENV_PATH = ROOT_DIR / ".env"
BOOST_OUTPUTS_DIR = ROOT_DIR / "boost outputs"
REQUIRED_COLLECTIONS = {"student_grammar_boosts"}
DEFAULT_DURATION_MINUTES = 20


def main() -> None:
    env = load_env(ENV_PATH)
    manifest_path = resolve_manifest_path()
    base_url = env.get("PB_URL", "http://127.0.0.1:8091").rstrip("/")
    email = env.get("PB_ADMIN_EMAIL", "")
    password = env.get("PB_ADMIN_PASSWORD", "")

    token = authenticate(base_url, email, password)
    verify_collections(base_url, token)

    payload = json.loads(manifest_path.read_text("utf-8"))
    records = build_records(payload, manifest_path)
    replace_collection(base_url, "student_grammar_boosts", records, token)
    print(f"Imported {len(records)} grammar boost records from {manifest_path}")


def resolve_manifest_path() -> Path:
    manifests = sorted(BOOST_OUTPUTS_DIR.glob("grammar-boost-*/manifest.json"), key=lambda item: item.stat().st_mtime, reverse=True)
    if not manifests:
        raise RuntimeError("No grammar boost manifest found in boost outputs.")
    return manifests[0]


def build_records(items: list[dict[str, object]], manifest_path: Path) -> list[dict[str, object]]:
    records = []
    for item in items:
        tasks = item.get("tasks", [])
        answers = [str(task.get("answer", "")).strip() for task in tasks]
        records.append(
            {
                "boostKey": f"{item['fullName']}__grammar_boost",
                "studentKey": normalize_name(str(item["fullName"])),
                "fullName": str(item["fullName"]),
                "groupName": str(item["groupName"]),
                "boostTitle": "Grammar Boost Variant",
                "durationMinutes": DEFAULT_DURATION_MINUTES,
                "taskCount": len(tasks),
                "weakTopics": "\n".join(str(topic) for topic in item.get("weakTopics", [])),
                "tasksJson": json.dumps(tasks, ensure_ascii=False),
                "answerKeyJson": json.dumps(answers, ensure_ascii=False),
                "answerMask": "",
                "correctCount": 0,
                "sourceManifest": str(manifest_path.relative_to(ROOT_DIR)),
                "status": "assigned",
            }
        )
    return records


def normalize_name(value: str) -> str:
    return (
        value.strip()
        .lower()
        .replace("ё", "е")
        .replace("/", "-")
        .replace("(", "")
        .replace(")", "")
        .replace(" ", "-")
    )


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


def verify_collections(base_url: str, token: str) -> None:
    response = request_json(base_url, "/api/collections?perPage=200", token=token)
    existing = {item["name"] for item in response.get("items", [])}
    missing = REQUIRED_COLLECTIONS - existing
    if missing:
        raise RuntimeError(f"Missing PocketBase collections: {', '.join(sorted(missing))}.")


def replace_collection(base_url: str, collection: str, records: list[dict[str, object]], token: str) -> None:
    existing = list_all(base_url, collection, token)
    for record in existing:
        request_json(base_url, f"/api/collections/{collection}/records/{record['id']}", method="DELETE", token=token)
    for record in records:
        request_json(base_url, f"/api/collections/{collection}/records", method="POST", token=token, body=record)


def list_all(base_url: str, collection: str, token: str) -> list[dict[str, object]]:
    items: list[dict[str, object]] = []
    page = 1
    while True:
        response = request_json(base_url, f"/api/collections/{collection}/records?page={page}&perPage=200", token=token)
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
