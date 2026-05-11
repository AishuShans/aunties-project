from pydantic import BaseModel, field_validator
from typing import Optional
from datetime import date
import re

# ============================================================
# FARMER
# ============================================================

INDIAN_STATES = [
    "Andhra Pradesh", "Arunachal Pradesh", "Assam", "Bihar", "Chhattisgarh",
    "Goa", "Gujarat", "Haryana", "Himachal Pradesh", "Jharkhand",
    "Karnataka", "Kerala", "Madhya Pradesh", "Maharashtra", "Manipur",
    "Meghalaya", "Mizoram", "Nagaland", "Odisha", "Punjab",
    "Rajasthan", "Sikkim", "Tamil Nadu", "Telangana", "Tripura",
    "Uttar Pradesh", "Uttarakhand", "West Bengal"
]

class FarmerBase(BaseModel):
    full_name: str
    mobile_number: str
    address: str
    state: str
    district: str
    village: str

    @field_validator('mobile_number')
    @classmethod
    def validate_mobile(cls, v):
        v = v.strip()
        if not re.match(r'^[6-9]\d{9}$', v):
            raise ValueError('Enter a valid 10-digit Indian mobile number starting with 6, 7, 8, or 9.')
        return v

    @field_validator('state')
    @classmethod
    def validate_state(cls, v):
        if v not in INDIAN_STATES:
            raise ValueError('Please select a valid Indian state.')
        return v

class FarmerCreate(FarmerBase):
    pass

class FarmerResponse(FarmerBase):
    id: int
    farmer_id: str
    registration_date: date

    class Config:
        from_attributes = True

# ============================================================
# POLICY
# ============================================================

class PolicyCreate(BaseModel):
    farmer_id: str
    policy_type: str            # e.g. "PMFBY Crop Insurance"
    crop_type: Optional[str] = None  # selected eligible crop/asset
    land_area: Optional[float] = None
    num_animals: Optional[int] = None
    start_date: date
    end_date: date

    @field_validator('end_date')
    @classmethod
    def end_after_start(cls, v, info):
        start = info.data.get('start_date')
        if start and v < start:
            raise ValueError('End date must be on or after start date.')
        return v

class PolicyResponse(BaseModel):
    id: int
    insurance_id: str
    farmer_id: str
    policy_type: str
    policy_code: str
    crop_type: Optional[str] = None
    coverage_per_unit: float
    premium_rate: float
    land_area: Optional[float] = None
    num_animals: Optional[int] = None
    total_coverage: float
    total_premium: float
    farmer_premium: float
    govt_subsidy: float
    start_date: date
    end_date: date
    status: str
    issue_date: date
    insured_amount: float

    class Config:
        from_attributes = True

# ============================================================
# CLAIM
# ============================================================

class ClaimBase(BaseModel):
    farmer_name: str
    phone_number: str
    village: str
    farmer_id: str
    policy_number: str   # maps to insurance_id
    crop_type: str
    sowing_date: Optional[date] = None
    expected_harvest_date: Optional[date] = None
    event_start_date: date
    event_end_date: date
    date_of_loss: date
    polygon_geojson: str
    requested_claim_amount: Optional[float] = 0.0
    area_acres: Optional[float] = None
    area_hectares: Optional[float] = None
    land_classification: Optional[str] = None
    boundary_status: Optional[str] = None
    satellite_ref: Optional[str] = None
    boundary_timestamp: Optional[str] = None

class ClaimCreate(ClaimBase):
    pass

class ClaimResponse(ClaimBase):
    id: int
    claim_id: str
    
    suggested_payout: Optional[float] = None
    
    ndvi_before_map: Optional[str] = None
    ndvi_after_map: Optional[str] = None
    ndvi_diff_map: Optional[str] = None
    damage_percentage: Optional[float] = None
    
    ml_prediction: Optional[str] = None
    ml_confidence: Optional[float] = None
    status: str
    admin_notes: Optional[str] = None
    
    fraud_score: Optional[float] = None
    fraud_risk_level: Optional[str] = None

    class Config:
        from_attributes = True

class ClaimUpdateStatus(BaseModel):
    status: str
    admin_notes: Optional[str] = None

class BoundaryAnalysisRequest(BaseModel):
    polygon_geojson: str
    insured_land_area: float
    area_acres: float

class BoundaryAnalysisResponse(BaseModel):
    land_classification: str
    is_valid_india: bool
    is_valid_land_type: bool
    is_valid_area_tolerance: bool
    area_difference: float
    satellite_ref: str
    timestamp: str
