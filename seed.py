#!/usr/bin/env python3
import argparse
import hashlib
import json
import os
import sys
import warnings
from typing import Any, Dict, Iterable, List, Optional, Tuple

warnings.filterwarnings(
    "ignore",
    message=r"urllib3 v2 only supports OpenSSL.*",
)

try:
    from urllib3.exceptions import NotOpenSSLWarning

    warnings.filterwarnings("ignore", category=NotOpenSSLWarning)
except Exception:
    pass

import requests
from openai import OpenAI


def _require_env(name: str) -> str:
    value = os.environ.get(name)
    if not value:
        raise RuntimeError(f"Missing required environment variable: {name}")
    return value


def _as_str(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, str):
        return value
    return str(value)


def _stable_id(text: str) -> str:
    return hashlib.sha1(text.encode("utf-8")).hexdigest()


def _to_embedding_text(item: Dict[str, Any]) -> str:
    question = _as_str(item.get("text") or item.get("question") or item.get("prompt"))
    answer = _as_str(item.get("answer"))
    chapter = _as_str(item.get("chapter"))
    topic = _as_str(item.get("topic"))
    topics_list = item.get("topics")
    topics = ""
    if isinstance(topics_list, list):
        topics = ", ".join([_as_str(t).strip() for t in topics_list if _as_str(t).strip()])
    year = _as_str(item.get("year"))
    marks = _as_str(item.get("marks"))

    parts = [
        f"Chapter: {chapter}" if chapter else "",
        f"Topic: {topic}" if topic else "",
        f"Topics: {topics}" if topics else "",
        f"Year: {year}" if year else "",
        f"Marks: {marks}" if marks else "",
        f"Question: {question}" if question else "",
        f"Answer: {answer}" if answer else "",
    ]
    return "\n".join([p for p in parts if p]).strip()


def _is_primitive(value: Any) -> bool:
    return isinstance(value, (str, int, float, bool))


def _sanitize_metadata_value(value: Any) -> Any:
    if value is None:
        return None
    if _is_primitive(value):
        return value
    if isinstance(value, list):
        if all(_is_primitive(v) or v is None for v in value):
            return [v for v in value if v is not None]
        return json.dumps(value, ensure_ascii=True)
    if isinstance(value, dict):
        return json.dumps(value, ensure_ascii=True)
    return _as_str(value)


def _sanitize_metadata(item: Dict[str, Any]) -> Dict[str, Any]:
    out: Dict[str, Any] = {}
    for k, v in item.items():
        if k in ("values", "embedding"):
            continue
        sanitized = _sanitize_metadata_value(v)
        if sanitized is None:
            continue
        out[str(k)] = sanitized
    return out


def _load_items(json_path: str) -> List[Dict[str, Any]]:
    with open(json_path, "r", encoding="utf-8") as f:
        data = json.load(f)

    if isinstance(data, list):
        if not all(isinstance(x, dict) for x in data):
            raise RuntimeError("JSON array must contain objects.")
        return data  # type: ignore[return-value]

    if isinstance(data, dict):
        for key in ("items", "data", "questions", "records"):
            v = data.get(key)
            if isinstance(v, list) and all(isinstance(x, dict) for x in v):
                return v  # type: ignore[return-value]

    raise RuntimeError("Input JSON must be an array of objects (or an object with items/data/questions/records).")


def _chunk(items: List[Any], size: int) -> Iterable[List[Any]]:
    for i in range(0, len(items), size):
        yield items[i : i + size]


def _pinecone_upsert(
    *,
    host: str,
    api_key: str,
    namespace: str,
    vectors: List[Dict[str, Any]],
) -> Dict[str, Any]:
    base = host.strip()
    if not base.startswith("http://") and not base.startswith("https://"):
        base = f"https://{base}"
    base = base.rstrip("/")

    url = f"{base}/vectors/upsert"
    headers = {
        "Api-Key": api_key,
        "Content-Type": "application/json",
        "Accept": "application/json",
    }
    payload = {
        "vectors": vectors,
        "namespace": namespace,
    }

    resp = requests.post(url, headers=headers, json=payload, timeout=90)
    if resp.status_code >= 400:
        raise RuntimeError(f"Pinecone upsert failed ({resp.status_code}): {resp.text[:500]}")
    return resp.json()


def main() -> None:
    parser = argparse.ArgumentParser(
        description="Seed Pinecone with Class 10 Science PYQ JSON (OpenAI embeddings).",
    )
    parser.add_argument("json_path", help="Path to your PYQ JSON file")
    parser.add_argument("--namespace", default=os.environ.get("PINECONE_NAMESPACE", "class10-science"))
    parser.add_argument("--batch", type=int, default=50)
    parser.add_argument("--embedding-model", default=os.environ.get("OPENAI_EMBEDDING_MODEL", "text-embedding-3-small"))
    parser.add_argument("--host", default=os.environ.get("PINECONE_HOST", ""))
    parser.add_argument("--dry-run", action="store_true", help="Generate embeddings but do not upsert")
    args = parser.parse_args()

    openai_api_key = _require_env("OPENAI_API_KEY")
    pinecone_api_key = _require_env("PINECONE_API_KEY")
    _require_env("PINECONE_INDEX_NAME")  # enforced for consistency with the app env

    if not args.host:
        raise RuntimeError(
            "PINECONE_HOST is required for seed.py (set it to your index host from the Pinecone console)."
        )

    items = _load_items(args.json_path)
    if not items:
        raise RuntimeError("No items found in the JSON file.")

    client = OpenAI(api_key=openai_api_key)

    print(f"Loaded {len(items)} items from {args.json_path}")
    print(f"Namespace: {args.namespace}")
    print(f"Embedding model: {args.embedding_model}")
    print(f"Pinecone host: {args.host}")

    total = len(items)
    processed = 0

    for batch in _chunk(items, max(1, args.batch)):
        texts: List[str] = []
        metas: List[Dict[str, Any]] = []
        ids: List[str] = []

        for item in batch:
            text = _to_embedding_text(item)
            if not text:
                continue

            metadata = _sanitize_metadata(item)
            metadata.setdefault("text", text)
            metadata.setdefault("subject", "Science")
            metadata.setdefault("classLevel", 10)

            vector_id = _as_str(item.get("id")) or _stable_id(text)

            texts.append(text)
            metas.append(metadata)
            ids.append(vector_id)

        if not texts:
            processed += len(batch)
            continue

        emb = client.embeddings.create(model=args.embedding_model, input=texts)
        if not emb.data:
            raise RuntimeError("OpenAI embeddings returned no data.")

        vectors = []
        for i, row in enumerate(emb.data):
            vectors.append(
                {
                    "id": ids[i],
                    "values": row.embedding,
                    "metadata": metas[i],
                }
            )

        if args.dry_run:
            processed += len(batch)
            print(f"Dry-run: generated embeddings for {processed}/{total}")
            continue

        _pinecone_upsert(
            host=args.host,
            api_key=pinecone_api_key,
            namespace=args.namespace,
            vectors=vectors,
        )

        processed += len(batch)
        print(f"Upserted {processed}/{total}")

    print("Done.")


if __name__ == "__main__":
    try:
        main()
    except KeyboardInterrupt:
        print("Cancelled.")
        sys.exit(130)
    except Exception as e:
        print(str(e))
        sys.exit(1)
