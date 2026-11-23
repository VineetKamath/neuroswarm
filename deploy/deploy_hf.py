"""
Publish NeuroSwarm to a Hugging Face Docker Space.

    1. Log in once:   backend\\venv\\Scripts\\hf.exe auth login   (token with "write" access)
    2. Deploy:        backend\\venv\\Scripts\\python.exe deploy\\deploy_hf.py <hf-username>

The Space builds the root Dockerfile on Hugging Face's servers (about 10 minutes the
first time) and is then live at https://huggingface.co/spaces/<hf-username>/neuroswarm
"""
import sys
from pathlib import Path

from huggingface_hub import HfApi

ROOT = Path(__file__).resolve().parents[1]
SPACE_NAME = "neuroswarm"

IGNORE = [
    "README.md",                      # replaced by the Space card below
    ".git/*", ".claude/*", "**/__pycache__/*", "*.pyc",
    "**/node_modules/*", "frontend/dist/*",
    "backend/venv/*", "backend/venv_*/*", "**/.venv/*",
    "report/*", "*.pdf", "deploy/*", ".pytest_cache/*",
]


def main() -> int:
    if len(sys.argv) != 2:
        print(__doc__)
        return 1
    repo_id = f"{sys.argv[1]}/{SPACE_NAME}"
    api = HfApi()
    who = api.whoami()["name"]
    print(f"Logged in as {who}. Creating or updating Space {repo_id} ...")
    api.create_repo(repo_id, repo_type="space", space_sdk="docker", exist_ok=True)
    api.upload_folder(folder_path=str(ROOT), repo_id=repo_id, repo_type="space",
                      ignore_patterns=IGNORE, commit_message="Deploy NeuroSwarm")
    api.upload_file(path_or_fileobj=str(ROOT / "deploy" / "space_README.md"), path_in_repo="README.md",
                    repo_id=repo_id, repo_type="space", commit_message="Space card")
    print(f"Uploaded. Build logs and app: https://huggingface.co/spaces/{repo_id}")
    print(f"Direct app URL once built: https://{sys.argv[1].lower()}-{SPACE_NAME}.hf.space")
    return 0


if __name__ == "__main__":
    sys.exit(main())
