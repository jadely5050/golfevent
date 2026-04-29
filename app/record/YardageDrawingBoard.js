'use client';

import { useState, useRef, useEffect, useLayoutEffect } from 'react';

export default function YardageDrawingBoard({ holeNumber, drawingData, onSave }) {
  const [isPanelCollapsed, setIsPanelCollapsed] = useState(false);
  const [activeTool, setActiveTool] = useState('pencil');
  const [activeColor, setActiveColor] = useState('#000000');
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 });
  const [isDrawing, setIsDrawing] = useState(false);
  const [isErasing, setIsErasing] = useState(false);
  
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const imageRef = useRef(null);
  const initialPinchDist = useRef(null);
  const initialPinchCenter = useRef(null);

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
    // Origin at Left-Bottom + Pan + Scale
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
    const TX = transform.x;
    const TY = transform.y;
    
    // Reverse transform:
    // sx = TX + x_scaled
    // sy = TY + y_scaled
    // x_scaled = x_canvas * S
    // y_scaled = H - (H - y_canvas) * S
    
    return {
      x: (sx - TX) / S,
      y: H - (H - (sy - TY)) / S
    };
  };

  // Improved Eraser: check distance to line segments
  const distanceToSegment = (px, py, x1, y1, x2, y2) => {
    const l2 = Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2);
    if (l2 === 0) return Math.hypot(px - x1, py - y1);
    let t = ((px - x1) * (x2 - x1) + (py - y1) * (y2 - y1)) / l2;
    t = Math.max(0, Math.min(1, t));
    return Math.hypot(px - (x1 + t * (x2 - x1)), py - (y1 + t * (y2 - y1)));
  };

  const performErasure = (clientX, clientY) => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const pos = screenToCanvas(clientX - rect.left, clientY - rect.top);
    const threshold = 30 / transform.scale;

    setDrawings(prev => {
      const filteredPaths = prev.paths.filter(p => {
        // Check points
        if (p.points.some(pt => Math.hypot(pt.x - pos.x, pt.y - pos.y) < threshold)) return false;
        // Check segments
        for (let i = 0; i < p.points.length - 1; i++) {
          if (distanceToSegment(pos.x, pos.y, p.points[i].x, p.points[i].y, p.points[i+1].x, p.points[i+1].y) < threshold) {
            return false;
          }
        }
        return true;
      });
      
      const filteredMarkers = prev.markers.filter(m => 
        Math.hypot(m.x - pos.x, m.y - pos.y) > threshold * 1.5
      );
      
      if (filteredPaths.length === prev.paths.length && filteredMarkers.length === prev.markers.length) {
        return prev;
      }
      return { paths: filteredPaths, markers: filteredMarkers };
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
    } else if (['OB', 'HZ', 'LEFT', 'RIGHT', 'UP', 'DOWN'].includes(activeTool)) {
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
    }
  };

  const handleEnd = () => {
    if (isDrawing || isErasing) {
      setIsDrawing(false);
      setIsErasing(false);
      onSave(drawings);
    }
    initialPinchDist.current = null;
    initialPinchCenter.current = null;
  };

  const handleWheel = (e) => {
    e.preventDefault();
    const direction = e.deltaY > 0 ? 0.9 : 1.1;
    setTransform(prev => {
      const newScale = Math.min(Math.max(prev.scale * direction, 1), 5);
      if (newScale === 1) return { x: 0, y: 0, scale: 1 };
      return { ...prev, scale: newScale };
    });
  };

  const handleTouchStart = (e) => {
    if (e.touches.length === 2) {
      setIsDrawing(false);
      setIsErasing(false);
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const center = {
        x: (e.touches[0].clientX + e.touches[1].clientX) / 2,
        y: (e.touches[0].clientY + e.touches[1].clientY) / 2
      };
      initialPinchDist.current = dist;
      initialPinchCenter.current = center;
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
      
      const scaleChange = dist / initialPinchDist.current;
      const dx = center.x - initialPinchCenter.current.x;
      const dy = center.y - initialPinchCenter.current.y;

      setTransform(prev => {
        const newScale = Math.min(Math.max(prev.scale * scaleChange, 1), 5);
        if (newScale <= 1.01) {
          return { x: 0, y: 0, scale: 1 };
        }
        return {
          scale: newScale,
          x: prev.x + dx,
          y: prev.y + dy
        };
      });

      initialPinchDist.current = dist;
      initialPinchCenter.current = center;
    } else if (e.touches.length === 1 && (isDrawing || isErasing)) {
      if (isDrawing || isErasing) e.preventDefault();
      const touch = e.touches[0];
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
    <div className="drawing-board-container" ref={containerRef} onWheel={handleWheel}>
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
              color: marker.type === 'OB' || marker.type === 'HZ' ? '#334155' : marker.color,
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
