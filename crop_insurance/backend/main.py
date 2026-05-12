from fastapi import FastAPI, Depends, HTTPException, Query, Request
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session
from sqlalchemy import func
from typing import List, Dict, Any
import uuid
from starlette.responses import StreamingResponse
import io
import os

from database import engine, get_db, Base
from models import Claim, Farmer, Policy
from schemas import ClaimCreate, ClaimResponse, ClaimUpdateStatus, FarmerCreate, FarmerResponse, PolicyCreate, PolicyResponse, INDIAN_STATES, BoundaryAnalysisRequest, BoundaryAnalysisResponse
from gee_processor import process_ndvi
from ml_model import predict_claim, calculate_fraud_score
from pdf_report import generate_claim_pdf, generate_farmer_card_pdf
from dotenv import load_dotenv

load_dotenv()

# Create db tables
Base.metadata.create_all(bind=engine)

from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

app = FastAPI(title="Crop Insurance API")

# --- Static files for NDVI images ---
app.mount("/static", StaticFiles(directory="static"), name="static")

# --- Serve React frontend build ---
FRONTEND_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), "frontend_dist")

if os.path.isdir(FRONTEND_DIR):
    # Mount /assets (Vite puts JS/CSS bundles here)
    assets_dir = os.path.join(FRONTEND_DIR, "assets")
    if os.path.isdir(assets_dir):
        app.mount("/assets", StaticFiles(directory=assets_dir), name="frontend_assets")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ============================================================
# POLICY CATALOG
# ============================================================

POLICY_CATALOG = {
    "Drought Protection Insurance": {
        "code": "DRT-001",
        "coverage_per_unit": 40000,
        "premium_rate": 2.0,
        "unit": "acre",
        "covered_risks": ["Low rainfall", "Soil moisture deficit", "Heat stress"],
        "eligible_items": ["Paddy", "Wheat", "Maize", "Cotton", "Sugarcane", "Tomato", "Onion", "Chilli", "Turmeric", "Groundnut", "Sunflower", "Millets", "Pulses", "Banana", "Mango", "Coconut", "Rubber", "Coffee", "Tea"],
        "category": "land"
    },
    "Flood and Waterlogging Insurance": {
        "code": "FLO-002",
        "coverage_per_unit": 50000,
        "premium_rate": 2.5,
        "unit": "acre",
        "covered_risks": ["Flood", "Waterlogging", "River overflow", "Continuous heavy rain"],
        "eligible_items": ["Paddy", "Wheat", "Maize", "Cotton", "Sugarcane", "Tomato", "Onion", "Chilli", "Turmeric", "Groundnut", "Sunflower", "Millets", "Pulses", "Banana", "Mango", "Coconut", "Rubber", "Coffee", "Tea"],
        "category": "land"
    },
    "Pest and Disease Protection Insurance": {
        "code": "PDI-003",
        "coverage_per_unit": 45000,
        "premium_rate": 2.0,
        "unit": "acre",
        "covered_risks": ["Insect attack", "Fungal disease", "Viral infection", "Bacterial disease"],
        "eligible_items": ["Paddy", "Wheat", "Maize", "Cotton", "Sugarcane", "Tomato", "Onion", "Chilli", "Turmeric", "Groundnut", "Sunflower", "Millets", "Pulses", "Banana", "Mango", "Coconut", "Rubber", "Coffee", "Tea"],
        "category": "land"
    },
    "Cyclone and Wind Damage Insurance": {
        "code": "CWD-004",
        "coverage_per_unit": 60000,
        "premium_rate": 3.0,
        "unit": "acre",
        "covered_risks": ["Cyclone", "Storm", "High wind", "Hailstorm"],
        "eligible_items": ["Paddy", "Wheat", "Maize", "Cotton", "Sugarcane", "Tomato", "Onion", "Chilli", "Turmeric", "Groundnut", "Sunflower", "Millets", "Pulses", "Banana", "Mango", "Coconut", "Rubber", "Coffee", "Tea"],
        "category": "land"
    },
    "Comprehensive Field Damage Insurance": {
        "code": "CFD-005",
        "coverage_per_unit": 75000,
        "premium_rate": 4.0,
        "unit": "acre",
        "covered_risks": ["Drought", "Flood", "Pest and disease", "Cyclone", "Hailstorm", "Fire"],
        "eligible_items": ["Paddy", "Wheat", "Maize", "Cotton", "Sugarcane", "Tomato", "Onion", "Chilli", "Turmeric", "Groundnut", "Sunflower", "Millets", "Pulses", "Banana", "Mango", "Coconut", "Rubber", "Coffee", "Tea"],
        "category": "land"
    }
}

def calculate_policy_status(start_date, end_date):
    """Auto-calculate policy status from dates."""
    from datetime import date
    today = date.today()
    if today < start_date:
        return "Upcoming"
    elif start_date <= today <= end_date:
        return "Active"
    else:
        return "Expired"

# ============================================================
# API ROUTES
# ============================================================

@app.get("/api/health")
def health_check():
    return {"status": "AgriShield API is running", "version": "2.0.0"}

@app.get("/api/indian-states")
def get_indian_states():
    return INDIAN_STATES

@app.get("/api/policy-catalog")
def get_policy_catalog():
    return POLICY_CATALOG

# --- Farmer Registration ---

@app.post("/api/farmers", response_model=FarmerResponse)
def register_farmer(farmer: FarmerCreate, db: Session = Depends(get_db)):
    from datetime import date
    
    # Generate Farmer ID: FARM20260001
    count = db.query(Farmer).count()
    farmer_id_str = f"FARM2026{str(count + 1).zfill(4)}"
    
    db_farmer = Farmer(
        **farmer.dict(),
        farmer_id=farmer_id_str,
        registration_date=date.today()
    )
    db.add(db_farmer)
    db.commit()
    db.refresh(db_farmer)
    return db_farmer

@app.get("/api/farmers", response_model=List[FarmerResponse])
def list_farmers(db: Session = Depends(get_db)):
    return db.query(Farmer).order_by(Farmer.registration_date.desc()).all()

