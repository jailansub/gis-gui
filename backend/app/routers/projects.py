import os
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List
from uuid import UUID

from app.database import get_db
from app.models import User, UserRole, Project, ProjectStatus, Tree
from app.auth import get_current_user, require_admin
from app.schemas import (
    ProjectCreate, ProjectUpdate, ProjectResponse, ProjectListResponse
)

router = APIRouter(prefix="/api/projects", tags=["Projects"])


def _project_to_response(project: Project, db: Session) -> ProjectResponse:
    tree_count = db.query(func.count(Tree.id)).filter(Tree.project_id == project.id).scalar()
    client_name = None
    if project.client:
        client_name = project.client.full_name
    return ProjectResponse(
        id=project.id,
        name=project.name,
        location=project.location,
        description=project.description,
        client_id=project.client_id,
        client_name=client_name,
        status=project.status.value,
        boundary_geojson=project.boundary_geojson,
        area_hectares=project.area_hectares,
        created_at=project.created_at,
        updated_at=project.updated_at,
        processing_error=project.processing_error,
        tree_count=tree_count,
        thumbnail_url=f"/tiles/{project.id}/thumbnail.jpg" if os.path.exists(os.path.join(settings.TILES_DIR, str(project.id), "thumbnail.jpg")) else None,
    )


@router.get("", response_model=ProjectListResponse)
def list_projects(
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    query = db.query(Project).filter(
        Project.status.notin_([ProjectStatus.DRAFT, ProjectStatus.UPLOADING])
    )
    
    # Clients only see their assigned projects
    if user.role == UserRole.CLIENT:
        query = query.filter(Project.client_id == user.id)
    
    projects = query.order_by(Project.created_at.desc()).all()
    return ProjectListResponse(
        projects=[_project_to_response(p, db) for p in projects],
        total=len(projects),
    )


@router.get("/{project_id}", response_model=ProjectResponse)
def get_project(
    project_id: UUID,
    db: Session = Depends(get_db),
    user: User = Depends(get_current_user),
):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    # Clients can only view their own projects
    if user.role == UserRole.CLIENT and project.client_id != user.id:
        raise HTTPException(status_code=403, detail="Access denied")

    return _project_to_response(project, db)


@router.post("", response_model=ProjectResponse, status_code=status.HTTP_201_CREATED)
def create_project(
    payload: ProjectCreate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    project = Project(
        name=payload.name,
        location=payload.location,
        description=payload.description,
        client_id=payload.client_id,
        status=ProjectStatus.DRAFT,
    )
    db.add(project)
    db.commit()
    db.refresh(project)
    return _project_to_response(project, db)


@router.put("/{project_id}", response_model=ProjectResponse)
def update_project(
    project_id: UUID,
    payload: ProjectUpdate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    if payload.name is not None:
        project.name = payload.name
    if payload.location is not None:
        project.location = payload.location
    if payload.description is not None:
        project.description = payload.description
    
    # Handle client assignment and status
    if "client_id" in payload.model_fields_set:
        if payload.client_id is None:
            project.client_id = None
            project.status = ProjectStatus.UNASSIGNED
        else:
            project.client_id = payload.client_id
            # If it was unassigned, move it to CREATED (or READY if it has trees)
            if project.status == ProjectStatus.UNASSIGNED:
                # Check if it has trees (processed)
                tree_count = db.query(func.count(Tree.id)).filter(Tree.project_id == project.id).scalar()
                project.status = ProjectStatus.READY if tree_count > 0 else ProjectStatus.CREATED

    db.commit()
    db.refresh(project)
    return _project_to_response(project, db)


@router.delete("/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_project(
    project_id: UUID,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    # Physical File Cleanup
    import shutil
    from app.config import get_settings
    settings = get_settings()
    
    upload_path = os.path.join(settings.UPLOAD_DIR, str(project_id))
    tiles_path = os.path.join(settings.TILES_DIR, str(project_id))
    
    if os.path.exists(upload_path):
        shutil.rmtree(upload_path)
    if os.path.exists(tiles_path):
        shutil.rmtree(tiles_path)

    db.delete(project)
    db.commit()
