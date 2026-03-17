// src/App.jsx
import React, { useState, useEffect, useRef, useCallback } from 'react';
import apiClient from './services/apiClient';
import AttackGlobe from './AttackGlobe';
import ThreatMap from './ThreatMap';
import './App.css';
import MLEngineTab from './MLEngineTab';

const BACKEND_URL        = 'http://localhost:8000';
const NMAP_SCAN_INTERVAL = 30000;

// ==========================================
// NMAP HOOK
// ==========================================
function useNmapScan() {
  const [scanData, setScanData]      = useState(null);
  const [scanning, setScanning]      = useState(false);
  const [lastScan, setLastScan]      = useState(null);
  const [trafficHistory, setHistory] = useState(
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
    } catch (e) { console.warn('[Nmap]', e.message); }
    finally { setScanning(false); }
  }, []);
  useEffect(() => {
    runScan();
    const id = setInterval(runScan, NMAP_SCAN_INTERVAL);
    return () => clearInterval(id);
  }, [runScan]);
  return { scanData, scanning, lastScan, trafficHistory, runScan };
}

// ==========================================
// NMAP CANVAS GRAPH
// ==========================================
function NmapTrafficGraph({ trafficHistory, scanData, scanning, isUnderAttack, height = 120 }) {
  const canvasRef = useRef(null);
  const tRef      = useRef(0);
  const rafRef    = useRef(null);
  const histRef   = useRef(trafficHistory);
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
      ctx.fillStyle = '#020d1c'; ctx.fillRect(0, 0, W, H);
      ctx.strokeStyle = 'rgba(0,210,255,0.06)'; ctx.lineWidth = 0.8;
      for (let i = 1; i < 5; i++) { ctx.beginPath(); ctx.moveTo(0,(H/5)*i); ctx.lineTo(W,(H/5)*i); ctx.stroke(); }
      const history = histRef.current || [];
      const steps = 80, points = [];
      for (let i = 0; i <= steps; i++) {
        const x = (i / steps) * W;
        const histIdx = Math.floor((i / steps) * Math.max(history.length - 1, 0));
        const base = history.length > 1 ? (history[histIdx]?.v ?? 80) : 80 + 30 * Math.sin(i * 0.18);
        const wave = base + 18*Math.sin(i*0.14-t*1.8) + 10*Math.sin(i*0.28-t*2.6) + 6*Math.sin(i*0.52-t*1.2) + 3*Math.sin(i*0.9-t*3.4);
        const minV = 20, maxV = 200;
        const y = H - 12 - ((Math.max(minV, Math.min(maxV, wave)) - minV) / (maxV - minV)) * (H - 28);
        points.push({ x, y });
      }
      const base = isUnderAttack ? '#ef4444' : '#00d2ff';
      const fill = ctx.createLinearGradient(0, 0, 0, H);
      fill.addColorStop(0, isUnderAttack ? 'rgba(239,68,68,0.22)' : 'rgba(0,210,255,0.20)');
      fill.addColorStop(0.6, isUnderAttack ? 'rgba(239,68,68,0.06)' : 'rgba(0,130,255,0.06)');
      fill.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.beginPath(); ctx.moveTo(points[0].x, H);
      points.forEach(p => ctx.lineTo(p.x, p.y));
      ctx.lineTo(points[points.length-1].x, H); ctx.closePath(); ctx.fillStyle = fill; ctx.fill();
      ctx.beginPath();
      points.forEach((p, i) => {
        if (i === 0) { ctx.moveTo(p.x, p.y); return; }
        const prev = points[i-1]; const cpx = (prev.x+p.x)/2;
        ctx.bezierCurveTo(cpx, prev.y, cpx, p.y, p.x, p.y);
      });
      ctx.strokeStyle = base; ctx.lineWidth = 2.2; ctx.shadowColor = base; ctx.shadowBlur = 12; ctx.stroke(); ctx.shadowBlur = 0;
      const last = points[points.length-1]; const pulse = 0.6 + 0.4*Math.sin(t*6);
      ctx.beginPath(); ctx.arc(last.x, last.y, 4*pulse, 0, Math.PI*2);
      ctx.fillStyle = base; ctx.shadowColor = base; ctx.shadowBlur = 18; ctx.fill(); ctx.shadowBlur = 0;
    }
    draw();
    return () => cancelAnimationFrame(rafRef.current);
  }, [isUnderAttack]);
  return (
    <div style={{ position:'relative', width:'100%', height }}>
      <canvas ref={canvasRef} width={800} height={height} style={{ width:'100%', height:'100%' }} />
      <div style={{ position:'absolute', top:6, right:8, display:'flex', alignItems:'center', gap:5, fontSize:10, color: scanning ? '#f59e0b' : '#00d2ff' }}>
        <span style={{ width:6, height:6, borderRadius:'50%', display:'inline-block', background: scanning ? '#f59e0b' : '#00d2ff', boxShadow:`0 0 6px ${scanning ? '#f59e0b' : '#00d2ff'}` }} />
        {scanning ? 'Scanning...' : 'Nmap Live'}
      </div>
      {scanData?.rogue_count > 0 && (
        <div style={{ position:'absolute', bottom:4, left:8, background:'rgba(239,68,68,0.15)', border:'1px solid rgba(239,68,68,0.5)', borderRadius:4, padding:'2px 8px', fontSize:10, color:'#ef4444', fontWeight:700 }}>
          ⚠ {scanData.rogue_count} ROGUE DEVICE{scanData.rogue_count > 1 ? 'S' : ''} DETECTED
        </div>
      )}
    </div>
  );
}