@app.get("/api/farmers/{farmer_id}/card")
def download_farmer_card(farmer_id: str, lang: str = "en", db: Session = Depends(get_db)):
    db_farmer = db.query(Farmer).filter(Farmer.farmer_id == farmer_id).first()
    if not db_farmer:
        raise HTTPException(status_code=404, detail="Farmer not found")
        
    pdf_bytes = generate_farmer_card_pdf(db_farmer, lang=lang)
    
    return StreamingResponse(
        io.BytesIO(pdf_bytes), 
        media_type="application/pdf", 
        headers={"Content-Disposition": f"attachment; filename=farmer_card_{farmer_id}.pdf"}
    )

@app.delete("/api/farmers/{farmer_id}")
def delete_farmer(farmer_id: str, db: Session = Depends(get_db)):
    farmer = db.query(Farmer).filter(Farmer.farmer_id == farmer_id).first()
    if not farmer:
        raise HTTPException(status_code=404, detail="Farmer not found")
    
    # Delete associated policies and claims
    db.query(Policy).filter(Policy.farmer_id == farmer_id).delete()
    db.query(Claim).filter(Claim.farmer_id == farmer_id).delete()
    
    # Delete farmer
    db.delete(farmer)
    db.commit()
    return {"message": "Farmer and all associated policies and claims deleted successfully"}

# --- Insurance Policies ---

@app.post("/api/policies", response_model=PolicyResponse)
def create_policy(policy: PolicyCreate, db: Session = Depends(get_db)):
    from datetime import date
    
    # Verify farmer exists
    farmer = db.query(Farmer).filter(Farmer.farmer_id == policy.farmer_id).first()
    if not farmer:
        raise HTTPException(status_code=404, detail="Farmer ID not found. Only registered farmers can add policies.")
    
    # Validate policy type
    catalog = POLICY_CATALOG.get(policy.policy_type)
    if not catalog:
        raise HTTPException(status_code=400, detail="Invalid policy type")
    
    # Validate crop/asset selection
    if policy.crop_type and policy.crop_type not in catalog["eligible_items"]:
        raise HTTPException(status_code=400, detail=f"'{policy.crop_type}' is not eligible for {policy.policy_type}")
    
    # Validate quantities
    category = catalog["category"]
    if category == "land":
        if not policy.land_area or policy.land_area <= 0:
            raise HTTPException(status_code=400, detail="Land area must be greater than 0")
    elif category == "livestock":
        if not policy.num_animals or policy.num_animals <= 0:
            raise HTTPException(status_code=400, detail="Number of animals must be greater than 0")
    
    # Check duplicate active policy
    existing = db.query(Policy).filter(
        Policy.farmer_id == policy.farmer_id,
        Policy.policy_type == policy.policy_type,
        Policy.crop_type == policy.crop_type,
        Policy.status == "Active"
    ).first()
    if existing:
        raise HTTPException(status_code=400, detail=f"An active '{policy.policy_type}' policy for '{policy.crop_type}' already exists for this farmer.")
    
    # Calculate coverage and premium
    coverage_per_unit = catalog["coverage_per_unit"]
    premium_rate = catalog["premium_rate"]
    
    if category == "land":
        total_coverage = coverage_per_unit * (policy.land_area or 1)
    elif category == "livestock":
        total_coverage = coverage_per_unit * (policy.num_animals or 1)
    else:  # equipment
        total_coverage = coverage_per_unit
    
    total_premium = total_coverage * premium_rate / 100
    farmer_premium = total_premium * 0.20
    govt_subsidy = total_premium * 0.80
    
    # Generate Insurance ID
    count = db.query(Policy).count()
    insurance_id = f"INS2026{str(count + 1).zfill(4)}"
    
    # Calculate status
    status = calculate_policy_status(policy.start_date, policy.end_date)
    
    db_policy = Policy(
        insurance_id=insurance_id,
        farmer_id=policy.farmer_id,
        policy_type=policy.policy_type,
        policy_code=catalog["code"],
        crop_type=policy.crop_type,
        coverage_per_unit=coverage_per_unit,
        premium_rate=premium_rate,
        land_area=policy.land_area,
        num_animals=policy.num_animals,
        total_coverage=total_coverage,
        total_premium=total_premium,
        farmer_premium=farmer_premium,
        govt_subsidy=govt_subsidy,
        start_date=policy.start_date,
        end_date=policy.end_date,
        status=status,
        issue_date=date.today(),
        insured_amount=total_coverage
    )
    db.add(db_policy)
    db.commit()
    db.refresh(db_policy)
    return db_policy

@app.get("/api/farmers/{farmer_id}/policies", response_model=List[PolicyResponse])
def get_farmer_policies(farmer_id: str, db: Session = Depends(get_db)):
    policies = db.query(Policy).filter(Policy.farmer_id == farmer_id).all()
    # Recalculate status on read
    for p in policies:
        new_status = calculate_policy_status(p.start_date, p.end_date)
        if p.status != new_status:
            p.status = new_status
    db.commit()
    return policies

@app.get("/api/policies/{insurance_id}/certificate")
def download_policy_certificate(insurance_id: str, lang: str = "en", db: Session = Depends(get_db)):
    db_policy = db.query(Policy).filter(Policy.insurance_id == insurance_id).first()
    if not db_policy:
        raise HTTPException(status_code=404, detail="Policy not found")
    
    farmer = db.query(Farmer).filter(Farmer.farmer_id == db_policy.farmer_id).first()
    
    pdf_bytes = generate_policy_certificate_pdf(db_policy, farmer, lang=lang)
    
    return StreamingResponse(
        io.BytesIO(pdf_bytes),
        media_type="application/pdf",
        headers={"Content-Disposition": f"attachment; filename=policy_{insurance_id}.pdf"}
    )

