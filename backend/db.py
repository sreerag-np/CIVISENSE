import json
import os
import time
from datetime import datetime, timezone
from typing import List, Dict, Any, Optional

DB_FILE = os.path.join(os.path.dirname(__file__), "data", "reports.json")

SEED_REPORTS = [
    {
        "id": "CS-1041",
        "ticket_no": "CS-2026-1041",
        "title": "Severe Double Pothole on NH66 Service Lane",
        "category": "Pothole & Road Decay",
        "description": "Two deep potholes spanning 1.4 meters near Perumba bus stop. Causing severe traffic congestion and danger to two-wheelers.",
        "location": "Perumba Junction & NH 66, Ward 1 (Perumba), Payyanur",
        "latitude": 12.0915,
        "longitude": 75.2134,
        "status": "Dispatched",
        "urgency_tier": "High",
        "severity_score": 8.2,
        "civic_hazard_index": 84,
        "department": "Public Works Department (Roads & Infrastructure)",
        "department_code": "PWD-ROAD",
        "recommended_action": "Deploy cold-mix asphalt patch and safety cones",
        "sla_hours": 24,
        "estimated_cost_inr": 16500,
        "dispatched_team": "PWD Rapid Repair Unit #4",
        "created_at": "2026-09-10T10:15:00Z",
        "updated_at": "2026-09-10T14:30:00Z",
        "upvotes": 16,
        "verified_by_ai": True,
        "image_url": "/uploads/seed_pothole.svg",
        "timeline": [
            {"time": "10:15 AM", "event": "Reported by citizen with GPS coordinates"},
            {"time": "10:16 AM", "event": "AI Multimodal Inspector classified hazard (CHI: 84)"},
            {"time": "02:30 PM", "event": "Auto-routed and Dispatched to PWD Rapid Unit #4"}
        ]
    },
    {
        "id": "CS-1039",
        "ticket_no": "CS-2026-1039",
        "title": "Solid Waste Accumulation near Canal Walkway",
        "category": "Solid Waste & Illegal Dumping",
        "description": "Unattended municipal plastic garbage and commercial cartons piling up along the canal walkway for 4 days.",
        "location": "Annur Bridge & Canal Walk, Ward 4 (Annur), Payyanur",
        "latitude": 12.1150,
        "longitude": 75.2190,
        "status": "Reported",
        "urgency_tier": "Moderate",
        "severity_score": 6.4,
        "civic_hazard_index": 62,
        "department": "Municipal Health & Sanitation Division",
        "department_code": "MUN-SNT",
        "recommended_action": "Dispatch hydraulic waste compactor truck & disinfectant",
        "sla_hours": 36,
        "estimated_cost_inr": 6800,
        "dispatched_team": None,
        "created_at": "2026-09-10T13:45:00Z",
        "updated_at": "2026-09-10T13:46:00Z",
        "upvotes": 8,
        "verified_by_ai": True,
        "image_url": "/uploads/seed_garbage.svg",
        "timeline": [
            {"time": "01:45 PM", "event": "Reported by resident"},
            {"time": "01:46 PM", "event": "AI Civic Vision confirmed waste cluster"}
        ]
    },
    {
        "id": "CS-1035",
        "ticket_no": "CS-2026-1035",
        "title": "Streetlight Grid Failure on Railway Station Road",
        "category": "Streetlight Malfunction & Darkness",
        "description": "4 consecutive LED streetlights are out, leaving a 200m stretch completely pitch dark for evening train passengers.",
        "location": "Payyanur Railway Station Road, Ward 15 (Station Area), Payyanur",
        "latitude": 12.1078,
        "longitude": 75.1925,
        "status": "Triaged",
        "urgency_tier": "High",
        "severity_score": 7.5,
        "civic_hazard_index": 73,
        "department": "Electricity & Public Lighting Cell (KSEB / Municipal)",
        "department_code": "ELEC-LGT",
        "recommended_action": "Replace blown 60W LED fixtures and test underground cabling",
        "sla_hours": 24,
        "estimated_cost_inr": 8400,
        "dispatched_team": None,
        "created_at": "2026-09-09T18:20:00Z",
        "updated_at": "2026-09-09T19:00:00Z",
        "upvotes": 22,
        "verified_by_ai": True,
        "image_url": "/uploads/seed_streetlight.svg",
        "timeline": [
            {"time": "06:20 PM", "event": "Reported by commuter"},
            {"time": "07:00 PM", "event": "Municipal Lighting Engineer queued work ticket"}
        ]
    },
    {
        "id": "CS-1028",
        "ticket_no": "CS-2026-1028",
        "title": "Major Drinking Water Main Pipe Fracture",
        "category": "Water Pipeline Burst & Flooding",
        "description": "High pressure 150mm cast iron potable water supply line burst. Water flooding market entrance, severe loss of drinking water.",
        "location": "Old Bus Stand & Municipal Market, Ward 12 (Town Center), Payyanur",
        "latitude": 12.1032,
        "longitude": 75.2023,
        "status": "Dispatched",
        "urgency_tier": "Critical",
        "severity_score": 9.0,
        "civic_hazard_index": 92,
        "department": "Kerala Water Authority (KWA) / Municipal Water Supply",
        "department_code": "KWA-PIPE",
        "recommended_action": "Emergency isolation valve shutdown & pipe sleeve replacement",
        "sla_hours": 12,
        "estimated_cost_inr": 34000,
        "dispatched_team": "KWA Emergency Pipeline Squad #1",
        "created_at": "2026-09-10T08:30:00Z",
        "updated_at": "2026-09-10T09:15:00Z",
        "upvotes": 34,
        "verified_by_ai": True,
        "image_url": "/uploads/seed_water.svg",
        "timeline": [
            {"time": "08:30 AM", "event": "Reported with photos of active gush"},
            {"time": "08:31 AM", "event": "AI prioritized as Critical Hazard (CHI: 92)"},
            {"time": "09:15 AM", "event": "Emergency valve closed, excavation team dispatched"}
        ]
    },
    {
        "id": "CS-1022",
        "ticket_no": "CS-2026-1022",
        "title": "Missing Heavy Drain Slab on School Walkway",
        "category": "Open Drain & Missing Manhole Slab",
        "description": "Open 5-foot deep stormwater drain right outside school gate. High danger to schoolchildren during morning hours.",
        "location": "Keloth High School Road, Ward 8 (Keloth), Payyanur",
        "latitude": 12.1095,
        "longitude": 75.2081,
        "status": "Resolved",
        "urgency_tier": "Critical",
        "severity_score": 9.5,
        "civic_hazard_index": 96,
        "department": "Stormwater Drainage & Sewerage Board",
        "department_code": "DRN-SEW",
        "recommended_action": "Install reinforced precast concrete slab (600x600mm)",
        "sla_hours": 8,
        "estimated_cost_inr": 9200,
        "dispatched_team": "Ward 8 Drainage Maintenance Crew",
        "created_at": "2026-09-08T09:00:00Z",
        "updated_at": "2026-09-08T15:30:00Z",
        "resolved_at": "2026-09-08T15:30:00Z",
        "resolution_summary": "Replaced with reinforced concrete cover slab and sealed with cement mortar. Road cleared.",
        "upvotes": 41,
        "verified_by_ai": True,
        "image_url": "/uploads/seed_drain.svg",
        "timeline": [
            {"time": "09:00 AM", "event": "Reported by school PTA president"},
            {"time": "09:02 AM", "event": "Immediate Critical Escalation via AI (CHI: 96)"},
            {"time": "11:00 AM", "event": "Barricades placed & replacement slab ordered"},
            {"time": "03:30 PM", "event": "Slab installed & verified resolved by field officer"}
        ]
    }
]

