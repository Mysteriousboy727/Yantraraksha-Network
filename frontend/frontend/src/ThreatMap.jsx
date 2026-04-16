import React, { useEffect, useMemo, useRef, useState } from 'react';

const HOME = { lat: 13.08, lon: 80.27, label: 'ICS Factory' };

const KNOWN = {
  '45.33':   { lat: 37.39, lon: -122.08, country: 'USA', city: 'Mountain View' },
  '103.21':  { lat: 1.35, lon: 103.82, country: 'Singapore', city: 'Singapore' },
  '192.168': { lat: 28.61, lon: 77.21, country: 'India', city: 'New Delhi' },
  '10.0':    { lat: 55.76, lon: 37.62, country: 'Russia', city: 'Moscow' },
  '45.':     { lat: 39.9, lon: 116.41, country: 'China', city: 'Beijing' },
  '185.':    { lat: 51.51, lon: -0.13, country: 'UK', city: 'London' },
  '91.':     { lat: 48.86, lon: 2.35, country: 'France', city: 'Paris' },
  '5.':      { lat: 52.37, lon: 4.9, country: 'Netherlands', city: 'Amsterdam' },
  '196.':    { lat: -26.2, lon: 28.04, country: 'South Africa', city: 'Johannesburg' },
  '177.':    { lat: -23.55, lon: -46.63, country: 'Brazil', city: 'Sao Paulo' },
};

const TILE_CONFIG = {
  dark: {
    url: 'https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    background: '#020d1c',
    overlay: 'linear-gradient(180deg, rgba(2,13,28,0.95) 0%, transparent 100%)',
    text: '#e2e8f0',
    accent: '#00d2ff',
    zoomBg: 'rgba(5,10,20,0.92)',
    zoomBorder: 'rgba(0,210,255,0.25)',
    zoomHover: 'rgba(0,210,255,0.15)',
    attributionBg: 'rgba(2,6,16,0.7)',
    popupBg: 'rgba(4,10,24,0.97)',
    popupBorder: 'rgba(0,210,255,0.25)',
    popupText: '#e2e8f0',
    legendBg: 'rgba(2,8,22,0.88)',
    legendBorder: 'rgba(255,255,255,0.08)',
    legendText: '#9ca3af',
    blockedBg: 'rgba(249,115,22,0.12)',
    blockedBorder: 'rgba(249,115,22,0.4)',
    countryLabel: '#ffffff',
    countryShadow: '#000000',
  },
  light: {
    url: 'https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png',
    background: '#eef4fb',
    overlay: 'linear-gradient(180deg, rgba(255,255,255,0.96) 0%, rgba(255,255,255,0.14) 100%)',
    text: '#0f172a',
    accent: '#0284c7',
    zoomBg: 'rgba(255,255,255,0.95)',
    zoomBorder: 'rgba(2,132,199,0.25)',
    zoomHover: 'rgba(2,132,199,0.12)',
    attributionBg: 'rgba(255,255,255,0.78)',
    popupBg: 'rgba(255,255,255,0.98)',
    popupBorder: 'rgba(148,163,184,0.35)',
    popupText: '#0f172a',
    legendBg: 'rgba(255,255,255,0.9)',
    legendBorder: 'rgba(148,163,184,0.28)',
    legendText: '#475569',
    blockedBg: 'rgba(249,115,22,0.14)',
    blockedBorder: 'rgba(249,115,22,0.35)',
    countryLabel: '#0f172a',
    countryShadow: '#ffffff',
  },
};

function getGeo(ip) {
  if (!ip) return { lat: 20, lon: 0, country: 'Unknown', city: 'Unknown' };
  for (const [pfx, geo] of Object.entries(KNOWN)) {
    if (ip.startsWith(pfx)) return { ...geo };
  }
  let h = 0;
  for (const c of ip) h = (Math.imul(31, h) + c.charCodeAt(0)) | 0;
  return {
    lat: (Math.abs(h) % 100) - 50,
    lon: (Math.abs(h * 7) % 300) - 150,
    country: 'Unknown',
    city: ip,
  };
}

