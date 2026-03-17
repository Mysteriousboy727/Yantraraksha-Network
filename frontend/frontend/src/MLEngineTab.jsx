// ==========================================
// ML ENGINE TAB — Drop-in replacement for the ml_engine section in App.jsx
// Usage: import MLEngineTab from './MLEngineTab';
// Then replace the {activeTab === 'ml_engine' && (...)} block with:
// {activeTab === 'ml_engine' && (
//   <MLEngineTab
//     statusData={statusData}
//     alerts={alerts}
//     isUnderAttack={isUnderAttack}
//     onManualBlock={handleManualBlock}
//     onMLControl={handleMLControl}
//     blocking={blocking}
//     blockedIPs={blockedIPs}         // optional: from /api/v1/blocked-ips
//   />
// )}
// ==========================================

import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  Chart as ChartJS,
  CategoryScale, LinearScale, PointElement, LineElement,
  RadialLinearScale, ArcElement, Filler, Tooltip, Legend,
} from 'chart.js';
import { Line, Radar, Doughnut } from 'react-chartjs-2';

ChartJS.register(
  CategoryScale, LinearScale, PointElement, LineElement,
  RadialLinearScale, ArcElement, Filler, Tooltip, Legend
);

// ── Colour helpers ──────────────────────────────────────────────────
const HEAT_PALETTE = (v) => {
  if (v <= 1) return '#0d1526';
  if (v <= 3) return '#112244';
  if (v <= 5) return '#1a3a6e';
  if (v <= 7) return '#d97706';
  if (v <= 8) return '#ea580c';
  return '#dc2626';
};

// ── Static demo data ────────────────────────────────────────────────
const HEATMAP_DATA = [
  [1,2,1,3,4,3,2,4,5,6,7,8,9,7,8,6,5,4,3,3,4,4,2,1],
  [1,1,2,2,3,4,3,5,6,7,8,7,8,6,7,5,4,3,2,3,4,3,2,1],
  [2,1,1,2,2,3,4,5,7,8,9,8,7,6,5,4,3,4,5,6,7,5,3,1],
  [1,2,3,4,5,6,5,6,7,8,7,8,9,8,7,6,5,4,3,4,5,4,2,1],
  [1,1,2,3,4,5,6,7,8,9,8,7,6,7,8,7,6,5,4,3,4,3,2,1],
  [1,1,1,2,2,2,3,4,4,5,4,3,4,5,4,3,2,3,4,5,4,3,2,1],
  [1,1,1,1,2,2,2,2,3,3,4,3,4,3,4,3,2,2,3,3,2,2,1,1],
];
const DAYS = ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];

const TREND_LABELS = ['15','16','17','18','19','20','21','22','23','24','25','26'].map(d => `${d} Oct`);
const TREND_CRIT   = [8,10,9,12,14,11,13,15,17,16,18,20];
const TREND_HIGH   = [12,14,13,15,17,14,16,18,20,19,17,22];
const TREND_LOW    = [18,16,19,17,15,18,16,14,18,16,17,15];

const RADAR_LABELS = ['Discovery','Initial Access','Exec','Privilege Esc.','Persistence','Defense Evasion','Lateral Mvmt','Exfiltration'];
const RADAR_DATA   = [85,70,60,75,55,80,65,45];

const THREAT_ITEMS = [
  { name:'Malware',      count:47, color:'#ef4444' },
  { name:'Phishing',     count:89, color:'#f59e0b' },
  { name:'DDoS',         count:23, color:'#3b82f6' },
  { name:'Ransomware',   count:34, color:'#14b8a6' },
  { name:'SQL Injection',count:18, color:'#8b5cf6' },
];

