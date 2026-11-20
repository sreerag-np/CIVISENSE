import math
import re
from typing import Optional, Tuple, List, Dict, Any

# Approximate landmarks & wards for Payyanur / Kannur region for instant demo lookup
PAYYANUR_LANDMARKS = [
    {"name": "Old Bus Stand & Municipal Market", "ward": "Ward 12 (Town Center)", "lat": 12.1032, "lng": 75.2023, "radius": 0.008},
    {"name": "Perumba Junction & NH 66", "ward": "Ward 1 (Perumba)", "lat": 12.0915, "lng": 75.2134, "radius": 0.009},
    {"name": "Payyanur Railway Station Road", "ward": "Ward 15 (Station Area)", "lat": 12.1078, "lng": 75.1925, "radius": 0.008},
    {"name": "Subramanya Swami Temple Area", "ward": "Ward 7 (Temple Road)", "lat": 12.0984, "lng": 75.2001, "radius": 0.007},
    {"name": "Keloth High School Road", "ward": "Ward 8 (Keloth)", "lat": 12.1095, "lng": 75.2081, "radius": 0.008},
    {"name": "Annur Bridge & Canal Walk", "ward": "Ward 4 (Annur)", "lat": 12.1150, "lng": 75.2190, "radius": 0.010},
    {"name": "Kandoth Weavers Colony", "ward": "Ward 18 (Kandoth)", "lat": 12.0860, "lng": 75.2280, "radius": 0.010},
    {"name": "Korom Primary Health Center Road", "ward": "Ward 22 (Korom)", "lat": 12.1220, "lng": 75.2340, "radius": 0.012}
]

def parse_coordinates(location_str: Optional[str]) -> Tuple[Optional[float], Optional[float]]:
    """Extract (lat, lng) floats from various string formats like '12.1032, 75.2023'"""
    if not location_str:
        return None, None
    
    # Try regex matching two floating point numbers
    matches = re.findall(r"[-+]?\d*\.\d+|\d+", location_str)
    if len(matches) >= 2:
        try:
            lat = float(matches[0])
            lng = float(matches[1])
            # Basic sanity check
            if -90 <= lat <= 90 and -180 <= lng <= 180:
                return lat, lng
        except ValueError:
            pass
    return None, None

def haversine_distance(lat1: float, lon1: float, lat2: float, lon2: float) -> float:
    """Calculate the great circle distance between two points on the earth in meters."""
    R = 6371000.0  # Earth radius in meters
    phi1 = math.radians(lat1)
    phi2 = math.radians(lat2)
    delta_phi = math.radians(lat2 - lat1)
    delta_lambda = math.radians(lon2 - lon1)

    a = (math.sin(delta_phi / 2.0) ** 2 +
         math.cos(phi1) * math.cos(phi2) * math.sin(delta_lambda / 2.0) ** 2)
    c = 2.0 * math.atan2(math.sqrt(a), math.sqrt(1.0 - a))
    return R * c

def reverse_geocode(lat: Optional[float], lng: Optional[float]) -> str:
    """Return a human-friendly ward and landmark description from coordinates."""
    if lat is None or lng is None:
        return "Payyanur Municipal Area, Kannur, Kerala"
    
    # Check if close to predefined Payyanur landmarks
    closest = None
    min_dist = float('inf')
    
    for lm in PAYYANUR_LANDMARKS:
        d = haversine_distance(lat, lng, lm["lat"], lm["lng"])
        if d < min_dist:
            min_dist = d
            closest = lm
    
    if closest and min_dist < 1200:  # within 1.2km of a known landmark
        return f"{closest['name']}, {closest['ward']}, Payyanur"
    
    # Fallback to coordinate formatted address
    return f"Near Coordinate ({lat:.4f}, {lng:.4f}), Payyanur Sector"

def check_duplicate(
    lat: Optional[float],
    lng: Optional[float],
    category: str,
    existing_reports: List[Dict[str, Any]],
    threshold_meters: float = 85.0
) -> Tuple[bool, Optional[str], Optional[float]]:
    """
    Check if a report of similar category already exists within threshold_meters.
    Returns (is_duplicate, matching_report_id, distance_meters)
    """
    if lat is None or lng is None:
        return False, None, None
    
    for report in existing_reports:
        # Only check active / non-resolved reports
        if report.get("status") in ["Resolved", "Closed"]:
            continue
            
        r_lat = report.get("latitude")
        r_lng = report.get("longitude")
        if r_lat is None or r_lng is None:
            continue
            
        dist = haversine_distance(lat, lng, r_lat, r_lng)
        
        # Check if within distance threshold and categories match or are related
        if dist <= threshold_meters:
            rep_cat = report.get("category", "").lower()
            new_cat = category.lower()
            
            # Direct match or both are road/waste/water related
            cat_match = (
                rep_cat == new_cat or
                ("pothole" in rep_cat and "road" in new_cat) or
                ("road" in rep_cat and "pothole" in new_cat) or
                ("waste" in rep_cat and "garbage" in new_cat) or
                ("water" in rep_cat and "leak" in new_cat)
            )
            
            if cat_match:
                return True, report.get("id"), round(dist, 1)
                
    return False, None, None