function useLeaflet() {
  const [ready, setReady] = useState(!!window.L);

  useEffect(() => {
    if (!document.getElementById('lf-css')) {
      const link = document.createElement('link');
      link.id = 'lf-css';
      link.rel = 'stylesheet';
      link.href = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css';
      document.head.appendChild(link);
    }

    if (window.L) {
      return;
    }

    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js';
    script.onload = () => setReady(true);
    document.head.appendChild(script);
  }, []);

  return ready;
}

function ensureStyles(palette) {
  let style = document.getElementById('tm-style');
  if (!style) {
    style = document.createElement('style');
    style.id = 'tm-style';
    document.head.appendChild(style);
  }

  style.textContent = `
    .leaflet-control-zoom a {
      background: ${palette.zoomBg} !important;
      color: ${palette.accent} !important;
      border-color: ${palette.zoomBorder} !important;
      font-weight: 800 !important;
    }
    .leaflet-control-zoom a:hover {
      background: ${palette.zoomHover} !important;
    }
    .leaflet-control-attribution {
      background: ${palette.attributionBg} !important;
    }
    .leaflet-popup-content-wrapper {
      background: ${palette.popupBg} !important;
      border: 1px solid ${palette.popupBorder} !important;
      border-radius: 10px !important;
      box-shadow: 0 8px 32px rgba(15,23,42,0.18) !important;
      color: ${palette.popupText} !important;
    }
    .leaflet-popup-content {
      margin: 12px 14px !important;
    }
    .leaflet-popup-tip-container {
      display: none !important;
    }
    .leaflet-popup-close-button {
      color: #64748b !important;
      font-size: 18px !important;
      top: 8px !important;
      right: 10px !important;
    }
  `;
}

