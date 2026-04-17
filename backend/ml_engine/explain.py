import joblib
import shap
import numpy as np
import pandas as pd

rf_model = None
scaler = None
selector = None
feature_cols = None
explainer = None
selected_features = []

def init_explainer():
    global rf_model, scaler, selector, feature_cols, explainer, selected_features
    if explainer is not None:
        return
        
    try:
        rf_model = joblib.load('models/random_forest_binary.pkl')
        scaler = joblib.load('models/network_scaler.pkl')
        selector = joblib.load('models/feature_selector.pkl')
        feature_cols = joblib.load('models/feature_cols.pkl')
        
        explainer = shap.TreeExplainer(rf_model)
        
        mask = selector.get_support()
        selected_features = [feature_cols[i] for i in range(len(feature_cols)) if mask[i]]
    except Exception as e:
        print(f"Error loading SHAP explainer: {e}")

def explain_prediction(flow_dict):
    init_explainer()
    if not explainer:
        return []
        
    row = {col: flow_dict.get(col, 0) for col in feature_cols}
    X = pd.DataFrame([row]).fillna(0).replace([np.inf, -np.inf], 0)
    X_scaled = scaler.transform(X)
    X_selected = selector.transform(X_scaled)
    
    shap_values = explainer.shap_values(X_selected)
    
    values = shap_values[1][0] if isinstance(shap_values, list) else shap_values[0]
    
    explanation = sorted(zip(selected_features, values), key=lambda x: abs(x[1]), reverse=True)
    return explanation[:5]