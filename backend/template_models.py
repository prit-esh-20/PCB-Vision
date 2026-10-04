from sqlalchemy import Column, BigInteger, Integer, String
from sqlalchemy.sql import func
from sqlalchemy.types import DateTime

from database import Base


class TemplateSession(Base):
    __tablename__ = "template_sessions"

    id = Column(BigInteger, primary_key=True, index=True)
    template_id = Column(String(50), unique=True, nullable=False, index=True)

    expected_images = Column(Integer, nullable=False)
    captured_images = Column(Integer, nullable=False, default=0)

    status = Column(String(30), nullable=False, default="PENDING")

    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
    )