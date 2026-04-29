'use client';

import { useState, useRef, useEffect } from 'react';

export default function YardageDrawingBoard({ holeNumber, drawingData, onSave }) {
  const [isPanelCollapsed, setIsPanelCollapsed] = useState(false);
  const [activeTool, setActiveTool] = useState('pan'); // 'pan', 'pencil', 'eraser', 'OB', 'HZ', 'LEFT', 'RIGHT', 'UP', 'DOWN'
  const [activeColor, setActiveColor] = useState('#000000');
  const [transform, setTransform] = useState({ x: 0, y: 0, scale: 1 });
  const [isDrawing, setIsDrawing] = useState(false);
  const [isPanning, setIsPanning] = useState(false);
  
  const containerRef = useRef(null);
  const canvasRef = useRef(null);
  const imageRef = useRef(null);
  const lastPoint = useRef({ x: 0, y: 0 });

  // Load drawings from props
  const [drawings, setDrawings] = useState(drawingData || { paths: [], markers: [] });

  useEffect(() => {
    setDrawings(drawingData || { paths: [], markers: [] });
  }, [drawingData, holeNumber]);

  useEffect(() => {
    redrawCanvas();
  }, [drawings, transform]);

  const redrawCanvas = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    ctx.save();
    ctx.translate(transform.x, transform.y);
    ctx.scale(transform.scale, transform.scale);

    // Draw paths
    drawings.paths.forEach(path => {
      if (path.points.length < 2) return;
      ctx.beginPath();
      ctx.strokeStyle = path.color;
      ctx.lineWidth = path.width / transform.scale;
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

  const handleMouseDown = (e) => {
    const rect = containerRef.current.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

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
      lastPoint.current = startPoint;
    } else if (activeTool === 'pan') {
      setIsPanning(true);
      lastPoint.current = { x: e.clientX, y: e.clientY };
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
      // Simple eraser: remove paths/markers near click
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
      const pos = screenToCanvas(e.clientX - rect.left, e.clientY - rect.top);
      
      setDrawings(prev => {
        const paths = [...prev.paths];
        const currentPath = { ...paths[paths.length - 1] };
        currentPath.points = [...currentPath.points, pos];
        paths[paths.length - 1] = currentPath;
        return { ...prev, paths };
      });
    } else if (isPanning && activeTool === 'pan') {
      const dx = e.clientX - lastPoint.current.x;
      const dy = e.clientY - lastPoint.current.y;
      setTransform(prev => ({ ...prev, x: prev.x + dx, y: prev.y + dy }));
      lastPoint.current = { x: e.clientX, y: e.clientY };
    }
  };

  const handleMouseUp = () => {
    if (isDrawing) {
      setIsDrawing(false);
      onSave(drawings);
    }
    setIsPanning(false);
  };

  const handleWheel = (e) => {
    e.preventDefault();
    const scaleFactor = 1.1;
    const direction = e.deltaY > 0 ? 1 / scaleFactor : scaleFactor;
    
    const rect = containerRef.current.getBoundingClientRect();
    const mouseX = e.clientX - rect.left;
    const mouseY = e.clientY - rect.top;

    setTransform(prev => {
      const newScale = Math.min(Math.max(prev.scale * direction, 0.5), 5);
      const actualDirection = newScale / prev.scale;
      
      return {
        scale: newScale,
        x: mouseX - (mouseX - prev.x) * actualDirection,
        y: mouseY - (mouseY - prev.y) * actualDirection
      };
    });
  };

  const screenToCanvas = (sx, sy) => {
    return {
      x: (sx - transform.x) / transform.scale,
      y: (sy - transform.y) / transform.scale
    };
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
  }, []);

  const clearAll = () => {
    if (window.confirm('모든 드로잉을 지우시겠습니까?')) {
      const empty = { paths: [], markers: [] };
      setDrawings(empty);
      onSave(empty);
    }
  };

  return (
    <div className="drawing-board-container" ref={containerRef} onWheel={handleWheel}>
      <div 
        style={{ 
          transform: `translate(${transform.x}px, ${transform.y}px) scale(${transform.scale})`,
          transformOrigin: '0 0',
          position: 'absolute',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%'
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
              color: marker.type === 'OB' || marker.type === 'HZ' ? '#334155' : marker.color
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
          const touch = e.touches[0];
          handleMouseDown({ clientX: touch.clientX, clientY: touch.clientY });
        }}
        onTouchMove={(e) => {
          const touch = e.touches[0];
          handleMouseMove({ clientX: touch.clientX, clientY: touch.clientY });
        }}
        onTouchEnd={handleMouseUp}
      />

      <div className={`drawing-tool-panel ${isPanelCollapsed ? 'collapsed' : ''}`}>
        <button className="drawing-tool-btn" onClick={() => setIsPanelCollapsed(!isPanelCollapsed)}>
          {isPanelCollapsed ? '▲' : '▼'}
        </button>
        {['OB', 'HZ', 'LEFT', 'RIGHT', 'UP', 'DOWN'].map(t => (
          <button 
            key={t}
            className={`drawing-tool-btn ${activeTool === t ? 'active' : ''}`}
            onClick={() => setActiveTool(t)}
          >
            {getMarkerSymbol(t)}
          </button>
        ))}
      </div>

      <div className="drawing-bottom-bar">
        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <div className="drawing-stat-badge">
            H: {drawings.markers.filter(m => m.type === 'HZ').length}, O: {drawings.markers.filter(m => m.type === 'OB').length}
          </div>
          <div style={{ display: 'flex', gap: '0.5rem' }}>
            <button 
              className={`drawing-control-btn ${activeTool === 'eraser' ? 'active' : ''}`}
              onClick={() => setActiveTool('eraser')}
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
              onClick={() => setActiveTool('pencil')}
            >
              ✎
            </button>
            <button 
              className={`drawing-control-btn ${activeTool === 'pan' ? 'active' : ''}`}
              onClick={() => setActiveTool('pan')}
            >
              ✋
            </button>
            <button className="drawing-control-btn" onClick={clearAll} style={{ color: 'var(--danger)' }}>
              초기화
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
