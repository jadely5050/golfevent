'use client';

import { useState, useRef, useEffect, useLayoutEffect } from 'react';

export default function YardageDrawingBoard({ holeNumber, drawingData, onSave }) {
  const [isPanelCollapsed, setIsPanelCollapsed] = useState(false);
  const [activeTool, setActiveTool] = useState('pencil');
  const [activeColor, setActiveColor] = useState('#000000');
  const [transform, setTransform] = useState({ scale: 1 });
  const [isDrawing, setIsDrawing] = useState(false);
  
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const imageRef = useRef(null);

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
      x: sx / S,
      y: H - (H - sy) / S
    };
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
    } else if (['OB', 'HZ', 'LEFT', 'RIGHT', 'UP', 'DOWN'].includes(activeTool)) {
      const pos = screenToCanvas(x, y);
      const updated = {
        ...drawings,
        markers: [...drawings.markers, { id: Date.now(), x: pos.x, y: pos.y, type: activeTool, color: activeColor }]
      };
      setDrawings(updated);
      onSave(updated);
    } else if (activeTool === 'eraser') {
      const pos = screenToCanvas(x, y);
      const threshold = 20 / transform.scale;
      const updated = {
        paths: drawings.paths.filter(p => !p.points.some(pt => Math.hypot(pt.x - pos.x, pt.y - pos.y) < threshold)),
        markers: drawings.markers.filter(m => Math.hypot(m.x - pos.x, m.y - pos.y) < threshold)
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
    }
  };

  const handleEnd = () => {
    if (isDrawing) {
      setIsDrawing(false);
      onSave(drawings);
    }
  };

  const handleWheel = (e) => {
    e.preventDefault();
    const direction = e.deltaY > 0 ? 0.9 : 1.1;
    setTransform(prev => ({
      scale: Math.min(Math.max(prev.scale * direction, 1), 5)
    }));
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
          transform: `scale(${transform.scale})`,
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
        onTouchStart={(e) => {
          const touch = e.touches[0];
          handleStart(touch.clientX, touch.clientY);
        }}
        onTouchMove={(e) => {
          if (isDrawing) {
            e.preventDefault();
            const touch = e.touches[0];
            handleMove(touch.clientX, touch.clientY);
          }
        }}
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
            onPointerDown={(e) => { 
              e.preventDefault(); 
              e.stopPropagation();
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
              onPointerDown={(e) => { 
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
              value={activeColor} 
              onChange={(e) => setActiveColor(e.target.value)} 
              onPointerDown={stopPropagation}
            />
            <button 
              className={`drawing-control-btn ${activeTool === 'pencil' ? 'active' : ''}`}
              onPointerDown={(e) => { 
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

    </div>
  );
}