@app.get("/api/policies/validate")
def validate_policy(farmer_id: str, policy_number: str, db: Session = Depends(get_db)):
    # 1. Farmer must exist
    farmer = db.query(Farmer).filter(Farmer.farmer_id == farmer_id).first()
    if not farmer:
        raise HTTPException(status_code=404, detail="Farmer ID not found")
    
    # 2. Policy must exist and belong to farmer (check insurance_id)
    policy = db.query(Policy).filter(Policy.insurance_id == policy_number, Policy.farmer_id == farmer_id).first()
    if not policy:
        raise HTTPException(status_code=404, detail="Policy number not found for this farmer")
    
    # 3. Recalculate status
    new_status = calculate_policy_status(policy.start_date, policy.end_date)
    if policy.status != new_status:
        policy.status = new_status
        db.commit()
    
    # 4. Policy must be Active
    if policy.status.lower() != "active":
        raise HTTPException(status_code=400, detail=f"Policy is not active (current status: {policy.status})")
        
    return {
        "valid": True,
        "farmer_name": farmer.full_name,
        "village": farmer.village,
        "phone_number": farmer.mobile_number,
        "crop_type": policy.crop_type or policy.policy_type,
        "insured_amount": policy.total_coverage,
        "start_date": policy.start_date,
        "end_date": policy.end_date,
        "policy_type": policy.policy_type,
        "policy_code": policy.policy_code,
        "land_area": policy.land_area
    }

# --- Claims ---

def check_offline_landuse_restrictions(lat: float, lng: float) -> str | None:
    """
    100% Offline fallback check to detect major Indian cities, oceans, and non-agricultural areas.
    """
    # 1. Indian Ocean, Arabian Sea, Bay of Bengal coordinates
    # Too far south
    if lat < 8.0:
        return "Ocean / Water Body"
    # Arabian Sea (West)
    if lng < 68.5:
        return "Ocean / Arabian Sea"
    if lat < 20.0 and lng < 72.0:
        return "Ocean / Arabian Sea"
    if lat < 15.0 and lng < 73.5:
        return "Ocean / Arabian Sea"
    # Bay of Bengal (East)
    if lng > 89.0 and lat < 21.0:
        return "Ocean / Bay of Bengal"
    if lat < 16.0 and lng > 81.0:
        return "Ocean / Bay of Bengal"
    if lat < 13.0 and lng > 80.4:
        return "Ocean / Bay of Bengal"

    # 2. Expanded Indian Cities (Metropolitan & Urban Centers)
    CITIES = [
        {"name": "Delhi Metropolitan Area", "lat": 28.6139, "lng": 77.2090, "radius": 0.25},
        {"name": "Mumbai Urban Zone", "lat": 19.0760, "lng": 72.8777, "radius": 0.20},
        {"name": "Kolkata City Center", "lat": 22.5726, "lng": 88.3639, "radius": 0.18},
        {"name": "Chennai City Center", "lat": 13.0827, "lng": 80.2707, "radius": 0.15},
        {"name": "Bangalore Urban Zone", "lat": 12.9716, "lng": 77.5946, "radius": 0.20},
        {"name": "Hyderabad Urban Zone", "lat": 17.3850, "lng": 78.4867, "radius": 0.18},
        {"name": "Pune City Center", "lat": 18.5204, "lng": 73.8567, "radius": 0.12},
        {"name": "Ahmedabad Urban Area", "lat": 23.0225, "lng": 72.5714, "radius": 0.15},
        {"name": "Surat City Center", "lat": 21.1702, "lng": 72.8311, "radius": 0.12},
        {"name": "Jaipur Urban Center", "lat": 26.9124, "lng": 75.7873, "radius": 0.12},
        {"name": "Lucknow City Center", "lat": 26.8467, "lng": 80.9462, "radius": 0.10},
        {"name": "Coimbatore Urban Area", "lat": 11.0168, "lng": 76.9558, "radius": 0.10},
        {"name": "Madurai Urban Area", "lat": 9.9252, "lng": 78.1198, "radius": 0.10},
        {"name": "Trichy Urban Area", "lat": 10.7905, "lng": 78.7047, "radius": 0.10},
        {"name": "Vellore City Center", "lat": 12.9165, "lng": 79.1325, "radius": 0.08},
        {"name": "Salem City Area", "lat": 11.6643, "lng": 78.1460, "radius": 0.08},
        {"name": "Kanpur Urban Zone", "lat": 26.4499, "lng": 80.3319, "radius": 0.12},
        {"name": "Nagpur Urban Zone", "lat": 21.1458, "lng": 79.0882, "radius": 0.12},
        {"name": "Indore City Center", "lat": 22.7196, "lng": 75.8577, "radius": 0.12},
        {"name": "Bhopal City Center", "lat": 23.2599, "lng": 77.4126, "radius": 0.10},
        {"name": "Visakhapatnam Zone", "lat": 17.6868, "lng": 83.2185, "radius": 0.12},
        {"name": "Patna City Center", "lat": 25.5941, "lng": 85.1376, "radius": 0.10},
        {"name": "Vadodara City Area", "lat": 22.3072, "lng": 73.1812, "radius": 0.10},
        {"name": "Ghaziabad Urban Zone", "lat": 28.6692, "lng": 77.4538, "radius": 0.08},
        {"name": "Ludhiana City Center", "lat": 30.9010, "lng": 75.8573, "radius": 0.10},
        {"name": "Agra City Area", "lat": 27.1767, "lng": 78.0081, "radius": 0.08},
        {"name": "Nashik City Center", "lat": 19.9975, "lng": 73.7898, "radius": 0.10},
        {"name": "Faridabad Area", "lat": 28.4089, "lng": 77.3178, "radius": 0.08},
        {"name": "Meerut Zone", "lat": 28.9845, "lng": 77.7064, "radius": 0.08},
        {"name": "Rajkot City Area", "lat": 22.3039, "lng": 70.8022, "radius": 0.08},
        {"name": "Varanasi City Center", "lat": 25.3176, "lng": 82.9739, "radius": 0.08},
        {"name": "Srinagar City Center", "lat": 34.0837, "lng": 74.7973, "radius": 0.10},
        {"name": "Aurangabad City Center", "lat": 19.8762, "lng": 75.3433, "radius": 0.08},
        {"name": "Dhanbad City Center", "lat": 23.7957, "lng": 86.4304, "radius": 0.08},
        {"name": "Amritsar City Center", "lat": 31.6340, "lng": 74.8723, "radius": 0.08},
        {"name": "Allahabad City Center", "lat": 25.4358, "lng": 81.8463, "radius": 0.08},
        {"name": "Ranchi City Center", "lat": 23.3441, "lng": 85.3096, "radius": 0.08},
        {"name": "Gwalior City Area", "lat": 26.2183, "lng": 78.1828, "radius": 0.08},
        {"name": "Jabalpur City Area", "lat": 23.1815, "lng": 79.9864, "radius": 0.08},
        {"name": "Vijayawada Zone", "lat": 16.5062, "lng": 80.6480, "radius": 0.08},
        {"name": "Jodhpur City Center", "lat": 26.2389, "lng": 73.0243, "radius": 0.10},
        {"name": "Raipur City Center", "lat": 21.2514, "lng": 81.6296, "radius": 0.08},
        {"name": "Kota City Area", "lat": 25.2138, "lng": 75.8648, "radius": 0.08},
        {"name": "Guwahati City Area", "lat": 26.1158, "lng": 91.7086, "radius": 0.10},
        {"name": "Chandigarh Area", "lat": 30.7333, "lng": 76.7794, "radius": 0.08},
        {"name": "Solapur City Center", "lat": 17.6599, "lng": 75.9064, "radius": 0.08},
        {"name": "Hubli-Dharwad Area", "lat": 15.3647, "lng": 75.1240, "radius": 0.08},
        {"name": "Bareilly City Center", "lat": 28.3670, "lng": 79.4304, "radius": 0.08},
        {"name": "Mysore City Area", "lat": 12.2958, "lng": 76.6394, "radius": 0.08},
        {"name": "Gurgaon Urban Zone", "lat": 28.4595, "lng": 77.0266, "radius": 0.10},
        {"name": "Aligarh City Center", "lat": 27.8974, "lng": 78.0880, "radius": 0.08},
        {"name": "Jalandhar City Area", "lat": 31.3260, "lng": 75.5762, "radius": 0.08},
        {"name": "Bhubaneswar Area", "lat": 20.2961, "lng": 85.8245, "radius": 0.08},
        {"name": "Warangal City Center", "lat": 18.0000, "lng": 79.5800, "radius": 0.08},
        {"name": "Kochi Urban Zone", "lat": 9.9312, "lng": 76.2673, "radius": 0.08},
        {"name": "Trivandrum City Center", "lat": 8.5241, "lng": 76.9366, "radius": 0.08},
        {"name": "Calicut (Kozhikode)", "lat": 11.2588, "lng": 75.7804, "radius": 0.08},
        {"name": "Nellore City Center", "lat": 14.4426, "lng": 79.9865, "radius": 0.06},
        {"name": "Dehradun City Area", "lat": 30.3165, "lng": 78.0322, "radius": 0.08},
        {"name": "Jammu City Center", "lat": 32.7266, "lng": 74.8570, "radius": 0.06},
        {"name": "Udaipur City Center", "lat": 24.5854, "lng": 73.7125, "radius": 0.06},
        {"name": "Thanjavur City Area", "lat": 10.7870, "lng": 79.1378, "radius": 0.06},
        {"name": "Tirunelveli Zone", "lat": 8.7139, "lng": 77.7567, "radius": 0.06},
    ]
    
    import math
    for city in CITIES:
        dist = math.sqrt((lat - city["lat"])**2 + (lng - city["lng"])**2)
        if dist <= city["radius"]:
            return f"Urban Residential Area ({city['name']})"
            
    return None

