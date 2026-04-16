// src/MLEngineTab.jsx
import React, { useState, useEffect, useRef, useCallback } from 'react';

const BACKEND = 'http://localhost:8000';

const ICS_DEVICES = [
  { ip: '10.0.0.11', name: 'HMI-D1',         type: 'HMI',      zone: 'Zone-A' },
  { ip: '10.0.0.12', name: 'PLC-01',          type: 'PLC',      zone: 'Zone-A' },
  { ip: '10.0.0.13', name: 'Robotic Arm',     type: 'Actuator', zone: 'Zone-B' },
  { ip: '10.0.0.14', name: 'Conveyor Sensor', type: 'Sensor',   zone: 'Zone-C' },
  { ip: '10.0.0.15', name: 'HMI-01',          type: 'HMI',      zone: 'Zone-B' },
  { ip: '10.0.0.16', name: 'PLC-04',          type: 'PLC',      zone: 'Zone-C' },
];

const formatPps   = (n) => n >= 1000 ? `${(n/1000).toFixed(1)}k` : String(n);
const formatTotal = (n) => n >= 1e6  ? `${(n/1e6).toFixed(1)}M`  : n >= 1000 ? `${(n/1000).toFixed(0)}k` : String(n);

function RadarChart({ data, size = 200 }) {
  const canvasRef = useRef(null);
  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const cx = size/2, cy = size/2, r = size*0.38;
    const n = data.length;
    ctx.clearRect(0,0,size,size);
    for (let ring=1;ring<=4;ring++){ctx.beginPath();for(let i=0;i<n;i++){const a=(i/n)*2*Math.PI-Math.PI/2;const rr=r*(ring/4);i===0?ctx.moveTo(cx+rr*Math.cos(a),cy+rr*Math.sin(a)):ctx.lineTo(cx+rr*Math.cos(a),cy+rr*Math.sin(a));}ctx.closePath();ctx.strokeStyle='rgba(139,92,246,0.15)';ctx.lineWidth=0.8;ctx.stroke();}
    for(let i=0;i<n;i++){const a=(i/n)*2*Math.PI-Math.PI/2;ctx.beginPath();ctx.moveTo(cx,cy);ctx.lineTo(cx+r*Math.cos(a),cy+r*Math.sin(a));ctx.strokeStyle='rgba(139,92,246,0.2)';ctx.lineWidth=0.8;ctx.stroke();}
    ctx.beginPath();data.forEach((d,i)=>{const a=(i/n)*2*Math.PI-Math.PI/2;const rv=r*(d.value/100);i===0?ctx.moveTo(cx+rv*Math.cos(a),cy+rv*Math.sin(a)):ctx.lineTo(cx+rv*Math.cos(a),cy+rv*Math.sin(a));});ctx.closePath();ctx.fillStyle='rgba(139,92,246,0.18)';ctx.strokeStyle='#8b5cf6';ctx.lineWidth=1.5;ctx.fill();ctx.stroke();
    data.forEach((d,i)=>{const a=(i/n)*2*Math.PI-Math.PI/2;const rv=r*(d.value/100);ctx.beginPath();ctx.arc(cx+rv*Math.cos(a),cy+rv*Math.sin(a),3.5,0,Math.PI*2);ctx.fillStyle='#a78bfa';ctx.shadowColor='#8b5cf6';ctx.shadowBlur=8;ctx.fill();ctx.shadowBlur=0;});
    ctx.font='9px Inter,sans-serif';ctx.fillStyle='#9ca3af';ctx.textAlign='center';ctx.textBaseline='middle';
    data.forEach((d,i)=>{const a=(i/n)*2*Math.PI-Math.PI/2;ctx.fillText(d.label,cx+(r+18)*Math.cos(a),cy+(r+18)*Math.sin(a));});
  }, [data, size]);
  return <canvas ref={canvasRef} width={size} height={size} style={{width:size,height:size}} />;
}

function LineChart({ datasets, labels, height=160 }) {
  const canvasRef = useRef(null);
  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W=canvas.width,H=canvas.height,padL=28,padR=10,padT=10,padB=24;
    const chartW=W-padL-padR,chartH=H-padT-padB;
    ctx.clearRect(0,0,W,H);ctx.fillStyle='#050a14';ctx.fillRect(0,0,W,H);
    for(let g=0;g<=4;g++){const y=padT+(g/4)*chartH;ctx.beginPath();ctx.moveTo(padL,y);ctx.lineTo(W-padR,y);ctx.strokeStyle='rgba(255,255,255,0.04)';ctx.lineWidth=0.7;ctx.stroke();ctx.fillStyle='#374151';ctx.font='8px Inter';ctx.textAlign='right';ctx.fillText(Math.round(30*(1-g/4)),padL-4,y+3);}
    const step=Math.floor(labels.length/6);ctx.fillStyle='#374151';ctx.font='8px Inter';ctx.textAlign='center';
    labels.forEach((l,i)=>{if(i%step!==0)return;ctx.fillText(l,padL+(i/(labels.length-1))*chartW,H-4);});
    const allVals=datasets.flatMap(d=>d.data);const max=Math.max(...allVals,1);
    datasets.forEach(({color,data})=>{ctx.beginPath();data.forEach((v,i)=>{const x=padL+(i/(data.length-1))*chartW;const y=padT+chartH-(v/max)*chartH;i===0?ctx.moveTo(x,y):ctx.lineTo(x,y);});ctx.strokeStyle=color;ctx.lineWidth=1.8;ctx.shadowColor=color;ctx.shadowBlur=6;ctx.stroke();ctx.shadowBlur=0;});
  }, [datasets, labels]);
  return <canvas ref={canvasRef} width={600} height={height} style={{width:'100%',height}} />;
}

