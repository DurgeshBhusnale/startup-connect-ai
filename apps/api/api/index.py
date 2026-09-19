"""Vercel entry point: the same FastAPI app, served as a Python Function.

Vercel routes every request here (see vercel.json). Railway runs `uvicorn app.main:app` instead,
so this file is only used by the Vercel deployment.
"""

import sys
from pathlib import Path

# The function's working directory is apps/api; make `app` importable from this subfolder too.
sys.path.append(str(Path(__file__).resolve().parents[1]))

from app.main import app as app  # noqa: E402
