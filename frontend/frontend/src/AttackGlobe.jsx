// AttackGlobe.jsx â€” 3D Globe with world map outlines + click attacker = country popup
// Place in: src/AttackGlobe.jsx
import React, { useEffect, useMemo, useRef, useState } from 'react';

// â”€â”€ GeoIP lookup â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const KNOWN = {
  '45.33':   { lat:37.39,  lon:-122.08, city:'Mountain View', country:'United States',  code:'US', isp:'Linode LLC' },
  '103.21':  { lat:1.35,   lon:103.82,  city:'Singapore',     country:'Singapore',      code:'SG', isp:'Cloudflare' },
  '192.168': { lat:28.61,  lon:77.21,   city:'New Delhi',     country:'India',          code:'IN', isp:'Internal LAN' },
  '10.0':    { lat:55.76,  lon:37.62,   city:'Moscow',        country:'Russia',         code:'RU', isp:'Internal' },
  '45.':     { lat:39.90,  lon:116.41,  city:'Beijing',       country:'China',          code:'CN', isp:'ChinaNet' },
  '185.':    { lat:51.51,  lon:-0.13,   city:'London',        country:'United Kingdom', code:'GB', isp:'DigitalOcean' },
  '91.':     { lat:48.86,  lon:2.35,    city:'Paris',         country:'France',         code:'FR', isp:'OVH SAS' },
  '5.':      { lat:52.37,  lon:4.90,    city:'Amsterdam',     country:'Netherlands',    code:'NL', isp:'Serverius' },
  '196.':    { lat:-26.20, lon:28.04,   city:'Johannesburg',  country:'South Africa',   code:'ZA', isp:'Telkom SA' },
  '177.':    { lat:-23.55, lon:-46.63,  city:'SÃ£o Paulo',     country:'Brazil',         code:'BR', isp:'Claro' },
};
const HOME = { lat:13.08, lon:80.27, city:'Chennai', country:'India', code:'IN' };

function getGeo(ip) {
  if (!ip) return { lat:0,lon:0,city:'Unknown',country:'Unknown',code:'XX',isp:'?' };
  for (const [pfx, geo] of Object.entries(KNOWN)) {
    if (ip.startsWith(pfx)) return { ...geo };
  }
  let h = 0;
  for (const c of ip) h = Math.imul(31, h) + c.charCodeAt(0) | 0;
  return { lat:((Math.abs(h)%120)-60), lon:((Math.abs(h*7)%340)-170),
           city:ip, country:'Unknown', code:'XX', isp:'Unknown ISP' };
}

// â”€â”€ Sphere math â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
function ll2xyz(lat, lon, r) {
  const phi   = (90 - lat) * Math.PI / 180;
  const theta = (lon + 180) * Math.PI / 180;
  return [r*Math.sin(phi)*Math.cos(theta), r*Math.cos(phi), -r*Math.sin(phi)*Math.sin(theta)];
}
function project([x,y,z], ry, rx, cx, cy, fov=650) {
  const [coY,siY] = [Math.cos(ry),Math.sin(ry)];
  const x1 = x*coY + z*siY, z1 = -x*siY + z*coY;
  const [coX,siX] = [Math.cos(rx),Math.sin(rx)];
  const y1 = y*coX - z1*siX, z2 = y*siX + z1*coX;
  const s = fov/(fov+z2);
  return { px: cx+x1*s, py: cy+y1*s, z:z2, s };
}

