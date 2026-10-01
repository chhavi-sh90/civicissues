import { useCallback, useEffect, useMemo, useState } from "react";
import L from "leaflet";
import { Circle, MapContainer, Marker, Popup, TileLayer, useMapEvents } from "react-leaflet";
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

function MetricCard({ label, value, context, tone = "green" }) {
  return (
    <div className={`admin-metric metric-${tone}`}>
      <span>{label}</span>
      <strong>{value ?? "—"}</strong>
      {context && <p>{context}</p>}
    </div>
  );
}

function BarList({ items, labelKey, valueKey = "count", emptyText }) {
  const maximum = Math.max(...items.map((item) => Number(item[valueKey]) || 0), 1);
  if (items.length === 0) return <div className="admin-empty">{emptyText}</div>;
  return (
    <div className="admin-bar-list">
      {items.map((item) => {
        const value = Number(item[valueKey]) || 0;
        return (
          <div className="admin-bar-row" key={`${item[labelKey]}-${value}`}>
            <div><strong>{item[labelKey] || "Unassigned"}</strong><span>{value}</span></div>
            <div className="admin-bar-track"><div style={{ width: `${(value / maximum) * 100}%` }} /></div>
          </div>
        );
      })}
    </div>
  );
}

function TrendChart({ trends }) {
  const maximum = Math.max(...trends.map((item) => Number(item.count) || 0), 1);
  if (trends.length === 0) return <div className="admin-empty">No trend data is available for this date range.</div>;
  return (
    <div className="trend-chart" role="img" aria-label="Complaint counts over time">
      {trends.map((item) => (
        <div className="trend-column" key={item.period}>
          <span>{item.count}</span>
          <div style={{ height: `${Math.max((Number(item.count) / maximum) * 100, 8)}%` }} />
          <small>{item.period}</small>
        </div>
      ))}
    </div>
  );
}

function AdminAnalyticsPage({ data, loading, dateRange, setDateRange, onApply }) {
  const summary = data?.summary || {};
  const resolutionRate = summary.total ? Math.round((Number(summary.resolved || 0) / Number(summary.total)) * 100) : 0;
  return (
    <>
      <div className="page-toolbar admin-page-heading">
        <div className="page-title"><h2>Complaint Analytics</h2><p>Live aggregated trends, workload, and resolution performance.</p></div>
        <form className="date-filter" onSubmit={(event) => { event.preventDefault(); onApply(); }}>
          <label>From<input type="date" value={dateRange.from} onChange={(event) => setDateRange({ ...dateRange, from: event.target.value })} /></label>
          <label>To<input type="date" value={dateRange.to} onChange={(event) => setDateRange({ ...dateRange, to: event.target.value })} /></label>
          <button type="submit" disabled={loading}>{loading ? "Loading…" : "Apply"}</button>
        </form>
      </div>

      <div className="admin-metrics-grid">
        <MetricCard label="Total complaints" value={summary.total ?? 0} context="All reports in range" />
        <MetricCard label="Pending review" value={summary.pending ?? 0} context="Submitted, review, or assigned" tone="amber" />
        <MetricCard label="In progress" value={summary.in_progress ?? 0} context="Active field work" tone="purple" />
        <MetricCard label="Resolved" value={summary.resolved ?? 0} context={`${resolutionRate}% resolution rate`} tone="blue" />
      </div>

      <div className="admin-analytics-grid">
        <section className="admin-panel admin-panel-wide"><div className="admin-panel-heading"><h3>Complaint trend</h3><span>Reports by day</span></div><TrendChart trends={data?.trends || []} /></section>
        <section className="admin-panel"><div className="admin-panel-heading"><h3>By category</h3><span>Reported issue mix</span></div><BarList items={data?.categories || []} labelKey="category_name" emptyText="No category data available." /></section>
        <section className="admin-panel"><div className="admin-panel-heading"><h3>By department</h3><span>Operational workload</span></div><BarList items={data?.departments || []} labelKey="department_name" emptyText="No department data available." /></section>
        <section className="admin-panel"><div className="admin-panel-heading"><h3>Resolution time</h3><span>Average completed turnaround</span></div><div className="resolution-value"><strong>{data?.resolution?.overall_avg_hours ?? "—"}</strong><span>hours overall</span></div><BarList items={data?.resolution?.by_category || []} labelKey="category_name" valueKey="avg_hours" emptyText="No resolved complaints in this range." /></section>
        <section className="admin-panel"><div className="admin-panel-heading"><h3>Status distribution</h3><span>Current case state</span></div><BarList items={Object.entries(summary.by_status || {}).map(([status, count]) => ({ status: statusLabel(status), count }))} labelKey="status" emptyText="No status data available." /></section>
      </div>
    </>
  );
}

