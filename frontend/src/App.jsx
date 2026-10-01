import { useCallback, useEffect, useMemo, useState } from "react";
import L from "leaflet";
import { MapContainer, Marker, Popup, TileLayer, useMapEvents } from "react-leaflet";
import markerIcon from "leaflet/dist/images/marker-icon.png";
import markerIcon2x from "leaflet/dist/images/marker-icon-2x.png";
import markerShadow from "leaflet/dist/images/marker-shadow.png";
import "leaflet/dist/leaflet.css";
import Navbar from "./components/Navbar";
import { apiRequest } from "./api";
import "./App.css";

L.Icon.Default.mergeOptions({ iconRetinaUrl: markerIcon2x, iconUrl: markerIcon, shadowUrl: markerShadow });

const DEFAULT_POSITION = [28.6469, 77.3715];
const SESSION_KEY = "civicconnect_session";
const statusLabels = {
  submitted: "Submitted",
  under_review: "Under Review",
  assigned: "Assigned",
  in_progress: "In Progress",
  resolved: "Resolved",
  rejected: "Rejected",
};
const statusTransitions = {
  submitted: ["under_review", "in_progress", "resolved", "rejected"],
  under_review: ["in_progress", "resolved", "rejected"],
  assigned: ["in_progress", "rejected"],
  in_progress: ["resolved", "rejected"],
  resolved: [],
  rejected: [],
};
const initialAuthForm = { full_name: "", email: "", phone: "", password: "" };
const initialReportForm = { title: "", description: "", category_id: "", address: "" };

function readStoredSession() {
  try {
    return JSON.parse(localStorage.getItem(SESSION_KEY)) || null;
  } catch {
    localStorage.removeItem(SESSION_KEY);
    return null;
  }
}

function complaintEndpointFor(user) {
  if (user?.role !== "citizen") return "/complaints?limit=100";
  return "/complaints/my?limit=100";
}

function statusLabel(status) {
  return statusLabels[status] || status || "Unknown";
}

function LocationPicker({ onPick }) {
  useMapEvents({ click: (event) => onPick([event.latlng.lat, event.latlng.lng]) });
  return null;
}

function PortalLayout({ children, page, setPage, user, onLogout }) {
  return (
    <div className="app-layout">
      <Navbar page={page} setPage={setPage} user={user} onLogout={onLogout} />
      <div className="main-area"><main className="dashboard-content">{children}</main></div>
    </div>
  );
}

function Message({ error, notice }) {
  if (error) return <div className="form-message error-message">{error}</div>;
  if (notice) return <div className="form-message success-message">{notice}</div>;
  return null;
}

function AuthorityStatusForm({ complaint, onUpdate, busy }) {
  const options = statusTransitions[complaint.status] || [];
  const [newStatus, setNewStatus] = useState(options[0] || "");
  const [remarks, setRemarks] = useState("");
  const [rejectionReason, setRejectionReason] = useState("");

  if (options.length === 0) {
    return <div className="workflow-complete">This complaint workflow is complete.</div>;
  }

  function submitUpdate(event) {
    event.preventDefault();
    onUpdate(complaint.id, {
      new_status: newStatus,
      remarks,
      ...(newStatus === "rejected" ? { rejection_reason: rejectionReason } : {}),
    });
  }

  return (
    <form className="authority-update" onSubmit={submitUpdate}>
      <div className="authority-update-heading">
        <strong>Authority action</strong>
        <span>The citizen will see this status and note.</span>
      </div>
      <div className="authority-fields">
        <label>
          Next status
          <select value={newStatus} onChange={(event) => setNewStatus(event.target.value)} required>
            {options.map((status) => <option key={status} value={status}>{statusLabel(status)}</option>)}
          </select>
        </label>
        <label className="remarks-field">
          Update for citizen
          <textarea value={remarks} onChange={(event) => setRemarks(event.target.value)} maxLength="500" rows="2" placeholder="Work completed, team dispatched, expected timeline…" required />
        </label>
        {newStatus === "rejected" && (
          <label className="remarks-field">
            Rejection reason
            <input value={rejectionReason} onChange={(event) => setRejectionReason(event.target.value)} maxLength="255" placeholder="Explain why this issue cannot be accepted" required />
          </label>
        )}
        <button type="submit" disabled={busy}>{busy ? "Updating…" : "Update citizen"}</button>
      </div>
    </form>
  );
}

