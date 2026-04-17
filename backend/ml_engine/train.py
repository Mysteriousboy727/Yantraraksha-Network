# make sure dependencies are available; show helpful message if not
try:
    import pandas as pd
    import numpy as np
    from sklearn.ensemble import IsolationForest, RandomForestClassifier
    from sklearn.preprocessing import LabelEncoder, StandardScaler
    from sklearn.model_selection import train_test_split
    from sklearn.metrics import classification_report, accuracy_score, confusion_matrix
    import joblib

except ImportError as e:
    missing = str(e).split()[-1].strip("'\"")
    print(f"ERROR: could not import {missing}.\n" \
          "Please install the required packages:\n" \
          "    python -m pip install -r requirements.txt\n" \
          "and make sure the correct Python interpreter/venv is selected in VS Code.")
    raise

import os
import warnings
warnings.filterwarnings('ignore')

print("=" * 60)
print("  SURAKSHA ICS-IDS — MODEL TRAINING")
print("=" * 60)

# ── Create models folder ──────────────────────────────────────
os.makedirs("models", exist_ok=True)
# note: this script assumes dataset files live under dataset/extracted
def check_datasets():
    required = [
        "dataset/extracted/Dataset.csv",
        "dataset/extracted/snapshots_PLC1.csv",
        "dataset/extracted/snapshots_PLC2.csv",
    ]
    for path in required:
        if not os.path.exists(path):
            raise FileNotFoundError(f"Required input file not found: {path}")

check_datasets()

# ════════════════════════════════════════════════════════════════
# PART 1 — NETWORK TRAFFIC MODEL (Dataset.csv)
# ════════════════════════════════════════════════════════════════
print("\n[1/4] Loading network traffic dataset...")
df_real = pd.read_csv("dataset/extracted/Dataset.csv")

try:
    df_syn = pd.read_csv("dataset/extracted/synthetic_attacks.csv")
    # Map synthetic columns to match existing Dataset.csv ML columns
    df_syn = df_syn.rename(columns={'label': 'IT_M_Label', 'bytes': 'sBytesSum'})
    df_syn['IT_B_Label'] = df_syn['IT_M_Label'].apply(lambda x: 0 if x == 'Normal' else 1)
    df_syn['protocol'] = 'TCP'  # Provide placeholder for protocol
    
    df = pd.concat([df_real, df_syn], ignore_index=True)
    print("      Merged Real + Synthetic datasets.")
except FileNotFoundError:
    df = df_real

print(f"      Rows: {len(df):,}  |  Columns: {len(df.columns)}")

# Check attack distribution
print("\n[2/4] Attack distribution:")
print(df['IT_M_Label'].value_counts())

# ── Label Balancing ───────────────────────────────────────────
from sklearn.utils import resample

df_attack = df[df['IT_B_Label'] == 1]
df_normal = df[df['IT_B_Label'] == 0]

if len(df_normal) > len(df_attack):
    df_normal_down = resample(df_normal,
                             replace=False,
                             n_samples=len(df_attack),
                             random_state=42)
    df = pd.concat([df_attack, df_normal_down])
else:
    df = pd.concat([df_attack, df_normal])

# ── Feature Engineering (Behavioral & Time-based) ─────────────
if 'src' not in df.columns: df['src'] = df.get('sAddress', '0.0.0.0')
if 'dst' not in df.columns: df['dst'] = df.get('rAddress', '0.0.0.0')
if 'time' not in df.columns: df['time'] = df.get('start', 0)
if 'bytes' not in df.columns: df['bytes'] = df.get('sBytesSum', 0)

# Behavioral features
df['conn_count'] = df.groupby('src')['dst'].transform('count')
df['unique_dst'] = df.groupby('src')['dst'].transform('nunique')
df['total_bytes'] = df.groupby('src')['bytes'].transform('sum')
df['avg_bytes'] = df.groupby('src')['bytes'].transform('mean')

# Time-based feature
df = df.sort_values(['src', 'time'])
df['time_diff'] = df.groupby('src')['time'].diff().fillna(0)

# ── Drop non-numeric / identifier columns ────────────────────
drop_cols = ['sAddress', 'rAddress', 'sMACs', 'rMACs',
             'sIPs', 'rIPs', 'startDate', 'endDate',
             'start', 'end', 'startOffset', 'endOffset',
             'IT_B_Label', 'IT_M_Label', 'NST_B_Label', 'NST_M_Label',
             'src', 'dst', 'time', 'status', 'direction', 'bytes']  # Ignore string attributes

# ── Encode protocol column ────────────────────────────────────
le_protocol = LabelEncoder()
df['protocol'] = le_protocol.fit_transform(df['protocol'].astype(str))
joblib.dump(le_protocol, 'models/protocol_encoder.pkl')

# ── Features and labels ───────────────────────────────────────
feature_cols = [c for c in df.columns if c not in drop_cols]

