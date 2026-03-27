from pydantic import BaseModel, Field
from typing import Optional, List
from datetime import datetime
from uuid import UUID
from enum import Enum


# ── Auth ──────────────────────────────────────────────────────

class LoginRequest(BaseModel):
    username: str
    password: str


class TokenResponse(BaseModel):
    access_token: str
    token_type: str = "bearer"


# ── User ──────────────────────────────────────────────────────

class UserRole(str, Enum):
    ADMIN = "admin"
    CLIENT = "client"


class UserCreate(BaseModel):
    username: str = Field(..., min_length=3, max_length=100)
    password: str = Field(..., min_length=6)
    full_name: str = Field(..., min_length=1, max_length=200)
    role: UserRole = UserRole.CLIENT


class UserUpdate(BaseModel):
    username: Optional[str] = Field(None, min_length=3, max_length=100)
    password: Optional[str] = Field(None, min_length=6)
    full_name: Optional[str] = Field(None, min_length=1, max_length=200)


class UserResponse(BaseModel):
    id: UUID
    username: str
    full_name: str
    role: str
    created_at: datetime
    project_count: Optional[int] = 0

    class Config:
        from_attributes = True


# ── Project ───────────────────────────────────────────────────

class ProjectStatus(str, Enum):
    DRAFT = "draft"
    CREATED = "created"
    UNASSIGNED = "unassigned"
    UPLOADING = "uploading"
    PROCESSING = "processing"
    READY = "ready"
    ERROR = "error"


class ProjectCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=200)
    location: Optional[str] = None
    description: Optional[str] = None
    client_id: Optional[UUID] = None


class ProjectUpdate(BaseModel):
    name: Optional[str] = None
    location: Optional[str] = None
    description: Optional[str] = None
    client_id: Optional[UUID] = None


class ProjectResponse(BaseModel):
    id: UUID
    name: str
    location: Optional[str]
    description: Optional[str]
    client_id: Optional[UUID]
    client_name: Optional[str] = None
    status: str
    boundary_geojson: Optional[str] = None
    area_hectares: Optional[float] = None
    created_at: datetime
    updated_at: datetime
    processing_error: Optional[str] = None
    tree_count: Optional[int] = None
    thumbnail_url: Optional[str] = None

    class Config:
        from_attributes = True


class ProjectListResponse(BaseModel):
    projects: List[ProjectResponse]
    total: int


# ── Tree ──────────────────────────────────────────────────────

class TreeResponse(BaseModel):
    id: UUID
    tree_index: int
    height_m: Optional[float]
    health_status: Optional[str]
    latitude: Optional[float]
    longitude: Optional[float]

    class Config:
        from_attributes = True


# ── Analytics ─────────────────────────────────────────────────

class HealthBreakdown(BaseModel):
    healthy: int = 0
    moderate: int = 0
    poor: int = 0


class HeightBucket(BaseModel):
    range: str
    count: int


class AnalyticsResponse(BaseModel):
    total_trees: int
    average_height: Optional[float]
    health_score: Optional[float]  # % healthy
    area_hectares: Optional[float]
    health_breakdown: HealthBreakdown
    height_distribution: List[HeightBucket]


# ── GeoJSON ───────────────────────────────────────────────────

class GeoJSONProperties(BaseModel):
    tree_index: int
    height_m: Optional[float]
    health_status: Optional[str]


class GeoJSONFeature(BaseModel):
    type: str = "Feature"
    geometry: dict
    properties: dict


class GeoJSONFeatureCollection(BaseModel):
    type: str = "FeatureCollection"
    features: List[GeoJSONFeature]


# ── Processing Status ────────────────────────────────────────

class ProcessingStatus(BaseModel):
    project_id: UUID
    status: str
    error: Optional[str] = None