function AdminHeatmapPage({ hotspots, complaints }) {
  const complaintPoints = complaints.filter((item) => Number.isFinite(Number(item.latitude)) && Number.isFinite(Number(item.longitude)));
  const points = hotspots.length > 0
    ? hotspots.map((item) => ({ ...item, label: item.categories }))
    : complaintPoints.map((item) => ({ latitude: item.latitude, longitude: item.longitude, count: 1, label: item.category_name }));
  const center = points.length ? [Number(points[0].latitude), Number(points[0].longitude)] : DEFAULT_POSITION;
  const totalDensity = points.reduce((total, item) => total + Number(item.count || 0), 0);
  return (
    <>
      <div className="page-title"><h2>Complaint Heatmap</h2><p>Live geographic concentration based on complaint coordinates.</p></div>
      <div className="heatmap-layout">
        <section className="admin-panel heatmap-map">
          <div className="map-canvas admin-heatmap-canvas">
            <MapContainer key={`${center[0]}-${center[1]}-${points.length}`} center={center} zoom={12} scrollWheelZoom>
              <TileLayer attribution="&copy; OpenStreetMap contributors" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
              {points.map((item, index) => {
                const count = Number(item.count) || 1;
                const tone = count >= 5 ? "#b42318" : count >= 3 ? "#e04f16" : "#f59e0b";
                return (
                  <Circle key={`${item.latitude}-${item.longitude}-${index}`} center={[Number(item.latitude), Number(item.longitude)]} radius={220 + count * 90} pathOptions={{ color: tone, fillColor: tone, fillOpacity: Math.min(0.2 + count * 0.08, 0.62), weight: 2 }}>
                    <Popup><strong>{count} complaint{count === 1 ? "" : "s"}</strong><br />{item.label || "Mixed categories"}</Popup>
                  </Circle>
                );
              })}
            </MapContainer>
          </div>
        </section>
        <aside className="admin-panel heatmap-summary-panel">
          <h3>Density summary</h3>
          <div className="density-total"><strong>{totalDensity}</strong><span>reports mapped</span></div>
          <p>Circle size and opacity increase where reports cluster within roughly 100–220 metres.</p>
          <div className="heat-legend"><span><i className="heat-low" />Single / low density</span><span><i className="heat-medium" />Recurring area</span><span><i className="heat-high" />High-density hotspot</span></div>
        </aside>
      </div>
    </>
  );
}

function AdminAIPage({ complaints, result, loadingId, onAnalyze }) {
  return (
    <>
      <div className="page-title"><h2>AI-Assisted Analysis</h2><p>Classification, priority signals, nearby duplicate detection, and an action recommendation.</p></div>
      <div className="ai-disclosure"><strong>Transparent analysis</strong><span>The page labels whether classification came from a configured ML model or the built-in rule-based fallback.</span></div>
      <div className="ai-layout">
        <section className="admin-panel ai-complaint-list">
          <div className="admin-panel-heading"><h3>Select a complaint</h3><span>{complaints.length} available</span></div>
          {complaints.map((item) => (
            <button className="ai-complaint-button" key={item.id} onClick={() => onAnalyze(item.id)} disabled={loadingId === item.id}>
              <span><strong>{item.reference_code}</strong><small>{item.title}</small></span>
              <em>{loadingId === item.id ? "Analyzing…" : "Analyze"}</em>
            </button>
          ))}
        </section>
        <section className="admin-panel ai-result" aria-live="polite">
          {!result ? (
            <div className="admin-empty">Choose a complaint to generate a live analysis.</div>
          ) : (
            <>
              <div className="admin-panel-heading"><h3>{result.reference_code}</h3><span>{result.title}</span></div>
              <div className="ai-score-grid">
                <MetricCard label="Detected category" value={result.classification.category_name} context={result.classification.method === "ml" ? "External ML model" : "Rule-based fallback"} />
                <MetricCard label="Priority score" value={`${result.priority_score}/100`} context={`${result.risk_level} risk`} tone="amber" />
                <MetricCard label="Confidence" value={result.classification.confidence == null ? "Not supplied" : `${Math.round(result.classification.confidence * 100)}%`} context="Classification confidence" tone="purple" />
                <MetricCard label="Nearby matches" value={result.possible_duplicates} context={`Within ${result.duplicate_radius_meters}m`} tone="blue" />
              </div>
              <div className="ai-recommendation"><strong>Recommended action</strong><p>{result.recommendation}</p></div>
              <div className="ai-signals"><span>Configured priority: <strong>{result.signals.configured_priority}</strong></span><span>Age: <strong>{result.signals.age_days} days</strong></span><span>Urgent terms: <strong>{result.signals.urgent_keywords.join(", ") || "None"}</strong></span></div>
            </>
          )}
        </section>
      </div>
    </>
  );
}