// ── Toggle component ────────────────────────────────────────────────
function Toggle({ checked, onChange }) {
  return (
    <label style={{ position:'relative', display:'inline-block', width:40, height:22, cursor:'pointer', flexShrink:0 }}>
      <input type="checkbox" checked={checked} onChange={e => onChange(e.target.checked)}
        style={{ opacity:0, width:0, height:0 }} />
      <span style={{
        position:'absolute', inset:0, borderRadius:11,
        background: checked ? 'rgba(0,210,255,0.25)' : '#1f2937',
        border: checked ? '1px solid #00d2ff' : '1px solid #374151',
        transition:'all 0.25s',
      }}>
        <span style={{
          position:'absolute', top:3, left: checked ? 19 : 3,
          width:14, height:14, borderRadius:'50%',
          background: checked ? '#00d2ff' : '#6b7280',
          transition:'left 0.25s, background 0.25s',
          boxShadow: checked ? '0 0 6px #00d2ff' : 'none',
        }} />
      </span>
    </label>
  );
}

// ── Heatmap ─────────────────────────────────────────────────────────
function WeeklyHeatmap() {
  return (
    <div style={{ overflowX:'auto' }}>
      <div style={{ minWidth:520 }}>
        {/* Hour labels */}
        <div style={{ display:'flex', marginLeft:32, marginBottom:4 }}>
          {[0,3,6,9,12,15,18,21].map(h => (
            <div key={h} style={{ flex:'none', width: `${(3/24)*100}%`, fontSize:9, color:'#4b5563', textAlign:'left' }}>{h}h</div>
          ))}
        </div>
        {DAYS.map((day, di) => (
          <div key={day} style={{ display:'flex', alignItems:'center', marginBottom:3 }}>
            <div style={{ width:28, fontSize:9, color:'#6b7280', flexShrink:0 }}>{day}</div>
            <div style={{ display:'flex', gap:2, flex:1 }}>
              {HEATMAP_DATA[di].map((v, hi) => (
                <div key={hi} style={{
                  flex:1, height:13, borderRadius:2,
                  background: HEAT_PALETTE(v),
                  transition:'background 0.2s',
                }} title={`${day} ${hi}:00 — intensity ${v}`} />
              ))}
            </div>
          </div>
        ))}
        {/* Color legend */}
        <div style={{ display:'flex', alignItems:'center', gap:6, marginTop:8, marginLeft:32 }}>
          <span style={{ fontSize:9, color:'#4b5563' }}>Low</span>
          {[1,3,5,7,8,10].map(v => (
            <div key={v} style={{ width:12, height:12, borderRadius:2, background:HEAT_PALETTE(v) }} />
          ))}
          <span style={{ fontSize:9, color:'#4b5563' }}>High</span>
        </div>
      </div>
    </div>
  );
}

// ── Block Log ───────────────────────────────────────────────────────
function StatusPill({ type }) {
  const map = {
    auto:    { bg:'rgba(0,210,255,0.12)',    color:'#00d2ff',  border:'rgba(0,210,255,0.3)',    label:'Auto'     },
    manual:  { bg:'rgba(139,92,246,0.12)',   color:'#8b5cf6',  border:'rgba(139,92,246,0.3)',   label:'Manual'   },
    blocked: { bg:'rgba(16,185,129,0.12)',   color:'#10b981',  border:'rgba(16,185,129,0.3)',   label:'Blocked'  },
    expired: { bg:'rgba(107,114,128,0.12)',  color:'#6b7280',  border:'rgba(107,114,128,0.25)', label:'Expired'  },
    critical:{ bg:'rgba(239,68,68,0.12)',    color:'#ef4444',  border:'rgba(239,68,68,0.3)',    label:'Critical' },
    high:    { bg:'rgba(245,158,11,0.12)',   color:'#f59e0b',  border:'rgba(245,158,11,0.3)',   label:'High'     },
  };
  const s = map[type] || map.expired;
  return (
    <span style={{
      display:'inline-flex', alignItems:'center', padding:'2px 8px', borderRadius:4,
      fontSize:10, fontWeight:700, background:s.bg, color:s.color, border:`1px solid ${s.border}`,
    }}>{s.label}</span>
  );
}

const DEMO_IPS   = ['203.0.113.42','198.51.100.77','172.16.8.99','185.220.101.5','91.108.4.22'];
const DEMO_TYPES = ['Modbus Write Injection','ARP Spoofing','Profinet Flood','SCADA Replay','DNP3 Replay'];

