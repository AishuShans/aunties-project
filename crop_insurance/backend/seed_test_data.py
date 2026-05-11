from sqlalchemy.orm import Session
from datetime import date
from database import engine, SessionLocal, Base
from models import Claim

def seed_data():
    db = SessionLocal()
    
    # Check if claim already exists
    existing = db.query(Claim).filter(Claim.claim_id == 'CLM-TEST123').first()
    if existing:
        print("Test claim 'CLM-TEST123' already exists.")
        db.close()
        return

    # Create dummy claim
    dummy_claim = Claim(
        claim_id='CLM-TEST123',
        farmer_name='Rajesh Kumar',
        phone_number='9876543210',
        village='Anandpur',
        farmer_id='FRM-999',
        crop_type='Wheat',
        sowing_date=date(2025, 11, 15),
        expected_harvest_date=date(2026, 4, 10),
        event_type='Flood',
        event_start_date=date(2026, 3, 20),
        event_end_date=date(2026, 3, 25),
        polygon_geojson='{"type": "Polygon", "coordinates": [[[0,0], [0,1], [1,1], [1,0], [0,0]]]}',
        requested_claim_amount=50000.0,
        suggested_payout=45000.0,
        ndvi_before_map='',
        ndvi_after_map='',
        ndvi_diff_map='',
        damage_percentage=85.5,
        ml_prediction='Accept',
        status='Pending',
        admin_notes=''
    )
    
    try:
        db.add(dummy_claim)
        db.commit()
        print("Successfully inserted dummy claim with ID: CLM-TEST123")
    except Exception as e:
        db.rollback()
        print(f"Failed to insert dummy claim: {e}")
    finally:
        db.close()

if __name__ == "__main__":
    # Ensure tables are created
    Base.metadata.create_all(bind=engine)
    seed_data()
