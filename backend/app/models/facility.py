import uuid

from sqlalchemy import Boolean, Column, ForeignKey, String, UniqueConstraint
from sqlalchemy.orm import relationship

from app.db import Base


class Facility(Base):
    __tablename__ = "facilities"

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    name = Column(String(255), nullable=False)
    type = Column(String(64), nullable=False)
    location = Column(String(255), nullable=True)
    active = Column(Boolean, nullable=False, default=True)

    services = relationship("FacilityService", back_populates="facility")
    users = relationship("User", back_populates="facility")
    role_assignments = relationship("RoleAssignment", back_populates="facility")
    referrals = relationship("Referral", back_populates="assigned_facility")


class FacilityService(Base):
    __tablename__ = "facility_services"
    __table_args__ = (
        UniqueConstraint("facility_id", "service_name", name="uq_facility_service_name"),
    )

    id = Column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    facility_id = Column(String(36), ForeignKey("facilities.id"), nullable=False)
    service_name = Column(String(128), nullable=False)
    available = Column(Boolean, nullable=False, default=True)

    facility = relationship("Facility", back_populates="services")
