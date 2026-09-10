import { Trophy, Award, Star, Flame, Shield, Heart, CheckCircle } from "lucide-react";

export default function CivicLeaderboard() {
  const leaders = [
    { rank: 1, name: "Sreerag K.", ward: "Ward 1 (Perumba)", points: 1450, reports: 18, badge: "Civic Guardian" },
    { rank: 2, name: "Ananya M.", ward: "Ward 12 (Town Center)", points: 1220, reports: 15, badge: "Road Safety Sentinel" },
    { rank: 3, name: "Rahul P.", ward: "Ward 4 (Annur)", points: 980, reports: 12, badge: "Eco Watcher" },
    { rank: 4, name: "Dr. Vivek N.", ward: "Ward 8 (Keloth)", points: 840, reports: 10, badge: "Community Pillar" },
    { rank: 5, name: "Fathima S.", ward: "Ward 15 (Station Area)", points: 710, reports: 8, badge: "Rapid Responder" },
    { rank: 6, name: "Arjun K.", ward: "Ward 22 (Korom)", points: 590, reports: 6, badge: "Civic Scout" }
  ];

  const badges = [
    { icon: "🛡️", title: "Rapid Sentinel", desc: "Reported 5+ critical hazards within 10 minutes of occurrence" },
    { icon: "🔍", title: "Eagle Eye", desc: "First citizen to detect and capture deep sub-base road decay" },
    { icon: "🤝", title: "Community Pillar", desc: "Verified and upvoted 10+ community reports" },
    { icon: "🌱", title: "Clean Earth Hero", desc: "Identified illegal plastic waste dumps and tracked clearance" }
  ];

  return (
    <div className="leaderboard-container">
      {/* Header */}
      <div className="leaderboard-header">
        <div className="badge-tag">
          <Trophy size={16} /> CIVIC SCIENCE PARTICIPATION
        </div>
        <h1>Community Impact &amp; Civic Hero Board</h1>
        <p>
          Rewarding citizens who report public safety hazards, verify neighborhood issues, and collaborate with local municipal authorities.
        </p>
      </div>

      {/* Hero Stats */}
      <div className="hero-stats-row">
        <div className="hero-stat-card">
          <Flame size={24} className="icon-gold" />
          <div>
            <h3>14,820</h3>
            <small>Total Civic Karma Generated</small>
          </div>
        </div>

        <div className="hero-stat-card">
          <Award size={24} className="icon-blue" />
          <div>
            <h3>89</h3>
            <small>Neighborhood Hazards Fixed</small>
          </div>
        </div>

        <div className="hero-stat-card">
          <Heart size={24} className="icon-red" />
          <div>
            <h3>3,400+</h3>
            <small>Citizens Safer in Payyanur</small>
          </div>
        </div>
      </div>

      {/* Main Leaderboard Grid */}
      <div className="leaderboard-grid">
        {/* Left Column: Top Contributors */}
        <div className="board-card">
          <div className="board-card-header">
            <h3>🏆 Top Civic Contributors (Payyanur Wards)</h3>
            <small>Updated live with verified submissions</small>
          </div>

          <div className="leaders-list">
            {leaders.map((leader) => (
              <div key={leader.rank} className={`leader-row rank-${leader.rank}`}>
                <div className="rank-num">
                  {leader.rank === 1 ? "🥇" : leader.rank === 2 ? "🥈" : leader.rank === 3 ? "🥉" : `#${leader.rank}`}
                </div>
                <div className="leader-info">
                  <div className="leader-name">
                    <strong>{leader.name}</strong>
                    <span className="leader-badge">{leader.badge}</span>
                  </div>
                  <small className="leader-ward">📍 {leader.ward}</small>
                </div>
                <div className="leader-score">
                  <span className="points-value">{leader.points}</span>
                  <small>Karma Pts ({leader.reports} reports)</small>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Right Column: Achievements & How Karma Works */}
        <div className="achievements-column">
          <div className="board-card">
            <h3>🎖️ Earnable Civic Badges</h3>
            <div className="badges-grid">
              {badges.map((b, i) => (
                <div key={i} className="badge-item">
                  <span className="badge-emoji">{b.icon}</span>
                  <div>
                    <h4>{b.title}</h4>
                    <p>{b.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="board-card info-card">
            <h3>✨ How Civic Science AI Rewards You</h3>
            <ul className="karma-rules-list">
              <li>
                <CheckCircle size={15} className="check-icon" />
                <span><strong>+50 Karma:</strong> Submitting a valid hazard photo with accurate GPS.</span>
              </li>
              <li>
                <CheckCircle size={15} className="check-icon" />
                <span><strong>+25 Karma:</strong> When AI confirms and routes to the correct department.</span>
              </li>
              <li>
                <CheckCircle size={15} className="check-icon" />
                <span><strong>+10 Karma:</strong> Verifying / upvoting an existing neighbor's report.</span>
              </li>
              <li>
                <CheckCircle size={15} className="check-icon" />
                <span><strong>+100 Karma:</strong> When municipal crew completes and resolves the ticket!</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
