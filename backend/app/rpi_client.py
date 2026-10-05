
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
    if not RPI_BASE_URL:
        return {
            "connected": False,
            "message": "Raspberry Pi address is not configured.",
        }

    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.get(f"{RPI_BASE_URL}/health")
            response.raise_for_status()
            data = response.json()

        return {
            "connected": True,
            "message": "Raspberry Pi API is reachable.",
            "details": data,
        }

    except httpx.HTTPError as exc:
        return {
            "connected": False,
            "message": f"Raspberry Pi connection failed: {exc}",
        }


async def check_rpi_camera_status() -> dict:
    if not RPI_BASE_URL:
        return {
            "status": "ERROR",
            "connected": False,
            "message": "Raspberry Pi address is not configured.",
        }

    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.get(f"{RPI_BASE_URL}/camera/status")
            response.raise_for_status()
            data = response.json()

        return {
            "status": data.get("status", "UNKNOWN"),
            "connected": data.get("connected", False),
            "message": data.get("message", "Camera status retrieved from Raspberry Pi."),
            "details": data,
        }

    except httpx.HTTPError as exc:
        return {
            "status": "DISCONNECTED",
            "connected": False,
            "message": f"Raspberry Pi camera status check failed: {exc}",
        }


async def create_rpi_template(
    template_name: str,
    reference_images: list,
) -> dict:
    if not RPI_BASE_URL:
        raise RuntimeError("Raspberry Pi address is not configured.")

    files = []
    opened_files = []

    try:
        for image in reference_images:
            image.file.seek(0)
            opened_files.append(image.file)

            files.append(
                (
                    "reference_images",
                    (
                        image.filename or "reference.png",
                        image.file,
                        image.content_type or "image/png",
                    ),
                )
            )

        async with httpx.AsyncClient(timeout=60.0) as client:
            response = await client.post(
                f"{RPI_BASE_URL}/templates/create",
                data={"template_name": template_name},
                files=files,
            )
            response.raise_for_status()
            return response.json()

    finally:
        for image_file in opened_files:
            image_file.close()

async def capture_rpi_image() -> bytes:
    """Capture an image using the Raspberry Pi camera and return its bytes."""
    if not RPI_BASE_URL:
        raise RuntimeError("Raspberry Pi address is not configured.")

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                f"{RPI_BASE_URL}/camera/capture"
            )
            response.raise_for_status()

            content_type = response.headers.get("content-type", "")
            if not content_type.startswith("image/"):
                raise RuntimeError(
                    "Raspberry Pi did not return an image."
                )

            return response.content

    except httpx.HTTPError as exc:
        raise RuntimeError(
            f"Raspberry Pi image capture failed: {exc}"
        ) from exc
