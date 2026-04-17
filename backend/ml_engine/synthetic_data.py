# synthetic_data.py

import pandas as pd
import random
import time

def generate_ip():
    return f"192.168.1.{random.randint(1, 255)}"

def generate_external_ip():
    return f"45.33.{random.randint(1,255)}.{random.randint(1,255)}"

def generate_data(n=2000):
    data = []

    current_time = int(time.time())

    for i in range(n):

        attack_type = random.choice([
            "Normal",
            "Brute Force",
            "Lateral Movement",
            "Data Exfiltration",
            "C2 Beaconing"
        ])

        src = generate_ip()
        dst = generate_ip()
        bytes_sent = random.randint(100, 2000)
        direction = "internal"

        # ───── NORMAL ─────
        if attack_type == "Normal":
            pass

        # ───── BRUTE FORCE ─────
        elif attack_type == "Brute Force":
            for j in range(15):
                data.append({
                    "src": src,
                    "dst": dst,
                    "bytes": 100,
                    "time": current_time + j,
                    "status": "fail",
                    "direction": "internal",
                    "label": "Brute Force"
                })
            continue

        # ───── LATERAL MOVEMENT ─────
        elif attack_type == "Lateral Movement":
            for j in range(6):
                data.append({
                    "src": src,
                    "dst": generate_ip(),
                    "bytes": random.randint(500, 2000),
                    "time": current_time + j,
                    "status": "success",
                    "direction": "internal",
                    "label": "Lateral Movement"
                })
            continue

        # ───── DATA EXFILTRATION ─────
        elif attack_type == "Data Exfiltration":
            dst = generate_external_ip()
            direction = "outbound"
            bytes_sent = random.randint(500000, 2000000)

        # ───── C2 BEACONING ─────
        elif attack_type == "C2 Beaconing":
            dst = generate_external_ip()
            for j in range(6):
                data.append({
                    "src": src,
                    "dst": dst,
                    "bytes": random.randint(50, 200),
                    "time": current_time + j * 10,  # periodic
                    "status": "success",
                    "direction": "outbound",
                    "label": "C2 Beaconing"
                })
            continue

        # default single row
        data.append({
            "src": src,
            "dst": dst,
            "bytes": bytes_sent,
            "time": current_time,
            "status": "success",
            "direction": direction,
            "label": attack_type
        })

    df = pd.DataFrame(data)
    return df


if __name__ == "__main__":
    df = generate_data(2000)

    df.to_csv("dataset/extracted/synthetic_attacks.csv", index=False)

    print("✅ Synthetic dataset generated!")
    print(df['label'].value_counts())