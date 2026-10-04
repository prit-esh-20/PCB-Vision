
import os
from pathlib import Path

import httpx
from dotenv import load_dotenv

# Resolve backend/.env regardless of the current working directory.
BACKEND_DIR = Path(__file__).resolve().parents[1]
ENV_FILE = BACKEND_DIR / ".env"

load_dotenv(ENV_FILE)

RPI_BASE_URL = os.getenv("RPI_BASE_URL", "").rstrip("/")
RPI_API_KEY = os.getenv("RPI_API_KEY", "")


async def check_rpi_connection() -> dict:
    """Check Pi configuration without contacting an unconfirmed endpoint."""

    if not RPI_BASE_URL:
        return {
            "connected": False,
            "message": "Raspberry Pi address is not configured.",
        }

    return {
        "connected": False,
        "message": "Raspberry Pi health endpoint is not configured yet.",
    }