function ComplaintCard({ complaint, canManage, onUpdateStatus, busy }) {
  return (
    <article className="my-complaint-card">
      <div className="complaint-top">
        <div>
          <span className="complaint-id">{complaint.reference_code}</span>
          <h3>{complaint.title}</h3>
          <p>{complaint.category_name} • {complaint.address || `${complaint.latitude}, ${complaint.longitude}`}</p>
          <div className="complaint-meta">
            <span>Priority: {complaint.priority}</span>
            <span>Reported: {new Date(complaint.created_at).toLocaleDateString()}</span>
            {canManage && <span>Citizen: {complaint.citizen_name}</span>}
            {complaint.department_name && <span>Department: {complaint.department_name}</span>}
          </div>
        </div>
        <span className={`status-badge status-${complaint.status}`}>{statusLabel(complaint.status)}</span>
      </div>
      <p className="complaint-description">{complaint.description}</p>
      {complaint.latest_remarks && (
        <div className="authority-note"><strong>Latest authority update</strong><p>{complaint.latest_remarks}</p></div>
      )}
      {canManage && <AuthorityStatusForm key={`${complaint.id}-${complaint.status}`} complaint={complaint} onUpdate={onUpdateStatus} busy={busy} />}
    </article>
  );
}

function NotificationPanel({ notifications, onMarkAllRead }) {
  const unread = notifications.filter((item) => !item.is_read).length;
  return (
    <section className="notifications-card">
      <div className="recent-header">
        <div><h2>Authority Updates</h2><p>Status messages and information about your complaints</p></div>
        {unread > 0 && <button onClick={onMarkAllRead}>Mark all read ({unread})</button>}
      </div>
      {notifications.length === 0 ? (
        <div className="notification-empty">No authority updates yet.</div>
      ) : notifications.slice(0, 5).map((item) => (
        <div className={`notification-item ${item.is_read ? "" : "unread"}`} key={item.id}>
          <div className="notification-dot" />
          <div><strong>{item.title}</strong><p>{item.message}</p><span>{new Date(item.created_at).toLocaleString()}</span></div>
        </div>
      ))}
    </section>
  );
}

