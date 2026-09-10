import { useState } from "react";
import { 
  X, AlertTriangle, CheckCircle2, Clock, ThumbsUp, Wrench, 
  Building2, DollarSign, ShieldAlert, Sparkles, Send, MapPin
} from "lucide-react";

export default function IssueDetailModal({ 
  report, 
  onClose, 
  onUpvote, 
  onUpdateStatus, 
  isAdmin = false 
}) {
  const [dispatchTeam, setDispatchTeam] = useState("");
  const [resolutionNote, setResolutionNote] = useState("");
  const [isUpdating, setIsUpdating] = useState(false);

  if (!report) return null;

  const isResolved = report.status === "Resolved";
  const isCritical = report.urgency_tier === "Critical" && !isResolved;
  const isHigh = report.urgency_tier === "High" && !isResolved;

  const handleDispatch = async () => {
    if (!dispatchTeam.trim()) {
      alert("Please enter team/officer name to dispatch.");
      return;
    }
    setIsUpdating(true);
    await onUpdateStatus(report.id, "Dispatched", dispatchTeam.trim());
    setIsUpdating(false);
  };

  const handleResolve = async () => {
    setIsUpdating(true);
    await onUpdateStatus(
      report.id, 
      "Resolved", 
      null, 
      resolutionNote.trim() || "Work completed and verified by municipal inspector."
    );
    setIsUpdating(false);
  };

  // Construct full image path
  const imageUrl = report.image_url?.startsWith("http")
    ? report.image_url
    : `http://127.0.0.1:8000${report.image_url}`;

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        {/* Modal Top Header */}
        <div className="modal-header">
          <div className="modal-title-row">
            <span className="ticket-id">{report.ticket_no || report.id}</span>
            <span className={`status-pill ${isResolved ? "resolved" : isCritical ? "critical" : "warning"}`}>
              {report.status}
            </span>
            <span className="chi-badge">
              <ShieldAlert size={14} /> CHI: {report.civic_hazard_index}/100
            </span>
          </div>
          <button className="close-btn" onClick={onClose}><X size={20} /></button>
        </div>

        {/* Modal Body */}
        <div className="modal-body">
          {/* Left Column: Image & AI Analysis */}
          <div className="modal-col-left">
            <div className="modal-image-wrap">
              <img 
                src={imageUrl} 
                alt={report.title} 
                onError={(e) => { e.target.src = "http://127.0.0.1:8000/uploads/seed_pothole.svg"; }}
              />
              <div className="image-ai-watermark">
                <Sparkles size={13} />
                <span>Verified by {report.ai_model || "CIVISENSE Vision AI"}</span>
              </div>
            </div>

            {/* AI Diagnostics Box */}
            <div className="ai-diagnosis-box">
              <div className="diagnosis-header">
                <Sparkles size={16} className="sparkle-icon" />
                <h4>Automated AI Triage Assessment</h4>
              </div>

              <div className="diagnosis-grid">
                <div className="diag-item">
                  <span className="diag-label">Civic Hazard Score</span>
                  <span className="diag-value highlight-red">{report.severity_score}/10.0</span>
                </div>
                <div className="diag-item">
                  <span className="diag-label">Public Urgency SLA</span>
                  <span className="diag-value">{report.sla_hours || 24} Hours</span>
                </div>
                <div className="diag-item">
                  <span className="diag-label">Est. Municipal Repair Cost</span>
                  <span className="diag-value">₹{(report.estimated_cost_inr || 12000).toLocaleString("en-IN")}</span>
                </div>
                <div className="diag-item">
                  <span className="diag-label">Responsible Division</span>
                  <span className="diag-value highlight-blue">{report.department_code || "MUNICIPAL"}</span>
                </div>
              </div>

              <div className="diag-notes">
                <strong>Recommended Action:</strong> {report.recommended_action || "Standard municipal maintenance deployment."}
              </div>
              <div className="diag-notes risk">
                <strong>Public Risk Profile:</strong> {report.safety_risk_summary || "Safety risk under automated monitoring."}
              </div>
            </div>
          </div>

          {/* Right Column: Information, Timeline, and Admin Controls */}
          <div className="modal-col-right">
            <h2>{report.title || report.category}</h2>
            <p className="modal-location">
              <MapPin size={15} /> {report.location}
            </p>

            <div className="description-section">
              <h4>Citizen Description</h4>
              <p>{report.description}</p>
            </div>

            {/* Upvote & Verification Bar */}
            <div className="verification-bar">
              <div className="vote-count">
                <strong>{report.upvotes || 1}</strong> Citizens have verified this hazard
              </div>
              <button 
                className="verify-action-btn"
                onClick={() => onUpvote(report.id)}
              >
                <ThumbsUp size={16} />
                <span>Verify & Upvote (+10 Karma)</span>
              </button>
            </div>

            {/* Lifecycle Timeline */}
            <div className="timeline-section">
              <h4>Resolution Audit Log</h4>
              <div className="timeline-list">
                {(report.timeline || []).map((step, idx) => (
                  <div key={idx} className="timeline-entry">
                    <div className="timeline-bullet"></div>
                    <div className="timeline-content">
                      <span className="timeline-time">{step.time}</span>
                      <p className="timeline-text">{step.event}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Municipal Admin Controls */}
            {isAdmin && !isResolved && (
              <div className="admin-actions-card">
                <h4>🏛️ Municipal Dispatch Actions</h4>
                
                {report.status !== "Dispatched" ? (
                  <div className="dispatch-form">
                    <input 
                      type="text" 
                      placeholder="Assign Team (e.g. PWD Rapid Unit #4, KSEB Line Crew)"
                      value={dispatchTeam}
                      onChange={(e) => setDispatchTeam(e.target.value)}
                    />
                    <button 
                      className="dispatch-btn" 
                      onClick={handleDispatch}
                      disabled={isUpdating}
                    >
                      <Send size={15} /> Dispatch Crew
                    </button>
                  </div>
                ) : (
                  <div className="resolve-form">
                    <p className="current-dispatch">👷 Currently Dispatched: <strong>{report.dispatched_team || "Field Crew"}</strong></p>
                    <textarea 
                      rows="2"
                      placeholder="Resolution summary (materials used, sign-off notes)..."
                      value={resolutionNote}
                      onChange={(e) => setResolutionNote(e.target.value)}
                    />
                    <button 
                      className="resolve-btn" 
                      onClick={handleResolve}
                      disabled={isUpdating}
                    >
                      <CheckCircle2 size={15} /> Mark Issue Resolved
                    </button>
                  </div>
                )}
              </div>
            )}

            {isResolved && (
              <div className="resolved-banner">
                <CheckCircle2 size={22} />
                <div>
                  <h4>Issue Officially Resolved</h4>
                  <p>{report.resolution_summary || "Inspected and closed by municipal authority."}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
