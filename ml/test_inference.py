from pathlib import Path

from ultralytics import YOLO


PROJECT_ROOT = Path(__file__).resolve().parents[1]

MODEL_PATH = PROJECT_ROOT / "best.pt"
IMAGE_PATH = PROJECT_ROOT / "ml" / "test_images" / "pcb_test.png"

OUTPUT_DIR = PROJECT_ROOT / "ml" / "runs"


def main():
    print("Loading PCBVision YOLO11s model...")

    model = YOLO(MODEL_PATH)

    print("Model loaded successfully!")
    print(f"Input image: {IMAGE_PATH}")

    results = model.predict(
        source=IMAGE_PATH,
        imgsz=640,
        conf=0.25,
        save=True,
        project=OUTPUT_DIR,
        name="first_test",
        exist_ok=True,
    )

    print("\nInference completed.")

    for result in results:
        boxes = result.boxes

        if boxes is None or len(boxes) == 0:
            print("No detections found.")
            continue

        print(f"\nDetections: {len(boxes)}")

        for box in boxes:
            class_id = int(box.cls[0])
            confidence = float(box.conf[0])

            class_name = model.names[class_id]

            x1, y1, x2, y2 = box.xyxy[0].tolist()

            print(
                f"- {class_name} | "
                f"confidence={confidence:.2f} | "
                f"bbox=({x1:.1f}, {y1:.1f}, {x2:.1f}, {y2:.1f})"
            )

    print(
        f"\nAnnotated result saved to: "
        f"{OUTPUT_DIR / 'first_test'}"
    )


if __name__ == "__main__":
    main()