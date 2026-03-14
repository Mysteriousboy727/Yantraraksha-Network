// src/App.jsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import apiClient from './services/apiClient';
import AttackGlobe from './AttackGlobe';
import './App.css';

const BACKEND_URL      = 'http://localhost:8000';
const NMAP_SCAN_INTERVAL = 30000;

// ==========================================
// 🛰️ NMAP HOOK
// ==========================================
function useNmapScan() {
  const [scanData, setScanData]         = useState(null);
  const [scanning, setScanning]         = useState(false);
  const [lastScan, setLastScan]         = useState(null);
  const [trafficHistory, setHistory]    = useState(
    Array(20).fill(0).map((_, i) => ({ t: i, v: 80 + Math.sin(i * 0.5) * 30 }))
  );

  const runScan = useCallback(async () => {
    setScanning(true);
    try {
      const res  = await fetch(`${BACKEND_URL}/api/v1/scan`);
      if (!res.ok) throw new Error('Scan failed');
      const data = await res.json();
      setScanData(data);
      setLastScan(new Date());
      setHistory(prev => [...prev.slice(1), {
        t: prev[prev.length - 1].t + 1,
        v: data.total_found * 15 + Math.random() * 20,
      }]);
    } catch (e) {
      console.warn('[Nmap]', e.message);
    } finally {
      setScanning(false);
    }
  }, []);

  useEffect(() => {
    runScan();
    const id = setInterval(runScan, NMAP_SCAN_INTERVAL);
    return () => clearInterval(id);
  }, [runScan]);

  return { scanData, scanning, lastScan, trafficHistory, runScan };
}

// ==========================================
// 📡 NMAP CANVAS GRAPH
// ==========================================
function NmapTrafficGraph({ trafficHistory, scanData, scanning, isUnderAttack, height = 120 }) {
  const canvasRef = useRef(null);
  const tRef      = useRef(0);
  const rafRef    = useRef(null);
  const histRef   = useRef(trafficHistory);

  // Keep histRef in sync without restarting the animation loop
  useEffect(() => { histRef.current = trafficHistory; }, [trafficHistory]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    function draw() {
      rafRef.current = requestAnimationFrame(draw);
      tRef.current  += 0.022;
      const t = tRef.current;

      const W = canvas.width, H = canvas.height;
      ctx.clearRect(0, 0, W, H);

      // Background
      ctx.fillStyle = '#020d1c';
      ctx.fillRect(0, 0, W, H);

      // Subtle grid lines
      ctx.strokeStyle = 'rgba(0,210,255,0.06)';
      ctx.lineWidth   = 0.8;
      for (let i = 1; i < 5; i++) {
        ctx.beginPath();
        ctx.moveTo(0, (H / 5) * i);
        ctx.lineTo(W, (H / 5) * i);
        ctx.stroke();
      }

      // Build animated wave points
      const history = histRef.current || [];
      const steps   = 80;
      const points  = [];

      for (let i = 0; i <= steps; i++) {
        const x       = (i / steps) * W;
        const histIdx = Math.floor((i / steps) * Math.max(history.length - 1, 0));
        const base    = history.length > 1
          ? (history[histIdx]?.v ?? 80)
          : 80 + 30 * Math.sin(i * 0.18);

        // Layer multiple sine waves scrolling at different speeds
        const wave = base
          + 18 * Math.sin(i * 0.14  - t * 1.8)
          + 10 * Math.sin(i * 0.28  - t * 2.6)
          +  6 * Math.sin(i * 0.52  - t * 1.2)
          +  3 * Math.sin(i * 0.9   - t * 3.4);

        const minV = 20, maxV = 200;
        const y = H - 12 - ((Math.max(minV, Math.min(maxV, wave)) - minV) / (maxV - minV)) * (H - 28);
        points.push({ x, y });
      }

      const base = isUnderAttack ? '#ef4444' : '#00d2ff';

      // Glowing fill under wave
      const fill = ctx.createLinearGradient(0, 0, 0, H);
      fill.addColorStop(0,   isUnderAttack ? 'rgba(239,68,68,0.22)'  : 'rgba(0,210,255,0.20)');
      fill.addColorStop(0.6, isUnderAttack ? 'rgba(239,68,68,0.06)'  : 'rgba(0,130,255,0.06)');
      fill.addColorStop(1,   'rgba(0,0,0,0)');

      ctx.beginPath();
      ctx.moveTo(points[0].x, H);
      points.forEach(p => ctx.lineTo(p.x, p.y));
      ctx.lineTo(points[points.length - 1].x, H);
      ctx.closePath();
      ctx.fillStyle = fill;
      ctx.fill();

      // Glowing wave line
      ctx.beginPath();
      points.forEach((p, i) => {
        if (i === 0) { ctx.moveTo(p.x, p.y); return; }
        const prev = points[i - 1];
        const cpx  = (prev.x + p.x) / 2;
        ctx.bezierCurveTo(cpx, prev.y, cpx, p.y, p.x, p.y);
      });
      ctx.strokeStyle = base;
      ctx.lineWidth   = 2.2;
      ctx.shadowColor = base;
      ctx.shadowBlur  = 12;
      ctx.stroke();
      ctx.shadowBlur  = 0;

      // Live dot at the right edge
      const last = points[points.length - 1];
      const pulse = 0.6 + 0.4 * Math.sin(t * 6);
      ctx.beginPath();
      ctx.arc(last.x, last.y, 4 * pulse, 0, Math.PI * 2);
      ctx.fillStyle   = base;
      ctx.shadowColor = base;
      ctx.shadowBlur  = 18;
      ctx.fill();
      ctx.shadowBlur  = 0;
    }

    draw();
    return () => cancelAnimationFrame(rafRef.current);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isUnderAttack]); // only restart loop if attack state flips

  return (
    <div style={{ position:'relative', width:'100%', height }}>
      <canvas ref={canvasRef} width={800} height={height}
        style={{ width:'100%', height:'100%' }} />
      <div style={{ position:'absolute', top:6, right:8, display:'flex',
                    alignItems:'center', gap:5, fontSize:10,
                    color: scanning ? '#f59e0b' : '#00d2ff' }}>
        <span style={{ width:6, height:6, borderRadius:'50%', display:'inline-block',
                       background: scanning ? '#f59e0b' : '#00d2ff',
                       boxShadow:`0 0 6px ${scanning ? '#f59e0b' : '#00d2ff'}` }} />
        {scanning ? 'Scanning...' : 'Nmap Live'}
      </div>
      {scanData?.rogue_count > 0 && (
        <div style={{ position:'absolute', bottom:4, left:8,
                      background:'rgba(239,68,68,0.15)',
                      border:'1px solid rgba(239,68,68,0.5)', borderRadius:4,
                      padding:'2px 8px', fontSize:10, color:'#ef4444', fontWeight:700 }}>
          ⚠ {scanData.rogue_count} ROGUE DEVICE{scanData.rogue_count > 1 ? 'S' : ''} DETECTED
        </div>
      )}
    </div>
  );
}

