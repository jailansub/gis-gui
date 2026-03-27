import os
import shutil
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, status
from sqlalchemy.orm import Session
from uuid import UUID
from typing import List

from app.database import get_db
from app.models import User, Project, ProjectStatus
from app.auth import require_admin
from app.config import get_settings
from app.schemas import ProcessingStatus

settings = get_settings()
router = APIRouter(prefix="/api/projects", tags=["Upload"])

ALLOWED_EXTENSIONS = {".shp", ".shx", ".dbf", ".prj", ".cpg", ".tif", ".tiff"}


@router.post("/{project_id}/upload/{layer_type}", status_code=status.HTTP_202_ACCEPTED)
def upload_project_layer(
    project_id: UUID,
    layer_type: str,
    files: List[UploadFile] = File(...),
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    if layer_type not in ["ortho", "dtm", "dsm", "boundary", "trees", "health"]:
        raise HTTPException(status_code=400, detail="Invalid layer type")

    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    # Validate file extensions
    allowed = ALLOWED_EXTENSIONS
    for f in files:
        ext = os.path.splitext(f.filename)[1].lower()
        if ext not in allowed:
            raise HTTPException(
                status_code=400,
                detail=f"File type '{ext}' not allowed. Allowed: {', '.join(allowed)}",
            )

    # Create upload directory for this project
    upload_dir = os.path.join(settings.UPLOAD_DIR, str(project_id))
    os.makedirs(upload_dir, exist_ok=True)

    # Save files
    saved_files = []
    for f in files:
        # For ortho, dtm, dsm, we might want to normalize the names for the processor
        filename = f.filename
        if layer_type == "ortho" and f.filename.lower().endswith((".tif", ".tiff")):
            filename = "ortho.tif"
        elif layer_type == "dtm" and f.filename.lower().endswith((".tif", ".tiff")):
            filename = "dtm.tif"
        elif layer_type == "dsm" and f.filename.lower().endswith((".tif", ".tiff")):
            filename = "dsm.tif"
        
        file_path = os.path.join(upload_dir, filename)
        with open(file_path, "wb") as buffer:
            shutil.copyfileobj(f.file, buffer)
        saved_files.append(filename)

    project.status = ProjectStatus.UPLOADING
    db.commit()

    return {
        "message": f"Files for {layer_type} uploaded successfully.",
        "project_id": str(project_id),
        "files": saved_files,
    }


@router.post("/{project_id}/process", status_code=status.HTTP_202_ACCEPTED)
def trigger_processing(
    project_id: UUID,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    # Update project status
    project.status = ProjectStatus.PROCESSING
    db.commit()

    # Trigger async processing
    from app.tasks import process_project_files
    process_project_files.delay(str(project_id))

    return {
        "message": "GIS processing task triggered.",
        "project_id": str(project_id),
    }


@router.get("/{project_id}/status", response_model=ProcessingStatus)
def get_processing_status(
    project_id: UUID,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        raise HTTPException(status_code=404, detail="Project not found")

    return ProcessingStatus(
        project_id=project.id,
        status=project.status.value,
        error=project.processing_error,
    )