function AdminUsersPage({ users }) {
  return (
    <>
      <div className="page-title"><h2>User Management</h2><p>Citizens, department authorities, and administrators registered in CivicConnect.</p></div>
      <section className="admin-panel users-table-wrap">
        <table className="admin-table">
          <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Department</th><th>Reports</th><th>Status</th></tr></thead>
          <tbody>{users.map((item) => <tr key={item.id}><td>{item.full_name}</td><td>{item.email}</td><td>{item.role.replaceAll("_", " ")}</td><td>{item.department_name || "—"}</td><td>{item.complaint_count}</td><td><span className={item.is_active ? "user-active" : "user-inactive"}>{item.is_active ? "Active" : "Inactive"}</span></td></tr>)}</tbody>
        </table>
        {users.length === 0 && <div className="admin-empty">No users found.</div>}
      </section>
    </>
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
  const [adminAnalytics, setAdminAnalytics] = useState(null);
  const [adminUsers, setAdminUsers] = useState([]);
  const [adminLoading, setAdminLoading] = useState(false);
  const [adminError, setAdminError] = useState("");
  const [dateRange, setDateRange] = useState({ from: "", to: "" });
  const [aiResult, setAiResult] = useState(null);
  const [aiLoadingId, setAiLoadingId] = useState(null);
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

  const loadAdminAnalytics = useCallback(async (activeToken, range = {}) => {
    const query = new URLSearchParams();
    if (range.from) query.set("from", range.from);
    if (range.to) query.set("to", range.to);
    const suffix = query.toString() ? `?${query}` : "";
    const trendQuery = new URLSearchParams(query);
    trendQuery.set("group_by", "day");

    const [summary, categoryData, departmentData, resolution, trendData, hotspotData] = await Promise.all([
      apiRequest(`/analytics/summary${suffix}`, { token: activeToken }),
      apiRequest(`/analytics/by-category${suffix}`, { token: activeToken }),
      apiRequest(`/analytics/by-department${suffix}`, { token: activeToken }),
      apiRequest(`/analytics/resolution-time${suffix}`, { token: activeToken }),
      apiRequest(`/analytics/trends?${trendQuery}`, { token: activeToken }),
      apiRequest(`/analytics/hotspots${suffix}`, { token: activeToken }),
    ]);

    setAdminAnalytics({
      summary,
      categories: categoryData.categories || [],
      departments: departmentData.departments || [],
      resolution,
      trends: trendData.trends || [],
      hotspots: hotspotData.hotspots || [],
    });
  }, []);

  const loadAdminUsers = useCallback(async (activeToken) => {
    const data = await apiRequest("/users?limit=100", { token: activeToken });
    setAdminUsers(data.items || []);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(SESSION_KEY);
    setToken("");
    setUser(null);
    setComplaints([]);
    setCategories([]);
    setNotifications([]);
    setAdminAnalytics(null);
    setAdminUsers([]);
    setAiResult(null);
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

  useEffect(() => {
    if (!token || user?.role !== "admin") return;
    if (!["analytics", "heatmap", "users"].includes(page)) return;

    let active = true;
    const request = Promise.resolve().then(() => {
      if (active) {
        setAdminLoading(true);
        setAdminError("");
      }
      return page === "users" ? loadAdminUsers(token) : loadAdminAnalytics(token, dateRange);
    });
    request
      .catch((requestError) => {
        if (active) setAdminError(requestError.message);
      })
      .finally(() => {
        if (active) setAdminLoading(false);
      });

    return () => { active = false; };
  }, [dateRange, loadAdminAnalytics, loadAdminUsers, page, token, user?.role]);

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

  async function handleApplyAnalytics() {
    setAdminLoading(true);
    setAdminError("");
    try {
      await loadAdminAnalytics(token, dateRange);
    } catch (requestError) {
      setAdminError(requestError.message);
    } finally {
      setAdminLoading(false);
    }
  }

  async function handleAIAnalysis(complaintId) {
    setAiLoadingId(complaintId);
    setAdminError("");
    try {
      const data = await apiRequest(`/analytics/ai-analysis/${complaintId}`, { token });
      setAiResult(data.analysis);
    } catch (requestError) {
      setAdminError(requestError.message);
    } finally {
      setAiLoadingId(null);
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
            {user.role === "admin" && <button className="action-button" onClick={() => setPage("analytics")}>📊 Open Analytics</button>}
            {user.role === "admin" && <button className="action-button" onClick={() => setPage("ai-analysis")}>✦ AI Analysis</button>}
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

  if (page === "analytics" && user.role === "admin") {
    return (
      <PortalLayout page={page} setPage={setPage} user={user} onLogout={logout}>
        <Message error={adminError} />
        <AdminAnalyticsPage data={adminAnalytics} loading={adminLoading} dateRange={dateRange} setDateRange={setDateRange} onApply={handleApplyAnalytics} />
      </PortalLayout>
    );
  }

  if (page === "heatmap" && user.role === "admin") {
    return (
      <PortalLayout page={page} setPage={setPage} user={user} onLogout={logout}>
        <Message error={adminError} />
        {adminLoading && !adminAnalytics ? <div className="admin-loading">Loading heatmap data…</div> : <AdminHeatmapPage hotspots={adminAnalytics?.hotspots || []} complaints={complaints} />}
      </PortalLayout>
    );
  }

  if (page === "ai-analysis" && user.role === "admin") {
    return (
      <PortalLayout page={page} setPage={setPage} user={user} onLogout={logout}>
        <Message error={adminError} />
        <AdminAIPage complaints={complaints} result={aiResult} loadingId={aiLoadingId} onAnalyze={handleAIAnalysis} />
      </PortalLayout>
    );
  }

  if (page === "users" && user.role === "admin") {
    return (
      <PortalLayout page={page} setPage={setPage} user={user} onLogout={logout}>
        <Message error={adminError} />
        {adminLoading && adminUsers.length === 0 ? <div className="admin-loading">Loading users…</div> : <AdminUsersPage users={adminUsers} />}
      </PortalLayout>
    );
  }

  if (user.role === "admin" && ["pending", "in-progress", "resolved"].includes(page)) {
    const statusViews = {
      pending: {
        title: "Pending Complaints",
        description: "Issues waiting for review, assignment, or field action.",
        statuses: ["submitted", "under_review", "assigned"],
      },
      "in-progress": {
        title: "Complaints In Progress",
        description: "Issues currently being handled by civic teams.",
        statuses: ["in_progress"],
      },
      resolved: {
        title: "Resolved Complaints",
        description: "Completed issues and their final citizen-facing updates.",
        statuses: ["resolved"],
      },
    };
    const view = statusViews[page];
    const filteredComplaints = complaints.filter((complaint) => view.statuses.includes(complaint.status));

    return (
      <PortalLayout page={page} setPage={setPage} user={user} onLogout={logout}>
        <div className="page-toolbar">
          <div className="page-title"><h2>{view.title}</h2><p>{view.description}</p></div>
          <button className="secondary-button" onClick={handleRefresh} disabled={loading}>Refresh</button>
        </div>
        <Message error={error} notice={notice} />
        <div className="content-card complaints-list">
          {filteredComplaints.length === 0 ? (
            <div className="complaint-empty"><div className="empty-icon">✓</div><h3>No {view.title.toLowerCase()}</h3><p>This queue is currently clear.</p></div>
          ) : filteredComplaints.map((complaint) => (
            <ComplaintCard
              key={complaint.id}
              complaint={complaint}
              canManage
              onUpdateStatus={handleStatusUpdate}
              busy={updatingId === complaint.id}
            />
          ))}
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
