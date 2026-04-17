import pandas as pd
import numpy as np
import joblib
import json
import time
from datetime import datetime
import warnings
warnings.filterwarnings('ignore')
from attack_rules import AttackRules
import ipaddress
from explain import explain_prediction

rules = AttackRules()


def _is_private_ip(ip):
    try:
        return ipaddress.ip_address(str(ip)).is_private
    except ValueError:
        return False


def _event_direction(src, dst):
    if _is_private_ip(src) and not _is_private_ip(dst):
        return "outbound"
    if _is_private_ip(src) and _is_private_ip(dst):
        return "internal"
    return "external"

# ── Load all trained models ───────────────────────────────────
print("Loading models...")
iso_forest    = joblib.load('models/isolation_forest.pkl')
rf_binary     = joblib.load('models/random_forest_binary.pkl')
rf_multi      = joblib.load('models/random_forest_multiclass.pkl')
plc_iso       = joblib.load('models/plc_isolation_forest.pkl')
scaler        = joblib.load('models/network_scaler.pkl')
plc_scaler    = joblib.load('models/plc_scaler.pkl')
label_enc     = joblib.load('models/label_encoder.pkl')
proto_enc     = joblib.load('models/protocol_encoder.pkl')
selector      = joblib.load('models/feature_selector.pkl')
feature_cols  = joblib.load('models/feature_cols.pkl')
plc_feat_cols = joblib.load('models/plc_feature_cols.pkl')
print("All models loaded.\n")

SEVERITY = {
    'Normal'   : 'INFO',
    'ip-scan'  : 'LOW',
    'port-scan': 'MEDIUM',
    'replay'   : 'HIGH',
    'mitm'     : 'HIGH',
    'ddos'     : 'CRITICAL',
    'Brute Force': 'HIGH',
    'Lateral Movement': 'HIGH',
    'Data Exfiltration': 'CRITICAL',
    'C2 Beaconing': 'HIGH',
}

MITRE_MAP = {
    'ip-scan'  : 'T0846 — Remote System Discovery',
    'port-scan': 'T0846 — Network Service Scanning',
    'replay'   : 'T0843 — Program Download / Replay',
    'mitm'     : 'T0830 — Man in the Middle',
    'ddos'     : 'T0814 — Denial of Service',
    'Normal'   : 'None'
}

RISK_MAP = {
    'ip-scan'  : 'Attacker mapping ICS device locations',
    'port-scan': 'Attacker scanning for open Modbus/DNP3 ports',
    'replay'   : 'Recorded commands being replayed — PLC state may change',
    'mitm'     : 'Commands may be intercepted and modified in transit',
    'ddos'     : 'Network flooding — PLCs may become unreachable',
    'Normal'   : 'No risk'
}

def detect_network_flow(flow_dict):
    """
    Analyze a single network flow and return detection result.
    flow_dict should have the same keys as Dataset.csv feature columns.
    """
    try:
        # Build feature vector
        row = {}
        for col in feature_cols:
            row[col] = flow_dict.get(col, 0)

        X = pd.DataFrame([row])
        X = X.fillna(0).replace([np.inf, -np.inf], 0)
        X_scaled = scaler.transform(X)
        X_selected = selector.transform(X_scaled)

        # Get Scores
        iso_scores = iso_forest.decision_function(X_scaled)
        rf_probs = rf_binary.predict_proba(X_selected)

        # WEIGHTED ENSEMBLE LOGIC
        final_pred = []
        confidence_scores = []

        for i in range(len(rf_probs)):
            rf_score = rf_probs[i][1]   # attack probability
            iso_score = -iso_scores[i]  # anomaly → higher = more suspicious

            # normalize iso score (handles both batch and single item processing)
            min_iso, max_iso = min(-iso_scores), max(-iso_scores)
            if min_iso == max_iso:
                iso_score_norm = 1.0 if iso_score > 0 else 0.0
            else:
                iso_score_norm = (iso_score - min_iso) / (max_iso - min_iso + 1e-6)

            # weighted fusion
            combined_score = 0.7 * rf_score + 0.3 * iso_score_norm

            if combined_score > 0.6:
                final_pred.append(1)
            else:
                final_pred.append(0)

            confidence_scores.append(combined_score * 100)

        # MULTI-CLASS ONLY IF ATTACK
        attack_type_list = []
        for i in range(len(final_pred)):
            if final_pred[i] == 1:
                pred = rf_multi.predict([X_selected[i]])[0]
                attack_type_list.append(label_enc.inverse_transform([pred])[0])
            else:
                attack_type_list.append("Normal")

        is_anomaly = (iso_scores[0] < 0)
        is_attack = (final_pred[0] == 1)
        confidence = confidence_scores[0]
        ml_attack_type = attack_type_list[0]

        event = {
            'src': flow_dict.get('src', '0.0.0.0'),
            'dst': flow_dict.get('dst', '0.0.0.0'),
            'bytes': flow_dict.get('sBytesSum', flow_dict.get('sPayloadSum', 0)),
            'time': flow_dict.get('time', time.time()),
            'direction': _event_direction(flow_dict.get('src', '0.0.0.0'), flow_dict.get('dst', '0.0.0.0')),
            'type': flow_dict.get('type', 'network'),
            'status': flow_dict.get('status', 'observed'),
        }
        
        rule_attack = rules.classify(event)
        if rule_attack:
            ml_attack_type = rule_attack
            is_attack = True
            
        final_attack_type = ml_attack_type

        explanation = explain_prediction(flow_dict)
        explanation_formatted = [
            f"{feat}: {round(val, 2)}" for feat, val in explanation
        ]

        result = {
            'timestamp'    : datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
            'is_attack'    : bool(is_attack),
            'is_anomaly'   : bool(is_anomaly),
            'attack_type'  : final_attack_type,
            'severity'     : SEVERITY.get(final_attack_type, 'LOW'),
            'confidence'   : round(confidence, 2),
            'anomaly_score': round(float(-iso_scores[0]), 4),
            'mitre'        : MITRE_MAP.get(final_attack_type, 'None'),
            'risk'         : RISK_MAP.get(final_attack_type, 'No risk'),
            'ml_attack_type': ml_attack_type,
            'event': event,
            'explanation'  : explanation_formatted,
        }
        return result

    except Exception as e:
        return {'error': str(e)}


