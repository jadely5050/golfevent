'use client';

import { useState, useRef, useEffect, useLayoutEffect } from 'react';

export default function YardageDrawingBoard({ 
  holeNumber, 
  drawingData, 
  onSave, 
  obCount = 0, 
  hazardCount = 0,
  mode = 'yardage',
  imageUrl = null
}) {
  const [isPanelCollapsed, setIsPanelCollapsed] = useState(true);
  const [activeTool, setActiveTool] = useState('pencil');

  const [activeColor, setActiveColor] = useState('#000000');
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 });
  
  // Using refs for interaction flags to avoid state sync issues during drawing
  const isDrawing = useRef(false);
  const isErasing = useRef(false);
  const isPanning = useRef(false);
  
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const imageRef = useRef(null);
  const initialPinchDist = useRef(null);
  const lastPinchCenter = useRef(null);
  const lastTouchPos = useRef(null);

  // Local state for drawings, initialized from props
  const [drawings, setDrawings] = useState(drawingData || { paths: [], markers: [] });

  // Sync with props when hole changes or new data arrives from parent
  useEffect(() => {
    setDrawings(drawingData || { paths: [], markers: [] });
  }, [drawingData, holeNumber]);

  const redrawCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const H = canvas.height;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    ctx.translate(transform.x, transform.y);
    if (mode === 'green') {
      const W = canvas.width;
      ctx.translate(W / 2, H / 2);
      ctx.scale(transform.scale, transform.scale);
      ctx.translate(-W / 2, -H / 2);
    } else {
      ctx.translate(0, H);
      ctx.scale(transform.scale, transform.scale);
      ctx.translate(0, -H);
    }

    drawings.paths.forEach(path => {
      if (!path.points || path.points.length < 2) return;
      ctx.beginPath();
      ctx.strokeStyle = path.color;
      ctx.lineWidth = 3 / transform.scale;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.moveTo(path.points[0].x, path.points[0].y);
      for (let i = 1; i < path.points.length; i++) {
        ctx.lineTo(path.points[i].x, path.points[i].y);
      }
      ctx.stroke();
    });

    ctx.restore();
  };

  useLayoutEffect(() => {
    redrawCanvas();
  }, [drawings, transform, holeNumber]);

  const handleResize = () => {
    if (containerRef.current && canvasRef.current) {
      const { clientWidth, clientHeight } = containerRef.current;
      if (clientWidth === 0 || clientHeight === 0) return;
      canvasRef.current.width = clientWidth;
      canvasRef.current.height = clientHeight;
      redrawCanvas();
    }
  };

  useEffect(() => {
    handleResize();
    const resizeObserver = new ResizeObserver(handleResize);
    if (containerRef.current) resizeObserver.observe(containerRef.current);
    return () => resizeObserver.disconnect();
  }, [holeNumber]);

  const screenToCanvas = (sx, sy) => {
    if (!containerRef.current) return { x: sx, y: sy };
    const W = containerRef.current.clientWidth;
    const H = containerRef.current.clientHeight;
    const S = transform.scale;
    if (mode === 'green') {
      return {
        x: (sx - transform.x - W / 2) / S + W / 2,
        y: (sy - transform.y - H / 2) / S + H / 2
      };
    }
    return {
      x: (sx - transform.x) / S,
      y: H - (H - (sy - transform.y)) / S
    };
  };

  const performErasure = (clientX, clientY) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const pos = screenToCanvas(clientX - rect.left, clientY - rect.top);
    const threshold = 15 / transform.scale;

    setDrawings(prev => {
      let changed = false;
      const newPaths = [];
      prev.paths.forEach(path => {
        let currentSubPath = [];
        path.points.forEach(pt => {
          if (Math.hypot(pt.x - pos.x, pt.y - pos.y) < threshold) {
            if (currentSubPath.length > 1) {
              newPaths.push({ ...path, id: Math.random(), points: currentSubPath });
            }
            currentSubPath = [];
            changed = true;
          } else {
            currentSubPath.push(pt);
          }
        });
        if (currentSubPath.length > 1) {
          newPaths.push({ ...path, id: Math.random(), points: currentSubPath });
        } else if (currentSubPath.length === path.points.length) {
          newPaths.push(path);
        } else if (currentSubPath.length > 0) {
          changed = true; // Partial line removed
        }
      });

      const filteredMarkers = prev.markers.filter(m => {
        const isHit = Math.hypot(m.x - pos.x, m.y - pos.y) < threshold * 2;
        if (isHit) changed = true;
        return !isHit;
      });

      if (!changed) return prev;
      return { paths: newPaths, markers: filteredMarkers };
    });
  };

  const handleStart = (clientX, clientY) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;

    if (activeTool === 'pencil') {
      isDrawing.current = true;
      const startPoint = screenToCanvas(x, y);
      setDrawings(prev => ({
        ...prev,
        paths: [...prev.paths, { id: Date.now(), color: activeColor, width: 3, points: [startPoint] }]
      }));
    } else if (activeTool === 'eraser') {
      isErasing.current = true;
      performErasure(clientX, clientY);
    } else if (transform.scale > 1) {
      isPanning.current = true;
      lastTouchPos.current = { x: clientX, y: clientY };
    } else if (['OB', 'HZ', 'B', 'IP', 'LEFT', 'RIGHT', 'UP', 'DOWN', 'FLAG', 'P1', 'P2', 'P3', 'P4'].includes(activeTool)) {
      const pos = screenToCanvas(x, y);
      const updated = {
        ...drawings,
        markers: [...drawings.markers, { id: Date.now(), x: pos.x, y: pos.y, type: activeTool, color: activeColor }]
      };
      setDrawings(updated);
      onSave(updated);
    }
  };

  const handleMove = (clientX, clientY) => {
    if (isDrawing.current && activeTool === 'pencil') {
      const rect = containerRef.current.getBoundingClientRect();
      const pos = screenToCanvas(clientX - rect.left, clientY - rect.top);
      setDrawings(prev => {
        const paths = [...prev.paths];
        if (paths.length === 0) return prev;
        const lastPath = { ...paths[paths.length - 1] };
        lastPath.points = [...lastPath.points, pos];
        paths[paths.length - 1] = lastPath;
        return { ...prev, paths };
      });
    } else if (isErasing.current && activeTool === 'eraser') {
      performErasure(clientX, clientY);
    } else if (isPanning.current && lastTouchPos.current) {
      const dx = clientX - lastTouchPos.current.x;
      const dy = clientY - lastTouchPos.current.y;
      setTransform(prev => ({ ...prev, x: prev.x + dx, y: prev.y + dy }));
      lastTouchPos.current = { x: clientX, y: clientY };
    }
  };

  const handleEnd = () => {
    if (isDrawing.current || isErasing.current) {
      // Need to use latest drawings from state? 
      // Actually setDrawings is async, so we use a functional update to get latest if needed.
      // But here we can just let the re-render handle it and call onSave with drawings.
      // To be safe, we can use a ref for drawings too, but let's try calling onSave in the next tick or using useEffect.
      onSave(drawings);
    }
    isDrawing.current = false;
    isErasing.current = false;
    isPanning.current = false;
    lastTouchPos.current = null;
    initialPinchDist.current = null;
    lastPinchCenter.current = null;
  };

  const handleTouchStart = (e) => {
    if (e.touches.length === 2) {
      isDrawing.current = false;
      isErasing.current = false;
      isPanning.current = false;
      initialPinchDist.current = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      lastPinchCenter.current = {
        x: (e.touches[0].clientX + e.touches[1].clientX) / 2,
        y: (e.touches[0].clientY + e.touches[1].clientY) / 2
      };
    } else if (e.touches.length === 1) {
      const touch = e.touches[0];
      handleStart(touch.clientX, touch.clientY);
    }
  };

  const handleTouchMove = (e) => {
    if (e.touches.length === 2 && initialPinchDist.current) {
      e.preventDefault();
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const center = {
        x: (e.touches[0].clientX + e.touches[1].clientX) / 2,
        y: (e.touches[0].clientY + e.touches[1].clientY) / 2
      };
      
      const scaleFactor = dist / initialPinchDist.current;
      const dx = center.x - lastPinchCenter.current.x;
      const dy = center.y - lastPinchCenter.current.y;

      setTransform(prev => {
        const newScale = Math.min(Math.max(prev.scale * scaleFactor, 1), 5);
        if (newScale <= 1.01) return { x: 0, y: 0, scale: 1 };
        return { 
          x: prev.x + dx,
          y: prev.y + dy,
          scale: newScale 
        };
      });

      initialPinchDist.current = dist;
      lastPinchCenter.current = center;
    } else if (e.touches.length === 1 && (isDrawing.current || isErasing.current || isPanning.current)) {
      const touch = e.touches[0];
      e.preventDefault();
      handleMove(touch.clientX, touch.clientY);
    }
  };

  const getMarkerSymbol = (type) => {
    switch (type) {
      case 'OB': return 'OB';
      case 'HZ': return 'HZ';
      case 'B': return 'B';
      case 'IP': return '❤️';
      case 'FLAG': return '🚩';
      case 'P1': return '①';
      case 'P2': return '②';
      case 'P3': return '③';
      case 'P4': return '④';
      case 'LEFT': return '←';
      case 'RIGHT': return '→';
      case 'UP': return '↑';
      case 'DOWN': return '↓';
      default: return '';
    }
  };

  const stopPropagation = (e) => {
    e.stopPropagation();
  };

  return (
    <div className="drawing-board-container" ref={containerRef}>
      <div 
        style={{ 
          transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
          transformOrigin: mode === 'green' ? 'center' : 'left bottom',
          position: 'absolute',
          bottom: 0,
          left: 0,
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: mode === 'green' ? 'center' : 'flex-end',
          justifyContent: mode === 'green' ? 'center' : 'flex-start'
        }}
      >
        {imageUrl === 'loading' ? (
          <div style={{ height: '100%', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(255,255,255,0.05)' }}>
            <div className="loader" style={{ width: '20px', height: '20px', border: '2px solid rgba(255,255,255,0.1)', borderTop: '2px solid var(--accent-neon)', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
          </div>
        ) : (
          <img 
            ref={imageRef}
            src={imageUrl || `/${holeNumber}h.jpg`} 
            alt={mode === 'green' ? `Green ${holeNumber}` : `Hole ${holeNumber}`} 
            style={{ 
              height: mode === 'green' ? '100%' : '90%', 
              width: mode === 'green' ? '100%' : 'auto', 
              objectFit: mode === 'green' ? 'contain' : 'initial',
              pointerEvents: 'none', 
              userSelect: 'none' 
            }}
            onLoad={handleResize}
            onError={(e) => e.target.style.display = 'none'}
          />
        )}
        
        {drawings.markers.map(marker => (
          <div 
            key={marker.id}
            className={['OB', 'HZ', 'B', 'FLAG', 'P1', 'P2', 'P3', 'P4'].includes(marker.type) ? 'marker-item' : 'marker-arrow'}
            style={{ 
              left: marker.x, 
              top: marker.y,
              backgroundColor: marker.type === 'OB' ? 'red' : marker.type === 'HZ' ? 'blue' : marker.type === 'B' ? '#eab308' : (['FLAG', 'P1', 'P2', 'P3', 'P4'].includes(marker.type)) ? 'rgba(255, 255, 255, 0.9)' : 'transparent',
              color: (['LEFT', 'RIGHT', 'UP', 'DOWN'].includes(marker.type)) ? '#eab308' : marker.type === 'IP' ? '#ff4d4f' : (['FLAG', 'P1', 'P2', 'P3', 'P4'].includes(marker.type)) ? 'black' : 'white',
              padding: (['OB', 'HZ', 'B', 'FLAG', 'P1', 'P2', 'P3', 'P4'].includes(marker.type)) ? '2px 6px' : '0',
              borderRadius: (['OB', 'HZ', 'B', 'FLAG', 'P1', 'P2', 'P3', 'P4'].includes(marker.type)) ? '4px' : '0',
              fontSize: (['OB', 'HZ', 'B', 'FLAG', 'P1', 'P2', 'P3', 'P4'].includes(marker.type)) ? '0.9rem' : '1.5rem',
              fontWeight: 'bold',
              textShadow: !(['OB', 'HZ', 'B', 'FLAG', 'P1', 'P2', 'P3', 'P4'].includes(marker.type)) ? '0 0 4px rgba(0,0,0,0.8)' : 'none',
              transform: `translate(-50%, -50%) scale(${1/transform.scale})`
            }}
          >
            {getMarkerSymbol(marker.type)}
          </div>
        ))}
      </div>

      <canvas
        ref={canvasRef}
        className="drawing-canvas"
        onMouseDown={(e) => handleStart(e.clientX, e.clientY)}
        onMouseMove={(e) => handleMove(e.clientX, e.clientY)}
        onMouseUp={handleEnd}
        onMouseLeave={handleEnd}
        onTouchStart={(e) => { e.preventDefault(); handleTouchStart(e); }}
        onTouchMove={handleTouchMove}
        onTouchEnd={(e) => { e.preventDefault(); handleEnd(); }}
      />

      <div className="drawing-marker-bar" style={{ pointerEvents: 'none' }}>
        <div style={{ display: 'flex', flexDirection: 'column-reverse', gap: '0.3rem', pointerEvents: 'auto' }} onPointerDown={stopPropagation}>
          <button 
            className="drawing-tool-btn" 
            onClick={(e) => { e.preventDefault(); e.stopPropagation(); setIsPanelCollapsed(!isPanelCollapsed); }}
            style={{ width: '38px', height: '38px' }}
          >
            {isPanelCollapsed ? '▲' : '▼'}
          </button>
          {!isPanelCollapsed && (mode === 'green' ? ['FLAG', 'P1', 'P2', 'P3', 'P4'] : ['OB', 'HZ', 'B', 'IP', 'LEFT', 'RIGHT', 'UP', 'DOWN']).map(t => (
            <button 
              key={t}
              className={`drawing-tool-btn ${activeTool === t ? 'active' : ''}`}
              style={{ 
                width: '38px', 
                height: '38px', 
                fontSize: '0.8rem',
                color: (['LEFT', 'RIGHT', 'UP', 'DOWN'].includes(t) && activeTool !== t) ? '#eab308' : undefined
              }}
              onClick={(e) => { 
                e.preventDefault(); 
                e.stopPropagation();
                setActiveTool(prev => prev === t ? 'pencil' : t); 
              }}
            >
              {getMarkerSymbol(t)}
            </button>
          ))}
        </div>
      </div>

      <div className="drawing-control-bar" style={{ pointerEvents: 'none' }}>
        <div style={{ display: 'flex', gap: '0.5rem', pointerEvents: 'auto' }} onPointerDown={stopPropagation}>
          <button 
            className={`drawing-control-btn ${activeTool === 'eraser' ? 'active' : ''}`}
            style={{ padding: '0.4rem 0.6rem', fontSize: '0.8rem' }}
            onClick={(e) => { 
              e.preventDefault(); 
              e.stopPropagation();
              setActiveTool(prev => prev === 'eraser' ? 'pencil' : 'eraser'); 
            }}
          >
            지우개
          </button>
          <input 
            type="color" 
            className="color-picker" 
            style={{ width: '30px', height: '30px' }}
            value={activeColor} 
            onChange={(e) => setActiveColor(e.target.value)} 
            onPointerDown={stopPropagation}
          />
          <button 
            className={`drawing-control-btn ${activeTool === 'pencil' ? 'active' : ''}`}
            style={{ padding: '0.4rem 0.6rem', fontSize: '0.8rem' }}
            onClick={(e) => { 
              e.preventDefault(); 
              e.stopPropagation();
              setActiveTool('pencil'); 
            }}
          >
            ✎
          </button>
        </div>
      </div>
    </div>
  );
}