def check_nominatim_presence(lat: float, lng: float) -> str | None:
    """
    Query OpenStreetMap Nominatim reverse geocoding API to detect
    precise land use at the center coordinate.
    Returns a description if it is non-agricultural (house, road, water, city, etc.),
    otherwise returns None (meaning it could be open/agricultural land).
    """
    import requests
    import math
    try:
        url = f"https://nominatim.openstreetmap.org/reverse?lat={lat}&lon={lng}&format=json&zoom=18"
        headers = {
            "User-Agent": "AgriShieldInsurer/2.0 (contact@agrishield.ai; academic demo)"
        }
        response = requests.get(url, headers=headers, timeout=2.5)
        if response.status_code == 200:
            data = response.json()
            osm_class = data.get("class", "").lower()
            osm_type = data.get("type", "").lower()
            display_name = data.get("display_name", "").lower()
            address = data.get("address", {})
            
            # Calculate distance in meters between query coordinate and matched feature coordinate
            try:
                feat_lat = float(data.get("lat", lat))
                feat_lng = float(data.get("lon", lng))
                dist_meters = math.sqrt(((lat - feat_lat) * 111000)**2 + ((lng - feat_lng) * 100000)**2)
            except Exception:
                dist_meters = 0.0
            
            # 1. Identify direct building/house matches within 120m snapping threshold
            is_building_type = osm_type in ["house", "apartments", "detached", "residential", "hotel", "office", "commercial", "industrial", "yes"]
            if (osm_class == "building" or is_building_type) and osm_class != "highway":
                if dist_meters <= 120.0:
                    return f"Residential/Commercial Building ({osm_type.capitalize() if osm_type else 'House'})"
                
            # 2. Identify roads and transport within 60m snapping threshold
            if osm_class == "highway" or osm_type in ["residential", "service", "track", "unclassified", "primary", "secondary", "tertiary"]:
                if osm_class == "highway":
                    if dist_meters <= 60.0:
                        return f"Road/Highway ({osm_type.capitalize() if osm_type else 'Street'})"
                    
            # 3. Identify water bodies within 200m snapping threshold
            if osm_class in ["waterway", "natural"] and osm_type in ["water", "river", "canal", "lake", "pond", "ocean", "sea", "bay", "reservoir"]:
                if dist_meters <= 200.0:
                    return f"Water Body ({osm_type.capitalize()})"
                
            # 4. Check display name and address details for explicit urban/rejected keywords
            # Only apply if the match is extremely close (under 80 meters) to prevent rural roads snapping
            if dist_meters <= 80.0:
                rejected_keywords = {
                    "house": "Residential House",
                    "apartment": "Apartment Building",
                    "building": "Urban Structure",
                    "residential": "Residential Zone",
                    "highway": "Highway",
                    "road": "Road/Street",
                    "street": "Road/Street",
                    "lane": "Street/Lane",
                    "water": "Water Body",
                    "lake": "Lake",
                    "river": "River",
                    "pond": "Pond",
                    "canal": "Canal",
                    "ocean": "Ocean",
                    "sea": "Sea",
                    "bay": "Bay/Ocean",
                    "commercial": "Commercial Zone",
                    "industrial": "Industrial Zone",
                    "factory": "Industrial Factory",
                    "office": "Office Building",
                    "shop": "Commercial Shop",
                    "school": "Educational Building (School)",
                    "college": "Educational Building (College)",
                    "university": "Educational Campus",
                    "hospital": "Hospital/Medical Center",
                    "temple": "Religious Structure (Temple)",
                    "church": "Religious Structure (Church)",
                    "mosque": "Religious Structure (Mosque)",
                    "railway": "Railway Line",
                    "station": "Railway/Metro Station",
                    "airport": "Airport Runway/Terminal",
                    "stadium": "Sports Stadium",
                    "park": "Urban Park/Recreation Area",
                    "zoo": "Urban Zoo",
                    "hotel": "Hotel/Resort",
                    "suburb": "Urban Suburb",
                    "city": "Urban City",
                    "town": "Urban Town",
                    "neighbourhood": "Urban Neighbourhood"
                }
                
                for keyword, label in rejected_keywords.items():
                    if keyword in display_name:
                        return label
                        
                for key, val in address.items():
                    val_str = str(val).lower()
                    if key in ["house_number", "building", "road", "suburb", "city", "neighbourhood", "amenity", "industrial", "commercial"]:
                        for keyword, label in rejected_keywords.items():
                            if keyword in val_str:
                                return label
                        if key == "house_number":
                            return "Residential Building (House)"
                        if key == "road":
                            return "Transportation Road"
                        
    except Exception as e:
        print(f"Nominatim lookup exception: {e}")
    return None

