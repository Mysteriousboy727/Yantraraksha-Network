// src/ThreatMap.jsx
import React, { useEffect, useRef, useState, useMemo } from 'react';

// ── Attacker IP → geo coordinates ────────────────────────────────────────
const IP_GEO = {
  "45.33.32.156":  { lat: 37.77,  lon: -122.41, country: "USA",     city: "San Francisco", region: "North America" },
  "192.168.1.99":  { lat: 55.75,  lon:   37.61, country: "Russia",  city: "Moscow",        region: "Europe"        },
  "10.10.10.55":   { lat: 39.90,  lon:  116.40, country: "China",   city: "Beijing",       region: "Asia"          },
  "77.88.55.22":   { lat: 52.52,  lon:   13.40, country: "Germany", city: "Berlin",        region: "Europe"        },
  "185.220.101.1": { lat: 51.50,  lon:   -0.12, country: "UK",      city: "London",        region: "Europe"        },
  "103.21.244.0":  { lat: 28.61,  lon:   77.20, country: "India",   city: "New Delhi",     region: "Asia"          },
  "41.223.57.100": { lat: -1.29,  lon:   36.82, country: "Kenya",   city: "Nairobi",       region: "Africa"        },
  "200.185.0.1":   { lat: -23.55, lon:  -46.63, country: "Brazil",  city: "São Paulo",     region: "South America" },
  "SENTINEL-AI":   null,
  "OFFICER":       null,
};

// ── Your ICS factory target ───────────────────────────────────────────────
const TARGET = { lat: 13.08, lon: 80.27, label: "ICS Factory" };

// ── Mercator projection ───────────────────────────────────────────────────
function mercator(lat, lon, W, H) {
  const x = ((lon + 180) / 360) * W;
  const r = (lat * Math.PI) / 180;
  const m = Math.log(Math.tan(Math.PI / 4 + r / 2));
  const y = H / 2 - (W * m) / (2 * Math.PI);
  return { x, y };
}

// ── Detailed continent polygons (lat/lon pairs) ───────────────────────────
const CONTINENTS = [
  // North America
  [[83,-65],[75,-90],[70,-140],[60,-138],[55,-130],[49,-125],[32,-117],[20,-105],[15,-90],[10,-84],[8,-77],[10,-75],[20,-87],[22,-98],[25,-97],[30,-96],[33,-94],[37,-76],[42,-70],[47,-53],[52,-56],[60,-64],[70,-62],[75,-73],[80,-68],[83,-65]],
  // South America
  [[10,-75],[2,-77],[0,-80],[-5,-81],[-15,-75],[-18,-70],[-22,-68],[-28,-70],[-33,-71],[-42,-73],[-55,-68],[-55,-64],[-52,-58],[-45,-63],[-35,-57],[-28,-48],[-20,-40],[-10,-35],[-5,-35],[0,-50],[5,-60],[8,-62],[10,-62],[10,-75]],
  // Europe
  [[71,28],[65,14],[60,5],[52,4],[48,2],[44,8],[41,12],[38,15],[37,22],[40,28],[44,34],[46,30],[50,30],[55,21],[58,25],[62,26],[66,26],[71,28]],
  // Africa
  [[38,10],[37,37],[35,42],[12,44],[5,41],[-5,40],[-15,35],[-25,33],[-35,18],[-35,26],[-28,32],[-20,44],[-10,40],[0,42],[5,42],[12,44],[15,40],[22,38],[30,32],[35,37],[38,10]],
  // Asia (simplified)
  [[72,28],[70,50],[68,68],[60,70],[55,68],[52,58],[45,42],[40,44],[36,36],[30,34],[22,38],[12,44],[5,41],[0,42],[10,44],[22,56],[28,68],[25,82],[20,92],[12,100],[5,100],[0,105],[5,100],[10,110],[20,110],[30,120],[38,122],[42,130],[48,135],[52,142],[55,135],[60,140],[65,142],[70,140],[72,130],[70,100],[72,80],[72,60],[72,28]],
  // Australia
  [[-17,122],[-20,114],[-28,114],[-35,117],[-38,145],[-38,147],[-32,153],[-25,153],[-22,150],[-15,136],[-12,136],[-12,130],[-17,122]],
  // Greenland
  [[83,-45],[76,-18],[70,-22],[68,-32],[70,-52],[76,-68],[82,-52],[83,-45]],
  // Japan (simplified)
  [[45,142],[40,140],[34,136],[31,131],[34,130],[38,141],[42,143],[45,142]],
  // UK
  [[58,-3],[55,-6],[51,-5],[51,1],[54,0],[58,-3]],
  // Indonesia (simplified)
  [[-8,115],[-5,105],[0,104],[2,108],[0,117],[-5,120],[-8,115]],
];

