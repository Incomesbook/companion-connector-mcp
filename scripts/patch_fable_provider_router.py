from pathlib import Path
import time
server = Path(r'J:\Setup_VcCode_Workspace\S21_Shared_VSCode_Runtime\runtime\VSCodePortable\data\user-data\User\mcp-servers\fable5-connector\server.py')
text = server.read_text(encoding='utf-8')
backup = server.with_suffix('.server_py_backup_before_provider_router.py')
if not backup.exists():
    backup.write_text(text, encoding='utf-8')
if 'GROQ_API_KEY = os.environ.get("GROQ_API_KEY", "")' not in text:
    text = text.replace('# --- Бесплатные зеркала (сортируются динамически) ---', 'GROQ_API_KEY = os.environ.get("GROQ_API_KEY", "")\nOPENAI_API_KEY = os.environ.get("OPENAI_API_KEY", "")\nOPENAI_MODEL = os.environ.get("OPENAI_MODEL", "gpt-4o-mini")\nOLLAMA_URL = os.environ.get("OLLAMA_URL", "http://127.0.0.1:11434/api/chat")\nOLLAMA_MODEL = os.environ.get("OLLAMA_MODEL", "llama3.1:8b")\n\n# --- Бесплатные зеркала (сортируются динамически) ---')
if '"name": "openai"' not in text:
    text = text.replace('MIRRORS = [\n    {', 'MIRRORS = [\n    {\n        "name": "openai",\n        "api": "https://api.openai.com/v1/chat/completions",\n        "remain": None,\n        "type": "openai",\n        "last_success": 0,\n        "errors_in_row": 0,\n        "circuit_open_until": 0,\n        "quota_used": 0,\n    },\n    {')
if '"name": "ollama"' not in text:
    text = text.replace('MIRRORS = [\n    {', 'MIRRORS = [\n    {\n        "name": "ollama",\n        "api": OLLAMA_URL,\n        "remain": None,\n        "type": "ollama",\n        "last_success": 0,\n        "errors_in_row": 0,\n        "circuit_open_until": 0,\n        "quota_used": 0,\n    },\n    {')
insert_after = 'def call_free2gpt(prompt: str) -> tuple[str, str | None]:\n'
provider_funcs = r'''
def call_openai(prompt: str) -> tuple[str, str | None]:
    """OpenAI-compatible paid/reliable provider when OPENAI_API_KEY is set."""
    if not OPENAI_API_KEY:
        raise RuntimeError("OPENAI_API_KEY is not set")
    body = json.dumps({
        "model": OPENAI_MODEL,
        "messages": [{"role": "user", "content": prompt}],
        "max_tokens": 4096,
    }).encode()
    raw = _do_request(
        "https://api.openai.com/v1/chat/completions",
        body,
        attempts=2,
        timeout=60,
        headers={"Authorization": f"Bearer {OPENAI_API_KEY}", "User-Agent": "fable5-mcp/1.0"},
    )
    payload = json.loads(raw.decode())
    return payload["choices"][0]["message"]["content"], payload.get("model", OPENAI_MODEL)


def call_ollama(prompt: str) -> tuple[str, str | None]:
    """Local Ollama provider when installed/running."""
    body = json.dumps({
        "model": OLLAMA_MODEL,
        "messages": [{"role": "user", "content": prompt}],
        "stream": False,
    }).encode()
    raw = _do_request(OLLAMA_URL, body, attempts=1, timeout=300)
    payload = json.loads(raw.decode())
    msg = payload.get("message", {})
    return msg.get("content", payload.get("response", "")), payload.get("model", OLLAMA_MODEL)

'''
if 'def call_openai(prompt: str)' not in text:
    pos = text.find(insert_after)
    if pos == -1:
        raise SystemExit('insert point not found')
    text = text[:pos] + provider_funcs + text[pos:]
if 'if not GROQ_API_KEY:' not in text:
    text = text.replace('def call_groq(prompt: str) -> tuple[str, str | None]:\n    """Вызов Groq API (бесплатно, llama-3.3-70b)."""', 'def call_groq(prompt: str) -> tuple[str, str | None]:\n    """Вызов Groq API when GROQ_API_KEY is set."""\n    if not GROQ_API_KEY:\n        raise RuntimeError("GROQ_API_KEY is not set")')
old = '''def call_mirror(prompt: str, mirror: dict) -> tuple[str, str | None]:
    """Универсальный вызов зеркала. Возвращает (текст, модель)."""
    if mirror["type"] == "groq":
        return call_groq(prompt)
    if mirror["type"] == "free2gpt":
        return call_free2gpt(prompt)
    raise ValueError(f"Unknown mirror type: {mirror['type']}")
'''
new = '''def call_mirror(prompt: str, mirror: dict) -> tuple[str, str | None]:
    """Универсальный вызов зеркала. Возвращает (текст, модель)."""
    if mirror["type"] == "openai":
        return call_openai(prompt)
    if mirror["type"] == "ollama":
        return call_ollama(prompt)
    if mirror["type"] == "groq":
        return call_groq(prompt)
    if mirror["type"] == "free2gpt":
        return call_free2gpt(prompt)
    raise ValueError(f"Unknown mirror type: {mirror['type']}")
'''
if old in text:
    text = text.replace(old, new)
server.write_text(text, encoding='utf-8')
print('patched', server)
print('backup', backup)
