function Navbar({ page, setPage, user, onLogout }) {
  const isCitizen = user?.role === "citizen";
  const isAuthority = user?.role === "admin" || user?.role === "department_official";

  return (
    <aside className="sidebar">
      <div className="brand">
        <div className="brand-icon">C</div>
        <div>
          <h2>CivicConnect</h2>
          <span>{isCitizen ? "Citizen Portal" : "Civic Portal"}</span>
        </div>
      </div>

      <nav className="nav-menu" aria-label="Portal navigation">
        <button className={page === "dashboard" ? "nav-item active" : "nav-item"} onClick={() => setPage("dashboard")}>
          <span aria-hidden="true">⌂</span>Dashboard
        </button>

        {isCitizen && (
          <button className={page === "report" ? "nav-item active" : "nav-item"} onClick={() => setPage("report")}>
            <span aria-hidden="true">＋</span>Report Issue
          </button>
        )}

        <button className={page === "complaints" ? "nav-item active" : "nav-item"} onClick={() => setPage("complaints")}>
          <span aria-hidden="true">▤</span>{isCitizen ? "My Complaints" : "Complaints"}
        </button>

        {isAuthority && (
          <>
            <button className={page === "pending" ? "nav-item active" : "nav-item"} onClick={() => setPage("pending")}>
              <span aria-hidden="true">◷</span>Pending
            </button>
            <button className={page === "in-progress" ? "nav-item active" : "nav-item"} onClick={() => setPage("in-progress")}>
              <span aria-hidden="true">↻</span>In Progress
            </button>
            <button className={page === "resolved" ? "nav-item active" : "nav-item"} onClick={() => setPage("resolved")}>
              <span aria-hidden="true">✓</span>Resolved
            </button>
          </>
        )}

        <button className={page === "nearby" ? "nav-item active" : "nav-item"} onClick={() => setPage("nearby")}>
          <span aria-hidden="true">⌖</span>Issue Map
        </button>

        {isAuthority && (
          <>
            <div className="nav-section-label">Authority insights</div>
            <button className={page === "heatmap" ? "nav-item active" : "nav-item"} onClick={() => setPage("heatmap")}>
              <span aria-hidden="true">◉</span>Heatmap
            </button>
            <button className={page === "analytics" ? "nav-item active" : "nav-item"} onClick={() => setPage("analytics")}>
              <span aria-hidden="true">▥</span>Analytics
            </button>
            <button className={page === "ai-analysis" ? "nav-item active" : "nav-item"} onClick={() => setPage("ai-analysis")}>
              <span aria-hidden="true">✦</span>AI Analysis
            </button>
            <button className={page === "users" ? "nav-item active" : "nav-item"} onClick={() => setPage("users")}>
              <span aria-hidden="true">♟</span>Users
            </button>
          </>
        )}

        {isCitizen && (
          <>
            <div className="nav-section-label">Authority portal</div>
            <button className="nav-item nav-item-locked" onClick={() => setPage("authority-access")} title="Authority account required">
              <span aria-hidden="true">🔒</span>Heatmap
            </button>
            <button className="nav-item nav-item-locked" onClick={() => setPage("authority-access")} title="Authority account required">
              <span aria-hidden="true">🔒</span>Analytics
            </button>
            <button className="nav-item nav-item-locked" onClick={() => setPage("authority-access")} title="Authority account required">
              <span aria-hidden="true">🔒</span>AI Analysis
            </button>
            <button className="nav-item nav-item-locked" onClick={() => setPage("authority-access")} title="Authority account required">
              <span aria-hidden="true">🔒</span>Users
            </button>
          </>
        )}
      </nav>

      <div className="sidebar-bottom">
        <div className="user-panel">
          <div className="user-avatar">{user?.full_name?.charAt(0)?.toUpperCase() || "U"}</div>
          <div><strong>{user?.full_name || "User"}</strong><p>{user?.email}</p></div>
        </div>
        <button className="logout-button" onClick={onLogout}><span aria-hidden="true">↪</span>Logout</button>
      </div>
    </aside>
  );
}

export default Navbar;
