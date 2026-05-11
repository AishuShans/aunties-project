import random
import uuid
import os
import numpy as np
from typing import Dict, Any

def process_ndvi(polygon_geojson: str, event_start: str, event_end: str) -> Dict[str, Any]:
    import matplotlib
    matplotlib.use('Agg')
    import matplotlib.pyplot as plt
    """
    Mock Google Earth Engine processing logic using numpy and matplotlib.
    In a real system, this would authenticate with ee.Initialize(credentials)
    and use Sentinel-2 imagery (COPERNICUS/S2_SR) to compute NDVI differences.
    """
    
    # Simulate processing delay and values
    base_ndvi = random.uniform(0.6, 0.9)
    
    # Simulate a realistic mix of healthy (undamaged) and damaged crops (50/50 split)
    if random.random() < 0.5:
        # Undamaged/Healthy crop: 1% to 12% damage factor
        damage_factor = random.uniform(0.01, 0.12)
    else:
        # Damaged crop: 40% to 85% damage factor
        damage_factor = random.uniform(0.40, 0.85)
        
    after_ndvi = base_ndvi * (1 - damage_factor)
    
    # Cap NDVI
    before = min(1.0, max(-1.0, base_ndvi))
    after = min(1.0, max(-1.0, after_ndvi))
    
    damage_pct = ((before - after) / before) * 100 if before > 0 else 0

    # Ensure static directory exists
    static_dir = os.path.join(os.path.dirname(__file__), "static")
    os.makedirs(static_dir, exist_ok=True)
    
    req_id = uuid.uuid4().hex[:8]
    
    before_path = f"/static/ndvi_before_{req_id}.png"
    after_path = f"/static/ndvi_after_{req_id}.png"
    diff_path = f"/static/ndvi_diff_{req_id}.png"
    
    before_file = os.path.join(static_dir, f"ndvi_before_{req_id}.png")
    after_file = os.path.join(static_dir, f"ndvi_after_{req_id}.png")
    diff_file = os.path.join(static_dir, f"ndvi_diff_{req_id}.png")
    
    # Generate matrices (mocking a 100x100 raster of a farm)
    # NDVI normally ranges from -1 to 1
    matrix_before = np.random.normal(loc=before, scale=0.05, size=(100, 100))
    matrix_before = np.clip(matrix_before, -1, 1)
    
    matrix_after = np.random.normal(loc=after, scale=0.1, size=(100, 100))
    matrix_after = np.clip(matrix_after, -1, 1)
    
    matrix_diff = matrix_before - matrix_after
    
    # Save before map
    plt.figure(figsize=(4,3))
    plt.imshow(matrix_before, cmap='RdYlGn', vmin=-1, vmax=1)
    plt.colorbar(label='NDVI')
    plt.title('NDVI Before Event')
    plt.axis('off')
    plt.tight_layout()
    plt.savefig(before_file)
    plt.close()
    
    # Save after map
    plt.figure(figsize=(4,3))
    plt.imshow(matrix_after, cmap='RdYlGn', vmin=-1, vmax=1)
    plt.colorbar(label='NDVI')
    plt.title('NDVI After Event')
    plt.axis('off')
    plt.tight_layout()
    plt.savefig(after_file)
    plt.close()
    
    # Save diff map
    plt.figure(figsize=(4,3))
    plt.imshow(matrix_diff, cmap='Reds', vmin=0, vmax=0.6)
    plt.colorbar(label='NDVI Decrease')
    plt.title('NDVI Difference')
    plt.axis('off')
    plt.tight_layout()
    plt.savefig(diff_file)
    plt.close()

    return {
        "ndvi_before_map": before_path,
        "ndvi_after_map": after_path,
        "ndvi_diff_map": diff_path,
        "damage_percentage": round(damage_pct, 2)
    }
