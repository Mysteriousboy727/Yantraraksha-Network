# backend/main.py
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import datetime
import subprocess
import platform

app = FastAPI(title="Suraksha SENTINEL API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ==========================================
# 🧠 SYSTEM STATE
# ==========================================
SYSTEM_STATE = {
    "is_under_attack":   False,
    "current_threat_ip": None,
    "target_device":     None,
    "attack_type":       None,
    "severity":          None,
    "attacker_blocked":  False,
    "blocked_by":        None,
    "ml_engine_active":  True,
    "auto_respond":      False,
}

ALERT_HISTORY = []   # ← grows forever, never cleared on soft-reset
BLOCKED_IPS   = {}
ALERT_COUNTER = 1

# ==========================================
# 🔌 WEBSOCKET MANAGER
# ==========================================
class ConnectionManager:
    def __init__(self):
        self.active_connections: List[WebSocket] = []

    async def connect(self, websocket: WebSocket):
        await websocket.accept()
        self.active_connections.append(websocket)

    def disconnect(self, websocket: WebSocket):
        if websocket in self.active_connections:
            self.active_connections.remove(websocket)

    async def broadcast(self, message: dict):
        dead = []
        for conn in self.active_connections:
            try:
                await conn.send_json(message)
            except Exception:
                dead.append(conn)
        for d in dead:
            self.active_connections.remove(d)

manager = ConnectionManager()

# ==========================================
# 🔥 FIREWALL HELPERS
# ==========================================
def _block_ip_firewall(ip: str) -> str:
    if platform.system() != "Windows":
        return "skipped (non-Windows)"
    try:
        cmd = (
            f'netsh advfirewall firewall add rule '
            f'name="SENTINEL_BLOCK_{ip}" '
            f'dir=in action=block remoteip={ip} enable=yes'
        )
        r = subprocess.run(cmd, shell=True, capture_output=True, text=True, timeout=10)
        return "applied" if r.returncode == 0 else f"failed: {r.stderr.strip()}"
    except Exception as e:
        return f"error: {e}"

def _unblock_ip_firewall(ip: str) -> str:
    if platform.system() != "Windows":
        return "skipped (non-Windows)"
    try:
        cmd = f'netsh advfirewall firewall delete rule name="SENTINEL_BLOCK_{ip}"'
        r = subprocess.run(cmd, shell=True, capture_output=True, text=True, timeout=10)
        return "removed" if r.returncode == 0 else f"failed: {r.stderr.strip()}"
    except Exception as e:
        return f"error: {e}"

# ==========================================
# API 1 — STATUS
# ==========================================
@app.get("/api/v1/status")
def get_global_status():
    base = {
        "devices_online":    6,
        "baseline_status":   "Trained",
        "attacker_blocked":  SYSTEM_STATE["attacker_blocked"],
        "blocked_by":        SYSTEM_STATE["blocked_by"],
        "current_threat_ip": SYSTEM_STATE["current_threat_ip"],
        "ml_engine_active":  SYSTEM_STATE["ml_engine_active"],
        "auto_respond":      SYSTEM_STATE["auto_respond"],
        # Always return TOTAL alert count — never resets to 0
        "total_alerts":      len(ALERT_HISTORY),
    }
    if SYSTEM_STATE["is_under_attack"]:
        return {**base,
            "is_under_attack":    True,
            "packets_per_second": 14250,
            "critical_alerts":    len([a for a in ALERT_HISTORY if a["severity"] == "CRITICAL"]),
            "ml_confidence":      98.5,
            "active_threat":      SYSTEM_STATE["attack_type"],
        }
    return {**base,
        "is_under_attack":    False,
        "packets_per_second": 3420,
        "critical_alerts":    len([a for a in ALERT_HISTORY if a["severity"] == "CRITICAL"]),
        "ml_confidence":      12.0,
        "active_threat":      "None",
    }

# ==========================================
# API 2 — ALERTS
# ==========================================
@app.get("/api/v1/alerts")
def get_alerts():
    return ALERT_HISTORY   # full growing history

# ==========================================
# API 3 — DEVICES
# ==========================================
@app.get("/api/v1/devices")
def get_devices():
    base_devices = [
        {"ip": "10.0.0.11", "name": "HMI-D1",         "status": "ONLINE", "type": "Known"},
        {"ip": "10.0.0.12", "name": "PLC-01",          "status": "ONLINE", "type": "Known"},
        {"ip": "10.0.0.13", "name": "Robotic Arm",     "status": "ONLINE", "type": "Known"},
        {"ip": "10.0.0.14", "name": "Conveyor Sensor", "status": "ONLINE", "type": "Known"},
        {"ip": "10.0.0.15", "name": "HMI-01",          "status": "ONLINE", "type": "Known"},
        {"ip": "10.0.0.16", "name": "PLC-04",          "status": "ONLINE", "type": "Known"},
    ]
    if SYSTEM_STATE["is_under_attack"]:
        base_devices.append({
            "ip":     SYSTEM_STATE["current_threat_ip"],
            "name":   "Unknown Device",
            "status": "BLOCKED" if SYSTEM_STATE["attacker_blocked"] else "ROGUE",
            "type":   "Threat",
        })
        for d in base_devices:
            if d["name"] == "PLC-01":
                d["status"] = "COMPROMISED"
    return base_devices

# ==========================================
# API 4 — INCIDENT DETAILS
# ==========================================
@app.get("/api/v1/incident-details")
def get_incident_details():
    if SYSTEM_STATE["is_under_attack"]:
        return {
            "protocol":      "Modbus TCP",
            "transport":     "TCP",
            "port":          502,
            "function_code": "0x05",
            "fc_name":       "Write Single Coil",
            "playbook_steps": [
                "Isolate PLC-01 from main VLAN.",
                f"Block IP {SYSTEM_STATE['current_threat_ip']} at perimeter firewall.",
                "Flush Modbus holding registers.",
            ],
        }
    return {"message": "System is secure."}

# ==========================================
# API 5 — TRIGGER ATTACK
# ==========================================
class AttackPayload(BaseModel):
    attacker_ip:   str = "45.33.32.156"
    target_device: str = "10.0.0.12 (PLC-01)"
    attack_type:   str = "Modbus Write Injection"

@app.post("/api/v1/trigger-attack")
async def trigger_attack(payload: AttackPayload):
    global ALERT_COUNTER

    SYSTEM_STATE.update({
        "is_under_attack":   True,
        "current_threat_ip": payload.attacker_ip,
        "target_device":     payload.target_device,
        "attack_type":       payload.attack_type,
        "severity":          "CRITICAL",
        "attacker_blocked":  False,
        "blocked_by":        None,
    })

    live_alert = {
        "id":             f"A-{1000 + ALERT_COUNTER}",
        "source_ip":      payload.attacker_ip,
        "destination_ip": payload.target_device,
        "severity":       "CRITICAL",
        "mitre_tag":      "T0836",
        "title":          f"LIVE ATTACK: {payload.attack_type}",
        "description":    "Rogue device attempting to alter physical process state!",
        "timestamp":      datetime.datetime.utcnow().isoformat(),
    }
    ALERT_HISTORY.insert(0, live_alert)
    ALERT_COUNTER += 1
    await manager.broadcast({"type": "alert", "data": live_alert})

    # Auto-respond
    if SYSTEM_STATE["auto_respond"] and SYSTEM_STATE["ml_engine_active"]:
        fw = _block_ip_firewall(payload.attacker_ip)
        BLOCKED_IPS[payload.attacker_ip] = {
            "reason":     "Auto-blocked by ML engine",
            "blocked_at": datetime.datetime.utcnow().isoformat(),
            "blocked_by": "auto",
            "firewall":   fw,
        }
        SYSTEM_STATE["attacker_blocked"] = True
        SYSTEM_STATE["blocked_by"]       = "auto"

        auto_alert = {
            "id":             f"A-{1000 + ALERT_COUNTER}",
            "source_ip":      "SENTINEL-AI",
            "destination_ip": payload.attacker_ip,
            "severity":       "HIGH",
            "mitre_tag":      "T0800",
            "title":          f"AUTO-BLOCKED: {payload.attacker_ip}",
            "description":    f"ML engine auto-blocked attacker. Firewall: {fw}",
            "timestamp":      datetime.datetime.utcnow().isoformat(),
        }
        ALERT_HISTORY.insert(0, auto_alert)
        ALERT_COUNTER += 1
        await manager.broadcast({"type": "auto_block", "data": auto_alert})

    return {"status": "success", "message": "Attack triggered!",
            "total_alerts": len(ALERT_HISTORY)}

# ==========================================
# API 6 — BLOCK ATTACKER
# ==========================================
class BlockRequest(BaseModel):
    ip:     Optional[str] = None
    reason: Optional[str] = "Manual block by security officer"

@app.post("/api/v1/block-attacker")
async def block_attacker(req: BlockRequest):
    global ALERT_COUNTER

    ip = req.ip or SYSTEM_STATE.get("current_threat_ip")
    if not ip:
        return {"status": "error", "message": "No attacker IP to block"}
    if ip in BLOCKED_IPS:
        return {"status": "already_blocked", "ip": ip}

    fw_status = _block_ip_firewall(ip)
    BLOCKED_IPS[ip] = {
        "reason":     req.reason,
        "blocked_at": datetime.datetime.utcnow().isoformat(),
        "blocked_by": "manual",
        "firewall":   fw_status,
    }
    SYSTEM_STATE["attacker_blocked"] = True
    SYSTEM_STATE["blocked_by"]       = "manual"

    block_alert = {
        "id":             f"A-{1000 + ALERT_COUNTER}",
        "source_ip":      "OFFICER",
        "destination_ip": ip,
        "severity":       "HIGH",
        "mitre_tag":      "T0800",
        "title":          f"BLOCKED: {ip} — Manual Response",
        "description":    f"Security officer blocked attacker. Firewall: {fw_status}",
        "timestamp":      datetime.datetime.utcnow().isoformat(),
    }
    ALERT_HISTORY.insert(0, block_alert)
    ALERT_COUNTER += 1

    await manager.broadcast({
        "type": "attacker_blocked",
        "data": {"ip": ip, "blocked_by": "manual",
                 "firewall": fw_status,
                 "timestamp": datetime.datetime.utcnow().isoformat()},
    })
    return {"status": "blocked", "ip": ip,
            "firewall": fw_status, "blocked_by": "manual"}

# ==========================================
# API 7 — ML ENGINE CONTROL
# ==========================================
class MLControlRequest(BaseModel):
    action: str

@app.post("/api/v1/ml-control")
async def ml_control(req: MLControlRequest):
    if req.action == "start":
        SYSTEM_STATE["ml_engine_active"] = True
        await manager.broadcast({"type": "ml_status", "data": {"active": True}})
        return {"status": "started"}
    elif req.action == "stop":
        SYSTEM_STATE["ml_engine_active"] = False
        await manager.broadcast({"type": "ml_status", "data": {"active": False}})
        return {"status": "stopped"}
    elif req.action == "auto_on":
        SYSTEM_STATE["auto_respond"] = True
        return {"status": "auto_respond_enabled"}
    elif req.action == "auto_off":
        SYSTEM_STATE["auto_respond"] = False
        return {"status": "auto_respond_disabled"}
    return {"status": "error", "message": "Unknown action"}

# ==========================================
# API 8 — BLOCKED IPs
# ==========================================
@app.get("/api/v1/blocked-ips")
def get_blocked_ips():
    return {"total": len(BLOCKED_IPS), "blocked": BLOCKED_IPS}

# ==========================================
# API 9 — UNBLOCK
# ==========================================
class UnblockRequest(BaseModel):
    ip: str

@app.post("/api/v1/unblock")
async def unblock_ip(req: UnblockRequest):
    if req.ip not in BLOCKED_IPS:
        return {"status": "not_found", "ip": req.ip}
    del BLOCKED_IPS[req.ip]
    fw_status = _unblock_ip_firewall(req.ip)
    if req.ip == SYSTEM_STATE.get("current_threat_ip"):
        SYSTEM_STATE["attacker_blocked"] = False
        SYSTEM_STATE["blocked_by"]       = None
    return {"status": "unblocked", "ip": req.ip, "firewall": fw_status}

# ==========================================
# API 10 — SOFT RESET ← KEY FIX
# Resets attack state + blocked IPs
# but KEEPS alert history so count grows
# ==========================================
@app.post("/api/v1/soft-reset")
def soft_reset():
    """
    Called by hacker_attack.py before each new attack.
    Clears blocked state so officer can block again.
    Does NOT clear ALERT_HISTORY — count keeps increasing.
    """
    SYSTEM_STATE.update({
        "is_under_attack":   False,
        "current_threat_ip": None,
        "attacker_blocked":  False,
        "blocked_by":        None,
    })
    BLOCKED_IPS.clear()
    # NOTE: ALERT_HISTORY and ALERT_COUNTER are intentionally NOT reset
    return {"message": "Soft reset — attack state cleared, alert history preserved.",
            "total_alerts": len(ALERT_HISTORY)}

# ==========================================
# API 11 — FULL RESET (manual, clears everything)
# ==========================================
@app.post("/api/v1/reset")
def full_reset():
    global ALERT_COUNTER
    SYSTEM_STATE.update({
        "is_under_attack":   False,
        "current_threat_ip": None,
        "attacker_blocked":  False,
        "blocked_by":        None,
    })
    ALERT_HISTORY.clear()
    BLOCKED_IPS.clear()
    ALERT_COUNTER = 1
    return {"message": "Full reset — all data cleared."}

# ==========================================
# WEBSOCKET
# ==========================================
@app.websocket("/ws/alerts")
async def alerts_websocket(websocket: WebSocket):
    await manager.connect(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        manager.disconnect(websocket)