from uuid import UUID
from typing import List
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session
from sqlalchemy import func

from app.database import get_db
from app.models import User, UserRole, Project
from app.auth import require_admin, hash_password
from app.schemas import UserCreate, UserResponse

router = APIRouter(prefix="/api/users", tags=["Users"])


def _user_to_response(u: User, db: Session) -> UserResponse:
    project_count = db.query(func.count(Project.id)).filter(Project.client_id == u.id).scalar()
    return UserResponse(
        id=u.id,
        username=u.username,
        full_name=u.full_name,
        role=u.role.value,
        created_at=u.created_at,
        project_count=project_count or 0
    )


@router.get("", response_model=List[UserResponse])
def list_users(db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    users = db.query(User).order_by(User.created_at.desc()).all()
    return [_user_to_response(u, db) for u in users]


@router.get("/clients", response_model=List[UserResponse])
def list_clients(db: Session = Depends(get_db), admin: User = Depends(require_admin)):
    clients = db.query(User).filter(User.role == UserRole.CLIENT).order_by(User.full_name).all()
    return [_user_to_response(u, db) for u in clients]


@router.post("", response_model=UserResponse, status_code=status.HTTP_201_CREATED)
def create_user(
    payload: UserCreate,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    existing = db.query(User).filter(User.username == payload.username).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Username already taken",
        )

    user = User(
        username=payload.username,
        password_hash=hash_password(payload.password),
        full_name=payload.full_name,
        role=UserRole(payload.role.value),
    )
    db.add(user)
    db.commit()
    db.refresh(user)

    return UserResponse(
        id=user.id,
        username=user.username,
        full_name=user.full_name,
        role=user.role.value,
        created_at=user.created_at,
    )


@router.put("/{user_id}", response_model=UserResponse)
def update_user(
    user_id: UUID,
    payload: UserCreate,  # Reusing UserCreate for now, or could make a UserUpdate
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    if payload.username != user.username:
        existing = db.query(User).filter(User.username == payload.username).first()
        if existing:
            raise HTTPException(status_code=409, detail="Username already taken")
        user.username = payload.username

    user.full_name = payload.full_name
    if payload.password:
        user.password_hash = hash_password(payload.password)
    
    db.commit()
    db.refresh(user)
    return UserResponse(
        id=user.id,
        username=user.username,
        full_name=user.full_name,
        role=user.role.value,
        created_at=user.created_at,
    )


@router.delete("/{user_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_user(
    user_id: UUID,
    db: Session = Depends(get_db),
    admin: User = Depends(require_admin),
):
    if user_id == admin.id:
        raise HTTPException(status_code=400, detail="Cannot delete your own account")

    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    # Projects assigned to this client should be "Unassigned"
    from app.models import Project
    db.query(Project).filter(Project.client_id == user_id).update({Project.client_id: None})

    db.delete(user)
    db.commit()
