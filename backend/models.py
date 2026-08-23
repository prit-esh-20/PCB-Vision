from sqlalchemy import Column, BigInteger, String, Float, Text, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.sql import func
from sqlalchemy.types import DateTime

from database import Base


class Inspection(Base):
    __tablename__ = "inspections"

    id = Column(BigInteger, primary_key=True, index=True)
    board_id = Column(String(50), unique=True, nullable=False)
    image_name = Column(String(255))
    model_name = Column(String(100))
    status = Column(String(20))
    confidence = Column(Float)
    defect_class = Column(String(100))
    inspection_time = Column(Float)
    xai_explanation = Column(Text)
    created_at = Column(DateTime(timezone=True), server_default=func.now())

    detections = relationship(
        "Detection",
        back_populates="inspection",
        cascade="all, delete-orphan"
    )


class Detection(Base):
    __tablename__ = "detections"

    id = Column(BigInteger, primary_key=True, index=True)

    inspection_id = Column(
        BigInteger,
        ForeignKey("inspections.id", ondelete="CASCADE"),
        nullable=False
    )

    class_name = Column(String(100), nullable=False)
    confidence = Column(Float)

    x_min = Column(Float)
    y_min = Column(Float)
    x_max = Column(Float)
    y_max = Column(Float)

    detection_type = Column(String(50))

    created_at = Column(DateTime(timezone=True), server_default=func.now())

    inspection = relationship(
        "Inspection",
        back_populates="detections"
    )


class Report(Base):
    __tablename__ = "reports"

    id = Column(BigInteger, primary_key=True, index=True)
    report_id = Column(String(50), unique=True, nullable=False)
    title = Column(String(255), nullable=False)
    report_type = Column(String(50))

    inspection_id = Column(
        BigInteger,
        ForeignKey("inspections.id", ondelete="SET NULL")
    )

    file_name = Column(String(255))
    file_path = Column(Text)

    status = Column(String(30), default="GENERATED")

    created_at = Column(DateTime(timezone=True), server_default=func.now())