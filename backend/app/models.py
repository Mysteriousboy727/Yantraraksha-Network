# app/models.py
from sqlalchemy import Column, Integer, String, Float, Boolean, DateTime
from app.database import Base
from datetime import datetime

# Device Table: Factory ki machines save karne ke liye
class Device(Base):
    __tablename__ = "devices"

    id = Column(Integer, primary_key=True, index=True)
    device_name = Column(String, index=True)
    ip_address = Column(String, unique=True, index=True)
    protocol = Column(String)  # e.g., "Modbus"
    status = Column(String, default="online") # online/offline/rogue
    anomaly_score = Column(Float, default=0.0) # 0-100 risk score
    whitelisted = Column(Boolean, default=False)

# Alert Table: Jab attack hoga, uski warning save karne ke liye
class Alert(Base):
    __tablename__ = "alerts"

    id = Column(Integer, primary_key=True, index=True)
    source_ip = Column(String)
    destination_ip = Column(String)
    severity = Column(String) # CRITICAL, HIGH, MEDIUM
    protocol = Column(String) 
    function_code = Column(String) # e.g., "FC-05" (Write command)
    mitre_tag = Column(String) # e.g., "T1204.001"
    description = Column(String)
    timestamp = Column(DateTime, default=datetime.utcnow)