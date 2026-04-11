from __future__ import annotations

import os

from pathlib import Path

from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker

try:
    from dotenv import load_dotenv
except Exception:  # pragma: no cover
    load_dotenv = None

env_path = Path(__file__).resolve().parents[1] / ".env"
if load_dotenv and env_path.exists():
    load_dotenv(env_path)

DATABASE_URL = os.getenv("DATABASE_URL", "sqlite:///./local.db")

connect_args = {}
if DATABASE_URL.startswith("sqlite"):
    connect_args = {"check_same_thread": False}

engine = create_engine(DATABASE_URL, connect_args=connect_args)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