def check_osm_building_presence(lat: float, lng: float, area_acres: float) -> str | None:
    """
    Check if the drawn polygon is placed on a residential building/house, road, or water body.
    Uses OSM Overpass API with redundant fast mirrors and low timeouts.
    If any non-agricultural structure is found, returns its description.
    Otherwise returns None.
    """
    import requests
    import math
    try:
        # Approximate side length of bounding box based on acreage
        side_meters = math.sqrt(area_acres * 4046.856) if area_acres > 0 else 50
        # Roughly 111,000 meters per degree latitude/longitude
        delta = (side_meters / 2.0) / 111000.0
        
        min_lat = lat - delta
        min_lng = lng - delta
        max_lat = lat + delta
        max_lng = lng + delta
        
        query = f"""[out:json][timeout:3];
        (
          way["building"]({min_lat},{min_lng},{max_lat},{max_lng});
          node["building"]({min_lat},{min_lng},{max_lat},{max_lng});
          way["highway"]({min_lat},{min_lng},{max_lat},{max_lng});
          way["natural"="water"]({min_lat},{min_lng},{max_lat},{max_lng});
          way["waterway"]({min_lat},{min_lng},{max_lat},{max_lng});
          way["landuse"="residential"]({min_lat},{min_lng},{max_lat},{max_lng});
          way["landuse"="commercial"]({min_lat},{min_lng},{max_lat},{max_lng});
          way["landuse"="industrial"]({min_lat},{min_lng},{max_lat},{max_lng});
        );
        out tags;"""
        
        # Redundant high-performance OSM Overpass mirror servers
        mirrors = [
            "https://overpass.kumi.systems/api/interpreter",
            "https://lz4.overpass-api.de/api/interpreter",
            "https://z.overpass-api.de/api/interpreter"
        ]
        headers = {
            "User-Agent": "AgriShieldInsurer/2.0 (contact@agrishield.ai; academic demo)"
        }
        
        for url in mirrors:
            try:
                response = requests.post(url, data={"data": query}, headers=headers, timeout=2.5)
                if response.status_code == 200:
                    data = response.json()
                    elements = data.get("elements", [])
                    if elements:
                        tags = elements[0].get("tags", {})
                        if "building" in tags:
                            return f"Residential Building ({tags['building'].capitalize()})"
                        elif "highway" in tags:
                            return f"Road/Highway ({tags['highway'].capitalize()})"
                        elif "natural" in tags and tags["natural"] == "water":
                            return "Water Body (Lake/Ocean)"
                        elif "waterway" in tags:
                            return "Waterway (River/Canal)"
                        elif "landuse" in tags:
                            return f"Urban Area ({tags['landuse'].capitalize()} Zone)"
                        return "Residential Area / Non-Agricultural Land"
                    break  # Successful response with no buildings
            except Exception:
                continue
    except Exception:
        pass
    return None

def determine_land_classification(center_lat: float, center_lng: float, area_acres: float, is_valid_india: bool) -> str:
    """
    Unified land classification resolver. First runs offline city/ocean checks, then
    calls high-fidelity Nominatim Geocoding, then falls back to Overpass API and
    deterministic location-grid falls.
    """
    ACCEPTED_CLASSES = ["Cropland", "Agricultural Land", "Cultivated Field", "Plantation", "Fallow Agricultural Land"]
    
    # 1. Offline checks
    offline_check = check_offline_landuse_restrictions(center_lat, center_lng)
    if offline_check:
        return offline_check
        
    # 2. Nominatim high-fidelity reverse-geocoding API
    nominatim_check = check_nominatim_presence(center_lat, center_lng)
    if nominatim_check:
        return nominatim_check
        
    # 3. OSM Overpass API bounding box query
    osm_feature = check_osm_building_presence(center_lat, center_lng, area_acres)
    if osm_feature:
        return osm_feature
        
    # 4. India boundary check
    if not is_valid_india:
        return "Barren Rocky Land"
        
    # 5. Deterministic fallback grid (Only if offline or all APIs failed)
    val_idx = int((center_lat + center_lng) * 50000)
    if val_idx % 10 == 0:
        rejected_types = ["Residential Area (House)", "Building/Home", "Road/Street", "Water Body (Lake/Ocean)", "Industrial Zone", "Barren rocky land"]
        return rejected_types[val_idx % len(rejected_types)]
    else:
        return ACCEPTED_CLASSES[val_idx % len(ACCEPTED_CLASSES)]

