# hacker_attack.py
import requests
import time
import random

BACKEND = "http://127.0.0.1:8000"

ATTACK_TYPES = [
    {"attacker_ip": "45.33.32.156", "target_device": "10.0.0.12 (PLC-01)",         "attack_type": "Modbus Write Injection"},
    {"attacker_ip": "192.168.1.99", "target_device": "10.0.0.11 (HMI-D1)",         "attack_type": "DNP3 Replay Attack"},
    {"attacker_ip": "10.10.10.55",  "target_device": "10.0.0.16 (PLC-04)",         "attack_type": "Port Scan + Reconnaissance"},
    {"attacker_ip": "77.88.55.22",  "target_device": "10.0.0.13 (Robotic Arm)",    "attack_type": "Man-in-the-Middle (MITM)"},
    {"attacker_ip": "45.33.32.156", "target_device": "10.0.0.12 (PLC-01)",         "attack_type": "DDoS Flood Attack"},
]

def reset_system():
    """Soft-reset: clears attack state but KEEPS alert history so count grows."""
    try:
        requests.post(f"{BACKEND}/api/v1/soft-reset", timeout=5)  # ← KEY FIX
        print("🔄 System soft-reset (attack state cleared, history preserved)...")
        time.sleep(0.5)
    except Exception as e:
        print(f"⚠️  Reset warning: {e}")

def launch_attack(payload):
    """Send attack payload to backend."""
    try:
        response = requests.post(
            f"{BACKEND}/api/v1/trigger-attack",
            json=payload,
            timeout=5
        )
        return response.status_code == 200, response
    except requests.exceptions.ConnectionError:
        return False, None

def main():
    print("=" * 55)
    print("  ☠️   SURAKSHA SENTINEL — ATTACK SIMULATOR")
    print("=" * 55)
    print()

    payload = random.choice(ATTACK_TYPES)

    print("💀 INITIATING ATTACK ON OT NETWORK...")
    time.sleep(1)
    print("🔍 Scanning for vulnerable ICS devices...")
    time.sleep(1)
    print(f"⚡ Found Target: {payload['target_device']}")
    time.sleep(1)
    print(f"💉 Launching: {payload['attack_type']}")
    time.sleep(0.5)
    print(f"🌐 Attacker IP: {payload['attacker_ip']}")
    time.sleep(1)

    reset_system()

    success, response = launch_attack(payload)

    if success:
        data = response.json()
        print()
        print("🚨 BOOM! ATTACK SUCCESSFUL! Check the Dashboard!")
        print(f"   → Attacker      : {payload['attacker_ip']}")
        print(f"   → Target        : {payload['target_device']}")
        print(f"   → Method        : {payload['attack_type']}")
        print(f"   → Total Alerts  : {data.get('total_alerts', '?')}")  # ← shows growing count
        print()
        print("👉 Go to dashboard → click 🛑 BLOCK ATTACKER to stop it")
        print("   OR enable Auto-Respond in ML Engine tab")
    elif response is None:
        
        print()
        print("❌ Attack Failed: Could not connect to backend.")
        print("   → Make sure uvicorn is running on port 8000")
        print("   → Run: uvicorn main:app --reload --port 8000")
    else:
        print()
        print(f"❌ Attack Failed. Server responded: {response.status_code}")
        print(response.text)

if __name__ == "__main__":
    main()