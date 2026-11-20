import os
import uuid
import time
from typing import Optional, List, Dict, Any
from fastapi import FastAPI, File, UploadFile, Form, Query, HTTPException, Body
from fastapi.middleware.cors import CORSMiddleware
from fastapi.staticfiles import StaticFiles

import geo_utils
import ai_engine
import db

app = FastAPI(
    title="CIVISENSE API 2.0",
    description="Civic Science AI - Intelligent Civic Hazard Detection, Deduplication & Municipal Response Platform",
    version="2.0.0"
)

# Enable CORS for local React development
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

UPLOAD_DIR = os.path.join(os.path.dirname(__file__), "uploads")
os.makedirs(UPLOAD_DIR, exist_ok=True)

# Mount static uploads directory for images
app.mount("/uploads", StaticFiles(directory=UPLOAD_DIR), name="uploads")


@app.get("/")
def home():
    return {
        "platform": "CIVISENSE Civic Intelligence Platform",
        "version": "2.0.0",
        "status": "online",
        "endpoints": [
            "/api/health",
            "/api/reports",
            "/api/report",
            "/api/analytics"
        ]
    }


@app.get("/api/health")
def health_check():
    api_key_set = bool(os.environ.get("GEMINI_API_KEY"))
    all_reports = db.get_all_reports()
    return {
        "status": "healthy",
        "service": "CIVISENSE Backend Engine",
        "reports_count": len(all_reports),
        "ai_engine": {
            "gemini_vision_enabled": api_key_set,
            "mode": "Gemini 1.5 Flash (Active)" if api_key_set else "Intelligent Civic Vision & Heuristics (Ready)",
            "fallback_active": True
        }
    }


@app.get("/api/reports")
def list_reports(
    status: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    department: Optional[str] = Query(None),
    search: Optional[str] = Query(None)
):
    reports = db.get_all_reports(
        status=status,
        category=category,
        department=department,
        search=search
    )
    return {
        "success": True,
        "count": len(reports),
        "reports": reports
    }


@app.get("/api/reports/{report_id}")
def get_single_report(report_id: str):
    report = db.get_report_by_id(report_id)
    if not report:
        raise HTTPException(status_code=404, detail=f"Report {report_id} not found")
    return {
        "success": True,
        "report": report
    }


