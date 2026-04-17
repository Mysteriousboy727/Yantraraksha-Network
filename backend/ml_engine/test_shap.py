import joblib
import pandas as pd
import shap
import numpy as np

print("🔍 Loading models...")

rf_model = joblib.load('models/random_forest_binary.pkl')
scaler = joblib.load('models/network_scaler.pkl')
selector = joblib.load('models/feature_selector.pkl')
feature_cols = joblib.load('models/feature_cols.pkl')
protocol_encoder = joblib.load('models/protocol_encoder.pkl')

print("✅ Models loaded")

# Load sample data
df = pd.read_csv('dataset/extracted/Dataset.csv')

# Take 1 sample
sample = df.iloc[0:1]

# Encode protocol (same as training)
sample['protocol'] = protocol_encoder.transform(sample['protocol'].astype(str))

# Preprocess
X = sample[feature_cols].fillna(0).replace([np.inf, -np.inf], 0)

X_scaled = scaler.transform(X)
X_selected = selector.transform(X_scaled)

print("✅ Data processed")

# SHAP
print("⚡ Running SHAP...")

explainer = shap.TreeExplainer(rf_model)

shap_values = explainer.shap_values(X_selected)

print("✅ SHAP computed")

# Get feature names
mask = selector.get_support()
selected_features = [feature_cols[i] for i in range(len(feature_cols)) if mask[i]]

# Pair feature + importance
values = shap_values[1][0]

explanation = sorted(
    zip(selected_features, values),
    key=lambda x: abs(x[1]),
    reverse=True
)

print("\n🔥 TOP FEATURES (WHY THIS IS ATTACK):")

for feat, val in explanation[:5]:
    print(f"{feat} → {round(val, 4)}")

print("\n✅ SHAP WORKING CORRECTLY")