@app.post("/api/claims/analyze-boundary", response_model=BoundaryAnalysisResponse)
def analyze_boundary(req: BoundaryAnalysisRequest):
    import json
    from datetime import datetime
    
    ACCEPTED_CLASSES = ["Cropland", "Agricultural Land", "Cultivated Field", "Plantation", "Fallow Agricultural Land"]
    
    # 1. Parse geojson
    try:
        geojson = json.loads(req.polygon_geojson)
        if "geometry" in geojson:
            geom = geojson["geometry"]
        else:
            geom = geojson
        
        coords = geom["coordinates"][0]  # exterior ring
        unique_coords = coords[:-1] if (len(coords) > 1 and coords[0] == coords[-1]) else coords
        lngs = [c[0] for c in unique_coords]
        lats = [c[1] for c in unique_coords]
        
        center_lng = sum(lngs) / len(unique_coords)
        center_lat = sum(lats) / len(unique_coords)
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid GeoJSON format: {str(e)}")
        
    # 2. Check if within India bounding box
    is_valid_india = True
    for lng, lat in coords:
        if not (6.4 <= lat <= 37.6 and 68.1 <= lng <= 97.4):
            is_valid_india = False
            break
            
    # 3. Determine Land Classification
    land_class = determine_land_classification(center_lat, center_lng, req.area_acres, is_valid_india)
    is_valid_land_type = land_class in ACCEPTED_CLASSES
    
    # 4. Check area matching tolerance ±5%
    min_allowed = req.insured_land_area * 0.95
    max_allowed = req.insured_land_area * 1.05
    is_valid_area_tolerance = (min_allowed <= req.area_acres <= max_allowed)
    area_difference = req.area_acres - req.insured_land_area
    
    satellite_ref = f"/static/ndvi_diff_{uuid.uuid4().hex[:8]}.png"
    
    return {
        "land_classification": land_class,
        "is_valid_india": is_valid_india,
        "is_valid_land_type": is_valid_land_type,
        "is_valid_area_tolerance": is_valid_area_tolerance,
        "area_difference": round(area_difference, 4),
        "satellite_ref": satellite_ref,
        "timestamp": datetime.now().isoformat()
    }

@app.post("/api/claims", response_model=ClaimResponse)
def submit_claim(claim: ClaimCreate, db: Session = Depends(get_db)):
    from datetime import date
    
    # 1. Validate Farmer & Policy
    policy = db.query(Policy).filter(Policy.insurance_id == claim.policy_number, Policy.farmer_id == claim.farmer_id).first()
    if not policy:
        raise HTTPException(status_code=400, detail="Invalid Farmer ID or Policy Number")
    
    # Recalculate status
    new_status = calculate_policy_status(policy.start_date, policy.end_date)
    if policy.status != new_status:
        policy.status = new_status
        db.commit()
    
    if policy.status.lower() != "active":
        raise HTTPException(status_code=400, detail="Policy is not active")
        
    # 2. Validate Amount
    if claim.requested_claim_amount <= 0:
        raise HTTPException(status_code=400, detail="Requested claim amount must be greater than 0")
    if claim.requested_claim_amount > policy.total_coverage:
        raise HTTPException(status_code=400, detail="Requested claim amount cannot exceed total coverage.")

    # 3. Validate Date of Loss
    if claim.date_of_loss > date.today():
        raise HTTPException(status_code=400, detail="Date of loss cannot be in the future.")
    if claim.date_of_loss < policy.start_date:
        raise HTTPException(status_code=400, detail="Date of loss is before policy start date.")
    if claim.date_of_loss > policy.end_date:
        raise HTTPException(status_code=400, detail="Date of loss is after policy expiry.")

    # 4. Validate sowing/harvest dates
    if claim.sowing_date:
        if claim.sowing_date > date.today():
            raise HTTPException(status_code=400, detail="Sowing date cannot be in the future.")
        if claim.expected_harvest_date:
            if claim.expected_harvest_date <= claim.sowing_date:
                raise HTTPException(status_code=400, detail="Expected harvest date must be after sowing date.")
        if claim.date_of_loss < claim.sowing_date:
            raise HTTPException(status_code=400, detail="Date of loss must be on or after sowing date.")
    
    # 5. Validate event dates
    if claim.event_end_date < claim.event_start_date:
        raise HTTPException(status_code=400, detail="Event end date must be on or after event start date.")

    # --- ENFORCE DETAILED BOUNDARY VALIDATION RULES ON SUBMIT ---
    import json
    from datetime import datetime
    
    # 1. India Boundary Check
    try:
        geojson = json.loads(claim.polygon_geojson)
        if "geometry" in geojson:
            geom = geojson["geometry"]
        else:
            geom = geojson
        coords = geom["coordinates"][0]
        lngs = [c[0] for c in coords]
        lats = [c[1] for c in coords]
        center_lng = sum(lngs) / len(lngs)
        center_lat = sum(lats) / len(lats)
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid GeoJSON format for farm boundary.")
        
    is_within_india = True
    for lng, lat in coords:
        if not (6.4 <= lat <= 37.6 and 68.1 <= lng <= 97.4):
            is_within_india = False
            break
            
    if not is_within_india:
        raise HTTPException(status_code=400, detail="This farm boundary must be located within India.")
        
    # Calculate land classification safely
    land_class = claim.land_classification or determine_land_classification(center_lat, center_lng, claim.area_acres or 0.0, is_within_india)

    # 3. Acreage Tolerance Check (±5%)
    if not policy.land_area or policy.land_area <= 0:
        raise HTTPException(status_code=400, detail="Policy has no valid land area for validation.")
        
    min_allowed = policy.land_area * 0.95
    max_allowed = policy.land_area * 1.05
    if not (min_allowed <= claim.area_acres <= max_allowed):
        raise HTTPException(status_code=400, detail=f"The selected farm boundary area must match the insured land area of {policy.land_area} acres (allowed tolerance ±5%).")

    # Create unique claim ID
    claim_id_str = f"CLM-{str(uuid.uuid4())[:8].upper()}"
    
    # Process NDVI data
    ndvi_result = process_ndvi(
        polygon_geojson=claim.polygon_geojson,
        event_start=claim.event_start_date.isoformat(),
        event_end=claim.event_end_date.isoformat()
    )
    
    # Predict ML outcome (use crop_type instead of removed event_type)
    ml_pred, ml_conf = predict_claim(
        damage_pct=ndvi_result['damage_percentage'],
        crop_type=claim.crop_type,
        event_type="General"  # event_type removed, use generic
    )

    # Calculate suggested payout: Total Coverage × Damage % / 100
    dmg_pct = ndvi_result['damage_percentage'] or 0.0
    sugg_payout = policy.total_coverage * (dmg_pct / 100.0)
    
    # Calculate Fraud Risk
    claim_dict = claim.dict()
    claim_dict['damage_percentage'] = dmg_pct
    claim_dict['land_classification'] = land_class
    claim_dict['area_acres'] = claim.area_acres
    f_score, f_risk, f_notes = calculate_fraud_score(claim_dict, claim.polygon_geojson, db)

    # Prepare satellite reference and timestamp
    satellite_ref = claim.satellite_ref or ndvi_result['ndvi_diff_map'] or f"/static/ndvi_diff_{uuid.uuid4().hex[:8]}.png"
    boundary_time = claim.boundary_timestamp or datetime.now().isoformat()

    db_claim = Claim(
        claim_id=claim_id_str,
        farmer_name=claim.farmer_name,
        phone_number=claim.phone_number,
        village=claim.village,
        farmer_id=claim.farmer_id,
        policy_number=claim.policy_number,
        crop_type=claim.crop_type,
        sowing_date=claim.sowing_date,
        expected_harvest_date=claim.expected_harvest_date,
        event_start_date=claim.event_start_date,
        event_end_date=claim.event_end_date,
        date_of_loss=claim.date_of_loss,
        polygon_geojson=claim.polygon_geojson,
        area_acres=claim.area_acres,
        area_hectares=claim.area_hectares,
        requested_claim_amount=claim.requested_claim_amount,
        ndvi_before_map=ndvi_result['ndvi_before_map'],
        ndvi_after_map=ndvi_result['ndvi_after_map'],
        ndvi_diff_map=ndvi_result['ndvi_diff_map'],
        damage_percentage=ndvi_result['damage_percentage'],
        ml_prediction=ml_pred,
        ml_confidence=ml_conf,
        suggested_payout=sugg_payout,
        fraud_score=f_score,
        fraud_risk_level=f_risk,
        status="Pending",
        admin_notes=f_notes if f_notes else None,
        land_classification=land_class,
        boundary_status="Valid",
        satellite_ref=satellite_ref,
        boundary_timestamp=boundary_time
    )
    
    db.add(db_claim)
    db.commit()
    db.refresh(db_claim)
    return db_claim

