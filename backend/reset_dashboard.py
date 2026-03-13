# reset_dashboard.py
import requests
import time

print("🔄 Initiating System Reset Protocol...")
time.sleep(1)
print("🧹 Clearing threat logs and resetting AI baseline...")

try:
    response = requests.post("http://127.0.0.1:8000/api/v1/reset")
    
    if response.status_code == 200:
        print("\n✅ SUCCESS: Dashboard is now GREEN and SECURE!")
    else:
        print(f"\n❌ Failed to reset. Server returned: {response.status_code}")
except requests.exceptions.ConnectionError:
    print("\n❌ Failed: Could not connect to the backend. Is uvicorn running?")