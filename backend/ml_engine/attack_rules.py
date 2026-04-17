from collections import defaultdict
import numpy as np

class AttackRules:
    def __init__(self):
        self.auth_attempts = defaultdict(list)
        self.connections = defaultdict(set)
        self.data_usage = defaultdict(list)
        self.beacon_times = defaultdict(list)

    # 1. BRUTE FORCE
    def brute_force(self, src, timestamp, status):
        if status != "fail":
            return False

        self.auth_attempts[src].append(timestamp)

        # last 60 sec
        self.auth_attempts[src] = [
            t for t in self.auth_attempts[src] if timestamp - t < 60
        ]

        return len(self.auth_attempts[src]) > 10

    # 2. LATERAL MOVEMENT
    def lateral(self, src, dst):
        if not dst.startswith("192.168") and not dst.startswith("10."):
            return False

        self.connections[src].add(dst)
        return len(self.connections[src]) > 5

    # 3. DATA EXFILTRATION
    def exfiltration(self, src, bytes_sent, direction):
        if direction != "outbound":
            return False

        self.data_usage[src].append(bytes_sent)

        recent = self.data_usage[src][-10:]

        if sum(recent) > 3_000_000 and max(recent) > 500000:
            return True

        return False

    # 4. C2 BEACONING
    def c2(self, src, dst, timestamp):
        key = f"{src}->{dst}"
        self.beacon_times[key].append(timestamp)

        times = self.beacon_times[key]

        if len(times) < 6:
            return False

        intervals = np.diff(times[-6:])

        # stricter periodic detection
        if np.std(intervals) < 1.0 and np.mean(intervals) < 20:
            return True

        return False

    # MAIN
    def classify(self, event):
        src = event["src"]
        dst = event["dst"]
        t = event["time"]

        if self.brute_force(src, t, event.get("status", "")):
            return "Brute Force"
        if self.lateral(src, dst):
            return "Lateral Movement"
        if self.exfiltration(src, event.get("bytes", 0), event.get("direction", "")):
            return "Data Exfiltration"
        if self.c2(src, dst, t):
            return "C2 Beaconing"

        return None