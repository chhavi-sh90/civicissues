function Navbar({ page, setPage, user, onLogout }) {
  const isCitizen = user?.role === "citizen";

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

        <button className={page === "nearby" ? "nav-item active" : "nav-item"} onClick={() => setPage("nearby")}>
          <span aria-hidden="true">⌖</span>Issue Map
        </button>
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
