import { useState, useEffect, useRef } from "react";
import { Link } from "react-router-dom";

const PARTICLES = Array.from({ length: 60 }, (_, i) => ({
  id: i,
  x: Math.random() * 100,
  y: Math.random() * 100,
  size: Math.random() * 2 + 0.5,
  speed: Math.random() * 0.015 + 0.005,
  drift: (Math.random() - 0.5) * 0.01,
  opacity: Math.random() * 0.5 + 0.1,
}));

const CODE_SNIPPETS = [
  { lang: "JS", color: "#f7df1e", lines: ["const run = async () => {", "  const res = await fetch(url);", "  return res.json();", "};"] },
  { lang: "PY", color: "#3776ab", lines: ["def fib(n):", "  if n <= 1: return n", "  return fib(n-1)+fib(n-2)", "print(fib(10))"] },
  { lang: "C++", color: "#00599C", lines: ["#include <iostream>", "int main() {", "  std::cout << \"Hello!\";", "  return 0;", "}"] },
];


function ParticleCanvas() {
  const canvasRef = useRef(null);
  const particlesRef = useRef(PARTICLES.map(p => ({ ...p })));
  const mouseRef = useRef({ x: -999, y: -999 });
  const rafRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");

    const resize = () => {
      canvas.width = canvas.offsetWidth * window.devicePixelRatio;
      canvas.height = canvas.offsetHeight * window.devicePixelRatio;
      ctx.scale(window.devicePixelRatio, window.devicePixelRatio);
    };
    resize();
    window.addEventListener("resize", resize);

    const handleMouse = (e) => {
      const rect = canvas.getBoundingClientRect();
      mouseRef.current = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    };
    window.addEventListener("mousemove", handleMouse);

    const draw = () => {
      const w = canvas.offsetWidth;
      const h = canvas.offsetHeight;
      ctx.clearRect(0, 0, w, h);

      const pts = particlesRef.current;
      pts.forEach(p => {
        p.y -= p.speed;
        p.x += p.drift;
        if (p.y < -2) { p.y = 102; p.x = Math.random() * 100; }
        if (p.x < -2) p.x = 102;
        if (p.x > 102) p.x = -2;

        const px = (p.x / 100) * w;
        const py = (p.y / 100) * h;
        const dx = mouseRef.current.x - px;
        const dy = mouseRef.current.y - py;
        const dist = Math.sqrt(dx * dx + dy * dy);
        const glow = dist < 120 ? 1 - dist / 120 : 0;

        ctx.beginPath();
        ctx.arc(px, py, p.size + glow * 2, 0, Math.PI * 2);
        ctx.fillStyle = `rgba(${glow > 0.3 ? "0,255,136" : "100,200,255"},${p.opacity + glow * 0.4})`;
        ctx.fill();
      });

      // draw connections
      for (let i = 0; i < pts.length; i++) {
        for (let j = i + 1; j < pts.length; j++) {
          const ax = (pts[i].x / 100) * w, ay = (pts[i].y / 100) * h;
          const bx = (pts[j].x / 100) * w, by = (pts[j].y / 100) * h;
          const d = Math.sqrt((ax - bx) ** 2 + (ay - by) ** 2);
          if (d < 100) {
            ctx.beginPath();
            ctx.moveTo(ax, ay);
            ctx.lineTo(bx, by);
            ctx.strokeStyle = `rgba(100,200,255,${0.08 * (1 - d / 100)})`;
            ctx.lineWidth = 0.5;
            ctx.stroke();
          }
        }
      }

      rafRef.current = requestAnimationFrame(draw);
    };
    draw();

    return () => {
      window.removeEventListener("resize", resize);
      window.removeEventListener("mousemove", handleMouse);
      cancelAnimationFrame(rafRef.current);
    };
  }, []);

  return <canvas ref={canvasRef} className="absolute inset-0 w-full h-full" style={{ pointerEvents: "none" }} />;
}

