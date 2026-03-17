# backend/main.py
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import List, Optional
import datetime
import subprocess
import platform
import io
import json

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
    "is_under_attack":    False,
    "current_threat_ip":  None,
    "target_device":      None,
    "attack_type":        None,
    "severity":           None,
    "attacker_blocked":   False,
    "blocked_by":         None,
    "ml_engine_active":   True,
    "auto_respond":       False,
    # NEW: packet counter
    "packets_per_second": 3420,
    "peak_pps":           0,
    "total_packets":      0,
}

ALERT_HISTORY  = []
BLOCKED_IPS    = {}
ALERT_COUNTER  = 1

# NEW: Quarantined devices store
# { "10.0.0.12": { device_name, quarantined_at, reason, quarantined_by } }
QUARANTINED_DEVICES = {}

# NEW: Incident log for report
INCIDENT_LOG = []

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
# API 1 — STATUS (with packet counter)
# ==========================================
@app.get("/api/v1/status")
def get_global_status():
    base = {
        "devices_online":     6 - len(QUARANTINED_DEVICES),
        "baseline_status":    "Trained",
        "attacker_blocked":   SYSTEM_STATE["attacker_blocked"],
        "blocked_by":         SYSTEM_STATE["blocked_by"],
        "current_threat_ip":  SYSTEM_STATE["current_threat_ip"],
        "ml_engine_active":   SYSTEM_STATE["ml_engine_active"],
        "auto_respond":       SYSTEM_STATE["auto_respond"],
        "quarantined_count":  len(QUARANTINED_DEVICES),
        # Real-time packet counter
        "packets_per_second": SYSTEM_STATE["packets_per_second"],
        "peak_pps":           SYSTEM_STATE["peak_pps"],
        "total_packets":      SYSTEM_STATE["total_packets"],
    }
    if SYSTEM_STATE["is_under_attack"]:
        return {**base,
            "is_under_attack":  True,
            "critical_alerts":  len([a for a in ALERT_HISTORY
                                     if a["severity"] == "CRITICAL"
                                     and not SYSTEM_STATE["attacker_blocked"]]),
            "ml_confidence":    98.5,
            "active_threat":    SYSTEM_STATE["attack_type"],
        }
    return {**base,
        "is_under_attack":  False,
        "critical_alerts":  0,
        "ml_confidence":    12.0,
        "active_threat":    "None",
    }

# ==========================================
# API 2 — ALERTS
# ==========================================
@app.get("/api/v1/alerts")
def get_alerts():
    return ALERT_HISTORY