@app.get("/api/admin/claims/export")
def export_claims_csv(db: Session = Depends(get_db)):
    claims = db.query(Claim).all()
    
    output = io.StringIO()
    import csv
    writer = csv.writer(output)
    
    writer.writerow(['Claim ID', 'Farmer Name', 'Crop', 'Requested Amount', 'Damage Pct', 'ML Prediction', 'Confidence', 'Fraud Risk', 'Status'])
    
    for c in claims:
        writer.writerow([
            c.claim_id, c.farmer_name, c.crop_type,
            c.requested_claim_amount, c.damage_percentage, 
            c.ml_prediction, c.ml_confidence, c.fraud_risk_level, c.status
        ])
        
    response = StreamingResponse(iter([output.getvalue()]), media_type="text/csv")
    response.headers["Content-Disposition"] = "attachment; filename=claims_export.csv"
    return response

@app.get("/api/claims/{claim_id}/pdf")
def download_claim_pdf(claim_id: str, lang: str = "en", db: Session = Depends(get_db)):
    db_claim = db.query(Claim).filter(Claim.claim_id == claim_id).first()
    if not db_claim:
        raise HTTPException(status_code=404, detail="Claim not found")
        
    pdf_bytes = generate_claim_pdf(db_claim, lang=lang)
    
    return StreamingResponse(
        io.BytesIO(pdf_bytes), 
        media_type="application/pdf", 
        headers={"Content-Disposition": f"attachment; filename=claim_{claim_id}.pdf"}
    )

@app.get("/api/claims/{claim_id}", response_model=ClaimResponse)
def get_claim(claim_id: str, db: Session = Depends(get_db)):
    db_claim = db.query(Claim).filter((Claim.claim_id == claim_id) | (Claim.phone_number == claim_id)).first()
    if db_claim is None:
        raise HTTPException(status_code=404, detail="Claim not found")
    return db_claim

@app.get("/api/admin/claims", response_model=List[ClaimResponse])
def get_all_claims(
    crop_type: str = None, 
    status: str = None,
    db: Session = Depends(get_db)
):
    query = db.query(Claim)
    if crop_type:
        query = query.filter(Claim.crop_type == crop_type)
    if status:
        query = query.filter(Claim.status == status)
    return query.all()

@app.put("/api/admin/claims/{claim_id}", response_model=ClaimResponse)
def update_claim_status(claim_id: str, update_data: ClaimUpdateStatus, db: Session = Depends(get_db)):
    db_claim = db.query(Claim).filter(Claim.claim_id == claim_id).first()
    if not db_claim:
        raise HTTPException(status_code=404, detail="Claim not found")
    
    db_claim.status = update_data.status
    db_claim.admin_notes = update_data.admin_notes
    db.commit()
    db.refresh(db_claim)
    return db_claim

