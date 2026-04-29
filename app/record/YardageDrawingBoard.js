'use client';

import { useState, useRef, useEffect } from 'react';

export default function YardageDrawingBoard({ holeNumber, drawingData, onSave }) {
  const [isPanelCollapsed, setIsPanelCollapsed] = useState(false);
  const [activeTool, setActiveTool] = useState('pencil'); // Default to pencil as requested
  const [activeColor, setActiveColor] = useState('#000000');
  const [transform, setTransform] = useState({ scale: 1 }); // Remove x, y for position lock
  const [isDrawing, setIsDrawing] = useState(false);
  
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const imageRef = useRef(null);

  // Load drawings from props
  const [drawings, setDrawings] = useState(drawingData || { paths: [], markers: [] });

  useEffect(() => {
    setDrawings(drawingData || { paths: [], markers: [] });
  }, [drawingData, holeNumber]);

  useEffect(() => {
    redrawCanvas();
  }, [drawings, transform, holeNumber]);

  const redrawCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const H = canvas.height;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    // Origin at Left-Bottom
    ctx.translate(0, H);
    ctx.scale(transform.scale, transform.scale);
    ctx.translate(0, -H);

    // Draw paths
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

  const screenToCanvas = (sx, sy) => {
    if (!containerRef.current) return { x: sx, y: sy };
    const H = containerRef.current.clientHeight;
    const S = transform.scale;
    
    // Reverse transform for Origin (0, H)
    // x_screen = x_canvas * S
    // y_screen = H - (H - y_canvas) * S
    return {
      x: sx / S,
      y: H - (H - sy) / S
    };
  };

  const handleMouseDown = (e) => {
    // If clicking on tool UI, don't start drawing
    if (e.target.closest('.drawing-tool-panel') || e.target.closest('.drawing-bottom-bar')) {
      return;
    }

    const rect = containerRef.current.getBoundingClientRect();
    const x = (e.clientX || (e.touches && e.touches[0].clientX)) - rect.left;
    const y = (e.clientY || (e.touches && e.touches[0].clientY)) - rect.top;

    if (activeTool === 'pencil') {
      setIsDrawing(true);
      const startPoint = screenToCanvas(x, y);
      const newPath = {
        id: Date.now(),
        color: activeColor,
        width: 3,
        points: [startPoint]
      };
      setDrawings(prev => ({
        ...prev,
        paths: [...prev.paths, newPath]
      }));
    } else if (['OB', 'HZ', 'LEFT', 'RIGHT', 'UP', 'DOWN'].includes(activeTool)) {
      const pos = screenToCanvas(x, y);
      const newMarker = {
        id: Date.now(),
        x: pos.x,
        y: pos.y,
        type: activeTool,
        color: activeColor
      };
      const updated = {
        ...drawings,
        markers: [...drawings.markers, newMarker]
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

  const handleMouseMove = (e) => {
    if (isDrawing && activeTool === 'pencil') {
      const rect = containerRef.current.getBoundingClientRect();
      const x = (e.clientX || (e.touches && e.touches[0].clientX)) - rect.left;
      const y = (e.clientY || (e.touches && e.touches[0].clientY)) - rect.top;
      const pos = screenToCanvas(x, y);
      
      setDrawings(prev => {
        const paths = [...prev.paths];
        if (paths.length === 0) return prev;
        const currentPath = { ...paths[paths.length - 1] };
        currentPath.points = [...currentPath.points, pos];
        paths[paths.length - 1] = currentPath;
        return { ...prev, paths };
      });
    }
  };

  const handleMouseUp = () => {
    if (isDrawing) {
      setIsDrawing(false);
      onSave(drawings);
    }
  };

  const handleWheel = (e) => {
    e.preventDefault();
    const scaleFactor = 1.1;
    const direction = e.deltaY > 0 ? 1 / scaleFactor : scaleFactor;
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

  const handleResize = () => {
    if (containerRef.current && canvasRef.current) {
      canvasRef.current.width = containerRef.current.clientWidth;
      canvasRef.current.height = containerRef.current.clientHeight;
      redrawCanvas();
    }
  };

  useEffect(() => {
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [holeNumber]);

  const clearAll = (e) => {
    e.stopPropagation();
    if (window.confirm('모든 드로잉을 지우시겠습니까?')) {
      const empty = { paths: [], markers: [] };
      setDrawings(empty);
      onSave(empty);
    }
  };

  const togglePanel = (e) => {
    e.stopPropagation();
    setIsPanelCollapsed(!isPanelCollapsed);
  };

  const selectTool = (e, tool) => {
    e.stopPropagation();
    setActiveTool(tool);
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
              // Inverse scale for markers to keep them visible but constant size? 
              // Usually markers should stay readable.
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
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchStart={(e) => {
          if (e.target === canvasRef.current) {
            handleMouseDown(e);
          }
        }}
        onTouchMove={(e) => {
          if (isDrawing) {
            e.preventDefault();
            handleMouseMove(e);
          }
        }}
        onTouchEnd={handleMouseUp}
      />

      <div className={`drawing-tool-panel ${isPanelCollapsed ? 'collapsed' : ''}`} onPointerDown={e => e.stopPropagation()}>
        <button className="drawing-tool-btn" onPointerDown={togglePanel}>
          {isPanelCollapsed ? '▲' : '▼'}
        </button>
        {['OB', 'HZ', 'LEFT', 'RIGHT', 'UP', 'DOWN'].map(t => (
          <button 
            key={t}
            className={`drawing-tool-btn ${activeTool === t ? 'active' : ''}`}
            onPointerDown={(e) => selectTool(e, t)}
          >
            {getMarkerSymbol(t)}
          </button>
        ))}
      </div>

      <div className="drawing-bottom-bar" onPointerDown={e => e.stopPropagation()}>
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div className="drawing-stat-badge">
            H: {drawings.markers.filter(m => m.type === 'HZ').length}, O: {drawings.markers.filter(m => m.type === 'OB').length}
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button 
              className={`drawing-control-btn ${activeTool === 'eraser' ? 'active' : ''}`}
              onPointerDown={(e) => selectTool(e, 'eraser')}
            >
              지우개
            </button>
            <input 
              type="color" 
              className="color-picker" 
              value={activeColor} 
              onChange={(e) => setActiveColor(e.target.value)} 
            />
            <button 
              className={`drawing-control-btn ${activeTool === 'pencil' ? 'active' : ''}`}
              onPointerDown={(e) => selectTool(e, 'pencil')}
            >
              ✎
            </button>
            <button className="drawing-control-btn" onPointerDown={clearAll} style={{ color: 'var(--danger)' }}>
              초기화
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
