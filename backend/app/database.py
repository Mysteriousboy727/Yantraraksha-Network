# app/database.py
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.ext.declarative import declarative_base

# Hum SQLite use kar rahe hain, jo local file mein data save karega (suraksha.db)
SQLALCHEMY_DATABASE_URL = "sqlite:///./suraksha.db"

# Engine database se connection banata hai
engine = create_engine(
    SQLALCHEMY_DATABASE_URL, connect_args={"check_same_thread": False}
)

# SessionLocal humara "session" banayega jisse hum data read/write karenge
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

# Base class jisse humare saare tables (models) inherit honge
Base = declarative_base()

# Ye function hume har bar naya connection dega jab hume database chahiye
def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()