// ==========================================
// NMAP DONUT
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
      <div className="traffic-donut" style={{ background:`conic-gradient(${color} 0% ${pct}%, var(--card-border) ${pct}%)`, boxShadow:`0 0 18px ${color}55` }}>
        <div className="donut-inner">
          <span className="d-num text-white" style={{ fontSize:14, color }}>{scanning ? '⟳' : total}</span>
          <span className="d-text" style={{ color, fontSize:9, fontWeight:700 }}>{rogue > 0 ? 'ROGUE!' : 'Operational'}</span>
          {rogue > 0 && <span style={{ fontSize:8, color:'#ef4444', marginTop:2 }}>{rogue} rogue</span>}
        </div>
      </div>
    </div>
  );
}

// ==========================================
// ATTACK BANNER
// ==========================================
function AttackBanner({ statusData, onManualBlock, onReset, blocking }) {
  const ip = statusData?.current_threat_ip;
  const blocked = statusData?.attacker_blocked;
  const by = statusData?.blocked_by;
  if (!statusData?.is_under_attack) return null;
  return (
    <div style={{ position:'fixed', top:0, left:0, right:0, zIndex:1000, background: blocked ? 'rgba(16,185,129,0.97)' : 'rgba(220,20,20,0.97)', borderBottom:`2px solid ${blocked ? '#10b981' : '#ff0000'}`, padding:'10px 28px', display:'flex', alignItems:'center', justifyContent:'space-between', boxShadow:`0 0 40px ${blocked ? '#10b98188' : '#ff000088'}`, animation: blocked ? 'none' : 'flashBanner 1s infinite' }}>
      <div style={{ display:'flex', alignItems:'center', gap:12 }}>
        <span style={{ fontSize:22 }}>{blocked ? '🛡️' : '🚨'}</span>
        <div>
          <div style={{ color:'#fff', fontWeight:800, fontSize:14, letterSpacing:1 }}>
            {blocked ? `ATTACKER BLOCKED — ${ip} (by ${by === 'auto' ? 'ML Engine' : 'Officer'})` : `ACTIVE ATTACK DETECTED — ${ip}`}
          </div>
          <div style={{ color: blocked ? '#d1fae5' : '#fecaca', fontSize:11 }}>
            {blocked ? 'Firewall rule applied. Network securing...' : `Attack type: ${statusData?.active_threat} · Target: PLC-01`}
          </div>
        </div>
      </div>
      <div style={{ display:'flex', gap:10 }}>
        {!blocked && (
          <>
            <button onClick={onManualBlock} disabled={blocking} style={{ background: blocking ? '#374151' : '#fff', color: blocking ? '#9ca3af' : '#dc2626', border:'none', borderRadius:6, padding:'8px 20px', fontWeight:800, fontSize:13, cursor: blocking ? 'not-allowed' : 'pointer', boxShadow:'0 0 15px rgba(0,0,0,0.3)' }}>
              {blocking ? '⟳ Blocking...' : '🛑 BLOCK ATTACKER'}
            </button>
            <button onClick={onReset} style={{ background:'transparent', color:'#fecaca', border:'1px solid rgba(255,255,255,0.4)', borderRadius:6, padding:'8px 16px', fontWeight:700, fontSize:12, cursor:'pointer' }}>✕ Dismiss</button>
          </>
        )}
        {blocked && (
          <button onClick={onReset} style={{ background:'#065f46', color:'#d1fae5', border:'1px solid #10b981', borderRadius:6, padding:'8px 18px', fontWeight:700, fontSize:12, cursor:'pointer' }}>✓ Clear & Reset</button>
        )}
      </div>
    </div>
  );
}

