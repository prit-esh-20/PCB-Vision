import os
import mimetypes
from pathlib import Path
from urllib.parse import urlencode

import httpx
from dotenv import load_dotenv

# ============================================================
# ENVIRONMENT
# ============================================================

BACKEND_DIR = Path(__file__).resolve().parents[1]
ENV_FILE = BACKEND_DIR / ".env"

load_dotenv(ENV_FILE)

RPI_BASE_URL = os.getenv("RPI_BASE_URL", "").rstrip("/")
RPI_API_KEY = os.getenv("RPI_API_KEY", "")


def _require_rpi_url():
    if not RPI_BASE_URL:
        raise RuntimeError(
            "Raspberry Pi address is not configured."
        )


def _headers():
    if RPI_API_KEY:
        return {"X-API-Key": RPI_API_KEY}
    return {}


def _raise_rpi_error(response, operation):
    try:
        detail = response.json()
    except Exception:
        detail = response.text

    raise RuntimeError(
        f"{operation} failed (HTTP {response.status_code}): {detail}"
    )


# ============================================================
# RASPBERRY PI HEALTH
# ============================================================

async def check_rpi_connection() -> dict:
    if not RPI_BASE_URL:
        return {
            "connected": False,
            "message": "Raspberry Pi address is not configured.",
        }

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            response = await client.get(
                f"{RPI_BASE_URL}/health",
                headers=_headers(),
            )
            response.raise_for_status()
            data = response.json()

        return {
            "connected": True,
            "message": "Raspberry Pi API is reachable.",
            "details": data,
        }

    except (httpx.HTTPError, ValueError) as exc:
        return {
            "connected": False,
            "message": f"Raspberry Pi connection failed: {exc}",
        }


# ============================================================
# RASPBERRY PI CAMERA STATUS
# ============================================================

async def check_rpi_camera_status() -> dict:
    if not RPI_BASE_URL:
        return {
            "status": "ERROR",
            "connected": False,
            "message": "Raspberry Pi address is not configured.",
        }

    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.get(
                f"{RPI_BASE_URL}/camera/status",
                headers=_headers(),
            )
            response.raise_for_status()
            data = response.json()

        return {
            "status": data.get("status", "UNKNOWN"),
            "connected": data.get("connected", False),
            "message": data.get(
                "message",
                "Camera status retrieved from Raspberry Pi.",
            ),
            "details": data,
        }

    except httpx.HTTPError as exc:
        return {
            "status": "DISCONNECTED",
            "connected": False,
            "message": f"Camera status check failed: {exc}",
        }


# ============================================================
# RASPBERRY PI CAMERA CAPTURE
# ============================================================

async def capture_rpi_image() -> bytes:
    """Capture an image using the Raspberry Pi camera."""

    _require_rpi_url()

    try:
        async with httpx.AsyncClient(timeout=None) as client:
            response = await client.post(
                f"{RPI_BASE_URL}/camera/capture",
                headers=_headers(),
            )
            response.raise_for_status()

            content_type = response.headers.get(
                "content-type", ""
            )

            if not content_type.startswith("image/"):
                raise RuntimeError(
                    "Raspberry Pi did not return an image."
                )

            return response.content

    except httpx.HTTPError as exc:
        raise RuntimeError(
            f"Raspberry Pi image capture failed: {exc}"
        ) from exc


# ============================================================
# TEMPLATE CAPTURE WORKFLOW
# ============================================================

async def start_rpi_template(
    template_name: str,
    expected_images: int,
) -> dict:
    """
    Start a Pi-camera template capture session.
    The user selects 4 or 5 reference images.
    """

    _require_rpi_url()

    if not template_name or not template_name.strip():
        raise ValueError("Template name cannot be empty.")

    if expected_images not in (4, 5):
        raise ValueError(
            "Reference image count must be 4 or 5."
        )

    payload = {
        "template_name": template_name.strip(),
        "expected_images": expected_images,
    }

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                f"{RPI_BASE_URL}/templates/start",
                json=payload,
                headers=_headers(),
            )

            if not response.is_success:
                _raise_rpi_error(response, "Starting template session")

            return response.json()

    except httpx.HTTPError as exc:
        raise RuntimeError(
            f"Unable to start Pi template session: {exc}"
        ) from exc


async def capture_next_rpi_template_image(
    session_id: str,
) -> dict:
    """
    Capture exactly one reference image for the given session.
    Call this only when the user presses Next.
    """

    _require_rpi_url()

    if not session_id:
        raise ValueError("Template session ID is required.")

    try:
        async with httpx.AsyncClient(timeout=None) as client:
            response = await client.post(
                f"{RPI_BASE_URL}/templates/next",
                json={"session_id": session_id},
                headers=_headers(),
            )

            if not response.is_success:
                _raise_rpi_error(response, "Capturing template image")

            return response.json()

    except httpx.HTTPError as exc:
        raise RuntimeError(
            f"Unable to capture next template image: {exc}"
        ) from exc


