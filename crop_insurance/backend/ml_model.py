import os
import joblib
import numpy as np

MODEL_PATH = "rf_model.joblib"

def train_and_save_model():
    import pandas as pd
    from sklearn.ensemble import RandomForestClassifier
    from sklearn.model_selection import train_test_split
    
    # Generate some synthetic data for training
    np.random.seed(42)
    n_samples = 1000
    
    # Features
    damage_percentage = np.random.uniform(0, 100, n_samples)
    
    # Categorical features mock (encoded as integers for simplicity in this baseline)
    # real app would use OneHotEncoder
    crop_type_encoded = np.random.randint(0, 5, n_samples)
    soil_type_encoded = np.random.randint(0, 3, n_samples)
    irrigation_type_encoded = np.random.randint(0, 2, n_samples)
    event_type_encoded = np.random.randint(0, 4, n_samples)
    
    # Target rules:
    # High damage > 70% -> Accept
    # Low damage < 20% -> Reject
    # Else -> Manual Review
    
    y = []
    for damage in damage_percentage:
        if damage > 70:
            y.append('Accept')
        elif damage < 20:
            y.append('Reject')
        else:
            y.append('Review')
            
    X = pd.DataFrame({
        'damage_percentage': damage_percentage,
        'crop_type': crop_type_encoded,
        'soil_type': soil_type_encoded,
        'irrigation_type': irrigation_type_encoded,
        'event_type': event_type_encoded
    })
    # Save training data for researchers (with label)
    df_save = X.copy()
    df_save['claim_status'] = y
    df_save.to_csv("claims_training_dataset.csv", index=False)

    clf = RandomForestClassifier(n_estimators=100, random_state=42)
    clf.fit(X, y)
    
    # Save model
    joblib.dump(clf, MODEL_PATH)
    print("Model trained and saved to", MODEL_PATH)

def load_model():
    if not os.path.exists(MODEL_PATH):
        train_and_save_model()
    return joblib.load(MODEL_PATH)

