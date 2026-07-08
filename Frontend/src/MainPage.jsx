import { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { Editor } from "@monaco-editor/react";
import axios from "axios";
import toast, { Toaster } from "react-hot-toast";
import { useNavigate, useSearchParams } from "react-router-dom";
import * as Y from "yjs";
import { MonacoBinding } from "y-monaco";
import { io } from "socket.io-client";

const LANGUAGES = {
  javascript: {
    label: "JavaScript", ext: "js", monacoLang: "javascript",
    accent: "#f7df1e", accentDark: "#c9a800", icon: "JS", iconBg: "#323330",
  },
  python: {
    label: "Python", ext: "py", monacoLang: "python",
    accent: "#4B8BBE", accentDark: "#3a7ab0", icon: "PY", iconBg: "#306998",
  },
  cpp: {
    label: "C++", ext: "cpp", monacoLang: "cpp",
    accent: "#00bcd4", accentDark: "#0097a7", icon: "C++", iconBg: "#00599C",
  },
};

const DEFAULT_LANGUAGE = "javascript";
const API_BASE_URL = "https://api.compilebox.me";

function ResizeHandle({ onDrag, direction = "horizontal" }) {
  const dragging = useRef(false);
  const start = useRef(0);
  const onMouseDown = (e) => {
    dragging.current = true;
    start.current = direction === "horizontal" ? e.clientX : e.clientY;
    document.body.style.cursor = direction === "horizontal" ? "col-resize" : "row-resize";
    document.body.style.userSelect = "none";
  };
  useEffect(() => {
    const onMove = (e) => {
      if (!dragging.current) return;
      const cur = direction === "horizontal" ? e.clientX : e.clientY;
      onDrag(cur - start.current);
      start.current = cur;
    };
    const onUp = () => { dragging.current = false; document.body.style.cursor = ""; document.body.style.userSelect = ""; };
    window.addEventListener("mousemove", onMove);
    window.addEventListener("mouseup", onUp);
    return () => { window.removeEventListener("mousemove", onMove); window.removeEventListener("mouseup", onUp); };
  }, [onDrag, direction]);

  const isH = direction === "horizontal";
  return (
    <div onMouseDown={onMouseDown} style={{ flexShrink: 0, position: "relative", zIndex: 10, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(255,255,255,0.03)", transition: "background 0.15s", ...(isH ? { width: 5, cursor: "col-resize" } : { height: 5, cursor: "row-resize" }) }}>
      <div style={{ background: "rgba(255,255,255,0.1)", borderRadius: 2, ...(isH ? { width: 1, height: 28 } : { height: 1, width: 28 }) }} />
    </div>
  );
}

function MainPage() {
  const [searchParams] = useSearchParams();
  const roomId = searchParams.get("roomId");
  const userName = searchParams.get("username");
  const navigate = useNavigate();

  const [langKey, setLangKey] = useState(DEFAULT_LANGUAGE);
  const [stdin, setStdin] = useState("");
  const [output, setOutput] = useState(null); // null = not run yet
  const [status, setStatus] = useState("idle"); // idle | running | success | error
  const [elapsed, setElapsed] = useState(null);
  const [copiedOut, setCopiedOut] = useState(false);
  const [sidebarW, setSidebarW] = useState(340);
  const [inputH, setInputH] = useState(200);
  const [isMobile, setIsMobile] = useState(false);
  const [connectedUsers, setConnectedUsers] = useState([]);
  const [isSyncing, setIsSyncing] = useState(false);

  const editorRef = useRef(null);
  const yDocRef = useRef(null);
  const yTextRef = useRef(null);
  const bindingRef = useRef(null);

  const lang = LANGUAGES[langKey];

  const socket = useMemo(() => io(API_BASE_URL, { autoConnect: false }), []);

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < 768);
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, []);

  const bindMonacoToYjs = useCallback(() => {
    if (bindingRef.current) {
      bindingRef.current.destroy();
      bindingRef.current = null;
    }
    if (!editorRef.current || !yTextRef.current) return;
    const model = editorRef.current.getModel();
    bindingRef.current = new MonacoBinding(
      yTextRef.current,
      model,
      new Set([editorRef.current]),
      null
    );
  }, []);

  useEffect(() => {
    if (!roomId || !userName) {
      toast.error("Missing room ID or username. Please go back and enter the details.");
      navigate("/join");
      return;
    }

    setIsSyncing(true);

    const ydoc = new Y.Doc();
    const yText = ydoc.getText("code");
    yDocRef.current = ydoc;
    yTextRef.current = yText;

    if (editorRef.current) bindMonacoToYjs();

    socket.connect();
    socket.emit("join-room", { roomId, userName });
    socket.emit("request-sync", { roomId });

    ydoc.on("update", (update, origin) => {
      if (origin !== "remote") socket.emit("yjs-update", { roomId, update });
    });

    socket.on("yjs-update", ({ update }) => {
      Y.applyUpdate(ydoc, new Uint8Array(update), "remote");
    });

    socket.on("room-users", ({ clients }) => {
      setConnectedUsers(clients);
      if (clients.length <= 1) setIsSyncing(false);
    });

    socket.on("user-joined", ({ userName }) => toast(`${userName} joined the room.`));
    socket.on("user-left", ({ userName }) => toast(`${userName} left the room.`));

    socket.on("sync-required", ({ socketId }) => {
      if (yDocRef.current) {
        const fullUpdate = Y.encodeStateAsUpdate(yDocRef.current);
        socket.emit("sync-response", { socketId, update: Array.from(fullUpdate) });
      }
    });

    socket.on("sync-response", ({ update }) => {
      Y.applyUpdate(yDocRef.current, new Uint8Array(update), "remote");
      setIsSyncing(false);
    });

    return () => {
      socket.disconnect();
      bindingRef.current?.destroy();
      bindingRef.current = null;
      yDocRef.current.destroy();
      socket.off("yjs-update");
      socket.off("room-users");
      socket.off("user-joined");
      socket.off("user-left");
      socket.off("sync-required");
      socket.off("sync-response");
    };
  }, [roomId, userName, socket, navigate, bindMonacoToYjs]);

  const handleEditorDidMount = (editor) => {
    editorRef.current = editor;
    bindMonacoToYjs();
  };

  const handleLangChange = (key) => { setLangKey(key); setOutput(null); setStatus("idle"); setElapsed(null); };

  const handleRun = useCallback(async () => {
    if (status === "running") return;
    setStatus("running"); setOutput(null); setElapsed(null);
    const t0 = performance.now();
    try {
      const res = await axios.post(`${API_BASE_URL}/submit`, {
        language: langKey,
        code: yTextRef.current?.toString() ?? "",
        input: stdin,
      });
      const ms = Math.round(performance.now() - t0);
      setElapsed(ms);
      setOutput(res.data?.data?.output ?? "");
      setStatus("success");
    } catch (e) {
      setElapsed(Math.round(performance.now() - t0));
      const message = e.response?.data?.message || e.message || "Could not reach the execution engine.";
      setOutput(String(message));
      setStatus("error");
      toast.error(message);
    }
  }, [langKey, stdin, status]);

  const handleLeaveRoom = () => navigate("/join");

  const copyOutput = () => { navigator.clipboard.writeText(output || ""); setCopiedOut(true); setTimeout(() => setCopiedOut(false), 1500); };

  const statusMeta = {
    idle: { dot: "rgba(255,255,255,0.25)", label: "Ready" },
    running: { dot: "#f59e0b", label: "Running…" },
    success: { dot: "#00ff88", label: "Success" },
    error: { dot: "#f87171", label: "Error" },
  }[status];

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100vh", width: "100vw", background: "#060810", fontFamily: "'JetBrains Mono','Fira Code',Consolas,monospace", overflow: "hidden", color: "#c9d1d9" }}>
      <Toaster position="top-center" toastOptions={{ duration: 2000, style: { background: "#161b22", color: "#c9d1d9", border: "1px solid rgba(255,255,255,0.08)", fontFamily: "'JetBrains Mono',monospace", fontSize: 12 } }} />

      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=JetBrains+Mono:wght@400;500;600&display=swap');
        * { box-sizing: border-box; }
        ::-webkit-scrollbar { width: 5px; height: 5px; }
        ::-webkit-scrollbar-track { background: transparent; }
        ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.1); border-radius: 3px; }
        ::-webkit-scrollbar-thumb:hover { background: rgba(255,255,255,0.18); }
        textarea { outline: none; resize: none; }
        @keyframes spin { to { transform: rotate(360deg); } }
        .spin { display: inline-block; animation: spin 0.7s linear infinite; }
        @keyframes fadeSlide { from { opacity:0; transform:translateY(4px); } to { opacity:1; transform:translateY(0); } }
        .fade-slide { animation: fadeSlide 0.2s ease forwards; }
        .lang-tab { cursor:pointer; padding:5px 13px; border-radius:6px; font-size:12px; font-weight:600; letter-spacing:0.03em; transition:all 0.14s; border:1.5px solid transparent; white-space:nowrap; font-family:inherit; background:transparent; }
        .lang-tab:hover { background:rgba(255,255,255,0.06); }
        .run-btn { display:inline-flex; align-items:center; gap:6px; padding:7px 16px; border-radius:7px; font-size:12px; font-weight:700; border:none; cursor:pointer; transition:all 0.14s; letter-spacing:0.03em; font-family:inherit; white-space:nowrap; }
        .run-btn:hover:not(:disabled) { filter:brightness(1.1); transform:translateY(-1px); box-shadow:0 4px 16px rgba(0,255,136,0.25); }
        .run-btn:active:not(:disabled) { transform:translateY(0); }
        .run-btn:disabled { opacity:0.5; cursor:not-allowed; }
        .leave-btn { display:inline-flex; align-items:center; gap:6px; padding:7px 14px; border-radius:7px; font-size:12px; font-weight:600; border:1px solid rgba(255,255,255,0.12); cursor:pointer; transition:all 0.14s; font-family:inherit; white-space:nowrap; background:rgba(255,255,255,0.04); color:rgba(255,255,255,0.6); }
        .leave-btn:hover { background:rgba(255,255,255,0.08); color:#fff; }
        .panel-label { font-size:10px; font-weight:700; letter-spacing:0.11em; text-transform:uppercase; color:rgba(255,255,255,0.3); padding:0 14px; height:33px; display:flex; align-items:center; gap:7px; border-bottom:1px solid rgba(255,255,255,0.06); background:rgba(255,255,255,0.02); flex-shrink:0; }
        .io-btn { font-size:10px; background:none; border:none; cursor:pointer; font-family:inherit; padding:2px 5px; border-radius:3px; transition:color 0.12s; }
        .io-btn:hover { color:rgba(255,255,255,0.6) !important; }
        .empty-state { display:flex; flex-direction:column; align-items:center; justify-content:center; height:100%; gap:10px; }
        .icon-chip { display:inline-flex; align-items:center; justify-content:center; font-size:9px; font-weight:800; border-radius:3px; padding:1px 5px; letter-spacing:0.04em; color:#fff; }
        .users-pill { display:flex; align-items:center; gap:5px; font-size:11px; color:rgba(255,255,255,0.4); background:rgba(255,255,255,0.04); border:1px solid rgba(255,255,255,0.08); border-radius:20px; padding:3px 10px; }
      `}</style>

      {/* ── TOPBAR ── */}
      <header style={{ display: "flex", alignItems: "center", gap: 10, padding: "0 14px", height: 50, background: "#0a0d16", borderBottom: "1px solid rgba(255,255,255,0.07)", flexShrink: 0, boxShadow: "0 1px 0 rgba(0,0,0,0.4)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: 7, flexShrink: 0 }}>
          <div style={{ width: 26, height: 26, borderRadius: 6, background: "#00ff88", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 800, color: "#060810", fontFamily: "'Syne',sans-serif" }}>{"<>"}</div>
          {!isMobile && <span style={{ fontFamily: "'Syne',sans-serif", fontWeight: 800, fontSize: 13, color: "#fff", letterSpacing: "-0.02em" }}>ProjectX IDE</span>}
        </div>

        <div style={{ width: 1, height: 22, background: "rgba(255,255,255,0.1)", flexShrink: 0 }} />

        {/* Lang tabs */}
        <div style={{ display: "flex", gap: 3, overflow: "hidden", flexShrink: 1 }}>
          {Object.entries(LANGUAGES).map(([key, l]) => (
            <button key={key} onClick={() => handleLangChange(key)} className="lang-tab" style={{ background: langKey === key ? l.accent + "18" : "transparent", borderColor: langKey === key ? l.accent + "60" : "transparent", color: langKey === key ? l.accent : "rgba(255,255,255,0.4)" }}>
              {isMobile ? l.icon : l.label}
            </button>
          ))}
        </div>

        <div style={{ flex: 1 }} />

        {/* Connected users */}
        {!isMobile && (
          <div className="users-pill">
            <span style={{ width: 6, height: 6, borderRadius: "50%", background: "#00ff88" }} />
            {connectedUsers.length} online
          </div>
        )}

        {/* Status */}
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
          <div style={{ width: 7, height: 7, borderRadius: "50%", background: statusMeta.dot, transition: "background 0.3s", boxShadow: status === "running" ? `0 0 0 3px ${statusMeta.dot}44` : status === "success" ? `0 0 6px ${statusMeta.dot}` : "none" }} />
          {!isMobile && <span style={{ fontSize: 11, color: "rgba(255,255,255,0.4)", fontFamily: "inherit" }}>{statusMeta.label}</span>}
          {elapsed !== null && <span style={{ fontSize: 11, color: "rgba(255,255,255,0.25)" }}>{elapsed}ms</span>}
        </div>

        <div style={{ width: 1, height: 22, background: "rgba(255,255,255,0.08)", flexShrink: 0 }} />

        <button onClick={handleLeaveRoom} className="leave-btn">
          {isMobile ? "Leave" : "Leave Room"}
        </button>

        <button onClick={handleRun} disabled={status === "running"} className="run-btn" style={{ background: status === "running" ? "rgba(0,255,136,0.12)" : "#00ff88", color: status === "running" ? "#00ff88" : "#060810", border: "1px solid rgba(0,255,136,0.35)", flexShrink: 0 }}>
          {status === "running"
            ? <><span className="spin">◌</span>{!isMobile && "Running"}</>
            : <><span>▶</span>{!isMobile && <>Run <span style={{ opacity: 0.5, fontSize: 10, fontWeight: 400 }}>⌘↵</span></>}</>
          }
        </button>
      </header>

      {/* ── MAIN ── */}
      <div style={{ flex: 1, display: "flex", overflow: "hidden", minHeight: 0, flexDirection: isMobile ? "column" : "row" }}>

        {/* EDITOR */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", minWidth: 0, background: "#0d1117", overflow: "hidden", position: "relative" }}>

          {isSyncing && (
            <div style={{ position: "absolute", inset: 0, zIndex: 20, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", gap: 12, background: "rgba(6,8,16,0.92)", backdropFilter: "blur(2px)" }}>
              <span className="spin" style={{ fontSize: 26, color: "#00ff88" }}>◌</span>
              <span style={{ fontSize: 12, color: "rgba(255,255,255,0.5)", fontFamily: "inherit", letterSpacing: "0.04em" }}>Syncing workspace…</span>
            </div>
          )}

          {/* Tab strip */}
          <div style={{ height: 35, background: "#161b22", display: "flex", alignItems: "flex-end", borderBottom: "1px solid rgba(255,255,255,0.06)", flexShrink: 0 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "0 16px", height: "100%", background: "#0d1117", borderTop: `2px solid ${lang.accent}`, borderRight: "1px solid rgba(255,255,255,0.07)" }}>
              <span className="icon-chip" style={{ background: lang.iconBg }}>{lang.icon}</span>
              <span style={{ fontSize: 12, color: "rgba(255,255,255,0.7)", fontFamily: "inherit" }}>main.{lang.ext}</span>
            </div>
          </div>

          {/* Monaco */}
          <div style={{ flex: 1, overflow: "hidden" }}>
            <Editor
              height="100%"
              language={lang.monacoLang}
              onMount={handleEditorDidMount}
              theme="vs-dark"
              options={{
                fontSize: 14,
                minimap: { enabled: false },
                scrollBeyondLastLine: false,
                fontFamily: "'JetBrains Mono', 'Fira Code', Consolas, monospace",
                fontLigatures: true,
                padding: { top: 16, bottom: 16 },
                lineHeight: 22,
                renderLineHighlight: "gutter",
                cursorBlinking: "smooth",
                cursorSmoothCaretAnimation: "on",
                smoothScrolling: true,
                tabSize: 2,
                wordWrap: "off",
                bracketPairColorization: { enabled: true },
                guides: { bracketPairs: "active" },
                lineDecorationsWidth: 6,
              }}
            />
          </div>

          {/* Bottom status bar */}
          <div style={{ height: 22, background: "rgba(0,255,136,0.08)", borderTop: `1px solid ${lang.accent}22`, display: "flex", alignItems: "center", gap: 14, padding: "0 14px", flexShrink: 0 }}>
            <span style={{ fontSize: 11, color: lang.accent, fontFamily: "inherit", opacity: 0.85 }}>{lang.label}</span>
            <span style={{ fontSize: 11, color: "rgba(255,255,255,0.2)" }}>UTF-8</span>
            <span style={{ fontSize: 11, color: "rgba(255,255,255,0.2)" }}>Spaces: 2</span>
            <div style={{ flex: 1 }} />
            <div style={{ width: 6, height: 6, borderRadius: "50%", background: status === "success" ? "#00ff88" : status === "error" ? "#f87171" : status === "running" ? "#f59e0b" : "rgba(255,255,255,0.2)", transition: "background 0.3s" }} />
            {elapsed !== null && <span style={{ fontSize: 11, color: "rgba(255,255,255,0.25)" }}>{elapsed}ms</span>}
          </div>
        </div>

        {/* Resize */}
        {!isMobile && <ResizeHandle direction="horizontal" onDrag={(dx) => setSidebarW(w => Math.min(560, Math.max(260, w - dx)))} />}

        {/* SIDEBAR */}
        <div style={{ ...(isMobile ? { width: "100%", height: 300 } : { width: sidebarW, flexShrink: 0 }), display: "flex", flexDirection: "column", background: "#0a0d16", borderLeft: isMobile ? "none" : "1px solid rgba(255,255,255,0.06)", borderTop: isMobile ? "1px solid rgba(255,255,255,0.06)" : "none", overflow: "hidden" }}>

          {/* STDIN */}
          <div style={{ height: isMobile ? 110 : inputH, flexShrink: 0, display: "flex", flexDirection: "column", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
            <div className="panel-label">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><polyline points="16 18 22 12 16 6" /><polyline points="8 6 2 12 8 18" /></svg>
              stdin / input
              {stdin && <button onClick={() => setStdin("")} className="io-btn" style={{ marginLeft: "auto", color: "rgba(255,255,255,0.25)" }}>clear</button>}
            </div>
            <textarea
              value={stdin}
              onChange={e => setStdin(e.target.value)}
              placeholder={"Enter program input…\nOne value per line"}
              style={{ flex: 1, background: "transparent", border: "none", padding: "10px 14px", fontSize: 13, color: "rgba(200,225,255,0.75)", lineHeight: 1.65, fontFamily: "inherit" }}
              spellCheck={false}
            />
          </div>

          {!isMobile && <ResizeHandle direction="vertical" onDrag={(dy) => setInputH(h => Math.max(72, h + dy))} />}

          {/* STDOUT */}
          <div style={{ flex: 1, display: "flex", flexDirection: "column", minHeight: 0 }}>
            <div className="panel-label">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><rect x="2" y="3" width="20" height="14" rx="2" /><line x1="12" y1="17" x2="12" y2="21" /><line x1="8" y1="21" x2="16" y2="21" /></svg>
              stdout / output
              {output !== null && (
                <div style={{ marginLeft: "auto", display: "flex", alignItems: "center", gap: 5 }}>
                  <button onClick={copyOutput} className="io-btn" style={{ color: copiedOut ? "#00ff88" : "rgba(255,255,255,0.25)" }}>{copiedOut ? "✓" : "copy"}</button>
                  <button onClick={() => { setOutput(null); setStatus("idle"); setElapsed(null); }} className="io-btn" style={{ color: "rgba(255,255,255,0.25)" }}>clear</button>
                </div>
              )}
            </div>

            <div style={{ flex: 1, overflow: "auto", padding: "12px 14px" }}>
              {status === "idle" && output === null && (
                <div className="empty-state">
                  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.12)" strokeWidth="1.5" strokeLinecap="round"><polygon points="5 3 19 12 5 21 5 3" /></svg>
                  <span style={{ fontSize: 12, color: "rgba(255,255,255,0.2)", fontFamily: "inherit", textAlign: "center" }}>
                    Press <strong style={{ color: "#00ff88" }}>Run</strong> or <strong style={{ color: "#00ff88" }}>⌘↵</strong>
                  </span>
                </div>
              )}

              {status === "running" && (
                <div className="empty-state">
                  <span className="spin" style={{ fontSize: 20, color: "#f59e0b" }}>◌</span>
                  <span style={{ fontSize: 12, color: "rgba(255,255,255,0.3)", fontFamily: "inherit" }}>Executing…</span>
                </div>
              )}

              {output !== null && (
                <div className="fade-slide">
                  {output ? (
                    <pre style={{ margin: 0, fontSize: 13, lineHeight: 1.65, color: status === "error" ? "#f87171" : "rgba(200,225,255,0.85)", whiteSpace: "pre-wrap", wordBreak: "break-word", fontFamily: "inherit" }}>
                      {output}
                    </pre>
                  ) : (
                    <span style={{ fontSize: 12, color: "rgba(255,255,255,0.2)", fontStyle: "italic" }}>(no output)</span>
                  )}
                </div>
              )}
            </div>

            {output !== null && elapsed !== null && (
              <div style={{ height: 26, padding: "0 14px", display: "flex", alignItems: "center", gap: 8, borderTop: "1px solid rgba(255,255,255,0.05)", background: "rgba(0,0,0,0.3)", flexShrink: 0 }}>
                <div style={{ width: 6, height: 6, borderRadius: "50%", background: status === "success" ? "#00ff88" : "#f87171", boxShadow: status === "success" ? "0 0 5px #00ff88" : "0 0 5px #f87171" }} />
                <span style={{ fontSize: 11, color: "rgba(255,255,255,0.35)", fontFamily: "inherit" }}>{status === "success" ? "Finished" : "Runtime Error"}</span>
                <span style={{ color: "rgba(255,255,255,0.15)" }}>·</span>
                <span style={{ fontSize: 11, color: "rgba(255,255,255,0.25)", fontFamily: "inherit" }}>{elapsed}ms</span>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default MainPage;