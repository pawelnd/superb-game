#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BACKEND_DIR="$ROOT_DIR/backend"
FRONTEND_DIR="$ROOT_DIR/frontend"
VENV_DIR="$BACKEND_DIR/.venv"
REQUIREMENTS_FILE="$BACKEND_DIR/requirements.txt"

log() {
  printf '[setup] %s
' "$1"
}

if [[ ! -d "$BACKEND_DIR" || ! -d "$FRONTEND_DIR" ]]; then
  echo "Run this script from the repository root" >&2
  exit 1
fi

if [[ ! -d "$VENV_DIR" ]]; then
  log "Creating virtual environment in backend/.venv"
  python3 -m venv "$VENV_DIR"
fi

if [[ "$OSTYPE" == msys* || "$OSTYPE" == cygwin* ]]; then
  VENV_PYTHON="$VENV_DIR/Scripts/python.exe"
else
  VENV_PYTHON="$VENV_DIR/bin/python"
fi

if [[ ! -f "$VENV_PYTHON" ]]; then
  echo "Virtual environment python executable not found at $VENV_PYTHON" >&2
  exit 1
fi

log "Upgrading pip"
"$VENV_PYTHON" -m pip install --upgrade pip >/dev/null

if [[ ! -f "$REQUIREMENTS_FILE" ]]; then
  echo "Requirements file not found at $REQUIREMENTS_FILE" >&2
  exit 1
fi

log "Installing backend dependencies"
"$VENV_PYTHON" -m pip install -r "$REQUIREMENTS_FILE"

log "Installing frontend dependencies"
(cd "$FRONTEND_DIR" && npm install)

log "All dependencies installed"