function FloatingCodeCard({ snippet, style }) {
  return (
    <div className="absolute rounded-xl border border-white/10 backdrop-blur-sm overflow-hidden" style={{ background: "rgba(10,12,20,0.75)", ...style }}>
      <div className="flex items-center gap-2 px-3 py-2 border-b border-white/10" style={{ background: "rgba(255,255,255,0.04)" }}>
        <div className="w-2 h-2 rounded-full bg-red-500/70" />
        <div className="w-2 h-2 rounded-full bg-yellow-500/70" />
        <div className="w-2 h-2 rounded-full bg-green-500/70" />
        <span className="ml-2 text-xs font-mono" style={{ color: snippet.color }}>{snippet.lang}</span>
      </div>
      <div className="p-3 font-mono text-xs leading-5">
        {snippet.lines.map((line, i) => (
          <div key={i} className="flex gap-3">
            <span style={{ color: "rgba(255,255,255,0.2)", minWidth: "1ch" }}>{i + 1}</span>
            <span style={{ color: "rgba(200,230,255,0.7)" }}>{line}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function TypewriterText({ phrases }) {
  const [idx, setIdx] = useState(0);
  const [displayed, setDisplayed] = useState("");
  const [deleting, setDeleting] = useState(false);

  useEffect(() => {
    const target = phrases[idx];
    if (!deleting && displayed.length < target.length) {
      const t = setTimeout(() => setDisplayed(target.slice(0, displayed.length + 1)), 60);
      return () => clearTimeout(t);
    } else if (!deleting && displayed.length === target.length) {
      const t = setTimeout(() => setDeleting(true), 2000);
      return () => clearTimeout(t);
    } else if (deleting && displayed.length > 0) {
      const t = setTimeout(() => setDisplayed(displayed.slice(0, -1)), 30);
      return () => clearTimeout(t);
    } else if (deleting && displayed.length === 0) {
      setDeleting(false);
      setIdx((idx + 1) % phrases.length);
    }
  }, [displayed, deleting, idx, phrases]);

  return (
    <span className="font-mono" style={{ color: "#00ff88" }}>
      {displayed}<span className="animate-pulse">▌</span>
    </span>
  );
}

export default function LandingPage() {
  return (
    <div className="min-h-screen text-white overflow-x-hidden" style={{ background: "#050810", fontFamily: "'JetBrains Mono', 'Fira Code', monospace" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@300;400;500;700&family=Syne:wght@400;700;800&display=swap');
        .syne { font-family: 'Syne', sans-serif; }
        @keyframes float1 { 0%,100%{transform:translateY(0px) rotate(-2deg)} 50%{transform:translateY(-18px) rotate(1deg)} }
        @keyframes float2 { 0%,100%{transform:translateY(0px) rotate(2deg)} 50%{transform:translateY(-12px) rotate(-1deg)} }
        @keyframes float3 { 0%,100%{transform:translateY(0px)} 50%{transform:translateY(-22px)} }
        @keyframes fadeup { from{opacity:0;transform:translateY(30px)} to{opacity:1;transform:translateY(0)} }
        @keyframes pulse-border { 0%,100%{box-shadow:0 0 0 0 rgba(0,255,136,0.3)} 50%{box-shadow:0 0 0 8px rgba(0,255,136,0)} }
        .float1 { animation: float1 7s ease-in-out infinite; }
        .float2 { animation: float2 9s ease-in-out infinite 1s; }
        .float3 { animation: float3 6s ease-in-out infinite 2s; }
        .fadeup { animation: fadeup 0.8s ease forwards; }
        .fadeup-1 { animation: fadeup 0.8s ease 0.1s forwards; opacity: 0; }
        .fadeup-2 { animation: fadeup 0.8s ease 0.25s forwards; opacity: 0; }
        .fadeup-3 { animation: fadeup 0.8s ease 0.4s forwards; opacity: 0; }
        .fadeup-4 { animation: fadeup 0.8s ease 0.55s forwards; opacity: 0; }
        .btn-primary { background: linear-gradient(135deg, #00ff88, #00cc6a); color: #050810; }
        .btn-primary:hover { filter: brightness(1.1); transform: translateY(-1px); }
        .btn-ghost:hover { background: rgba(255,255,255,0.06); }
        .feature-card:hover { border-color: rgba(255,255,255,0.15); transform: translateY(-4px); background: rgba(255,255,255,0.04); }
        .run-btn:hover { filter: brightness(1.15); transform: scale(1.02); }
        .glow-green { box-shadow: 0 0 40px rgba(0,255,136,0.15); }
      `}</style>

      {/* NAV */}
      <nav className="fixed top-0 left-0 right-0 z-50 flex items-center justify-between px-8 py-4" style={{ background: "rgba(5,8,16,0.85)", backdropFilter: "blur(20px)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}>
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-md flex items-center justify-center text-sm font-bold" style={{ background: "#00ff88", color: "#050810" }}>{"<>"}</div>
          <span className="syne font-bold text-lg tracking-tight">CompileBox</span>
        </div>
        <div className="flex gap-3">
          <Link to="/soloeditor" className="btn-primary px-4 py-2 rounded-lg text-sm font-bold transition-all duration-200">Solo Editor</Link>
          <Link to="/join" className="btn-ghost px-4 py-2 rounded-lg text-sm font-bold transition-all duration-200 border" style={{ borderColor: "rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.7)" }}>Collaborate</Link>
        </div>
      </nav>

      {/* HERO */}
      <section className="relative min-h-screen flex flex-col items-center justify-center px-6 text-center overflow-hidden pt-20">
        <ParticleCanvas />

        {/* radial glow */}
        <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(ellipse 60% 50% at 50% 40%, rgba(0,255,136,0.06) 0%, transparent 70%)" }} />

        {/* floating code cards */}
        <FloatingCodeCard snippet={CODE_SNIPPETS[0]} style={{ left: "6%", top: "22%", width: 220, animation: "float1 7s ease-in-out infinite" }} />
        <FloatingCodeCard snippet={CODE_SNIPPETS[1]} style={{ right: "7%", top: "28%", width: 200, animation: "float2 9s ease-in-out infinite 1s" }} />
        <FloatingCodeCard snippet={CODE_SNIPPETS[2]} style={{ left: "12%", bottom: "18%", width: 210, animation: "float3 6s ease-in-out infinite 2s" }} />

        <div className="relative z-10 max-w-3xl">
          <div className="fadeup inline-flex items-center gap-2 mb-6 px-4 py-1.5 rounded-full text-xs font-mono" style={{ background: "rgba(0,255,136,0.08)", border: "1px solid rgba(0,255,136,0.2)", color: "#00ff88" }}>
            <span className="w-1.5 h-1.5 rounded-full animate-pulse" style={{ background: "#00ff88" }} />
            No account required · Free forever
          </div>

          <h1 className="fadeup-1 syne text-5xl md:text-7xl font-extrabold leading-tight mb-4" style={{ letterSpacing: "-0.03em" }}>
            Code. Run.{" "}
            <span style={{ color: "#00ff88" }}>Ship.</span>
          </h1>

          <p className="fadeup-2 text-lg md:text-xl mb-3" style={{ color: "rgba(255,255,255,0.45)", maxWidth: 520, margin: "0 auto 1.25rem" }}>
            A blazing-fast browser IDE with a real execution engine. Write{" "}
            <TypewriterText phrases={["JavaScript", "Python", "C++"]} />{" "}
            and see results in milliseconds.
          </p>

          <div className="fadeup-3 flex flex-wrap items-center justify-center gap-3 mt-8">
            <Link to="/soloeditor" className="btn-primary px-7 py-3.5 rounded-xl text-sm font-bold transition-all duration-200" style={{ boxShadow: "0 0 30px rgba(0,255,136,0.25)" }}>
              Solo Editor
            </Link>
            <Link to="/join" className="btn-ghost px-7 py-3.5 rounded-xl text-sm font-bold transition-all duration-200 border" style={{ borderColor: "rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.7)" }}>
              Create / Join Rooms
            </Link>
          </div>

          <p className="fadeup-4 mt-5 text-xs" style={{ color: "rgba(255,255,255,0.25)" }}>
            No signup · No download · No credit card
          </p>
        </div>

        {/* scroll hint */}
        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 flex flex-col items-center gap-2 opacity-30 animate-bounce">
          <span className="text-xs font-mono">scroll</span>
          <svg width="16" height="16" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path d="M12 5v14M5 12l7 7 7-7" /></svg>
        </div>
      </section>




      {/* CTA */}
      <section className="py-28 px-6 text-center relative overflow-hidden">
        <div className="absolute inset-0 pointer-events-none" style={{ background: "radial-gradient(ellipse 50% 60% at 50% 50%, rgba(0,255,136,0.05) 0%, transparent 70%)" }} />
        <div className="relative z-10 max-w-xl mx-auto">
          <h2 className="syne text-4xl md:text-5xl font-extrabold mb-4" style={{ letterSpacing: "-0.03em" }}>
            Start coding in{" "}
            <span style={{ color: "#00ff88" }}>3 seconds.</span>
          </h2>
          <p className="text-sm mb-10" style={{ color: "rgba(255,255,255,0.4)" }}>
            No account. No install. No friction. Just a blank editor and your ideas.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4">
            <Link to="/soloeditor" className="btn-primary inline-block px-10 py-4 rounded-xl text-base font-bold transition-all duration-200" style={{ boxShadow: "0 0 50px rgba(0,255,136,0.3)", animation: "pulse-border 2.5s ease-in-out infinite" }}>
              Solo Editor
            </Link>
            <Link to="/join" className="btn-ghost inline-block px-10 py-4 rounded-xl text-base font-bold transition-all duration-200 border" style={{ borderColor: "rgba(255,255,255,0.12)", color: "rgba(255,255,255,0.7)" }}>
              Create / Join Rooms
            </Link>
          </div>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="py-8 px-6 border-t text-center" style={{ borderColor: "rgba(255,255,255,0.06)" }}>
        <div className="flex items-center justify-center gap-2 mb-3">
          <div className="w-5 h-5 rounded flex items-center justify-center text-xs font-bold" style={{ background: "#00ff88", color: "#050810" }}>{"<>"}</div>
          <span className="syne font-bold text-sm">CompileBox</span>
        </div>
        <p className="text-xs" style={{ color: "rgba(255,255,255,0.2)" }}>© 2026 CompileBox · Open source · No login required · Ever.</p>
      </footer>
    </div>
  );
}