// ==========================================
// SCADA TOPOLOGY
// ==========================================
const NODES = [
  { label:"HMI-D1", x:147, y:141, icon:"🖥", isTarget:false },
  { label:"PLC-01", x:472, y:140, icon:"⊞", isTarget:true },
  { label:"Robotic Arm", x:120, y:268, icon:"🦾", isTarget:false },
  { label:"Conveyor Sensor", x:168, y:338, icon:"⚙", isTarget:false },
  { label:"HMI-01", x:323, y:392, icon:"🖥", isTarget:false },
  { label:"PLC-04", x:532, y:322, icon:"⊞", isTarget:false },
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
      ctx.roundRect = function(x,y,w,h,r){ this.moveTo(x+r,y);this.lineTo(x+w-r,y);this.quadraticCurveTo(x+w,y,x+w,y+r);this.lineTo(x+w,y+h-r);this.quadraticCurveTo(x+w,y+h,x+w-r,y+h);this.lineTo(x+r,y+h);this.quadraticCurveTo(x,y+h,x,y+h-r);this.lineTo(x,y+r);this.quadraticCurveTo(x,y,x+r,y);this.closePath(); };
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
      const tgtNode=nodes.find(n=>n.isTarget); const tG=atk?tgtNode.glow:0;
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
// SOC INCIDENT RESPONSE TAB
// ==========================================
function IncidentResponseTab({ statusData, alerts, incidentData, isUnderAttack, onManualBlock, blocking }) {
  const [socNote, setSocNote]   = useState('');
  const [socLog, setSocLog]     = useState([
    { user:'System', time:'Auto', msg:'Sentinel IDS initialized. Monitoring all ICS zones.' },
  ]);
  const [incidentTimer, setTimer] = useState(0);
  const timerRef = useRef(null);

  // Start timer when attack begins
  useEffect(() => {
    if (isUnderAttack) {
      timerRef.current = setInterval(() => setTimer(t => t + 1), 1000);
    } else {
      clearInterval(timerRef.current);
      setTimer(0);
    }
    return () => clearInterval(timerRef.current);
  }, [isUnderAttack]);

  const formatTimer = (s) => {
    const h = String(Math.floor(s / 3600)).padStart(2,'0');
    const m = String(Math.floor((s % 3600) / 60)).padStart(2,'0');
    const sec = String(s % 60).padStart(2,'0');
    return `${h}:${m}:${sec}`;
  };

  const addNote = () => {
    if (!socNote.trim()) return;
    setSocLog(prev => [...prev, {
      user: 'Officer',
      time: new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'}),
      msg: socNote.trim(),
    }]);
    setSocNote('');
  };

  // Attack chain stages
  const chainStages = [
    { label:'Initial Access',        done: isUnderAttack, active: false },
    { label:'Lateral Movement',      done: isUnderAttack, active: false },
    { label:'Privilege Escalation',  done: false,         active: isUnderAttack },
    { label:'Data Exfiltration',     done: false,         active: false },
  ];

  // Affected assets — mix of static ICS + real alert data
  const affectedAssets = [
    { host:'PLC-01',         type:'PLC',                 status: isUnderAttack ? 'Compromised' : 'Online',  severity: isUnderAttack ? 'Critical' : 'Low',  time:'14:47:23' },
    { host:'HMI-D1',         type:'HMI',                 status: isUnderAttack ? 'At Risk'     : 'Online',  severity: isUnderAttack ? 'Critical' : 'Low',  time:'14:46:58' },
    { host:'SCADA-Server',   type:'SCADA Workstation',   status: isUnderAttack ? 'At Risk'     : 'Online',  severity: isUnderAttack ? 'High'     : 'Low',  time:'14:46:12' },
    { host:'RTU-01',         type:'Remote Terminal Unit', status:'Online',                                   severity:'Low',                                time:'14:45:03' },
    { host:'Engineering-WS', type:'Workstation',          status: isUnderAttack ? 'Contained'  : 'Online',  severity: isUnderAttack ? 'High'     : 'Low',  time:'14:44:31' },
    { host:'VPN-GW-01',      type:'VPN Gateway',          status: isUnderAttack ? 'At Risk'    : 'Online',  severity: isUnderAttack ? 'High'     : 'Low',  time:'14:43:18' },
  ];

  // Playbook actions
  const playbookActions = [
    { icon:'🛡️', title:'Contain affected hosts',      assignee:'J. Martinez', status: isUnderAttack ? 'In Progress' : 'Standby' },
    { icon:'🔑', title:'Disable compromised creds',   assignee:'A. Chen',     status: isUnderAttack ? 'In Progress' : 'Standby' },
    { icon:'🚫', title:'Block malicious IP range',    assignee:'System',      status: statusData?.attacker_blocked ? 'Done' : isUnderAttack ? 'Pending' : 'Standby' },
    { icon:'📢', title:'Notify CISO',                 assignee:'System',      status: isUnderAttack ? 'Pending'    : 'Standby' },
    { icon:'📸', title:'Trigger forensic snapshot',   assignee:'System',      status: isUnderAttack ? 'Pending'    : 'Standby' },
  ];

  const statusColor = (s) => {
    if (s === 'Compromised') return '#ef4444';
    if (s === 'At Risk')     return '#f59e0b';
    if (s === 'Contained')   return '#10b981';
    if (s === 'In Progress') return '#3b82f6';
    if (s === 'Done')        return '#10b981';
    if (s === 'Pending')     return '#f59e0b';
    return '#6b7280';
  };

  const severityColor = (s) => {
    if (s === 'Critical') return '#ef4444';
    if (s === 'High')     return '#f97316';
    if (s === 'Medium')   return '#f59e0b';
    return '#10b981';
  };

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:16 }}>

      {/* ── CRITICAL INCIDENT BANNER ── */}
      {isUnderAttack && (
        <div style={{
          background:'linear-gradient(135deg,rgba(239,68,68,0.15),rgba(220,38,38,0.08))',
          border:'1px solid rgba(239,68,68,0.5)',
          borderRadius:10, padding:'14px 20px',
          display:'flex', alignItems:'center', justifyContent:'space-between',
          animation:'flashBanner 2s infinite',
        }}>
          <div style={{ display:'flex', alignItems:'center', gap:14 }}>
            <span style={{ fontSize:24 }}>⚠️</span>
            <div>
              <div style={{ color:'#ef4444', fontWeight:800, fontSize:15, letterSpacing:1 }}>
                CRITICAL INCIDENT ACTIVE
              </div>
              <div style={{ color:'#9ca3af', fontSize:11, marginTop:2 }}>
                Incident ID: INC-2026-03-{String(Math.floor(Math.random()*900)+100).padStart(3,'0')} &nbsp;·&nbsp;
                Escalation: <span style={{color:'#f59e0b'}}>Level 3</span> &nbsp;·&nbsp;
                Affected Assets: <span style={{color:'#ef4444'}}>{affectedAssets.filter(a=>a.status!=='Online').length}</span>
              </div>
            </div>
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:20 }}>
            <div style={{ textAlign:'center' }}>
              <div style={{ color:'#9ca3af', fontSize:10 }}>Active For</div>
              <div style={{ color:'#ef4444', fontWeight:800, fontSize:18, fontFamily:'monospace' }}>
                {formatTimer(incidentTimer)}
              </div>
            </div>
            {!statusData?.attacker_blocked && (
              <button onClick={onManualBlock} disabled={blocking} style={{
                background:'#dc2626', color:'#fff', border:'none', borderRadius:8,
                padding:'10px 20px', fontWeight:800, fontSize:13, cursor: blocking ? 'not-allowed' : 'pointer',
              }}>
                {blocking ? '⟳ Blocking...' : '🛑 Execute Containment'}
              </button>
            )}
            {statusData?.attacker_blocked && (
              <div style={{ background:'rgba(16,185,129,0.15)', border:'1px solid #10b981', borderRadius:8, padding:'10px 16px', color:'#10b981', fontWeight:700, fontSize:13 }}>
                ✓ Contained
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── ATTACK CHAIN PROGRESS ── */}
      <div className="card" style={{ padding:20 }}>
        <div className="card-title" style={{ marginBottom:20 }}>Attack Chain Progress</div>
        <div style={{ display:'flex', alignItems:'center', gap:0 }}>
          {chainStages.map((stage, i) => (
            <React.Fragment key={i}>
              <div style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', gap:8 }}>
                {/* Circle */}
                <div style={{
                  width:44, height:44, borderRadius:'50%',
                  display:'flex', alignItems:'center', justifyContent:'center',
                  background: stage.done ? '#10b981' : stage.active ? 'rgba(239,68,68,0.2)' : 'rgba(30,41,59,0.8)',
                  border:`2px solid ${stage.done ? '#10b981' : stage.active ? '#ef4444' : '#374151'}`,
                  boxShadow: stage.active ? '0 0 20px rgba(239,68,68,0.5)' : stage.done ? '0 0 12px rgba(16,185,129,0.4)' : 'none',
                  position:'relative',
                  animation: stage.active ? 'flashBanner 1.5s infinite' : 'none',
                }}>
                  {stage.done
                    ? <span style={{ fontSize:18 }}>✓</span>
                    : stage.active
                      ? <span style={{ color:'#ef4444', fontWeight:800, fontSize:16 }}>{i+1}</span>
                      : <span style={{ color:'#6b7280', fontSize:16 }}>{i+1}</span>
                  }
                </div>
                <div style={{
                  fontSize:11, fontWeight:600, textAlign:'center',
                  color: stage.done ? '#10b981' : stage.active ? '#ef4444' : '#6b7280',
                }}>
                  {stage.label}
                </div>
              </div>
              {/* Connector line */}
              {i < chainStages.length - 1 && (
                <div style={{
                  height:2, width:40, flexShrink:0, marginBottom:20,
                  background: stage.done ? '#10b981' : '#374151',
                }}/>
              )}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* ── TWO COLUMN: affected assets + playbook ── */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 320px', gap:16 }}>

        {/* Affected Assets */}
        <div className="card" style={{ padding:20 }}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
            <div className="card-title">Affected Assets</div>
            <span style={{ fontSize:12, color:'#6b7280' }}>
              {affectedAssets.filter(a=>a.status!=='Online').length} assets impacted
            </span>
          </div>
          <table style={{ width:'100%', borderCollapse:'collapse' }}>
            <thead>
              <tr style={{ borderBottom:'1px solid rgba(0,210,255,0.1)' }}>
                {['Hostname','Type','Status','Severity','Last Activity'].map(h => (
                  <th key={h} style={{ textAlign:'left', padding:'6px 10px', fontSize:11, color:'#6b7280', fontWeight:600 }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {affectedAssets.map((asset, i) => (
                <tr key={i} style={{
                  borderBottom:'1px solid rgba(255,255,255,0.04)',
                  background: i % 2 === 0 ? 'rgba(255,255,255,0.01)' : 'transparent',
                }}>
                  <td style={{ padding:'8px 10px' }}>
                    <div style={{ display:'flex', alignItems:'center', gap:8 }}>
                      <span style={{
                        width:8, height:8, borderRadius:'50%', display:'inline-block',
                        background: statusColor(asset.status),
                        boxShadow:`0 0 6px ${statusColor(asset.status)}`,
                      }}/>
                      <span style={{ color:'#e2e8f0', fontWeight:600, fontSize:13 }}>{asset.host}</span>
                    </div>
                  </td>
                  <td style={{ padding:'8px 10px', color:'#6b7280', fontSize:12 }}>{asset.type}</td>
                  <td style={{ padding:'8px 10px' }}>
                    <span style={{
                      background:`${statusColor(asset.status)}22`,
                      color: statusColor(asset.status),
                      border:`1px solid ${statusColor(asset.status)}55`,
                      borderRadius:4, padding:'2px 8px', fontSize:11, fontWeight:600,
                    }}>
                      {asset.status}
                    </span>
                  </td>
                  <td style={{ padding:'8px 10px' }}>
                    <span style={{ color: severityColor(asset.severity), fontWeight:700, fontSize:12 }}>
                      {asset.severity}
                    </span>
                  </td>
                  <td style={{ padding:'8px 10px', color:'#6b7280', fontSize:11, fontFamily:'monospace' }}>{asset.time}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Response Playbook */}
        <div className="card" style={{ padding:20 }}>
          <div className="card-title" style={{ marginBottom:14 }}>Response Playbook</div>
          <div style={{ display:'flex', flexDirection:'column', gap:10 }}>
            {playbookActions.map((action, i) => (
              <div key={i} style={{
                padding:'10px 12px', borderRadius:8,
                background:'rgba(255,255,255,0.03)',
                border:`1px solid ${action.status === 'Done' ? 'rgba(16,185,129,0.3)' : action.status === 'In Progress' ? 'rgba(59,130,246,0.3)' : 'rgba(255,255,255,0.06)'}`,
                display:'flex', alignItems:'center', justifyContent:'space-between',
              }}>
                <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                  <span style={{ fontSize:16 }}>{action.icon}</span>
                  <div>
                    <div style={{ color:'#e2e8f0', fontSize:12, fontWeight:600 }}>{action.title}</div>
                    <div style={{ color:'#6b7280', fontSize:10 }}>Assigned: {action.assignee}</div>
                  </div>
                </div>
                <span style={{
                  fontSize:10, fontWeight:700, padding:'2px 8px', borderRadius:4,
                  background:`${statusColor(action.status)}22`,
                  color: statusColor(action.status),
                  border:`1px solid ${statusColor(action.status)}44`,
                }}>
                  {action.status}
                </span>
              </div>
            ))}
          </div>

          {/* Escalate button */}
          {isUnderAttack && (
            <button style={{
              marginTop:14, width:'100%',
              background:'rgba(139,92,246,0.15)', color:'#8b5cf6',
              border:'1px solid rgba(139,92,246,0.4)', borderRadius:8,
              padding:'9px', fontWeight:700, fontSize:12, cursor:'pointer',
            }}>
              ↑ Escalate to Tier 3
            </button>
          )}
        </div>
      </div>

      {/* ── SOC COMMUNICATION ── */}
      <div className="card" style={{ padding:20 }}>
        <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:14 }}>
          <div className="card-title">SOC Communication</div>
          <span style={{ fontSize:11, color:'#6b7280' }}>Internal analyst notes and system updates</span>
        </div>

        {/* Chat log */}
        <div style={{
          maxHeight:200, overflowY:'auto', display:'flex', flexDirection:'column', gap:10, marginBottom:14,
          padding:'10px', borderRadius:8, background:'rgba(0,0,0,0.2)',
        }}>
          {socLog.map((entry, i) => (
            <div key={i} style={{ display:'flex', gap:10, alignItems:'flex-start' }}>
              <div style={{
                width:28, height:28, borderRadius:'50%', flexShrink:0,
                background: entry.user === 'System' ? 'rgba(0,210,255,0.2)' : 'rgba(139,92,246,0.2)',
                border:`1px solid ${entry.user === 'System' ? '#00d2ff44' : '#8b5cf644'}`,
                display:'flex', alignItems:'center', justifyContent:'center', fontSize:12,
              }}>
                {entry.user === 'System' ? '⚙' : entry.user[0]}
              </div>
              <div>
                <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                  <span style={{ color: entry.user === 'System' ? '#00d2ff' : '#8b5cf6', fontWeight:700, fontSize:12 }}>{entry.user}</span>
                  <span style={{ color:'#6b7280', fontSize:10 }}>{entry.time}</span>
                </div>
                <div style={{ color:'#9ca3af', fontSize:12, marginTop:2 }}>{entry.msg}</div>
              </div>
            </div>
          ))}
          {/* Auto-add attack log entry */}
          {isUnderAttack && socLog.length === 1 && (
            <div style={{ display:'flex', gap:10, alignItems:'flex-start' }}>
              <div style={{ width:28, height:28, borderRadius:'50%', flexShrink:0, background:'rgba(239,68,68,0.2)', border:'1px solid #ef444444', display:'flex', alignItems:'center', justifyContent:'center', fontSize:12 }}>⚠</div>
              <div>
                <div style={{ display:'flex', gap:8, alignItems:'center' }}>
                  <span style={{ color:'#ef4444', fontWeight:700, fontSize:12 }}>System</span>
                  <span style={{ color:'#6b7280', fontSize:10 }}>{new Date().toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span>
                </div>
                <div style={{ color:'#9ca3af', fontSize:12, marginTop:2 }}>
                  ALERT: {statusData?.active_threat} detected from {statusData?.current_threat_ip}. Automated containment initiated.
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Input */}
        <div style={{ display:'flex', gap:10 }}>
          <input
            value={socNote}
            onChange={e => setSocNote(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && addNote()}
            placeholder="Add analyst note..."
            style={{
              flex:1, background:'rgba(255,255,255,0.05)', border:'1px solid rgba(255,255,255,0.1)',
              borderRadius:8, padding:'8px 14px', color:'#e2e8f0', fontSize:13, outline:'none',
            }}
          />
          <button onClick={addNote} style={{
            background:'rgba(0,210,255,0.15)', color:'#00d2ff',
            border:'1px solid rgba(0,210,255,0.3)', borderRadius:8,
            padding:'8px 18px', fontWeight:700, fontSize:13, cursor:'pointer',
          }}>
            Add Note
          </button>
        </div>
      </div>

      {/* ── NETWORK CHANNEL INFO ── */}
      {isUnderAttack && (
        <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:16 }}>
          <div className="card bg-grad-cyan" style={{ padding:20 }}>
            <div className="card-title">Attack Probability</div>
            <div style={{ fontSize:36, fontWeight:800, color:'#ef4444', margin:'12px 0' }}>98.5%</div>
            <p className="text-dim">Chances of successful exploitation based on current traffic analysis.</p>
          </div>
          <div className="card bg-grad-cyan" style={{ padding:20 }}>
            <div className="card-title">Network Channel Info</div>
            <div style={{ marginTop:12, display:'flex', flexDirection:'column', gap:8 }}>
              {[
                ['Protocol',      incidentData?.protocol      || 'Modbus TCP'],
                ['Transport',     incidentData?.transport     || 'TCP'],
                ['Port',          incidentData?.port          || '502'],
                ['Function Code', incidentData?.function_code || '0x05'],
              ].map(([label, value]) => (
                <div key={label} style={{ display:'flex', justifyContent:'space-between' }}>
                  <span style={{ color:'#6b7280', fontSize:12 }}>{label}</span>
                  <span style={{ color:'#00d2ff', fontWeight:700, fontSize:12 }}>{value}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ==========================================
// MAIN APP
// ==========================================
function App() {
  const [statusData, setStatusData]       = useState(null);
  const [alerts, setAlerts]               = useState([]);
  const [devices, setDevices]             = useState([]);
  const [incidentData, setIncidentData]   = useState(null);
  const [isUnderAttack, setIsUnderAttack] = useState(false);
  const [activeTab, setActiveTab]         = useState('dashboard');
  const [blocking, setBlocking]           = useState(false);
  const [blockMsg, setBlockMsg]           = useState('');

  const { scanData, scanning, lastScan, trafficHistory, runScan } = useNmapScan();

  const fetchData = useCallback(async () => {
    const s = await apiClient.getStatus();
    if (s) { setStatusData(s); setIsUnderAttack(s.is_under_attack); }
    const a = await apiClient.getAlerts();         if (a) setAlerts(a);
    const d = await apiClient.getDevices();        if (d) setDevices(d);
    const i = await apiClient.getIncidentDetails();if (i) setIncidentData(i);
  }, []);

  useEffect(() => {
    fetchData();
    const id = setInterval(fetchData, 3000);
    apiClient.connectWebSocket((newAlert) => {
      setAlerts(prev => [newAlert, ...prev]);
      if (newAlert.severity === 'CRITICAL') { setIsUnderAttack(true); fetchData(); }
    });
    return () => clearInterval(id);
  }, [fetchData]);

  const handleManualBlock = async () => {
    setBlocking(true); setBlockMsg('');
    try {
      const res  = await fetch(`${BACKEND_URL}/api/v1/block-attacker`, {
        method:'POST', headers:{'Content-Type':'application/json'},
        body: JSON.stringify({ reason:'Manual block by security officer' }),
      });
      const data = await res.json();
      if (data.status === 'blocked' || data.status === 'already_blocked') {
        setStatusData(prev => ({ ...prev, attacker_blocked:true, blocked_by:'manual' }));
        setBlockMsg(`✓ Blocked ${data.ip} — Firewall: ${data.firewall}`);
        setTimeout(fetchData, 500);
      } else {
        setBlockMsg(data.message || data.status);
      }
    } catch (e) { setBlockMsg(`Error: ${e.message}`); }
    finally { setBlocking(false); }
  };

  const handleReset = async () => {
    await fetch(`${BACKEND_URL}/api/v1/reset`, { method:'POST' });
    setBlockMsg(''); setIsUnderAttack(false);
    setStatusData(prev => ({ ...prev, is_under_attack:false, attacker_blocked:false, blocked_by:null, current_threat_ip:null, critical_alerts:0, active_threat:'None', ml_confidence:12.0 }));
    setAlerts([]); setTimeout(fetchData, 300);
  };

  const handleMLControl = async (action) => {
    await fetch(`${BACKEND_URL}/api/v1/ml-control`, { method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ action }) });
    setTimeout(fetchData, 300);
  };

  if (!statusData) return <div className="loading-screen">INITIALIZING SECURE BLUE PROTOCOL...</div>;

  const calmEq   = [1,2,3,2,4,3,2,1,2,3,4,3,2,1,2,3,2,1,1,1];
  const attackEq = [2,2,3,4,6,8,12,18,28,35,35,30,22,14,10,10,10,8,6,4];
  const activeEq = isUnderAttack ? attackEq : calmEq;
  const blockedIPs = statusData?.attacker_blocked && statusData?.current_threat_ip
    ? { [statusData.current_threat_ip]: true }
    : {};

  return (
    <div className="app-wrapper">
      <AttackBanner statusData={statusData} onManualBlock={handleManualBlock} onReset={handleReset} blocking={blocking} />
      {isUnderAttack && <div style={{ height: 56 }} />}

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
              {key === 'incident_response' && isUnderAttack && (
                <span style={{ marginLeft:6, background:'#ef4444', color:'#fff', borderRadius:10, padding:'1px 6px', fontSize:9, fontWeight:800 }}>LIVE</span>
              )}
            </li>
          ))}
        </ul>
        <div className="sidebar-footer">
          <div style={{fontSize:10,color:'#6b7280',marginBottom:6,textAlign:'center'}}>
            {scanning ? <span style={{color:'#f59e0b'}}>⟳ Nmap scanning...</span> : lastScan ? <span style={{color:'#10b981'}}>✓ Nmap: {scanData?.total_found??0} hosts</span> : <span>Nmap: waiting</span>}
          </div>
          {isUnderAttack && !statusData?.attacker_blocked && (
            <button onClick={handleManualBlock} disabled={blocking} style={{ width:'100%', marginBottom:8, background:'#dc2626', color:'#fff', border:'none', borderRadius:6, padding:'8px', fontWeight:800, fontSize:12, cursor:'pointer', animation:'flashBanner 1s infinite' }}>
              {blocking ? '⟳ Blocking...' : '🛑 KILL SWITCH'}
            </button>
          )}
          <div className={`status-badge ${isUnderAttack?'border-flash text-red':'border-cyan text-cyan'}`}>
            <span className={`dot ${isUnderAttack?'bg-red':'pulse-cyan'}`}></span>
            {statusData?.attacker_blocked ? 'CONTAINED' : isUnderAttack ? 'COMPROMISED' : 'SECURE'}
          </div>
        </div>
      </aside>

      <main className="main-content">
        <header className="top-header">
          <h2>{activeTab.replace('_',' ').toUpperCase()}</h2>
          <div className="header-right">
            <span>Factory: TN Automotive Cluster</span>
            <span className="live-mon">⏱ Live Monitoring</span>
            <span className="user-icon">👤</span>
          </div>
        </header>

        {blockMsg && (
          <div style={{ margin:'0 0 12px', padding:'8px 16px', borderRadius:6, background: blockMsg.startsWith('✓') ? 'rgba(16,185,129,0.15)' : 'rgba(239,68,68,0.15)', border:`1px solid ${blockMsg.startsWith('✓') ? '#10b981' : '#ef4444'}44`, color: blockMsg.startsWith('✓') ? '#10b981' : '#ef4444', fontSize:13 }}>
            {blockMsg}
          </div>
        )}

        {/* DASHBOARD */}
        {activeTab === 'dashboard' && (
          <div className="master-grid">
            <div className="card kpi-card bg-grad-cyan pos-kpi1">
              <div className="kpi-top"><span className="kpi-icon text-cyan">🤖</span><span className="kpi-title">Machines Online</span></div>
              <div className="kpi-value text-white">{scanData?.total_found ?? statusData.devices_online}</div>
              <div style={{fontSize:10,color:'#6b7280',marginTop:4}}>{scanData ? `${scanData.hosts?.filter(h=>h.status==='TRUSTED').length??0} trusted · ${scanData.rogue_count??0} rogue` : 'Loading scan...'}</div>
            </div>
            <div className={`card kpi-card ${isUnderAttack?'bg-grad-red border-flash':'bg-grad-cyan'} pos-kpi2`}>
              <div className="kpi-top"><span className={`kpi-icon ${isUnderAttack?'alert-bg text-red':'text-cyan'}`}>{isUnderAttack?'🚨':'✅'}</span><span className="kpi-title">Network Status</span></div>
              <div className={`kpi-value ${isUnderAttack?'text-red':'text-cyan'}`}>{statusData?.attacker_blocked ? 'CONTAINED' : isUnderAttack ? 'DANGER' : 'SAFE'}</div>
            </div>
            <div className={`card kpi-card ${isUnderAttack?'bg-grad-red border-flash':'bg-grad-cyan'} pos-kpi3`}>
              <div className="kpi-top"><span className={`kpi-icon ${isUnderAttack?'alert-bg text-red':'text-cyan'}`}>⚠️</span><span className="kpi-title">Active Alerts</span></div>
              <div className={`kpi-value ${isUnderAttack?'text-red':'text-cyan'}`}>{statusData.critical_alerts}</div>
            </div>
            <div className="card traffic-card pos-traffic">
              <div className="card-title" style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                <span>Network Traffic <span className="subtitle">(Live Feed)</span></span>
                <span style={{fontSize:10,color:'#6b7280'}}>Nmap · 192.168.1.0/24 · 30s</span>
              </div>
              <div className="traffic-content">
                <div className="traffic-chart-wrapper">
                  <div className="y-axis"><span>500</span><span>400</span><span>300</span><span>200</span><span>100</span><span>000</span></div>
                  <div className="traffic-graph-area overflow-hidden" style={{position:'relative'}}>
                    <div className="bg-grid-lines"><div className="h-line"/><div className="h-line"/><div className="h-line"/><div className="h-line"/><div className="h-line"/></div>
                    <NmapTrafficGraph trafficHistory={trafficHistory} scanData={scanData} scanning={scanning} isUnderAttack={isUnderAttack} height={120} />
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
            <div className="card pos-topo" style={{ padding:0, overflow:'hidden' }}>
              <ThreatMap alerts={alerts} blockedIPs={blockedIPs} />
            </div>
            <div className="card right-card pos-ai">
              <div className="panel-header"><div className="card-title"><span className="kpi-icon text-cyan">🤖</span> AI Threat Detection</div><span className="dots-menu">•••</span></div>
              <div className="panel-body">
                <div className="ai-row"><span className="ai-label">Model Status:</span><span className="ai-val text-white">{statusData.baseline_status}</span></div>
                <div className="ai-row"><span className="ai-label">Predicted Threat:</span><span className="ai-val text-white">{statusData.active_threat}</span></div>
                <div className="confidence-area">
                  <div className="conf-text"><span>Confidence: <span className="text-white">{statusData.ml_confidence}%</span></span></div>
                  <div className="progress-bg"><div className={`progress-fill ${isUnderAttack?'grad-red-bar':'bg-cyan'}`} style={{width:`${statusData.ml_confidence}%`}}><span className="prog-label">HIGH</span></div></div>
                </div>
                <div className={`risk-level ${isUnderAttack?'text-red':'text-cyan'}`}>
                  <span className="risk-bars">|||</span> Risk Level:
                  <span className="risk-badge" style={{color:isUnderAttack?'#ef4444':'#00d2ff',borderColor:isUnderAttack?'#ef4444':'#00d2ff',background:'transparent'}}>{isUnderAttack?'HIGH':'LOW'}</span>
                </div>
                {isUnderAttack && !statusData?.attacker_blocked && (
                  <button onClick={handleManualBlock} disabled={blocking} style={{ marginTop:12, width:'100%', background:'#dc2626', color:'#fff', border:'none', borderRadius:6, padding:'7px', fontWeight:800, fontSize:12, cursor:blocking?'not-allowed':'pointer' }}>
                    {blocking ? '⟳ Blocking...' : `🛑 Block ${statusData?.current_threat_ip}`}
                  </button>
                )}
              </div>
            </div>
            <div className="card right-card pos-alerts-mid">
              <div className="panel-header"><div className="card-title"><span className="icon-plus">⊞</span> Active Alerts</div><button className="view-btn">View All {'>'}</button></div>
              <div className="panel-body flex-row-center">
                <div className="eq-info">
                  <div className="eq-dev-line"><span className="eq-label">System State:</span><span className="eq-val text-white">{statusData?.attacker_blocked?'Contained':isUnderAttack?'Compromised':'Monitoring'}</span></div>
                  <div className="eq-desc">{isUnderAttack?<span className="text-red">Unauthorized<br/>Command Injection</span>:<>Baseline Traffic<br/>Normal</>}</div>
                </div>
                <div className="eq-visual-area">
                  <div className="eq-bars-container">
                    {activeEq.map((h,i)=>{ let cc='bg-eq-cyan',gc=''; if(isUnderAttack){if(i>=8&&i<=10){cc='bg-eq-red';gc='glow-red';}else if(i>10)cc='bg-eq-darkred';else if(i===7)cc='bg-eq-orange';} return <div key={i} className={`eq-bar ${cc} ${gc}`} style={{height:`${h}px`}}/>; })}
                  </div>
                  <div className="eq-axis"><span>10 AM</span><span>11 AM</span><span>12 AM</span><span>12 AM</span><span>2 PM</span><span>4 PM</span><span>5 PM</span><span>6 AM</span></div>
                </div>
              </div>
            </div>
            <div className="card right-card pos-timeline">
              <div className="panel-header"><div className="card-title">Attack Timeline <span className="subtitle">(Last 24 Hours)</span></div><button className="view-btn">View All {'>'}</button></div>
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

        {/* DISCOVERY */}
        {activeTab === 'discovery' && (
          <div className="tab-grid discovery-grid">
            <div className="card topo-card span-full" style={{padding:0,height:'60vh'}}><ScadaTopology isUnderAttack={isUnderAttack} /></div>
            <div className="card bg-grad-cyan"><div className="card-title">Discovered Protocols</div><p className="text-dim mt-2">Modbus TCP: 4 Devices<br/>DNP3: 1 Device<br/>Profinet: 1 Device</p></div>
            <div className="card bg-grad-cyan">
              <div className="card-title">Shadow IT Scanner <span style={{fontSize:10,color:'#6b7280'}}>via Nmap</span></div>
              {scanData?.rogue_count > 0 ? (
                <div className="mt-2">{scanData.hosts.filter(h=>h.status==='ROGUE').map((h,i)=>(<div key={i} style={{color:'#ef4444',fontWeight:700,fontSize:13,padding:'4px 0',borderBottom:'1px solid rgba(239,68,68,0.2)'}}>☠ {h.ip}{h.open_ports && <span style={{fontSize:10,color:'#f97316',marginLeft:8}}>Ports: {Object.keys(h.open_ports).join(', ')}</span>}</div>))}</div>
              ) : (<p className="text-dim mt-2" style={{color:'#10b981'}}>✓ No unauthorized devices detected</p>)}
            </div>
          </div>
        )}

        {/* ALERT FEED */}
        {activeTab === 'alert_feed' && (
          <div style={{display:'flex',flexDirection:'column',gap:16}}>
            <div className="card" style={{padding:16}}>
              <div className="card-title" style={{marginBottom:12}}>🌐 Global Attack Origin Map <span style={{marginLeft:10,color:'#6b7280',fontSize:11,fontWeight:'normal'}}>— drag to rotate — live attacker IPs plotted</span></div>
              <AttackGlobe alerts={alerts} isUnderAttack={isUnderAttack} />
            </div>
            <div className="card traffic-card">
              <div className="card-title" style={{display:'flex',justifyContent:'space-between'}}>
                <span>Network Traffic Graph</span>
                <span style={{fontSize:11,color:'#6b7280',display:'flex',gap:12}}>
                  {scanData&&<><span style={{color:'#10b981'}}>✓ {scanData.hosts?.filter(h=>h.status==='TRUSTED').length} trusted</span>{scanData.rogue_count>0&&<span style={{color:'#ef4444'}}>⚠ {scanData.rogue_count} rogue</span>}<span>Total: {scanData.total_found}</span></>}
                  <span style={{color:scanning?'#f59e0b':'#00d2ff'}}>{scanning?'⟳ Scanning...':'● Nmap Live'}</span>
                </span>
              </div>
              <div style={{height:180,marginTop:8}}><NmapTrafficGraph trafficHistory={trafficHistory} scanData={scanData} scanning={scanning} isUnderAttack={isUnderAttack} height={180} /></div>
            </div>
            <div className="card alerts-mid-card">
              <div className="card-title" style={{marginBottom:12}}>⚡ Live Alert Feed — {alerts.length} alerts — ML detected — MITRE mapped</div>
              {alerts.length === 0 ? (
                <div style={{textAlign:'center',color:'#00d2ff',padding:40}}>No alerts yet — ML engine analyzing traffic...</div>
              ) : alerts.map((a,i)=>(
                <div key={i} style={{ padding:'10px 14px', marginBottom:8, borderRadius:6, background:'rgba(0,210,255,0.05)', borderLeft:`3px solid ${a.severity==='CRITICAL'?'#ef4444':a.severity==='HIGH'?'#f97316':'#00d2ff'}` }}>
                  <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                    <span style={{color:'#fff',fontWeight:700,fontSize:13}}>{a.title}</span>
                    <div style={{display:'flex',gap:8,alignItems:'center'}}>
                      <span style={{background:'rgba(139,92,246,0.15)',color:'#8b5cf6',fontSize:10,padding:'1px 7px',borderRadius:4}}>{a.mitre_tag}</span>
                      <span className={`solid-pill ${a.severity.toLowerCase()}`}>{a.severity}</span>
                    </div>
                  </div>
                  <div style={{color:'#6b7280',fontSize:11,marginTop:4}}>{a.source_ip} → {a.destination_ip} · {new Date(a.timestamp).toLocaleTimeString()}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* DEVICE REGISTRY */}
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

        {/* INCIDENT RESPONSE — NEW SOC DASHBOARD */}
        {activeTab === 'incident_response' && (
          <IncidentResponseTab
            statusData={statusData}
            alerts={alerts}
            incidentData={incidentData}
            isUnderAttack={isUnderAttack}
            onManualBlock={handleManualBlock}
            blocking={blocking}
          />
        )}

        {/* ML ENGINE */}
{activeTab === 'ml_engine' && (
  <MLEngineTab
    statusData={statusData}
    alerts={alerts}
    isUnderAttack={isUnderAttack}
    onManualBlock={handleManualBlock}
    onMLControl={handleMLControl}
    blocking={blocking}
  />
)}
      </main>

      <style>{`
        @keyframes flashBanner { 0%, 100% { opacity: 1; } 50% { opacity: 0.85; } }
      `}</style>
    </div>
  );
}

export default App;