def load_reports() -> List[Dict[str, Any]]:
    """Load reports from JSON database or seed if not exists."""
    if not os.path.exists(DB_FILE):
        save_reports(SEED_REPORTS)
        return SEED_REPORTS
    try:
        with open(DB_FILE, "r", encoding="utf-8") as f:
            data = json.load(f)
            return data
    except Exception as e:
        print("Error reading database file, returning seed reports:", e)
        return SEED_REPORTS

def save_reports(reports: List[Dict[str, Any]]) -> None:
    """Save reports list to JSON database."""
    os.makedirs(os.path.dirname(DB_FILE), exist_ok=True)
    with open(DB_FILE, "w", encoding="utf-8") as f:
        json.dump(reports, f, indent=2, ensure_ascii=False)

def get_all_reports(
    status: Optional[str] = None,
    category: Optional[str] = None,
    department: Optional[str] = None,
    search: Optional[str] = None
) -> List[Dict[str, Any]]:
    reports = load_reports()
    
    if status and status != "All":
        reports = [r for r in reports if r.get("status", "").lower() == status.lower()]
        
    if category and category != "All":
        reports = [r for r in reports if category.lower() in r.get("category", "").lower()]
        
    if department and department != "All":
        reports = [r for r in reports if department.lower() in r.get("department", "").lower()]
        
    if search:
        s = search.lower()
        reports = [
            r for r in reports
            if s in r.get("title", "").lower() or
               s in r.get("description", "").lower() or
               s in r.get("location", "").lower() or
               s in r.get("id", "").lower()
        ]
        
    # Sort with active critical/high first, then latest
    return sorted(
        reports,
        key=lambda x: (x.get("status") == "Resolved", -x.get("civic_hazard_index", 0), x.get("created_at", "")),
        reverse=False
    )