function SeverityDonut({ total, slices }) {
  const r=54,cx=70,cy=70,sw=14,circ=2*Math.PI*r;
  const arcs=slices.map((s, index)=>{
    const dash=(s.pct/100)*circ;
    const offset=slices
      .slice(0,index)
      .reduce((sum, slice)=>sum+(slice.pct/100)*circ, 0);
    return {...s,dash,gap:circ-dash,offset};
  });
  return (
    <div style={{position:'relative',width:140,height:140,flexShrink:0}}>
      <svg width={140} height={140} style={{transform:'rotate(-90deg)'}}>
        {arcs.map((a,i)=><circle key={i} cx={cx} cy={cy} r={r} fill="none" stroke={a.color} strokeWidth={sw} strokeDasharray={`${a.dash} ${a.gap}`} strokeDashoffset={-a.offset} style={{filter:`drop-shadow(0 0 4px ${a.color}88)`}} />)}
      </svg>
      <div style={{position:'absolute',inset:0,display:'flex',flexDirection:'column',alignItems:'center',justifyContent:'center'}}>
        <span style={{fontSize:26,fontWeight:800,color:'var(--text-main)'}}>{total}</span>
        <span style={{fontSize:10,color:'var(--text-dim)'}}>Total</span>
      </div>
    </div>
  );
}

function WeeklyHeatmap({ data }) {
  const days=['Mon','Tue','Wed','Thu','Fri','Sat','Sun'];
  const maxVal=Math.max(...data.flat(),1);
  const col=(v)=>{if(!v)return'#0e1e38';const t=v/maxVal;return t<0.25?'#1e3a5f':t<0.5?'#f59e0b':t<0.75?'#f97316':'#ef4444';};
  return (
    <div style={{overflowX:'auto'}}>
      <div style={{display:'flex',marginLeft:36,marginBottom:4}}>
        {[0,3,6,9,12,15,18,21].map(h=><div key={h} style={{flex:1,fontSize:9,color:'#4b5563',minWidth:0}}>{h}h</div>)}
      </div>
      {days.map((day,di)=>(
        <div key={day} style={{display:'flex',alignItems:'center',marginBottom:3}}>
          <span style={{width:30,fontSize:10,color:'#6b7280',flexShrink:0}}>{day}</span>
          <div style={{display:'flex',gap:2,flex:1}}>
            {Array.from({length:24},(_,h)=>(
              <div key={h} style={{flex:1,height:18,borderRadius:3,background:col(data[di]?.[h]??0),minWidth:8,
                boxShadow:(data[di]?.[h]??0)>maxVal*0.5?`0 0 4px ${col(data[di]?.[h]??0)}88`:'none'}} />
            ))}
          </div>
        </div>
      ))}
      <div style={{display:'flex',alignItems:'center',gap:6,marginTop:6,marginLeft:36,fontSize:9,color:'#4b5563'}}>
        <span>Low</span>{['#1e3a5f','#f59e0b','#f97316','#ef4444'].map(c=><div key={c} style={{width:14,height:10,borderRadius:2,background:c}} />)}<span>High</span>
      </div>
    </div>
  );
}