// ── Main component ───────────────────────────────────────────────────
export default function MLEngineTab({
  statusData,
  alerts = [],
  isUnderAttack,
  onManualBlock,
  onMLControl,
  blocking,
  blockedIPs = {},
}) {
  // ── Local state ──────────────────────────────────────────────────
  const [trendPeriod, setTrendPeriod]   = useState('2W');
  const [autoRespond, setAutoRespond]   = useState(statusData?.auto_respond ?? false);
  const [notifOn, setNotifOn]           = useState(true);
  const [logRows, setLogRows]           = useState([
    { ip:'45.33.32.156',  type:'Modbus Write Injection', method:'auto',   severity:'critical', status:'blocked',  ts:'14:47:23' },
    { ip:'192.168.4.77',  type:'Port Scan',              method:'manual',  severity:'high',     status:'blocked',  ts:'14:31:05' },
    { ip:'10.0.5.204',    type:'DNP3 Replay',            method:'auto',   severity:'critical', status:'expired',  ts:'13:58:41' },
  ]);
  const [demoIdx, setDemoIdx]           = useState(0);

  // Keep autoRespond in sync with real statusData
  useEffect(() => {
    if (statusData?.auto_respond !== undefined) setAutoRespond(statusData.auto_respond);
  }, [statusData?.auto_respond]);

  // When a real block happens, inject into log
  useEffect(() => {
    if (statusData?.attacker_blocked && statusData?.current_threat_ip) {
      const ip = statusData.current_threat_ip;
      const method = statusData.blocked_by === 'auto' ? 'auto' : 'manual';
      setLogRows(prev => {
        if (prev.some(r => r.ip === ip)) return prev;
        const now = new Date().toLocaleTimeString([], { hour:'2-digit', minute:'2-digit', second:'2-digit' });
        return [{ ip, type: statusData.active_threat || 'Attack', method, severity:'critical', status:'blocked', ts:now }, ...prev];
      });
    }
  }, [statusData?.attacker_blocked, statusData?.current_threat_ip]);

  const handleAutoToggle = (val) => {
    setAutoRespond(val);
    onMLControl(val ? 'auto_on' : 'auto_off');
  };

  const handleSimulateBlock = () => {
    const ip   = DEMO_IPS[demoIdx % DEMO_IPS.length];
    const type = DEMO_TYPES[demoIdx % DEMO_TYPES.length];
    const now  = new Date().toLocaleTimeString([], { hour:'2-digit', minute:'2-digit', second:'2-digit' });
    setDemoIdx(i => i + 1);
    setLogRows(prev => [{ ip, type, method:'manual', severity:'high', status:'blocked', ts:now }, ...prev]);
  };

  const mlActive     = statusData?.ml_engine_active ?? true;
  const confidence   = statusData?.ml_confidence ?? 12;
  const confColor    = confidence > 80 ? '#ef4444' : confidence > 50 ? '#f59e0b' : '#00d2ff';
  const totalAlerts  = statusData?.critical_alerts ?? alerts.length;

  // ── Chart configs ────────────────────────────────────────────────
  const trendData = {
    labels: TREND_LABELS,
    datasets: [
      { label:'Critical', data:TREND_CRIT, borderColor:'#ef4444', backgroundColor:'rgba(239,68,68,0.08)', tension:0.4, borderWidth:2, pointRadius:0, fill:false },
      { label:'High',     data:TREND_HIGH, borderColor:'#f59e0b', backgroundColor:'rgba(245,158,11,0.08)', tension:0.4, borderWidth:2, pointRadius:0, fill:false },
      { label:'Low',      data:TREND_LOW,  borderColor:'#eab308', backgroundColor:'rgba(234,179,8,0.08)',  tension:0.4, borderWidth:2, pointRadius:0, fill:false },
    ],
  };
  const trendOptions = {
    responsive:true, maintainAspectRatio:false,
    plugins:{ legend:{ display:false }, tooltip:{ backgroundColor:'#0d1526', borderColor:'rgba(255,255,255,0.1)', borderWidth:1, titleColor:'#9ca3af', bodyColor:'#e2e8f0' } },
    scales:{
      x:{ grid:{ color:'rgba(255,255,255,0.04)' }, ticks:{ color:'#4b5563', font:{ size:9 }, maxRotation:0, maxTicksLimit:8 } },
      y:{ grid:{ color:'rgba(255,255,255,0.04)' }, ticks:{ color:'#4b5563', font:{ size:9 } }, min:0, max:30 },
    },
  };

  const radarData = {
    labels: RADAR_LABELS,
    datasets:[{
      label:'Coverage', data:RADAR_DATA,
      borderColor:'#c026d3', backgroundColor:'rgba(192,38,211,0.12)',
      borderWidth:2, pointBackgroundColor:'#c026d3', pointRadius:3,
    }],
  };
  const radarOptions = {
    responsive:true, maintainAspectRatio:false,
    plugins:{ legend:{ display:false } },
    scales:{ r:{
      grid:{ color:'rgba(255,255,255,0.07)' },
      angleLines:{ color:'rgba(255,255,255,0.07)' },
      ticks:{ display:false },
      pointLabels:{ color:'#6b7280', font:{ size:9 } },
      min:0, max:100,
    }},
  };

  const donutData = {
    labels:['Critical','High','Medium','Low'],
    datasets:[{ data:[12,28,38,22], backgroundColor:['#ef4444','#f97316','#eab308','#14b8a6'], borderWidth:0, hoverOffset:4 }],
  };
  const donutOptions = {
    responsive:true, maintainAspectRatio:false, cutout:'72%',
    plugins:{ legend:{ display:false }, tooltip:{ backgroundColor:'#0d1526', borderColor:'rgba(255,255,255,0.1)', borderWidth:1, bodyColor:'#e2e8f0' } },
  };

  // ── Styles ───────────────────────────────────────────────────────
  const card = {
    background:'#0d1526', border:'1px solid rgba(255,255,255,0.07)',
    borderRadius:12, padding:'18px 20px',
  };
  const cardTitle = { fontSize:13, fontWeight:700, color:'#e2e8f0', marginBottom:4 };
  const cardSub   = { fontSize:11, color:'#4b5563', marginBottom:14 };

  const controlRow = (highlight) => ({
    display:'flex', justifyContent:'space-between', alignItems:'center',
    padding:'10px 14px', borderRadius:8, marginBottom:8,
    background: highlight ? 'rgba(16,185,129,0.06)' : 'rgba(255,255,255,0.02)',
    border:`1px solid ${highlight ? 'rgba(16,185,129,0.25)' : 'rgba(255,255,255,0.06)'}`,
  });

  const tabBtn = (active) => ({
    fontSize:11, padding:'4px 10px', borderRadius:6, cursor:'pointer',
    border:`1px solid ${active ? 'rgba(0,210,255,0.3)' : 'rgba(255,255,255,0.08)'}`,
    background: active ? 'rgba(0,210,255,0.12)' : 'transparent',
    color: active ? '#00d2ff' : '#6b7280',
  });

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:16 }}>

      {/* ── KPI Row ── */}
      <div style={{ display:'grid', gridTemplateColumns:'repeat(4,1fr)', gap:12 }}>
        {[
          { label:'Total Active Alerts', icon:'🔔', value:totalAlerts,    sub:'+12% from yesterday', subColor:'#ef4444',  valColor:'#ef4444'  },
          { label:'Critical Alerts',     icon:'⚠️',  value:statusData?.critical_alerts ?? 10, sub:'+3 in last hour',  subColor:'#ef4444',  valColor:'#ef4444'  },
          { label:'Avg Response Time',   icon:'⏱',  value:'8.2 min',     sub:'−15% improvement',   subColor:'#10b981',  valColor:'#10b981'  },
          { label:'Threat Trend',        icon:'📈', value:'Increasing',  sub:'Monitor closely',    subColor:'#f59e0b',  valColor:'#f59e0b', small:true },
        ].map(kpi => (
          <div key={kpi.label} style={{ ...card, position:'relative', overflow:'hidden' }}>
            <div style={{ fontSize:11, color:'#6b7280', letterSpacing:'0.04em', textTransform:'uppercase', marginBottom:8, display:'flex', alignItems:'center', gap:6 }}>
              <span style={{ fontSize:14 }}>{kpi.icon}</span>{kpi.label}
            </div>
            <div style={{ fontSize: kpi.small ? 18 : 28, fontWeight:700, letterSpacing:'-0.5px', color:kpi.valColor, lineHeight:1.1 }}>
              {kpi.value}
            </div>
            <div style={{ fontSize:11, color:kpi.subColor, marginTop:5 }}>{kpi.sub}</div>
          </div>
        ))}
      </div>

      {/* ── Charts Row ── */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 260px 200px', gap:14 }}>

        {/* Alert Volume Trend */}
        <div style={card}>
          <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:10 }}>
            <div style={cardTitle}>Alert Volume Trend</div>
            <div style={{ display:'flex', gap:4 }}>
              {['1D','1W','2W','1M'].map(p => (
                <button key={p} style={tabBtn(trendPeriod === p)} onClick={() => setTrendPeriod(p)}>{p}</button>
              ))}
            </div>
          </div>
          <div style={{ display:'flex', gap:14, marginBottom:10 }}>
            {[['#ef4444','Critical'],['#f59e0b','High'],['#eab308','Low']].map(([c,l]) => (
              <span key={l} style={{ display:'flex', alignItems:'center', gap:5, fontSize:11, color:'#6b7280' }}>
                <span style={{ width:12, height:3, background:c, borderRadius:2, display:'inline-block' }} />{l}
              </span>
            ))}
          </div>
          <div style={{ position:'relative', height:150 }}>
            <Line data={trendData} options={trendOptions} />
          </div>
        </div>

        {/* Threats Coverage Radar */}
        <div style={{ ...card, display:'flex', flexDirection:'column' }}>
          <div style={cardTitle}>Threats Coverage</div>
          <div style={{ flex:1, position:'relative', height:180 }}>
            <Radar data={radarData} options={radarOptions} />
          </div>
          <div style={{ display:'flex', alignItems:'center', gap:6, fontSize:10, color:'#6b7280', justifyContent:'center', marginTop:4 }}>
            <span style={{ width:8, height:8, borderRadius:'50%', background:'#c026d3', display:'inline-block' }} />
            Threats coverage
          </div>
        </div>

        {/* Severity Donut */}
        <div style={{ ...card, display:'flex', flexDirection:'column' }}>
          <div style={cardTitle}>Severity Distribution</div>
          <div style={{ flex:1, position:'relative', height:150, display:'flex', alignItems:'center', justifyContent:'center' }}>
            <Doughnut data={donutData} options={donutOptions} />
            <div style={{ position:'absolute', textAlign:'center', pointerEvents:'none' }}>
              <div style={{ fontSize:20, fontWeight:700, color:'#e2e8f0' }}>{totalAlerts}</div>
              <div style={{ fontSize:10, color:'#6b7280' }}>Total</div>
            </div>
          </div>
          <div style={{ display:'flex', flexWrap:'wrap', gap:6, marginTop:8 }}>
            {[['#ef4444','Critical 12%'],['#f97316','High 28%'],['#eab308','Med 38%'],['#14b8a6','Low 22%']].map(([c,l]) => (
              <span key={l} style={{ display:'flex', alignItems:'center', gap:4, fontSize:10, color:'#9ca3af' }}>
                <span style={{ width:8, height:8, borderRadius:2, background:c, display:'inline-block', flexShrink:0 }} />{l}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* ── Bottom Row ── */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 320px', gap:14 }}>

        {/* Left: Heatmap + Recent Threats */}
        <div style={{ display:'flex', flexDirection:'column', gap:14 }}>

          {/* Weekly Heatmap */}
          <div style={card}>
            <div style={cardTitle}>Weekly Threat Activity Pattern</div>
            <WeeklyHeatmap />
          </div>

          {/* Recent Threats */}
          <div style={card}>
            <div style={cardTitle}>Recent Threats</div>
            <div style={{ display:'flex', flexDirection:'column', gap:0 }}>
              {THREAT_ITEMS.map((t, i) => (
                <div key={t.name} style={{
                  display:'flex', alignItems:'center', justifyContent:'space-between',
                  padding:'8px 0',
                  borderBottom: i < THREAT_ITEMS.length - 1 ? '1px solid rgba(255,255,255,0.04)' : 'none',
                }}>
                  <div style={{ display:'flex', alignItems:'center', gap:10 }}>
                    <span style={{ width:8, height:8, borderRadius:'50%', background:t.color, boxShadow:`0 0 5px ${t.color}`, display:'inline-block', flexShrink:0 }} />
                    <span style={{ fontSize:12, color:'#9ca3af' }}>{t.name}</span>
                  </div>
                  <span style={{ fontSize:13, fontWeight:700, color:'#e2e8f0' }}>{t.count}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right: Engine Controls + Block Log */}
        <div style={{ display:'flex', flexDirection:'column', gap:14 }}>

          {/* ML Engine Controls */}
          <div style={card}>
            <div style={cardTitle}>🤖 ML Engine Controls</div>
            <div style={{ ...cardSub, marginBottom:12 }}>Manage automated threat response</div>

            {/* Engine status + Start/Stop */}
            <div style={controlRow(mlActive)}>
              <div>
                <div style={{ fontSize:12, fontWeight:600, color:'#e2e8f0', display:'flex', alignItems:'center', gap:6 }}>
                  <span style={{ width:8, height:8, borderRadius:'50%', display:'inline-block', background: mlActive ? '#10b981' : '#ef4444', boxShadow:`0 0 6px ${mlActive ? '#10b981' : '#ef4444'}` }} />
                  ML Engine
                </div>
                <div style={{ fontSize:10, color:'#6b7280', marginTop:2 }}>
                  {mlActive ? 'Isolation Forest v2.1 — Active' : 'Engine Stopped'}
                </div>
              </div>
              <div style={{ display:'flex', gap:6 }}>
                <button onClick={() => onMLControl('start')} style={{ background:'rgba(16,185,129,0.12)', color:'#10b981', border:'1px solid rgba(16,185,129,0.3)', borderRadius:6, padding:'5px 10px', fontSize:11, fontWeight:700, cursor:'pointer' }}>▶ Start</button>
                <button onClick={() => onMLControl('stop')}  style={{ background:'rgba(239,68,68,0.1)',  color:'#ef4444', border:'1px solid rgba(239,68,68,0.25)', borderRadius:6, padding:'5px 10px', fontSize:11, fontWeight:700, cursor:'pointer' }}>■ Stop</button>
              </div>
            </div>

            {/* Auto-Respond toggle */}
            <div style={controlRow(autoRespond)}>
              <div>
                <div style={{ fontSize:12, fontWeight:600, color:'#e2e8f0' }}>🤖 Auto-Respond</div>
                <div style={{ fontSize:10, color:'#6b7280', marginTop:2 }}>Auto-block when confidence &gt; 95%</div>
              </div>
              <Toggle checked={autoRespond} onChange={handleAutoToggle} />
            </div>

            {/* Alert Notifications toggle */}
            <div style={controlRow(notifOn)}>
              <div>
                <div style={{ fontSize:12, fontWeight:600, color:'#e2e8f0' }}>🔔 Alert Notifications</div>
                <div style={{ fontSize:10, color:'#6b7280', marginTop:2 }}>Push critical alerts to SOC</div>
              </div>
              <Toggle checked={notifOn} onChange={setNotifOn} />
            </div>

            {/* Confidence bar */}
            <div style={{ marginTop:8 }}>
              <div style={{ display:'flex', justifyContent:'space-between', marginBottom:6 }}>
                <span style={{ fontSize:11, color:'#6b7280' }}>ML Confidence</span>
                <span style={{ fontSize:11, fontWeight:700, color: confColor }}>{confidence.toFixed(1)}%</span>
              </div>
              <div style={{ height:6, borderRadius:3, background:'#1f2937', overflow:'hidden' }}>
                <div style={{ height:'100%', borderRadius:3, width:`${confidence}%`, transition:'width 0.5s, background 0.5s', background:`linear-gradient(90deg, ${confColor}aa, ${confColor})` }} />
              </div>
              <div style={{ display:'flex', justifyContent:'space-between', marginTop:4 }}>
                <span style={{ fontSize:10, color:'#4b5563' }}>Safe</span>
                <span style={{ fontSize:10, color:'#4b5563' }}>Threat</span>
              </div>
            </div>

            {/* Attack status callout */}
            {isUnderAttack && !statusData?.attacker_blocked && (
              <button onClick={onManualBlock} disabled={blocking} style={{ marginTop:12, width:'100%', background:'#dc2626', color:'#fff', border:'none', borderRadius:8, padding:'9px', fontWeight:800, fontSize:13, cursor: blocking ? 'not-allowed' : 'pointer', opacity: blocking ? 0.7 : 1 }}>
                {blocking ? '⟳ Blocking...' : `🛑 Block ${statusData?.current_threat_ip ?? 'Attacker'}`}
              </button>
            )}
            {isUnderAttack && statusData?.attacker_blocked && (
              <div style={{ marginTop:12, padding:'10px', borderRadius:8, background:'rgba(16,185,129,0.1)', border:'1px solid rgba(16,185,129,0.3)', color:'#10b981', fontWeight:700, fontSize:13, textAlign:'center' }}>
                ✓ Blocked by {statusData.blocked_by === 'auto' ? 'ML Engine' : 'Officer'}
              </div>
            )}
          </div>

          {/* Attack Resolution Log */}
          <div style={{ ...card, flex:1 }}>
            <div style={{ display:'flex', justifyContent:'space-between', alignItems:'center', marginBottom:12 }}>
              <div style={cardTitle}>Attack Resolution Log</div>
              <span style={{ fontSize:10, color:'#6b7280' }}>{logRows.length} entries</span>
            </div>

            <div style={{ overflowY:'auto', maxHeight:260 }}>
              <table style={{ width:'100%', borderCollapse:'collapse' }}>
                <thead>
                  <tr style={{ borderBottom:'1px solid rgba(255,255,255,0.06)' }}>
                    {['IP Address','Type','Method','Sev','Status'].map(h => (
                      <th key={h} style={{ textAlign:'left', padding:'5px 8px', fontSize:9, color:'#4b5563', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.05em' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {logRows.map((row, i) => (
                    <tr key={i} style={{ borderBottom:'1px solid rgba(255,255,255,0.03)', background: i === 0 && logRows.length > 3 ? 'rgba(239,68,68,0.04)' : 'transparent' }}>
                      <td style={{ padding:'7px 8px', fontFamily:'monospace', fontSize:11, color:'#00d2ff' }}>{row.ip}</td>
                      <td style={{ padding:'7px 8px', fontSize:10, color:'#6b7280', maxWidth:90, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>{row.type}</td>
                      <td style={{ padding:'7px 8px' }}><StatusPill type={row.method} /></td>
                      <td style={{ padding:'7px 8px' }}><StatusPill type={row.severity} /></td>
                      <td style={{ padding:'7px 8px' }}><StatusPill type={row.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <button onClick={handleSimulateBlock} style={{ marginTop:10, width:'100%', background:'rgba(239,68,68,0.08)', color:'#ef4444', border:'1px solid rgba(239,68,68,0.22)', borderRadius:8, padding:'8px', fontSize:12, fontWeight:700, cursor:'pointer' }}>
              🛑 Simulate Manual Block
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}