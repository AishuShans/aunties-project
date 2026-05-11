from sqlalchemy import Column, Integer, String, Float, Text, Date
from database import Base

class Farmer(Base):
    __tablename__ = "farmers"

    id = Column(Integer, primary_key=True, index=True)
    farmer_id = Column(String, unique=True, index=True)
    full_name = Column(String)
    mobile_number = Column(String)
    address = Column(Text)
    state = Column(String)
    district = Column(String)
    village = Column(String)
    registration_date = Column(Date)

class Policy(Base):
    __tablename__ = "policies"

    id = Column(Integer, primary_key=True, index=True)
    insurance_id = Column(String, unique=True, index=True)  # INS20260001
    farmer_id = Column(String, index=True)
    policy_type = Column(String)        # e.g. "PMFBY Crop Insurance"
    policy_code = Column(String)        # e.g. "PMFBY-001"
    crop_type = Column(String, nullable=True)  # Eligible crop/asset selected
    coverage_per_unit = Column(Float)   # per acre / per animal / per equipment
    premium_rate = Column(Float)        # percentage
    land_area = Column(Float, nullable=True)   # acres (for land-based)
    num_animals = Column(Integer, nullable=True)  # for livestock
    total_coverage = Column(Float)
    total_premium = Column(Float)
    farmer_premium = Column(Float)
    govt_subsidy = Column(Float)
    start_date = Column(Date)
    end_date = Column(Date)
    status = Column(String)  # Active, Expired, Upcoming (auto-calculated)
    issue_date = Column(Date)
    # Keep insured_amount for backward compat with claim validation
    insured_amount = Column(Float)

class Claim(Base):
    __tablename__ = "claims"

    id = Column(Integer, primary_key=True, index=True)
    claim_id = Column(String, unique=True, index=True)
    farmer_name = Column(String, index=True)
    phone_number = Column(String)
    village = Column(String)
    farmer_id = Column(String)
    policy_number = Column(String)  # maps to insurance_id
    
    crop_type = Column(String)
    sowing_date = Column(Date, nullable=True)
    expected_harvest_date = Column(Date, nullable=True)
    
    # event_type removed as per requirements
    event_start_date = Column(Date)
    event_end_date = Column(Date)
    date_of_loss = Column(Date)
    
    polygon_geojson = Column(Text)
    area_acres = Column(Float, nullable=True)
    area_hectares = Column(Float, nullable=True)

    # Claim Amounts
    requested_claim_amount = Column(Float, nullable=True)
    suggested_payout = Column(Float, nullable=True)

    # NDVI Processing Results
    ndvi_before_map = Column(String, nullable=True)
    ndvi_after_map = Column(String, nullable=True)
    ndvi_diff_map = Column(String, nullable=True)
    damage_percentage = Column(Float, nullable=True)

    # ML Prediction and Admin Action
    ml_prediction = Column(String, nullable=True)
    ml_confidence = Column(Float, nullable=True)
    status = Column(String, default="Pending")
    admin_notes = Column(Text, nullable=True)
    
    # AI Fraud Detection
    fraud_score = Column(Float, nullable=True)
    fraud_risk_level = Column(String, nullable=True)

    # Land Boundary tracking
    land_classification = Column(String, nullable=True)
    boundary_status = Column(String, nullable=True)
    satellite_ref = Column(String, nullable=True)
    boundary_timestamp = Column(String, nullable=True)

