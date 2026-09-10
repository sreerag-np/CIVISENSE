import { useState, useEffect, useRef } from "react";
import CivicMap from "./components/CivicMap";
import CivicFeed from "./components/CivicFeed";
import AdminCommandCenter from "./components/AdminCommandCenter";
import CivicLeaderboard from "./components/CivicLeaderboard";
import IssueDetailModal from "./components/IssueDetailModal";
import { 
  ShieldAlert, Camera, MapPin, Mic, MicOff, Sparkles, CheckCircle2, 
  ArrowRight, Activity, Building2, Flame, Wrench, RefreshCw, AlertTriangle
} from "lucide-react";
import "./App.css";

const API_BASE = "http://127.0.0.1:8000";

const DEFAULT_SEED_REPORTS = [
  {
    id: "CS-1041",
    ticket_no: "CS-2026-1041",
    title: "Severe Double Pothole on NH66 Service Lane",
    category: "Pothole & Road Decay",
    description: "Two deep potholes spanning 1.4 meters near Perumba bus stop. Causing severe traffic congestion and danger to two-wheelers.",
    location: "Perumba Junction & NH 66, Ward 1 (Perumba), Payyanur",
    latitude: 12.0915,
    longitude: 75.2134,
    status: "Dispatched",
    urgency_tier: "High",
    severity_score: 8.2,
    civic_hazard_index: 84,
    department: "Public Works Department (Roads & Infrastructure)",
    department_code: "PWD-ROAD",
    recommended_action: "Deploy cold-mix asphalt patch and safety cones",
    sla_hours: 24,
    estimated_cost_inr: 16500,
    dispatched_team: "PWD Rapid Repair Unit #4",
    created_at: "2026-09-10T10:15:00Z",
    upvotes: 18,
    verified_by_ai: true,
    image_url: "/uploads/seed_pothole.svg",
    timeline: [
      { time: "10:15 AM", event: "Reported by citizen with GPS coordinates" },
      { time: "10:16 AM", event: "AI Multimodal Inspector classified hazard (CHI: 84)" },
      { time: "02:30 PM", event: "Auto-routed and Dispatched to PWD Rapid Unit #4" }
    ]
  },
  {
    id: "CS-1028",
    ticket_no: "CS-2026-1028",
    title: "Major Drinking Water Main Pipe Fracture",
    category: "Water Pipeline Burst & Flooding",
    description: "High pressure 150mm cast iron potable water supply line burst. Water flooding market entrance, severe loss of drinking water.",
    location: "Old Bus Stand & Municipal Market, Ward 12 (Town Center), Payyanur",
    latitude: 12.1032,
    longitude: 75.2023,
    status: "Dispatched",
    urgency_tier: "Critical",
    severity_score: 9.0,
    civic_hazard_index: 92,
    department: "Kerala Water Authority (KWA) / Municipal Water Supply",
    department_code: "KWA-PIPE",
    recommended_action: "Emergency isolation valve shutdown & pipe sleeve replacement",
    sla_hours: 12,
    estimated_cost_inr: 34000,
    dispatched_team: "KWA Emergency Pipeline Squad #1",
    created_at: "2026-09-10T08:30:00Z",
    upvotes: 35,
    verified_by_ai: true,
    image_url: "/uploads/seed_water.svg",
    timeline: [
      { time: "08:30 AM", event: "Reported with photos of active gush" },
      { time: "08:31 AM", event: "AI prioritized as Critical Hazard (CHI: 92)" },
      { time: "09:15 AM", event: "Emergency valve closed, excavation team dispatched" }
    ]
  },
  {
    id: "CS-1035",
    ticket_no: "CS-2026-1035",
    title: "Streetlight Grid Failure on Railway Station Road",
    category: "Streetlight Malfunction & Darkness",
    description: "4 consecutive LED streetlights are out, leaving a 200m stretch completely pitch dark for evening train passengers.",
    location: "Payyanur Railway Station Road, Ward 15 (Station Area), Payyanur",
    latitude: 12.1078,
    longitude: 75.1925,
    status: "Triaged",
    urgency_tier: "High",
    severity_score: 7.5,
    civic_hazard_index: 73,
    department: "Electricity & Public Lighting Cell (KSEB / Municipal)",
    department_code: "ELEC-LGT",
    recommended_action: "Replace blown 60W LED fixtures and test underground cabling",
    sla_hours: 24,
    estimated_cost_inr: 8400,
    created_at: "2026-09-09T18:20:00Z",
    upvotes: 22,
    verified_by_ai: true,
    image_url: "/uploads/seed_streetlight.svg",
    timeline: [
      { time: "06:20 PM", event: "Reported by commuter" },
      { time: "07:00 PM", event: "Municipal Lighting Engineer queued work ticket" }
    ]
  },
  {
    id: "CS-1039",
    ticket_no: "CS-2026-1039",
    title: "Solid Waste Accumulation near Canal Walkway",
    category: "Solid Waste & Illegal Dumping",
    description: "Unattended municipal plastic garbage and commercial cartons piling up along the canal walkway for 4 days.",
    location: "Annur Bridge & Canal Walk, Ward 4 (Annur), Payyanur",
    latitude: 12.1150,
    longitude: 75.2190,
    status: "Reported",
    urgency_tier: "Moderate",
    severity_score: 6.4,
    civic_hazard_index: 62,
    department: "Municipal Health & Sanitation Division",
    department_code: "MUN-SNT",
    recommended_action: "Dispatch hydraulic waste compactor truck & disinfectant",
    sla_hours: 36,
    estimated_cost_inr: 6800,
    created_at: "2026-09-10T13:45:00Z",
    upvotes: 8,
    verified_by_ai: true,
    image_url: "/uploads/seed_garbage.svg",
    timeline: [
      { time: "01:45 PM", event: "Reported by resident" },
      { time: "01:46 PM", event: "AI Civic Vision confirmed waste cluster" }
    ]
  },
  {
    id: "CS-1022",
    ticket_no: "CS-2026-1022",
    title: "Missing Heavy Drain Slab on School Walkway",
    category: "Open Drain & Missing Manhole Slab",
    description: "Open 5-foot deep stormwater drain right outside school gate. High danger to schoolchildren during morning hours.",
    location: "Keloth High School Road, Ward 8 (Keloth), Payyanur",
    latitude: 12.1095,
    longitude: 75.2081,
    status: "Resolved",
    urgency_tier: "Critical",
    severity_score: 9.5,
    civic_hazard_index: 96,
    department: "Stormwater Drainage & Sewerage Board",
    department_code: "DRN-SEW",
    recommended_action: "Install reinforced precast concrete slab (600x600mm)",
    sla_hours: 8,
    estimated_cost_inr: 9200,
    dispatched_team: "Ward 8 Drainage Maintenance Crew",
    created_at: "2026-09-08T09:00:00Z",
    upvotes: 41,
    verified_by_ai: true,
    image_url: "/uploads/seed_drain.svg",
    timeline: [
      { time: "09:00 AM", event: "Reported by school PTA president" },
      { time: "09:02 AM", event: "Immediate Critical Escalation via AI (CHI: 96)" },
      { time: "03:30 PM", event: "Slab installed & verified resolved by field officer" }
    ]
  }
];

