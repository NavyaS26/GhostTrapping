import { useState, useEffect, useRef } from "react";

const API = ""; // ← paste your ngrok URL here

const apiFetch = (url, options = {}) =>
  fetch(url, {
    ...options,
    headers: {
      "ngrok-skip-browser-warning": "true",
      ...(options.headers || {}),
    },
  });

// ─── Login ────────────────────────────────────────────────────────────────────
export default function App() {
  const [user, setUser] = useState(null);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loading, setLoading] = useState(false);

  const login = async () => {
    setLoading(true);
    setLoginError("");
    try {
      const res = await apiFetch(`${API}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });
      const data = await res.json();
      if (data.error) setLoginError("Invalid credentials");
      else setUser(data);
    } catch {
      setLoginError("Server unreachable. Is the backend running?");
    } finally {
      setLoading(false);
    }
  };

  if (!user)
    return (
      <div style={{ background: "#0a0a0a", minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", fontFamily: "monospace" }}>
        <div style={{ background: "#111", padding: "2.5rem", borderRadius: "12px", border: "1px solid #222", width: "360px" }}>
          <h1 style={{ color: "#ff4444", margin: "0 0 0.5rem" }}>🛡️ GhostTrap</h1>
          <p style={{ color: "#888", margin: "0 0 2rem", fontSize: "0.85rem" }}>Content Protection & Perpetrator Tracing</p>
          <input placeholder="Email" value={email} onChange={e => setEmail(e.target.value)} onKeyDown={e => e.key === "Enter" && login()}
            style={{ width: "100%", padding: "0.75rem", background: "#1a1a1a", border: "1px solid #333", borderRadius: "6px", color: "#fff", marginBottom: "1rem", boxSizing: "border-box", fontFamily: "monospace" }} />
          <input placeholder="Password" type="password" value={password} onChange={e => setPassword(e.target.value)} onKeyDown={e => e.key === "Enter" && login()}
            style={{ width: "100%", padding: "0.75rem", background: "#1a1a1a", border: "1px solid #333", borderRadius: "6px", color: "#fff", marginBottom: "1rem", boxSizing: "border-box", fontFamily: "monospace" }} />
          {loginError && <p style={{ color: "#ff4444", fontSize: "0.8rem", margin: "0 0 0.75rem" }}>{loginError}</p>}
          <button onClick={login} disabled={loading}
            style={{ width: "100%", padding: "0.75rem", background: loading ? "#882222" : "#ff4444", color: "#fff", border: "none", borderRadius: "6px", cursor: loading ? "not-allowed" : "pointer", fontWeight: "bold", fontFamily: "monospace", fontSize: "1rem" }}>
            {loading ? "Logging in..." : "Login"}
          </button>
          <div style={{ marginTop: "1.5rem", color: "#555", fontSize: "0.75rem" }}>
            <p style={{ margin: "0.25rem 0" }}>Victim: victim@ghosttrap.com / victim123</p>
            <p style={{ margin: "0.25rem 0" }}>Predator: predator@ghosttrap.com / predator123</p>
          </div>
        </div>
      </div>
    );

  if (user.role === "predator") return <PredatorView />;
  return <VictimDashboard user={user} />;
}

// ─── Shared helpers ───────────────────────────────────────────────────────────
const tabBtn = (active) => ({
  padding: "0.5rem 1.25rem",
  background: active ? "#ff4444" : "#1a1a1a",
  color: active ? "#fff" : "#888",
  border: `1px solid ${active ? "#ff4444" : "#333"}`,
  borderRadius: "6px", cursor: "pointer",
  fontFamily: "monospace", fontSize: "0.85rem",
  fontWeight: active ? "bold" : "normal",
});

function Modal({ children, onClose, accent = "#ff4444" }) {
  return (
    <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.88)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 9999, fontFamily: "monospace" }}>
      <div style={{ background: "#111", border: `2px solid ${accent}`, borderRadius: "14px", padding: "2rem", width: "420px", boxShadow: `0 0 50px ${accent}44` }}>
        {children}
        <button onClick={onClose} style={{ marginTop: "1.25rem", width: "100%", padding: "0.65rem", background: accent, color: "#fff", border: "none", borderRadius: "6px", cursor: "pointer", fontFamily: "monospace", fontWeight: "bold", fontSize: "0.95rem" }}>
          OK
        </button>
      </div>
    </div>
  );
}

function ScoreBadge({ fake_score, real_score, verdict }) {
  const isFake = verdict === "FAKE";
  return (
    <div style={{ marginTop: "0.6rem", background: isFake ? "#1a0000" : "#0a1a0a", border: `1px solid ${isFake ? "#ff444433" : "#44ff8833"}`, borderRadius: "6px", padding: "0.5rem 0.75rem", fontSize: "0.75rem" }}>
      <span style={{ color: isFake ? "#ff4444" : "#44ff88", fontWeight: "bold" }}>{isFake ? "🤖 DEEPFAKE" : "✅ REAL"} &nbsp;</span>
      <span style={{ color: "#ff6666" }}>Fake {fake_score}%</span>{" · "}
      <span style={{ color: "#44ff88" }}>Real {real_score}%</span>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// PREDATOR VIEW
// ═══════════════════════════════════════════════════════════════════════════════
function PredatorView() {
  const [activeTab, setActiveTab] = useState("feed");
  const [feed, setFeed] = useState([]);
  const [uploaded, setUploaded] = useState([]);   // REAL uploads
  const [fakes, setFakes] = useState([]);          // FAKE detections
  const [fakePopup, setFakePopup] = useState(null);
  const [uploading, setUploading] = useState(false);
  const fileRef = useRef();

  const loadFeed = () =>
    apiFetch(`${API}/feed`).then(r => r.json()).then(d => setFeed(d.feed || [])).catch(() => {});

  const loadFakes = () =>
    apiFetch(`${API}/fake-detections`).then(r => r.json()).then(d => setFakes(d.fakes || [])).catch(() => {});

  useEffect(() => { loadFeed(); }, []);
  useEffect(() => { if (activeTab === "fakes") loadFakes(); }, [activeTab]);

  const handleDownload = async (item) => {
    try {
      await apiFetch(`${API}/download`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ watermark_id: item.watermark_id }),
      });
      window.open(`${API}${item.url}`, "_blank");
    } catch { alert("Download failed."); }
  };

  const handleUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { alert("Images only."); return; }
    setUploading(true);
    const form = new FormData();
    form.append("file", file);
    try {
      const res = await apiFetch(`${API}/upload-suspicious`, { method: "POST", body: form });
      const data = await res.json();
      if (data.verdict === "FAKE") {
        setFakePopup(data);
        // Also add to local fakes list immediately for instant display
        setFakes(prev => [{
          filename: file.name,
          fake_score: data.fake_score,
          real_score: data.real_score,
          uploader_ip: "127.0.0.1 (you)",
          detected_at: new Date().toISOString(),
        }, ...prev]);
      } else {
        // REAL → goes to Uploaded tab
        setUploaded(prev => [{
          filename: file.name,
          fake_score: data.fake_score,
          real_score: data.real_score,
          verdict: "REAL",
          uploaded_at: new Date().toISOString(),
          url: data.url || null,
        }, ...prev]);
        setActiveTab("uploaded");
      }
    } catch { alert("Upload failed. Is backend running?"); }
    finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = "";
    }
  };

  return (
    <div style={{ background: "#0a0a0a", minHeight: "100vh", fontFamily: "monospace", color: "#fff", padding: "2rem" }}>

      {fakePopup && (
        <Modal accent="#ff4444" onClose={() => { setFakePopup(null); setActiveTab("fakes"); }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: "3rem" }}>🚫</div>
            <h2 style={{ color: "#ff4444", margin: "0.5rem 0" }}>DEEPFAKE DETECTED</h2>
            <p style={{ color: "#888", fontSize: "0.85rem", margin: "0 0 1rem" }}>
              This image is artificially manipulated.<br />
              <strong style={{ color: "#ff4444" }}>Upload rejected & image removed.</strong>
            </p>
            <ScoreBadge verdict="FAKE" fake_score={fakePopup.fake_score} real_score={fakePopup.real_score} />
            <p style={{ color: "#ff6666", fontSize: "0.75rem", marginTop: "0.75rem" }}>
              ⚠️ Content owner notified automatically.
            </p>
          </div>
        </Modal>
      )}

      <h1 style={{ color: "#fff", margin: "0 0 0.25rem" }}>📸 GhostTrap — Predator View</h1>
      <p style={{ color: "#888", marginBottom: "1.5rem" }}>Browse the feed · upload images · see scan results</p>

      <div style={{ display: "flex", gap: "0.75rem", marginBottom: "2rem" }}>
        <button style={tabBtn(activeTab === "feed")} onClick={() => setActiveTab("feed")}>🖼️ Feed</button>
        <button style={tabBtn(activeTab === "uploaded")} onClick={() => setActiveTab("uploaded")}>
          ✅ Uploaded {uploaded.length > 0 && `(${uploaded.length})`}
        </button>
        <button style={tabBtn(activeTab === "fakes")} onClick={() => setActiveTab("fakes")}>
          🚫 Fake Detections {fakes.length > 0 && `(${fakes.length})`}
        </button>
      </div>

      {/* ── Feed ── */}
      {activeTab === "feed" && (
        <div>
          {feed.length === 0
            ? <p style={{ color: "#555" }}>No images in feed yet.</p>
            : <div style={{ display: "flex", flexWrap: "wrap", gap: "1.5rem" }}>
                {feed.map((item, i) => (
                  <div key={i} style={{ background: "#111", borderRadius: "8px", border: "1px solid #222", overflow: "hidden", width: "260px" }}>
                    <img src={`${API}${item.url}`} alt="feed" style={{ width: "100%", height: "190px", objectFit: "cover" }} />
                    <div style={{ padding: "0.9rem" }}>
                      <p style={{ color: "#888", fontSize: "0.72rem", margin: "0 0 0.6rem" }}>{new Date(item.uploaded_at).toLocaleString()}</p>
                      <button onClick={() => handleDownload(item)}
                        style={{ background: "#222", color: "#fff", border: "1px solid #444", padding: "0.5rem 1rem", borderRadius: "6px", cursor: "pointer", width: "100%", fontFamily: "monospace" }}>
                        ⬇️ Download
                      </button>
                    </div>
                  </div>
                ))}
              </div>
          }

          <div style={{ marginTop: "3rem", background: "#111", padding: "1.5rem", borderRadius: "8px", border: "1px solid #222" }}>
            <h3 style={{ color: "#fff", marginTop: 0 }}>📤 Upload Image</h3>
            <p style={{ color: "#888", fontSize: "0.85rem", margin: "0 0 1rem" }}>Every upload is scanned for deepfakes instantly</p>
            <input ref={fileRef} type="file" accept="image/*" onChange={handleUpload} disabled={uploading} style={{ color: "#ccc" }} />
            {uploading && <p style={{ color: "#ffaa00", marginTop: "0.75rem" }}>🔍 Scanning image...</p>}
          </div>
        </div>
      )}

      {/* ── Uploaded (REAL only) ── */}
      {activeTab === "uploaded" && (
        <div>
          <p style={{ color: "#888", fontSize: "0.85rem", marginBottom: "1.5rem" }}>Images you uploaded that passed deepfake detection.</p>
          {uploaded.length === 0
            ? <div style={{ background: "#111", border: "1px dashed #333", borderRadius: "8px", padding: "3rem", textAlign: "center", color: "#555" }}>
                <p style={{ fontSize: "1.5rem", margin: "0 0 0.5rem" }}>🖼️</p>
                <p style={{ margin: 0 }}>No real uploads yet. Use Feed → Upload Image.</p>
              </div>
            : <div style={{ display: "flex", flexWrap: "wrap", gap: "1.5rem" }}>
                {uploaded.map((item, i) => (
                  <div key={i} style={{ background: "#111", borderRadius: "8px", border: "1px solid #1a4a1a", overflow: "hidden", width: "260px" }}>
                    {item.url
                      ? <img src={`${API}${item.url}`} alt="uploaded" style={{ width: "100%", height: "190px", objectFit: "cover" }} />
                      : <div style={{ width: "100%", height: "190px", background: "#0a1a0a", display: "flex", alignItems: "center", justifyContent: "center" }}>
                          <span style={{ color: "#44ff88", fontSize: "2.5rem" }}>✅</span>
                        </div>
                    }
                    <div style={{ padding: "0.9rem" }}>
                      <p style={{ color: "#fff", fontSize: "0.8rem", margin: "0 0 0.2rem", fontWeight: "bold" }}>{item.filename}</p>
                      <p style={{ color: "#888", fontSize: "0.7rem", margin: "0 0 0.3rem" }}>{new Date(item.uploaded_at).toLocaleString()}</p>
                      <ScoreBadge verdict="REAL" fake_score={item.fake_score} real_score={item.real_score} />
                    </div>
                  </div>
                ))}
              </div>
          }
        </div>
      )}

      {/* ── Fake Detections ── */}
      {activeTab === "fakes" && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
            <p style={{ color: "#888", margin: 0, fontSize: "0.85rem" }}>Flagged deepfakes — auto-removed from platform.</p>
            <button onClick={loadFakes} style={{ background: "#1a1a1a", color: "#888", border: "1px solid #333", borderRadius: "6px", padding: "0.4rem 1rem", cursor: "pointer", fontFamily: "monospace", fontSize: "0.8rem" }}>↻ Refresh</button>
          </div>
          {fakes.length === 0
            ? <div style={{ background: "#111", border: "1px dashed #333", borderRadius: "8px", padding: "3rem", textAlign: "center", color: "#555" }}>
                <p style={{ fontSize: "1.5rem", margin: "0 0 0.5rem" }}>✅</p>
                <p style={{ margin: 0 }}>No fake images detected yet.</p>
              </div>
            : <div style={{ display: "flex", flexWrap: "wrap", gap: "1.5rem" }}>
                {fakes.map((item, i) => (
                  <div key={i} style={{ background: "#111", borderRadius: "8px", border: "2px solid #ff444433", overflow: "hidden", width: "260px" }}>
                    <div style={{ width: "100%", height: "190px", background: "#1a0000", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: "0.5rem", position: "relative" }}>
                      <span style={{ fontSize: "2.5rem" }}>🚫</span>
                      <span style={{ color: "#ff4444", fontSize: "0.75rem" }}>Image removed</span>
                      <span style={{ position: "absolute", top: 8, right: 8, background: "#ff444422", border: "1px solid #ff444466", color: "#ff4444", fontSize: "0.65rem", padding: "2px 8px", borderRadius: "4px" }}>🤖 DEEPFAKE</span>
                    </div>
                    <div style={{ padding: "0.9rem" }}>
                      <p style={{ color: "#fff", fontSize: "0.8rem", margin: "0 0 0.2rem", fontWeight: "bold" }}>{item.filename}</p>
                      <p style={{ color: "#888", fontSize: "0.7rem", margin: "0 0 0.4rem" }}>📅 {new Date(item.detected_at).toLocaleString()}</p>
                      <ScoreBadge verdict="FAKE" fake_score={item.fake_score} real_score={item.real_score} />
                      <p style={{ color: "#ffaa00", fontSize: "0.7rem", margin: "0.5rem 0 0" }}>IP: {item.uploader_ip}</p>
                    </div>
                  </div>
                ))}
              </div>
          }
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// VICTIM DASHBOARD
// ═══════════════════════════════════════════════════════════════════════════════
function VictimDashboard({ user }) {
  const [activeTab, setActiveTab] = useState("protect");
  const [status, setStatus] = useState("🟢 Monitoring...");
  const [alerts, setAlerts] = useState([]);
  const [activity, setActivity] = useState([]);
  const [perpetrator, setPerpetrator] = useState(null);
  const [legalNotice, setLegalNotice] = useState(null);
  const [emailSent, setEmailSent] = useState(false);
  const [uploadPreview, setUploadPreview] = useState(null);
  const [watermarkId, setWatermarkId] = useState(null);
  const [uploadLoading, setUploadLoading] = useState(false);
  const [myPosts, setMyPosts] = useState([]);
  const [postsLoading, setPostsLoading] = useState(false);
  const [alertPopup, setAlertPopup] = useState(null);
  const ws = useRef(null);
  const reconnectTimer = useRef(null);

  const connectWS = () => {
    const wsUrl = API.replace(/^https/, "wss").replace(/^http/, "ws") + "/ws/dashboard";
    try {
      ws.current = new WebSocket(wsUrl);
    } catch (e) {
      console.error("WS init failed", e);
      reconnectTimer.current = setTimeout(connectWS, 3000);
      return;
    }

    ws.current.onopen = () => {
      console.log("✅ WebSocket connected");
      setStatus("🟢 Monitoring...");
    };

    ws.current.onmessage = (e) => {
      let data;
      try { data = JSON.parse(e.data); } catch { return; }
      console.log("WS message received:", data);

      if (data.type === "DOWNLOAD") {
        const entry = {
          kind: "DOWNLOAD",
          label: "⬇️ Image downloaded by someone",
          watermark_id: data.watermark_id,
          ip: data.ip,
          time: data.timestamp,
        };
        setActivity(prev => [entry, ...prev.slice(0, 19)]);
        setAlerts(prev => [entry, ...prev]);
        setStatus("⚠️ Someone downloaded your image!");
        setAlertPopup({ type: "DOWNLOAD", ...data });
      }

      if (data.type === "ALERT") {
        const entry = {
          kind: "FAKE",
          label: "🚨 Deepfake of your image was detected & removed",
          watermark_id: data.watermark_id,
          ip: data.perpetrator_ip,
          fake_score: data.fake_score,
          real_score: data.real_score,
          time: data.timestamp,
        };
        setActivity(prev => [entry, ...prev.slice(0, 19)]);
        setAlerts(prev => [entry, ...prev]);
        setPerpetrator(data);
        setStatus("🚨 BREACH — Deepfake detected & removed!");
        setAlertPopup({ type: "ALERT", ...data });
        autoLegalNotice(data);
        loadMyPosts();
      }
    };

    ws.current.onerror = (err) => {
      console.error("WS error", err);
      setStatus("🔴 Connection lost — retrying...");
    };

    ws.current.onclose = () => {
      console.log("WS closed, retrying in 3s...");
      reconnectTimer.current = setTimeout(connectWS, 3000);
    };
  };

  useEffect(() => {
    connectWS();
    return () => {
      clearTimeout(reconnectTimer.current);
      if (ws.current) ws.current.close();
    };
  }, []);

  const autoLegalNotice = async (data) => {
    try {
      const res = await apiFetch(`${API}/send-legal-notice`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          watermark_id: data.watermark_id,
          perpetrator_ip: data.perpetrator_ip,
          perpetrator_browser: data.perpetrator_browser,
          timestamp: data.timestamp,
          fake_score: data.fake_score,
        }),
      });
      const result = await res.json();
      setLegalNotice(result.notice);
      setEmailSent(result.email_sent);
    } catch (err) { console.error("Legal notice failed:", err); }
  };

  const loadMyPosts = () => {
    setPostsLoading(true);
    apiFetch(`${API}/my-posts?user_id=${encodeURIComponent(user.email)}`)
      .then(r => r.json())
      .then(d => setMyPosts(d.posts || []))
      .catch(() => setMyPosts([]))
      .finally(() => setPostsLoading(false));
  };

  useEffect(() => { if (activeTab === "posts") loadMyPosts(); }, [activeTab]);

  const uploadProtected = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) { setStatus("❌ Only images allowed."); return; }
    setUploadPreview(URL.createObjectURL(file));
    setUploadLoading(true);
    setWatermarkId(null);
    setStatus("⏳ Embedding watermark...");
    const form = new FormData();
    form.append("file", file);
    form.append("user_id", user.email);
    try {
      const res = await apiFetch(`${API}/upload-protected`, { method: "POST", body: form });
      const data = await res.json();
      setWatermarkId(data.watermark_id);
      setStatus(`✅ Protected — ID: ${data.watermark_id}`);
      if (activeTab === "posts") loadMyPosts();
    } catch {
      setStatus("❌ Upload failed.");
      setUploadPreview(null);
    } finally { setUploadLoading(false); }
  };

  const statusColor = status.includes("BREACH") || status.includes("🔴") ? "#ff4444"
    : status.includes("✅") ? "#44ff88"
    : status.includes("⚠️") ? "#ffaa00" : "#44ff88";

  return (
    <div style={{ background: "#0a0a0a", minHeight: "100vh", fontFamily: "monospace", color: "#fff", padding: "2rem" }}>

      {/* Alert popup */}
      {alertPopup && (
        <Modal accent={alertPopup.type === "ALERT" ? "#ff4444" : "#ffaa00"}
          onClose={() => { setAlertPopup(null); setActiveTab("alerts"); }}>
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: "2.5rem" }}>{alertPopup.type === "ALERT" ? "🚨" : "⚠️"}</div>
            <h2 style={{ color: alertPopup.type === "ALERT" ? "#ff4444" : "#ffaa00", margin: "0.5rem 0 1rem" }}>
              {alertPopup.type === "ALERT" ? "DEEPFAKE BREACH DETECTED!" : "YOUR IMAGE WAS DOWNLOADED"}
            </h2>
            <div style={{ background: "#0a0a0a", borderRadius: "8px", padding: "0.9rem", textAlign: "left", fontSize: "0.8rem" }}>
              <p style={{ margin: "0.2rem 0", color: "#888" }}>Watermark ID: <strong style={{ color: "#fff" }}>{alertPopup.watermark_id}</strong></p>
              <p style={{ margin: "0.2rem 0", color: "#888" }}>
                {alertPopup.type === "ALERT" ? "Offender" : "Downloader"} IP:{" "}
                <strong style={{ color: alertPopup.type === "ALERT" ? "#ff4444" : "#ffaa00" }}>
                  {alertPopup.type === "ALERT" ? alertPopup.perpetrator_ip : alertPopup.ip}
                </strong>
              </p>
              <p style={{ margin: "0.2rem 0", color: "#888" }}>Time: <strong style={{ color: "#fff" }}>{alertPopup.timestamp}</strong></p>
              {alertPopup.type === "ALERT" && <>
                <p style={{ margin: "0.2rem 0", color: "#888" }}>Fake Score: <strong style={{ color: "#ff4444" }}>{alertPopup.fake_score}%</strong></p>
                <p style={{ margin: "0.75rem 0 0", color: "#44ff88", fontWeight: "bold" }}>✅ Auto-removed. Legal notice sent.</p>
              </>}
              {alertPopup.type === "DOWNLOAD" && (
                <p style={{ margin: "0.75rem 0 0", color: "#ffaa00" }}>⚠️ GhostTrap is monitoring for misuse.</p>
              )}
            </div>
          </div>
        </Modal>
      )}

      {/* Header */}
      <div style={{ borderBottom: "1px solid #222", paddingBottom: "1rem", marginBottom: "1.5rem", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <h1 style={{ color: "#ff4444", margin: 0 }}>🛡️ GhostTrap</h1>
          <p style={{ color: "#888", margin: "0.2rem 0 0", fontSize: "0.85rem" }}>Victim Dashboard — {user.email}</p>
        </div>
        <span style={{ color: statusColor, fontWeight: "bold", fontSize: "0.85rem" }}>{status}</span>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: "0.75rem", marginBottom: "2rem" }}>
        <button style={tabBtn(activeTab === "protect")} onClick={() => setActiveTab("protect")}>🔒 Protect Image</button>
        <button style={tabBtn(activeTab === "posts")} onClick={() => setActiveTab("posts")}>
          🖼️ My Posts {myPosts.length > 0 && `(${myPosts.length})`}
        </button>
        <button style={tabBtn(activeTab === "alerts")} onClick={() => setActiveTab("alerts")}>
          🚨 Alerts {alerts.length > 0 && `(${alerts.length})`}
        </button>
      </div>

      {/* ── Protect ── */}
      {activeTab === "protect" && (
        <div style={{ display: "flex", gap: "2rem", flexWrap: "wrap" }}>
          <div style={{ background: "#111", padding: "1.5rem", borderRadius: "8px", flex: "1 1 300px", border: "1px solid #222" }}>
            <h3 style={{ color: "#44ff88", marginTop: 0 }}>🔒 Register Protected Image</h3>
            <p style={{ color: "#888", fontSize: "0.85rem" }}>Invisible watermark embedded — appears on public feed</p>
            <input type="file" accept="image/*" onChange={uploadProtected} disabled={uploadLoading} style={{ color: "#fff" }} />
            {uploadLoading && <p style={{ color: "#ffaa00", fontSize: "0.8rem", marginTop: "0.75rem" }}>⏳ Embedding watermark...</p>}
            {uploadPreview && !uploadLoading && (
              <div style={{ marginTop: "1rem" }}>
                <img src={uploadPreview} alt="protected" style={{ width: "100%", maxHeight: "180px", objectFit: "cover", borderRadius: "6px" }} />
                {watermarkId && (
                  <div style={{ marginTop: "0.75rem", background: "#0a1a0a", border: "1px solid #1a4a1a", borderRadius: "6px", padding: "0.75rem" }}>
                    <p style={{ color: "#44ff88", fontSize: "0.8rem", margin: 0 }}>✅ Watermark embedded</p>
                    <p style={{ color: "#888", fontSize: "0.75rem", margin: "0.25rem 0 0" }}>ID: <span style={{ color: "#fff" }}>{watermarkId}</span></p>
                  </div>
                )}
              </div>
            )}
          </div>

          <div style={{ background: "#111", padding: "1.5rem", borderRadius: "8px", flex: "1 1 300px", border: "1px solid #222" }}>
            <h3 style={{ color: "#ffaa00", marginTop: 0 }}>📡 Live Activity</h3>
            {activity.length === 0
              ? <p style={{ color: "#555", fontSize: "0.85rem" }}>Waiting for activity...</p>
              : activity.map((a, i) => (
                  <div key={i} style={{ borderBottom: "1px solid #1a1a1a", padding: "0.5rem 0", fontSize: "0.78rem" }}>
                    <span style={{ color: a.kind === "FAKE" ? "#ff4444" : "#ffaa00" }}>{a.label}</span>
                    <br />
                    <span style={{ color: "#666" }}>ID: {a.watermark_id} · IP: {a.ip}</span>
                    <br />
                    <span style={{ color: "#444", fontSize: "0.7rem" }}>{a.time}</span>
                  </div>
                ))
            }
          </div>
        </div>
      )}

      {/* ── My Posts ── */}
      {activeTab === "posts" && (
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1.5rem" }}>
            <h3 style={{ margin: 0 }}>Your Protected Images</h3>
            <button onClick={loadMyPosts} style={{ background: "#1a1a1a", color: "#888", border: "1px solid #333", borderRadius: "6px", padding: "0.4rem 1rem", cursor: "pointer", fontFamily: "monospace", fontSize: "0.8rem" }}>↻ Refresh</button>
          </div>
          {postsLoading
            ? <p style={{ color: "#555" }}>Loading...</p>
            : myPosts.length === 0
              ? <div style={{ background: "#111", border: "1px dashed #333", borderRadius: "8px", padding: "3rem", textAlign: "center", color: "#555" }}>
                  <p style={{ fontSize: "1.5rem", margin: "0 0 0.5rem" }}>🖼️</p><p style={{ margin: 0 }}>No protected images yet.</p>
                </div>
              : <div style={{ display: "flex", flexWrap: "wrap", gap: "1.5rem" }}>
                  {myPosts.map((item, i) => (
                    <div key={i} style={{ background: "#111", borderRadius: "8px", border: "1px solid #222", overflow: "hidden", width: "260px" }}>
                      <div style={{ position: "relative" }}>
                        <img src={`${API}${item.url}`} alt="post" style={{ width: "100%", height: "190px", objectFit: "cover" }} />
                        <span style={{ position: "absolute", top: 8, right: 8, background: "#44ff8822", border: "1px solid #44ff8855", color: "#44ff88", fontSize: "0.65rem", padding: "2px 8px", borderRadius: "4px" }}>🔒 PROTECTED</span>
                      </div>
                      <div style={{ padding: "0.9rem" }}>
                        <p style={{ color: "#fff", fontSize: "0.8rem", margin: "0 0 0.2rem", fontWeight: "bold" }}>{item.filename}</p>
                        <p style={{ color: "#555", fontSize: "0.68rem", margin: "0 0 0.2rem" }}>ID: {item.watermark_id}</p>
                        <p style={{ color: "#888", fontSize: "0.68rem", margin: "0 0 0.6rem" }}>📅 {new Date(item.uploaded_at).toLocaleString()}</p>
                        <div style={{ background: item.breach_count > 0 ? "#1a0000" : "#0a0a0a", border: `1px solid ${item.breach_count > 0 ? "#ff444444" : "#1a1a1a"}`, borderRadius: "4px", padding: "0.4rem 0.6rem", fontSize: "0.72rem" }}>
                          {item.breach_count > 0
                            ? <span style={{ color: "#ff4444" }}>🚨 {item.breach_count} breach{item.breach_count > 1 ? "es" : ""} detected</span>
                            : <span style={{ color: "#555" }}>✓ No breaches</span>}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
          }
        </div>
      )}

      {/* ── Alerts ── */}
      {activeTab === "alerts" && (
        <div>
          {perpetrator && (
            <div style={{ background: "#1a0000", border: "2px solid #ff4444", padding: "1.5rem", borderRadius: "8px", marginBottom: "2rem" }}>
              <h2 style={{ color: "#ff4444", marginTop: 0 }}>🚨 Latest Breach — Deepfake Detected & Removed</h2>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                {[
                  ["Watermark ID", perpetrator.watermark_id, "#fff"],
                  ["Offender IP", perpetrator.perpetrator_ip, "#ff4444"],
                  ["Fake Score", `${perpetrator.fake_score}%`, "#ff4444"],
                  ["Real Score", `${perpetrator.real_score}%`, "#44ff88"],
                  ["Auto Removed", "✅ Yes", "#44ff88"],
                  ["Detected At", perpetrator.timestamp, "#fff"],
                ].map(([label, val, color]) => (
                  <div key={label}>
                    <p style={{ color: "#888", margin: "0.2rem 0", fontSize: "0.8rem" }}>{label}</p>
                    <p style={{ color, fontWeight: "bold", margin: 0, fontSize: "0.85rem", wordBreak: "break-all" }}>{val}</p>
                  </div>
                ))}
              </div>
              <div style={{ marginTop: "1rem" }}>
                {emailSent
                  ? <p style={{ color: "#44ff88", margin: 0, fontSize: "0.85rem" }}>✅ Legal notice auto-sent to offender's email.</p>
                  : <p style={{ color: "#ffaa00", margin: 0, fontSize: "0.85rem" }}>⏳ Sending legal notice automatically...</p>}
              </div>
              {legalNotice && (
                <div style={{ background: "#0a0a0a", border: "1px solid #333", borderRadius: "6px", padding: "1rem", marginTop: "1rem", whiteSpace: "pre-wrap", fontSize: "0.75rem", color: "#bbb", maxHeight: "220px", overflowY: "auto" }}>
                  {legalNotice}
                </div>
              )}
            </div>
          )}

          {alerts.length === 0
            ? <div style={{ background: "#111", border: "1px dashed #333", borderRadius: "8px", padding: "3rem", textAlign: "center", color: "#555" }}>
                <p style={{ fontSize: "1.5rem", margin: "0 0 0.5rem" }}>✅</p>
                <p style={{ margin: 0 }}>No alerts yet. GhostTrap is watching.</p>
              </div>
            : <div style={{ background: "#111", padding: "1.5rem", borderRadius: "8px", border: "1px solid #222" }}>
                <h3 style={{ color: "#fff", marginTop: 0 }}>📋 All Alerts ({alerts.length})</h3>
                {alerts.map((a, i) => (
                  <div key={i} style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", borderBottom: "1px solid #1a1a1a", padding: "0.65rem 0", fontSize: "0.82rem", gap: "1rem" }}>
                    <div>
                      <span style={{ color: a.kind === "FAKE" ? "#ff4444" : "#ffaa00", fontWeight: "bold" }}>{a.label}</span>
                      <br />
                      <span style={{ color: "#555", fontSize: "0.72rem" }}>
                        ID: {a.watermark_id} · IP: {a.ip}
                        {a.fake_score !== undefined && ` · Fake: ${a.fake_score}%`}
                      </span>
                    </div>
                    <span style={{ color: "#444", fontSize: "0.7rem", whiteSpace: "nowrap" }}>{a.time}</span>
                  </div>
                ))}
              </div>
          }
        </div>
      )}
    </div>
  );
}