// ==========================================
// 🔵 NMAP DONUT
// ==========================================
function NmapDonut({ scanData, scanning, isUnderAttack }) {
  const total   = scanData?.total_found ?? 0;
  const trusted = scanData?.hosts?.filter(h => h.status === 'TRUSTED').length ?? 0;
  const rogue   = scanData?.rogue_count ?? 0;
  const pct     = total > 0 ? (trusted / total) * 100 : 100;
  const color   = rogue > 0 ? '#ef4444' : isUnderAttack ? '#f59e0b' : '#00d2ff';

  return (
    <div className="traffic-donut-wrapper">
      <div className="donut-outer-ring" style={{ borderColor: color }} />
      <div className="traffic-donut"
           style={{ background:`conic-gradient(${color} 0% ${pct}%, var(--card-border) ${pct}%)`,
                    boxShadow:`0 0 18px ${color}55` }}>
        <div className="donut-inner">
          <span className="d-num text-white" style={{ fontSize:14, color }}>
            {scanning ? '⟳' : total}
          </span>
          <span className="d-text" style={{ color, fontSize:9, fontWeight:700 }}>
            {rogue > 0 ? 'ROGUE!' : 'Operational'}
          </span>
          {rogue > 0 && <span style={{ fontSize:8, color:'#ef4444', marginTop:2 }}>{rogue} rogue</span>}
        </div>
      </div>
    </div>
  );
}

// ==========================================
// 🚨 ATTACK BANNER — THE KILL SWITCH UI
// Shows when isUnderAttack = true
// ==========================================
function AttackBanner({ statusData, onManualBlock, onReset, blocking }) {
  const ip      = statusData?.current_threat_ip;
  const blocked = statusData?.attacker_blocked;
  const by      = statusData?.blocked_by;

  if (!statusData?.is_under_attack) return null;

  return (
    <div style={{
      position:     'fixed',
      top:          0, left: 0, right: 0,
      zIndex:       1000,
      background:   blocked ? 'rgba(16,185,129,0.97)' : 'rgba(220,20,20,0.97)',
      borderBottom: `2px solid ${blocked ? '#10b981' : '#ff0000'}`,
      padding:      '10px 28px',
      display:      'flex',
      alignItems:   'center',
      justifyContent: 'space-between',
      boxShadow:    `0 0 40px ${blocked ? '#10b98188' : '#ff000088'}`,
      animation:    blocked ? 'none' : 'flashBanner 1s infinite',
    }}>
      {/* Left — status */}
      <div style={{ display:'flex', alignItems:'center', gap:12 }}>
        <span style={{ fontSize:22 }}>{blocked ? '🛡️' : '🚨'}</span>
        <div>
          <div style={{ color:'#fff', fontWeight:800, fontSize:14, letterSpacing:1 }}>
            {blocked
              ? `ATTACKER BLOCKED — ${ip} (by ${by === 'auto' ? 'ML Engine' : 'Officer'})`
              : `ACTIVE ATTACK DETECTED — ${ip}`}
          </div>
          <div style={{ color: blocked ? '#d1fae5' : '#fecaca', fontSize:11 }}>
            {blocked
              ? 'Firewall rule applied. Network securing...'
              : `Attack type: ${statusData?.active_threat} · Target: PLC-01`}
          </div>
        </div>
      </div>

      {/* Right — action buttons */}
      <div style={{ display:'flex', gap:10 }}>
        {!blocked && (
          <>
            {/* MANUAL BLOCK BUTTON */}
            <button
              onClick={onManualBlock}
              disabled={blocking}
              style={{
                background:   blocking ? '#374151' : '#fff',
                color:        blocking ? '#9ca3af' : '#dc2626',
                border:       'none',
                borderRadius: 6,
                padding:      '8px 20px',
                fontWeight:   800,
                fontSize:     13,
                cursor:       blocking ? 'not-allowed' : 'pointer',
                letterSpacing: 0.5,
                boxShadow:    '0 0 15px rgba(0,0,0,0.3)',
                display:      'flex',
                alignItems:   'center',
                gap:          6,
              }}
            >
              {blocking ? '⟳ Blocking...' : '🛑 BLOCK ATTACKER'}
            </button>

            {/* RESET / DISMISS */}
            <button
              onClick={onReset}
              style={{
                background:   'transparent',
                color:        '#fecaca',
                border:       '1px solid rgba(255,255,255,0.4)',
                borderRadius: 6,
                padding:      '8px 16px',
                fontWeight:   700,
                fontSize:     12,
                cursor:       'pointer',
              }}
            >
              ✕ Dismiss
            </button>
          </>
        )}

        {blocked && (
          <button
            onClick={onReset}
            style={{
              background:   '#065f46',
              color:        '#d1fae5',
              border:       '1px solid #10b981',
              borderRadius: 6,
              padding:      '8px 18px',
              fontWeight:   700,
              fontSize:     12,
              cursor:       'pointer',
            }}
          >
            ✓ Clear & Reset
          </button>
        )}
      </div>
    </div>
  );
}

// ==========================================
// 🚀 SCADA TOPOLOGY CANVAS (unchanged)
// ==========================================
const NODES = [
  { label:"HMI-D1",          x:147, y:141, icon:"🖥",  isTarget:false },
  { label:"PLC-01",          x:472, y:140, icon:"⊞",  isTarget:true  },
  { label:"Robotic Arm",     x:120, y:268, icon:"🦾", isTarget:false },
  { label:"Conveyor Sensor", x:168, y:338, icon:"⚙",  isTarget:false },
  { label:"HMI-01",          x:323, y:392, icon:"🖥",  isTarget:false },
  { label:"PLC-04",          x:532, y:322, icon:"⊞",  isTarget:false },
];
const CX=340, CY=237, THREAT={label:"45.X.X.X",x:578,y:66}, SPEED=0.012, TRAIL=Math.PI*0.55;

