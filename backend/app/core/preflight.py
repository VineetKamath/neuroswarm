"""
Dependency preflight.

Running an entry point with the system interpreter instead of the project
virtualenv produces a 40-line pydantic traceback whose actual cause, one
missing package, is buried at the very bottom. This turns that into a single
readable message that names the interpreter in use and the command to fix it.
"""
from __future__ import annotations

import sys
import sysconfig
from pathlib import Path

# torch, faiss-cpu and sentence-transformers publish no wheels past 3.13, so a
# newer interpreter cannot install this project at all. 3.9 is the floor for the
# pydantic 2 / SQLAlchemy 2 stack.
MIN_PYTHON = (3, 9)
MAX_PYTHON_EXCLUSIVE = (3, 14)

# (import name, pip requirement, what breaks without it)
REQUIRED = [
    ("fastapi", "fastapi", "the API layer"),
    ("pydantic", "pydantic", "request/response schemas"),
    ("pydantic_settings", "pydantic-settings", "configuration loading"),
    ("email_validator", "pydantic[email]", "the EmailStr fields on staff accounts"),
    ("sqlalchemy", "sqlalchemy", "database access"),
    ("jose", "python-jose[cryptography]", "JWT authentication"),
    ("bcrypt", "bcrypt", "password hashing"),
    ("numpy", "numpy", "every bio-inspired optimizer"),
    ("faiss", "faiss-cpu", "vector search"),
    ("sentence_transformers", "sentence-transformers", "clinical text embeddings"),
]


def _venv_python() -> Path | None:
    backend = Path(__file__).resolve().parents[2]
    for candidate in (backend / "venv" / "Scripts" / "python.exe",
                      backend / "venv" / "bin" / "python",
                      backend / ".venv" / "Scripts" / "python.exe",
                      backend / ".venv" / "bin" / "python"):
        if candidate.exists():
            return candidate
    return None


def _in_project_venv() -> bool:
    vp = _venv_python()
    if vp is None:
        return False
    try:
        return Path(sys.executable).resolve().parent == vp.resolve().parent
    except OSError:
        return False


def _banner(title: str, body: list[str]) -> str:
    return "\n".join(["", "=" * 74, f"  {title}", "=" * 74, *body, "=" * 74, ""])


def _check_interpreter_version(exit_on_failure: bool) -> bool:
    """Reject interpreters no wheel in requirements.txt is built for."""
    if MIN_PYTHON <= sys.version_info[:2] < MAX_PYTHON_EXCLUSIVE:
        return True

    want = ".".join(str(n) for n in MIN_PYTHON)
    ceiling = ".".join(str(n) for n in MAX_PYTHON_EXCLUSIVE)
    running = ".".join(str(n) for n in sys.version_info[:3])
    message = _banner(
        f"NeuroSwarm needs Python >={want},<{ceiling}, you are running {running}",
        [
            f"  Interpreter in use: {sys.executable}",
            "",
            "  torch, faiss-cpu and sentence-transformers publish no wheels for this",
            "  version, so the dependencies cannot be installed under it. Build the",
            "  virtualenv with a supported interpreter instead:",
            "",
            "      cd backend",
            "      py -3.11 -m venv venv           # Windows",
            "      python3.11 -m venv venv         # macOS / Linux",
            r"      venv\Scripts\activate",
            "      pip install -r requirements.txt",
        ],
    )
    print(message, file=sys.stderr)
    if exit_on_failure:
        raise SystemExit(1)
    return False


def _abi_mismatch(exc: ImportError) -> bool:
    """True when the failure looks like wheels built for a different Python.

    Re-running `python -m venv venv` over an existing environment with a
    different interpreter rewrites pyvenv.cfg but leaves Lib/site-packages
    alone, so every compiled extension in it (`*.cp311-win_amd64.pyd`) becomes
    invisible to the new interpreter. The resulting error names a private
    submodule, `No module named 'pydantic_core._pydantic_core'`, which looks
    nothing like the real cause.
    """
    text = str(exc)
    return "." in getattr(exc, "name", "") or "DLL load failed" in text


def _report_abi_mismatch(exc: ImportError, exit_on_failure: bool) -> None:
    running = ".".join(str(n) for n in sys.version_info[:2])
    message = _banner(
        "NeuroSwarm cannot start, installed packages were built for another Python",
        [
            f"  Interpreter in use: {sys.executable}  (Python {running})",
            f"  Import failed:      {exc}",
            "",
            f"  The packages in this environment are not importable under Python {running}.",
            "  This happens when `python -m venv venv` is re-run over an existing venv",
            "  with a different interpreter: it rewrites pyvenv.cfg but keeps the old",
            "  site-packages. Rebuild the environment from scratch:",
            "",
            "      cd backend",
            r"      rmdir /s /q venv                # Windows (rm -rf venv elsewhere)",
            "      py -3.11 -m venv venv",
            r"      venv\Scripts\activate",
            "      pip install -r requirements.txt",
            "",
            "  Or, if site-packages is intact and only the interpreter changed, point",
            "  the venv back at the Python the packages were built for:",
            "",
            f"      py -3.11 -m venv {sysconfig.get_paths()['data']} --upgrade",
        ],
    )
    print(message, file=sys.stderr)
    if exit_on_failure:
        raise SystemExit(1)


def check(exit_on_failure: bool = True) -> list[str]:
    """Return the list of missing pip requirements; optionally exit with advice."""
    import importlib

    if not _check_interpreter_version(exit_on_failure):
        return ["python>=3.9,<3.14"]

    missing = []
    for mod, req, why in REQUIRED:
        try:
            importlib.import_module(mod)
        except ImportError as exc:
            # A package that is installed but broken is a different problem from
            # one that was never installed, and needs different advice.
            if _abi_mismatch(exc):
                _report_abi_mismatch(exc, exit_on_failure)
                return [req]
            missing.append((mod, req, why))
    if not missing:
        return []

    venv = _venv_python()
    lines = [
        "",
        "=" * 74,
        "  NeuroSwarm cannot start, missing Python packages",
        "=" * 74,
        f"  Interpreter in use: {sys.executable}",
        "",
        "  Missing:",
    ]
    for _mod, req, why in missing:
        lines.append(f"    - {req:<32} (needed for {why})")

    lines.append("")
    if venv and not _in_project_venv():
        lines += [
            "  This project has a virtualenv, but you are NOT using it. That is almost",
            "  certainly the whole problem. Activate it and re-run:",
            "",
            "      cd backend",
            r"      venv\Scripts\activate          # Windows PowerShell / cmd",
            "      source venv/bin/activate       # macOS / Linux",
            "",
            "  Or invoke it directly without activating:",
            "",
            f"      {venv} {' '.join(sys.argv) or 'seed.py'}",
        ]
    else:
        lines += [
            "  Install the project dependencies:",
            "",
            "      pip install -r requirements.txt",
        ]
    lines += ["=" * 74, ""]

    message = "\n".join(lines)
    if exit_on_failure:
        print(message, file=sys.stderr)
        raise SystemExit(1)
    print(message, file=sys.stderr)
    return [req for _m, req, _w in missing]