function MLControls({ statusData, isUnderAttack, onManualBlock, onMLControl, blocking }) {
  return (
    <div style={{display:'flex',flexDirection:'column',gap:12}}>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'10px 14px',borderRadius:8,
        background:statusData?.ml_engine_active?'rgba(16,185,129,0.08)':'rgba(239,68,68,0.08)',
        border:`1px solid ${statusData?.ml_engine_active?'rgba(16,185,129,0.3)':'rgba(239,68,68,0.3)'}`}}>
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          <span style={{width:10,height:10,borderRadius:'50%',display:'inline-block',
            background:statusData?.ml_engine_active?'#10b981':'#ef4444',
            boxShadow:`0 0 8px ${statusData?.ml_engine_active?'#10b981':'#ef4444'}`}} />
          <div>
            <div style={{color:'var(--text-main)',fontWeight:700,fontSize:13}}>ML Engine</div>
            <div style={{color:'var(--text-dim)',fontSize:10}}>Isolation Forest v2.1 â€” {statusData?.ml_engine_active?'Active':'Stopped'}</div>
          </div>
        </div>
        <div style={{display:'flex',gap:6}}>
          <button onClick={()=>onMLControl('start')} style={{background:'#10b981',color:'#fff',border:'none',borderRadius:6,padding:'5px 12px',fontWeight:700,fontSize:12,cursor:'pointer'}}>â–¶ Start</button>
          <button onClick={()=>onMLControl('stop')} style={{background:'#ef4444',color:'#fff',border:'none',borderRadius:6,padding:'5px 12px',fontWeight:700,fontSize:12,cursor:'pointer'}}>Stop</button>
        </div>
      </div>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'10px 14px',borderRadius:8,
        background:statusData?.auto_respond?'rgba(16,185,129,0.06)':'rgba(0,210,255,0.04)',
        border:`1px solid ${statusData?.auto_respond?'rgba(16,185,129,0.25)':'rgba(0,210,255,0.12)'}`}}>
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          <span style={{fontSize:18}}>ðŸ¤–</span>
          <div>
            <div style={{color:'var(--text-main)',fontWeight:700,fontSize:13}}>Auto-Respond</div>
            <div style={{color:'var(--text-dim)',fontSize:10}}>Auto-block when confidence &gt; 95%</div>
          </div>
        </div>
        <div onClick={()=>onMLControl(statusData?.auto_respond?'auto_off':'auto_on')}
          style={{width:44,height:24,borderRadius:12,cursor:'pointer',position:'relative',
            background:statusData?.auto_respond?'#10b981':'#374151',transition:'background 0.3s',
            boxShadow:statusData?.auto_respond?'0 0 10px rgba(16,185,129,0.5)':'none'}}>
          <div style={{position:'absolute',top:3,left:statusData?.auto_respond?23:3,width:18,height:18,
            borderRadius:'50%',background:'#fff',transition:'left 0.3s',boxShadow:'0 1px 4px rgba(0,0,0,0.3)'}} />
        </div>
      </div>
      <div style={{display:'flex',alignItems:'center',justifyContent:'space-between',padding:'10px 14px',borderRadius:8,
        background:'rgba(0,210,255,0.04)',border:'1px solid rgba(0,210,255,0.12)'}}>
        <div style={{display:'flex',alignItems:'center',gap:10}}>
          <span style={{fontSize:18}}>ðŸ””</span>
          <div>
            <div style={{color:'var(--text-main)',fontWeight:700,fontSize:13}}>Alert Notifications</div>
            <div style={{color:'var(--text-dim)',fontSize:10}}>Push critical alerts to SOC</div>
          </div>
        </div>
        <span style={{background:'rgba(16,185,129,0.15)',color:'#10b981',border:'1px solid rgba(16,185,129,0.3)',borderRadius:20,padding:'3px 12px',fontSize:11,fontWeight:700}}>ON</span>
      </div>
      <div style={{padding:'10px 14px',borderRadius:8,background:'rgba(0,0,0,0.2)',border:'1px solid rgba(255,255,255,0.05)'}}>
        <div style={{display:'flex',justifyContent:'space-between',marginBottom:8,fontSize:12,color:'#9ca3af'}}>
          <span>ML Confidence</span>
          <span style={{color:'var(--text-main)',fontWeight:700}}>{statusData?.ml_confidence??12}%</span>
        </div>
        <div style={{height:8,background:'#0e1e38',borderRadius:4,overflow:'hidden'}}>
          <div style={{height:'100%',width:`${statusData?.ml_confidence??12}%`,
            background:isUnderAttack?'linear-gradient(90deg,#991b1b,#ef4444)':'linear-gradient(90deg,#0284c7,#00d2ff)',
            borderRadius:4,transition:'width 0.5s'}} />
        </div>
        <div style={{display:'flex',justifyContent:'space-between',marginTop:4,fontSize:9,color:'#374151'}}>
          <span>Safe</span><span>Threat</span>
        </div>
      </div>
      {isUnderAttack && !statusData?.attacker_blocked && (
        <button onClick={onManualBlock} disabled={blocking} style={{background:'#dc2626',color:'#fff',border:'none',borderRadius:8,padding:'10px',fontWeight:800,fontSize:13,cursor:'pointer',width:'100%'}}>
          {blocking?'âŸ³ Blocking...':'ðŸ›‘ Manual Block Attacker'}
        </button>
      )}
    </div>
  );
}

