"""Database seeding script – creates default admin and client users."""
from app.database import SessionLocal, engine
from app.models import Base, User, UserRole
from app.auth import hash_password


def seed():
    # Create all tables
    Base.metadata.create_all(bind=engine)

    db = SessionLocal()
    try:
        # Check if admin already exists
        existing_admin = db.query(User).filter(User.username == "admin").first()
        if existing_admin:
            print("Database already seeded.")
            return

        admin = User(
            username="admin",
            password_hash=hash_password("admin123"),
            full_name="System Administrator",
            role=UserRole.ADMIN,
        )

        client = User(
            username="client",
            password_hash=hash_password("client123"),
            full_name="Demo Client",
            role=UserRole.CLIENT,
        )

        db.add_all([admin, client])
        db.commit()
        print("Database seeded successfully!")
        print("  Admin: admin / admin123")
        print("  Client: client / client123")
    finally:
        db.close()


if __name__ == "__main__":
    seed()
