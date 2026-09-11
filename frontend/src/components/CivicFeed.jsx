import { useState } from "react";
import { 
  Search, Filter, ThumbsUp, MapPin, ShieldAlert, CheckCircle2, 
  Clock, ArrowRight, Sparkles 
} from "lucide-react";

export default function CivicFeed({ reports = [], onSelectReport, onUpvote }) {
  const [statusTab, setStatusTab] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");

  const filteredReports = reports.filter((r) => {
    if (statusTab === "Active" && r.status === "Resolved") return false;
    if (statusTab === "Dispatched" && r.status !== "Dispatched") return false;
    if (statusTab === "Resolved" && r.status !== "Resolved") return false;

    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      const match =
        r.title?.toLowerCase().includes(q) ||
        r.description?.toLowerCase().includes(q) ||
        r.location?.toLowerCase().includes(q) ||
        r.category?.toLowerCase().includes(q) ||
        r.id?.toLowerCase().includes(q);
      if (!match) return false;
    }
    return true;
  });

  return (
    <div className="civic-feed-section">
      {/* Header & Controls */}
      <div className="feed-controls-header">
        <div className="feed-title-block">
          <h2>Community Civic Feed</h2>
          <p>Real-time citizen reporting, AI verification, and municipal progress tracking</p>
        </div>

        <div className="feed-actions-bar">
          <div className="search-box">
            <Search size={16} />
            <input 
              type="text" 
              placeholder="Search by keyword, ward, ticket #..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
            />
          </div>

          <div className="tab-pills">
            {["All", "Active", "Dispatched", "Resolved"].map((tab) => (
              <button
                key={tab}
                className={`tab-pill ${statusTab === tab ? "active" : ""}`}
                onClick={() => setStatusTab(tab)}
              >
                {tab}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Grid of Report Cards */}
      {filteredReports.length === 0 ? (
        <div className="empty-feed-state">
          <ShieldAlert size={48} className="empty-icon" />
          <h3>No civic issues match your filter</h3>
          <p>Try searching for a different ward or clear active filters.</p>
        </div>
      ) : (
        <div className="feed-cards-grid">
          {filteredReports.map((report) => {
            const isResolved = report.status === "Resolved";
            const isCritical = report.urgency_tier === "Critical" && !isResolved;
            const imageUrl = report.image_url?.startsWith("http")
              ? report.image_url
              : `https://civisense-backend-vgjc.onrender.com${report.image_url}`;

            return (
              <div 
                key={report.id} 
                className={`feed-card ${isCritical ? "border-critical" : isResolved ? "border-resolved" : ""}`}
                onClick={() => onSelectReport(report)}
              >
                <div className="card-top-image">
                  <img 
                    src={imageUrl} 
                    alt={report.title}
                    onError={(e) => { e.target.src = "https://civisense-backend-vgjc.onrender.com/uploads/seed_pothole.svg"; }}
                  />
                  <span className={`card-status-tag ${isResolved ? "resolved" : isCritical ? "critical" : "warning"}`}>
                    {report.status}
                  </span>
                  <span className="card-chi-tag">
                    CHI: {report.civic_hazard_index}/100
                  </span>
                </div>

                <div className="card-content">
                  <div className="card-category-line">
                    <span className="dept-code">{report.department_code || "MUNICIPAL"}</span>
                    <span className="ticket-ref">{report.id}</span>
                  </div>

                  <h3 className="card-title">{report.title || report.category}</h3>
                  <p className="card-location">
                    <MapPin size={13} /> {report.location}
                  </p>
                  <p className="card-desc">
                    {report.description?.length > 95
                      ? `${report.description.slice(0, 95)}...`
                      : report.description}
                  </p>

                  {/* Progress Step Indicator */}
                  <div className="stage-tracker">
                    <div className="stage-step completed">
                      <div className="step-dot"></div>
                      <span>Reported</span>
                    </div>
                    <div className="stage-line completed"></div>
                    <div className="stage-step completed">
                      <div className="step-dot"></div>
                      <span>AI Triaged</span>
                    </div>
                    <div className={`stage-line ${report.status === "Dispatched" || isResolved ? "completed" : ""}`}></div>
                    <div className={`stage-step ${report.status === "Dispatched" || isResolved ? "completed" : ""}`}>
                      <div className="step-dot"></div>
                      <span>Dispatched</span>
                    </div>
                    <div className={`stage-line ${isResolved ? "completed" : ""}`}></div>
                    <div className={`stage-step ${isResolved ? "completed" : ""}`}>
                      <div className="step-dot"></div>
                      <span>Resolved</span>
                    </div>
                  </div>

                  {/* Card Bottom Footer */}
                  <div className="card-footer">
                    <button 
                      className="upvote-pill-btn"
                      onClick={(e) => {
                        e.stopPropagation();
                        onUpvote(report.id);
                      }}
                    >
                      <ThumbsUp size={14} />
                      <span>{report.upvotes || 1} Verifications</span>
                    </button>

                    <button 
                      className="inspect-card-btn"
                      onClick={() => onSelectReport(report)}
                    >
                      <span>Inspect</span>
                      <ArrowRight size={14} />
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

