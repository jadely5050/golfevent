'use client';

import { useEffect, useRef, useState, useMemo } from 'react';

function distance(a, b) {
  const R = 6371000;
  const f1 = a.lat * Math.PI / 180;
  const f2 = b.lat * Math.PI / 180;
  const df = (b.lat - a.lat) * Math.PI / 180;
  const dl = (b.lng - a.lng) * Math.PI / 180;
  const x = Math.sin(df / 2) ** 2 + Math.cos(f1) * Math.cos(f2) * Math.sin(dl / 2) ** 2;
  return Math.round(R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x)));
}

function bearing(start, end) {
  const f1 = start.lat * Math.PI / 180;
  const f2 = end.lat * Math.PI / 180;
  const dl = (end.lng - start.lng) * Math.PI / 180;
  const y = Math.sin(dl) * Math.cos(f2);
  const x = Math.cos(f1) * Math.sin(f2) - Math.sin(f1) * Math.cos(f2) * Math.cos(dl);
  return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
}

function circledNumber(n) {
  if (n >= 1 && n <= 20) return String.fromCharCode(0x2460 + n - 1);
  return String(n);
}

export default function HoleMap({ hole, round, onPhotoClick, mapType = 'normal' }) {
  const wrapperRef = useRef(null);
  const mapContainerRef = useRef(null);
  const mapRef = useRef(null);
  const overlaysRef = useRef([]);
  const [sdkReady, setSdkReady] = useState(false);
  const [rotateToHole, setRotateToHole] = useState(true);

  const photos = useMemo(() => {
    return (round.images || [])
      .filter(i => i.hole === hole.hole && i.latitude && i.longitude)
      .sort((a, b) => new Date(a.addedAt || 0) - new Date(b.addedAt || 0))
      .map((p, idx) => ({ ...p, num: idx + 1 }));
  }, [round.images, hole.hole]);

  const putts = useMemo(() => {
    const list = (hole.shots || []).filter(s => s.club === 'Pt' && s.coords && s.coords.lat && s.coords.lng);
    return list.map((p, idx) => ({ ...p, num: idx + 1 }));
  }, [hole.shots]);

  const pin = hole.pinCoords && hole.pinCoords.lat ? hole.pinCoords : null;
  const teeExplicit = hole.teeCoords && hole.teeCoords.lat ? hole.teeCoords : null;
  const teeForBearing = teeExplicit || (photos[0] ? { lat: photos[0].latitude, lng: photos[0].longitude } : null);

  const canRotate = !!(teeForBearing && pin);
  const mapBearing = useMemo(() => {
    if (rotateToHole && canRotate) {
      return bearing({ lat: teeForBearing.lat, lng: teeForBearing.lng }, { lat: pin.lat, lng: pin.lng });
    }
    return 0;
  }, [rotateToHole, canRotate, teeForBearing, pin]);

  const hasAnyData = photos.length > 0 || putts.length > 0 || pin || teeExplicit;

  // Wait for SDK
  useEffect(() => {
    if (typeof window === 'undefined') return;
    let cancelled = false;
    const tryReady = () => {
      if (window.kakao && window.kakao.maps) {
        window.kakao.maps.load(() => {
          if (!cancelled) setSdkReady(true);
        });
        return true;
      }
      return false;
    };
    if (tryReady()) return;
    const id = setInterval(() => { if (tryReady()) clearInterval(id); }, 200);
    return () => { cancelled = true; clearInterval(id); };
  }, []);

  // Init map once
  useEffect(() => {
    if (!sdkReady || !mapContainerRef.current || mapRef.current) return;
    const kakao = window.kakao;
    const fallback = pin || teeExplicit
      || (photos[0] && { lat: photos[0].latitude, lng: photos[0].longitude })
      || (putts[0] && { lat: putts[0].coords.lat, lng: putts[0].coords.lng })
      || { lat: 37.5665, lng: 126.9780 };
    const map = new kakao.maps.Map(mapContainerRef.current, {
      center: new kakao.maps.LatLng(fallback.lat, fallback.lng),
      level: 3,
      draggable: true,
      scrollwheel: true
    });
    mapRef.current = map;
  }, [sdkReady]);

  // Map type (normal / satellite)
  useEffect(() => {
    if (!mapRef.current || !window.kakao) return;
    const id = mapType === 'satellite'
      ? window.kakao.maps.MapTypeId.SKYVIEW
      : window.kakao.maps.MapTypeId.ROADMAP;
    mapRef.current.setMapTypeId(id);
  }, [mapType, sdkReady]);

  // Relayout on container resize
  useEffect(() => {
    if (!mapRef.current || !wrapperRef.current) return;
    const observer = new ResizeObserver(() => {
      if (mapRef.current) mapRef.current.relayout();
    });
    observer.observe(wrapperRef.current);
    return () => observer.disconnect();
  }, [sdkReady]);

  // Redraw overlays
  useEffect(() => {
    if (!mapRef.current || !window.kakao) return;
    const kakao = window.kakao;
    const map = mapRef.current;

    overlaysRef.current.forEach(o => o.setMap(null));
    overlaysRef.current = [];

    const allPoints = [];
    const counterRot = `rotate(${mapBearing}deg)`;

    // Photo markers
    photos.forEach(p => {
      const pos = new kakao.maps.LatLng(p.latitude, p.longitude);
      allPoints.push(pos);
      const el = document.createElement('div');
      el.style.cssText = `
        transform: translate(-50%, -50%) ${counterRot};
        background: #10b981; color: white; border-radius: 50%;
        width: 28px; height: 28px; display: flex; align-items: center; justify-content: center;
        font-weight: bold; font-size: 14px; cursor: pointer;
        box-shadow: 0 2px 6px rgba(0,0,0,0.4); border: 3px solid #ef4444;
        user-select: none;
      `;
      el.textContent = circledNumber(p.num);
      el.onclick = (e) => { e.stopPropagation(); onPhotoClick && onPhotoClick(p); };
      const ov = new kakao.maps.CustomOverlay({ position: pos, content: el, yAnchor: 0.5, xAnchor: 0.5, zIndex: 5, clickable: true });
      ov.setMap(map);
      overlaysRef.current.push(ov);
    });

    // Polyline connecting photos + distance labels
    if (photos.length >= 2) {
      const path = photos.map(p => new kakao.maps.LatLng(p.latitude, p.longitude));
      const polyline = new kakao.maps.Polyline({
        path, strokeWeight: 2, strokeColor: '#10b981', strokeOpacity: 0.7, strokeStyle: 'shortdash'
      });
      polyline.setMap(map);
      overlaysRef.current.push(polyline);

      for (let i = 0; i < photos.length - 1; i++) {
        const a = photos[i], b = photos[i + 1];
        const d = distance({ lat: a.latitude, lng: a.longitude }, { lat: b.latitude, lng: b.longitude });
        const midLat = (a.latitude + b.latitude) / 2;
        const midLng = (a.longitude + b.longitude) / 2;
        const lbl = document.createElement('div');
        lbl.style.cssText = `
          transform: translate(-50%, -50%) ${counterRot};
          background: rgba(0,0,0,0.7); color: #10b981;
          padding: 2px 6px; border-radius: 4px; font-size: 11px; font-weight: bold;
          white-space: nowrap; user-select: none;
        `;
        lbl.textContent = `${d}m`;
        const ov = new kakao.maps.CustomOverlay({ position: new kakao.maps.LatLng(midLat, midLng), content: lbl, yAnchor: 0.5, xAnchor: 0.5, zIndex: 2 });
        ov.setMap(map);
        overlaysRef.current.push(ov);
      }
    }

    // Putt markers
    putts.forEach(p => {
      const pos = new kakao.maps.LatLng(p.coords.lat, p.coords.lng);
      allPoints.push(pos);
      const el = document.createElement('div');
      el.style.cssText = `
        transform: translate(-50%, -50%) ${counterRot};
        background: #1890ff; color: white; border-radius: 12px;
        padding: 2px 8px; font-weight: bold; font-size: 12px;
        box-shadow: 0 2px 6px rgba(0,0,0,0.4); border: 2px solid white;
        user-select: none;
      `;
      el.textContent = `P${p.num}`;
      const ov = new kakao.maps.CustomOverlay({ position: pos, content: el, yAnchor: 0.5, xAnchor: 0.5, zIndex: 4 });
      ov.setMap(map);
      overlaysRef.current.push(ov);
    });

    // Tee
    if (teeExplicit) {
      const pos = new kakao.maps.LatLng(teeExplicit.lat, teeExplicit.lng);
      allPoints.push(pos);
      const el = document.createElement('div');
      el.style.cssText = `
        transform: translate(-50%, -50%) ${counterRot};
        font-size: 24px; line-height: 1; text-shadow: 0 0 4px rgba(0,0,0,0.8);
        user-select: none;
      `;
      el.textContent = '⛳';
      const ov = new kakao.maps.CustomOverlay({ position: pos, content: el, yAnchor: 0.5, xAnchor: 0.5, zIndex: 6 });
      ov.setMap(map);
      overlaysRef.current.push(ov);
    }

    // Pin (hole cup)
    if (pin) {
      const pos = new kakao.maps.LatLng(pin.lat, pin.lng);
      allPoints.push(pos);
      const el = document.createElement('div');
      el.style.cssText = `
        transform: translate(-50%, -50%) ${counterRot};
        font-size: 28px; line-height: 1; text-shadow: 0 0 4px rgba(0,0,0,0.8);
        user-select: none;
      `;
      el.textContent = '🚩';
      const ov = new kakao.maps.CustomOverlay({ position: pos, content: el, yAnchor: 0.5, xAnchor: 0.5, zIndex: 6 });
      ov.setMap(map);
      overlaysRef.current.push(ov);
    }

    if (allPoints.length > 0) {
      const bounds = new kakao.maps.LatLngBounds();
      allPoints.forEach(p => bounds.extend(p));
      // generous padding so markers sit inside the un-clipped portion of the rotated map
      map.setBounds(bounds, 80, 80, 80, 80);
    }
  }, [photos, putts, pin, teeExplicit, mapBearing, sdkReady, onPhotoClick]);

  const zoomIn = (e) => { e.stopPropagation(); if (mapRef.current) mapRef.current.setLevel(mapRef.current.getLevel() - 1); };
  const zoomOut = (e) => { e.stopPropagation(); if (mapRef.current) mapRef.current.setLevel(mapRef.current.getLevel() + 1); };

  return (
    <div ref={wrapperRef} style={{ position: 'absolute', inset: 0, overflow: 'hidden', background: '#222' }}>
      {/* Rotated map: oversize 150% so corners stay covered when rotated */}
      <div style={{
        position: 'absolute',
        top: '-25%', left: '-25%', width: '150%', height: '150%',
        transform: `rotate(${-mapBearing}deg)`,
        transformOrigin: 'center center',
        transition: 'transform 0.3s ease'
      }}>
        <div ref={mapContainerRef} style={{ width: '100%', height: '100%' }} />
      </div>

      {!hasAnyData && (
        <div style={{
          position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'var(--text-secondary)', fontSize: '0.85rem', textAlign: 'center', padding: '1rem',
          pointerEvents: 'none', background: 'rgba(0,0,0,0.4)'
        }}>
          이 홀에 GPS 정보가 없습니다.
        </div>
      )}

      {/* Rotation toggle (top-left) */}
      {canRotate && (
        <button
          onClick={(e) => { e.stopPropagation(); setRotateToHole(prev => !prev); }}
          style={{
            position: 'absolute', top: '8px', left: '8px', zIndex: 10,
            background: 'rgba(0,0,0,0.65)', color: 'white', border: '1px solid rgba(255,255,255,0.2)',
            borderRadius: '6px', padding: '4px 8px', fontSize: '0.75rem', cursor: 'pointer', fontWeight: 'bold'
          }}
          title="회전 전환"
        >
          {rotateToHole ? '⛳ ↑' : '🧭 N'}
        </button>
      )}

      {/* Custom zoom controls (bottom-right, outside rotation) */}
      <div style={{
        position: 'absolute', bottom: '8px', right: '8px', zIndex: 10,
        display: 'flex', flexDirection: 'column', gap: '4px'
      }}>
        <button onClick={zoomIn} style={zoomBtnStyle}>+</button>
        <button onClick={zoomOut} style={zoomBtnStyle}>−</button>
      </div>
    </div>
  );
}

const zoomBtnStyle = {
  background: 'rgba(0,0,0,0.65)',
  color: 'white',
  border: '1px solid rgba(255,255,255,0.2)',
  borderRadius: '6px',
  width: '32px',
  height: '32px',
  fontSize: '1.1rem',
  fontWeight: 'bold',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center'
};