async def finish_rpi_template(
    session_id: str,
) -> dict:
    """
    Build and save the template after all requested images
    have been captured successfully.
    """

    _require_rpi_url()

    if not session_id:
        raise ValueError("Template session ID is required.")

    try:
        async with httpx.AsyncClient(timeout=None) as client:
            response = await client.post(
                f"{RPI_BASE_URL}/templates/finish",
                json={"session_id": session_id},
                headers=_headers(),
            )

            if not response.is_success:
                _raise_rpi_error(response, "Saving template")

            return response.json()

    except httpx.HTTPError as exc:
        raise RuntimeError(
            f"Unable to finish Pi template session: {exc}"
        ) from exc


async def cancel_rpi_template(
    session_id: str,
) -> dict:
    """Cancel an unfinished template capture session."""

    _require_rpi_url()

    if not session_id:
        raise ValueError("Template session ID is required.")

    try:
        async with httpx.AsyncClient(timeout=30.0) as client:
            response = await client.post(
                f"{RPI_BASE_URL}/templates/cancel",
                json={"session_id": session_id},
                headers=_headers(),
            )

            if not response.is_success:
                _raise_rpi_error(response, "Cancelling template session")

            return response.json()

    except httpx.HTTPError as exc:
        raise RuntimeError(
            f"Unable to cancel Pi template session: {exc}"
        ) from exc


async def list_rpi_templates() -> dict:
    """Retrieve saved template names from the Raspberry Pi."""

    _require_rpi_url()

    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            response = await client.get(
                f"{RPI_BASE_URL}/templates",
                headers=_headers(),
            )

            if not response.is_success:
                _raise_rpi_error(response, "Listing templates")

            return response.json()

    except httpx.HTTPError as exc:
        raise RuntimeError(
            f"Unable to retrieve Pi templates: {exc}"
        ) from exc


# ============================================================
# RASPBERRY PI IMAGE URL
# ============================================================

def make_rpi_image_url(
    image_path: str | None,
) -> str | None:
    if not image_path:
        return None

    return (
        f"{RPI_BASE_URL}/inspection/image?"
        f"{urlencode({'path': image_path})}"
    )


# ============================================================
# RASPBERRY PI FULL INSPECTION - CAMERA
# ============================================================

async def run_rpi_inspection() -> dict:
    """Run the existing complete camera inspection pipeline."""

    _require_rpi_url()

    try:
        async with httpx.AsyncClient(timeout=None) as client:
            response = await client.post(
                f"{RPI_BASE_URL}/inspection/run",
                headers=_headers(),
            )

            if not response.is_success:
                _raise_rpi_error(response, "Camera inspection")

            data = response.json()

        if not isinstance(data, dict):
            raise RuntimeError(
                "Raspberry Pi returned an invalid inspection response."
            )

        return data

    except httpx.TimeoutException as exc:
        raise RuntimeError(
            "Raspberry Pi inspection timed out."
        ) from exc

    except httpx.HTTPError as exc:
        raise RuntimeError(
            f"Unable to communicate with Pi inspection API: {exc}"
        ) from exc


# ============================================================
# RASPBERRY PI UPLOADED IMAGE INSPECTION
# ============================================================

async def run_rpi_uploaded_inspection(
    image_path: str,
) -> dict:
    """
    Send an uploaded PCB image to the Raspberry Pi.
    Existing uploaded-image inspection workflow is preserved.
    """

    _require_rpi_url()

    path = Path(image_path)

    if not path.exists():
        raise RuntimeError(
            f"Uploaded PCB image not found: {image_path}"
        )

    try:
        with path.open("rb") as image_file:
            files = {
                "image": (
                    path.name,
                    image_file,
                    mimetypes.guess_type(path.name)[0]
                    or "application/octet-stream",
                )
            }

            async with httpx.AsyncClient(timeout=None) as client:
                response = await client.post(
                    f"{RPI_BASE_URL}/inspection/upload",
                    files=files,
                    headers=_headers(),
                )

                if not response.is_success:
                    _raise_rpi_error(
                        response,
                        "Uploaded-image inspection",
                    )

                data = response.json()

        if not isinstance(data, dict):
            raise RuntimeError(
                "Raspberry Pi returned an invalid uploaded-image response."
            )

        return data

    except httpx.TimeoutException as exc:
        raise RuntimeError(
            "Raspberry Pi uploaded-image inspection timed out."
        ) from exc

    except httpx.HTTPError as exc:
        raise RuntimeError(
            f"Unable to communicate with Pi upload API: {exc}"
        ) from exc