// â”€â”€ World outline polylines [lat,lon][] â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const OUTLINES = [
  // North America
  [[71,-141],[70,-136],[68,-135],[66,-136],[64,-140],[62,-145],[60,-146],[58,-137],
   [56,-132],[54,-130],[52,-128],[50,-125],[48,-124],[46,-124],[44,-124],[42,-124],
   [40,-124],[38,-123],[36,-122],[34,-120],[32,-117],[30,-116],[28,-110],[26,-110],
   [24,-110],[22,-106],[20,-105],[18,-96],[16,-90],[14,-92],[12,-84],[10,-84],
   [8,-77],[8,-76],[10,-75],[12,-72],[14,-61],[16,-62],[18,-67],[20,-70],[22,-74],
   [24,-77],[26,-80],[28,-80],[30,-81],[32,-80],[34,-77],[36,-76],[38,-75],[40,-74],
   [42,-70],[44,-67],[46,-64],[48,-70],[50,-66],[52,-56],[54,-58],[56,-62],[58,-64],
   [60,-65],[62,-68],[64,-76],[66,-84],[68,-88],[70,-94],[72,-96],[74,-94],[76,-92],
   [78,-90],[80,-88],[82,-70],[80,-66],[78,-76],[76,-78],[74,-80],[72,-84],[70,-90],
   [68,-100],[66,-110],[64,-120],[62,-130],[60,-138],[62,-140],[64,-140],[66,-136],
   [68,-135],[70,-136],[71,-141]],
  // Greenland
  [[60,-44],[62,-42],[64,-40],[66,-38],[68,-30],[70,-24],[72,-22],[74,-20],[76,-18],
   [78,-18],[80,-20],[82,-26],[84,-30],[82,-36],[80,-40],[78,-44],[76,-50],[74,-56],
   [72,-58],[70,-54],[68,-52],[66,-48],[64,-46],[62,-44],[60,-44]],
  // South America
  [[10,-62],[8,-60],[6,-62],[4,-60],[2,-52],[0,-50],[-2,-50],[-4,-36],[-6,-35],
   [-8,-35],[-10,-37],[-12,-38],[-14,-39],[-16,-39],[-18,-40],[-20,-41],[-22,-42],
   [-24,-44],[-26,-48],[-28,-49],[-30,-50],[-32,-52],[-34,-54],[-36,-56],[-38,-57],
   [-40,-62],[-42,-65],[-44,-66],[-46,-66],[-48,-68],[-50,-70],[-52,-72],[-54,-68],
   [-56,-68],[-54,-64],[-52,-60],[-50,-58],[-48,-56],[-46,-54],[-44,-52],[-42,-52],
   [-40,-50],[-36,-52],[-30,-52],[-24,-44],[-18,-40],[-12,-36],[-6,-34],[-2,-42],
   [2,-52],[6,-60],[10,-62]],
  // UK
  [[50,-6],[52,-8],[54,-10],[56,-8],[58,-5],[60,-2],[58,0],[56,0],[54,-2],[52,-4],[50,-5],[50,-6]],
  // Ireland
  [[52,-10],[54,-10],[54,-8],[52,-6],[50,-8],[52,-10]],
  // Western Europe
  [[36,-9],[38,-9],[40,-8],[42,-9],[44,-8],[46,-2],[48,0],[50,2],[52,4],[54,8],
   [56,8],[58,5],[60,5],[62,6],[64,10],[66,14],[68,16],[70,24],[68,28],[66,26],
   [64,26],[62,24],[60,18],[58,12],[56,10],[54,10],[52,8],[50,8],[48,8],[46,8],
   [44,6],[42,4],[40,4],[38,2],[36,4],[36,0],[36,-2],[36,-6],[36,-9]],
  // Scandinavia
  [[56,8],[58,6],[60,6],[62,6],[64,10],[66,14],[68,18],[70,24],[72,26],[74,20],
   [72,16],[70,18],[68,16],[66,14],[64,10],[62,10],[60,10],[58,10],[56,8]],
  // Eastern Europe + W.Russia
  [[48,22],[50,24],[52,24],[54,22],[56,24],[58,28],[60,30],[62,30],[64,32],
   [66,30],[68,28],[70,32],[72,52],[70,58],[68,60],[66,60],[64,58],[62,56],
   [60,52],[58,50],[56,50],[54,48],[52,46],[50,44],[48,42],[46,40],[44,38],
   [42,42],[40,44],[38,48],[36,50],[34,52],[32,56],[30,60],[28,56],[26,52],
   [24,50],[22,44],[24,42],[26,40],[28,36],[30,32],[32,28],[34,24],[36,22],
   [38,22],[40,24],[42,24],[44,22],[46,22],[48,22]],
  // Russia Siberia
  [[70,32],[72,52],[74,68],[76,84],[74,96],[72,108],[70,122],[68,136],[66,140],
   [64,142],[62,140],[60,138],[58,140],[56,138],[54,136],[52,134],[50,140],
   [48,140],[46,136],[44,134],[42,132],[44,130],[46,128],[48,126],[50,124],
   [52,122],[54,120],[56,118],[58,116],[60,114],[62,112],[64,110],[66,108],
   [68,106],[70,108],[72,108],[74,96],[76,84],[74,68],[72,52],[70,32]],
  // Africa
  [[36,10],[34,12],[32,14],[30,16],[28,16],[26,14],[24,12],[22,14],[20,16],
   [18,14],[16,12],[14,16],[12,14],[10,12],[8,10],[6,8],[4,8],[2,8],[0,10],
   [-2,12],[-4,12],[-6,12],[-8,14],[-10,14],[-12,16],[-14,16],[-16,14],
   [-18,12],[-20,14],[-22,14],[-24,16],[-26,18],[-28,18],[-30,18],[-32,18],
   [-34,20],[-34,26],[-32,28],[-30,30],[-28,32],[-26,34],[-24,35],[-22,36],
   [-18,36],[-14,40],[-10,40],[-6,40],[-2,36],[2,40],[4,42],[6,44],[8,50],
   [10,50],[12,48],[14,46],[16,44],[18,42],[20,44],[22,46],[24,46],[26,48],
   [28,50],[30,50],[32,46],[34,40],[36,38],[36,36],[34,34],[32,30],[30,28],
   [28,26],[26,24],[24,22],[22,20],[20,18],[18,16],[16,14],[14,12],[12,10],
   [8,6],[4,2],[0,6],[36,10]],
  // Middle East / Arabia
  [[36,36],[34,36],[32,36],[30,34],[28,34],[26,36],[24,38],[22,40],[20,42],
   [18,42],[16,44],[14,44],[12,44],[14,48],[16,48],[18,52],[20,58],[22,58],
   [24,56],[26,54],[28,52],[30,48],[32,44],[34,40],[36,38],[36,36]],
  // Indian subcontinent
  [[24,68],[22,68],[20,72],[18,72],[16,74],[14,74],[12,76],[10,78],[8,78],
   [8,80],[10,80],[12,80],[14,80],[16,82],[18,84],[20,86],[22,88],[24,90],
   [26,90],[28,88],[30,82],[32,76],[34,72],[32,70],[30,68],[28,68],[26,68],[24,68]],
  // SE Asia
  [[22,100],[20,100],[18,102],[16,102],[14,100],[12,100],[10,98],[8,100],
   [6,102],[4,104],[2,104],[0,104],[-2,106],[-4,106],[-6,108],[-8,114],
   [-8,116],[-6,118],[-4,120],[-2,118],[0,116],[2,114],[4,116],[6,116],
   [8,114],[10,110],[12,108],[14,108],[16,106],[18,106],[20,104],[22,104],[22,100]],
  // China + Korea
  [[22,108],[24,108],[26,106],[28,104],[30,102],[32,100],[34,102],[36,104],
   [38,106],[40,108],[42,112],[44,118],[44,122],[42,124],[40,124],[38,122],
   [36,120],[34,120],[32,122],[30,122],[28,120],[26,118],[24,116],[22,114],
   [20,110],[22,108]],
  // Japan
  [[30,130],[32,130],[34,132],[36,136],[38,138],[40,141],[42,143],[44,145],
   [42,143],[40,141],[38,138],[36,136],[34,132],[32,130],[30,130]],
  // Australia
  [[-14,126],[-16,124],[-18,122],[-20,118],[-22,114],[-24,114],[-26,114],
   [-28,116],[-30,116],[-32,116],[-34,118],[-34,122],[-36,122],[-36,138],
   [-38,140],[-38,146],[-36,148],[-34,150],[-32,152],[-30,154],[-28,154],
   [-26,152],[-24,150],[-22,150],[-20,148],[-18,148],[-16,146],[-14,144],
   [-12,136],[-14,130],[-14,126]],
  // New Zealand
  [[-34,172],[-36,174],[-38,176],[-40,176],[-42,172],[-44,170],[-46,168],
   [-44,170],[-42,172],[-40,174],[-38,176],[-36,174],[-34,172]],
];