function App() {
  const storedSession = useMemo(() => readStoredSession(), []);
  const [token, setToken] = useState(storedSession?.token || "");
  const [user, setUser] = useState(storedSession?.user || null);
  const [page, setPage] = useState(storedSession?.token ? "loading" : "login");
  const [authMode, setAuthMode] = useState("login");
  const [authForm, setAuthForm] = useState(initialAuthForm);
  const [reportForm, setReportForm] = useState(initialReportForm);
  const [position, setPosition] = useState(null);
  const [photos, setPhotos] = useState([]);
  const [categories, setCategories] = useState([]);
  const [complaints, setComplaints] = useState([]);
  const [notifications, setNotifications] = useState([]);
  const [submittedComplaint, setSubmittedComplaint] = useState(null);
  const [loading, setLoading] = useState(false);
  const [updatingId, setUpdatingId] = useState(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const loadPortalData = useCallback(async (activeToken, activeUser) => {
    const [categoryData, complaintData, notificationData] = await Promise.all([
      apiRequest("/categories", { token: activeToken }),
      apiRequest(complaintEndpointFor(activeUser), { token: activeToken }),
      apiRequest("/notifications?limit=20", { token: activeToken }),
    ]);
    setCategories(categoryData.categories || []);
    setComplaints(complaintData.items || []);
    setNotifications(notificationData.items || []);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(SESSION_KEY);
    setToken("");
    setUser(null);
    setComplaints([]);
    setCategories([]);
    setNotifications([]);
    setPage("login");
    setAuthMode("login");
    setError("");
    setNotice("");
  }, []);

  useEffect(() => {
    if (!token) return undefined;
    let active = true;

    apiRequest("/auth/me", { token })
      .then(async ({ user: currentUser }) => {
        if (!active) return;
        setUser(currentUser);
        localStorage.setItem(SESSION_KEY, JSON.stringify({ token, user: currentUser }));
        await loadPortalData(token, currentUser);
        if (active) setPage("dashboard");
      })
      .catch((sessionError) => {
        if (!active) return;
        logout();
        setError(sessionError.message || "Please log in again.");
      });

    return () => { active = false; };
  }, [loadPortalData, logout, token]);

  const stats = useMemo(() => ({
    total: complaints.length,
    pending: complaints.filter((item) => ["submitted", "under_review", "assigned"].includes(item.status)).length,
    inProgress: complaints.filter((item) => item.status === "in_progress").length,
    resolved: complaints.filter((item) => item.status === "resolved").length,
  }), [complaints]);

  const mapComplaints = useMemo(
    () => complaints.filter((item) => Number.isFinite(Number(item.latitude)) && Number.isFinite(Number(item.longitude))),
    [complaints]
  );

  async function handleAuthSubmit(event) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setNotice("");
    try {
      const endpoint = authMode === "register" ? "/auth/register" : "/auth/login";
      const body = authMode === "register" ? authForm : { email: authForm.email, password: authForm.password };
      const data = await apiRequest(endpoint, { method: "POST", body });
      localStorage.setItem(SESSION_KEY, JSON.stringify(data));
      setToken(data.token);
      setUser(data.user);
      await loadPortalData(data.token, data.user);
      setAuthForm(initialAuthForm);
      setPage("dashboard");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleRefresh() {
    setLoading(true);
    setError("");
    setNotice("");
    try {
      await loadPortalData(token, user);
      setNotice("Latest data loaded.");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleReportSubmit(event) {
    event.preventDefault();
    setError("");
    setNotice("");
    if (!position) {
      setError("Please select the issue location on the map.");
      return;
    }

    setLoading(true);
    try {
      const body = new FormData();
      Object.entries(reportForm).forEach(([key, value]) => body.append(key, value));
      body.append("latitude", position[0]);
      body.append("longitude", position[1]);
      photos.forEach((photo) => body.append("images", photo));
      const data = await apiRequest("/complaints", { method: "POST", token, body });
      setSubmittedComplaint(data.complaint);
      setReportForm(initialReportForm);
      setPosition(null);
      setPhotos([]);
      await loadPortalData(token, user);
      setPage("success");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleStatusUpdate(complaintId, update) {
    setUpdatingId(complaintId);
    setError("");
    setNotice("");
    try {
      await apiRequest(`/complaints/${complaintId}/status`, { method: "PUT", token, body: update });
      await loadPortalData(token, user);
      setNotice("Complaint status updated and the citizen was notified.");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setUpdatingId(null);
    }
  }

  async function handleMarkAllRead() {
    try {
      await apiRequest("/notifications/read-all", { method: "PUT", token });
      setNotifications((items) => items.map((item) => ({ ...item, is_read: 1 })));
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  function switchAuthMode(mode) {
    setAuthMode(mode);
    setError("");
    setNotice("");
  }

  if (page === "loading") {
    return <div className="loading-page"><div className="loading-spinner" /><p>Loading CivicConnect…</p></div>;
  }

  if (!token || !user) {
    return (
      <div className="login-page">
        <div className="login-card">
          <div className="login-logo">C</div>
          <h1>CivicConnect</h1>
          <p>{authMode === "register" ? "Create your citizen account" : "Citizen & Authority Portal"}</p>
          <Message error={error} notice={notice} />
          <form onSubmit={handleAuthSubmit}>
            {authMode === "register" && (
              <>
                <label className="field-label" htmlFor="full-name">Full name</label>
                <input id="full-name" type="text" value={authForm.full_name} onChange={(event) => setAuthForm({ ...authForm, full_name: event.target.value })} placeholder="Enter your full name" required />
                <label className="field-label" htmlFor="phone">Mobile number</label>
                <input id="phone" type="tel" value={authForm.phone} onChange={(event) => setAuthForm({ ...authForm, phone: event.target.value })} placeholder="Enter your mobile number" />
              </>
            )}
            <label className="field-label" htmlFor="email">Email address</label>
            <input id="email" type="email" value={authForm.email} onChange={(event) => setAuthForm({ ...authForm, email: event.target.value })} placeholder="Enter your email" required />
            <label className="field-label" htmlFor="password">Password</label>
            <input id="password" type="password" value={authForm.password} onChange={(event) => setAuthForm({ ...authForm, password: event.target.value })} placeholder={authMode === "register" ? "8+ characters, upper/lowercase and number" : "Enter your password"} required />
            <button type="submit" disabled={loading}>{loading ? "Please wait…" : authMode === "register" ? "Create account" : "Login"}</button>
          </form>
          <p className="register-text">
            {authMode === "register" ? "Already have an account? " : "Don't have an account? "}
            <button type="button" className="link-button" onClick={() => switchAuthMode(authMode === "register" ? "login" : "register")}>
              {authMode === "register" ? "Login" : "Register"}
            </button>
          </p>
        </div>
      </div>
    );
  }

  if (page === "dashboard") {
    return (
      <PortalLayout page={page} setPage={setPage} user={user} onLogout={logout}>
        <Message error={error} notice={notice} />
        <div className="welcome-section">
          <div><span className="welcome-label">{user.role === "citizen" ? "CITIZEN PORTAL" : "AUTHORITY PORTAL"}</span><h2>Welcome, {user.full_name} 👋</h2><p>{user.role === "citizen" ? "Report issues and follow updates from civic authorities." : "Review department issues and keep citizens informed."}</p></div>
          <div className="toolbar-actions">
            <button className="secondary-button" onClick={handleRefresh} disabled={loading}>Refresh</button>
            {user.role === "citizen" && <button className="primary-report-button" onClick={() => setPage("report")}>+ Report an Issue</button>}
          </div>
        </div>
        <div className="dashboard-cards">
          <div className="dashboard-card"><div className="stat-top"><span>Total Reports</span><div className="stat-icon blue">▤</div></div><strong>{stats.total}</strong><p>Visible civic issues</p></div>
          <div className="dashboard-card"><div className="stat-top"><span>Pending</span><div className="stat-icon orange">◷</div></div><strong>{stats.pending}</strong><p>Waiting for action</p></div>
          <div className="dashboard-card"><div className="stat-top"><span>In Progress</span><div className="stat-icon purple">↻</div></div><strong>{stats.inProgress}</strong><p>Currently being resolved</p></div>
          <div className="dashboard-card"><div className="stat-top"><span>Resolved</span><div className="stat-icon green">✓</div></div><strong>{stats.resolved}</strong><p>Successfully resolved</p></div>
        </div>
        <div className="content-card">
          <div className="card-header"><h2>Quick Actions</h2><p>Manage and review civic complaints.</p></div>
          <div className="quick-actions">
            {user.role === "citizen" && <button className="action-button" onClick={() => setPage("report")}>📝 Report an Issue</button>}
            <button className="action-button" onClick={() => setPage("complaints")}>📋 View Complaints</button>
            <button className="action-button" onClick={() => setPage("nearby")}>📍 Open Issue Map</button>
          </div>
        </div>
        {user.role === "citizen" && <NotificationPanel notifications={notifications} onMarkAllRead={handleMarkAllRead} />}
        <div className="recent-section">
          <div className="recent-header"><div><h2>Recent Complaints</h2><p>Latest civic issues in your portal</p></div><button onClick={() => setPage("complaints")}>View All</button></div>
          {complaints.length === 0 ? (
            <div className="empty-complaints"><div className="empty-icon">✓</div><h3>No complaints yet</h3><p>Submitted civic issues will appear here.</p>{user.role === "citizen" && <button onClick={() => setPage("report")}>Report your first issue</button>}</div>
          ) : complaints.slice(0, 3).map((complaint) => (
            <div className="recent-complaint" key={complaint.id}>
              <div className="recent-icon">📍</div>
              <div className="recent-info"><h3>{complaint.title}</h3><p>{complaint.category_name} • {complaint.address || `${complaint.latitude}, ${complaint.longitude}`}</p></div>
              <span className={`status-badge status-${complaint.status}`}>{statusLabel(complaint.status)}</span>
            </div>
          ))}
        </div>
      </PortalLayout>
    );
  }

  if (page === "report" && user.role === "citizen") {
    return (
      <PortalLayout page={page} setPage={setPage} user={user} onLogout={logout}>
        <div className="page-title"><h2>Report an Issue</h2><p>Provide clear details and choose the exact location on the map.</p></div>
        <Message error={error} notice={notice} />
        <form className="content-card report-form" onSubmit={handleReportSubmit}>
          <label className="field-label" htmlFor="issue-title">Issue title</label>
          <input id="issue-title" type="text" minLength="5" maxLength="150" value={reportForm.title} onChange={(event) => setReportForm({ ...reportForm, title: event.target.value })} placeholder="e.g. Large pothole near the market" required />
          <label className="field-label" htmlFor="category">Category</label>
          <select id="category" value={reportForm.category_id} onChange={(event) => setReportForm({ ...reportForm, category_id: event.target.value })} required>
            <option value="">Select issue category</option>
            {categories.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}
          </select>
          <label className="field-label" htmlFor="address">Address or landmark</label>
          <input id="address" type="text" maxLength="255" value={reportForm.address} onChange={(event) => setReportForm({ ...reportForm, address: event.target.value })} placeholder="Area, road, or nearby landmark" />
          <label className="field-label">Issue location</label>
          <p className="field-help">Click on the map to place the location pin.</p>
          <div className="map-canvas report-map">
            <MapContainer center={DEFAULT_POSITION} zoom={13} scrollWheelZoom>
              <TileLayer attribution="&copy; OpenStreetMap contributors" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
              <LocationPicker onPick={setPosition} />
              {position && <Marker position={position}><Popup>Selected issue location</Popup></Marker>}
            </MapContainer>
          </div>
          {position && <p className="coordinates">Selected: {position[0].toFixed(6)}, {position[1].toFixed(6)}</p>}
          <label className="field-label" htmlFor="description">Description</label>
          <textarea id="description" rows="5" minLength="10" maxLength="3000" value={reportForm.description} onChange={(event) => setReportForm({ ...reportForm, description: event.target.value })} placeholder="Describe the issue, its severity, and nearby landmarks" required />
          <div className="photo-upload">
            <label className="upload-label" htmlFor="photos">📷 Upload issue photos</label>
            <p>Up to 5 JPG, PNG or WEBP files. Each file must fit the server upload limit.</p>
            <input id="photos" type="file" accept="image/jpeg,image/png,image/webp" multiple onChange={(event) => setPhotos(Array.from(event.target.files).slice(0, 5))} />
          </div>
          <button className="action-button submit-button" type="submit" disabled={loading}>{loading ? "Submitting…" : "Submit Complaint"}</button>
        </form>
      </PortalLayout>
    );
  }

  if (page === "success") {
    return (
      <PortalLayout page="report" setPage={setPage} user={user} onLogout={logout}>
        <div className="success-card">
          <div className="success-icon">✓</div><h2>Complaint Submitted Successfully!</h2>
          <p>Your reference number is <strong>{submittedComplaint?.reference_code}</strong>. Use it to track the issue.</p>
          <button className="success-button" onClick={() => setPage("complaints")}>View Complaints</button>
          <button className="success-secondary" onClick={() => setPage("dashboard")}>Back to Dashboard</button>
        </div>
      </PortalLayout>
    );
  }

  if (page === "nearby") {
    const center = mapComplaints.length ? [Number(mapComplaints[0].latitude), Number(mapComplaints[0].longitude)] : DEFAULT_POSITION;
    return (
      <PortalLayout page={page} setPage={setPage} user={user} onLogout={logout}>
        <div className="page-title"><h2>Issue Map 📍</h2><p>View the complaints available to your account on the map.</p></div>
        <div className="content-card map-card">
          {mapComplaints.length === 0 && <div className="map-empty-note">No complaints with map coordinates are available yet.</div>}
          <div className="map-canvas issue-map">
            <MapContainer key={`${center[0]}-${center[1]}-${mapComplaints.length}`} center={center} zoom={13} scrollWheelZoom>
              <TileLayer attribution="&copy; OpenStreetMap contributors" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
              {mapComplaints.map((item) => (
                <Marker key={item.id} position={[Number(item.latitude), Number(item.longitude)]}>
                  <Popup><strong>{item.title}</strong><br />{item.reference_code}<br />{item.category_name}<br />{statusLabel(item.status)}</Popup>
                </Marker>
              ))}
            </MapContainer>
          </div>
        </div>
      </PortalLayout>
    );
  }

  return (
    <PortalLayout page="complaints" setPage={setPage} user={user} onLogout={logout}>
      <div className="page-toolbar">
        <div className="page-title"><h2>{user.role === "citizen" ? "My Complaints" : "Authority Work Queue"}</h2><p>{user.role === "citizen" ? "Track civic issue status and authority updates." : "Change issue status and send clear updates to citizens."}</p></div>
        <button className="secondary-button" onClick={handleRefresh} disabled={loading}>Refresh</button>
      </div>
      <Message error={error} notice={notice} />
      <div className="content-card complaints-list">
        {complaints.length === 0 ? (
          <div className="complaint-empty"><div className="empty-icon">✓</div><h3>No complaints yet</h3><p>Submitted civic issues will appear here.</p>{user.role === "citizen" && <button onClick={() => setPage("report")}>Report an Issue</button>}</div>
        ) : complaints.map((complaint) => (
          <ComplaintCard
            key={complaint.id}
            complaint={complaint}
            canManage={user.role !== "citizen"}
            onUpdateStatus={handleStatusUpdate}
            busy={updatingId === complaint.id}
          />
        ))}
      </div>
    </PortalLayout>
  );
}

export default App;
