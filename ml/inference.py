from pathlib import Path
import time

from ultralytics import YOLO


PROJECT_ROOT = Path(__file__).resolve().parents[1]
MODEL_PATH = PROJECT_ROOT / "best.pt"


# Load the trained model once when this module is imported.
model = YOLO(MODEL_PATH)


def inspect_pcb(image_path):
    """
    Run YOLO inference on a single PCB image.

    Returns structured inspection data that can later
    be consumed by the FastAPI backend.
    """

    image_path = Path(image_path)

    if not image_path.exists():
        raise FileNotFoundError(
            f"PCB image not found: {image_path}"
        )

    start_time = time.perf_counter()

    results = model.predict(
        source=image_path,
        imgsz=640,
        conf=0.25,
        verbose=False,
    )

    inference_time = time.perf_counter() - start_time

    if not results:
        return {
            "image_name": image_path.name,
            "image_width": None,
            "image_height": None,
            "inference_time": round(inference_time, 4),
            "detection_count": 0,
            "detections": [],
        }

    result = results[0]

    image_height, image_width = result.orig_shape

    detections = []

    if result.boxes is not None:
        for box in result.boxes:
            class_id = int(box.cls[0])
            confidence = float(box.conf[0])

            x1, y1, x2, y2 = box.xyxy[0].tolist()

            detections.append({
                "class_id": class_id,
                "class_name": model.names[class_id],
                "confidence": round(confidence, 4),
                "bbox": {
                    "x1": round(x1, 2),
                    "y1": round(y1, 2),
                    "x2": round(x2, 2),
                    "y2": round(y2, 2),
                },
            })

    return {
        "image_name": image_path.name,
        "image_width": image_width,
        "image_height": image_height,
        "inference_time": round(inference_time, 4),
        "detection_count": len(detections),
        "detections": detections,
    }