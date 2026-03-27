from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from sqlalchemy import func, case
from uuid import UUID

from app.database import get_db
from app.models import User, UserRole, Project, Tree, HealthStatus
from app.auth import get_current_user
from app.schemas import (
    TreeResponse, AnalyticsResponse, HealthBreakdown, HeightBucket,
    GeoJSONFeature, GeoJSONFeatureCollection,
)

router = APIRouter(prefix="/api/projects", tags=["Trees & Analytics"])


def _check_project_access(project_id: UUID, user: User, db: Session) -> Project:
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")
    if user.role == UserRole.CLIENT and project.client_id != user.id:
        raise HTTPException(status_code=403, detail="Access denied")
    return project


@router.get("/{project_id}/trees")
def get_trees_geojson(
    project_id: UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    _check_project_access(project_id, user, db)

    trees = db.query(Tree).filter(Tree.project_id == project_id).all()

    features = []
    for tree in trees:
        feature = GeoJSONFeature(
            type="Feature",
            geometry={
                "type": "Point",
                "coordinates": [tree.longitude or 0, tree.latitude or 0],
            },
            properties={
                "id": str(tree.id),
                "tree_index": tree.tree_index,
                "height_m": tree.height_m,
                "health_status": tree.health_status.value if tree.health_status else None,
                "latitude": tree.latitude,
                "longitude": tree.longitude,
            },
        )
        features.append(feature)

    return GeoJSONFeatureCollection(
        type="FeatureCollection",
        features=features,
    )


@router.get("/{project_id}/trees/list")
def get_trees_list(
    project_id: UUID,
    health: str = None,
    search: str = None,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    _check_project_access(project_id, user, db)

    query = db.query(Tree).filter(Tree.project_id == project_id)

    if health:
        try:
            health_enum = HealthStatus(health)
            query = query.filter(Tree.health_status == health_enum)
        except ValueError:
            pass

    if search:
        try:
            tree_idx = int(search)
            query = query.filter(Tree.tree_index == tree_idx)
        except ValueError:
            pass

    trees = query.order_by(Tree.tree_index).all()

    return [
        TreeResponse(
            id=t.id,
            tree_index=t.tree_index,
            height_m=t.height_m,
            health_status=t.health_status.value if t.health_status else None,
            latitude=t.latitude,
            longitude=t.longitude,
        )
        for t in trees
    ]


@router.get("/{project_id}/analytics", response_model=AnalyticsResponse)
def get_analytics(
    project_id: UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    project = _check_project_access(project_id, user, db)

    # Aggregations
    total = db.query(func.count(Tree.id)).filter(Tree.project_id == project_id).scalar() or 0
    avg_height = db.query(func.avg(Tree.height_m)).filter(Tree.project_id == project_id).scalar()

    # Health breakdown
    health_counts = (
        db.query(
            Tree.health_status,
            func.count(Tree.id),
        )
        .filter(Tree.project_id == project_id)
        .group_by(Tree.health_status)
        .all()
    )

    breakdown = HealthBreakdown()
    for status, count in health_counts:
        if status == HealthStatus.HEALTHY:
            breakdown.healthy = count
        elif status == HealthStatus.MODERATE:
            breakdown.moderate = count
        elif status == HealthStatus.POOR:
            breakdown.poor = count

    health_score = None
    if total > 0:
        health_score = round((breakdown.healthy / total) * 100, 1)

    # Height distribution (buckets)
    buckets = [
        ("0-2m", 0, 2),
        ("2-4m", 2, 4),
        ("4-6m", 4, 6),
        ("6-8m", 6, 8),
        ("8-10m", 8, 10),
        ("10m+", 10, 9999),
    ]

    height_distribution = []
    for label, low, high in buckets:
        count = (
            db.query(func.count(Tree.id))
            .filter(
                Tree.project_id == project_id,
                Tree.height_m >= low,
                Tree.height_m < high,
            )
            .scalar()
            or 0
        )
        height_distribution.append(HeightBucket(range=label, count=count))

    return AnalyticsResponse(
        total_trees=total,
        average_height=round(avg_height, 2) if avg_height else None,
        health_score=health_score,
        area_hectares=project.area_hectares,
        health_breakdown=breakdown,
        height_distribution=height_distribution,
    )
