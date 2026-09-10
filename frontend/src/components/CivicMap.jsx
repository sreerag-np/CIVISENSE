import { useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Filter, Layers, Navigation, AlertTriangle, CheckCircle2, ShieldAlert } from "lucide-react";

export default function CivicMap({ reports = [], onSelectReport, selectedReportId, centerOnCoordinates }) {
  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const markersLayer = useRef(null);

  const [categoryFilter, setCategoryFilter] = useState("All");
  const [urgencyFilter, setUrgencyFilter] = useState("All");

  // Default Center: Payyanur Town Center
  const DEFAULT_CENTER = [12.1032, 75.2023];
  const DEFAULT_ZOOM = 14;

  useEffect(() => {
    if (!mapRef.current || mapInstance.current) return;

    // Initialize map
    const map = L.map(mapRef.current, {
      center: DEFAULT_CENTER,
      zoom: DEFAULT_ZOOM,
      zoomControl: true,
    });

    // Clean OpenStreetMap Tile Layer
    L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
      maxZoom: 19,
      attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
    }).addTo(map);

    markersLayer.current = L.layerGroup().addTo(map);
    mapInstance.current = map;

    // Invalidate size to guarantee tiles fill the container
    setTimeout(() => {
      map.invalidateSize();
    }, 150);

    const handleResize = () => {
      map.invalidateSize();
    };
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      map.remove();
      mapInstance.current = null;
    };
  }, []);

  // Update Markers when reports or filters change
  useEffect(() => {
    if (!mapInstance.current || !markersLayer.current) return;

    markersLayer.current.clearLayers();

    const filtered = reports.filter((r) => {
      if (categoryFilter !== "All" && !r.category?.toLowerCase().includes(categoryFilter.toLowerCase())) {
        return false;
      }
      if (urgencyFilter !== "All" && r.urgency_tier !== urgencyFilter && r.status !== urgencyFilter) {
        return false;
      }
      return true;
    });

    filtered.forEach((report) => {
      if (!report.latitude || !report.longitude) return;

      const isResolved = report.status === "Resolved";
      const isCritical = report.urgency_tier === "Critical" && !isResolved;
      const isHigh = report.urgency_tier === "High" && !isResolved;

      let color = "#3b82f6"; // default blue
      let pulseClass = "";
      if (isResolved) {
        color = "#10b981"; // green
      } else if (isCritical) {
        color = "#ef4444"; // red
        pulseClass = "pulse-critical";
      } else if (isHigh) {
        color = "#f97316"; // orange
      } else {
        color = "#eab308"; // yellow
      }

      // Create Custom HTML Marker with severity badge
      const iconHtml = `
        <div class="custom-map-pin ${pulseClass}" style="background-color: ${color};">
          <span>${report.civic_hazard_index || "!"}</span>
        </div>
      `;

      const customIcon = L.divIcon({
        className: "custom-div-icon",
        html: iconHtml,
        iconSize: [34, 34],
        iconAnchor: [17, 34],
        popupAnchor: [0, -32],
      });

      const marker = L.marker([report.latitude, report.longitude], { icon: customIcon });

      const popupContent = `
        <div class="map-popup-card">
          <div class="popup-header">
            <span class="badge ${isResolved ? "badge-resolved" : isCritical ? "badge-critical" : "badge-warning"}">
              ${report.status} • CHI: ${report.civic_hazard_index}/100
            </span>
            <small class="popup-ticket">${report.id}</small>
          </div>
          <h4 class="popup-title">${report.title || report.category}</h4>
          <p class="popup-location">📍 ${report.location}</p>
          <p class="popup-dept">🏛️ ${report.department_code || "MUNICIPAL"}</p>
          <div class="popup-footer">
            <span>👍 ${report.upvotes || 1} verifications</span>
            <button id="popup-inspect-btn-${report.id}" class="popup-btn">Inspect Issue →</button>
          </div>
        </div>
      `;

      marker.bindPopup(popupContent);
      marker.on("popupopen", () => {
        const btn = document.getElementById(`popup-inspect-btn-${report.id}`);
        if (btn) {
          btn.onclick = () => onSelectReport(report);
        }
      });

      marker.addTo(markersLayer.current);
    });
  }, [reports, categoryFilter, urgencyFilter, onSelectReport]);

  // Handle zooming to selected coordinate
  useEffect(() => {
    if (centerOnCoordinates && mapInstance.current) {
      mapInstance.current.flyTo(centerOnCoordinates, 16, { duration: 1.2 });
    }
  }, [centerOnCoordinates]);

  const handleLocateMe = () => {
    if (!navigator.geolocation) {
      alert("Geolocation is not supported by your browser.");
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude } = pos.coords;
        if (mapInstance.current) {
          mapInstance.current.flyTo([latitude, longitude], 15);
        }
      },
      () => alert("Unable to retrieve your location.")
    );
  };

  return (
    <div className="civic-map-container">
      {/* Map Filter Controls Bar */}
      <div className="map-controls-overlay">
        <div className="filter-group">
          <Filter size={15} />
          <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
            <option value="All">All Categories</option>
            <option value="Pothole">Roads & Potholes</option>
            <option value="Waste">Solid Waste</option>
            <option value="Streetlight">Streetlights</option>
            <option value="Water">Water Supply</option>
            <option value="Drain">Drains & Manholes</option>
          </select>
        </div>

        <div className="filter-group">
          <Layers size={15} />
          <select value={urgencyFilter} onChange={(e) => setUrgencyFilter(e.target.value)}>
            <option value="All">All Severity Tiers</option>
            <option value="Critical">Critical (CHI ≥ 80)</option>
            <option value="High">High Urgency</option>
            <option value="Resolved">Resolved</option>
          </select>
        </div>

        <button className="locate-btn" onClick={handleLocateMe} title="Center on My Location">
          <Navigation size={15} />
          <span>My Location</span>
        </button>
      </div>

      {/* Map Canvas */}
      <div ref={mapRef} className="leaflet-map-root" />

      {/* Map Legend */}
      <div className="map-legend">
        <div className="legend-item">
          <span className="legend-dot critical"></span>
          <span>Critical Hazard (80-100)</span>
        </div>
        <div className="legend-item">
          <span className="legend-dot high"></span>
          <span>High Severity (65-79)</span>
        </div>
        <div className="legend-item">
          <span className="legend-dot moderate"></span>
          <span>Moderate (50-64)</span>
        </div>
        <div className="legend-item">
          <span className="legend-dot resolved"></span>
          <span>Resolved</span>
        </div>
      </div>
    </div>
  );
}
