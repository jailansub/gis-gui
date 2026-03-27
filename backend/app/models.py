import uuid
from datetime import datetime
from sqlalchemy import (
    Column, String, Float, DateTime, ForeignKey, Enum as SQLEnum, Integer, Text
)
from sqlalchemy.dialects.postgresql import UUID
from sqlalchemy.orm import relationship
from geoalchemy2 import Geometry
import enum

from app.database import Base


class UserRole(str, enum.Enum):
    ADMIN = "admin"
    CLIENT = "client"


class ProjectStatus(str, enum.Enum):
    CREATED = "created"
    UNASSIGNED = "unassigned"
    UPLOADING = "uploading"
    PROCESSING = "processing"
    READY = "ready"
    ERROR = "error"


class HealthStatus(str, enum.Enum):
    HEALTHY = "Healthy"
    MODERATE = "Moderate"
    POOR = "Poor"


class User(Base):
    __tablename__ = "users"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    username = Column(String(100), unique=True, nullable=False, index=True)
    password_hash = Column(String(255), nullable=False)
    full_name = Column(String(200), nullable=False)
    role = Column(SQLEnum(UserRole), nullable=False, default=UserRole.CLIENT)
    created_at = Column(DateTime, default=datetime.utcnow)

    # Projects assigned to this client
    projects = relationship("Project", back_populates="client", foreign_keys="Project.client_id")


class Project(Base):
    __tablename__ = "projects"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name = Column(String(200), nullable=False)
    location = Column(String(300), nullable=True)
    description = Column(Text, nullable=True)
    client_id = Column(UUID(as_uuid=True), ForeignKey("users.id"), nullable=True)
    status = Column(SQLEnum(ProjectStatus), default=ProjectStatus.CREATED, nullable=False)
    boundary_geojson = Column(Text, nullable=True)  # Store boundary as GeoJSON text
    area_hectares = Column(Float, nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)
    processing_error = Column(Text, nullable=True)

    # Relationships
    client = relationship("User", back_populates="projects", foreign_keys=[client_id])
    trees = relationship("Tree", back_populates="project", cascade="all, delete-orphan")


class Tree(Base):
    __tablename__ = "trees"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    project_id = Column(UUID(as_uuid=True), ForeignKey("projects.id", ondelete="CASCADE"), nullable=False)
    tree_index = Column(Integer, nullable=False)  # Original ID from shapefile
    geom = Column(Geometry(geometry_type="POINT", srid=4326), nullable=False)
    height_m = Column(Float, nullable=True)
    health_status = Column(SQLEnum(HealthStatus), nullable=True)
    latitude = Column(Float, nullable=True)
    longitude = Column(Float, nullable=True)

    # Relationships
    project = relationship("Project", back_populates="trees")