def get_report_by_id(report_id: str) -> Optional[Dict[str, Any]]:
    reports = load_reports()
    for r in reports:
        if r.get("id") == report_id or r.get("ticket_no") == report_id:
            return r
    return None

def add_report(report_data: Dict[str, Any]) -> Dict[str, Any]:
    reports = load_reports()
    
    # Generate ID
    count = len(reports) + 1042
    report_id = f"CS-{count}"
    report_data["id"] = report_id
    report_data["ticket_no"] = f"CS-2026-{count}"
    
    if "created_at" not in report_data:
        report_data["created_at"] = datetime.now(timezone.utc).isoformat()
    if "updated_at" not in report_data:
        report_data["updated_at"] = report_data["created_at"]
    if "upvotes" not in report_data:
        report_data["upvotes"] = 1
    if "status" not in report_data:
        report_data["status"] = "Reported"
        
    if "timeline" not in report_data:
        report_data["timeline"] = [
            {"time": "Just now", "event": "Civic report submitted with AI verification"}
        ]
        
    reports.insert(0, report_data)
    save_reports(reports)
    return report_data

def upvote_report(report_id: str) -> Optional[Dict[str, Any]]:
    reports = load_reports()
    for r in reports:
        if r.get("id") == report_id or r.get("ticket_no") == report_id:
            r["upvotes"] = r.get("upvotes", 0) + 1
            # Add verification bump to timeline if multiple citizens verify
            if r["upvotes"] % 5 == 0:
                r["timeline"].append({
                    "time": "Just now",
                    "event": f"Community Escalation: {r['upvotes']} citizens verified this hazard"
                })
            save_reports(reports)
            return r
    return None

def update_report_status(
    report_id: str,
    new_status: str,
    dispatched_team: Optional[str] = None,
    resolution_summary: Optional[str] = None
) -> Optional[Dict[str, Any]]:
    reports = load_reports()
    for r in reports:
        if r.get("id") == report_id or r.get("ticket_no") == report_id:
            r["status"] = new_status
            r["updated_at"] = datetime.now(timezone.utc).isoformat()
            
            if dispatched_team:
                r["dispatched_team"] = dispatched_team
                r["timeline"].append({
                    "time": "Just now",
                    "event": f"Official Dispatch: Assigned to {dispatched_team}"
                })
            elif new_status == "Resolved":
                r["resolved_at"] = r["updated_at"]
                r["resolution_summary"] = resolution_summary or "Issue inspected, repaired, and signed off by municipal team."
                r["timeline"].append({
                    "time": "Just now",
                    "event": f"Resolved: {r['resolution_summary']}"
                })
            else:
                r["timeline"].append({
                    "time": "Just now",
                    "event": f"Status changed to {new_status}"
                })
                
            save_reports(reports)
            return r
    return None

def get_analytics() -> Dict[str, Any]:
    reports = load_reports()
    total = len(reports)
    resolved = sum(1 for r in reports if r.get("status") == "Resolved")
    dispatched = sum(1 for r in reports if r.get("status") == "Dispatched")
    triaged = sum(1 for r in reports if r.get("status") == "Triaged")
    reported = sum(1 for r in reports if r.get("status") == "Reported")
    
    critical_active = sum(
        1 for r in reports 
        if r.get("status") != "Resolved" and r.get("urgency_tier") == "Critical"
    )
    
    # Department breakdown
    dept_counts = {}
    for r in reports:
        dept = r.get("department_code") or "OTHER"
        dept_counts[dept] = dept_counts.get(dept, 0) + 1
        
    avg_chi = round(sum(r.get("civic_hazard_index", 50) for r in reports) / max(1, total), 1)
    
    return {
        "total_reports": total,
        "resolved_count": resolved,
        "dispatched_count": dispatched,
        "triaged_count": triaged,
        "pending_count": reported,
        "critical_active": critical_active,
        "resolution_rate_pct": round((resolved / max(1, total)) * 100, 1),
        "average_chi": avg_chi,
        "average_sla_hours": 18.5,
        "sla_compliance_pct": 94.2,
        "department_breakdown": dept_counts,
        "community_upvotes_total": sum(r.get("upvotes", 0) for r in reports)
    }
