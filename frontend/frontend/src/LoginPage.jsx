// src/LoginPage.jsx
import React, { useState, useEffect, useRef } from 'react';

const CREDENTIALS = [
  { username: 'admin',   password: 'sentinel123', role: 'SOC Analyst' },
  { username: 'officer', password: 'officer123',  role: 'Security Officer' },
];

const normalizeUsername = (value) => value.trim().toLowerCase();
const normalizePassword = (value) => value.trim();

export default function LoginPage({ onLogin }) {
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError]       = useState('');
  const [loading, setLoading]   = useState(false);
  const [scanLine, setScanLine] = useState(0);
  const canvasRef = useRef(null);

  // Matrix rain
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const setSize = () => { canvas.width = window.innerWidth; canvas.height = window.innerHeight; };
    setSize();
    window.addEventListener('resize', setSize);
    const cols  = Math.floor(canvas.width / 20);
    const drops = Array(cols).fill(1);
    const chars = 'SENTINEL01ICSABCDEFGHIJKアイウエオSCADA';
    let raf;
    const draw = () => {
      ctx.fillStyle = 'rgba(2,13,28,0.13)';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.font = '13px monospace';
      drops.forEach((y, i) => {
        const ch = chars[Math.floor(Math.random() * chars.length)];
        ctx.fillStyle = 'rgba(0,210,255,0.4)';
        ctx.fillText(ch, i * 20, y * 20);
        if (y * 20 > canvas.height && Math.random() > 0.975) drops[i] = 0;
        drops[i]++;
      });
      raf = requestAnimationFrame(draw);
    };
    draw();
    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', setSize); };
  }, []);

  // Scan line
  useEffect(() => {
    const id = setInterval(() => setScanLine(p => (p + 1) % 100), 20);
    return () => clearInterval(id);
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    // Trim inputs and make operator IDs case-insensitive.
    const u = normalizeUsername(username);
    const p = normalizePassword(password);

    // Simulate network delay
    await new Promise(r => setTimeout(r, 800));

    const match = CREDENTIALS.find(
      (c) => normalizeUsername(c.username) === u && normalizePassword(c.password) === p
    );

    if (match) {
      try {
        onLogin({ username: match.username, role: match.role });
      } catch (err) {
        setError(`LOGIN FAILED - ${err.message}`);
      } finally {
        setLoading(false);
      }
    } else {
      setError('ACCESS DENIED - Use admin / sentinel123 or officer / officer123');
      setLoading(false);
    }
  };

  const fillDemoCredentials = (credentials) => {
    setUsername(credentials.username);
    setPassword(credentials.password);
    setError('');
  };

  return (
    <div style={{
      position: 'fixed', inset: 0,
      background: 'var(--bg-black)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: "'Courier New', monospace",
      overflow: 'hidden',
    }}>
      {/* Matrix canvas */}
      <canvas ref={canvasRef} style={{ position: 'absolute', inset: 0, opacity: 0.6 }} />

      {/* Scan line */}
      <div style={{
        position: 'absolute', left: 0, right: 0,
        top: `${scanLine}%`, height: 2, zIndex: 2,
        background: 'linear-gradient(90deg, transparent, rgba(0,210,255,0.2), transparent)',
        pointerEvents: 'none',
      }} />

      {/* Card */}
      <div style={{
        position: 'relative', zIndex: 10,
        width: 420, maxWidth: '90vw',
        background: 'var(--card-bg)',
        border: '1px solid var(--card-border)',
        borderRadius: 16,
        padding: '44px 40px 40px',
        boxShadow: '0 0 80px rgba(0,210,255,0.1), inset 0 1px 0 rgba(0,210,255,0.1)',
      }}>
        {/* Top glow */}
        <div style={{
          position: 'absolute', top: 0, left: '15%', right: '15%', height: 1,
          background: 'linear-gradient(90deg, transparent, #00d2ff, transparent)',
        }} />

        {/* Header */}
        <div style={{ textAlign: 'center', marginBottom: 36 }}>
          <div style={{ fontSize: 44, lineHeight: 1, marginBottom: 12 }}>🛡️</div>
          <div style={{ color: '#00d2ff', fontWeight: 900, fontSize: 20, letterSpacing: 5 }}>
            Yantraraksha-Network
          </div>
          <div style={{ color: '#1e3a5f', fontSize: 10, letterSpacing: 3, marginTop: 6 }}>
            ICS / SCADA SECURITY PLATFORM
          </div>
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 12,
            padding: '4px 14px', borderRadius: 20, fontSize: 10, color: '#10b981',
            background: 'rgba(16,185,129,0.08)', border: '1px solid rgba(16,185,129,0.25)',
          }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#10b981', boxShadow: '0 0 6px #10b981', display: 'inline-block' }} />
            SYSTEM ONLINE · TN AUTOMOTIVE CLUSTER
          </div>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit}>

          {/* Username */}
          <div style={{ marginBottom: 16 }}>
            <div style={{ color: '#475569', fontSize: 10, letterSpacing: 2, marginBottom: 8, fontWeight: 600 }}>
              OPERATOR ID
            </div>
            <input
              type="text"
              value={username}
              onChange={e => setUsername(e.target.value)}
              placeholder="admin"
              autoComplete="off"
              autoFocus
              style={{
                width: '100%', boxSizing: 'border-box',
                background: 'var(--bg-main)',
                border: '1px solid var(--card-border)',
                borderRadius: 8, padding: '12px 16px',
                color: 'var(--text-main)', fontSize: 14,
                outline: 'none', fontFamily: 'inherit',
              }}
              onFocus={e  => e.target.style.borderColor = '#00d2ff'}
              onBlur={e   => e.target.style.borderColor = 'rgba(0,210,255,0.25)'}
            />
          </div>

          {/* Password */}
          <div style={{ marginBottom: 20 }}>
            <div style={{ color: '#475569', fontSize: 10, letterSpacing: 2, marginBottom: 8, fontWeight: 600 }}>
              SECURITY KEY
            </div>
            <input
              type="password"
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••••••"
              autoComplete="current-password"
              style={{
                width: '100%', boxSizing: 'border-box',
                background: 'var(--bg-main)',
                border: '1px solid var(--card-border)',
                borderRadius: 8, padding: '12px 16px',
                color: 'var(--text-main)', fontSize: 14,
                outline: 'none', fontFamily: 'inherit',
              }}
              onFocus={e  => e.target.style.borderColor = '#00d2ff'}
              onBlur={e   => e.target.style.borderColor = 'rgba(0,210,255,0.25)'}
            />
          </div>

          {/* Error */}
          {error && (
            <div style={{
              marginBottom: 16,
              background: 'rgba(239,68,68,0.08)',
              border: '1px solid rgba(239,68,68,0.4)',
              borderRadius: 6, padding: '10px 14px',
              color: '#ef4444', fontSize: 12, fontWeight: 700,
              textAlign: 'center',
            }}>
              ⚠ {error}
            </div>
          )}

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            style={{
              width: '100%',
              background: loading
                ? 'rgba(0,210,255,0.05)'
                : 'linear-gradient(135deg, rgba(0,210,255,0.15), rgba(0,80,180,0.25))',
              border: `1px solid ${loading ? 'rgba(0,210,255,0.15)' : 'rgba(0,210,255,0.5)'}`,
              borderRadius: 8, padding: '13px',
              color: loading ? '#334155' : '#00d2ff',
              fontWeight: 800, fontSize: 13,
              letterSpacing: 3, cursor: loading ? 'not-allowed' : 'pointer',
              fontFamily: 'inherit',
              boxShadow: loading ? 'none' : '0 0 24px rgba(0,210,255,0.12)',
              transition: 'all 0.2s',
            }}
          >
            {loading ? '⟳  AUTHENTICATING...' : '⚡  AUTHENTICATE'}
          </button>
        </form>

        {/* Demo credentials box */}
        <div style={{
          marginTop: 24,
          background: 'rgba(0,0,0,0.4)',
          border: '1px solid rgba(255,255,255,0.04)',
          borderRadius: 8, padding: '12px 16px',
        }}>
          <div style={{ color: '#1e3a5f', fontSize: 10, letterSpacing: 2, marginBottom: 8 }}>
            DEMO CREDENTIALS
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <span style={{ color: '#334155', fontSize: 11 }}>Operator</span>
            <span style={{ color: '#475569', fontSize: 11, fontFamily: 'monospace' }}>admin / sentinel123</span>
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ color: '#334155', fontSize: 11 }}>Officer</span>
            <span style={{ color: '#475569', fontSize: 11, fontFamily: 'monospace' }}>officer / officer123</span>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
            <button
              type="button"
              onClick={() => fillDemoCredentials(CREDENTIALS[0])}
              style={{
                flex: 1,
                background: 'rgba(0,210,255,0.08)',
                border: '1px solid rgba(0,210,255,0.22)',
                borderRadius: 6,
                padding: '8px 10px',
                color: '#00d2ff',
                fontSize: 11,
                fontWeight: 700,
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              Use Admin
            </button>
            <button
              type="button"
              onClick={() => fillDemoCredentials(CREDENTIALS[1])}
              style={{
                flex: 1,
                background: 'rgba(16,185,129,0.08)',
                border: '1px solid rgba(16,185,129,0.22)',
                borderRadius: 6,
                padding: '8px 10px',
                color: '#10b981',
                fontSize: 11,
                fontWeight: 700,
                cursor: 'pointer',
                fontFamily: 'inherit',
              }}
            >
              Use Officer
            </button>
          </div>
        </div>

        {/* Footer */}
        <div style={{ textAlign: 'center', marginTop: 20, color: '#0f2240', fontSize: 9, letterSpacing: 2 }}>
          UNAUTHORIZED ACCESS IS A CRIMINAL OFFENSE · IEC 62443
        </div>
      </div>
    </div>
  );
}