@app.post("/api/report")
async def create_report(
    image: UploadFile = File(...),
    description: str = Form(...),
    location: Optional[str] = Form(None),
    latitude: Optional[float] = Form(None),
    longitude: Optional[float] = Form(None),
    reporter_name: Optional[str] = Form(None)
):
    # 1. Read uploaded image bytes
    image_bytes = await image.read()
    if not image_bytes:
        raise HTTPException(status_code=400, detail="Uploaded image is empty")

    # 2. Save image to disk with a clean unique filename
    ext = os.path.splitext(image.filename)[1] or ".jpg"
    unique_filename = f"{int(time.time())}_{uuid.uuid4().hex[:8]}{ext}"
    file_path = os.path.join(UPLOAD_DIR, unique_filename)
    
    with open(file_path, "wb") as f:
        f.write(image_bytes)
        
    image_url = f"/uploads/{unique_filename}"

    # 3. Determine Coordinates
    lat = latitude
    lng = longitude
    if lat is None or lng is None:
        parsed_lat, parsed_lng = geo_utils.parse_coordinates(location)
        if parsed_lat is not None and parsed_lng is not None:
            lat, lng = parsed_lat, parsed_lng
        else:
            # Default to Payyanur Town Coordinates for realistic simulation if coords missing
            lat, lng = 12.1032, 75.2023

    # Reverse geocode to get municipal ward & landmark
    formatted_location = geo_utils.reverse_geocode(lat, lng)
    if location and not location.replace(" ", "").replace(",", "").replace(".", "").replace("-", "").isdigit():
        # User provided an explicit text address
        formatted_location = f"{location.strip()} ({formatted_location})"

    # 4. Run Multimodal AI Civic Analysis
    mime_type = image.content_type or "image/jpeg"
    ai_result = await ai_engine.analyze_report(
        image_bytes=image_bytes,
        mime_type=mime_type,
        filename=image.filename,
        description=description,
        location_str=formatted_location
    )

    # 5. Spatial & Semantic Deduplication Check
    existing_reports = db.get_all_reports()
    is_duplicate, matching_id, dist_meters = geo_utils.check_duplicate(
        lat=lat,
        lng=lng,
        category=ai_result["category"],
        existing_reports=existing_reports,
        threshold_meters=85.0
    )

    if is_duplicate and matching_id:
        # Increment priority on existing report
        existing_report = db.upvote_report(matching_id)
        return {
            "success": True,
            "is_duplicate": True,
            "matching_report_id": matching_id,
            "distance_meters": dist_meters,
            "message": f"AI identified a matching {ai_result['category']} already reported {dist_meters}m away. We automatically added your verification to expedite resolution!",
            "report": existing_report,
            "ai_analysis": ai_result
        }

    # 6. Build New Civic Report
    new_report_data = {
        "title": f"{ai_result['category']} at {formatted_location.split(',')[0]}",
        "category": ai_result["category"],
        "description": description,
        "location": formatted_location,
        "latitude": lat,
        "longitude": lng,
        "status": "Reported",
        "urgency_tier": ai_result["urgency_tier"],
        "severity_score": ai_result["severity_score"],
        "civic_hazard_index": ai_result["civic_hazard_index"],
        "department": ai_result["department"],
        "department_code": ai_result["department_code"],
        "recommended_action": ai_result["recommended_action"],
        "sla_hours": ai_result["sla_hours"],
        "estimated_cost_inr": ai_result["estimated_cost_inr"],
        "safety_risk_summary": ai_result.get("safety_risk_summary", "Hazard verified by AI inspection."),
        "dispatched_team": None,
        "upvotes": 1,
        "verified_by_ai": True,
        "ai_model": ai_result.get("ai_model", "CIVISENSE Multimodal Engine"),
        "image_url": image_url,
        "reporter_name": reporter_name or "Civic Guardian",
        "timeline": [
            {"time": "Just now", "event": f"Reported with GPS ({lat:.4f}, {lng:.4f})"},
            {"time": "Just now", "event": f"AI Verified: {ai_result['detected_hazard']} (CHI: {ai_result['civic_hazard_index']})"},
            {"time": "Just now", "event": f"Auto-routed to {ai_result['department']}"}
        ]
    }

    created_report = db.add_report(new_report_data)

    return {
        "success": True,
        "is_duplicate": False,
        "message": f"Civic report verified by AI and assigned to {created_report['department_code']}.",
        "report": created_report,
        "ai_analysis": ai_result
    }


@app.post("/api/reports/{report_id}/upvote")
def upvote(report_id: str):
    report = db.upvote_report(report_id)
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
    return {
        "success": True,
        "message": "Community verification recorded (+10 Karma Points)!",
        "report": report
    }


@app.patch("/api/reports/{report_id}/status")
def change_status(
    report_id: str,
    payload: Dict[str, Any] = Body(...)
):
    new_status = payload.get("status")
    if not new_status:
        raise HTTPException(status_code=400, detail="Missing new status")
        
    dispatched_team = payload.get("dispatched_team")
    resolution_summary = payload.get("resolution_summary")

    report = db.update_report_status(
        report_id=report_id,
        new_status=new_status,
        dispatched_team=dispatched_team,
        resolution_summary=resolution_summary
    )
    if not report:
        raise HTTPException(status_code=404, detail="Report not found")
        
    return {
        "success": True,
        "message": f"Status updated to {new_status}",
        "report": report
    }


@app.get("/api/analytics")
def get_analytics():
    return {
        "success": True,
        "analytics": db.get_analytics()
    }