@app.get("/api/admin/dashboard")
def get_dashboard_stats(db: Session = Depends(get_db)):
    from datetime import date
    today = date.today()
    
    total_farmers = db.query(Farmer).count()
    total_policies = db.query(Policy).count()
    
    # Recalculate all policy statuses
    all_policies = db.query(Policy).all()
    active_policies = 0
    expired_policies = 0
    upcoming_policies = 0
    total_coverage_amount = 0.0
    total_premium_collected = 0.0
    total_govt_subsidy = 0.0
    
    for p in all_policies:
        new_status = calculate_policy_status(p.start_date, p.end_date)
        if p.status != new_status:
            p.status = new_status
        if p.status == "Active":
            active_policies += 1
        elif p.status == "Expired":
            expired_policies += 1
        elif p.status == "Upcoming":
            upcoming_policies += 1
        total_coverage_amount += (p.total_coverage or 0)
        total_premium_collected += (p.total_premium or 0)
        total_govt_subsidy += (p.govt_subsidy or 0)
    db.commit()
    
    total_claims = db.query(Claim).count()
    approved_claims = db.query(Claim).filter(Claim.status == "Approved").count()
    total_approved_amount = db.query(func.coalesce(func.sum(Claim.suggested_payout), 0)).filter(Claim.status == "Approved").scalar()
    
    status_counts = db.query(Claim.status, func.count(Claim.id)).group_by(Claim.status).all()
    crop_counts = db.query(Claim.crop_type, func.count(Claim.id)).group_by(Claim.crop_type).all()
    
    return {
        "total_farmers": total_farmers,
        "total_policies": total_policies,
        "active_policies": active_policies,
        "expired_policies": expired_policies,
        "upcoming_policies": upcoming_policies,
        "total_coverage_amount": total_coverage_amount,
        "total_premium_collected": total_premium_collected,
        "total_govt_subsidy": total_govt_subsidy,
        "total_claims": total_claims,
        "approved_claims": approved_claims,
        "total_approved_amount": total_approved_amount,
        "status_distribution": {k: v for k, v in status_counts},
        "crop_distribution": {k: v for k, v in crop_counts}
    }

# ============================================================
# POLICY CERTIFICATE PDF
# ============================================================

def generate_policy_certificate_pdf(policy, farmer, lang="en"):
    from reportlab.lib.pagesizes import A4
    from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
    from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
    from reportlab.lib import colors
    from reportlab.lib.enums import TA_CENTER
    
    buffer = io.BytesIO()
    doc = SimpleDocTemplate(buffer, pagesize=A4, rightMargin=40, leftMargin=40, topMargin=50, bottomMargin=50)
    Story = []
    styles = getSampleStyleSheet()
    
    title_style = ParagraphStyle(name="TitleStyle", parent=styles["Heading1"], alignment=TA_CENTER, fontSize=20, leading=24, spaceAfter=20, textColor=colors.HexColor("#065f46"))
    section_style = ParagraphStyle(name="SectionStyle", parent=styles["Heading3"])
    
    Story.append(Paragraph("<b>AgriShield Insurance Policy Certificate</b>", title_style))
    Story.append(Spacer(1, 15))
    
    t_style = TableStyle([
        ('BACKGROUND', (0, 0), (0, -1), colors.HexColor("#f3f4f6")),
        ('ALIGN', (0, 0), (-1, -1), 'LEFT'),
        ('FONTNAME', (0, 0), (0, -1), 'Helvetica-Bold'),
        ('BOTTOMPADDING', (0, 0), (-1, -1), 10),
        ('TOPPADDING', (0, 0), (-1, -1), 10),
        ('GRID', (0, 0), (-1, -1), 1, colors.HexColor("#e5e7eb")),
        ('VALIGN', (0, 0), (-1, -1), 'MIDDLE'),
    ])
    
    farmer_name = farmer.full_name if farmer else "N/A"
    
    data = [
        ["Insurance ID", policy.insurance_id],
        ["Farmer ID", policy.farmer_id],
        ["Farmer Name", farmer_name],
        ["Policy Type", policy.policy_type],
        ["Policy Code", policy.policy_code],
        ["Crop/Asset", policy.crop_type or "N/A"],
        ["Coverage per Unit", f"Rs. {policy.coverage_per_unit:,.2f}"],
        ["Total Coverage", f"Rs. {policy.total_coverage:,.2f}"],
        ["Premium Rate", f"{policy.premium_rate}%"],
        ["Total Premium", f"Rs. {policy.total_premium:,.2f}"],
        ["Farmer Pays (20%)", f"Rs. {policy.farmer_premium:,.2f}"],
        ["Govt Subsidy (80%)", f"Rs. {policy.govt_subsidy:,.2f}"],
        ["Start Date", str(policy.start_date)],
        ["End Date", str(policy.end_date)],
        ["Status", policy.status],
        ["Issue Date", str(policy.issue_date)],
    ]
    
    t = Table(data, colWidths=[180, 330])
    t.setStyle(t_style)
    Story.append(t)
    Story.append(Spacer(1, 30))
    
    signoff_style = ParagraphStyle(name="Signoff", alignment=TA_CENTER, fontSize=10, textColor=colors.gray)
    Story.append(Paragraph("This is a system-generated policy certificate from AgriShield AI Platform.", signoff_style))
    
    doc.build(Story)
    buffer.seek(0)
    return buffer.read()

# ============================================================
# SPA CATCH-ALL: Serve React frontend for all non-API routes
# ============================================================

@app.get("/{full_path:path}")
async def serve_spa(request: Request, full_path: str):
    """Serve React frontend. Any path not matching /api/* or /static/* 
    will serve index.html so React Router can handle client-side routing."""
    
    file_path = os.path.join(FRONTEND_DIR, full_path)
    if full_path and os.path.isfile(file_path):
        return FileResponse(file_path)
    
    index_path = os.path.join(FRONTEND_DIR, "index.html")
    if os.path.isfile(index_path):
        return FileResponse(index_path)
    
    return {"status": "AgriShield API is running", "version": "2.0.0", "note": "Frontend not built yet."}
