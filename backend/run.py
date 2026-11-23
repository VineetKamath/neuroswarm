"""
NeuroSwarm backend launcher.

Why this exists: the application package uses absolute imports (`app.core...`),
so `backend/` must be on sys.path, but it is launched from different working
directories depending on the shell. Rather than making the reader remember a
PYTHONPATH incantation, this script puts the package on the path itself and
starts the server, so `python run.py` works from anywhere.

    python backend/run.py            # from the repository root
    python run.py                    # from inside backend/
    python run.py --port 9000 --reload
"""
from __future__ import annotations

import argparse
import sys
from pathlib import Path

BACKEND_DIR = Path(__file__).resolve().parent
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))


def main() -> int:
    parser = argparse.ArgumentParser(description="Run the NeuroSwarm API server.")
    parser.add_argument("--host", default="127.0.0.1")
    parser.add_argument("--port", type=int, default=8000)
    parser.add_argument("--reload", action="store_true", help="auto-reload on code changes")
    args = parser.parse_args()

    from app.core.preflight import check as preflight_check
    preflight_check()

    import uvicorn

    print("NeuroSwarm, Bio-Inspired Clinical Intelligence")
    print(f"  API   http://{args.host}:{args.port}")
    print(f"  Docs  http://{args.host}:{args.port}/docs")
    uvicorn.run("app.main:app", host=args.host, port=args.port,
                reload=args.reload, app_dir=str(BACKEND_DIR))
    return 0


if __name__ == "__main__":
    sys.exit(main())
