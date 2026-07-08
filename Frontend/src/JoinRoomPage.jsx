import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";

function JoinRoomPage() {
  const [roomId, setRoomId] = useState("");
  const [username, setUsername] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();

  const handleSubmit = (event) => {
    event.preventDefault();
    const normalizedRoomId = roomId.trim();
    const normalizedUsername = username.trim();

    if (!normalizedRoomId || !normalizedUsername) {
      setError("Room ID and username are required.");
      return;
    }

    const params = new URLSearchParams({
      roomId: normalizedRoomId,
      username: normalizedUsername,
    });

    navigate(`/editor?${params.toString()}`);
  };

  return (
    <div style={{ minHeight: "100vh", width: "100vw", background: "#060810", color: "#c9d1d9", display: "flex", alignItems: "center", justifyContent: "center", padding: 20, fontFamily: "'JetBrains Mono','Fira Code',Consolas,monospace" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=JetBrains+Mono:wght@400;500;600&display=swap');
        * { box-sizing: border-box; }
        .jr-input { width:100%; background:#0d1117; border:1px solid rgba(255,255,255,0.1); color:#c9d1d9; font-size:13px; padding:9px 12px; border-radius:6px; outline:none; font-family:inherit; transition:border-color 0.14s, box-shadow 0.14s; }
        .jr-input::placeholder { color:rgba(255,255,255,0.2); }
        .jr-input:focus { border-color:#00ff88; box-shadow:0 0 0 3px rgba(0,255,136,0.12); }
        .jr-label { display:block; font-size:10px; font-weight:700; letter-spacing:0.09em; text-transform:uppercase; color:rgba(255,255,255,0.35); margin-bottom:7px; }
        .jr-submit { width:100%; display:inline-flex; align-items:center; justify-content:center; gap:6px; background:#00ff88; color:#060810; border:1px solid rgba(0,255,136,0.35); font-size:13px; font-weight:700; letter-spacing:0.03em; padding:10px 16px; border-radius:7px; cursor:pointer; transition:all 0.14s; font-family:inherit; }
        .jr-submit:hover { filter:brightness(1.1); transform:translateY(-1px); box-shadow:0 4px 16px rgba(0,255,136,0.25); }
        .jr-submit:active { transform:translateY(0); }
        .jr-solo-link { color:#00ff88; text-decoration:none; border-bottom:1px solid rgba(0,255,136,0.35); transition:border-color 0.14s; }
        .jr-solo-link:hover { border-color:#00ff88; }
      `}</style>

      <div style={{ width: "100%", maxWidth: 420 }}>
        {/* Logo */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "center", gap: 8, marginBottom: 28 }}>
          <div style={{ width: 30, height: 30, borderRadius: 7, background: "#00ff88", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 12, fontWeight: 800, color: "#060810", fontFamily: "'Syne',sans-serif" }}>{"<>"}</div>
          <span style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 16, color: "#fff", letterSpacing: "-0.02em" }}>CompileBox</span>
        </div>

        {/* Card */}
        <div style={{ background: "#0a0d16", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 12, padding: 28, boxShadow: "0 12px 40px rgba(0,0,0,0.4)" }}>
          <div style={{ display: "flex", alignItems: "center", gap: 7, marginBottom: 6 }}>
            <div style={{ width: 7, height: 7, borderRadius: "50%", background: "#00ff88", boxShadow: "0 0 6px #00ff88" }} />
            <h1 style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 17, color: "#fff", letterSpacing: "-0.01em", margin: 0 }}>
              Join a Collaboration Room
            </h1>
          </div>
          <p style={{ fontSize: 12.5, color: "rgba(255,255,255,0.35)", margin: "0 0 22px 0", lineHeight: 1.6 }}>
            Enter room details to start coding together in real time.
          </p>

          <form onSubmit={handleSubmit}>
            <div style={{ marginBottom: 16 }}>
              <label className="jr-label" htmlFor="room-id">Room ID</label>
              <input
                id="room-id"
                value={roomId}
                onChange={(event) => setRoomId(event.target.value)}
                placeholder="e.g. team-42"
                className="jr-input"
                spellCheck={false}
              />
            </div>

            <div style={{ marginBottom: error ? 10 : 22 }}>
              <label className="jr-label" htmlFor="username">Username</label>
              <input
                id="username"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                placeholder="e.g. anuj"
                className="jr-input"
                spellCheck={false}
              />
            </div>

            {error && (
              <p style={{ fontSize: 12, color: "#f87171", margin: "0 0 16px 0", display: "flex", alignItems: "center", gap: 6 }}>
                <span style={{ width: 5, height: 5, borderRadius: "50%", background: "#f87171", flexShrink: 0 }} />
                {error}
              </p>
            )}

            <button type="submit" className="jr-submit">
              <span>▶</span> Join Room
            </button>
          </form>
        </div>

        {/* Solo editor fallback link */}
        <p style={{ textAlign: "center", fontSize: 12, color: "rgba(255,255,255,0.3)", marginTop: 20 }}>
          Just want to code alone?{" "}
          <Link to="/soloeditor" className="jr-solo-link">Try the Solo Editor</Link>
        </p>
      </div>
    </div>
  );
}

export default JoinRoomPage;