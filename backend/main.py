# backend/main.py
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List
import datetime

app = FastAPI(title="Suraksha SENTINEL API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 🧠 THE DEMO BRAIN
SYSTEM_STATE = {
    "is_under_attack": False,
    "current_threat_ip": None,
    "target_device": None,
    "attack_type": None,
    "severity": None
}

# 🗄️ NEW: This list will store all attacks so the count keeps increasing!
ALERT_HISTORY = []
ALERT_COUNTER = 1

# --- WEBSOCKET MANAGER ---
class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        self.active_connections.remove(websocket)

    async def broadcast(self, message: dict):
        for connection in self.active_connections:
            await connection.send_json(message)

manager = ConnectionManager()

# ==========================================
# APIs
# ==========================================

@app.get("/api/v1/status")
def get_global_status():
    if SYSTEM_STATE["is_under_attack"]:
        return {
            "is_under_attack": True,
            "devices_online": 6,
            "packets_per_second": 14250, 
            "critical_alerts": len(ALERT_HISTORY),  # 🔥 Count will now increase!
            "ml_confidence": 98.5,       
            "baseline_status": "Trained",
            "active_threat": SYSTEM_STATE["attack_type"]
        }
    else:
        return {
            "is_under_attack": False,
            "devices_online": 6,
            "packets_per_second": 3420,  
            "critical_alerts": 0,
            "ml_confidence": 12.0,       
            "baseline_status": "Trained",
            "active_threat": "None"
        }

@app.get("/api/v1/alerts")
def get_alerts():
    # 🔥 Return the full history of attacks (newest first)
    return ALERT_HISTORY

@app.get("/api/v1/devices")
def get_devices():
    base_devices = [
        {"ip": "10.0.0.11", "name": "HMI-D1", "status": "ONLINE", "type": "Known"},
        {"ip": "10.0.0.12", "name": "PLC-01", "status": "ONLINE", "type": "Known"},
        {"ip": "10.0.0.13", "name": "Robotic Arm", "status": "ONLINE", "type": "Known"},
        {"ip": "10.0.0.14", "name": "Conveyor Sensor", "status": "ONLINE", "type": "Known"},
        {"ip": "10.0.0.15", "name": "HMI-01", "status": "ONLINE", "type": "Known"},
        {"ip": "10.0.0.16", "name": "PLC-04", "status": "ONLINE", "type": "Known"}
    ]
    if SYSTEM_STATE["is_under_attack"]:
        base_devices.append({
            "ip": SYSTEM_STATE["current_threat_ip"], 
            "name": "Unknown Device", 
            "status": "ROGUE", 
            "type": "Threat"
        })
        for device in base_devices:
            if device["name"] == "PLC-01":
                device["status"] = "COMPROMISED"
    return base_devices

@app.get("/api/v1/incident-details")
def get_incident_details():
    if SYSTEM_STATE["is_under_attack"]:
        return {
            "protocol": "Modbus TCP",
            "transport": "TCP",
            "port": 502,
            "function_code": "0x05",
            "fc_name": "Write Single Coil",
            "playbook_steps": [
                "Isolate PLC-01 from main VLAN.",
                f"Block IP {SYSTEM_STATE['current_threat_ip']} at perimeter firewall.",
                "Flush Modbus holding registers."
            ]
        }
    return {"message": "System is secure."}

class AttackPayload(BaseModel):
    attacker_ip: str = "45.33.32.156"
    target_device: str = "10.0.0.12 (PLC-01)"
    attack_type: str = "Modbus Write Injection"

@app.post("/api/v1/trigger-attack")
async def trigger_attack(payload: AttackPayload):
    global ALERT_COUNTER
    
    SYSTEM_STATE["is_under_attack"] = True
    SYSTEM_STATE["current_threat_ip"] = payload.attacker_ip
    SYSTEM_STATE["target_device"] = payload.target_device
    SYSTEM_STATE["attack_type"] = payload.attack_type
    SYSTEM_STATE["severity"] = "CRITICAL"
    
    # Create a unique alert every time
    live_alert = {
        "id": f"A-{1000 + ALERT_COUNTER}",
        "source_ip": payload.attacker_ip,
        "destination_ip": payload.target_device,
        "severity": "CRITICAL",
        "mitre_tag": "T0836",
        "title": f"LIVE ATTACK: {payload.attack_type}",
        "description": "Rogue device attempting to alter physical process state!",
        "timestamp": datetime.datetime.utcnow().isoformat()
    }
    
    # 🔥 Add the new alert to the TOP of the history list
    ALERT_HISTORY.insert(0, live_alert)
    ALERT_COUNTER += 1
    
    await manager.broadcast({"type": "alert", "data": live_alert})
    return {"status": "success", "message": "Attack triggered successfully!"}

@app.websocket("/ws/alerts")
async def alerts_websocket(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)

# 🔥 THE RESET API: Clears everything back to Green!
@app.post("/api/v1/reset")
def reset_system():
    global ALERT_COUNTER
    SYSTEM_STATE["is_under_attack"] = False
    SYSTEM_STATE["current_threat_ip"] = None
    ALERT_HISTORY.clear() # Delete all past alerts
    ALERT_COUNTER = 1     # Reset ID counter
    return {"message": "System reset to secure baseline."}