# Ensure new features are explicitly included
for f in ['conn_count', 'unique_dst', 'total_bytes', 'avg_bytes', 'time_diff']:
    if f not in feature_cols: feature_cols.append(f)

X = df[feature_cols].copy()
y_binary = df['IT_B_Label']          # 0 = normal, 1 = attack
y_multi  = df['IT_M_Label']          # Normal / specific attack type

# ── Handle missing values ─────────────────────────────────────
X = X.fillna(0)
X = X.replace([np.inf, -np.inf], 0)

# ── Scale features ────────────────────────────────────────────
print("\n[3/4] Scaling features...")
scaler = StandardScaler()
X_scaled = scaler.fit_transform(X)
joblib.dump(scaler, 'models/network_scaler.pkl')
joblib.dump(feature_cols, 'models/feature_cols.pkl')

# ── Train/test split ──────────────────────────────────────────
X_train, X_test, y_train, y_test = train_test_split(
    X_scaled, y_binary, test_size=0.2, random_state=42, stratify=y_binary
)

# ────────────────────────────────────────────────────────────────
# MODEL 1 — Isolation Forest (Unsupervised anomaly detection)
# Best for: detecting unknown/zero-day attacks
# ────────────────────────────────────────────────────────────────
print("\n[4/4] Training models...")
print("\n  ▶ Model 1: Isolation Forest (anomaly detection)...")

attack_ratio = y_binary.mean()
iso_forest = IsolationForest(
    n_estimators=200,
    contamination=0.15,   # adjust anomaly sensitivity
    random_state=42,
    n_jobs=-1
)
iso_forest.fit(X_scaled)
joblib.dump(iso_forest, 'models/isolation_forest.pkl')

# Evaluate Isolation Forest
iso_preds_raw = iso_forest.predict(X_test)
iso_preds = [1 if p == -1 else 0 for p in iso_preds_raw]
iso_acc = accuracy_score(y_test, iso_preds)
print(f"     Accuracy : {iso_acc * 100:.2f}%")
print(f"     Anomalies detected: {sum(iso_preds)} / {len(iso_preds)}")

# ────────────────────────────────────────────────────────────────
# MODEL 2 — Random Forest (Supervised binary classification)
# Best for: detecting known attack types with high accuracy
# ────────────────────────────────────────────────────────────────
print("\n  ▶ Model 2: Random Forest (binary — normal vs attack)...")
rf_binary = RandomForestClassifier(
    n_estimators=200,        # more trees → better accuracy
    max_depth=20,            # prevent overfitting
    min_samples_split=5,
    min_samples_leaf=2,
    class_weight='balanced', # VERY IMPORTANT
    random_state=42,
    n_jobs=-1
)
rf_binary.fit(X_scaled, y_binary)

# ── Feature Selection ─────────────────────────────────────────
from sklearn.feature_selection import SelectFromModel

selector = SelectFromModel(rf_binary, threshold="median")
selector.fit(X_scaled, y_binary)
X_selected = selector.transform(X_scaled)

print(f"     Selected features: {X_selected.shape[1]} out of {X_scaled.shape[1]}")
joblib.dump(selector, 'models/feature_selector.pkl')

# ── Retrain on Selected Features ──────────────────────────────
# FIX: Re-initialize rf_binary so we don't accidentally mutate the 
# pre-fitted model inside the selector, which causes dimension IndexErrors.
rf_binary = RandomForestClassifier(
    n_estimators=200,
    max_depth=20,
    min_samples_split=5,
    min_samples_leaf=2,
    class_weight='balanced',
    random_state=42,
    n_jobs=-1
)
rf_binary.fit(X_selected, y_binary)
joblib.dump(rf_binary, 'models/random_forest_binary.pkl')

X_test_selected = selector.transform(X_test)
rf_preds = rf_binary.predict(X_test_selected)
rf_acc = accuracy_score(y_test, rf_preds)
print(f"     Accuracy : {rf_acc * 100:.2f}%")
print("\n     Classification Report:")
print(classification_report(y_test, rf_preds, target_names=["Normal", "Attack"]))

# ────────────────────────────────────────────────────────────────
# MODEL 3 — Random Forest Multi-class (attack type classifier)
# Best for: identifying WHAT type of attack is happening
# ────────────────────────────────────────────────────────────────
print("\n  ▶ Model 3: Random Forest (multi-class — attack type)...")

le_label = LabelEncoder()
y_multi_encoded = le_label.fit_transform(y_multi)
joblib.dump(le_label, 'models/label_encoder.pkl')

X_train_m, X_test_m, y_train_m, y_test_m = train_test_split(
    X_scaled, y_multi_encoded, test_size=0.2, random_state=42
)

rf_multi = RandomForestClassifier(
    n_estimators=250,
    max_depth=25,
    min_samples_split=5,
    min_samples_leaf=2,
    class_weight='balanced',
    random_state=42,
    n_jobs=-1
)
rf_multi.fit(X_selected, y_multi_encoded)
joblib.dump(rf_multi, 'models/random_forest_multiclass.pkl')

