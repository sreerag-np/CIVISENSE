import { useState } from "react";
import { 
  ShieldAlert, Clock, CheckCircle2, AlertTriangle, Send, 
  FileText, Activity, Users, Wrench, ArrowUpRight, BarChart3
} from "lucide-react";

export default function AdminCommandCenter({ 
  reports = [], 
  analytics = {}, 
  onSelectReport, 
  onUpdateStatus 
}) {
  const [selectedDept, setSelectedDept] = useState("All");
  const [quickDispatchId, setQuickDispatchId] = useState(null);
  const [assignedCrew, setAssignedCrew] = useState("");
  const [workOrderReport, setWorkOrderReport] = useState(null);

  const filteredReports = reports.filter((r) => {
    if (selectedDept !== "All" && r.department_code !== selectedDept) return false;
    return true;
  });

  const handleQuickDispatchSubmit = async (reportId) => {
    if (!assignedCrew.trim()) {
      alert("Please enter a crew name or unit ID.");
      return;
    }
    await onUpdateStatus(reportId, "Dispatched", assignedCrew.trim());
    setQuickDispatchId(null);
    setAssignedCrew("");
  };

  const handleGenerateWorkOrder = (report) => {
    setWorkOrderReport(report);
  };

  return (
    <div className="admin-command-center">
      {/* Top Banner */}
      <div className="admin-banner">
        <div>
          <div className="banner-tag">
            <span className="live-indicator"></span> MUNICIPAL DISPATCH OPERATIONS
          </div>
          <h1>Civic Emergency & Triage Command Center</h1>
          <p>Payyanur Municipal Corporation • Real-Time AI Hazard Prioritization & Rapid Crew Dispatch</p>
        </div>

        <div className="admin-quick-stats">
          <div className="quick-stat-box red">
            <ShieldAlert size={20} />
            <div>
              <h3>{analytics.critical_active ?? 2}</h3>
              <small>Critical Emergencies</small>
            </div>
          </div>
          <div className="quick-stat-box green">
            <CheckCircle2 size={20} />
            <div>
              <h3>{analytics.resolution_rate_pct ?? 40}%</h3>
              <small>Resolution Rate</small>
            </div>
          </div>
          <div className="quick-stat-box blue">
            <Activity size={20} />
            <div>
              <h3>{analytics.average_sla_hours ?? 18.5}h</h3>
              <small>Avg SLA Target</small>
            </div>
          </div>
        </div>
      </div>

      {/* Analytics KPI Row */}
      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-icon blue"><Activity size={22} /></div>
          <div className="kpi-data">
            <span className="kpi-label">Total Received Incidents</span>
            <span className="kpi-number">{analytics.total_reports ?? reports.length}</span>
            <span className="kpi-subtext">All wards active</span>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon orange"><Clock size={22} /></div>
          <div className="kpi-data">
            <span className="kpi-label">Dispatched to Field</span>
            <span className="kpi-number">{analytics.dispatched_count ?? 2}</span>
            <span className="kpi-subtext">Crews actively on-site</span>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon green"><CheckCircle2 size={22} /></div>
          <div className="kpi-data">
            <span className="kpi-label">Verified &amp; Resolved</span>
            <span className="kpi-number">{analytics.resolved_count ?? 1}</span>
            <span className="kpi-subtext">Inspected with photo sign-off</span>
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-icon purple"><Users size={22} /></div>
          <div className="kpi-data">
            <span className="kpi-label">Citizen Verifications</span>
            <span className="kpi-number">{analytics.community_upvotes_total ?? 84}</span>
            <span className="kpi-subtext">Community engagement</span>
          </div>
        </div>
      </div>

      {/* Department Breakdown Bar */}
      <div className="dept-distribution-card">
        <div className="dept-card-header">
          <BarChart3 size={18} />
          <h3>Department Caseload Distribution</h3>
          <div className="dept-filter-pills">
            {["All", "PWD-ROAD", "MUN-SNT", "KWA-PIPE", "ELEC-LGT", "DRN-SEW"].map((d) => (
              <button 
                key={d}
                className={`dept-pill ${selectedDept === d ? "active" : ""}`}
                onClick={() => setSelectedDept(d)}
              >
                {d === "All" ? "All Divisions" : d}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Main Operations Triage Table */}
      <div className="triage-table-container">
        <div className="table-header-title">
          <h3>Priority Dispatch Queue</h3>
          <span className="queue-count">{filteredReports.length} incidents listed</span>
        </div>

        <div className="table-responsive">
          <table className="triage-table">
            <thead>
              <tr>
                <th>Ticket ID</th>
                <th>Hazard &amp; Category</th>
                <th>Location / Ward</th>
                <th>Civic Hazard Index</th>
                <th>Department</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filteredReports.map((r) => {
                const isCritical = r.urgency_tier === "Critical" && r.status !== "Resolved";
                const isResolved = r.status === "Resolved";
                const isDispatched = r.status === "Dispatched";

                return (
                  <tr key={r.id} className={isCritical ? "row-critical" : ""}>
                    <td className="cell-id">
                      <strong>{r.id}</strong>
                      <small>{new Date(r.created_at || Date.now()).toLocaleDateString()}</small>
                    </td>

                    <td className="cell-hazard">
                      <div className="hazard-title">{r.title || r.category}</div>
                      <div className="hazard-rec">{r.recommended_action}</div>
                    </td>

                    <td className="cell-location">
                      <span>{r.location}</span>
                    </td>

                    <td className="cell-chi">
                      <div className="chi-bar-wrapper">
                        <div 
                          className={`chi-fill ${r.civic_hazard_index >= 80 ? "critical" : r.civic_hazard_index >= 65 ? "high" : "moderate"}`}
                          style={{ width: `${r.civic_hazard_index}%` }}
                        ></div>
                      </div>
                      <span className="chi-value">CHI {r.civic_hazard_index}/100</span>
                    </td>

                    <td className="cell-dept">
                      <span className="badge-dept">{r.department_code || "MUN"}</span>
                    </td>

                    <td className="cell-status">
                      <span className={`status-pill small ${isResolved ? "resolved" : isCritical ? "critical" : isDispatched ? "dispatched" : "warning"}`}>
                        {r.status}
                      </span>
                      {r.dispatched_team && (
                        <div className="cell-team">👷 {r.dispatched_team}</div>
                      )}
                    </td>

                    <td className="cell-actions">
                      <div className="action-buttons-group">
                        <button 
                          className="btn-table-inspect"
                          onClick={() => onSelectReport(r)}
                          title="Inspect AI Details"
                        >
                          Inspect
                        </button>

                        {!isResolved && (
                          <button 
                            className="btn-table-dispatch"
                            onClick={() => setQuickDispatchId(r.id)}
                            title="Dispatch Unit"
                          >
                            <Send size={13} />
                            <span>Dispatch</span>
                          </button>
                        )}

                        <button 
                          className="btn-table-workorder"
                          onClick={() => handleGenerateWorkOrder(r)}
                          title="Generate Work Order"
                        >
                          <FileText size={13} />
                        </button>
                      </div>

                      {/* Quick Inline Dispatch Popover */}
                      {quickDispatchId === r.id && (
                        <div className="inline-dispatch-box">
                          <input 
                            type="text" 
                            placeholder="Unit name (e.g. Unit 3)"
                            value={assignedCrew}
                            onChange={(e) => setAssignedCrew(e.target.value)}
                            autoFocus
                          />
                          <button 
                            className="inline-confirm-btn"
                            onClick={() => handleQuickDispatchSubmit(r.id)}
                          >
                            Confirm
                          </button>
                          <button 
                            className="inline-cancel-btn"
                            onClick={() => setQuickDispatchId(null)}
                          >
                            ✕
                          </button>
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Work Order Modal Preview */}
      {workOrderReport && (
        <div className="modal-backdrop" onClick={() => setWorkOrderReport(null)}>
          <div className="work-order-modal" onClick={(e) => e.stopPropagation()}>
            <div className="work-order-header">
              <div className="wo-badge">OFFICIAL MUNICIPAL WORK ORDER</div>
              <h2>Payyanur Municipal Corporation</h2>
              <p>Engineering &amp; Public Works Directorate • Dispatch Notice #{workOrderReport.ticket_no || workOrderReport.id}</p>
            </div>

            <div className="work-order-body">
              <div className="wo-grid">
                <div><strong>Target Division:</strong> {workOrderReport.department}</div>
                <div><strong>Urgency Classification:</strong> {workOrderReport.urgency_tier} (SLA: {workOrderReport.sla_hours} hrs)</div>
                <div><strong>Incident Location:</strong> {workOrderReport.location}</div>
                <div><strong>Civic Hazard Index:</strong> {workOrderReport.civic_hazard_index} / 100</div>
                <div><strong>Estimated Budget:</strong> ₹{(workOrderReport.estimated_cost_inr || 12000).toLocaleString("en-IN")}</div>
                <div><strong>Assigned Team:</strong> {workOrderReport.dispatched_team || "Pending Rapid Assignment"}</div>
              </div>

              <div className="wo-box">
                <h4>Mandated Action Plan:</h4>
                <p>{workOrderReport.recommended_action}</p>
              </div>

              <div className="wo-box">
                <h4>Safety Mitigation Protocol:</h4>
                <p>{workOrderReport.safety_risk_summary || "Secure site with reflective cones and initiate repairs immediately."}</p>
              </div>

              <div className="wo-signature-row">
                <div>
                  <div className="sig-line"></div>
                  <small>AI Verification Officer</small>
                </div>
                <div>
                  <div className="sig-line"></div>
                  <small>Municipal Executive Engineer</small>
                </div>
              </div>
            </div>

            <div className="work-order-footer">
              <button className="btn-print" onClick={() => window.print()}>
                🖨️ Print Work Order
              </button>
              <button className="btn-close-wo" onClick={() => setWorkOrderReport(null)}>
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