export default function ThreatMap({ alerts, blockedIPs = {} }) {
  const canvasRef   = useRef(null);
  const rafRef      = useRef(null);
  const timeRef     = useRef(0);

  // Build unique attackers from alerts
  const attackers = useMemo(() => {
    const map = {};
    (alerts || []).forEach(a => {
      const geo = IP_GEO[a.source_ip];
      if (!geo) return;
      const ip = a.source_ip;
      if (!map[ip]) map[ip] = { ip, geo, count: 0, blocked: !!blockedIPs[ip], lastSeen: a.timestamp };
      map[ip].count++;
      map[ip].blocked = !!blockedIPs[ip];
    });
    return Object.values(map);
  }, [alerts, blockedIPs]);

  const topAttackers = useMemo(() =>
    [...attackers].sort((a,b) => b.count - a.count).slice(0,8),
  [attackers]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx  = canvas.getContext('2d');
    const W    = canvas.width;
    const H    = canvas.height;

    function drawMap(t) {
      // ── Ocean ──────────────────────────────────────────────
      ctx.fillStyle = '#0d1b2e';
      ctx.fillRect(0, 0, W, H);

      // ── Grid lines ─────────────────────────────────────────
      ctx.strokeStyle = 'rgba(255,255,255,0.04)';
      ctx.lineWidth   = 0.5;
      for (let lon = -180; lon <= 180; lon += 30) {
        const p = mercator(0, lon, W, H);
        ctx.beginPath(); ctx.moveTo(p.x, 0); ctx.lineTo(p.x, H); ctx.stroke();
      }
      for (let lat = -60; lat <= 80; lat += 30) {
        const p = mercator(lat, 0, W, H);
        ctx.beginPath(); ctx.moveTo(0, p.y); ctx.lineTo(W, p.y); ctx.stroke();
      }

      // ── Continents ─────────────────────────────────────────
      CONTINENTS.forEach(pts => {
        const proj = pts.map(([la, lo]) => mercator(la, lo, W, H));
        ctx.beginPath();
        ctx.moveTo(proj[0].x, proj[0].y);
        proj.slice(1).forEach(p => ctx.lineTo(p.x, p.y));
        ctx.closePath();
        ctx.fillStyle   = '#1e2d45';
        ctx.strokeStyle = 'rgba(100,160,220,0.18)';
        ctx.lineWidth   = 0.7;
        ctx.fill();
        ctx.stroke();
      });

      // ── Target heatmap glow (blue circle like Kibana) ──────
      const tgt = mercator(TARGET.lat, TARGET.lon, W, H);
      const pulse = 0.85 + 0.15 * Math.sin(t * 2.5);
      const glowR = 55 * pulse;
      const grd   = ctx.createRadialGradient(tgt.x, tgt.y, 0, tgt.x, tgt.y, glowR);
      grd.addColorStop(0,   'rgba(0,180,255,0.45)');
      grd.addColorStop(0.4, 'rgba(0,120,255,0.20)');
      grd.addColorStop(1,   'rgba(0,80,255,0.00)');
      ctx.beginPath();
      ctx.arc(tgt.x, tgt.y, glowR, 0, Math.PI * 2);
      ctx.fillStyle = grd;
      ctx.fill();

      // ── Pulse rings on target ──────────────────────────────
      for (let ring = 0; ring < 3; ring++) {
        const phase = ((t * 0.8 + ring * 0.5) % 2) / 2;
        const r     = 10 + phase * 45;
        const alpha = (1 - phase) * 0.6;
        ctx.beginPath();
        ctx.arc(tgt.x, tgt.y, r, 0, Math.PI * 2);
        ctx.strokeStyle = `rgba(0,200,255,${alpha})`;
        ctx.lineWidth   = 1.5;
        ctx.stroke();
      }

      // ── Target center dot ──────────────────────────────────
      ctx.beginPath();
      ctx.arc(tgt.x, tgt.y, 6, 0, Math.PI * 2);
      ctx.fillStyle   = '#00d2ff';
      ctx.shadowColor = '#00d2ff';
      ctx.shadowBlur  = 20;
      ctx.fill();
      ctx.shadowBlur  = 0;

      // ── Attacker dots with heatmap glow + pulse rings ──────
      attackers.forEach(atk => {
        const src     = mercator(atk.geo.lat, atk.geo.lon, W, H);
        const blocked = atk.blocked;
        const color   = blocked ? '#ef4444' : '#ff4466';
        const glow    = blocked ? '#ef4444' : '#ff2255';

        // Heatmap glow behind dot
        const hotR = (20 + atk.count * 10) * (0.9 + 0.1 * Math.sin(t * 1.8));
        const hotG = ctx.createRadialGradient(src.x, src.y, 0, src.x, src.y, hotR);
        hotG.addColorStop(0,   blocked ? 'rgba(239,68,68,0.45)' : 'rgba(255,50,80,0.40)');
        hotG.addColorStop(0.5, blocked ? 'rgba(239,68,68,0.15)' : 'rgba(255,30,60,0.12)');
        hotG.addColorStop(1,   'rgba(0,0,0,0)');
        ctx.beginPath();
        ctx.arc(src.x, src.y, hotR, 0, Math.PI * 2);
        ctx.fillStyle = hotG;
        ctx.fill();

        // Pulse rings
        for (let ring = 0; ring < 2; ring++) {
          const phase = ((t * 1.2 + ring * 0.6 + atk.count * 0.3) % 2) / 2;
          const r     = 6 + phase * 22;
          const alpha = (1 - phase) * 0.7;
          ctx.beginPath();
          ctx.arc(src.x, src.y, r, 0, Math.PI * 2);
          ctx.strokeStyle = `${color}${Math.floor(alpha * 255).toString(16).padStart(2,'0')}`;
          ctx.lineWidth   = 1;
          ctx.stroke();
        }

        // Center dot
        ctx.beginPath();
        ctx.arc(src.x, src.y, 5, 0, Math.PI * 2);
        ctx.fillStyle   = color;
        ctx.shadowColor = glow;
        ctx.shadowBlur  = 15;
        ctx.fill();
        ctx.shadowBlur  = 0;

        // White ring around dot
        ctx.beginPath();
        ctx.arc(src.x, src.y, 6, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(255,255,255,0.6)';
        ctx.lineWidth   = 1;
        ctx.stroke();

        // Country label above dot
        ctx.font        = 'bold 9px Inter, sans-serif';
        ctx.fillStyle   = blocked ? '#ff6666' : '#ffaaaa';
        ctx.textAlign   = 'center';
        ctx.textBaseline= 'bottom';
        ctx.fillText(atk.geo.country, src.x, src.y - 9);
      });

      // ── Arc lines: attacker → target ───────────────────────
      attackers.forEach((atk, idx) => {
        const src  = mercator(atk.geo.lat, atk.geo.lon, W, H);
        const arcT = ((t * 0.4 + idx * 0.25) % 1);

        // Control point for curve
        const mx   = (src.x + tgt.x) / 2;
        const my   = (src.y + tgt.y) / 2 - Math.hypot(tgt.x - src.x, tgt.y - src.y) * 0.3;

        // Draw dashed arc path
        const steps  = 80;
        const drawTo = Math.floor(arcT * steps);
        for (let i = Math.max(0, drawTo - 25); i < Math.min(drawTo, steps); i++) {
          const t0   = i / steps, t1 = (i+1) / steps;
          const fade = (i - (drawTo - 25)) / 25;
          const bx0  = (1-t0)*(1-t0)*src.x + 2*(1-t0)*t0*mx + t0*t0*tgt.x;
          const by0  = (1-t0)*(1-t0)*src.y + 2*(1-t0)*t0*my + t0*t0*tgt.y;
          const bx1  = (1-t1)*(1-t1)*src.x + 2*(1-t1)*t1*mx + t1*t1*tgt.x;
          const by1  = (1-t1)*(1-t1)*src.y + 2*(1-t1)*t1*my + t1*t1*tgt.y;
          ctx.beginPath();
          ctx.moveTo(bx0, by0); ctx.lineTo(bx1, by1);
          ctx.strokeStyle = atk.blocked
            ? `rgba(239,68,68,${fade * 0.85})`
            : `rgba(255,80,120,${fade * 0.70})`;
          ctx.lineWidth   = 1.5;
          ctx.shadowColor = atk.blocked ? '#ef4444' : '#ff4466';
          ctx.shadowBlur  = 5;
          ctx.stroke();
          ctx.shadowBlur  = 0;
        }

        // Leading dot on arc
        if (drawTo > 0 && drawTo <= steps) {
          const headT = Math.min(drawTo, steps) / steps;
          const hx    = (1-headT)*(1-headT)*src.x + 2*(1-headT)*headT*mx + headT*headT*tgt.x;
          const hy    = (1-headT)*(1-headT)*src.y + 2*(1-headT)*headT*my + headT*headT*tgt.y;
          ctx.beginPath();
          ctx.arc(hx, hy, 3, 0, Math.PI * 2);
          ctx.fillStyle   = atk.blocked ? '#ef4444' : '#ff6688';
          ctx.shadowColor = atk.blocked ? '#ef4444' : '#ff4466';
          ctx.shadowBlur  = 10;
          ctx.fill();
          ctx.shadowBlur  = 0;
        }
      });

      // ── Target label ───────────────────────────────────────
      ctx.font        = 'bold 10px Inter, sans-serif';
      ctx.fillStyle   = '#00d2ff';
      ctx.textAlign   = 'center';
      ctx.textBaseline= 'bottom';
      ctx.fillText(TARGET.label, tgt.x, tgt.y - 12);

      // ── No-attack placeholder ──────────────────────────────
      if (attackers.length === 0) {
        ctx.font        = '13px Inter, sans-serif';
        ctx.fillStyle   = 'rgba(100,150,200,0.4)';
        ctx.textAlign   = 'center';
        ctx.textBaseline= 'middle';
        ctx.fillText('No active threats — system secure', W/2, H/2 + 40);
      }
    }

    function frame() {
      rafRef.current = requestAnimationFrame(frame);
      timeRef.current += 0.016;
      drawMap(timeRef.current);
    }
    frame();
    return () => cancelAnimationFrame(rafRef.current);
  }, [attackers]);

  // ── Impact color ─────────────────────────────────────────────────────────
  const impactColor = (count) =>
    count >= 3 ? '#ef4444' : count >= 2 ? '#f97316' : '#f59e0b';

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:0, borderRadius:10, overflow:'hidden', border:'1px solid rgba(100,160,220,0.15)' }}>

      {/* ── MAP CANVAS ── */}
      <div style={{ position:'relative' }}>
        <canvas
          ref={canvasRef}
          width={880}
          height={440}
          style={{ width:'100%', height:'auto', display:'block' }}
        />

        {/* Live badge */}
        <div style={{ position:'absolute', top:10, left:12, display:'flex', alignItems:'center', gap:6, background:'rgba(0,0,0,0.55)', borderRadius:6, padding:'4px 10px', backdropFilter:'blur(4px)' }}>
          <span style={{ width:7, height:7, borderRadius:'50%', background:'#ef4444', display:'inline-block', boxShadow:'0 0 8px #ef4444' }}/>
          <span style={{ color:'#e2e8f0', fontSize:11, fontWeight:700, letterSpacing:0.5 }}>LIVE THREAT MAP</span>
        </div>

        {/* Legend */}
        <div style={{ position:'absolute', bottom:10, right:12, display:'flex', flexDirection:'column', gap:5, background:'rgba(0,0,0,0.55)', borderRadius:8, padding:'8px 12px', backdropFilter:'blur(4px)' }}>
          {[['#ff4466','Active Attack'],['#ef4444','Blocked IP'],['#00d2ff','ICS Target']].map(([c,l])=>(
            <div key={l} style={{ display:'flex', alignItems:'center', gap:6 }}>
              <span style={{ width:8, height:8, borderRadius:'50%', background:c, display:'inline-block', boxShadow:`0 0 6px ${c}` }}/>
              <span style={{ color:'#9ca3af', fontSize:10 }}>{l}</span>
            </div>
          ))}
        </div>

        {/* Attack count badge */}
        {attackers.length > 0 && (
          <div style={{ position:'absolute', top:10, right:12, background:'rgba(239,68,68,0.15)', border:'1px solid rgba(239,68,68,0.4)', borderRadius:6, padding:'4px 12px' }}>
            <span style={{ color:'#ef4444', fontSize:12, fontWeight:800 }}>{attackers.length} ACTIVE SOURCE{attackers.length>1?'S':''}</span>
          </div>
        )}
      </div>

      {/* ── TOP ATTACKERS TABLE ── */}
      <div style={{ background:'rgba(5,12,25,0.9)', borderTop:'1px solid rgba(100,160,220,0.1)' }}>
        <div style={{ padding:'10px 16px', display:'flex', justifyContent:'space-between', alignItems:'center', borderBottom:'1px solid rgba(255,255,255,0.05)' }}>
          <span style={{ color:'#e2e8f0', fontWeight:700, fontSize:13 }}>Top Attacker IPs</span>
          <div style={{ display:'flex', gap:16, fontSize:11 }}>
            <span style={{ color:'#6b7280' }}>{attackers.filter(a=>!a.blocked).length} active</span>
            <span style={{ color:'#ef4444' }}>{attackers.filter(a=>a.blocked).length} blocked</span>
          </div>
        </div>

        <table style={{ width:'100%', borderCollapse:'collapse' }}>
          <thead>
            <tr style={{ background:'rgba(255,255,255,0.02)' }}>
              {['Impact','IP Address','Country','City','Region','Last Seen','Status'].map(h=>(
                <th key={h} style={{ padding:'7px 14px', textAlign:'left', fontSize:10, color:'#4b5563', fontWeight:600, textTransform:'uppercase', letterSpacing:0.5, borderBottom:'1px solid rgba(255,255,255,0.04)' }}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {topAttackers.length === 0 ? (
              <tr><td colSpan={7} style={{ padding:'20px', textAlign:'center', color:'#374151', fontSize:12 }}>No attackers detected — system secure</td></tr>
            ) : topAttackers.map((atk, i) => (
              <tr key={i} style={{ borderBottom:'1px solid rgba(255,255,255,0.025)', background: atk.blocked ? 'rgba(239,68,68,0.04)' : i%2===0 ? 'rgba(255,255,255,0.01)' : 'transparent', transition:'background 0.2s' }}>
                <td style={{ padding:'8px 14px' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                    <div style={{ width:3, height:28, borderRadius:2, background: impactColor(atk.count) }}/>
                    <span style={{ background:`${impactColor(atk.count)}22`, color:impactColor(atk.count), border:`1px solid ${impactColor(atk.count)}44`, borderRadius:4, padding:'2px 7px', fontSize:10, fontWeight:700 }}>
                      {atk.count >= 3 ? 'HIGH' : atk.count >= 2 ? 'MED' : 'LOW'}
                    </span>
                  </div>
                </td>
                <td style={{ padding:'8px 14px', fontFamily:'monospace', fontSize:12, color: atk.blocked ? '#ef4444' : '#e2e8f0', fontWeight: atk.blocked ? 700 : 400 }}>
                  {atk.blocked && <span style={{ marginRight:5 }}>🚫</span>}{atk.ip}
                </td>
                <td style={{ padding:'8px 14px', fontSize:12, color:'#9ca3af' }}>
                  <div style={{ display:'flex', alignItems:'center', gap:6 }}>
                    <span style={{ width:7, height:7, borderRadius:'50%', display:'inline-block', background: atk.blocked ? '#ef4444' : '#ff4466', boxShadow:`0 0 5px ${atk.blocked ? '#ef4444' : '#ff4466'}` }}/>
                    {atk.geo.country}
                  </div>
                </td>
                <td style={{ padding:'8px 14px', fontSize:12, color:'#6b7280' }}>{atk.geo.city}</td>
                <td style={{ padding:'8px 14px', fontSize:12, color:'#6b7280' }}>{atk.geo.region}</td>
                <td style={{ padding:'8px 14px', fontSize:11, color:'#4b5563', fontFamily:'monospace' }}>
                  {new Date(atk.lastSeen).toLocaleTimeString([],{hour:'2-digit',minute:'2-digit',second:'2-digit'})}
                </td>
                <td style={{ padding:'8px 14px' }}>
                  <span style={{ fontSize:10, fontWeight:700, padding:'3px 9px', borderRadius:4, background: atk.blocked ? 'rgba(239,68,68,0.15)' : 'rgba(255,70,100,0.12)', color: atk.blocked ? '#ef4444' : '#ff6688', border:`1px solid ${atk.blocked ? '#ef444430' : '#ff446830'}` }}>
                    {atk.blocked ? '🔒 BLOCKED' : '⚡ ACTIVE'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}