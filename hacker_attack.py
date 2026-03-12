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

# Ye humare backend ke naye raste (endpoint) par attack bhej raha hai
response = requests.post("http://127.0.0.1:8000/api/v1/trigger-attack")

if response.status_code == 200:
    print("\n🚨 BOOM! ATTACK SUCCESSFUL! Check the Dashboard!")
else:
    print("Attack Failed.")