# ==========================================
# API 3 — DEVICES (shows quarantine status)
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
    # Mark quarantined devices
    for device in base_devices:
        if device["ip"] in QUARANTINED_DEVICES:
            device["status"] = "QUARANTINED"
    if SYSTEM_STATE["is_under_attack"]:
        base_devices.append({
            "ip":     SYSTEM_STATE["current_threat_ip"],
            "name":   "Unknown Device",
            "status": "BLOCKED" if SYSTEM_STATE["attacker_blocked"] else "ROGUE",
            "type":   "Threat",
        })
        for d in base_devices:
            if d["name"] == "PLC-01" and d["status"] != "QUARANTINED":
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

    # Update packet counter to attack levels
    SYSTEM_STATE["packets_per_second"] = 14250
    SYSTEM_STATE["peak_pps"] = max(SYSTEM_STATE["peak_pps"], 14250)
    SYSTEM_STATE["total_packets"] += 14250

    SYSTEM_STATE.update({
        "is_under_attack":   True,
        "current_threat_ip": payload.attacker_ip,
        "target_device":     payload.target_device,
        "attack_type":       payload.attack_type,
        "severity":          "CRITICAL",
        "attacker_blocked":  False,
        "blocked_by":        None,
    })

    now = datetime.datetime.utcnow().isoformat()
    live_alert = {
        "id":             f"A-{1000 + ALERT_COUNTER}",
        "source_ip":      payload.attacker_ip,
        "destination_ip": payload.target_device,
        "severity":       "CRITICAL",
        "mitre_tag":      "T0836",
        "title":          f"LIVE ATTACK: {payload.attack_type}",
        "description":    "Rogue device attempting to alter physical process state!",
        "timestamp":      now,
    }
    ALERT_HISTORY.insert(0, live_alert)
    ALERT_COUNTER += 1

    # Log to incident log
    INCIDENT_LOG.append({
        "time":    now,
        "event":   f"ATTACK DETECTED: {payload.attack_type} from {payload.attacker_ip}",
        "actor":   "ATTACKER",
        "severity":"CRITICAL",
    })

    await manager.broadcast({"type": "alert", "data": live_alert})

    if SYSTEM_STATE["auto_respond"] and SYSTEM_STATE["ml_engine_active"]:
        fw = _block_ip_firewall(payload.attacker_ip)
        BLOCKED_IPS[payload.attacker_ip] = {
            "reason": "Auto-blocked by ML engine",
            "blocked_at": now, "blocked_by": "auto", "firewall": fw,
        }
        SYSTEM_STATE["attacker_blocked"] = True
        SYSTEM_STATE["blocked_by"]       = "auto"
        INCIDENT_LOG.append({
            "time": now, "event": f"AUTO-BLOCKED: {payload.attacker_ip}",
            "actor": "ML-ENGINE", "severity": "HIGH",
        })
        auto_alert = {
            "id": f"A-{1000 + ALERT_COUNTER}", "source_ip": "SENTINEL-AI",
            "destination_ip": payload.attacker_ip, "severity": "HIGH",
            "mitre_tag": "T0800", "title": f"AUTO-BLOCKED: {payload.attacker_ip}",
            "description": f"ML engine auto-blocked attacker. Firewall: {fw}",
            "timestamp": now,
        }
        ALERT_HISTORY.insert(0, auto_alert)
        ALERT_COUNTER += 1
        await manager.broadcast({"type": "auto_block", "data": auto_alert})

    return {"status": "success", "message": "Attack triggered!"}

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
    now = datetime.datetime.utcnow().isoformat()
    BLOCKED_IPS[ip] = {"reason": req.reason, "blocked_at": now,
                        "blocked_by": "manual", "firewall": fw_status}
    SYSTEM_STATE["attacker_blocked"] = True
    SYSTEM_STATE["blocked_by"]       = "manual"

    INCIDENT_LOG.append({
        "time": now, "event": f"MANUAL BLOCK: {ip} — Firewall: {fw_status}",
        "actor": "OFFICER", "severity": "HIGH",
    })

    block_alert = {
        "id": f"A-{1000 + ALERT_COUNTER}", "source_ip": "OFFICER",
        "destination_ip": ip, "severity": "HIGH", "mitre_tag": "T0800",
        "title": f"BLOCKED: {ip} — Manual Response",
        "description": f"Security officer blocked attacker. Firewall: {fw_status}",
        "timestamp": now,
    }
    ALERT_HISTORY.insert(0, block_alert)
    ALERT_COUNTER += 1
    await manager.broadcast({
        "type": "attacker_blocked",
        "data": {"ip": ip, "blocked_by": "manual", "firewall": fw_status, "timestamp": now},
    })
    return {"status": "blocked", "ip": ip, "firewall": fw_status, "blocked_by": "manual"}

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
# 🆕 API 10 — DEVICE QUARANTINE
# Isolates a compromised ICS device from network
# ==========================================
class QuarantineRequest(BaseModel):
    device_ip:   str
    device_name: str
    reason:      Optional[str] = "Compromised device — lateral movement prevention"