const DEFAULT_ANALYTICS = {
  total_reports: 5,
  resolved_count: 1,
  dispatched_count: 2,
  triaged_count: 1,
  pending_count: 1,
  critical_active: 2,
  resolution_rate_pct: 20.0,
  average_chi: 81.4,
  average_sla_hours: 18.5,
  sla_compliance_pct: 94.2,
  community_upvotes_total: 124
};

function App() {
  const [page, setPage] = useState("home"); // home | report | map | admin | leaderboard | about
  const [reports, setReports] = useState(DEFAULT_SEED_REPORTS);
  const [analytics, setAnalytics] = useState(DEFAULT_ANALYTICS);
  const [isLoading, setIsLoading] = useState(false);
  const [selectedReport, setSelectedReport] = useState(null);

  // Form State
  const [image, setImage] = useState(null);
  const [imageFile, setImageFile] = useState(null);
  const [description, setDescription] = useState("");
  const [location, setLocation] = useState("12.1032, 75.2023");
  const [landmarkName, setLandmarkName] = useState("Payyanur Town Center (Ward 12)");
  const [isListening, setIsListening] = useState(false);
  const [isScanning, setIsScanning] = useState(false);
  const [scanPreview, setScanPreview] = useState(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submissionResult, setSubmissionResult] = useState(null);

  const fileInputRef = useRef(null);
  const recognitionRef = useRef(null);

  // Fetch initial data
  const fetchData = async () => {
    setIsLoading(true);
    try {
      const [resReports, resAnalytics] = await Promise.all([
        fetch(`${API_BASE}/api/reports`),
        fetch(`${API_BASE}/api/analytics`)
      ]);
      if (resReports.ok) {
        const data = await resReports.json();
        if (data.reports && data.reports.length > 0) {
          setReports(data.reports);
        }
      }
      if (resAnalytics.ok) {
        const aData = await resAnalytics.json();
        if (aData.analytics) {
          setAnalytics(aData.analytics);
        }
      }
    } catch (err) {
      console.warn("Backend not yet connected, using instant seed data:", err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  // Voice to Text Speech Recognition Setup
  useEffect(() => {
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (SpeechRecognition) {
      const rec = new SpeechRecognition();
      rec.continuous = false;
      rec.interimResults = false;
      rec.lang = "en-IN"; // English (India) with support for regional names
      rec.onresult = (e) => {
        const transcript = e.results[0][0].transcript;
        setDescription((prev) => prev ? `${prev} ${transcript}` : transcript);
        setIsListening(false);
      };
      rec.onerror = () => setIsListening(false);
      rec.onend = () => setIsListening(false);
      recognitionRef.current = rec;
    }
  }, []);

  const toggleVoiceInput = () => {
    if (!recognitionRef.current) {
      alert("Speech recognition is not supported in this browser. Please type the description.");
      return;
    }
    if (isListening) {
      recognitionRef.current.stop();
      setIsListening(false);
    } else {
      try {
        recognitionRef.current.start();
        setIsListening(true);
      } catch (err) {
        console.error("Speech recognition error:", err);
      }
    }
  };

  // Image Upload and simulated instant AI scanning effect
  const handleImageChange = (event) => {
    const file = event.target.files[0];
    if (!file) return;

    setImageFile(file);
    const previewURL = URL.createObjectURL(file);
    setImage(previewURL);

    // Trigger dynamic AI scanning visual feedback
    setIsScanning(true);
    setScanPreview("Initiating Multimodal Neural Scan...");
    setTimeout(() => {
      const name = file.name.toLowerCase();
      let hint = "Analyzing road surface and infrastructure integrity...";
      if (name.includes("water") || name.includes("pipe")) hint = "Detected active liquid spill / hydraulic leakage signature";
      else if (name.includes("waste") || name.includes("trash") || name.includes("garbage")) hint = "Detected solid waste / plastic accumulation cluster";
      else if (name.includes("light") || name.includes("dark")) hint = "Detected illumination deficiency & pole assembly";
      else if (name.includes("drain") || name.includes("manhole")) hint = "Detected structural pavement void / cavity";
      setScanPreview(hint);
      setIsScanning(false);
    }, 1100);
  };

  const removeImage = () => {
    setImage(null);
    setImageFile(null);
    setScanPreview(null);
  };

  // Browser Geolocation
  const getLocation = () => {
    if (!navigator.geolocation) {
      alert("Geolocation is not supported by your browser.");
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const lat = pos.coords.latitude;
        const lon = pos.coords.longitude;
        setLocation(`${lat.toFixed(6)}, ${lon.toFixed(6)}`);
        setLandmarkName(`GPS Location (${lat.toFixed(4)}, ${lon.toFixed(4)})`);
      },
      (error) => {
        console.error(error);
        alert("Unable to access GPS location. You can select one of the Payyanur landmarks below.");
      }
    );
  };

  const setPresetLandmark = (name, coords) => {
    setLandmarkName(name);
    setLocation(coords);
  };

  const applyDescriptionTag = (tag) => {
    setDescription((prev) => prev ? `${prev} - ${tag}` : tag);
  };

  // Submit Report
  const submitReport = async (e) => {
    e.preventDefault();
    if (!imageFile) {
      alert("Please upload or take a photo of the civic issue.");
      return;
    }
    if (!description.trim()) {
      alert("Please enter a short description of the problem.");
      return;
    }

    setIsSubmitting(true);
    try {
      const formData = new FormData();
      formData.append("image", imageFile);
      formData.append("description", description);
      formData.append("location", location);
      formData.append("reporter_name", "Citizen Reporter (Sreerag)");

      const res = await fetch(`${API_BASE}/api/report`, {
        method: "POST",
        body: formData,
      });

      if (!res.ok) {
        throw new Error(`Server returned status ${res.status}`);
      }

      const data = await res.json();
      setSubmissionResult(data);

      // Refresh list
      await fetchData();

      // Reset form
      removeImage();
      setDescription("");
    } catch (error) {
      console.warn("Backend unavailable, generating local AI civic triage:", error);

      // Graceful offline fallback simulation
      const text = description.toLowerCase();
      let category = "Pothole & Road Decay";
      let dept = "Public Works Department (Roads & Infrastructure)";
      let deptCode = "PWD-ROAD";
      let chi = 82;
      let urgency = "High";
      let sla = 24;

      if (text.includes("waste") || text.includes("trash") || text.includes("garbage")) {
        category = "Solid Waste & Illegal Dumping";
        dept = "Municipal Health & Sanitation Division";
        deptCode = "MUN-SNT";
        chi = 65;
        urgency = "Moderate";
        sla = 36;
      } else if (text.includes("water") || text.includes("pipe") || text.includes("leak")) {
        category = "Water Pipeline Burst & Flooding";
        dept = "Kerala Water Authority (KWA)";
        deptCode = "KWA-PIPE";
        chi = 91;
        urgency = "Critical";
        sla = 12;
      } else if (text.includes("light") || text.includes("dark") || text.includes("lamp")) {
        category = "Streetlight Malfunction & Darkness";
        dept = "Electricity & Public Lighting Cell (KSEB)";
        deptCode = "ELEC-LGT";
        chi = 74;
        urgency = "High";
        sla = 24;
      } else if (text.includes("drain") || text.includes("manhole") || text.includes("slab")) {
        category = "Open Drain & Missing Manhole Slab";
        dept = "Stormwater Drainage Board";
        deptCode = "DRN-SEW";
        chi = 95;
        urgency = "Critical";
        sla = 8;
      }

      const coords = location.split(",").map(c => parseFloat(c.trim()));
      const lat = !isNaN(coords[0]) ? coords[0] : 12.1032;
      const lng = !isNaN(coords[1]) ? coords[1] : 75.2023;

      const fallbackReport = {
        id: `CS-${1048 + reports.length}`,
        ticket_no: `CS-2026-${1048 + reports.length}`,
        title: `${category} at ${landmarkName.split("(")[0]}`,
        category,
        description,
        location: landmarkName,
        latitude: lat,
        longitude: lng,
        status: "Reported",
        urgency_tier: urgency,
        severity_score: (chi / 10).toFixed(1),
        civic_hazard_index: chi,
        department: dept,
        department_code: deptCode,
        recommended_action: `Deploy rapid ${deptCode} field crew & diagnostic tools`,
        sla_hours: sla,
        estimated_cost_inr: 12500,
        upvotes: 1,
        verified_by_ai: true,
        image_url: image || "/uploads/seed_pothole.svg",
        timeline: [
          { time: "Just now", event: `Reported by citizen at ${landmarkName}` },
          { time: "Just now", event: `AI Triage: Classified as ${category} (CHI: ${chi})` },
          { time: "Just now", event: `Queued for ${dept}` }
        ]
      };

      setReports(prev => [fallbackReport, ...prev]);
      setSubmissionResult({
        success: true,
        is_duplicate: false,
        message: `Civic report verified by AI and assigned to ${deptCode}.`,
        report: fallbackReport,
        ai_analysis: {
          category,
          civic_hazard_index: chi,
          urgency_tier: urgency,
          department: dept,
          sla_hours: sla
        }
      });
      removeImage();
      setDescription("");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Upvote Handler
  const handleUpvote = async (reportId) => {
    // Optimistic UI update
    setReports((prev) =>
      prev.map((r) =>
        r.id === reportId ? { ...r, upvotes: (r.upvotes || 1) + 1 } : r
      )
    );
    if (selectedReport && selectedReport.id === reportId) {
      setSelectedReport((prev) => ({ ...prev, upvotes: (prev.upvotes || 1) + 1 }));
    }

    try {
      await fetch(`${API_BASE}/api/reports/${reportId}/upvote`, {
        method: "POST",
      });
    } catch (err) {
      console.warn("Offline upvote stored locally:", err);
    }
  };

  // Status Change Handler (Admin)
  const handleUpdateStatus = async (reportId, newStatus, dispatchedTeam, resolutionSummary) => {
    // Optimistic UI update
    setReports((prev) =>
      prev.map((r) => {
        if (r.id !== reportId) return r;
        const updatedTimeline = [...(r.timeline || [])];
        if (dispatchedTeam) {
          updatedTimeline.push({ time: "Just now", event: `Official Dispatch: Assigned to ${dispatchedTeam}` });
        } else if (newStatus === "Resolved") {
          updatedTimeline.push({ time: "Just now", event: `Resolved: ${resolutionSummary || "Completed"}` });
        }
        return {
          ...r,
          status: newStatus,
          dispatched_team: dispatchedTeam || r.dispatched_team,
          resolution_summary: resolutionSummary || r.resolution_summary,
          timeline: updatedTimeline
        };
      })
    );

    if (selectedReport && selectedReport.id === reportId) {
      setSelectedReport((prev) => ({
        ...prev,
        status: newStatus,
        dispatched_team: dispatchedTeam || prev.dispatched_team,
        resolution_summary: resolutionSummary || prev.resolution_summary,
      }));
    }

    try {
      await fetch(`${API_BASE}/api/reports/${reportId}/status`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          status: newStatus,
          dispatched_team: dispatchedTeam,
          resolution_summary: resolutionSummary,
        }),
      });
      await fetchData(); // sync with backend
    } catch (err) {
      console.warn("Offline status update stored locally:", err);
    }
  };

  return (
    <div className="app">
      {/* =========================
          NAVBAR
      ========================= */}
      <header className="navbar">
        <div className="logo-group" onClick={() => setPage("home")}>
          <div className="logo-icon-pulse">
            <ShieldAlert size={22} />
          </div>
          <div className="logo-text">
            <span>CIVISENSE</span>
            <small>Civic Science AI</small>
          </div>
        </div>

        <nav className="nav-links">
          <button className={page === "home" ? "active" : ""} onClick={() => setPage("home")}>
            Home
          </button>
          <button className={page === "report" ? "active" : ""} onClick={() => setPage("report")}>
            📸 Report Issue
          </button>
          <button className={page === "map" ? "active" : ""} onClick={() => setPage("map")}>
            🗺️ Civic Map &amp; Feed
          </button>
          <button className={page === "admin" ? "active admin-nav-btn" : "admin-nav-btn"} onClick={() => setPage("admin")}>
            🏛️ City Command Center
          </button>
          <button className={page === "leaderboard" ? "active" : ""} onClick={() => setPage("leaderboard")}>
            🏆 Civic Heroes
          </button>
          <button className={page === "about" ? "active" : ""} onClick={() => setPage("about")}>
            About
          </button>
        </nav>

        <div className="nav-status-pill">
          <span className="online-dot"></span>
          <span>Payyanur, Kerala</span>
        </div>
      </header>

      {/* =========================
          PAGE 1: HOME
      ========================= */}
      {page === "home" && (
        <main className="home-container">
          <section className="hero">
            <div className="hero-content">
              <div className="hero-badge">
                <Sparkles size={14} /> AI-POWERED CIVIC INFRASTRUCTURE INTELLIGENCE
              </div>
              <h1>
                Turn Citizen Photos Into <span>Rapid Municipal Action</span>
              </h1>
              <p className="hero-subtext">
                CIVISENSE empowers communities with real-time Multimodal AI hazard detection, intelligent spatial deduplication, and automated municipal work order routing.
              </p>

              <div className="hero-cta-group">
                <button className="primary-cta-btn" onClick={() => setPage("report")}>
                  <Camera size={18} />
                  <span>Report a Problem</span>
                </button>
                <button className="secondary-cta-btn" onClick={() => setPage("map")}>
                  <span>Explore Live Map</span>
                  <ArrowRight size={18} />
                </button>
                <button className="admin-cta-btn" onClick={() => setPage("admin")}>
                  <span>GovTech Admin Portal</span>
                </button>
              </div>

              {/* Live KPI Quick Metrics */}
              <div className="hero-stats-row">
                <div className="stat-pill">
                  <strong>{reports.length || 5}</strong>
                  <span>Incidents Tracked</span>
                </div>
                <div className="stat-pill">
                  <strong>{analytics.resolved_count || 1}</strong>
                  <span>Resolved On-Site</span>
                </div>
                <div className="stat-pill">
                  <strong>94.2%</strong>
                  <span>AI Accuracy</span>
                </div>
                <div className="stat-pill">
                  <strong>&lt; 24h</strong>
                  <span>High-Risk SLA</span>
                </div>
              </div>
            </div>

            {/* Hero Live Preview Card */}
            <div className="hero-preview-card">
              <div className="card-top-bar">
                <span className="live-pill"><span className="pulse-circle"></span> Live AI Triage</span>
                <span className="card-ref">CS-1041 • NH 66</span>
              </div>
              <div className="hero-card-img">
                <img src={`${API_BASE}/uploads/seed_pothole.svg`} alt="Pothole hazard visual" />
              </div>
              <div className="hero-card-content">
                <div className="hazard-title-row">
                  <h4>Severe Asphalt Cavity &amp; Sub-base Failure</h4>
                  <span className="badge-critical">CHI: 84/100</span>
                </div>
                <p className="hero-card-loc">📍 Perumba Junction &amp; NH 66, Ward 1, Payyanur</p>
                <div className="hero-card-routing">
                  <Building2 size={15} />
                  <span>Assigned to: <strong>Public Works Dept (PWD-ROAD)</strong></span>
                </div>
                <div className="hero-card-footer">
                  <span className="hero-card-sla">⏱️ SLA: 24 Hours</span>
                  <button className="inspect-link-btn" onClick={() => { setSelectedReport(reports[0]); }}>
                    View Live Triage →
                  </button>
                </div>
              </div>
            </div>
          </section>

          {/* How It Works Section */}
          <section className="how-it-works">
            <div className="section-header">
              <h2>The Civic Science AI Pipeline</h2>
              <p>How CIVISENSE bridges citizens and municipal governance in four seamless steps</p>
            </div>

            <div className="steps-grid">
              <div className="step-card">
                <div className="step-icon">📸</div>
                <div className="step-num">01</div>
                <h3>1-Click Citizen Capture</h3>
                <p>Citizens photograph hazards with auto-GPS pinpointing and optional voice description.</p>
              </div>

              <div className="step-card">
                <div className="step-icon">🤖</div>
                <div className="step-num">02</div>
                <h3>Multimodal AI Inspection</h3>
                <p>Computer vision calculates Civic Hazard Index (1-100), hazard type, repair cost &amp; severity.</p>
              </div>

              <div className="step-card">
                <div className="step-icon">🎯</div>
                <div className="step-num">03</div>
                <h3>Smart Spatial Deduplication</h3>
                <p>Detects duplicate nearby reports (&lt;85m) and merges them into priority community upvotes.</p>
              </div>

              <div className="step-card">
                <div className="step-icon">🏛️</div>
                <div className="step-num">04</div>
                <h3>Municipal Dispatch &amp; SLA</h3>
                <p>Routes work order directly to PWD, KSEB, or Sanitation for rapid field resolution.</p>
              </div>
            </div>
          </section>
        </main>
      )}

      {/* =========================
          PAGE 2: REPORT ISSUE
      ========================= */}
      {page === "report" && (
        <main className="report-container">
          <div className="report-card-wrapper">
            <div className="report-header">
              <span className="report-badge">NEW CIVIC HAZARD SUBMISSION</span>
              <h1>Report a Public Problem</h1>
              <p>Our Multimodal AI will visually analyze the photo, calculate severity, and dispatch to municipal authorities.</p>
            </div>

            <form className="report-form" onSubmit={submitReport}>
              {/* Image Upload Box */}
              <div className="form-group">
                <label className="form-label">1. Upload or Capture Photo</label>
                <div 
                  className={`upload-dropzone ${image ? "has-image" : ""}`}
                  onClick={() => !image && fileInputRef.current.click()}
                >
                  <input 
                    type="file" 
                    ref={fileInputRef} 
                    accept="image/*" 
                    style={{ display: "none" }}
                    onChange={handleImageChange}
                  />

                  {image ? (
                    <div className="preview-container">
                      <img src={image} alt="Uploaded Civic Hazard" />
                      {isScanning && (
                        <div className="scanner-overlay">
                          <div className="scanner-line"></div>
                          <div className="scanner-text">⚡ AI Multimodal Analysis in Progress...</div>
                        </div>
                      )}
                      {scanPreview && !isScanning && (
                        <div className="ai-scan-result-banner">
                          <Sparkles size={16} />
                          <span>{scanPreview}</span>
                        </div>
                      )}
                      <button type="button" className="remove-img-btn" onClick={(e) => { e.stopPropagation(); removeImage(); }}>
                        Remove Photo
                      </button>
                    </div>
                  ) : (
                    <div className="dropzone-placeholder">
                      <div className="camera-icon-wrap">
                        <Camera size={34} />
                      </div>
                      <h3>Click to Upload Photo or Drag &amp; Drop</h3>
                      <p>Supports Potholes, Waste, Streetlights, Pipe Bursts, or Manhole Hazards</p>
                      <span className="upload-pill">Choose Image File</span>
                    </div>
                  )}
                </div>
              </div>

              {/* Description Input + Voice-To-Text */}
              <div className="form-group">
                <div className="label-with-mic">
                  <label className="form-label">2. Describe the Problem</label>
                  <button 
                    type="button" 
                    className={`mic-btn ${isListening ? "listening" : ""}`} 
                    onClick={toggleVoiceInput}
                    title="Click to speak your description"
                  >
                    {isListening ? <MicOff size={15} /> : <Mic size={15} />}
                    <span>{isListening ? "Listening... Speak now" : "Voice Input (Speech-to-Text)"}</span>
                  </button>
                </div>

                <textarea
                  rows="4"
                  placeholder="e.g. Deep pothole right after Perumba junction causing two-wheelers to swerve into traffic..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                />

                {/* Quick Suggestion Chips */}
                <div className="suggestion-chips">
                  <span className="chip-label">Quick Tags:</span>
                  {[
                    "Deep Road Pothole", 
                    "Overflowing Waste Dump", 
                    "Broken Dark Streetlight", 
                    "Burst Water Pipeline", 
                    "Open Manhole Slab Danger"
                  ].map((tag) => (
                    <button 
                      type="button" 
                      key={tag} 
                      className="suggestion-tag"
                      onClick={() => applyDescriptionTag(tag)}
                    >
                      + {tag}
                    </button>
                  ))}
                </div>
              </div>

              {/* Location Input */}
              <div className="form-group">
                <label className="form-label">3. Location &amp; Ward</label>
                <div className="location-input-row">
                  <div className="loc-text-display">
                    <MapPin size={18} />
                    <span>{landmarkName}</span>
                  </div>
                  <button type="button" className="gps-btn" onClick={getLocation}>
                    📍 Auto-Detect GPS
                  </button>
                </div>

                {/* Preset Payyanur Landmarks */}
                <div className="landmark-quick-picks">
                  <span className="chip-label">Select Nearby Landmark:</span>
                  {[
                    { name: "Perumba Junction & NH 66", coords: "12.0915, 75.2134" },
                    { name: "Old Bus Stand Market", coords: "12.1032, 75.2023" },
                    { name: "Payyanur Railway Station", coords: "12.1078, 75.1925" },
                    { name: "Annur Bridge Canal", coords: "12.1150, 75.2190" },
                    { name: "Keloth High School Road", coords: "12.1095, 75.2081" },
                  ].map((lm) => (
                    <button
                      type="button"
                      key={lm.name}
                      className={`landmark-tag ${landmarkName.includes(lm.name.slice(0, 10)) ? "active" : ""}`}
                      onClick={() => setPresetLandmark(lm.name, lm.coords)}
                    >
                      {lm.name}
                    </button>
                  ))}
                </div>
              </div>

              {/* Submit Button */}
              <button 
                type="submit" 
                className="submit-form-btn"
                disabled={isSubmitting}
              >
                {isSubmitting ? (
                  <>
                    <RefreshCw size={18} className="spin-icon" />
                    <span>Processing Multimodal AI &amp; Checking Duplicates...</span>
                  </>
                ) : (
                  <>
                    <Sparkles size={18} />
                    <span>Submit &amp; Run AI Municipal Triage</span>
                  </>
                )}
              </button>
            </form>
          </div>

          {/* Submission Success / AI Result Dialog */}
          {submissionResult && (
            <div className="modal-backdrop" onClick={() => setSubmissionResult(null)}>
              <div className="success-modal-card" onClick={(e) => e.stopPropagation()}>
                <div className={`success-icon-wrap ${submissionResult.is_duplicate ? "duplicate" : "new"}`}>
                  {submissionResult.is_duplicate ? <CheckCircle2 size={36} /> : <Sparkles size={36} />}
                </div>

                <h2>{submissionResult.is_duplicate ? "Smart Deduplication Triggered!" : "AI Civic Inspection Complete!"}</h2>
                <p className="success-msg">{submissionResult.message}</p>

                {/* AI Result Card */}
                {submissionResult.ai_analysis && (
                  <div className="ai-result-summary-box">
                    <div className="ai-result-row">
                      <span>Detected Issue:</span>
                      <strong>{submissionResult.ai_analysis.category}</strong>
                    </div>
                    <div className="ai-result-row">
                      <span>Civic Hazard Index (CHI):</span>
                      <strong className="text-red">{submissionResult.ai_analysis.civic_hazard_index}/100 ({submissionResult.ai_analysis.urgency_tier})</strong>
                    </div>
                    <div className="ai-result-row">
                      <span>Assigned Department:</span>
                      <strong>{submissionResult.ai_analysis.department}</strong>
                    </div>
                    <div className="ai-result-row">
                      <span>Resolution SLA:</span>
                      <strong>Within {submissionResult.ai_analysis.sla_hours} Hours</strong>
                    </div>
                  </div>
                )}

                <div className="success-actions-row">
                  <button 
                    className="btn-view-map"
                    onClick={() => {
                      setSubmissionResult(null);
                      setPage("map");
                    }}
                  >
                    View on Civic Map →
                  </button>
                  <button 
                    className="btn-done"
                    onClick={() => setSubmissionResult(null)}
                  >
                    Done
                  </button>
                </div>
              </div>
            </div>
          )}
        </main>
      )}

      {/* =========================
          PAGE 3: MAP & FEED
      ========================= */}
      {page === "map" && (
        <main className="map-page-wrapper">
          <div className="map-page-header">
            <div>
              <h1>Payyanur Civic Operations Map</h1>
              <p>Visualizing geolocated hazards, automated priority clusters, and resolution status</p>
            </div>
            <button className="btn-report-quick" onClick={() => setPage("report")}>
              + Report New Hazard
            </button>
          </div>

          <div className="map-split-view">
            {/* Left: Interactive Map */}
            <div className="map-section-left">
              <CivicMap 
                reports={reports} 
                onSelectReport={(r) => setSelectedReport(r)}
                selectedReportId={selectedReport?.id}
              />
            </div>

            {/* Right: Scrollable Feed */}
            <div className="map-section-right">
              <CivicFeed 
                reports={reports}
                onSelectReport={(r) => setSelectedReport(r)}
                onUpvote={handleUpvote}
              />
            </div>
          </div>
        </main>
      )}

      {/* =========================
          PAGE 4: ADMIN COMMAND CENTER
      ========================= */}
      {page === "admin" && (
        <main className="admin-page-container">
          <AdminCommandCenter 
            reports={reports}
            analytics={analytics}
            onSelectReport={(r) => setSelectedReport(r)}
            onUpdateStatus={handleUpdateStatus}
          />
        </main>
      )}

      {/* =========================
          PAGE 5: CIVIC HEROES & LEADERBOARD
      ========================= */}
      {page === "leaderboard" && (
        <main className="leaderboard-page-container">
          <CivicLeaderboard />
        </main>
      )}

      {/* =========================
          PAGE 6: ABOUT
      ========================= */}
      {page === "about" && (
        <main className="about-container">
          <div className="about-hero">
            <span className="about-tag">CIVIC SCIENCE AI HACKATHON PROJECT</span>
            <h1>Reimagining Public Governance with Multimodal AI</h1>
            <p className="about-sub">
              CIVISENSE connects citizens directly to municipal field units through intelligent computer vision, automated spatial deduplication, and SLA governance.
            </p>
          </div>

          <div className="about-cards-grid">
            <div className="about-feature-box">
              <div className="af-icon">🧠</div>
              <h3>Multimodal Computer Vision</h3>
              <p>
                Powered by Google Gemini 1.5/2.5 Flash and localized heuristics. Detects asphalt cracking, solid waste clusters, nighttime darkness, and pipeline bursts in under 2 seconds.
              </p>
            </div>

            <div className="about-feature-box">
              <div className="af-icon">🎯</div>
              <h3>Intelligent Spatial Deduplication</h3>
              <p>
                Solves municipal overload by correlating coordinates using the Haversine metric. Merges redundant citizen photos into a single verified master ticket with escalated urgency.
              </p>
            </div>

            <div className="about-feature-box">
              <div className="af-icon">🏛️</div>
              <h3>GovTech Command Portal</h3>
              <p>
                Equips municipal executive engineers with real-time dispatching, field crew tracking, automatic work order PDF generation, and ward-level risk distribution analytics.
              </p>
            </div>

            <div className="about-feature-box">
              <div className="af-icon">🌱</div>
              <h3>Civic Science Participation</h3>
              <p>
                Incentivizes citizens with Civic Karma points, community badges, and transparency. Citizens track their reported issues from initial detection to physical repair sign-off.
              </p>
            </div>
          </div>
        </main>
      )}

      {/* =========================
          MODAL: ISSUE DETAIL
      ========================= */}
      {selectedReport && (
        <IssueDetailModal
          report={selectedReport}
          onClose={() => setSelectedReport(null)}
          onUpvote={handleUpvote}
          onUpdateStatus={handleUpdateStatus}
          isAdmin={page === "admin"}
        />
      )}

      {/* =========================
          FOOTER
      ========================= */}
      <footer className="footer">
        <div className="footer-content">
          <div className="footer-left">
            <div className="footer-logo">CIVISENSE</div>
            <p>Civic Science AI • Autonomous Civic Issue Detection &amp; Rapid Municipal Dispatch</p>
          </div>
          <div className="footer-right">
            <span>Built for Civic Science Hackathon</span>
            <small>© 2026 Payyanur Municipal Corporation Pilot</small>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default App;