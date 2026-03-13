# # hacker_attack.py
# import requests
# import time

# print("💀 INITIATING ATTACK ON OT NETWORK...")
# time.sleep(1)
# print("🔍 Scanning for vulnerable PLCs...")
# time.sleep(1)
# print("⚡ Found Target: 10.0.0.12 (Main Conveyor PLC)")
# time.sleep(1)
# print("💉 Injecting Malicious Modbus FC-05 Command...")

# # Ye humare backend ke naye raste (endpoint) par attack bhej raha hai
# response = requests.post("http://127.0.0.1:8000/api/v1/trigger-attack")

# if response.status_code == 200:
#     print("\n🚨 BOOM! ATTACK SUCCESSFUL! Check the Dashboard!")
# else:
#     print("Attack Failed.")

# hacker_attack.py
import requests
import time

print("💀 INITIATING ATTACK ON OT NETWORK...")
time.sleep(1)
print("🔍 Scanning for vulnerable PLCs...")
time.sleep(1)
print("⚡ Found Target: 10.0.0.12 (Main Conveyor PLC)")
time.sleep(1)
print("💉 Injecting Malicious Modbus FC-05 Command...")

# The payload FastAPI is now expecting
payload = {
    "attacker_ip": "45.X.X.X",
    "target_device": "10.0.0.12 (PLC-01)",
    "attack_type": "Modbus Write Injection"
}

try:
    # We use json=payload to send it correctly
    response = requests.post("http://127.0.0.1:8000/api/v1/trigger-attack", json=payload)

    if response.status_code == 200:
        print("\n🚨 BOOM! ATTACK SUCCESSFUL! Check the Dashboard!")
    else:
        print(f"\n❌ Attack Failed. Server responded with: {response.status_code}")
        print(response.text)
except requests.exceptions.ConnectionError:
    print("\n❌ Attack Failed: Could not connect to the backend. Is uvicorn running?")