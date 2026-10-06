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
        async with httpx.AsyncClient(timeout=5.0) as client:

            response = await client.get(
                f"{RPI_BASE_URL}/health"
            )

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
            "message": (
                f"Raspberry Pi connection failed: {exc}"
            ),
        }


# ============================================================
# RASPBERRY PI CAMERA STATUS
# ============================================================

async def check_rpi_camera_status() -> dict:

    if not RPI_BASE_URL:
        return {
            "status": "ERROR",
            "connected": False,
            "message": (
                "Raspberry Pi address is not configured."
            ),
        }

    try:

        async with httpx.AsyncClient(
            timeout=5.0
        ) as client:

            response = await client.get(
                f"{RPI_BASE_URL}/camera/status"
            )

            response.raise_for_status()

            data = response.json()

        return {
            "status": data.get(
                "status",
                "UNKNOWN"
            ),
            "connected": data.get(
                "connected",
                False
            ),
            "message": data.get(
                "message",
                "Camera status retrieved from Raspberry Pi."
            ),
            "details": data,
        }

    except httpx.HTTPError as exc:

        return {
            "status": "DISCONNECTED",
            "connected": False,
            "message": (
                "Raspberry Pi camera status check failed: "
                f"{exc}"
            ),
        }


# ============================================================
# RASPBERRY PI CAMERA CAPTURE
# ============================================================

async def capture_rpi_image() -> bytes:
    """
    Capture an image using the Raspberry Pi camera
    and return the JPEG bytes.
    """

    if not RPI_BASE_URL:
        raise RuntimeError(
            "Raspberry Pi address is not configured."
        )

    try:

        async with httpx.AsyncClient(
            timeout=180.0
        ) as client:

            response = await client.post(
                f"{RPI_BASE_URL}/camera/capture"
            )

            response.raise_for_status()

            content_type = response.headers.get(
                "content-type",
                ""
            )

            if not content_type.startswith("image/"):

                raise RuntimeError(
                    "Raspberry Pi did not return an image."
                )

            return response.content

    except httpx.HTTPError as exc:

        raise RuntimeError(
            "Raspberry Pi image capture failed: "
            f"{exc}"
        ) from exc


# ============================================================
# RASPBERRY PI TEMPLATE CREATION
# ============================================================

async def create_rpi_template(
    template_name: str,
    reference_images: list,
) -> dict:

    if not RPI_BASE_URL:
        raise RuntimeError(
            "Raspberry Pi address is not configured."
        )

    files = []
    opened_files = []

    try:

        for image in reference_images:

            image.file.seek(0)

            opened_files.append(
                image.file
            )

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

        async with httpx.AsyncClient(
            timeout=120.0
        ) as client:

            response = await client.post(
                f"{RPI_BASE_URL}/templates/create",
                data={
                    "template_name": template_name
                },
                files=files,
            )

            response.raise_for_status()

            return response.json()

    except httpx.HTTPError as exc:

        raise RuntimeError(
            "Raspberry Pi template creation failed: "
            f"{exc}"
        ) from exc

    finally:

        for image_file in opened_files:

            image_file.close()

def make_rpi_image_url(image_path: str | None) -> str | None:
    if not image_path:
        return None

    return (
        f"{RPI_BASE_URL.rstrip('/')}/inspection/image?"
        f"{urlencode({'path': image_path})}"
    )

# ============================================================
# RASPBERRY PI FULL INSPECTION
# ============================================================

async def run_rpi_inspection() -> dict:
    """
    Run the complete PCBVISION inspection pipeline
    on the Raspberry Pi.

    The Raspberry Pi performs:

        Camera
        YOLO
        OCR
        X-MCCV
        Decision Engine
        XAI
        Hardware PASS/FAIL

    The complete structured result is returned.
    """

    if not RPI_BASE_URL:
        raise RuntimeError(
            "Raspberry Pi address is not configured."
        )

    try:

        async with httpx.AsyncClient(
            timeout=180.0
        ) as client:

            response = await client.post(
                f"{RPI_BASE_URL}/inspection/run"
            )

            response.raise_for_status()

            data = response.json()

        if not isinstance(data, dict):

            raise RuntimeError(
                "Raspberry Pi returned an invalid "
                "inspection response."
            )

        return data

    except httpx.TimeoutException as exc:

        raise RuntimeError(
            "Raspberry Pi inspection timed out."
        ) from exc

    except httpx.HTTPStatusError as exc:

        try:
            error_data = exc.response.json()
        except Exception:
            error_data = exc.response.text

        raise RuntimeError(
            "Raspberry Pi inspection request failed: "
            f"{error_data}"
        ) from exc

    except httpx.HTTPError as exc:

        raise RuntimeError(
            "Unable to communicate with Raspberry Pi "
            "inspection API: "
            f"{exc}"
        ) from exc
        
# ============================================================
# RASPBERRY PI UPLOADED IMAGE INSPECTION
# ============================================================

async def run_rpi_uploaded_inspection(
    image_path: str,
) -> dict:
    """
    Send a locally uploaded PCB image to the Raspberry Pi
    and run the same PCBVISION inspection pipeline.
    """

    if not RPI_BASE_URL:
        raise RuntimeError(
            "Raspberry Pi address is not configured."
        )

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

            async with httpx.AsyncClient(
                timeout=180.0
            ) as client:

                response = await client.post(
                    f"{RPI_BASE_URL}/inspection/upload",
                    files=files,
                )

                response.raise_for_status()

                data = response.json()

        if not isinstance(data, dict):
            raise RuntimeError(
                "Raspberry Pi returned an invalid "
                "uploaded-image inspection response."
            )

        return data

    except httpx.TimeoutException as exc:

        raise RuntimeError(
            "Raspberry Pi uploaded-image inspection timed out."
        ) from exc

    except httpx.HTTPStatusError as exc:

        try:
            error_data = exc.response.json()
        except Exception:
            error_data = exc.response.text

        raise RuntimeError(
            "Raspberry Pi uploaded-image inspection failed: "
            f"{error_data}"
        ) from exc

    except httpx.HTTPError as exc:

        raise RuntimeError(
            "Unable to communicate with Raspberry Pi "
            "uploaded-image inspection API: "
            f"{exc}"
        ) from exc
        