@app.post("/api/v1/quarantine")
async def quarantine_device(req: QuarantineRequest):
    global ALERT_COUNTER
    now = datetime.datetime.utcnow().isoformat()

    if req.device_ip in QUARANTINED_DEVICES:
        return {"status": "already_quarantined", "ip": req.device_ip}

    # Apply firewall rule to isolate the device
    fw_status = "skipped (non-Windows)"
    if platform.system() == "Windows":
        try:
            # Block ALL traffic from this device IP
            cmd_in  = f'netsh advfirewall firewall add rule name="SENTINEL_QUARANTINE_{req.device_ip}" dir=in action=block remoteip={req.device_ip} enable=yes'
            cmd_out = f'netsh advfirewall firewall add rule name="SENTINEL_QUARANTINE_OUT_{req.device_ip}" dir=out action=block remoteip={req.device_ip} enable=yes'
            subprocess.run(cmd_in,  shell=True, timeout=10)
            subprocess.run(cmd_out, shell=True, timeout=10)
            fw_status = "applied (in+out blocked)"
        except Exception as e:
            fw_status = f"error: {e}"

    QUARANTINED_DEVICES[req.device_ip] = {
        "device_name":    req.device_name,
        "reason":         req.reason,
        "quarantined_at": now,
        "quarantined_by": "officer",
        "firewall":       fw_status,
    }

    INCIDENT_LOG.append({
        "time":    now,
        "event":   f"DEVICE QUARANTINED: {req.device_name} ({req.device_ip}) — {req.reason}",
        "actor":   "OFFICER",
        "severity":"CRITICAL",
    })

    q_alert = {
        "id":             f"A-{1000 + ALERT_COUNTER}",
        "source_ip":      "OFFICER",
        "destination_ip": req.device_ip,
        "severity":       "HIGH",
        "mitre_tag":      "T0816",
        "title":          f"QUARANTINED: {req.device_name} — Network Isolation Applied",
        "description":    f"Device isolated to prevent lateral movement. Firewall: {fw_status}",
        "timestamp":      now,
    }
    ALERT_HISTORY.insert(0, q_alert)
    ALERT_COUNTER += 1

    await manager.broadcast({
        "type": "device_quarantined",
        "data": {"ip": req.device_ip, "name": req.device_name, "timestamp": now},
    })

    return {
        "status":   "quarantined",
        "ip":       req.device_ip,
        "name":     req.device_name,
        "firewall": fw_status,
    }

# ==========================================
# 🆕 API 11 — RELEASE QUARANTINE
# ==========================================
class ReleaseRequest(BaseModel):
    device_ip: str

@app.post("/api/v1/quarantine/release")
async def release_quarantine(req: ReleaseRequest):
    if req.device_ip not in QUARANTINED_DEVICES:
        return {"status": "not_quarantined", "ip": req.device_ip}

    device_name = QUARANTINED_DEVICES[req.device_ip]["device_name"]
    del QUARANTINED_DEVICES[req.device_ip]

    if platform.system() == "Windows":
        try:
            subprocess.run(f'netsh advfirewall firewall delete rule name="SENTINEL_QUARANTINE_{req.device_ip}"',     shell=True, timeout=10)
            subprocess.run(f'netsh advfirewall firewall delete rule name="SENTINEL_QUARANTINE_OUT_{req.device_ip}"', shell=True, timeout=10)
        except Exception:
            pass

    INCIDENT_LOG.append({
        "time":    datetime.datetime.utcnow().isoformat(),
        "event":   f"QUARANTINE RELEASED: {device_name} ({req.device_ip})",
        "actor":   "OFFICER",
        "severity":"MEDIUM",
    })

    return {"status": "released", "ip": req.device_ip, "name": device_name}

# ==========================================
# 🆕 API 12 — GET QUARANTINED DEVICES
# ==========================================
@app.get("/api/v1/quarantine")
def get_quarantined():
    return {"total": len(QUARANTINED_DEVICES), "devices": QUARANTINED_DEVICES}

# ==========================================
# 🆕 API 13 — REAL-TIME PACKET COUNTER
# Update and retrieve live packet stats
# ==========================================
class PacketUpdate(BaseModel):
    pps: int  # packets per second