function ScadaTopology({ isUnderAttack }) {
  const canvasRef = useRef(null);
  const attackRef = useRef(isUnderAttack);
  useEffect(() => { attackRef.current = isUnderAttack; }, [isUnderAttack]);

  useEffect(() => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext("2d");
    if (!ctx.roundRect) {
      ctx.roundRect = function(x,y,w,h,r){
        this.moveTo(x+r,y);this.lineTo(x+w-r,y);this.quadraticCurveTo(x+w,y,x+w,y+r);
        this.lineTo(x+w,y+h-r);this.quadraticCurveTo(x+w,y+h,x+w-r,y+h);this.lineTo(x+r,y+h);
        this.quadraticCurveTo(x,y+h,x,y+h-r);this.lineTo(x,y+r);this.quadraticCurveTo(x,y,x+r,y);
        this.closePath();
      };
    }
    const nodes=NODES.map(n=>({...n,angle:Math.atan2(n.y-CY,n.x-CX),dist:Math.hypot(n.x-CX,n.y-CY),glow:0}));
    const ORBIT_R=nodes.reduce((s,n)=>s+n.dist,0)/nodes.length;
    let sweepAngle=-Math.PI, rafId;
    const angleDiff=(a,b)=>((b-a)%(2*Math.PI)+2*Math.PI)%(2*Math.PI);

    function draw(){
      const atk=attackRef.current;
      ctx.clearRect(0,0,680,480); ctx.fillStyle="#050a14"; ctx.fillRect(0,0,680,480);
      ctx.beginPath();ctx.arc(CX,CY,ORBIT_R,0,Math.PI*2);ctx.strokeStyle="rgba(0,210,255,0.05)";ctx.lineWidth=1;ctx.stroke();
      nodes.forEach(n=>{const d=angleDiff(sweepAngle,n.angle);if(d<0.18||d>2*Math.PI-0.18)n.glow=1.0;else n.glow=Math.max(0,n.glow-0.025);});
      const tgtNode=nodes.find(n=>n.isTarget);
      const tG=atk?tgtNode.glow:0;
      for(let i=0;i<40;i++){const t=i/40;const a0=sweepAngle-TRAIL*(1-t);const a1=sweepAngle-TRAIL*(1-t-1/40);const al=t*0.35;const r=tG>0.1?`rgba(255,${Math.floor(50*(1-tG))},0,${al})`:`rgba(0,180,255,${al})`;ctx.beginPath();ctx.moveTo(CX,CY);ctx.arc(CX,CY,ORBIT_R,a0,a1);ctx.closePath();ctx.fillStyle=r;ctx.fill();}
      const sc=tG>0.1?`rgba(255,60,0,${0.7+tG*0.3})`:"rgba(0,220,255,0.85)";
      ctx.beginPath();ctx.moveTo(CX,CY);ctx.lineTo(CX+Math.cos(sweepAngle)*ORBIT_R,CY+Math.sin(sweepAngle)*ORBIT_R);ctx.strokeStyle=sc;ctx.lineWidth=2;ctx.shadowColor=sc;ctx.shadowBlur=10;ctx.stroke();ctx.shadowBlur=0;
      nodes.forEach(n=>{
        const hit=atk&&n.isTarget;
        ctx.beginPath();ctx.moveTo(CX,CY);ctx.lineTo(n.x,n.y);ctx.strokeStyle=n.glow>0.05?(hit?`rgba(255,60,0,${0.3+n.glow*0.7})`:`rgba(0,200,255,${0.3+n.glow*0.7})`):"rgba(0,150,255,0.1)";ctx.lineWidth=n.glow>0.05?1.5:1;ctx.stroke();
        if(atk&&n.isTarget&&n.glow>0.05){ctx.beginPath();ctx.moveTo(n.x,n.y);ctx.lineTo(THREAT.x,THREAT.y);ctx.strokeStyle=`rgba(255,40,0,${n.glow*0.9})`;ctx.lineWidth=2;ctx.setLineDash([8,5]);ctx.shadowColor="#ff2200";ctx.shadowBlur=12*n.glow;ctx.stroke();ctx.setLineDash([]);ctx.shadowBlur=0;}
        const gc=hit?"#ff3300":"#00d2ff";
        ctx.beginPath();ctx.roundRect(n.x-32,n.y-18,64,36,6);ctx.fillStyle=n.glow>0.05?(hit?`rgba(80,0,0,${0.5+n.glow*0.5})`:`rgba(0,40,100,${0.6+n.glow*0.4})`):"rgba(0,50,150,0.1)";ctx.shadowColor=n.glow>0.05?gc:"transparent";ctx.shadowBlur=n.glow>0.05?18*n.glow:0;ctx.fill();ctx.shadowBlur=0;ctx.strokeStyle=n.glow>0.05?gc:"rgba(0,150,255,0.2)";ctx.lineWidth=n.glow>0.05?1.5:0.8;ctx.stroke();
        ctx.font="14px Inter,sans-serif";ctx.textAlign="center";ctx.fillStyle="#fff";ctx.fillText(n.icon,n.x,n.y+2);ctx.font="10px Inter,sans-serif";ctx.fillStyle=n.glow>0.05?(hit?"#ff8866":"#88ccff"):"#8b949e";ctx.fillText(n.label,n.x,n.y+30);
      });
      ctx.beginPath();ctx.roundRect(CX-70,CY-27,140,54,8);ctx.fillStyle="#0044ff";ctx.shadowColor="#0044ff";ctx.shadowBlur=20;ctx.fill();ctx.shadowBlur=0;ctx.fillStyle="#fff";ctx.font="bold 12px Inter,sans-serif";ctx.textAlign="center";ctx.fillText("SCADA SERVER",CX,CY+4);
      if(atk){const tg=tgtNode.glow;ctx.beginPath();ctx.roundRect(THREAT.x-50,THREAT.y-26,100,48,8);ctx.fillStyle=tg>0.05?`rgba(100,0,0,${0.5+tg*0.5})`:"#1a0000";ctx.shadowColor="#ff2200";ctx.shadowBlur=tg>0.05?24*tg:6;ctx.fill();ctx.shadowBlur=0;ctx.strokeStyle=tg>0.05?`rgba(255,50,0,${0.5+tg*0.5})`:"#660000";ctx.lineWidth=tg>0.05?2:1;ctx.stroke();ctx.font="bold 13px Inter";ctx.textAlign="center";ctx.fillStyle=tg>0.05?`rgba(255,100,80,${0.7+tg*0.3})`:"#aa3333";ctx.fillText("☠",THREAT.x,THREAT.y-6);ctx.font="11px Inter";ctx.fillStyle=tg>0.05?`rgba(255,120,100,${0.7+tg*0.3})`:"#882222";ctx.fillText("45.X.X.X",THREAT.x,THREAT.y+12);}
      sweepAngle+=SPEED;if(sweepAngle>Math.PI*2)sweepAngle-=Math.PI*2;
      rafId=requestAnimationFrame(draw);
    }
    draw();
    return ()=>cancelAnimationFrame(rafId);
  }, []);

  return (
    <div style={{width:'100%',height:'100%',borderRadius:10,overflow:"hidden",position:'relative'}}>
      <div style={{position:'absolute',top:'15px',left:'15px',color:'#e2e8f0',fontSize:'14px',fontWeight:'bold',zIndex:10}}>⬩⬩ LIVE NETWORK TOPOLOGY</div>
      <canvas ref={canvasRef} width={680} height={480} style={{width:"100%",height:"100%",objectFit:"contain",display:"block"}} />
    </div>
  );
}

