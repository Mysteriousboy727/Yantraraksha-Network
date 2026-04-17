# threat_classifier.py

from collections import defaultdict
import numpy as np

class ThreatClassifier:
    def __init__(self):
        self.auth_failures = defaultdict(list)
        self.connections = defaultdict(set)
        self.data_volume = defaultdict(list)
        self.beacon_times = defaultdict(list)

    # ───────── BRUTE FORCE ─────────
    def brute_force(self, event):
        if event.get("type") != "auth":
            return False

        if event.get("status") != "fail":
            return False

        src = event["src"]
        t = event["time"]

        self.auth_failures[src].append(t)

        # last 60 sec window
        self.auth_failures[src] = [
            x for x in self.auth_failures[src] if t - x < 60
        ]

        return len(self.auth_failures[src]) > 8

    # ───────── LATERAL MOVEMENT ─────────
    def lateral(self, event):
        src = event["src"]
        dst = event["dst"]

        # only internal traffic
        if not dst.startswith("10.") and not dst.startswith("192.168"):
            return False

        self.connections[src].add(dst)

        return len(self.connections[src]) > 4

    # ───────── DATA EXFILTRATION ─────────
    def exfiltration(self, event):
        if event.get("direction") != "outbound":
            return False

        src = event["src"]
        size = event.get("bytes", 0)

        self.data_volume[src].append(size)

        # recent 10 packets
        recent = self.data_volume[src][-10:]

        if sum(recent) > 3_000_000:  # 3MB burst
            return True

        return False

    # ───────── C2 BEACONING ─────────
    def c2(self, event):
        src = event["src"]
        dst = event["dst"]
        t = event["time"]

        key = f"{src}->{dst}"

        self.beacon_times[key].append(t)

        times = self.beacon_times[key]

        if len(times) < 5:
            return False

        intervals = np.diff(times[-5:])

        # low variance = periodic
        return np.std(intervals) < 1.5

    # ───────── MAIN CLASSIFIER ─────────
    def classify(self, event):
        if self.brute_force(event):
            return "Brute Force"

        if self.lateral(event):
            return "Lateral Movement"

        if self.exfiltration(event):
            return "Data Exfiltration"

        if self.c2(event):
            return "C2 Beaconing"

        return None