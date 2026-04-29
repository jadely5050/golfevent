'use client';

import { useState, useRef, useEffect, useLayoutEffect } from 'react';

export default function YardageDrawingBoard({ holeNumber, drawingData, onSave }) {
  const [isPanelCollapsed, setIsPanelCollapsed] = useState(false);
  const [activeTool, setActiveTool] = useState('pencil');
  const [activeColor, setActiveColor] = useState('#000000');
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 });
  const [isDrawing, setIsDrawing] = useState(false);
  const [isErasing, setIsErasing] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const imageRef = useRef(null);
  const initialPinchDist = useRef(null);
  const lastPinchCenter = useRef(null);
  const lastTouchPos = useRef(null);

  const [drawings, setDrawings] = useState(drawingData || { paths: [], markers: [] });

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
    ctx.translate(0, H);
    ctx.scale(transform.scale, transform.scale);
    ctx.translate(0, -H);

    drawings.paths.forEach(path => {
      if (path.points.length < 2) return;
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
    const H = containerRef.current.clientHeight;
    const S = transform.scale;
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
              newPaths.push({ ...path, id: Date.now() + Math.random(), points: currentSubPath });
            }
            currentSubPath = [];
            changed = true;
          } else {
            currentSubPath.push(pt);
          }
        });
        if (currentSubPath.length > 1) {
          newPaths.push({ ...path, id: Date.now() + Math.random(), points: currentSubPath });
        } else if (currentSubPath.length === path.points.length) {
          newPaths.push(path);
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
      setIsDrawing(true);
      const startPoint = screenToCanvas(x, y);
      setDrawings(prev => ({
        ...prev,
        paths: [...prev.paths, { id: Date.now(), color: activeColor, width: 3, points: [startPoint] }]
      }));
    } else if (activeTool === 'eraser') {
      setIsErasing(true);
      performErasure(clientX, clientY);
    } else {
      // Default to panning if scale > 1 and no drawing tool is active, 
      // or just allow panning with scale > 1 regardless?
      // User said "줌인 한 후 드래그는 한손으로도 가능하도록"
      if (transform.scale > 1) {
        setIsPanning(true);
        lastTouchPos.current = { x: clientX, y: clientY };
      }
    }
  };

  const handleMove = (clientX, clientY) => {
    if (isDrawing && activeTool === 'pencil') {
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
    } else if (isErasing && activeTool === 'eraser') {
      performErasure(clientX, clientY);
    } else if (isPanning && lastTouchPos.current) {
      const dx = clientX - lastTouchPos.current.x;
      const dy = clientY - lastTouchPos.current.y;
      setTransform(prev => ({ ...prev, x: prev.x + dx, y: prev.y + dy }));
      lastTouchPos.current = { x: clientX, y: clientY };
    }
  };

  const handleEnd = () => {
    if (isDrawing || isErasing) {
      onSave(drawings);
    }
    setIsDrawing(false);
    setIsErasing(false);
    setIsPanning(false);
    lastTouchPos.current = null;
    initialPinchDist.current = null;
    lastPinchCenter.current = null;
  };

  const handleTouchStart = (e) => {
    if (e.touches.length === 2) {
      setIsDrawing(false);
      setIsErasing(false);
      setIsPanning(false);
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
    } else if (e.touches.length === 1 && (isDrawing || isErasing || isPanning)) {
      const touch = e.touches[0];
      if (isDrawing || isErasing || isPanning) e.preventDefault();
      handleMove(touch.clientX, touch.clientY);
    }
  };

  const getMarkerSymbol = (type) => {
    switch (type) {
      case 'OB': return 'OB';
      case 'HZ': return 'HZ';
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
          transformOrigin: 'left bottom',
          position: 'absolute',
          bottom: 0,
          left: 0,
          width: '100%',
          height: '100%',
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'flex-start'
        }}
      >
        <img 
          ref={imageRef}
          src={`/${holeNumber}h.jpg`} 
          alt={`Hole ${holeNumber}`} 
          style={{ height: '100%', width: 'auto', pointerEvents: 'none', userSelect: 'none' }}
          onLoad={handleResize}
          onError={(e) => e.target.style.display = 'none'}
        />
        
        {drawings.markers.map(marker => (
          <div 
            key={marker.id}
            className={marker.type === 'OB' || marker.type === 'HZ' ? 'marker-item' : 'marker-arrow'}
            style={{ 
              left: marker.x, 
              top: marker.y,
              backgroundColor: marker.type === 'OB' ? 'red' : marker.type === 'HZ' ? 'blue' : 'transparent',
              color: (marker.type === 'OB' || marker.type === 'HZ') ? 'white' : marker.color,
              padding: (marker.type === 'OB' || marker.type === 'HZ') ? '2px 6px' : '0',
              borderRadius: (marker.type === 'OB' || marker.type === 'HZ') ? '4px' : '0',
              fontSize: (marker.type === 'OB' || marker.type === 'HZ') ? '0.9rem' : '1.2rem',
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
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleEnd}
      />

      <div className="drawing-tool-panel" onPointerDown={stopPropagation} style={{ height: isPanelCollapsed ? '54px' : 'auto', overflow: 'hidden' }}>
        <button 
          className="drawing-tool-btn" 
          onClick={(e) => { e.preventDefault(); setIsPanelCollapsed(!isPanelCollapsed); }}
          style={{ marginBottom: isPanelCollapsed ? 0 : '0.5rem' }}
        >
          {isPanelCollapsed ? '▼' : '▲'}
        </button>
        {!isPanelCollapsed && ['OB', 'HZ', 'LEFT', 'RIGHT', 'UP', 'DOWN'].map(t => (
          <button 
            key={t}
            className={`drawing-tool-btn ${activeTool === t ? 'active' : ''}`}
            onClick={(e) => { 
              e.preventDefault(); 
              setActiveTool(prev => prev === t ? 'pencil' : t); 
            }}
          >
            {getMarkerSymbol(t)}
          </button>
        ))}
      </div>

      <div className="drawing-bottom-bar" onPointerDown={stopPropagation}>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div className="drawing-stat-badge">
            H: {drawings.markers.filter(m => m.type === 'HZ').length}, O: {drawings.markers.filter(m => m.type === 'OB').length}
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button 
              className={`drawing-control-btn ${activeTool === 'eraser' ? 'active' : ''}`}
              onClick={(e) => { 
                e.preventDefault(); 
                setActiveTool(prev => prev === 'eraser' ? 'pencil' : 'eraser'); 
              }}
            >
              지우개
            </button>
            <input 
              type="color" 
              className="color-picker" 
              value={activeColor} 
              onChange={(e) => setActiveColor(e.target.value)} 
              onPointerDown={stopPropagation}
            />
            <button 
              className={`drawing-control-btn ${activeTool === 'pencil' ? 'active' : ''}`}
              onClick={(e) => { 
                e.preventDefault(); 
                setActiveTool('pencil'); 
              }}
            >
              ✎
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