export default function ThreatMap({ alerts = [], blockedIPs = {}, theme = 'dark', height = '100%' }) {
  const leafletReady = useLeaflet();
  const mapDiv = useRef(null);
  const mapRef = useRef(null);
  const tileLayerRef = useRef(null);
  const layersRef = useRef([]);
  const timerRef = useRef([]);
  const palette = TILE_CONFIG[theme] || TILE_CONFIG.dark;

  const sources = useMemo(() => {
    const sourceMap = new Map();
    alerts.forEach((alert) => {
      const ip = alert.source_ip;
      if (!ip) return;
      const geo = getGeo(ip);
      if (!sourceMap.has(ip)) {
        sourceMap.set(ip, {
          ip,
          geo,
          severity: alert.severity,
          attackType: alert.attack_type || alert.title || 'Attack',
          blocked: !!blockedIPs[ip],
          count: 1,
        });
      } else {
        const entry = sourceMap.get(ip);
        entry.count += 1;
        entry.blocked = entry.blocked || !!blockedIPs[ip];
      }
    });
    return [...sourceMap.values()];
  }, [alerts, blockedIPs]);

  const activeCount = sources.filter((source) => !source.blocked).length;
  const blockedCount = sources.filter((source) => source.blocked).length;

  useEffect(() => {
    ensureStyles(palette);
  }, [palette]);

  useEffect(() => {
    if (!leafletReady || !mapDiv.current || mapRef.current) return;
    const L = window.L;
    const map = L.map(mapDiv.current, {
      center: [20, 10],
      zoom: 2,
      minZoom: 2,
      maxZoom: 10,
      zoomControl: true,
      attributionControl: false,
    });

    tileLayerRef.current = L.tileLayer(palette.url, { subdomains: 'abcd', maxZoom: 19 }).addTo(map);
    L.control.attribution({ prefix: false })
      .addAttribution('<span style="color:#475569;font-size:8px">&copy; CARTO &copy; OSM</span>')
      .addTo(map);

    mapRef.current = map;

    const refresh = () => {
      try {
        map.invalidateSize(false);
      } catch {
        return;
      }
    };

    refresh();
    const first = window.setTimeout(refresh, 80);
    const second = window.setTimeout(refresh, 220);

    return () => {
      window.clearTimeout(first);
      window.clearTimeout(second);
      map.remove();
      mapRef.current = null;
      tileLayerRef.current = null;
    };
  }, [leafletReady, palette.url]);

  useEffect(() => {
    if (!leafletReady || !mapRef.current || !tileLayerRef.current) return;
    tileLayerRef.current.setUrl(palette.url);
    const map = mapRef.current;
    const refresh = () => {
      try {
        map.invalidateSize(false);
      } catch {
        return;
      }
    };
    refresh();
    const timeoutId = window.setTimeout(refresh, 140);
    return () => window.clearTimeout(timeoutId);
  }, [leafletReady, palette.url, height, alerts.length]);

  useEffect(() => {
    if (!leafletReady || !mapRef.current) return;
    const L = window.L;
    const map = mapRef.current;

    layersRef.current.forEach((layer) => {
      try {
        map.removeLayer(layer);
      } catch {
        return;
      }
    });
    layersRef.current = [];

    timerRef.current.forEach((id) => window.clearInterval(id));
    timerRef.current = [];

    const homeIcon = L.divIcon({
      className: '',
      html: `
        <div style="position:relative;width:40px;height:40px;display:flex;align-items:center;justify-content:center;">
          <div style="position:absolute;width:40px;height:40px;border-radius:50%;border:1.5px solid rgba(0,210,255,0.4);animation:hpulse1 2s ease-out infinite;"></div>
          <div style="position:absolute;width:26px;height:26px;border-radius:50%;border:1.5px solid rgba(0,210,255,0.6);animation:hpulse2 2s ease-out infinite 0.4s;"></div>
          <div style="width:12px;height:12px;border-radius:50%;background:#00d2ff;box-shadow:0 0 14px #00d2ff,0 0 28px #00d2ff88;z-index:2;"></div>
        </div>
        <style>
          @keyframes hpulse1 { 0% { transform: scale(1); opacity: 0.7; } 100% { transform: scale(1.8); opacity: 0; } }
          @keyframes hpulse2 { 0% { transform: scale(1); opacity: 0.6; } 100% { transform: scale(1.6); opacity: 0; } }
          @keyframes apulse { 0% { transform: scale(1); opacity: 0.8; } 100% { transform: scale(2.2); opacity: 0; } }
          @keyframes ablink { 0%,100% { opacity: 1; transform: scale(1); } 50% { opacity: 0.7; transform: scale(1.2); } }
        </style>
      `,
      iconSize: [40, 40],
      iconAnchor: [20, 20],
      popupAnchor: [0, -20],
    });

    const homeMarker = L.marker([HOME.lat, HOME.lon], { icon: homeIcon, zIndexOffset: 3000 })
      .addTo(map)
      .bindPopup(`
        <div style="font-family:monospace;padding:4px;min-width:170px;">
          <div style="color:${palette.accent};font-weight:800;font-size:13px;margin-bottom:6px;">${HOME.label}</div>
          <div style="color:#64748b;font-size:10px;">PLC-01 · Chennai, Tamil Nadu</div>
          <div style="color:#64748b;font-size:10px;margin-top:2px;">13.08°N, 80.27°E</div>
          <div style="margin-top:8px;padding:5px 8px;background:rgba(0,210,255,0.1);border:1px solid rgba(0,210,255,0.3);border-radius:5px;color:${palette.accent};font-size:10px;text-align:center;font-weight:700;">
            SENSOR ACTIVE
          </div>
        </div>
      `);
    layersRef.current.push(homeMarker);

    const labelIcon = L.divIcon({
      className: '',
      html: `<div style="color:${palette.accent};font-size:10px;font-weight:700;font-family:monospace;white-space:nowrap;text-shadow:0 0 8px ${palette.accent},0 1px 3px rgba(0,0,0,0.4);margin-top:4px;margin-left:-10px;">ICS Factory</div>`,
      iconSize: [80, 16],
      iconAnchor: [10, 0],
    });
    layersRef.current.push(L.marker([HOME.lat, HOME.lon], { icon: labelIcon, zIndexOffset: 2999 }).addTo(map));

    sources.forEach((source) => {
      const isBlocked = source.blocked;
      const color = isBlocked ? '#f97316' : '#ef4444';
      const glow = isBlocked ? '#f9731688' : '#ef444488';
      const size = source.severity === 'CRITICAL' ? 18 : 14;

      const dotIcon = L.divIcon({
        className: '',
        html: `
          <div style="position:relative;width:${size + 12}px;height:${size + 12}px;display:flex;align-items:center;justify-content:center;">
            <div style="position:absolute;width:${size + 12}px;height:${size + 12}px;border-radius:50%;background:${color}22;animation:apulse 1.6s ease-out infinite;"></div>
            <div style="width:${size}px;height:${size}px;border-radius:50%;background:${color};border:2px solid rgba(255,255,255,0.35);box-shadow:0 0 10px ${color},0 0 20px ${glow};z-index:2;cursor:pointer;${isBlocked ? '' : 'animation:ablink 1.4s ease-in-out infinite;'}"></div>
          </div>
        `,
        iconSize: [size + 12, size + 12],
        iconAnchor: [(size + 12) / 2, (size + 12) / 2],
        popupAnchor: [0, -(size + 12) / 2],
      });

      const marker = L.marker([source.geo.lat, source.geo.lon], { icon: dotIcon, zIndexOffset: 2000 })
        .addTo(map)
        .bindPopup(`
          <div style="font-family:monospace;padding:4px;min-width:190px;">
            <div style="display:flex;align-items:center;gap:8px;margin-bottom:8px;">
              <div style="width:10px;height:10px;border-radius:50%;background:${color};box-shadow:0 0 8px ${color};flex-shrink:0;"></div>
              <div>
                <div style="color:${color};font-weight:800;font-size:13px;">${source.geo.country}</div>
                <div style="color:#64748b;font-size:10px;">${source.geo.city}</div>
              </div>
              ${isBlocked ? '<span style="margin-left:auto;background:rgba(249,115,22,0.15);color:#f97316;border:1px solid rgba(249,115,22,0.4);border-radius:4px;padding:1px 7px;font-size:9px;font-weight:800;">BLOCKED</span>' : '<span style="margin-left:auto;background:rgba(239,68,68,0.15);color:#ef4444;border:1px solid rgba(239,68,68,0.4);border-radius:4px;padding:1px 7px;font-size:9px;font-weight:800;">ACTIVE</span>'}
            </div>
            <div style="border-top:1px solid rgba(148,163,184,0.18);padding-top:8px;display:flex;flex-direction:column;gap:5px;">
              <div style="display:flex;justify-content:space-between;font-size:10px;">
                <span style="color:#64748b;">IP</span>
                <span style="color:${palette.accent};font-weight:700;">${source.ip}</span>
              </div>
              <div style="display:flex;justify-content:space-between;font-size:10px;gap:8px;">
                <span style="color:#64748b;">Attack</span>
                <span style="color:${palette.popupText};font-weight:600;text-align:right;">${source.attackType.substring(0, 24)}</span>
              </div>
              <div style="display:flex;justify-content:space-between;font-size:10px;">
                <span style="color:#64748b;">Packets</span>
                <span style="color:${palette.popupText};font-weight:600;">x${source.count}</span>
              </div>
            </div>
            <div style="margin-top:8px;padding:5px 8px;background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.2);border-radius:5px;color:#f87171;font-size:9px;text-align:center;">
              Targeting PLC-01 · Chennai · Port 502
            </div>
          </div>
        `);
      layersRef.current.push(marker);

      const countryLabel = L.divIcon({
        className: '',
        html: `<div style="color:${palette.countryLabel};font-size:9px;font-weight:700;font-family:monospace;white-space:nowrap;text-shadow:0 0 6px ${color},0 1px 3px ${palette.countryShadow};margin-top:-2px;margin-left:-4px;">${source.geo.country}</div>`,
        iconSize: [60, 12],
        iconAnchor: [4, 0],
      });
      layersRef.current.push(L.marker([source.geo.lat + 2.5, source.geo.lon], { icon: countryLabel, zIndexOffset: 1999 }).addTo(map));

      const arcPoints = [];
      for (let i = 0; i <= 60; i += 1) {
        const t = i / 60;
        arcPoints.push([
          source.geo.lat + (HOME.lat - source.geo.lat) * t,
          source.geo.lon + (HOME.lon - source.geo.lon) * t,
        ]);
      }

      const arc = L.polyline(arcPoints, {
        color,
        weight: 1.6,
        opacity: isBlocked ? 0.35 : 0.65,
        dashArray: isBlocked ? '4 8' : '7 10',
      }).addTo(map);
      layersRef.current.push(arc);

      if (!isBlocked) {
        const packetIcon = L.divIcon({
          className: '',
          html: `<div style="width:7px;height:7px;border-radius:50%;background:${color};box-shadow:0 0 8px ${color};"></div>`,
          iconSize: [7, 7],
          iconAnchor: [3, 3],
        });
        let step = Math.floor(Math.random() * 60);
        const packet = L.marker(arcPoints[0], { icon: packetIcon, zIndexOffset: 1500 }).addTo(map);
        layersRef.current.push(packet);
        const intervalId = window.setInterval(() => {
          step = (step + 1) % 61;
          packet.setLatLng(arcPoints[step] || arcPoints[0]);
        }, 35);
        timerRef.current.push(intervalId);
      }
    });

    const refresh = () => {
      try {
        map.invalidateSize(false);
      } catch {
        return;
      }
    };
    refresh();
    const timeoutId = window.setTimeout(refresh, 120);

    return () => {
      window.clearTimeout(timeoutId);
      timerRef.current.forEach((id) => window.clearInterval(id));
      timerRef.current = [];
    };
  }, [leafletReady, palette, sources]);

  return (
    <div
      style={{
        width: '100%',
        height,
        position: 'relative',
        borderRadius: 10,
        overflow: 'hidden',
        background: palette.background,
      }}
    >
      <div
        style={{
          position: 'absolute',
          top: 0,
          left: 0,
          right: 0,
          zIndex: 1000,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '8px 14px',
          background: palette.overlay,
          pointerEvents: 'none',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <div
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: activeCount > 0 ? '#ef4444' : '#10b981',
              boxShadow: `0 0 8px ${activeCount > 0 ? '#ef4444' : '#10b981'}`,
            }}
          />
          <span style={{ color: palette.text, fontSize: 11, fontWeight: 700, letterSpacing: '1px' }}>
            LIVE THREAT MAP
          </span>
        </div>

        {activeCount > 0 && (
          <div
            style={{
              background: 'rgba(239,68,68,0.15)',
              border: '1px solid rgba(239,68,68,0.5)',
              borderRadius: 6,
              padding: '4px 12px',
              color: '#ef4444',
              fontSize: 11,
              fontWeight: 800,
              letterSpacing: '0.5px',
            }}
          >
            {activeCount} ACTIVE SOURCE{activeCount > 1 ? 'S' : ''}
          </div>
        )}
      </div>

      <div ref={mapDiv} style={{ width: '100%', height: '100%' }} />

      {!leafletReady && (
        <div
          style={{
            position: 'absolute',
            inset: 0,
            background: palette.background,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 999,
          }}
        >
          <span style={{ color: palette.accent, fontSize: 12, fontWeight: 700 }}>Loading map...</span>
        </div>
      )}

      <div
        style={{
          position: 'absolute',
          bottom: 12,
          right: 12,
          zIndex: 1000,
          background: palette.legendBg,
          border: `1px solid ${palette.legendBorder}`,
          borderRadius: 8,
          padding: '8px 12px',
          display: 'flex',
          flexDirection: 'column',
          gap: 6,
          pointerEvents: 'none',
        }}
      >
        {[
          ['#ef4444', 'Active Attack'],
          ['#f97316', 'Blocked IP'],
          ['#00d2ff', 'ICS Target'],
        ].map(([color, label]) => (
          <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 7 }}>
            <div
              style={{
                width: 8,
                height: 8,
                borderRadius: '50%',
                background: color,
                boxShadow: `0 0 6px ${color}`,
              }}
            />
            <span style={{ color: palette.legendText, fontSize: 10 }}>{label}</span>
          </div>
        ))}
      </div>

      {blockedCount > 0 && (
        <div
          style={{
            position: 'absolute',
            bottom: 12,
            left: 12,
            zIndex: 1000,
            background: palette.blockedBg,
            border: `1px solid ${palette.blockedBorder}`,
            borderRadius: 6,
            padding: '4px 10px',
            color: '#f97316',
            fontSize: 10,
            fontWeight: 700,
          }}
        >
          {blockedCount} IP{blockedCount > 1 ? 's' : ''} blocked
        </div>
      )}
    </div>
  );
}

