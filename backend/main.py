# main.py
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app import models
from app.database import engine
import datetime

# Database tables create karna
models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="Suraksha SENTINEL API")

# CORS SETUP: Ye bohot zaroori hai! 
# Ye React (jo port 5174 par chalega) ko FastAPI (port 8000) se baat karne ki permission deta hai.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Hackathon ke liye allow all
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.get("/")
def read_root():
    return {"message": "Suraksha SENTINEL Backend is Running!"}

# ==========================================
# Phase 2: Naye API Endpoints (Mock Data)
# ==========================================

@app.get("/api/v1/kpi")
def get_kpis():
    # Ye fake data hai dashboard ke upar wale 6 boxes ke liye
    return {
        "active_threats": 3,
        "active_threats_surge": 1,
        "devices_online": 24,
        "total_devices": 26,
        "packets_per_second": 4280,
        "baseline_packets": 3800,
        "anomaly_score": 87,
        "ml_confidence": 96,
        "violations": 14,
        "mean_time_to_detect": 1.2
    }

@app.get("/api/v1/alerts")
def get_alerts(limit: int = 50):
    # Ye mock alert hai tumhare Alert Feed tab ke liye
    return [
        {
            "id": 1,
            "source_ip": "192.168.1.105",
            "destination_ip": "10.0.0.12",
            "severity": "CRITICAL",
            "mitre_tag": "T0836",
            "title": "Unauthorized Modbus Write (FC-05)",
            "description": "Rogue IP attempting to stop PLC.",
            "timestamp": datetime.datetime.utcnow().isoformat()
        },
        {
            "id": 2,
            "source_ip": "192.168.1.15",
            "destination_ip": "10.0.0.12",
            "severity": "MEDIUM",
            "mitre_tag": "T0801",
            "title": "Traffic Anomaly Detected",
            "description": "Isolation Forest detected abnormal packet rate.",
            "timestamp": datetime.datetime.utcnow().isoformat()
        }
    ]

@app.get("/api/v1/devices")
def get_devices():
    # Sidebar mein factory machines ki list dikhane ke liye
    return [
        {"id": 1, "device_name": "Main Conveyor PLC", "ip_address": "10.0.0.12", "protocol": "Modbus", "status": "online", "anomaly_score": 12, "whitelisted": True},
        {"id": 2, "device_name": "Cooling Pump HMI", "ip_address": "10.0.0.15", "protocol": "DNP3", "status": "online", "anomaly_score": 5, "whitelisted": True},
        {"id": 3, "device_name": "UNKNOWN_LAPTOP", "ip_address": "192.168.1.105", "protocol": "TCP", "status": "rogue", "anomaly_score": 98, "whitelisted": False}
    ]

@app.get("/api/v1/traffic/timeline")
def get_traffic():
    # Graph draw karne ke liye khali list abhi ke liye
    return []

from fastapi import WebSocket, WebSocketDisconnect
from typing import List

# ==========================================
# Phase 3: WebSocket & Real-Time Alerting
# ==========================================

# Ye manager saare connected dashboards ka record rakhega
class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)

    # Ye function ek second mein saare screens par alert bhej dega
    async def broadcast(self, message: dict):
        for connection in self.active_connections:
            await connection.send_json(message)

manager = ConnectionManager()

# Ye wo rasta hai jisse React dashboard live connect hoga
@app.websocket("/ws/alerts")
async def websocket_endpoint(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            # Hum sirf connection zinda rakh rahe hain
            data = await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)

# ==========================================
# THE HACKER ENDPOINT (Demo ke liye)
# ==========================================
@app.post("/api/v1/trigger-attack")
async def trigger_attack():
    # Ye ek FAKE attack generate karega aur turant WebSocket pe bhej dega
    hacker_alert = {
        "id": 999,
        "source_ip": "192.168.1.200",  # Hacker ka Naya IP
        "destination_ip": "10.0.0.12",   # Factory ki Machine
        "severity": "CRITICAL",
        "mitre_tag": "T0836",
        "title": "🚨 LIVE ATTACK: Modbus Write Injection",
        "description": "Rogue device attempting to STOP the production line!",
        "timestamp": datetime.datetime.utcnow().isoformat()
    }
    
    # Alert ko live dashboard par push karo!
    await manager.broadcast({"type": "alert", "data": hacker_alert})
    
    return {"message": "Attack Successfully Sent to Dashboard!"}