X_test_m_selected = selector.transform(X_test_m)
rf_multi_preds = rf_multi.predict(X_test_m_selected)
rf_multi_acc = accuracy_score(y_test_m, rf_multi_preds)
print(f"     Accuracy : {rf_multi_acc * 100:.2f}%")
print(f"     Attack classes: {list(le_label.classes_)}")

# ── Feature importance (useful for dashboard) ─────────────────
print("\n  ▶ Top 10 most important features:")
importances = rf_binary.feature_importances_

selected_features = selector.get_support()
selected_feature_names = [
    feature_cols[i] for i in range(len(feature_cols)) if selected_features[i]
]
print("\nSelected Features:")
print(selected_feature_names)

feat_importance = pd.Series(importances, index=selected_feature_names)
top10 = feat_importance.nlargest(10)
for feat, score in top10.items():
    print(f"     {feat:<30} {score:.4f}")

# ════════════════════════════════════════════════════════════════
# PART 2 — PLC SENSOR MODEL (snapshots_PLC1.csv)
# ════════════════════════════════════════════════════════════════
print("\n" + "=" * 60)
print("  PART 2 — PLC PHYSICAL PROCESS ANOMALY DETECTION")
print("=" * 60)

print("\n[1/3] Loading PLC snapshot data...")
plc1 = pd.read_csv("dataset/extracted/snapshots_PLC1.csv")
plc2 = pd.read_csv("dataset/extracted/snapshots_PLC2.csv")

# Clean column names (they have leading spaces)
plc1.columns = plc1.columns.str.strip()
plc2.columns = plc2.columns.str.strip()

print(f"      PLC1 rows: {len(plc1):,}")
print(f"      PLC2 rows: {len(plc2):,}")
print(f"      PLC1 columns: {plc1.columns.tolist()}")

# ── PLC feature engineering ───────────────────────────────────
print("\n[2/3] Engineering PLC features...")

# Drop time and non-numeric columns
plc1_features = plc1.drop(columns=['time'], errors='ignore')
plc1_features = plc1_features.select_dtypes(include=[np.number])
plc1_features = plc1_features.fillna(0)
plc1_features = plc1_features.replace([np.inf, -np.inf], 0)

# Remove empty trailing columns
plc1_features = plc1_features.loc[:, (plc1_features != 0).any(axis=0)]

print(f"      PLC features used: {plc1_features.columns.tolist()}")

# ── Scale PLC features ────────────────────────────────────────
plc_scaler = StandardScaler()
plc1_scaled = plc_scaler.fit_transform(plc1_features)
joblib.dump(plc_scaler, 'models/plc_scaler.pkl')
joblib.dump(list(plc1_features.columns), 'models/plc_feature_cols.pkl')

# ────────────────────────────────────────────────────────────────
# MODEL 4 — Isolation Forest on PLC sensor data
# Best for: detecting physical process manipulation
# (e.g. tank overflow, valve forced open, abnormal flow)
# ────────────────────────────────────────────────────────────────
print("\n[3/3] Training PLC anomaly detector (Isolation Forest)...")
plc_iso = IsolationForest(
    n_estimators=100,
    contamination=0.05,   # assume 5% of PLC readings are anomalous
    random_state=42,
    n_jobs=-1
)
plc_iso.fit(plc1_scaled)
joblib.dump(plc_iso, 'models/plc_isolation_forest.pkl')

# Test on sample
sample_preds = plc_iso.predict(plc1_scaled[:500])
anomaly_count = sum(1 for p in sample_preds if p == -1)
print(f"     Anomalies in first 500 PLC readings: {anomaly_count}")
print("     PLC model saved.")

# ════════════════════════════════════════════════════════════════
# FINAL SUMMARY
# ════════════════════════════════════════════════════════════════
print("\n" + "=" * 60)
print("  TRAINING COMPLETE — MODELS SAVED")
print("=" * 60)
print(f"""
  Models saved to /models/:
  
  ┌─────────────────────────────────────────────────────┐
  │  isolation_forest.pkl      → network anomaly        │
  │  random_forest_binary.pkl  → normal vs attack       │
  │  random_forest_multiclass.pkl  → attack type classifier │
  │  plc_isolation_forest.pkl  → PLC process anomaly    │
  │  network_scaler.pkl        → feature scaler         │
  │  plc_scaler.pkl            → PLC scaler             │
  │  label_encoder.pkl         → attack label decoder   │
  │  protocol_encoder.pkl      → protocol encoder       │
  │  feature_cols.pkl          → feature list           │
  └─────────────────────────────────────────────────────┘

  Accuracy Summary:
  Isolation Forest (network) : {iso_acc * 100:.2f}%
  Random Forest (binary)     : {rf_acc * 100:.2f}%
  Random Forest (multi-class): {rf_multi_acc * 100:.2f}%
""")