@app.post("/api/v1/packets/update")
async def update_packets(req: PacketUpdate):
    SYSTEM_STATE["packets_per_second"] = req.pps
    SYSTEM_STATE["total_packets"] += req.pps
    if req.pps > SYSTEM_STATE["peak_pps"]:
        SYSTEM_STATE["peak_pps"] = req.pps
    await manager.broadcast({"type": "packet_update", "data": {
        "pps":   req.pps,
        "peak":  SYSTEM_STATE["peak_pps"],
        "total": SYSTEM_STATE["total_packets"],
    }})
    return {"status": "ok", "pps": req.pps}

@app.get("/api/v1/packets")
def get_packet_stats():
    return {
        "packets_per_second": SYSTEM_STATE["packets_per_second"],
        "peak_pps":           SYSTEM_STATE["peak_pps"],
        "total_packets":      SYSTEM_STATE["total_packets"],
        "is_under_attack":    SYSTEM_STATE["is_under_attack"],
    }

# ==========================================
# 🆕 API 14 — EXPORT INCIDENT REPORT (CSV)
# ==========================================
@app.get("/api/v1/report/csv")
def export_report_csv():
    lines = ["Time,Event,Actor,Severity"]
    for entry in INCIDENT_LOG:
        t   = entry.get("time", "")[:19].replace("T", " ")
        ev  = entry.get("event", "").replace(",", ";")
        act = entry.get("actor", "")
        sev = entry.get("severity", "")
        lines.append(f"{t},{ev},{act},{sev}")

    lines.append("")
    lines.append("Time,Alert ID,Source IP,Destination,Severity,Title")
    for a in ALERT_HISTORY:
        t   = a.get("timestamp", "")[:19].replace("T", " ")
        aid = a.get("id", "")
        src = a.get("source_ip", "")
        dst = a.get("destination_ip", "")
        sev = a.get("severity", "")
        ttl = a.get("title", "").replace(",", ";")
        lines.append(f"{t},{aid},{src},{dst},{sev},{ttl}")

    content  = "\n".join(lines)
    filename = f"sentinel_report_{datetime.datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.csv"
    return StreamingResponse(
        io.StringIO(content),
        media_type="text/csv",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )

# ==========================================
# 🆕 API 15 — EXPORT INCIDENT REPORT (JSON)
# ==========================================
@app.get("/api/v1/report/json")
def export_report_json():
    report = {
        "generated_at":   datetime.datetime.utcnow().isoformat(),
        "system_state":   SYSTEM_STATE,
        "total_alerts":   len(ALERT_HISTORY),
        "blocked_ips":    BLOCKED_IPS,
        "quarantined":    QUARANTINED_DEVICES,
        "incident_log":   INCIDENT_LOG,
        "alerts":         ALERT_HISTORY,
    }
    content  = json.dumps(report, indent=2)
    filename = f"sentinel_report_{datetime.datetime.utcnow().strftime('%Y%m%d_%H%M%S')}.json"
    return StreamingResponse(
        io.StringIO(content),
        media_type="application/json",
        headers={"Content-Disposition": f"attachment; filename={filename}"},
    )

# ==========================================
# API 16 — RESET
# ==========================================
@app.post("/api/v1/reset")
def reset_system():
    global ALERT_COUNTER
    SYSTEM_STATE.update({
        "is_under_attack":    False,
        "current_threat_ip":  None,
        "attacker_blocked":   False,
        "blocked_by":         None,
        "packets_per_second": 3420,
    })
    ALERT_HISTORY.clear()
    BLOCKED_IPS.clear()
    QUARANTINED_DEVICES.clear()
    INCIDENT_LOG.clear()
    ALERT_COUNTER = 1
    return {"message": "System reset to secure baseline."}

# ==========================================
# API 17 — SOFT RESET (keep history)
# ==========================================
@app.post("/api/v1/soft-reset")
def soft_reset():
    SYSTEM_STATE.update({
        "is_under_attack":    False,
        "current_threat_ip":  None,
        "attacker_blocked":   False,
        "blocked_by":         None,
        "packets_per_second": 3420,
    })
    BLOCKED_IPS.clear()
    return {"message": "Soft reset done.", "total_alerts": len(ALERT_HISTORY)}

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