def detect_plc_reading(plc_dict):
    """
    Analyze a PLC sensor reading for physical process anomalies.
    plc_dict keys: current_loop, loop_latency, tank_level_value, etc.
    """
    try:
        row = {}
        for col in plc_feat_cols:
            row[col] = plc_dict.get(col, 0)

        X = pd.DataFrame([row])
        X = X.fillna(0).replace([np.inf, -np.inf], 0)
        X_scaled = plc_scaler.transform(X)

        pred  = plc_iso.predict(X_scaled)[0]
        score = plc_iso.decision_function(X_scaled)[0]

        is_anomaly = (pred == -1)

        # Physical risk rules based on tank data
        tank_level    = plc_dict.get('tank_level_value(2)', 0)
        tank_min      = plc_dict.get('tank_level_min(3)', 0)
        tank_max      = plc_dict.get('tank_level_max(4)', 100)
        valve_status  = plc_dict.get('tank_input_valve_status(0)', 0)

        physical_risk = 'Normal operation'
        if tank_level > tank_max * 0.95:
            physical_risk = '⚠ CRITICAL: Tank near overflow'
        elif tank_level < tank_min * 1.05:
            physical_risk = '⚠ WARNING: Tank level critically low'
        elif is_anomaly:
            physical_risk = '⚠ Abnormal PLC sensor reading detected'

        return {
            'timestamp'    : datetime.now().strftime('%Y-%m-%d %H:%M:%S'),
            'is_anomaly'   : bool(is_anomaly),
            'anomaly_score': round(float(score), 4),
            'tank_level'   : tank_level,
            'valve_status' : int(valve_status),
            'physical_risk': physical_risk,
            'severity'     : 'CRITICAL' if is_anomaly else 'NORMAL'
        }

    except Exception as e:
        return {'error': str(e)}


def run_demo():
    """
    Run detection demo using real rows from the dataset.
    This simulates what real-time detection looks like.
    """
    print("=" * 60)
    print("  SURAKSHA ICS-IDS — LIVE DETECTION DEMO")
    print("=" * 60)

    # Load a sample of real data for demo
    print("\nLoading sample data for demo...")
    df = pd.read_csv('dataset/extracted/Dataset.csv')

    # Encode protocol
    df['protocol'] = proto_enc.transform(df['protocol'].astype(str))

    # Pick 5 normal + 5 attack samples
    normal_samples = df[df['IT_B_Label'] == 0].sample(5, random_state=1)
    attack_samples = df[df['IT_B_Label'] == 1].sample(5, random_state=1)
    samples = pd.concat([normal_samples, attack_samples]).sample(frac=1, random_state=42)

    print(f"\nRunning detection on 10 sample flows...\n")
    print("-" * 60)

    correct = 0
    total   = len(samples)

    for idx, row in samples.iterrows():
        true_label  = 'Normal' if row['IT_B_Label'] == 0 else row['IT_M_Label']
        flow        = row[feature_cols].to_dict()
        result      = detect_network_flow(flow)

        predicted   = result.get('attack_type', 'Unknown')
        is_correct  = (result['is_attack'] == (row['IT_B_Label'] == 1))
        if is_correct:
            correct += 1

        status_icon = '✓' if is_correct else '✗'
        sev_color   = {
            'INFO'    : '',
            'LOW'     : '',
            'MEDIUM'  : '',
            'HIGH'    : '',
            'CRITICAL': ''
        }.get(result['severity'], '')

        print(f"  [{status_icon}] True: {true_label:<12} "
              f"Predicted: {predicted:<12} "
              f"Severity: {result['severity']:<8} "
              f"Confidence: {result['confidence']:.1f}%")

        if result['is_attack']:
            print(f"      MITRE: {result['mitre']}")
            print(f"      Risk : {result['risk']}")
        print()

        time.sleep(0.3)  # simulate real-time feed

    print("-" * 60)
    print(f"\n  Demo accuracy: {correct}/{total} ({correct/total*100:.1f}%)")

    # PLC Demo
    print("\n" + "=" * 60)
    print("  PLC PHYSICAL PROCESS DEMO")
    print("=" * 60)

    plc_df = pd.read_csv('dataset/extracted/snapshots_PLC1.csv')
    plc_df.columns = plc_df.columns.str.strip()
    plc_df = plc_df[plc_feat_cols].fillna(0)

    print("\nChecking 5 PLC sensor readings...\n")
    for i in range(5):
        reading = plc_df.iloc[i].to_dict()
        result  = detect_plc_reading(reading)

        print(f"  Reading #{i+1}")
        print(f"  Tank Level : {result['tank_level']}")
        print(f"  Anomaly    : {'YES ⚠' if result['is_anomaly'] else 'No'}")
        print(f"  Risk       : {result['physical_risk']}")
        print(f"  Score      : {result['anomaly_score']}")
        print()

    print("=" * 60)
    print("  Detection engine ready for live packet integration")
    print("=" * 60)


if __name__ == "__main__":
    run_demo()