export default function MLEngineTab({ statusData, alerts, isUnderAttack, onManualBlock, onMLControl, blocking }) {
  const [trendWindow, setTrendWindow] = useState('2W');
  const [quarantined, setQuarantined] = useState({});
  const [quarantining, setQuarantining] = useState(null);
  const [packetStats, setPacketStats] = useState({ pps:3420, peak:0, total:0 });
  const [exporting, setExporting] = useState(false);
  const [exportMsg, setExportMsg] = useState('');
  const ppsRef = useRef(null);

  const totalAlerts    = alerts.length;
  const criticalAlerts = alerts.filter(a=>a.severity==='CRITICAL').length;

  const genTrend = useCallback((base,variance,pts) =>
    Array.from({length:pts},(_,i)=>Math.max(0,Math.round(base+Math.sin(i*0.5)*variance+(Math.random()-0.5)*variance*0.5))),[]);

  const trendPoints = trendWindow==='1D'?24:trendWindow==='1W'?7:trendWindow==='2W'?14:30;
  const trendLabels = Array.from({length:trendPoints},(_,i)=>{
    if(trendWindow==='1D')return`${i}h`;
    const d=new Date();d.setDate(d.getDate()-(trendPoints-1-i));
    return`${d.getDate()} ${d.toLocaleString('default',{month:'short'})}`;
  });
  const trendDatasets=[
    {color:'#ef4444',label:'Critical',data:genTrend(10,5,trendPoints)},
    {color:'#f97316',label:'High',    data:genTrend(15,4,trendPoints)},
    {color:'#facc15',label:'Low',     data:genTrend(18,6,trendPoints)},
  ];
  const radarData=[
    {label:'Discovery',value:72},{label:'Initial Access',value:85},{label:'Exec',value:60},
    {label:'Privilege Esc',value:45},{label:'Persistence',value:55},{label:'Defense Evasion',value:50},
    {label:'Lateral Mvmt',value:65},{label:'Exfiltration',value:40},
  ];
  const severitySlices=[
    {label:'Critical',color:'#ef4444',pct:12},{label:'High',color:'#f97316',pct:28},
    {label:'Med',color:'#facc15',pct:38},{label:'Low',color:'#10b981',pct:22},
  ];
  const heatmapData=Array.from({length:7},()=>
    Array.from({length:24},(_,hi)=>Math.max(0,Math.round((hi>=9&&hi<=17?12:3)+(Math.random()-0.3)*15))));

  useEffect(()=>{
    const load=async()=>{try{const r=await fetch(`${BACKEND}/api/v1/quarantine`);if(r.ok){const d=await r.json();setQuarantined(d.devices||{});}}catch(error){console.warn('Failed to load quarantine state', error);}};
    load();const id=setInterval(load,5000);return()=>clearInterval(id);
  },[]);

  useEffect(()=>{
    const base=isUnderAttack?14250:3420;
    ppsRef.current=setInterval(async()=>{
      const pps=Math.max(100,base+Math.floor((Math.random()-0.5)*800));
      try{await fetch(`${BACKEND}/api/v1/packets/update`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({pps})});
      }catch(error){console.warn('Failed to publish packet stats', error);}
      setPacketStats(prev=>({pps,peak:Math.max(prev.peak,pps),total:prev.total+pps}));
    },2000);
    return()=>clearInterval(ppsRef.current);
  },[isUnderAttack]);

  const handleQuarantine=async(device)=>{
    if(!window.confirm(`Quarantine ${device.name} (${device.ip})?\n\nThis isolates it to stop lateral movement.`))return;
    setQuarantining(device.ip);
    try{const r=await fetch(`${BACKEND}/api/v1/quarantine`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({device_ip:device.ip,device_name:device.name})});
    const d=await r.json();if(d.status==='quarantined')setQuarantined(prev=>({...prev,[device.ip]:{device_name:device.name,quarantined_at:new Date().toISOString()}}));
    }catch(e){alert(`Error: ${e.message}`);}finally{setQuarantining(null);}
  };

  const handleRelease=async(ip)=>{
    try{const r=await fetch(`${BACKEND}/api/v1/quarantine/release`,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({device_ip:ip})});
    const d=await r.json();if(d.status==='released')setQuarantined(prev=>{const n={...prev};delete n[ip];return n;});
    }catch(e){alert(`Error: ${e.message}`);}
  };

  const handleExport=async(format)=>{
    setExporting(true);setExportMsg('');
    try{const r=await fetch(`${BACKEND}/api/v1/report/${format}`);if(!r.ok)throw new Error('Export failed');
    const blob=await r.blob();const url=URL.createObjectURL(blob);const a=document.createElement('a');
    a.href=url;a.download=`sentinel_report_${new Date().toISOString().slice(0,10)}.${format}`;a.click();
    URL.revokeObjectURL(url);setExportMsg(`âœ“ Report downloaded as .${format.toUpperCase()}`);
    }catch(e){setExportMsg(`âœ— Export failed: ${e.message}`);}finally{setExporting(false);}
  };

  return (
    <div style={{display:'flex',flexDirection:'column',gap:16}}>

      {/* â”€â”€ KPI CARDS â”€â”€ */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:16}}>
        {[
          {icon:'ðŸ””',label:'TOTAL ACTIVE ALERTS',value:totalAlerts,    sub:'+12% from yesterday',subColor:'#ef4444',valColor:'#ef4444'},
          {icon:'âš ï¸',label:'CRITICAL ALERTS',    value:criticalAlerts,sub:'+3 in last hour',    subColor:'#ef4444',valColor:'#ef4444'},
          {icon:'â±', label:'AVG RESPONSE TIME',  value:'8.2 min',     sub:'âˆ’15% improvement',  subColor:'#10b981',valColor:'#10b981'},
          {icon:'ðŸ“ˆ',label:'THREAT TREND',        value:'Increasing',  sub:'Monitor closely',   subColor:'#f59e0b',valColor:'#f59e0b'},
        ].map(({icon,label,value,sub,subColor,valColor})=>(
          <div key={label} className="card" style={{padding:'18px 20px'}}>
            <div style={{display:'flex',alignItems:'center',gap:8,marginBottom:10}}>
              <span style={{fontSize:14}}>{icon}</span>
              <span style={{fontSize:10,fontWeight:700,color:'var(--text-dim)',letterSpacing:1,textTransform:'uppercase'}}>{label}</span>
            </div>
            <div style={{fontSize:32,fontWeight:800,color:valColor,lineHeight:1,marginBottom:6}}>{value}</div>
            <div style={{fontSize:11,color:subColor}}>{sub}</div>
          </div>
        ))}
      </div>

      {/* â”€â”€ TREND + RADAR + DONUT â”€â”€ */}
      <div style={{display:'grid',gridTemplateColumns:'1fr 260px 220px',gap:16}}>
        <div className="card" style={{padding:20}}>
          <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:12}}>
            <div className="card-title">Alert Volume Trend</div>
            <div style={{display:'flex',gap:4}}>
              {['1D','1W','2W','1M'].map(w=>(
                <button key={w} onClick={()=>setTrendWindow(w)} style={{padding:'3px 10px',borderRadius:4,fontSize:11,fontWeight:700,cursor:'pointer',
                  background:trendWindow===w?'var(--c-cyan)':'transparent',color:trendWindow===w?'#000':'var(--text-dim)',
                  border:trendWindow===w?'none':'1px solid var(--card-border)'}}>{w}</button>
              ))}
            </div>
          </div>
          <div style={{display:'flex',gap:16,marginBottom:8}}>
            {trendDatasets.map(d=>(
              <div key={d.label} style={{display:'flex',alignItems:'center',gap:5,fontSize:11}}>
                <div style={{width:20,height:2,background:d.color,borderRadius:2}} />
                <span style={{color:'var(--text-dim)'}}>{d.label}</span>
              </div>
            ))}
          </div>
          <LineChart datasets={trendDatasets} labels={trendLabels} height={160} />
        </div>
        <div className="card" style={{padding:20,display:'flex',flexDirection:'column',alignItems:'center'}}>
          <div className="card-title" style={{alignSelf:'flex-start',marginBottom:12}}>Threats Coverage</div>
          <RadarChart data={radarData} size={180} />
          <div style={{display:'flex',alignItems:'center',gap:6,marginTop:8,fontSize:10,color:'#9ca3af'}}>
            <div style={{width:8,height:8,borderRadius:'50%',background:'#a78bfa',boxShadow:'0 0 6px #8b5cf6'}} />
            Threats coverage
          </div>
        </div>
        <div className="card" style={{padding:20}}>
          <div className="card-title" style={{marginBottom:14}}>Severity Distribution</div>
          <div style={{display:'flex',justifyContent:'center',marginBottom:14}}>
            <SeverityDonut total={totalAlerts} slices={severitySlices} />
          </div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:6}}>
            {severitySlices.map(s=>(
              <div key={s.label} style={{display:'flex',alignItems:'center',gap:6,fontSize:11}}>
                <div style={{width:10,height:10,borderRadius:'50%',background:s.color,boxShadow:`0 0 5px ${s.color}88`,flexShrink:0}} />
                <span style={{color:'var(--text-dim)'}}>{s.label} {s.pct}%</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* â”€â”€ HEATMAP + ML CONTROLS â”€â”€ */}
      <div style={{display:'grid',gridTemplateColumns:'1fr 340px',gap:16}}>
        <div className="card" style={{padding:20}}>
          <div className="card-title" style={{marginBottom:14}}>Weekly Threat Activity Pattern</div>
          <WeeklyHeatmap data={heatmapData} />
        </div>
        <div className="card" style={{padding:20}}>
          <div className="card-title" style={{marginBottom:6}}><span style={{marginRight:6}}>ðŸ¤–</span> ML Engine Controls</div>
          <div style={{fontSize:11,color:'var(--text-dim)',marginBottom:14}}>Manage automated threat response</div>
          <MLControls statusData={statusData} isUnderAttack={isUnderAttack} onManualBlock={onManualBlock} onMLControl={onMLControl} blocking={blocking} />
        </div>
      </div>

      {/* â•â•â•â• SEPARATOR â•â•â•â• */}
      <div style={{borderTop:'2px solid rgba(0,210,255,0.15)',paddingTop:16,marginTop:4}}>
        <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:16}}>
          <div style={{height:1,flex:1,background:'rgba(0,210,255,0.1)'}} />
          <span style={{fontSize:11,fontWeight:700,color:'var(--text-dim)',letterSpacing:2,textTransform:'uppercase'}}>Advanced Response Features</span>
          <div style={{height:1,flex:1,background:'rgba(0,210,255,0.1)'}} />
        </div>
      </div>

      {/* â”€â”€ NEW 1: Packet Monitor + Resolution Log â”€â”€ */}
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16}}>
        <div className="card" style={{padding:20}}>
          <div className="card-title" style={{marginBottom:16}}>ðŸ“¡ Real-time Packet Monitor</div>
          <div style={{textAlign:'center',padding:'16px 0',marginBottom:16,
            background:isUnderAttack?'rgba(239,68,68,0.06)':'rgba(0,210,255,0.04)',
            borderRadius:10,border:`1px solid ${isUnderAttack?'rgba(239,68,68,0.2)':'rgba(0,210,255,0.15)'}`}}>
            <div style={{fontSize:42,fontWeight:800,fontFamily:'monospace',lineHeight:1,color:isUnderAttack?'#ef4444':'var(--c-cyan)'}}>
              {formatPps(packetStats.pps)}
            </div>
            <div style={{fontSize:12,color:'var(--text-dim)',marginTop:4}}>packets / second</div>
            <div style={{display:'flex',alignItems:'center',justifyContent:'center',gap:6,marginTop:8}}>
              <span style={{width:7,height:7,borderRadius:'50%',display:'inline-block',background:isUnderAttack?'#ef4444':'#10b981',boxShadow:`0 0 8px ${isUnderAttack?'#ef4444':'#10b981'}`,animation:'pulseC 1.5s infinite'}}/>
              <span style={{fontSize:10,fontWeight:700,color:isUnderAttack?'#ef4444':'#10b981'}}>
                {isUnderAttack?'ATTACK TRAFFIC DETECTED':'NORMAL BASELINE TRAFFIC'}
              </span>
            </div>
          </div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:10,marginBottom:16}}>
            {[
              {label:'Current',value:formatPps(packetStats.pps),  color:isUnderAttack?'#ef4444':'var(--c-cyan)'},
              {label:'Peak',   value:formatPps(packetStats.peak),  color:'#f97316'},
              {label:'Total',  value:formatTotal(packetStats.total),color:'#8b5cf6'},
            ].map(({label,value,color})=>(
              <div key={label} style={{padding:'10px',borderRadius:8,textAlign:'center',background:'rgba(255,255,255,0.02)',border:'1px solid var(--card-border)'}}>
                <div style={{fontSize:18,fontWeight:800,color,fontFamily:'monospace'}}>{value}</div>
                <div style={{fontSize:10,color:'var(--text-dim)',marginTop:2}}>{label}</div>
              </div>
            ))}
          </div>
          <div style={{padding:'10px 14px',borderRadius:8,background:'rgba(0,0,0,0.15)',border:'1px solid var(--card-border)'}}>
            <div style={{fontSize:11,color:'var(--text-dim)',marginBottom:8,fontWeight:600}}>Traffic Baseline Comparison</div>
            {[
              {label:'Normal baseline', pps:3420,            color:'#10b981'},
              {label:'Current traffic', pps:packetStats.pps, color:isUnderAttack?'#ef4444':'#10b981'},
              {label:'Attack threshold',pps:10000,           color:'#f97316'},
            ].map(({label,pps,color})=>(
              <div key={label} style={{marginBottom:6}}>
                <div style={{display:'flex',justifyContent:'space-between',fontSize:10,color:'var(--text-dim)',marginBottom:3}}>
                  <span>{label}</span><span style={{color,fontWeight:700}}>{formatPps(pps)} pps</span>
                </div>
                <div style={{height:4,background:'var(--progress-bg-color)',borderRadius:2}}>
                  <div style={{height:'100%',width:`${Math.min(100,(pps/15000)*100)}%`,background:color,borderRadius:2,transition:'width 0.5s'}} />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="card" style={{padding:20}}>
          <div className="card-title" style={{marginBottom:14}}>
            ðŸ“œ Attack Resolution Log
            <span style={{marginLeft:8,fontSize:11,color:'var(--text-dim)',fontWeight:400}}>
              {alerts.filter(a=>a.source_ip==='OFFICER'||a.source_ip==='SENTINEL-AI').length} entries
            </span>
          </div>
          <table style={{width:'100%',borderCollapse:'collapse'}}>
            <thead>
              <tr style={{borderBottom:'1px solid var(--card-border)'}}>
                {['IP Address','Type','Method','Sev','Status'].map(h=>(
                  <th key={h} style={{textAlign:'left',padding:'8px 10px',fontSize:10,color:'var(--text-dim)',fontWeight:600,textTransform:'uppercase'}}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {alerts.filter(a=>a.source_ip==='OFFICER'||a.source_ip==='SENTINEL-AI'||a.title?.includes('BLOCKED')||a.title?.includes('QUARANTINE'))
                .slice(0,6).map((a,i)=>(
                <tr key={i} style={{borderBottom:'1px solid var(--card-border)',background:i%2===0?'rgba(255,255,255,0.01)':'transparent'}}>
                  <td style={{padding:'8px 10px',fontFamily:'monospace',fontSize:11,color:'var(--text-main)'}}>{a.destination_ip?.substring(0,15)}</td>
                  <td style={{padding:'8px 10px',color:'var(--text-dim)',fontSize:11}}>{a.title?.replace('BLOCKED: ','').replace('QUARANTINED: ','').substring(0,18)}</td>
                  <td style={{padding:'8px 10px'}}>
                    <span style={{fontSize:10,padding:'2px 7px',borderRadius:4,
                      background:a.source_ip==='SENTINEL-AI'?'rgba(0,210,255,0.12)':'rgba(139,92,246,0.12)',
                      color:a.source_ip==='SENTINEL-AI'?'var(--c-cyan)':'#8b5cf6',
                      border:`1px solid ${a.source_ip==='SENTINEL-AI'?'rgba(0,210,255,0.3)':'rgba(139,92,246,0.3)'}`}}>
                      {a.source_ip==='SENTINEL-AI'?'Auto':'Manual'}
                    </span>
                  </td>
                  <td style={{padding:'8px 10px',fontSize:11,fontWeight:700,color:a.severity==='CRITICAL'?'#ef4444':a.severity==='HIGH'?'#f97316':'#f59e0b'}}>{a.severity}</td>
                  <td style={{padding:'8px 10px'}}>
                    <span style={{fontSize:10,fontWeight:700,padding:'2px 8px',borderRadius:4,background:'rgba(16,185,129,0.12)',color:'#10b981',border:'1px solid rgba(16,185,129,0.3)'}}>Resolved</span>
                  </td>
                </tr>
              ))}
              {alerts.filter(a=>a.source_ip==='OFFICER'||a.source_ip==='SENTINEL-AI').length===0&&(
                <tr><td colSpan={5} style={{padding:'20px',textAlign:'center',color:'var(--text-dim)',fontSize:12}}>No resolved incidents â€” run hacker_attack.py to simulate</td></tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* â”€â”€ NEW 2: Device Quarantine â”€â”€ */}
      <div className="card" style={{padding:20}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center',marginBottom:16}}>
          <div>
            <div className="card-title">ðŸ”’ Device Quarantine</div>
            <div style={{fontSize:11,color:'var(--text-dim)',marginTop:4}}>Isolate compromised ICS devices to prevent lateral movement across the network</div>
          </div>
          {Object.keys(quarantined).length>0&&(
            <span style={{background:'rgba(239,68,68,0.15)',color:'#ef4444',border:'1px solid rgba(239,68,68,0.4)',borderRadius:6,padding:'4px 12px',fontSize:12,fontWeight:700}}>
              {Object.keys(quarantined).length} ISOLATED
            </span>
          )}
        </div>
        <table style={{width:'100%',borderCollapse:'collapse'}}>
          <thead>
            <tr style={{borderBottom:'1px solid var(--card-border)'}}>
              {['Device','IP','Type','Zone','Status','Action'].map(h=>(
                <th key={h} style={{textAlign:'left',padding:'8px 12px',fontSize:11,color:'var(--text-dim)',fontWeight:600,textTransform:'uppercase',letterSpacing:0.5}}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {ICS_DEVICES.map((device)=>{
              const isQ=!!quarantined[device.ip];
              const isComp=isUnderAttack&&device.name==='PLC-01'&&!isQ;
              const status=isQ?'QUARANTINED':isComp?'COMPROMISED':'ONLINE';
              const sc=isQ?'#f97316':isComp?'#ef4444':'#10b981';
              return (
                <tr key={device.ip} style={{borderBottom:'1px solid var(--card-border)',background:isQ?'rgba(249,115,22,0.05)':isComp?'rgba(239,68,68,0.04)':'transparent'}}>
                  <td style={{padding:'10px 12px'}}><div style={{display:'flex',alignItems:'center',gap:8}}><span style={{width:8,height:8,borderRadius:'50%',display:'inline-block',background:sc,boxShadow:`0 0 6px ${sc}`}} /><span style={{color:'var(--text-main)',fontWeight:600,fontSize:13}}>{device.name}</span></div></td>
                  <td style={{padding:'10px 12px',color:'var(--text-dim)',fontSize:12,fontFamily:'monospace'}}>{device.ip}</td>
                  <td style={{padding:'10px 12px',color:'var(--text-dim)',fontSize:12}}>{device.type}</td>
                  <td style={{padding:'10px 12px'}}><span style={{fontSize:11,padding:'2px 8px',borderRadius:4,background:'rgba(139,92,246,0.12)',color:'#8b5cf6',border:'1px solid rgba(139,92,246,0.3)'}}>{device.zone}</span></td>
                  <td style={{padding:'10px 12px'}}><span style={{fontSize:11,fontWeight:700,padding:'3px 8px',borderRadius:4,background:`${sc}22`,color:sc,border:`1px solid ${sc}44`}}>{status}</span></td>
                  <td style={{padding:'10px 12px'}}>
                    {isQ?(
                      <button onClick={()=>handleRelease(device.ip)} style={{background:'rgba(16,185,129,0.12)',color:'#10b981',border:'1px solid rgba(16,185,129,0.3)',borderRadius:6,padding:'5px 12px',fontSize:11,fontWeight:700,cursor:'pointer'}}>ðŸ”“ Release</button>
                    ):(
                      <button onClick={()=>handleQuarantine(device)} disabled={quarantining===device.ip}
                        style={{background:isComp?'rgba(239,68,68,0.15)':'rgba(249,115,22,0.1)',color:isComp?'#ef4444':'#f97316',
                          border:`1px solid ${isComp?'rgba(239,68,68,0.4)':'rgba(249,115,22,0.3)'}`,
                          borderRadius:6,padding:'5px 12px',fontSize:11,fontWeight:700,cursor:'pointer',opacity:quarantining===device.ip?0.6:1}}>
                        {quarantining===device.ip?'âŸ³':'ðŸ”’ Isolate'}
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <div style={{marginTop:14,padding:'10px 14px',borderRadius:8,background:'rgba(249,115,22,0.06)',border:'1px solid rgba(249,115,22,0.2)'}}>
          <span style={{fontSize:11,color:'#f97316',fontWeight:700}}>Warning: What Quarantine does: </span>
          <span style={{fontSize:11,color:'var(--text-dim)'}}>Blocks ALL inbound + outbound traffic from the device via Windows Firewall, stopping lateral movement to other PLCs and HMIs. Click Release once the device is verified clean.</span>
        </div>
      </div>

      {/* â”€â”€ NEW 3: Export Report â”€â”€ */}
      <div className="card" style={{padding:20}}>
        <div className="card-title" style={{marginBottom:6}}>ðŸ“‹ Export Incident Report</div>
        <div style={{fontSize:11,color:'var(--text-dim)',marginBottom:16}}>Download the full attack report for compliance, audit logs, and management review</div>
        <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16,marginBottom:16}}>
          {[
            {format:'csv', icon:'ðŸ“Š',title:'CSV Report', desc:'Open in Excel Â· All alerts + incident log Â· Compatible with SIEM',color:'var(--c-cyan)',bg:'rgba(0,210,255,0.12)',border:'rgba(0,210,255,0.3)'},
            {format:'json',icon:'ðŸ”§',title:'JSON Report',desc:'Machine-readable Â· Full system state Â· For SOAR/SIEM integration',color:'#8b5cf6',      bg:'rgba(139,92,246,0.12)',border:'rgba(139,92,246,0.3)'},
          ].map(({format,icon,title,desc,color,bg,border})=>(
            <div key={format} style={{padding:'16px',borderRadius:10,background:'rgba(0,0,0,0.1)',border:'1px solid var(--card-border)'}}>
              <div style={{display:'flex',alignItems:'center',gap:10,marginBottom:10}}>
                <span style={{fontSize:24}}>{icon}</span>
                <div>
                  <div style={{color:'var(--text-main)',fontWeight:700,fontSize:14}}>{title}</div>
                  <div style={{color:'var(--text-dim)',fontSize:11}}>{desc}</div>
                </div>
              </div>
              <button onClick={()=>handleExport(format)} disabled={exporting} style={{width:'100%',background:bg,color,border:`1px solid ${border}`,borderRadius:8,padding:'10px',fontWeight:700,fontSize:13,cursor:'pointer'}}>
                {exporting?'âŸ³ Generating...':`â¬‡ Download ${format.toUpperCase()}`}
              </button>
            </div>
          ))}
        </div>
        {exportMsg&&(
          <div style={{padding:'8px 14px',borderRadius:6,fontSize:13,marginBottom:12,
            background:exportMsg.startsWith('âœ“')?'rgba(16,185,129,0.12)':'rgba(239,68,68,0.12)',
            border:`1px solid ${exportMsg.startsWith('âœ“')?'#10b981':'#ef4444'}44`,
            color:exportMsg.startsWith('âœ“')?'#10b981':'#ef4444'}}>{exportMsg}</div>
        )}
        <div style={{padding:'12px 16px',borderRadius:8,background:'rgba(0,0,0,0.1)',border:'1px solid var(--card-border)'}}>
          <div style={{fontSize:12,color:'var(--text-main)',fontWeight:600,marginBottom:8}}>Report includes:</div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:5}}>
            {['âœ“ Attack timestamps & duration','âœ“ Attacker IP & geolocation','âœ“ MITRE ATT&CK mapping','âœ“ Response actions taken','âœ“ Devices affected & quarantined','âœ“ ML confidence scores','âœ“ Firewall rules applied','âœ“ Officer actions log'].map(item=>(
              <div key={item} style={{fontSize:11,color:'var(--text-dim)'}}>{item}</div>
            ))}
          </div>
        </div>
      </div>

    </div>
  );
}