// ==========================================
// MAIN APP
// ==========================================
function App() {
  const [statusData, setStatusData]     = useState(null);
  const [alerts, setAlerts]             = useState([]);
  const [devices, setDevices]           = useState([]);
  const [incidentData, setIncidentData] = useState(null);
  const [isUnderAttack, setIsUnderAttack] = useState(false);
  const [activeTab, setActiveTab]       = useState('dashboard');
  const [blocking, setBlocking]         = useState(false);   // block button loading state
  const [blockMsg, setBlockMsg]         = useState('');

  const { scanData, scanning, lastScan, trafficHistory, runScan } = useNmapScan();

  // ── Polling ──────────────────────────────────────────────────
  useEffect(() => {
    const fetchData = async () => {
      const s = await apiClient.getStatus();
      if (s) { setStatusData(s); setIsUnderAttack(s.is_under_attack); }
      const a = await apiClient.getAlerts();    if (a) setAlerts(a);
      const d = await apiClient.getDevices();   if (d) setDevices(d);
      const i = await apiClient.getIncidentDetails(); if (i) setIncidentData(i);
    };
    fetchData();
    const id = setInterval(fetchData, 3000);
    apiClient.connectWebSocket((newAlert) => {
      setAlerts(prev => [newAlert, ...prev]);
      if (newAlert.severity === 'CRITICAL') { setIsUnderAttack(true); fetchData(); }
    });
    return () => clearInterval(id);
  }, []);

  // ── Manual block handler ─────────────────────────────────────
  const handleManualBlock = async () => {
    setBlocking(true);
    setBlockMsg('');
    try {
      const res = await fetch(`${BACKEND_URL}/api/v1/block-attacker`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason: 'Manual block by security officer' }),
      });
      const data = await res.json();
      setBlockMsg(data.status === 'blocked'
        ? `✓ Blocked ${data.ip} — Firewall: ${data.firewall}`
        : data.message || data.status);
    } catch (e) {
      setBlockMsg(`Error: ${e.message}`);
    } finally {
      setBlocking(false);
    }
  };

  // ── Reset handler ────────────────────────────────────────────
  const handleReset = async () => {
    await fetch(`${BACKEND_URL}/api/v1/reset`, { method: 'POST' });
    setBlockMsg('');
  };

  // ── ML control handler ───────────────────────────────────────
  const handleMLControl = async (action) => {
    await fetch(`${BACKEND_URL}/api/v1/ml-control`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    });
  };

  if (!statusData) return (
    <div className="loading-screen">INITIALIZING SECURE BLUE PROTOCOL...</div>
  );

  const calmEq   = [1,2,3,2,4,3,2,1,2,3,4,3,2,1,2,3,2,1,1,1];
  const attackEq = [2,2,3,4,6,8,12,18,28,35,35,30,22,14,10,10,10,8,6,4];
  const activeEq = isUnderAttack ? attackEq : calmEq;

  return (
    <div className="app-wrapper">

      {/* ── ATTACK BANNER (fixed top, only when under attack) ── */}
      <AttackBanner
        statusData={statusData}
        onManualBlock={handleManualBlock}
        onReset={handleReset}
        blocking={blocking}
      />

      {/* Push content down when banner is showing */}
      {isUnderAttack && <div style={{ height: 56 }} />}

      {/* ── SIDEBAR ──────────────────────────────────────────── */}
      <aside className="sidebar">
        <div className="sidebar-logo">
          <span className="logo-shield text-cyan">🛡️</span>
          <h2>SENTINEL <span className="text-cyan">OS</span></h2>
        </div>

        <ul className="sidebar-menu">
          {[
            ['dashboard',         '📊 Dashboard'],
            ['discovery',         '🕸️ Discovery'],
            ['alert_feed',        '⚡ Alert Feed'],
            ['device_registry',   '🗄️ Device Registry'],
            ['incident_response', '🚨 Incident Response'],
            ['ml_engine',         '🤖 ML Anomaly Engine'],
          ].map(([key, label]) => (
            <li key={key} className={activeTab===key?'active':''} onClick={()=>setActiveTab(key)}>
              {label}
            </li>
          ))}
        </ul>

        <div className="sidebar-footer">
          {/* Nmap status */}
          <div style={{fontSize:10,color:'#6b7280',marginBottom:6,textAlign:'center'}}>
            {scanning
              ? <span style={{color:'#f59e0b'}}>⟳ Nmap scanning...</span>
              : lastScan
                ? <span style={{color:'#10b981'}}>✓ Nmap: {scanData?.total_found??0} hosts</span>
                : <span>Nmap: waiting</span>}
          </div>

          {/* Kill switch in sidebar when under attack */}
          {isUnderAttack && !statusData?.attacker_blocked && (
            <button
              onClick={handleManualBlock}
              disabled={blocking}
              style={{
                width:'100%', marginBottom:8,
                background:'#dc2626', color:'#fff',
                border:'none', borderRadius:6, padding:'8px',
                fontWeight:800, fontSize:12, cursor:'pointer',
                animation:'flashBanner 1s infinite',
              }}
            >
              {blocking ? '⟳ Blocking...' : '🛑 KILL SWITCH'}
            </button>
          )}

          <div className={`status-badge ${isUnderAttack?'border-flash text-red':'border-cyan text-cyan'}`}>
            <span className={`dot ${isUnderAttack?'bg-red':'pulse-cyan'}`}></span>
            {statusData?.attacker_blocked ? 'CONTAINED' : isUnderAttack ? 'COMPROMISED' : 'SECURE'}
          </div>
        </div>
      </aside>

      {/* ── MAIN CONTENT ─────────────────────────────────────── */}
      <main className="main-content">
        <header className="top-header">
          <h2>{activeTab.replace('_',' ').toUpperCase()}</h2>
          <div className="header-right">
            <span>Factory: TN Automotive Cluster</span>
            <span className="live-mon">⏱ Live Monitoring</span>
            <span className="user-icon">👤</span>
          </div>
        </header>

        {/* blockMsg feedback */}
        {blockMsg && (
          <div style={{
            margin:'0 0 12px', padding:'8px 16px', borderRadius:6,
            background: blockMsg.startsWith('✓') ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)',
            border:`1px solid ${blockMsg.startsWith('✓') ? '#10b981' : '#ef4444'}44`,
            color: blockMsg.startsWith('✓') ? '#10b981' : '#ef4444',
            fontSize:13,
          }}>
            {blockMsg}
          </div>
        )}

        {/* ══ TAB 1: DASHBOARD ══════════════════════════════ */}
        {activeTab === 'dashboard' && (
          <div className="master-grid">

            {/* KPI 1 — real Nmap count */}
            <div className="card kpi-card bg-grad-cyan pos-kpi1">
              <div className="kpi-top">
                <span className="kpi-icon text-cyan">🤖</span>
                <span className="kpi-title">Machines Online</span>
              </div>
              <div className="kpi-value text-white">
                {scanData?.total_found ?? statusData.devices_online}
              </div>
              <div style={{fontSize:10,color:'#6b7280',marginTop:4}}>
                {scanData
                  ? `${scanData.hosts?.filter(h=>h.status==='TRUSTED').length??0} trusted · ${scanData.rogue_count??0} rogue`
                  : 'Loading scan...'}
              </div>
            </div>

            <div className={`card kpi-card ${isUnderAttack?'bg-grad-red border-flash':'bg-grad-cyan'} pos-kpi2`}>
              <div className="kpi-top">
                <span className={`kpi-icon ${isUnderAttack?'alert-bg text-red':'text-cyan'}`}>{isUnderAttack?'🚨':'✅'}</span>
                <span className="kpi-title">Network Status</span>
              </div>
              <div className={`kpi-value ${isUnderAttack?'text-red':'text-cyan'}`}>
                {statusData?.attacker_blocked ? 'CONTAINED' : isUnderAttack ? 'DANGER' : 'SAFE'}
              </div>
            </div>

            <div className={`card kpi-card ${isUnderAttack?'bg-grad-red border-flash':'bg-grad-cyan'} pos-kpi3`}>
              <div className="kpi-top">
                <span className={`kpi-icon ${isUnderAttack?'alert-bg text-red':'text-cyan'}`}>⚠️</span>
                <span className="kpi-title">Active Alerts</span>
              </div>
              <div className={`kpi-value ${isUnderAttack?'text-red':'text-cyan'}`}>
                {statusData.critical_alerts}
              </div>
            </div>

            {/* Traffic card — Nmap graph + donut */}
            <div className="card traffic-card pos-traffic">
              <div className="card-title" style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                <span>Network Traffic <span className="subtitle">(Live Feed)</span></span>
                <span style={{fontSize:10,color:'#6b7280'}}>Nmap · 192.168.1.0/24 · 30s</span>
              </div>
              <div className="traffic-content">
                <div className="traffic-chart-wrapper">
                  <div className="y-axis"><span>500</span><span>400</span><span>300</span><span>200</span><span>100</span><span>000</span></div>
                  <div className="traffic-graph-area overflow-hidden" style={{position:'relative'}}>
                    <div className="bg-grid-lines">
                      <div className="h-line"/><div className="h-line"/><div className="h-line"/><div className="h-line"/><div className="h-line"/>
                    </div>
                    <NmapTrafficGraph trafficHistory={trafficHistory} scanData={scanData}
                      scanning={scanning} isUnderAttack={isUnderAttack} height={120} />
                  </div>
                </div>
                <NmapDonut scanData={scanData} scanning={scanning} isUnderAttack={isUnderAttack} />
              </div>
            </div>

            <div className="card risk-card pos-risk">
              <div className="card-title">High Risk Areas</div>
              <div className="risk-chart-wrapper">
                <div className="risk-chart-inner">
                  <div className="y-axis"><span>400</span><span>300</span><span>200</span><span>100</span></div>
                  <div className="bar-chart-area">
                    <div className="bg-grid-lines"><div className="h-line"/><div className="h-line"/><div className="h-line"/><div className="h-line"/></div>
                    <div className="bars-container">
                      <div className="bar-col"><div className="bar bg-cyan" style={{height:'30%'}}/></div>
                      <div className="bar-col"><div className="bar bg-blue" style={{height:'50%'}}/></div>
                      <div className="bar-col"><div className={`bar ${isUnderAttack?'bg-red border-flash':'bg-red'}`} style={{height:isUnderAttack?'95%':'80%'}}/></div>
                    </div>
                  </div>
                </div>
                <div className="x-labels-container"><span className="x-label">Zone A</span><span className="x-label">Zone B</span><span className="x-label">Zone C</span></div>
              </div>
            </div>

            <div className="card pos-topo" style={{padding:0,overflow:'hidden'}}>
              <ScadaTopology isUnderAttack={isUnderAttack} />
            </div>

            <div className="card right-card pos-ai">
              <div className="panel-header">
                <div className="card-title"><span className="kpi-icon text-cyan">🤖</span> AI Threat Detection</div>
                <span className="dots-menu">•••</span>
              </div>
              <div className="panel-body">
                <div className="ai-row"><span className="ai-label">Model Status:</span><span className="ai-val text-white">{statusData.baseline_status}</span></div>
                <div className="ai-row"><span className="ai-label">Predicted Threat:</span><span className="ai-val text-white">{statusData.active_threat}</span></div>
                <div className="confidence-area">
                  <div className="conf-text"><span>Confidence: <span className="text-white">{statusData.ml_confidence}%</span></span></div>
                  <div className="progress-bg"><div className={`progress-fill ${isUnderAttack?'grad-red-bar':'bg-cyan'}`} style={{width:`${statusData.ml_confidence}%`}}><span className="prog-label">HIGH</span></div></div>
                </div>
                <div className={`risk-level ${isUnderAttack?'text-red':'text-cyan'}`}>
                  <span className="risk-bars">|||</span> Risk Level:
                  <span className="risk-badge" style={{color:isUnderAttack?'#ef4444':'#00d2ff',borderColor:isUnderAttack?'#ef4444':'#00d2ff',background:'transparent'}}>
                    {isUnderAttack?'HIGH':'LOW'}
                  </span>
                </div>
                {/* ── Quick block button inside AI panel too ── */}
                {isUnderAttack && !statusData?.attacker_blocked && (
                  <button onClick={handleManualBlock} disabled={blocking} style={{
                    marginTop:12, width:'100%', background:'#dc2626', color:'#fff',
                    border:'none', borderRadius:6, padding:'7px', fontWeight:800,
                    fontSize:12, cursor:blocking?'not-allowed':'pointer',
                  }}>
                    {blocking ? '⟳ Blocking...' : `🛑 Block ${statusData?.current_threat_ip}`}
                  </button>
                )}
              </div>
            </div>

            <div className="card right-card pos-alerts-mid">
              <div className="panel-header">
                <div className="card-title"><span className="icon-plus">⊞</span> Active Alerts</div>
                <button className="view-btn">View All {'>'}</button>
              </div>
              <div className="panel-body flex-row-center">
                <div className="eq-info">
                  <div className="eq-dev-line"><span className="eq-label">System State:</span><span className="eq-val text-white">{statusData?.attacker_blocked?'Contained':isUnderAttack?'Compromised':'Monitoring'}</span></div>
                  <div className="eq-desc">{isUnderAttack?<span className="text-red">Unauthorized<br/>Command Injection</span>:<>Baseline Traffic<br/>Normal</>}</div>
                </div>
                <div className="eq-visual-area">
                  <div className="eq-bars-container">
                    {activeEq.map((h,i)=>{
                      let cc='bg-eq-cyan',gc='';
                      if(isUnderAttack){if(i>=8&&i<=10){cc='bg-eq-red';gc='glow-red';}else if(i>10)cc='bg-eq-darkred';else if(i===7)cc='bg-eq-orange';}
                      return <div key={i} className={`eq-bar ${cc} ${gc}`} style={{height:`${h}px`}}/>;
                    })}
                  </div>
                  <div className="eq-axis"><span>10 AM</span><span>11 AM</span><span>12 AM</span><span>12 AM</span><span>2 PM</span><span>4 PM</span><span>5 PM</span><span>6 AM</span></div>
                </div>
              </div>
            </div>

            <div className="card right-card pos-timeline">
              <div className="panel-header">
                <div className="card-title">Attack Timeline <span className="subtitle">(Last 24 Hours)</span></div>
                <button className="view-btn">View All {'>'}</button>
              </div>
              <div className="table-responsive">
                <table className="pro-table">
                  <thead><tr><th>Device</th><th>Attack Type</th><th>Severity</th><th>Time</th></tr></thead>
                  <tbody>
                    {alerts.length > 0 ? alerts.slice(0,3).map((alert,idx)=>(
                      <tr key={idx} className={idx===0&&isUnderAttack?"flash-bg":""}>
                        <td><span className={`status-dot ${alert.severity==='CRITICAL'||alert.severity==='HIGH'?'bg-red':alert.severity==='MEDIUM'?'bg-yellow':'bg-cyan'}`}/><span className="text-white font-bold">{alert.destination_ip}</span></td>
                        <td className="text-dim">{alert.title?.substring(0,25)}</td>
                        <td><span className={`solid-pill ${alert.severity.toLowerCase()}`}>{alert.severity}</span></td>
                        <td className="text-dim">{new Date(alert.timestamp).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit'})}</td>
                      </tr>
                    )):(
                      <tr><td colSpan="4" style={{textAlign:"center",color:"#00d2ff",padding:"20px"}}>No Critical Threats Detected</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {/* ══ TAB 2: DISCOVERY ══════════════════════════════ */}
        {activeTab === 'discovery' && (
          <div className="tab-grid discovery-grid">
            <div className="card topo-card span-full" style={{padding:0,height:'60vh'}}>
              <ScadaTopology isUnderAttack={isUnderAttack} />
            </div>
            <div className="card bg-grad-cyan">
              <div className="card-title">Discovered Protocols</div>
              <p className="text-dim mt-2">Modbus TCP: 4 Devices<br/>DNP3: 1 Device<br/>Profinet: 1 Device</p>
            </div>
            <div className="card bg-grad-cyan">
              <div className="card-title">Shadow IT Scanner <span style={{fontSize:10,color:'#6b7280'}}>via Nmap</span></div>
              {scanData?.rogue_count > 0 ? (
                <div className="mt-2">
                  {scanData.hosts.filter(h=>h.status==='ROGUE').map((h,i)=>(
                    <div key={i} style={{color:'#ef4444',fontWeight:700,fontSize:13,padding:'4px 0',borderBottom:'1px solid rgba(239,68,68,0.2)'}}>
                      ☠ {h.ip}
                      {h.open_ports && <span style={{fontSize:10,color:'#f97316',marginLeft:8}}>Ports: {Object.keys(h.open_ports).join(', ')}</span>}
                    </div>
                  ))}
                </div>
              ) : (
                <p className="text-dim mt-2" style={{color:'#10b981'}}>✓ No unauthorized devices detected</p>
              )}
            </div>
          </div>
        )}

{/* ══ TAB 3: ALERT FEED ═════════════════════════════ */}
{activeTab === 'alert_feed' && (
  <div style={{display:'flex',flexDirection:'column',gap:16}}>

    {/* Globe */}
    <div className="card" style={{padding:16}}>
      <div className="card-title" style={{marginBottom:12}}>
        🌐 Global Attack Origin Map
        <span style={{marginLeft:10,color:'#6b7280',fontSize:11,fontWeight:'normal'}}>
          — drag to rotate — live attacker IPs plotted
        </span>
      </div>
      <AttackGlobe alerts={alerts} isUnderAttack={isUnderAttack} />
    </div>

    {/* Traffic graph */}
    <div className="card traffic-card">
      <div className="card-title" style={{display:'flex',justifyContent:'space-between'}}>
        <span>Network Traffic Graph</span>
        <span style={{fontSize:11,color:'#6b7280',display:'flex',gap:12}}>
          {scanData&&<><span style={{color:'#10b981'}}>✓ {scanData.hosts?.filter(h=>h.status==='TRUSTED').length} trusted</span>{scanData.rogue_count>0&&<span style={{color:'#ef4444'}}>⚠ {scanData.rogue_count} rogue</span>}<span>Total: {scanData.total_found}</span></>}
          <span style={{color:scanning?'#f59e0b':'#00d2ff'}}>{scanning?'⟳ Scanning...':'● Nmap Live'}</span>
        </span>
      </div>
      <div style={{height:180,marginTop:8}}>
        <NmapTrafficGraph trafficHistory={trafficHistory} scanData={scanData}
          scanning={scanning} isUnderAttack={isUnderAttack} height={180} />
      </div>
    </div>

    {/* Alert list */}
    <div className="card alerts-mid-card">
      <div className="card-title" style={{marginBottom:12}}>
        ⚡ Live Alert Feed — {alerts.length} alerts — ML detected — MITRE mapped
      </div>
      {alerts.length === 0 ? (
        <div style={{textAlign:'center',color:'#00d2ff',padding:40}}>
          No alerts yet — ML engine analyzing traffic...
        </div>
      ) : alerts.map((a,i)=>(
        <div key={i} style={{
          padding:'10px 14px',marginBottom:8,borderRadius:6,
          background:'rgba(0,210,255,0.05)',
          borderLeft:`3px solid ${a.severity==='CRITICAL'?'#ef4444':a.severity==='HIGH'?'#f97316':'#00d2ff'}`,
        }}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
            <span style={{color:'#fff',fontWeight:700,fontSize:13}}>{a.title}</span>
            <div style={{display:'flex',gap:8,alignItems:'center'}}>
              <span style={{background:'rgba(139,92,246,0.15)',color:'#8b5cf6',
                fontSize:10,padding:'1px 7px',borderRadius:4}}>{a.mitre_tag}</span>
              <span className={`solid-pill ${a.severity.toLowerCase()}`}>{a.severity}</span>
            </div>
          </div>
          <div style={{color:'#6b7280',fontSize:11,marginTop:4}}>
            {a.source_ip} → {a.destination_ip} · {new Date(a.timestamp).toLocaleTimeString()}
          </div>
        </div>
      ))}
    </div>
  </div>
)}

        {/* ══ TAB 4: DEVICE REGISTRY ════════════════════════ */}
        {activeTab === 'device_registry' && (
          <div className="card span-full">
            <div className="card-title">Connected Devices</div>
            <table className="pro-table mt-4">
              <thead><tr><th>Device Name</th><th>IP Address</th><th>Protocol</th><th>Status</th></tr></thead>
              <tbody>
                {devices.map((n,i)=>(
                  <tr key={i} className={n.type==="Threat"?"flash-bg":""}>
                    <td className={n.type==="Threat"?"text-red font-bold":"text-white"}>{n.type==="Threat"?'☠️ ':''}{n.name}</td>
                    <td className="text-dim">{n.ip}</td>
                    <td className="text-dim">TCP/IP</td>
                    <td><span className={`solid-pill ${n.status==='ONLINE'?'low':n.status==='BLOCKED'?'medium':'critical'}`}>{n.status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* ══ TAB 5: INCIDENT RESPONSE ══════════════════════ */}
        {activeTab === 'incident_response' && (
          <div className="tab-grid incident-grid">
            <div className="card bg-grad-cyan">
              <div className="card-title">Attack Probability</div>
              <h2 className="mt-4 kpi-value" style={{color:isUnderAttack?'#ef4444':'#00d2ff'}}>{isUnderAttack?'98.5%':'2.1%'}</h2>
              <p className="text-dim mt-2">Chances of successful exploitation based on current traffic.</p>
            </div>
            <div className="card bg-grad-cyan">
              <div className="card-title">Network Channel Info</div>
              <div className="mt-4 text-white">
                <p className="mb-2">Protocol: <span className="text-cyan font-bold">{incidentData?.protocol||'Modbus TCP'}</span></p>
                <p className="mb-2">Transport: <span className="text-cyan font-bold">{incidentData?.transport||'TCP'}</span></p>
                <p className="mb-2">Port: <span className="text-cyan font-bold">{incidentData?.port||'502'}</span></p>
              </div>
            </div>
            <div className="card span-full">
              <div className="card-title">Response Playbook</div>
              <div className="mt-4">
                {isUnderAttack ? (
                  <>
                    <ul className="text-red list-disc pl-5">
                      {incidentData?.playbook_steps?.map((step,i)=><li key={i} className="mb-2">{step}</li>)}
                    </ul>
                    {!statusData?.attacker_blocked && (
                      <button onClick={handleManualBlock} disabled={blocking} style={{
                        marginTop:16,background:'#dc2626',color:'#fff',border:'none',
                        borderRadius:6,padding:'10px 24px',fontWeight:800,fontSize:14,cursor:'pointer',
                      }}>
                        {blocking?'⟳ Blocking...':'🛑 Execute: Block Attacker Now'}
                      </button>
                    )}
                    {statusData?.attacker_blocked && (
                      <div style={{marginTop:12,color:'#10b981',fontWeight:700}}>
                        ✓ Attacker {statusData.current_threat_ip} has been blocked by {statusData.blocked_by==='auto'?'ML Engine':'Security Officer'}
                      </div>
                    )}
                  </>
                ) : (
                  <p className="text-cyan">No active playbooks required. System is secure.</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ══ TAB 6: ML ANOMALY ENGINE ══════════════════════ */}
        {activeTab === 'ml_engine' && (
          <div className="tab-grid ml-grid">
            <div className="card right-card">
              <div className="panel-header">
                <div className="card-title"><span className="kpi-icon text-cyan">🤖</span> ML Engine Controls</div>
              </div>
              <div className="panel-body">

                {/* Engine status */}
                <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:16}}>
                  <span style={{
                    width:10,height:10,borderRadius:'50%',display:'inline-block',
                    background: statusData?.ml_engine_active ? '#10b981' : '#ef4444',
                    boxShadow:`0 0 8px ${statusData?.ml_engine_active ? '#10b981' : '#ef4444'}`,
                  }}/>
                  <span style={{color:'#fff',fontWeight:700}}>
                    ML Engine: {statusData?.ml_engine_active ? 'ACTIVE' : 'STOPPED'}
                  </span>
                </div>

                {/* Start / Stop buttons */}
                <div style={{display:'flex',gap:10,marginBottom:16}}>
                  <button onClick={()=>handleMLControl('start')} style={{
                    flex:1,background:'rgba(16,185,129,0.15)',color:'#10b981',
                    border:'1px solid #10b981',borderRadius:6,padding:'8px',
                    fontWeight:700,fontSize:12,cursor:'pointer',
                  }}>▶ Start Engine</button>
                  <button onClick={()=>handleMLControl('stop')} style={{
                    flex:1,background:'rgba(239,68,68,0.15)',color:'#ef4444',
                    border:'1px solid #ef4444',borderRadius:6,padding:'8px',
                    fontWeight:700,fontSize:12,cursor:'pointer',
                  }}>■ Stop Engine</button>
                </div>

                {/* Auto-respond toggle */}
                <div style={{
                  display:'flex',alignItems:'center',justifyContent:'space-between',
                  padding:'10px 14px',borderRadius:6,
                  background: statusData?.auto_respond ? 'rgba(16,185,129,0.1)' : 'rgba(0,210,255,0.05)',
                  border:`1px solid ${statusData?.auto_respond ? '#10b981' : '#1f2937'}`,
                  marginBottom:16,
                }}>
                  <div>
                    <div style={{color:'#fff',fontWeight:700,fontSize:13}}>🤖 Auto-Respond</div>
                    <div style={{color:'#6b7280',fontSize:11}}>ML auto-blocks attacker when confidence {'>'} 95%</div>
                  </div>
                  <button
                    onClick={()=>handleMLControl(statusData?.auto_respond ? 'auto_off' : 'auto_on')}
                    style={{
                      background: statusData?.auto_respond ? '#10b981' : '#374151',
                      color:'#fff', border:'none', borderRadius:20,
                      padding:'4px 14px', fontWeight:700, fontSize:12, cursor:'pointer',
                    }}
                  >
                    {statusData?.auto_respond ? 'ON' : 'OFF'}
                  </button>
                </div>

                {/* Manual block in ML tab */}
                {isUnderAttack && !statusData?.attacker_blocked && (
                  <button onClick={handleManualBlock} disabled={blocking} style={{
                    width:'100%',background:'#dc2626',color:'#fff',border:'none',
                    borderRadius:6,padding:'10px',fontWeight:800,fontSize:13,
                    cursor:blocking?'not-allowed':'pointer',
                  }}>
                    {blocking?'⟳ Blocking...':'🛑 Manual Block Attacker'}
                  </button>
                )}

                {statusData?.attacker_blocked && (
                  <div style={{
                    padding:'10px',borderRadius:6,
                    background:'rgba(16,185,129,0.1)',border:'1px solid #10b981',
                    color:'#10b981',fontWeight:700,fontSize:13,textAlign:'center',
                  }}>
                    ✓ Attacker Blocked by {statusData.blocked_by==='auto'?'ML Engine':'Officer'}
                  </div>
                )}

                <div className="ai-row mt-4"><span className="ai-label">Model:</span><span className="ai-val text-white">Isolation Forest (v2.1)</span></div>
                <div className="ai-row"><span className="ai-label">Predicted Attack:</span><span className="ai-val text-white">{statusData.active_threat}</span></div>
                <div className="confidence-area">
                  <div className="conf-text"><span>AI Confidence: <span className="text-white">{statusData.ml_confidence}%</span></span></div>
                  <div className="progress-bg"><div className={`progress-fill ${isUnderAttack?'grad-red-bar':'bg-cyan'}`} style={{width:`${statusData.ml_confidence}%`}}/></div>
                </div>
              </div>
            </div>

            <div className="card risk-card">
              <div className="card-title">High Risk Areas (Zones)</div>
              <div className="risk-chart-wrapper" style={{height:'200px'}}>
                <div className="risk-chart-inner">
                  <div className="y-axis"><span>400</span><span>300</span><span>200</span><span>100</span></div>
                  <div className="bar-chart-area">
                    <div className="bg-grid-lines"><div className="h-line"/><div className="h-line"/><div className="h-line"/><div className="h-line"/></div>
                    <div className="bars-container">
                      <div className="bar-col"><div className="bar bg-cyan" style={{height:'30%'}}/></div>
                      <div className="bar-col"><div className="bar bg-blue" style={{height:'50%'}}/></div>
                      <div className="bar-col"><div className={`bar ${isUnderAttack?'bg-red border-flash':'bg-red'}`} style={{height:isUnderAttack?'95%':'80%'}}/></div>
                    </div>
                  </div>
                </div>
                <div className="x-labels-container"><span className="x-label">Zone A</span><span className="x-label">Zone B</span><span className="x-label">Zone C (Threat)</span></div>
              </div>
            </div>
          </div>
        )}

      </main>

      {/* CSS for banner flash animation */}
      <style>{`
        @keyframes flashBanner {
          0%, 100% { opacity: 1; }
          50%       { opacity: 0.85; }
        }
      `}</style>
    </div>
  );
}

export default App;
