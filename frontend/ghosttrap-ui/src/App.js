import { useState, useEffect, useRef } from "react";

const API = import.meta.env.VITE_API_URL || "http://localhost:8000";

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
      const res = await fetch(`${API}/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      if (data.error) {
        setLoginError("Invalid credentials");
      } else {
        setUser(data);
      }
    } catch (err) {
      setLoginError("Server unreachable. Is the backend running?");
    } finally {
      setLoading(false);
    }
  };

  const handleKey = (e) => { if (e.key === "Enter") login(); };

  if (!user) return (
    <div style={{
      background: "#0a0a0a", minHeight: "100vh",
      display: "flex", alignItems: "center",
      justifyContent: "center", fontFamily: "monospace"
    }}>
      <div style={{
        background: "#111", padding: "2.5rem",
        borderRadius: "12px", border: "1px solid #222",
        width: "360px"
      }}>
        <h1 style={{ color: "#ff4444", margin: "0 0 0.5rem" }}>🛡️ GhostTrap</h1>
        <p style={{ color: "#888", margin: "0 0 2rem", fontSize: "0.85rem" }}>
          Content Protection & Perpetrator Tracing
        </p>
        <input
          placeholder="Email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          onKeyDown={handleKey}
          style={{
            width: "100%", padding: "0.75rem",
            background: "#1a1a1a", border: "1px solid #333",
            borderRadius: "6px", color: "#fff",
            marginBottom: "1rem", boxSizing: "border-box",
            fontFamily: "monospace"
          }}
        />
        <input
          placeholder="Password"
          type="password"
          value={password}
          onChange={e => setPassword(e.target.value)}
          onKeyDown={handleKey}
          style={{
            width: "100%", padding: "0.75rem",
            background: "#1a1a1a", border: "1px solid #333",
            borderRadius: "6px", color: "#fff",
            marginBottom: "1rem", boxSizing: "border-box",
            fontFamily: "monospace"
          }}
        />
        {loginError && (
          <p style={{ color: "#ff4444", fontSize: "0.8rem", margin: "0 0 0.75rem" }}>{loginError}</p>
        )}
        <button
          onClick={login}
          disabled={loading}
          style={{
            width: "100%", padding: "0.75rem",
            background: loading ? "#882222" : "#ff4444",
            color: "#fff", border: "none", borderRadius: "6px",
            cursor: loading ? "not-allowed" : "pointer",
            fontWeight: "bold", fontFamily: "monospace", fontSize: "1rem"
          }}
        >
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

// ─── Predator View ────────────────────────────────────────────────────────────

function PredatorView() {
  const [feed, setFeed] = useState([]);
  const [uploadStatus, setUploadStatus] = useState("");

  const loadFeed = () => {
    fetch(`${API}/feed`)
      .then(r => r.json())
      .then(d => setFeed(d.feed || []))
      .catch(() => {});
  };

  useEffect(() => { loadFeed(); }, []);

  const handleDownload = async (item) => {
    try {
      await fetch(`${API}/download`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ watermark_id: item.watermark_id })
      });
      window.open(`${API}${item.url}`, "_blank");
    } catch (err) {
      alert("Download failed.");
    }
  };

  const handleUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setUploadStatus("❌ Only image files are allowed.");
      return;
    }
    setUploadStatus("Uploading...");
    const form = new FormData();
    form.append("file", file);
    try {
      await fetch(`${API}/upload-suspicious`, { method: "POST", body: form });
      setUploadStatus("✅ Uploaded successfully!");
    } catch {
      setUploadStatus("❌ Upload failed.");
    }
  };

  return (
    <div style={{
      background: "#0a0a0a", minHeight: "100vh",
      fontFamily: "monospace", color: "#fff", padding: "2rem"
    }}>
      <h1 style={{ color: "#fff", margin: "0 0 0.5rem" }}>📸 Image Feed</h1>
      <p style={{ color: "#888", marginBottom: "2rem" }}>Browse and download images</p>

      {feed.length === 0 ? (
        <p style={{ color: "#555" }}>No images in feed yet.</p>
      ) : (
        <div style={{ display: "flex", flexWrap: "wrap", gap: "1.5rem" }}>
          {feed.map((item, i) => (
            <div key={i} style={{
              background: "#111", borderRadius: "8px",
              border: "1px solid #222", overflow: "hidden", width: "280px"
            }}>
              <img
                src={`${API}${item.url}`}
                alt="feed"
                style={{ width: "100%", height: "200px", objectFit: "cover" }}
              />
              <div style={{ padding: "1rem" }}>
                <p style={{ color: "#888", fontSize: "0.75rem", margin: "0 0 0.75rem" }}>
                  Posted: {new Date(item.uploaded_at).toLocaleString()}
                </p>
                <button
                  onClick={() => handleDownload(item)}
                  style={{
                    background: "#222", color: "#fff",
                    border: "1px solid #444", padding: "0.5rem 1rem",
                    borderRadius: "6px", cursor: "pointer",
                    width: "100%", fontFamily: "monospace"
                  }}
                >
                  ⬇️ Download
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <div style={{
        marginTop: "3rem", background: "#111",
        padding: "1.5rem", borderRadius: "8px", border: "1px solid #222"
      }}>
        <h3 style={{ color: "#fff", marginTop: 0 }}>📤 Upload Suspicious Image</h3>
        <input type="file" accept="image/*" onChange={handleUpload}
          style={{ color: "#fff" }} />
        {uploadStatus && (
          <p style={{ color: "#44ff88", marginTop: "0.5rem" }}>{uploadStatus}</p>
        )}
      </div>
    </div>
  );
}

// ─── Victim Dashboard ─────────────────────────────────────────────────────────

function VictimDashboard({ user }) {
  const [activeTab, setActiveTab] = useState("protect"); // "protect" | "posts" | "alerts"
  const [status, setStatus] = useState("🟢 Monitoring...");
  const [alerts, setAlerts] = useState([]);
  const [activity, setActivity] = useState([]);
  const [perpetrator, setPerpetrator] = useState(null);
  const [legalNotice, setLegalNotice] = useState(null);
  const [emailSent, setEmailSent] = useState(false);

  // Upload state
  const [uploadPreview, setUploadPreview] = useState(null);
  const [watermarkId, setWatermarkId] = useState(null);
  const [uploadLoading, setUploadLoading] = useState(false);

  // My posts
  const [myPosts, setMyPosts] = useState([]);
  const [postsLoading, setPostsLoading] = useState(false);

  const ws = useRef(null);
  const reconnectTimer = useRef(null);

  // ── WebSocket with reconnect ──
  const connectWS = () => {
    const wsUrl = (API.replace(/^http/, "ws")) + "/ws/dashboard";
    ws.current = new WebSocket(wsUrl);

    ws.current.onmessage = (e) => {
      const data = JSON.parse(e.data);
      if (data.type === "ALERT") {
        setPerpetrator(data);
        setAlerts(prev => [data, ...prev]);
        setStatus("🚨 BREACH DETECTED");
      }
      if (data.type === "DOWNLOAD") {
        setActivity(prev => [{
          event: "Download detected",
          ip: data.ip,
          time: data.timestamp
        }, ...prev.slice(0, 9)]);
        setStatus("⚠️ Someone downloaded your image");
      }
    };

    ws.current.onerror = () => {
      setStatus("🔴 Connection lost — retrying...");
    };

    ws.current.onclose = () => {
      reconnectTimer.current = setTimeout(connectWS, 3000);
    };
  };

  useEffect(() => {
    connectWS();
    return () => {
      clearTimeout(reconnectTimer.current);
      ws.current?.close();
    };
  }, []);

  // ── Load my posts ──
  const loadMyPosts = () => {
    setPostsLoading(true);
    fetch(`${API}/my-posts?user_id=${encodeURIComponent(user.email)}`)
      .then(r => r.json())
      .then(d => setMyPosts(d.posts || []))
      .catch(() => setMyPosts([]))
      .finally(() => setPostsLoading(false));
  };

  useEffect(() => {
    if (activeTab === "posts") loadMyPosts();
  }, [activeTab]);

  // ── Upload protected image ──
  const uploadProtected = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      setStatus("❌ Only image files are allowed.");
      return;
    }

    setUploadPreview(URL.createObjectURL(file));
    setUploadLoading(true);
    setWatermarkId(null);
    setStatus("⏳ Embedding watermark...");

    const form = new FormData();
    form.append("file", file);
    form.append("user_id", user.email);   // FIX: use actual user id, not hardcoded

    try {
      const res = await fetch(`${API}/upload-protected`, { method: "POST", body: form });
      if (!res.ok) throw new Error("Upload failed");
      const data = await res.json();
      setWatermarkId(data.watermark_id);
      setStatus(`✅ Protected — ID: ${data.watermark_id}`);
      // Refresh my posts if on that tab or switch to posts to show new entry
      if (activeTab === "posts") loadMyPosts();
    } catch (err) {
      setStatus("❌ Upload failed. Try again.");
      setUploadPreview(null);
    } finally {
      setUploadLoading(false);
    }
  };

  // ── Send legal notice ──
  const sendLegalNotice = async () => {
    if (!perpetrator) return;
    try {
      const res = await fetch(`${API}/send-legal-notice`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          watermark_id: perpetrator.watermark_id,
          perpetrator_ip: perpetrator.perpetrator_ip,
          perpetrator_browser: perpetrator.perpetrator_browser,
          timestamp: perpetrator.timestamp
        })
      });
      const data = await res.json();
      setLegalNotice(data.notice);
      setEmailSent(data.email_sent);
    } catch {
      alert("Failed to send legal notice.");
    }
  };

  const tabStyle = (tab) => ({
    padding: "0.5rem 1.25rem",
    background: activeTab === tab ? "#ff4444" : "#1a1a1a",
    color: activeTab === tab ? "#fff" : "#888",
    border: "1px solid",
    borderColor: activeTab === tab ? "#ff4444" : "#333",
    borderRadius: "6px",
    cursor: "pointer",
    fontFamily: "monospace",
    fontSize: "0.85rem",
    fontWeight: activeTab === tab ? "bold" : "normal"
  });

  return (
    <div style={{
      background: "#0a0a0a", minHeight: "100vh",
      fontFamily: "monospace", color: "#fff", padding: "2rem"
    }}>

      {/* Header */}
      <div style={{
        borderBottom: "1px solid #222", paddingBottom: "1rem",
        marginBottom: "1.5rem", display: "flex",
        justifyContent: "space-between", alignItems: "center"
      }}>
        <div>
          <h1 style={{ color: "#ff4444", margin: 0 }}>🛡️ GhostTrap</h1>
          <p style={{ color: "#888", margin: "0.25rem 0 0", fontSize: "0.85rem" }}>
            Victim Protection Dashboard — {user.email}
          </p>
        </div>
        <p style={{
          color: status.includes("BREACH") ? "#ff4444" :
                 status.includes("✅") ? "#44ff88" :
                 status.includes("⚠️") ? "#ffaa00" :
                 status.includes("🔴") ? "#ff4444" : "#44ff88",
          fontWeight: "bold", margin: 0, fontSize: "0.85rem", textAlign: "right"
        }}>
          {status}
        </p>
      </div>

      {/* Tabs */}
      <div style={{ display: "flex", gap: "0.75rem", marginBottom: "2rem" }}>
        <button style={tabStyle("protect")} onClick={() => setActiveTab("protect")}>
          🔒 Protect Image
        </button>
        <button style={tabStyle("posts")} onClick={() => setActiveTab("posts")}>
          🖼️ My Posts {myPosts.length > 0 && `(${myPosts.length})`}
        </button>
        <button style={tabStyle("alerts")} onClick={() => setActiveTab("alerts")}>
          🚨 Alerts {alerts.length > 0 && `(${alerts.length})`}
        </button>
      </div>

      {/* ── Tab: Protect ── */}
      {activeTab === "protect" && (
        <div style={{ display: "flex", gap: "2rem", flexWrap: "wrap" }}>

          {/* Upload card */}
          <div style={{
            background: "#111", padding: "1.5rem", borderRadius: "8px",
            flex: "1 1 320px", border: "1px solid #222", minWidth: "280px"
          }}>
            <h3 style={{ color: "#44ff88", marginTop: 0 }}>🔒 Register Protected Image</h3>
            <p style={{ color: "#888", fontSize: "0.85rem" }}>
              Your image gets an invisible watermark and appears on the public feed.
            </p>
            <input
              type="file" accept="image/*"
              onChange={uploadProtected}
              disabled={uploadLoading}
              style={{ color: "#fff" }}
            />
            {uploadLoading && (
              <p style={{ color: "#ffaa00", fontSize: "0.8rem", marginTop: "0.75rem" }}>
                ⏳ Embedding watermark, please wait...
              </p>
            )}
            {uploadPreview && !uploadLoading && (
              <div style={{ marginTop: "1rem" }}>
                <img src={uploadPreview} alt="protected"
                  style={{ width: "100%", maxHeight: "180px", objectFit: "cover", borderRadius: "6px" }} />
                {watermarkId && (
                  <div style={{
                    marginTop: "0.75rem", background: "#0a1a0a",
                    border: "1px solid #1a4a1a", borderRadius: "6px", padding: "0.75rem"
                  }}>
                    <p style={{ color: "#44ff88", fontSize: "0.8rem", margin: 0 }}>
                      ✅ Watermark embedded
                    </p>
                    <p style={{ color: "#888", fontSize: "0.75rem", margin: "0.25rem 0 0" }}>
                      ID: <span style={{ color: "#fff" }}>{watermarkId}</span>
                    </p>
                    <p style={{ color: "#555", fontSize: "0.7rem", margin: "0.25rem 0 0" }}>
                      Now visible on predator feed
                    </p>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Live activity */}
          <div style={{
            background: "#111", padding: "1.5rem", borderRadius: "8px",
            flex: "1 1 320px", border: "1px solid #222", minWidth: "280px"
          }}>
            <h3 style={{ color: "#ffaa00", marginTop: 0 }}>📡 Live Activity Feed</h3>
            {activity.length === 0 ? (
              <p style={{ color: "#555", fontSize: "0.85rem" }}>Waiting for activity...</p>
            ) : (
              activity.map((a, i) => (
                <div key={i} style={{
                  borderBottom: "1px solid #1a1a1a",
                  padding: "0.5rem 0", fontSize: "0.8rem", color: "#888"
                }}>
                  ⬇️ {a.event} — IP: <span style={{ color: "#ffaa00" }}>{a.ip}</span>
                  <br />
                  <span style={{ fontSize: "0.7rem" }}>{a.time}</span>
                </div>
              ))
            )}
          </div>
        </div>
      )}

      {/* ── Tab: My Posts ── */}
      {activeTab === "posts" && (
        <div>
          <div style={{
            display: "flex", justifyContent: "space-between",
            alignItems: "center", marginBottom: "1.5rem"
          }}>
            <h3 style={{ margin: 0, color: "#fff" }}>Your Protected Images</h3>
            <button onClick={loadMyPosts} style={{
              background: "#1a1a1a", color: "#888", border: "1px solid #333",
              borderRadius: "6px", padding: "0.4rem 1rem",
              cursor: "pointer", fontFamily: "monospace", fontSize: "0.8rem"
            }}>
              ↻ Refresh
            </button>
          </div>

          {postsLoading ? (
            <p style={{ color: "#555" }}>Loading your posts...</p>
          ) : myPosts.length === 0 ? (
            <div style={{
              background: "#111", border: "1px dashed #333",
              borderRadius: "8px", padding: "3rem",
              textAlign: "center", color: "#555"
            }}>
              <p style={{ fontSize: "1.5rem", margin: "0 0 0.5rem" }}>🖼️</p>
              <p style={{ margin: 0 }}>No protected images yet.</p>
              <p style={{ margin: "0.5rem 0 0", fontSize: "0.8rem" }}>
                Go to <strong style={{ color: "#888" }}>Protect Image</strong> to upload one.
              </p>
            </div>
          ) : (
            <div style={{ display: "flex", flexWrap: "wrap", gap: "1.5rem" }}>
              {myPosts.map((item, i) => (
                <div key={i} style={{
                  background: "#111", borderRadius: "8px",
                  border: "1px solid #222", overflow: "hidden", width: "280px"
                }}>
                  <div style={{ position: "relative" }}>
                    <img
                      src={`${API}${item.url}`}
                      alt="my post"
                      style={{ width: "100%", height: "200px", objectFit: "cover" }}
                    />
                    <span style={{
                      position: "absolute", top: "8px", right: "8px",
                      background: "#44ff8822", border: "1px solid #44ff8855",
                      color: "#44ff88", fontSize: "0.65rem", padding: "2px 8px",
                      borderRadius: "4px"
                    }}>
                      🔒 PROTECTED
                    </span>
                  </div>
                  <div style={{ padding: "1rem" }}>
                    <p style={{ color: "#fff", fontSize: "0.8rem", margin: "0 0 0.25rem", fontWeight: "bold" }}>
                      {item.filename}
                    </p>
                    <p style={{ color: "#555", fontSize: "0.7rem", margin: "0 0 0.5rem" }}>
                      ID: {item.watermark_id}
                    </p>
                    <p style={{ color: "#888", fontSize: "0.7rem", margin: "0 0 0.75rem" }}>
                      📅 {new Date(item.uploaded_at).toLocaleString()}
                    </p>
                    <div style={{
                      background: item.breach_count > 0 ? "#1a0000" : "#0a0a0a",
                      border: `1px solid ${item.breach_count > 0 ? "#ff444444" : "#1a1a1a"}`,
                      borderRadius: "4px", padding: "0.4rem 0.6rem",
                      fontSize: "0.7rem"
                    }}>
                      {item.breach_count > 0 ? (
                        <span style={{ color: "#ff4444" }}>
                          🚨 {item.breach_count} breach{item.breach_count > 1 ? "es" : ""} detected
                        </span>
                      ) : (
                        <span style={{ color: "#555" }}>✓ No breaches detected</span>
                      )}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* ── Tab: Alerts ── */}
      {activeTab === "alerts" && (
        <div>
          {/* Breach alert banner */}
          {perpetrator && (
            <div style={{
              background: "#1a0000", border: "2px solid #ff4444",
              padding: "1.5rem", borderRadius: "8px", marginBottom: "2rem"
            }}>
              <h2 style={{ color: "#ff4444", marginTop: 0 }}>🚨 CONTENT COMPROMISED</h2>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
                <div>
                  <p style={{ color: "#888", margin: "0.25rem 0" }}>Watermark ID</p>
                  <p style={{ color: "#fff", fontWeight: "bold" }}>{perpetrator.watermark_id}</p>
                </div>
                <div>
                  <p style={{ color: "#888", margin: "0.25rem 0" }}>IP Address</p>
                  <p style={{ color: "#ff4444", fontWeight: "bold" }}>{perpetrator.perpetrator_ip}</p>
                </div>
                <div>
                  <p style={{ color: "#888", margin: "0.25rem 0" }}>Browser</p>
                  <p style={{ color: "#fff", fontWeight: "bold", fontSize: "0.8rem" }}>{perpetrator.perpetrator_browser}</p>
                </div>
                <div>
                  <p style={{ color: "#888", margin: "0.25rem 0" }}>Detected At</p>
                  <p style={{ color: "#fff", fontWeight: "bold" }}>{perpetrator.timestamp}</p>
                </div>
              </div>

              <button
                onClick={sendLegalNotice}
                style={{
                  background: "#ff4444", color: "#fff",
                  border: "none", padding: "0.75rem 2rem",
                  borderRadius: "6px", cursor: "pointer",
                  marginTop: "1.5rem", fontSize: "1rem",
                  fontWeight: "bold", fontFamily: "monospace"
                }}
              >
                ⚖️ Send Legal Notice
              </button>

              {emailSent && (
                <p style={{ color: "#44ff88", marginTop: "0.75rem", fontSize: "0.85rem" }}>
                  ✅ Legal notice sent!
                </p>
              )}

              {legalNotice && (
                <div style={{
                  background: "#0a0a0a", border: "1px solid #444",
                  borderRadius: "6px", padding: "1.5rem",
                  marginTop: "1rem", whiteSpace: "pre-wrap",
                  fontSize: "0.8rem", color: "#ccc",
                  maxHeight: "250px", overflowY: "auto"
                }}>
                  {legalNotice}
                </div>
              )}
            </div>
          )}

          {/* Alert history */}
          {alerts.length === 0 ? (
            <div style={{
              background: "#111", border: "1px dashed #333",
              borderRadius: "8px", padding: "3rem",
              textAlign: "center", color: "#555"
            }}>
              <p style={{ fontSize: "1.5rem", margin: "0 0 0.5rem" }}>✅</p>
              <p style={{ margin: 0 }}>No breaches detected yet.</p>
              <p style={{ margin: "0.5rem 0 0", fontSize: "0.8rem" }}>
                GhostTrap is monitoring your content.
              </p>
            </div>
          ) : (
            <div style={{
              background: "#111", padding: "1.5rem",
              borderRadius: "8px", border: "1px solid #222"
            }}>
              <h3 style={{ color: "#fff", marginTop: 0 }}>📋 Alert History</h3>
              {alerts.map((a, i) => (
                <div key={i} style={{
                  borderBottom: "1px solid #222", padding: "0.75rem 0",
                  color: "#888", fontSize: "0.85rem"
                }}>
                  🚨 Watermark <strong style={{ color: "#fff" }}>{a.watermark_id}</strong>{" "}
                  detected — IP: <strong style={{ color: "#ff4444" }}>{a.perpetrator_ip}</strong>{" "}
                  at {a.timestamp}
                </div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}