function flagEmoji(code) {
  if (!code || code==='XX') return 'ðŸŒ';
  return code.toUpperCase().replace(/./g, c => String.fromCodePoint(127397 + c.charCodeAt(0)));
}

// â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
export default function AttackGlobe({ alerts = [], isUnderAttack = false }) {
  const canvasRef  = useRef(null);
  const stateRef   = useRef({ ry:1.4, rx:-0.15, drag:false, lx:0, ly:0, spin:true });
  const attacksRef = useRef([]);

  const [popup,    setPopup]    = useState(null);  // { atk, x, y }
  const [selected, setSelected] = useState(null);

  const { attacks, stats } = useMemo(() => {
    const map = new Map();
    alerts
      .filter(a => a.severity==='CRITICAL' || a.severity==='HIGH')
      .forEach(a => {
        const ip  = a.source_ip || '45.1.1.1';
        const geo = getGeo(ip);
        if (!map.has(ip)) {
          map.set(ip, { ip, geo,
            severity:    a.severity,
            attack_type: a.attack_type || a.title || 'Unknown',
            mitre:       a.mitre_tag   || 'T0800',
            count:       1,
            phase:       ((ip.split('').reduce((sum, ch) => sum + ch.charCodeAt(0), 0) % 628) / 100),
          });
        } else { map.get(ip).count++; }
      });
    const list = [...map.values()];
    const countries = new Set(list.map(p => p.geo.code)).size;
    return {
      attacks: list,
      stats: {
        total:    alerts.filter(a=>a.severity==='CRITICAL'||a.severity==='HIGH').length,
        critical: alerts.filter(a=>a.severity==='CRITICAL').length,
        countries,
      },
    };
  }, [alerts]);

  useEffect(() => {
    attacksRef.current = attacks;
  }, [attacks]);

  // â”€â”€ Draw loop â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    let raf, t = 0;
    const R = 170, FOV = 650;

    function draw() {
      const s  = stateRef.current;
      const W  = canvas.width, H = canvas.height;
      const cx = W/2, cy = H/2;
      if (s.spin && !s.drag) s.ry += 0.004;
      t += 0.018;
      ctx.clearRect(0,0,W,H);

      // Background
      const bg = ctx.createRadialGradient(cx,cy,0,cx,cy,W*0.7);
      bg.addColorStop(0, isUnderAttack ? '#0d0205':'#020612');
      bg.addColorStop(1, '#000002');
      ctx.fillStyle=bg; ctx.fillRect(0,0,W,H);

      // Stars
      ctx.fillStyle='rgba(255,255,255,0.45)';
      for (let i=0;i<90;i++) {
        const sx=((i*137+t*1.5)%W), sy=((i*97+55)%H);
        ctx.fillRect(sx,sy,i%3===0?1.4:0.7,i%3===0?1.4:0.7);
      }

      // Atmosphere
      const atmo=ctx.createRadialGradient(cx,cy,R*0.9,cx,cy,R*1.4);
      atmo.addColorStop(0,'rgba(0,0,0,0)');
      atmo.addColorStop(0.6, isUnderAttack?'rgba(255,30,0,0.06)':'rgba(0,120,255,0.07)');
      atmo.addColorStop(1,   isUnderAttack?'rgba(255,0,0,0.2)' :'rgba(0,80,255,0.2)');
      ctx.beginPath(); ctx.arc(cx,cy,R*1.4,0,Math.PI*2);
      ctx.fillStyle=atmo; ctx.fill();

      // Ocean sphere
      const ocean=ctx.createRadialGradient(cx-R*0.3,cy-R*0.3,0,cx,cy,R);
      ocean.addColorStop(0,   isUnderAttack?'#1a0208':'#021830');
      ocean.addColorStop(0.7, isUnderAttack?'#0d0105':'#010e20');
      ocean.addColorStop(1,   '#000008');
      ctx.beginPath(); ctx.arc(cx,cy,R,0,Math.PI*2);
      ctx.fillStyle=ocean; ctx.fill();
      ctx.strokeStyle=isUnderAttack?'rgba(255,40,0,0.35)':'rgba(0,120,255,0.3)';
      ctx.lineWidth=1.2; ctx.stroke();

      // Grid
      ctx.save();
      ctx.strokeStyle=isUnderAttack?'rgba(255,60,0,0.07)':'rgba(0,180,255,0.07)';
      ctx.lineWidth=0.5;
      for (let lat=-60;lat<=60;lat+=30) {
        ctx.beginPath(); let first=true;
        for (let lon=-180;lon<=180;lon+=3) {
          const p=project(ll2xyz(lat,lon,R),s.ry,s.rx,cx,cy,FOV);
          if (p.z>-R*0.05){first?ctx.moveTo(p.px,p.py):ctx.lineTo(p.px,p.py);first=false;}
          else first=true;
        } ctx.stroke();
      }
      for (let lon=-180;lon<=180;lon+=30) {
        ctx.beginPath(); let first=true;
        for (let lat=-90;lat<=90;lat+=3) {
          const p=project(ll2xyz(lat,lon,R),s.ry,s.rx,cx,cy,FOV);
          if (p.z>-R*0.05){first?ctx.moveTo(p.px,p.py):ctx.lineTo(p.px,p.py);first=false;}
          else first=true;
        } ctx.stroke();
      }
      ctx.restore();

      // â”€â”€ World map outlines â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
      ctx.save();
      ctx.strokeStyle=isUnderAttack?'rgba(255,110,70,0.65)':'rgba(0,220,255,0.6)';
      ctx.lineWidth=1.0;
      ctx.shadowColor=isUnderAttack?'rgba(255,60,0,0.4)':'rgba(0,200,255,0.35)';
      ctx.shadowBlur=4;
      for (const poly of OUTLINES) {
        ctx.beginPath();
        let first=true;
        for (const [lat,lon] of poly) {
          const p=project(ll2xyz(lat,lon,R),s.ry,s.rx,cx,cy,FOV);
          if (p.z>0){first?ctx.moveTo(p.px,p.py):ctx.lineTo(p.px,p.py);first=false;}
          else first=true;
        }
        ctx.stroke();
      }
      ctx.shadowBlur=0; ctx.restore();

      // â”€â”€ Home (Chennai) â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
      {
        const p=project(ll2xyz(HOME.lat,HOME.lon,R),s.ry,s.rx,cx,cy,FOV);
        if (p.z>0) {
          for (let i=0;i<3;i++) {
            const pr=((t*1.8+i*1.2)%3.6)*9;
            ctx.beginPath();ctx.arc(p.px,p.py,pr,0,Math.PI*2);
            ctx.strokeStyle=`rgba(0,255,150,${Math.max(0,0.5-pr/35)})`;
            ctx.lineWidth=1.5;ctx.stroke();
          }
          ctx.beginPath();ctx.arc(p.px,p.py,6,0,Math.PI*2);
          ctx.fillStyle='#00ff96';ctx.shadowColor='#00ff96';ctx.shadowBlur=18;ctx.fill();ctx.shadowBlur=0;
          ctx.fillStyle='rgba(0,255,150,0.85)';ctx.font='bold 8px monospace';
          ctx.textAlign='center';ctx.fillText('ðŸ­ CHENNAI',p.px,p.py+18);
        }
      }

      // â”€â”€ Attacks: arcs + dots â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
      const atks=attacksRef.current;
      const selIP=selected?.ip;
      atks.forEach(atk => {
        const srcP=project(ll2xyz(atk.geo.lat,atk.geo.lon,R),s.ry,s.rx,cx,cy,FOV);
        const dstP=project(ll2xyz(HOME.lat,HOME.lon,R),s.ry,s.rx,cx,cy,FOV);
        const col=atk.severity==='CRITICAL'?'#ef4444':'#f97316';
        const isSel=selIP===atk.ip;

        if (srcP.z>-R*0.3 && dstP.z>-R*0.3) {
          const mx=(srcP.px+dstP.px)/2, my=(srcP.py+dstP.py)/2;
          const dx=dstP.px-srcP.px, dy=dstP.py-srcP.py;
          const cpx=mx-dy*0.45, cpy=my+dx*0.45;

          ctx.save();
          ctx.setLineDash([5,7]);
          ctx.lineDashOffset=-((t*10)%30);
          ctx.beginPath();
          ctx.moveTo(srcP.px,srcP.py);
          ctx.quadraticCurveTo(cpx,cpy,dstP.px,dstP.py);
          ctx.strokeStyle=col;
          ctx.lineWidth=isSel?2.5:1.4;
          ctx.globalAlpha=isSel?1:0.7;
          ctx.shadowColor=col;ctx.shadowBlur=isSel?10:4;
          ctx.stroke();
          ctx.setLineDash([]);ctx.globalAlpha=1;ctx.shadowBlur=0;ctx.restore();

          // moving packet
          const tPos=((t*0.5+atk.phase)%1);
          const bx=(1-tPos)**2*srcP.px+2*(1-tPos)*tPos*cpx+tPos**2*dstP.px;
          const by=(1-tPos)**2*srcP.py+2*(1-tPos)*tPos*cpy+tPos**2*dstP.py;
          ctx.beginPath();ctx.arc(bx,by,isSel?4:2.5,0,Math.PI*2);
          ctx.fillStyle=col;ctx.shadowColor=col;ctx.shadowBlur=12;ctx.fill();ctx.shadowBlur=0;
        }

        if (srcP.z>0) {
          const pr=((t*2.2+atk.phase)%3)*8;
          ctx.beginPath();ctx.arc(srcP.px,srcP.py,pr,0,Math.PI*2);
          const alpha=Math.max(0,0.6-pr/26);
          ctx.strokeStyle=`${col}${Math.floor(alpha*255).toString(16).padStart(2,'0')}`;
          ctx.lineWidth=isSel?2:1.5;ctx.stroke();

          const dotR=isSel?9:5+Math.min(atk.count,4);
          ctx.beginPath();ctx.arc(srcP.px,srcP.py,dotR,0,Math.PI*2);
          ctx.fillStyle=col;ctx.shadowColor=col;ctx.shadowBlur=isSel?24:14;ctx.fill();ctx.shadowBlur=0;

          // Label
          ctx.fillStyle='#fff';ctx.font=`bold ${isSel?9:8}px monospace`;
          ctx.textAlign='center';
          ctx.fillText(atk.geo.code,srcP.px,srcP.py-dotR-4);
          if (isSel) {
            ctx.fillStyle=col;ctx.font='8px monospace';
            ctx.fillText(atk.geo.city,srcP.px,srcP.py+dotR+12);
          }
        }
      });

      raf=requestAnimationFrame(draw);
    }
    draw();
    return ()=>cancelAnimationFrame(raf);
  }, [isUnderAttack, selected]);

  // â”€â”€ Mouse interactions â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
  useEffect(()=>{
    const canvas=canvasRef.current; if(!canvas) return;
    const s=stateRef.current;
    let moved=false;

    const onDown=e=>{s.drag=true;s.spin=false;s.lx=e.clientX;s.ly=e.clientY;moved=false;};
    const onMove=e=>{
      if(!s.drag)return;
      const dx=e.clientX-s.lx,dy=e.clientY-s.ly;
      if(Math.abs(dx)>2||Math.abs(dy)>2)moved=true;
      s.ry+=dx*0.005;s.rx+=dy*0.005;
      s.rx=Math.max(-1.3,Math.min(1.3,s.rx));
      s.lx=e.clientX;s.ly=e.clientY;
    };
    const onUp=e=>{
      s.drag=false;
      setTimeout(()=>{s.spin=true;},2500);
      if(!moved){
        const rect=canvas.getBoundingClientRect();
        const mx=(e.clientX-rect.left)*(canvas.width/rect.width);
        const my=(e.clientY-rect.top)*(canvas.height/rect.height);
        const W=canvas.width,H=canvas.height,cx=W/2,cy=H/2;
        const R=170,FOV=650;
        let hit=null,bestD=999;
        for (const atk of attacksRef.current) {
          const p=project(ll2xyz(atk.geo.lat,atk.geo.lon,R),s.ry,s.rx,cx,cy,FOV);
          if(p.z>0){const d=Math.hypot(p.px-mx,p.py-my);if(d<24&&d<bestD){bestD=d;hit=atk;}}
        }
        if(hit){
          setSelected(hit);
          // position popup near click, clamped inside canvas display area
          const rect2=canvas.getBoundingClientRect();
          const px=Math.min(e.clientX-rect2.left+12, rect2.width-250);
          const py=Math.min(e.clientY-rect2.top+12,  rect2.height-220);
          setPopup({atk:hit,x:px,y:py});
        } else {
          setSelected(null);setPopup(null);
        }
      }
    };

    canvas.addEventListener('mousedown',onDown);
    window.addEventListener('mousemove',onMove);
    window.addEventListener('mouseup',onUp);
    return()=>{
      canvas.removeEventListener('mousedown',onDown);
      window.removeEventListener('mousemove',onMove);
      window.removeEventListener('mouseup',onUp);
    };
  },[]);

  const accent=isUnderAttack?'#ef4444':'#00d2ff';

  return (
    <div style={{display:'flex',flexDirection:'column',gap:12}}>

      {/* Stats */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(4,1fr)',gap:10}}>
        {[
          {label:'TOTAL ATTACKS',    val:stats.total,       col:'#ef4444'},
          {label:'CRITICAL',         val:stats.critical,    col:'#dc2626'},
          {label:'SOURCE COUNTRIES', val:stats.countries,   col:'#f97316'},
          {label:'TARGET',           val:'PLC-01 Chennai',  col:'#00d2ff'},
        ].map(({label,val,col})=>(
          <div key={label} style={{padding:'10px 14px',borderRadius:8,
            background:`${col}11`,border:`1px solid ${col}33`}}>
            <div style={{color:'#6b7280',fontSize:9,letterSpacing:'1.5px',marginBottom:4}}>{label}</div>
            <div style={{color:col,fontSize:18,fontWeight:800,fontFamily:'monospace'}}>{val}</div>
          </div>
        ))}
      </div>

      {/* Globe + list */}
      <div style={{display:'grid',gridTemplateColumns:'1fr 270px',gap:12}}>

        {/* Globe canvas */}
        <div style={{borderRadius:12,background:'#000510',
          border:`1px solid ${accent}33`,overflow:'hidden',
          position:'relative',minHeight:400}}>

          <div style={{position:'absolute',top:10,left:12,zIndex:10,
            color:accent,fontSize:11,fontWeight:700,letterSpacing:'1.5px'}}>
            ðŸŒ GLOBAL THREAT MAP â€” LIVE
          </div>
          <div style={{position:'absolute',bottom:8,left:12,zIndex:10,
            color:'#374151',fontSize:9}}>
            DRAG TO ROTATE Â· CLICK RED DOT FOR COUNTRY INFO
          </div>

          {/* Legend */}
          <div style={{position:'absolute',bottom:8,right:10,zIndex:10,
            display:'flex',flexDirection:'column',gap:4}}>
            {[['#00ff96','ðŸ­ Our Factory (Chennai)'],
              ['#ef4444','CRITICAL Attack'],
              ['#f97316','HIGH Attack']].map(([col,lbl])=>(
              <div key={lbl} style={{display:'flex',alignItems:'center',gap:5}}>
                <div style={{width:7,height:7,borderRadius:'50%',background:col,
                  boxShadow:`0 0 6px ${col}`}}/>
                <span style={{color:'#6b7280',fontSize:9}}>{lbl}</span>
              </div>
            ))}
          </div>

          <canvas ref={canvasRef} width={700} height={440}
            style={{width:'100%',height:'100%',cursor:'grab',display:'block'}}/>

          {/* â”€â”€ Popup on click â”€â”€ */}
          {popup && (
            <div style={{
              position:'absolute',left:popup.x,top:popup.y,
              background:'rgba(2,6,22,0.97)',
              border:`2px solid ${popup.atk.severity==='CRITICAL'?'#ef4444':'#f97316'}`,
              borderRadius:12,padding:'16px',width:235,zIndex:30,
              boxShadow:`0 0 30px ${popup.atk.severity==='CRITICAL'?'#ef444460':'#f9731660'}`,
            }}>
              {/* Close btn */}
              <button onClick={()=>{setPopup(null);setSelected(null);}}
                style={{position:'absolute',top:8,right:10,background:'none',
                  border:'none',color:'#6b7280',fontSize:16,cursor:'pointer',lineHeight:1}}>
                âœ•
              </button>

              {/* Big flag + country */}
              <div style={{fontSize:36,lineHeight:1,marginBottom:6}}>
                {flagEmoji(popup.atk.geo.code)}
              </div>
              <div style={{color:'#fff',fontWeight:800,fontSize:18,marginBottom:2}}>
                {popup.atk.geo.country}
              </div>
              <div style={{color:'#94a3b8',fontSize:11,marginBottom:12,
                display:'flex',alignItems:'center',gap:5}}>
                <span>ðŸ“</span>
                <span>{popup.atk.geo.city}</span>
                <span style={{color:'#374151'}}>Â·</span>
                <span style={{fontFamily:'monospace',fontSize:10}}>
                  {popup.atk.geo.lat?.toFixed(1)}Â°, {popup.atk.geo.lon?.toFixed(1)}Â°
                </span>
              </div>

              {/* Details table */}
              <div style={{borderTop:'1px solid rgba(255,255,255,0.07)',paddingTop:10}}>
                {[
                  ['IP Address',  popup.atk.ip,                                 'monospace'],
                  ['ISP / Org',   popup.atk.geo.isp,                            'inherit'],
                  ['Attack Type', popup.atk.attack_type?.substring(0,28),       'inherit'],
                  ['MITRE',       popup.atk.mitre,                              'monospace'],
                  ['Severity',    popup.atk.severity,                           'inherit'],
                  ['Hits',        `${popup.atk.count} packet${popup.atk.count>1?'s':''}`, 'monospace'],
                ].map(([k,v,ff])=>(
                  <div key={k} style={{display:'flex',justifyContent:'space-between',
                    alignItems:'center',marginBottom:6}}>
                    <span style={{color:'#475569',fontSize:10,minWidth:72}}>{k}</span>
                    <span style={{
                      color: k==='Severity'
                        ? (v==='CRITICAL'?'#ef4444':'#f97316')
                        : k==='MITRE' ? '#8b5cf6'
                        : k==='IP Address' ? '#00d2ff'
                        : '#e2e8f0',
                      fontSize:10,fontWeight:600,fontFamily:ff,
                      textAlign:'right',maxWidth:140,wordBreak:'break-all'}}>
                      {v}
                    </span>
                  </div>
                ))}
              </div>

              {/* Target banner */}
              <div style={{marginTop:10,padding:'7px 10px',borderRadius:6,
                background:'rgba(239,68,68,0.1)',border:'1px solid rgba(239,68,68,0.25)',
                color:'#fca5a5',fontSize:10,textAlign:'center',letterSpacing:'0.5px'}}>
                âš¡ ATTACKING â†’ PLC-01 Â· Chennai Factory
              </div>
            </div>
          )}

          {attacks.length===0 && (
            <div style={{position:'absolute',top:'50%',left:'50%',
              transform:'translate(-50%,-50%)',textAlign:'center',pointerEvents:'none'}}>
              <div style={{color:'#1f2937',fontSize:13,fontWeight:700}}>â— NO ACTIVE THREATS</div>
              <div style={{color:'#111827',fontSize:10,marginTop:4}}>Globe populates on attack detection</div>
            </div>
          )}
        </div>

        {/* Attack list sidebar */}
        <div style={{borderRadius:12,background:'#050a14',
          border:'1px solid rgba(255,255,255,0.06)',
          display:'flex',flexDirection:'column',overflow:'hidden'}}>
          <div style={{padding:'10px 14px',
            borderBottom:'1px solid rgba(255,255,255,0.05)',
            background:'rgba(239,68,68,0.06)',
            color:'#ef4444',fontSize:11,fontWeight:700,letterSpacing:'1px'}}>
            ðŸš¨ ATTACK SOURCES â€” {attacks.length} IPs
          </div>
          <div style={{flex:1,overflowY:'auto',padding:8}}>
            {attacks.length===0 ? (
              <div style={{color:'#374151',fontSize:11,textAlign:'center',padding:'30px 0'}}>
                No attack sources detected
              </div>
            ) : attacks.map(atk=>{
              const isSel=selected?.ip===atk.ip;
              const col=atk.severity==='CRITICAL'?'#ef4444':'#f97316';
              return (
                <div key={atk.ip}
                  onClick={()=>{
                    if(isSel){setSelected(null);setPopup(null);}
                    else{setSelected(atk);setPopup({atk,x:10,y:10});}
                  }}
                  style={{padding:'10px 12px',marginBottom:6,borderRadius:8,cursor:'pointer',
                    border:`1px solid ${isSel?col:col+'44'}`,
                    background:isSel?`${col}18`:'rgba(255,255,255,0.02)',
                    transition:'all 0.15s'}}>
                  <div style={{display:'flex',justifyContent:'space-between',marginBottom:5}}>
                    <div style={{display:'flex',alignItems:'center',gap:6}}>
                      <div style={{width:7,height:7,borderRadius:'50%',background:col,
                        boxShadow:`0 0 6px ${col}`,
                        animation:'pulse_dot 1.2s infinite'}}/>
                      <span style={{color:col,fontFamily:'monospace',fontSize:11,fontWeight:700}}>
                        {atk.ip}
                      </span>
                    </div>
                    <span style={{background:`${col}22`,color:col,
                      fontSize:9,fontWeight:800,padding:'1px 6px',borderRadius:4,letterSpacing:'0.5px'}}>
                      {atk.severity}
                    </span>
                  </div>

                  {/* Country */}
                  <div style={{display:'flex',alignItems:'center',gap:6,marginBottom:5}}>
                    <span style={{fontSize:16}}>{flagEmoji(atk.geo.code)}</span>
                    <div>
                      <div style={{color:'#e2e8f0',fontSize:11,fontWeight:700,lineHeight:1.2}}>
                        {atk.geo.country}
                      </div>
                      <div style={{color:'#475569',fontSize:10}}>{atk.geo.city}</div>
                    </div>
                  </div>

                  <div style={{display:'flex',gap:5,flexWrap:'wrap',marginBottom:4}}>
                    <span style={{background:'rgba(139,92,246,0.15)',color:'#8b5cf6',
                      fontSize:9,padding:'1px 6px',borderRadius:4}}>{atk.mitre}</span>
                    <span style={{color:'#475569',fontSize:9}}>
                      {atk.attack_type?.substring(0,22)}
                    </span>
                  </div>

                  {atk.count>1&&(
                    <div style={{color:col,fontSize:9,fontWeight:700}}>
                      Ã—{atk.count} hits detected
                    </div>
                  )}
                  <div style={{color:'#1f2937',fontSize:9,marginTop:3}}>
                    {isSel?'â— Selected on globe':'Click to highlight'}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      <style>{`
        @keyframes pulse_dot {
          0%,100%{opacity:1;transform:scale(1);}
          50%{opacity:0.6;transform:scale(1.4);}
        }
      `}</style>
    </div>
  );
}