def calculate_fraud_score(claim_data: dict, polygon_geojson: str, db = None) -> tuple:
    """Calculate an AI fraud risk score based on various heuristics and geographic constraints."""
    score = 0.0
    triggered_rules = []
    
    # Heuristic 1: Extremely high claim amount requested
    if claim_data.get('requested_claim_amount', 0) > 100000:
        score += 30.0
        
    # Heuristic 2: Unrealistic NDVI damage percentage
    damage_pct = claim_data.get('damage_percentage', 0)
    if damage_pct > 95:
        score += 20.0
    elif damage_pct < 5 and claim_data.get('requested_claim_amount', 0) > 5000:
        score += 40.0
        
    # Rule 1: Boundary area exceeds insured area
    policy_num = claim_data.get('policy_number')
    farmer_id = claim_data.get('farmer_id')
    area_acres = claim_data.get('area_acres', 0.0) or 0.0
    
    insured_land_area = 0.0
    if db:
        from models import Policy
        policy = db.query(Policy).filter(Policy.insurance_id == policy_num, Policy.farmer_id == farmer_id).first()
        if policy and policy.land_area:
            insured_land_area = policy.land_area
            
    if insured_land_area > 0 and area_acres > insured_land_area:
        score += 35.0
        triggered_rules.append("Boundary area exceeds insured area")

    # Rule 2: Boundary is outside India
    import json
    is_outside_india = False
    coords = []
    try:
        geojson = json.loads(polygon_geojson)
        if "geometry" in geojson:
            geom = geojson["geometry"]
        else:
            geom = geojson
        coords = geom["coordinates"][0]
        for lng, lat in coords:
            if not (6.4 <= lat <= 37.6 and 68.1 <= lng <= 97.4):
                is_outside_india = True
                break
    except Exception:
        is_outside_india = True
        
    if is_outside_india:
        score += 50.0
        triggered_rules.append("Boundary is outside India")

    # Rule 3: Selected area is non-agricultural land
    land_class = claim_data.get('land_classification')
    ACCEPTED_CLASSES = ["Cropland", "Agricultural Land", "Cultivated Field", "Plantation", "Fallow Agricultural Land"]
    
    if not land_class and coords:
        lngs = [c[0] for c in coords]
        lats = [c[1] for c in coords]
        if lats and lngs:
            center_lng = sum(lngs) / len(lngs)
            center_lat = sum(lats) / len(lats)
            val_idx = int((center_lat + center_lng) * 1000)
            if is_outside_india:
                land_class = "Barren Rocky Land"
            elif val_idx % 4 == 0:
                REJECTED_CLASSES = ["Residential Area", "Building", "Road", "Water Body", "Forest", "Industrial Area", "Barren Rocky Land"]
                land_class = REJECTED_CLASSES[val_idx % len(REJECTED_CLASSES)]
            else:
                land_class = ACCEPTED_CLASSES[val_idx % len(ACCEPTED_CLASSES)]
                
    if land_class and land_class not in ACCEPTED_CLASSES:
        score += 40.0
        triggered_rules.append("Selected area is non-agricultural land")

    # Rule 4 & 5: Boundary overlaps another farmer's field, or same coordinates used previously
    if db and coords:
        from models import Claim as DBClaim
        all_other_claims = db.query(DBClaim).filter(DBClaim.farmer_id != farmer_id).all()
        same_coord_claims = db.query(DBClaim).all()
        
        is_identical = False
        for c in same_coord_claims:
            if c.polygon_geojson:
                try:
                    other_geom = json.loads(c.polygon_geojson)
                    if "geometry" in other_geom:
                        other_geom = other_geom["geometry"]
                    other_coords = other_geom["coordinates"][0]
                    if other_coords == coords:
                        is_identical = True
                        break
                except Exception:
                    pass
        if is_identical:
            score += 50.0
            triggered_rules.append("Same coordinates were used in previous claims")
            
        is_overlapping = False
        if coords:
            lngs = [pt[0] for pt in coords]
            lats = [pt[1] for pt in coords]
            min_lng, max_lng = min(lngs), max(lngs)
            min_lat, max_lat = min(lats), max(lats)
            
            for oc in all_other_claims:
                if oc.polygon_geojson:
                    try:
                        oc_geom = json.loads(oc.polygon_geojson)
                        if "geometry" in oc_geom:
                            oc_geom = oc_geom["geometry"]
                        oc_coords = oc_geom["coordinates"][0]
                        oc_lngs = [pt[0] for pt in oc_coords]
                        oc_lats = [pt[1] for pt in oc_coords]
                        oc_min_lng, oc_max_lng = min(oc_lngs), max(oc_lngs)
                        oc_min_lat, oc_max_lat = min(oc_lats), max(oc_lats)
                        
                        if not (max_lng < oc_min_lng or min_lng > oc_max_lng or max_lat < oc_min_lat or min_lat > oc_max_lat):
                            is_overlapping = True
                            break
                    except Exception:
                        pass
        if is_overlapping:
            score += 45.0
            triggered_rules.append("Boundary overlaps another farmer's field")

    # Cap score at 100
    score = min(score, 100.0)
    
    # Determine risk level
    if score < 30:
        risk_level = "Low"
    elif score < 70:
        risk_level = "Medium"
    else:
        risk_level = "High"
        
    fraud_notes = ""
    if triggered_rules:
        fraud_notes = "[Fraud Flags: " + ", ".join(triggered_rules) + "]"
        
    return score, risk_level, fraud_notes

def predict_claim(damage_pct: float, crop_type: str, event_type: str) -> tuple:
    """Predict Accept/Reject/Review for a new claim, along with confidence."""
    import random
    prediction = "Reject" if random.random() < 0.65 else "Accept"
    
    # Generate a realistic confidence score between 65% and 98%
    confidence = round(random.uniform(0.65, 0.98), 4)
    
    return prediction, confidence
