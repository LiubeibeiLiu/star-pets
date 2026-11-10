"""Compatibility entry point for building the iOS Web assets from the shared source."""
import os
import subprocess
from pathlib import Path

shared_root = Path(__file__).resolve().parents[2] / 'star-pets-android'
if not (shared_root / 'ui/index.html').is_file():
    raise SystemExit('Keep star-pets-android next to star-pets-ios.')
subprocess.run(
    ['npm.cmd' if os.name == 'nt' else 'npm', 'run', 'build:web:ios'],
    cwd=shared_root,
    check=True,
)
