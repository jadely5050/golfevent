'use client';

import { useState, useEffect, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, TouchSensor, useSensor, useSensors } from '@dnd-kit/core';
import { arrayMove, SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy, useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import exifr from 'exifr';
import { compressImage } from '../utils/imageCompression';
import YardageDrawingBoard from './YardageDrawingBoard';



const CLUBS = ['W1','W4','W7','U3','U4','I5','I6','I7','I8','I9','Pi','50','54','58','Pt'];
const SHOTS = ['↑','↱','↰','↷','↶','T','D'];
const LANDINGS = ['F','G','R','B','C','I'];
const DIST_CTRL = ['◎','↑','↓'];
const PENALTIES = ['-','O','H'];

const defaultShot = {
  club: 'W1',
  shotType: '↑',
  landing: 'F',
  distanceCtrl: '◎',
  tDis: '',
  fDis: '',
  penalty: '-',
  memo: ''
};

function SortableShotItem({ id, shot, idx, onEdit, onRemove }) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    cursor: 'pointer',
  };

  return (
    <div 
      ref={setNodeRef} 
      style={style} 
      className="shot-list-item" 
      onClick={() => onEdit(shot)}
      onMouseOver={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)'}
      onMouseOut={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.03)'}
    >
      <div>
        <span 
          {...attributes} 
          {...listeners} 
          style={{ 
            cursor: 'grab', 
            marginRight: '0.5rem', 
            color: 'var(--text-secondary)', 
            padding: '0.2rem 0.5rem', 
            touchAction: 'none',
            userSelect: 'none',
            WebkitUserSelect: 'none'
          }}
        >
          ☰
        </span>
        <strong style={{ color: 'var(--accent-neon)', marginRight: '0.3rem' }}>#{idx + 1}</strong>
        <span>{shot.club}</span>
        {shot.tDis && <span style={{ color: 'var(--text-secondary)', marginLeft: '0.3rem' }}>({shot.tDis}m)</span>}
        {shot.penalty !== '-' && <span style={{ color: 'var(--danger)', marginLeft: '0.3rem' }}>[{shot.penalty}]</span>}
      </div>
      <button 
        onPointerDown={(e) => e.stopPropagation()} 
        onClick={(e) => { e.stopPropagation(); onRemove(e, shot.id); }} 
        style={{ background: 'transparent', border: 'none', color: 'var(--text-secondary)', cursor: 'pointer', fontSize: '1.2rem', padding: '0 0.5rem' }}
      >×</button>
    </div>
  );
}

export default function RecordRound() {
  const router = useRouter();
  const searchParams = useSearchParams();
  
  // URL에서 직접 ID를 확인하여 첫 렌더링 시점의 깜빡임 방지
  const [initialEditId] = useState(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      return params.get('id');
    }
    return null;
  });

  const editId = searchParams.get('id') || initialEditId;
  const [step, setStep] = useState(editId ? 'loading' : 'setup');
  const fileInputRef = useRef(null);
  const dbRef = useRef(null);
  
  // Round Info
  const [course, setCourse] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  
  // Holes state (1-18)
  const initialHoles = Array.from({ length: 18 }, (_, i) => ({
    hole: i + 1,
    par: 4,
    fairway: 'hit', // 'hit' | 'left' | 'right' | 'miss'
    shots: [],
    drawings: { paths: [], markers: [] },
    greenDrawings: { paths: [], markers: [] }
  }));

  const [holes, setHoles] = useState(initialHoles);
  const [currentHoleIdx, setCurrentHoleIdx] = useState(0);

  // Shot Modal State
  const [showShotModal, setShowShotModal] = useState(false);
  const [shotDraft, setShotDraft] = useState(defaultShot);
  const [editingShotId, setEditingShotId] = useState(null);
  const [currentRoundId] = useState(editId || Date.now().toString());
  const [showParSettingsModal, setShowParSettingsModal] = useState(false);
  const [parDraft, setParDraft] = useState(Array(18).fill(4));
  const [courseDraft, setCourseDraft] = useState('');
  const [dateDraft, setDateDraft] = useState('');
  const [showHoleSelectModal, setShowHoleSelectModal] = useState(false);
  const [showGreenModal, setShowGreenModal] = useState(false);

  // DnD Sensors
  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(TouchSensor, {
      activationConstraint: {
        delay: 250, // 250ms press to drag on mobile
        tolerance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Initialize IndexedDB
  useEffect(() => {
    const request = indexedDB.open('golf-images', 1);
    request.onupgradeneeded = (e) => {
      const db = e.target.result;
      if (!db.objectStoreNames.contains('images')) {
        db.createObjectStore('images', { keyPath: 'id' });
      }
    };
    request.onsuccess = (e) => {
      dbRef.current = e.target.result;
    };
    request.onerror = (e) => console.error('IndexedDB Error:', e);

    // Preload all 18 yardage images and green images to browser cache
    for (let i = 1; i <= 18; i++) {
      const img = new Image();
      img.src = `/${i}h.jpg`;
      const gImg = new Image();
      gImg.src = `/g${i}.jpg`;
    }
  }, []);

  useEffect(() => {
    if (editId) {
      const fetchRoundToEdit = async () => {
        try {
          // 로컬 데이터 먼저 확인
          const saved = localStorage.getItem('golf-rounds');
          if (saved) {
            const parsed = JSON.parse(saved);
            const localRound = parsed.find(r => r.id === editId);
            if (localRound) {
              setCourse(localRound.course);
              if (localRound.date) setDate(new Date(localRound.date).toISOString().split("T")[0]);
              if (localRound.holes) setHoles(localRound.holes);
              if (localRound.lastHoleIdx !== undefined) setCurrentHoleIdx(localRound.lastHoleIdx);
              setStep('play');
              return;
            }
          }

          // 로컬에 없으면 서버 데이터 확인
          const res = await fetch(`/api/rounds`);
          const rounds = await res.json();
          if (Array.isArray(rounds)) {
            const roundToEdit = rounds.find(r => r.id === editId);
            if (roundToEdit) {
              setCourse(roundToEdit.course);
              if (roundToEdit.date) setDate(new Date(roundToEdit.date).toISOString().split("T")[0]);
              if (roundToEdit.holes) setHoles(roundToEdit.holes);
              if (roundToEdit.lastHoleIdx !== undefined) setCurrentHoleIdx(roundToEdit.lastHoleIdx);
              setStep('play');
            } else {
              setStep('setup');
            }
          }
        } catch (err) {
          console.error('Error fetching round to edit:', err);
          setStep('setup');
        }
      };
      fetchRoundToEdit();
    }
  }, [editId]);

  const currentHole = holes[currentHoleIdx];
  const currentShots = currentHole.shots || [];
  const totalObCount = holes.reduce((acc, h) => acc + (h.shots || []).filter(s => s.penalty === 'O').length, 0);
  const totalHazardCount = holes.reduce((acc, h) => acc + (h.shots || []).filter(s => s.penalty === 'H').length, 0);

  const computeScore = (shots, par) => shots.length + shots.reduce((acc, s, idx) => {
    let penalty = 0;
    if (s.penalty === 'O') {
      penalty = (par >= 4 && idx === 0) ? 2 : 1;
    } else if (s.penalty === 'H') {
      penalty = 1;
    }
    return acc + penalty;
  }, 0);
  const computePutts = (shots) => shots.filter(s => s.club === 'Pt').length;

  const updateHole = (field, value) => {
    const newHoles = [...holes];
    newHoles[currentHoleIdx] = { ...newHoles[currentHoleIdx], [field]: value };
    setHoles(newHoles);
  };

  const handleStart = () => {
    if (!course) return alert('골프장 이름을 입력해주세요.');
    setStep('play');
  };

  const saveCurrentRound = async () => {
    const totalScore = holes.reduce((sum, h) => sum + computeScore(h.shots || [], h.par), 0);
    const totalPar = holes.reduce((sum, h) => sum + h.par, 0);
    const totalPutts = holes.reduce((sum, h) => sum + computePutts(h.shots || []), 0);
    
    const finalHoles = holes.map(h => ({
      ...h,
      score: computeScore(h.shots || [], h.par),
      putts: computePutts(h.shots || [])
    }));

    const roundData = {
      id: currentRoundId,
      date,
      course,
      score: totalScore,
      par: totalPar,
      putts: totalPutts,
      lastHoleIdx: currentHoleIdx,
      holes: finalHoles
    };
    
    // Save to localStorage
    const saved = localStorage.getItem('golf-rounds');
    let parsed = saved ? JSON.parse(saved) : [];
    if (!Array.isArray(parsed)) parsed = [];
    const filtered = parsed.filter(r => r.id !== currentRoundId);
    localStorage.setItem('golf-rounds', JSON.stringify([...filtered, roundData]));
  };

  useEffect(() => {
    if (step === 'play') {
      saveCurrentRound();
    }
  }, [holes, course, date, step, currentRoundId, currentHoleIdx]);

  const handleFinish = () => {
    saveCurrentRound();
    router.push('/');
  };

  const openAddShotModal = () => {
    setEditingShotId(null);
    setShotDraft(defaultShot);
    setShowShotModal(true);
  };

  const openEditShotModal = (shot) => {
    setEditingShotId(shot.id);
    setShotDraft({ ...shot });
    setShowShotModal(true);
  };

  const saveShot = () => {
    const newHoles = [...holes];
    const hole = newHoles[currentHoleIdx];
    hole.shots = hole.shots || [];
    
    if (editingShotId) {
      hole.shots = hole.shots.map(s => s.id === editingShotId ? { ...shotDraft } : s);
    } else {
      hole.shots.push({ ...shotDraft, id: Date.now().toString() });
      
      // Auto-add concede putt
      if (shotDraft.club === 'Pt' && shotDraft.landing === 'C') {
        hole.shots.push({
          ...defaultShot,
          club: 'Pt',
          landing: 'C',
          memo: '컨시드',
          id: (Date.now() + 1).toString()
        });
      }
    }
    
    setHoles(newHoles);
    setShowShotModal(false);
  };

  const removeShot = (e, shotId) => {
    e.stopPropagation(); // prevent opening edit modal
    const newHoles = [...holes];
    const hole = newHoles[currentHoleIdx];
    hole.shots = hole.shots.filter(s => s.id !== shotId);
    setHoles(newHoles);
  };

  const handleDragEnd = (event) => {
    const { active, over } = event;
    
    if (over && active.id !== over.id) {
      const newHoles = [...holes];
      const hole = newHoles[currentHoleIdx];
      const oldIndex = hole.shots.findIndex(s => s.id === active.id);
      const newIndex = hole.shots.findIndex(s => s.id === over.id);
      
      hole.shots = arrayMove(hole.shots, oldIndex, newIndex);
      setHoles(newHoles);
    }
  };

  const saveToIndexedDB = (file, latitude, longitude, hole) => {
    if (!dbRef.current) return console.error('DB not initialized');

    const transaction = dbRef.current.transaction(['images'], 'readwrite');
    const objectStore = transaction.objectStore('images');

    const timestamp = new Date().toISOString();
    const formattedTime = new Date().toLocaleString('ko-KR');
    const fileWrapper = {
      id: timestamp + Math.random(),
      hole: hole,
      file: file,
      addedAt: timestamp,
      latitude: latitude,
      longitude: longitude,
      roundId: currentRoundId
    };

    const request = objectStore.add(fileWrapper);
    request.onsuccess = () => {
      alert(`사진이 기기에 저장되었습니다.\n📍 위치: ${latitude || '정보 없음'}, ${longitude || '정보 없음'}\n⏰ 시간: ${formattedTime}`);
    };
    request.onerror = (e) => console.error('Save failed:', e);
  };

  const handleCameraChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      // 1. GPS 정보 추출 (원본 파일에서)
      const gps = await exifr.gps(file);
      
      // 2. 이미지 압축
      const compressedBlob = await compressImage(file, { maxWidth: 1280, quality: 0.7 });
      
      // Blob을 File 객체로 변환 (기존 코드와의 호환성을 위해 이름 유지)
      const compressedFile = new File([compressedBlob], file.name, { type: 'image/jpeg' });

      if (gps && gps.latitude && gps.longitude) {
        saveToIndexedDB(compressedFile, gps.latitude, gps.longitude, currentHole.hole);
      } else if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => saveToIndexedDB(compressedFile, pos.coords.latitude, pos.coords.longitude, currentHole.hole),
          (err) => {
            console.warn('Geolocation error:', err);
            saveToIndexedDB(compressedFile, null, null, currentHole.hole);
          }
        );
      } else {
        saveToIndexedDB(compressedFile, null, null, currentHole.hole);
      }
    } catch (err) {
      console.error('Camera process error:', err);
      // 실패 시 원본이라도 저장 시도
      saveToIndexedDB(file, null, null, currentHole.hole);
    }
  };


  if (step === 'loading') {
    return (
      <div className="record-container" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'center', gap: '1rem' }}>
        <div className="glass-panel" style={{ padding: '2rem', textAlign: 'center' }}>
          <div style={{ color: 'var(--accent-neon)', fontSize: '1.2rem', marginBottom: '1rem' }}>라운드 데이터를 불러오는 중...</div>
          <div className="loader"></div>
        </div>
        <style dangerouslySetInnerHTML={{__html: `
          .loader { border: 3px solid rgba(255,255,255,0.1); border-top: 3px solid var(--accent-neon); border-radius: 50%; width: 30px; height: 30px; animation: spin 1s linear infinite; }
          @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
        `}} />
      </div>
    );
  }

  // 이중 보안: step이 setup이더라도 URL에 id가 있으면 설정창을 보여주지 않음
  if (step === 'setup' && !editId) {
    return (
      <div className="record-container">
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100%', padding: '1rem' }}>
          <div className="glass-panel" style={{ animation: 'fadeIn 0.4s ease-out', width: '100%', maxWidth: '400px', margin: 0 }}>
            <style dangerouslySetInnerHTML={{__html: `
              @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
            `}} />
            <h2>라운드 기본 정보</h2>
            <div className="form-group">
              <label className="form-label">골프장 (코스명)</label>
              <input 
                type="text" 
                className="form-input" 
                placeholder="예: 클럽72 오션코스"
                value={course}
                onChange={(e) => setCourse(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label">날짜</label>
              <input 
                type="date" 
                className="form-input" 
                value={date}
                onChange={(e) => setDate(e.target.value)}
                onClick={(e) => e.target.showPicker && e.target.showPicker()}
                style={{ cursor: 'pointer' }}
              />
            </div>
            <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
              <button className="btn btn-secondary" onClick={() => router.push('/')}>
                돌아가기
              </button>
              <button className="btn btn-primary" onClick={handleStart}>
                기록 시작
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  const totalRoundScore = holes.reduce((sum, h) => sum + computeScore(h.shots || [], h.par), 0);
  const totalRoundPar = holes.reduce((sum, h) => sum + h.par, 0);
  const currentHoleScore = computeScore(currentShots, currentHole.par);
  const currentHolePutts = computePutts(currentShots);

  const openParSettings = () => {
    setCourseDraft(course);
    setDateDraft(date);
    setParDraft(holes.map(h => h.par));
    setShowParSettingsModal(true);
  };

  const saveParSettings = () => {
    setCourse(courseDraft);
    setDate(dateDraft);
    const newHoles = [...holes];
    parDraft.forEach((p, i) => {
      newHoles[i].par = p;
    });
    setHoles(newHoles);
    setShowParSettingsModal(false);
  };

  const deleteRound = async () => {
    if (window.confirm('이 라운드를 삭제하시겠습니까? 데이터는 복구할 수 없습니다.')) {
      try {
        await fetch(`/api/rounds/${currentRoundId}`, { method: 'DELETE' });
        const saved = localStorage.getItem('golf-rounds');
        if (saved) {
          const parsed = JSON.parse(saved);
          const filtered = parsed.filter(r => r.id !== currentRoundId);
          localStorage.setItem('golf-rounds', JSON.stringify(filtered));
        }
        router.push('/');
      } catch (err) {
        console.error('Delete failed:', err);
        alert('삭제 중 오류가 발생했습니다.');
      }
    }
  };

  return (
    <div className="record-container">
      <div className="hole-yardage-container">
        <YardageDrawingBoard 
          holeNumber={currentHole.hole} 
          drawingData={currentHole.drawings} 
          obCount={totalObCount}
          hazardCount={totalHazardCount}
          onSave={(data) => {
            const newHoles = [...holes];
            newHoles[currentHoleIdx] = { ...newHoles[currentHoleIdx], drawings: data };
            setHoles(newHoles);
          }}
        />
      </div>


      <div className="round-info-panel">
        <div className="glass-panel" style={{ padding: '0.75rem', marginBottom: '0', borderRadius: '12px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ margin: 0, fontSize: '1rem', color: 'white' }}>{course}</h3>
            <button onClick={openParSettings} style={{ background: 'transparent', border: 'none', cursor: 'pointer', fontSize: '1.1rem', padding: 0 }}>⚙️</button>
          </div>
          <div style={{ color: 'white', fontSize: '0.9rem', marginTop: '0.25rem' }}>
            TOTAL: <strong style={{ color: 'var(--accent-neon)' }}>{totalRoundScore}</strong> / {totalRoundPar}
          </div>
        </div>
      </div>

      <div className="record-side-panel">
        <div style={{ animation: 'fadeIn 0.3s ease-out', paddingBottom: '2rem' }}>
          <div className="glass-panel" style={{ padding: '0.75rem 1rem' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid var(--glass-border)', paddingBottom: '0.5rem', marginBottom: '0.5rem' }}>
              <h2 
                style={{ margin: 0, color: 'var(--accent-neon)', fontSize: '1.5rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.5rem' }}
                onClick={() => setShowHoleSelectModal(true)}
              >
                {currentHole.hole}H <span style={{ fontSize: '1rem', color: 'var(--text-secondary)' }}>▾</span>
              </h2>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '1.1rem', fontWeight: 'bold', color: 'white' }}>PAR {currentHole.par}</div>
                </div>
              </div>
            </div>

            <div style={{ paddingBottom: '0.25rem' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end' }}>
                <div style={{ display: 'flex', gap: '1rem' }}>
                  <div>
                    <span style={{ color: 'white', fontSize: '0.7rem', display: 'block', marginBottom: '0.1rem' }}>SCORE</span>
                    <strong style={{ fontSize: '1.2rem', color: currentHoleScore <= currentHole.par && currentHoleScore > 0 ? 'var(--accent-neon)' : 'white' }}>
                      {currentHoleScore}
                    </strong>
                  </div>
                  <div>
                    <span style={{ color: 'white', fontSize: '0.7rem', display: 'block', marginBottom: '0.1rem' }}>PUTT</span>
                    <strong style={{ fontSize: '1.2rem', color: 'white' }}>
                      {currentHolePutts}
                    </strong>
                  </div>
                </div>
                <div style={{ textAlign: 'right', display: 'flex', gap: '0.75rem' }}>
                  <div>
                    <span style={{ color: 'white', fontSize: '0.7rem', display: 'block', marginBottom: '0.1rem' }}>H</span>
                    <strong style={{ fontSize: '1.2rem', color: 'white' }}>{totalHazardCount}</strong>
                  </div>
                  <div>
                    <span style={{ color: 'white', fontSize: '0.7rem', display: 'block', marginBottom: '0.1rem' }}>O</span>
                    <strong style={{ fontSize: '1.2rem', color: 'white' }}>{totalObCount}</strong>
                  </div>
                </div>
              </div>
            </div>
            </div>
            
            <div className="shot-list-container" style={{ marginTop: '0', borderTop: '1px solid var(--glass-border)', paddingTop: '0' }}>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '0.3rem', marginTop: '0' }}>
              <button className="btn btn-primary" style={{ width: 'auto', padding: '0.6rem 1.2rem', fontSize: '1.2rem' }} onClick={openAddShotModal}>
                SHOT+
              </button>
            </div>
            
            {currentShots.length === 0 ? (
              <p style={{ textAlign: 'center', fontSize: '0.9rem', color: 'var(--text-secondary)', padding: '1rem 0' }}>등록된 샷이 없습니다.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', maxHeight: '220px', overflowY: 'auto', paddingRight: '4px' }}>
                <DndContext 
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleDragEnd}
                >
                  <SortableContext 
                    items={currentShots.map(s => s.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    {currentShots.map((shot, idx) => (
                      <SortableShotItem 
                        key={shot.id} 
                        id={shot.id} 
                        shot={shot} 
                        idx={idx} 
                        onEdit={openEditShotModal} 
                        onRemove={removeShot} 
                      />
                    ))}
                  </SortableContext>
                </DndContext>
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="fixed-nav-buttons" style={{ flexDirection: 'column', alignItems: 'flex-end', gap: '0.5rem' }}>
        <input 
          type="file" 
          accept="image/*" 
          capture="environment" 
          ref={fileInputRef} 
          style={{ display: 'none' }} 
          onChange={handleCameraChange}
        />
        
        <div 
          className="glass-panel" 
          style={{ 
            width: '144px', 
            padding: '0.4rem', 
            marginBottom: '0', 
            cursor: 'pointer',
            overflow: 'hidden',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            border: '1px solid var(--accent-neon)',
            borderRadius: '16px'
          }}
          onClick={() => setShowGreenModal(true)}
        >
          <div style={{ fontSize: '0.65rem', color: 'var(--text-secondary)', marginBottom: '0.15rem' }}>GREEN</div>
          <img 
            src={`/g${currentHole.hole}.jpg`} 
            alt="Green Preview" 
            style={{ width: '100%', aspectRatio: '1/1', objectFit: 'cover', borderRadius: '10px' }}
          />
        </div>
        <button 
          className="btn btn-secondary" 
          style={{ width: 'auto', padding: '0.75rem 1rem', boxShadow: '0 4px 12px rgba(0,0,0,0.5)', background: 'var(--accent-neon)', color: 'black', fontWeight: 'bold' }} 
          onClick={() => fileInputRef.current?.click()}
        >
          CAM
        </button>

        <div style={{ display: 'flex', gap: '0.75rem' }}>
          {currentHoleIdx > 0 && (
            <button className="btn btn-secondary" style={{ width: 'auto', padding: '0.75rem 1rem', boxShadow: '0 4px 12px rgba(0,0,0,0.5)' }} onClick={() => setCurrentHoleIdx(i => i - 1)}>
              &lt;&lt;
            </button>
          )}
          
          {currentHoleIdx < 17 && (
            <button className="btn btn-primary" style={{ width: 'auto', padding: '0.75rem 1rem', boxShadow: '0 4px 12px rgba(0,0,0,0.5)' }} onClick={() => setCurrentHoleIdx(i => i + 1)}>
              &gt;&gt;
            </button>
          )}
        </div>
      </div>


      {showShotModal && (
        <div className="modal-overlay" onClick={() => setShowShotModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h3 style={{ marginTop: 0, marginBottom: '0.5rem', color: 'var(--accent-neon)', fontSize: '1rem' }}>
              {editingShotId ? '샷 기록 수정' : '새로운 샷 기록'}
            </h3>
            
            <div className="form-group">
              <label className="form-label" style={{ textAlign: 'right' }}>CLUB</label>
              <div className="chip-group">
                {CLUBS.map(c => (
                  <div key={c} className={`chip ${shotDraft.club === c ? 'active' : ''}`} onClick={() => setShotDraft({...shotDraft, club: c})}>
                    {c}
                  </div>
                ))}
              </div>
            </div>

            <div className="form-group">
              <label className="form-label" style={{ textAlign: 'right' }}>SHOT</label>
              <div className="chip-group">
                {SHOTS.map(s => (
                  <div key={s} className={`chip ${shotDraft.shotType === s ? 'active' : ''}`} onClick={() => setShotDraft({...shotDraft, shotType: s})}>
                    {s}
                  </div>
                ))}
              </div>
            </div>

            <div className="form-group">
              <label className="form-label" style={{ textAlign: 'right' }}>LANDING</label>
              <div className="chip-group">
                {LANDINGS.map(l => (
                  <div key={l} className={`chip ${shotDraft.landing === l ? 'active' : ''}`} onClick={() => setShotDraft({...shotDraft, landing: l})}>
                    {l}
                  </div>
                ))}
              </div>
            </div>

            <div className="form-group">
              <label className="form-label" style={{ textAlign: 'right' }}>DISTANCE</label>
              <div className="chip-group">
                {DIST_CTRL.map(d => (
                  <div key={d} className={`chip ${shotDraft.distanceCtrl === d ? 'active' : ''}`} onClick={() => setShotDraft({...shotDraft, distanceCtrl: d})}>
                    {d}
                  </div>
                ))}
              </div>
              <div className="distance-inputs" style={{ marginTop: '0.25rem' }}>
                <div className="distance-input-wrapper">
                  <span style={{ fontSize: '0.7rem' }}>T.Dis</span>
                  <input type="number" className="form-input" style={{ padding: '0.3rem', fontSize: '0.8rem' }} value={shotDraft.tDis} onChange={e => setShotDraft({...shotDraft, tDis: e.target.value})} />
                </div>
                <div className="distance-input-wrapper">
                  <span style={{ fontSize: '0.7rem' }}>F.Dis</span>
                  <input type="number" className="form-input" style={{ padding: '0.3rem', fontSize: '0.8rem' }} value={shotDraft.fDis} onChange={e => setShotDraft({...shotDraft, fDis: e.target.value})} />
                </div>
              </div>
            </div>

            <div className="form-group">
              <label className="form-label" style={{ textAlign: 'right' }}>Penalty</label>
              <div className="chip-group">
                {PENALTIES.map(p => (
                  <div key={p} className={`chip ${shotDraft.penalty === p ? 'active' : ''}`} onClick={() => setShotDraft({...shotDraft, penalty: p})}>
                    {p}
                  </div>
                ))}
              </div>
            </div>

            <div className="form-group">
              <label className="form-label" style={{ textAlign: 'right' }}>Memo</label>
              <input 
                type="text"
                className="form-input" 
                style={{ padding: '0.3rem', fontSize: '0.8rem', textAlign: 'right' }}
                value={shotDraft.memo} 
                onChange={e => setShotDraft({...shotDraft, memo: e.target.value})}
                placeholder="간단한 메모"
              />
            </div>

            <div style={{ display: 'flex', gap: '1rem', marginTop: '0.75rem' }}>
              <button className="btn btn-secondary" onClick={() => setShowShotModal(false)}>취소</button>
              <button className="btn btn-primary" onClick={saveShot}>
                {editingShotId ? '수정 완료' : '추가'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showParSettingsModal && (
        <div className="modal-overlay" onClick={() => setShowParSettingsModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h3 style={{ marginTop: 0, color: 'var(--accent-neon)' }}>라운드 설정</h3>
            
            <div className="form-group" style={{ marginBottom: '1rem' }}>
              <label className="form-label" style={{ fontSize: '0.8rem' }}>골프장 (코스명)</label>
              <input 
                type="text" 
                className="form-input" 
                value={courseDraft}
                onChange={(e) => setCourseDraft(e.target.value)}
                style={{ padding: '0.5rem', fontSize: '0.9rem' }}
              />
            </div>
            
            <div className="form-group" style={{ marginBottom: '1.5rem' }}>
              <label className="form-label" style={{ fontSize: '0.8rem' }}>날짜</label>
              <input 
                type="date" 
                className="form-input" 
                value={dateDraft}
                onChange={(e) => setDateDraft(e.target.value)}
                onClick={(e) => e.target.showPicker && e.target.showPicker()}
                style={{ cursor: 'pointer', padding: '0.5rem', fontSize: '0.9rem' }}
              />
            </div>

            <div style={{ background: 'rgba(255, 255, 255, 0.03)', padding: '1rem', borderRadius: '8px', marginBottom: '1rem' }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(9, 1fr)', gap: '4px', textAlign: 'center', marginBottom: '4px' }}>
                {parDraft.slice(0, 9).map((_, i) => <div key={i} style={{fontSize: '0.8rem', color: 'var(--text-secondary)'}}>{i+1}</div>)}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(9, 1fr)', gap: '4px' }}>
                {parDraft.slice(0, 9).map((p, i) => (
                  <select 
                    key={i} 
                    value={p} 
                    onChange={(e) => {
                      const newDraft = [...parDraft];
                      newDraft[i] = parseInt(e.target.value);
                      setParDraft(newDraft);
                    }}
                    style={{ padding: '6px 0', background: '#334155', color: 'white', border: 'none', borderRadius: '4px', textAlign: 'center', appearance: 'none', width: '100%', fontSize: '0.9rem' }}
                  >
                    <option value={3}>3</option>
                    <option value={4}>4</option>
                    <option value={5}>5</option>
                  </select>
                ))}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(9, 1fr)', gap: '4px', textAlign: 'center', marginTop: '1.5rem', marginBottom: '4px' }}>
                {parDraft.slice(9, 18).map((_, i) => <div key={i+9} style={{fontSize: '0.8rem', color: 'var(--text-secondary)'}}>{i+10}</div>)}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(9, 1fr)', gap: '4px' }}>
                {parDraft.slice(9, 18).map((p, i) => (
                  <select 
                    key={i+9} 
                    value={p} 
                    onChange={(e) => {
                      const newDraft = [...parDraft];
                      newDraft[i+9] = parseInt(e.target.value);
                      setParDraft(newDraft);
                    }}
                    style={{ padding: '6px 0', background: '#334155', color: 'white', border: 'none', borderRadius: '4px', textAlign: 'center', appearance: 'none', width: '100%', fontSize: '0.9rem' }}
                  >
                    <option value={3}>3</option>
                    <option value={4}>4</option>
                    <option value={5}>5</option>
                  </select>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '1rem', marginTop: '2rem' }}>
              <button className="btn btn-secondary" onClick={() => setShowParSettingsModal(false)}>취소</button>
              <button className="btn btn-primary" onClick={saveParSettings}>설정 저장</button>
            </div>

            <button 
              className="btn btn-secondary"
              style={{ marginTop: '1rem' }}
              onClick={() => { setShowParSettingsModal(false); handleFinish(); }}
            >
              라운드 종료
            </button>
            
            <button 
              style={{ width: '100%', marginTop: '0.5rem', padding: '0.8rem', background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#ef4444', borderRadius: '8px', cursor: 'pointer', fontWeight: 'bold' }}
              onClick={deleteRound}
            >
              라운드 영구 삭제
            </button>
          </div>
        </div>
      )}

      {showHoleSelectModal && (
        <div className="modal-overlay" onClick={() => setShowHoleSelectModal(false)}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <h3 style={{ marginTop: 0, color: 'var(--accent-neon)' }}>홀 선택</h3>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem', marginTop: '1rem' }}>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <div style={{ textAlign: 'center', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>OUT (1~9)</div>
                {holes.slice(0, 9).map((h, i) => (
                  <button 
                    key={i} 
                    className={`btn ${currentHoleIdx === i ? 'btn-primary' : 'btn-secondary'}`} 
                    onClick={() => {setCurrentHoleIdx(i); setShowHoleSelectModal(false);}}
                    style={{ padding: '0.5rem' }}
                  >
                    {h.hole}H
                  </button>
                ))}
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
                <div style={{ textAlign: 'center', fontSize: '0.8rem', color: 'var(--text-secondary)' }}>IN (10~18)</div>
                {holes.slice(9, 18).map((h, i) => (
                  <button 
                    key={i+9} 
                    className={`btn ${currentHoleIdx === i+9 ? 'btn-primary' : 'btn-secondary'}`} 
                    onClick={() => {setCurrentHoleIdx(i+9); setShowHoleSelectModal(false);}}
                    style={{ padding: '0.5rem' }}
                  >
                    {h.hole}H
                  </button>
                ))}
              </div>
            </div>
            <button className="btn btn-secondary" style={{ marginTop: '1.5rem', width: '100%' }} onClick={() => setShowHoleSelectModal(false)}>닫기</button>
          </div>
        </div>
      )}

      {showGreenModal && (
        <div className="modal-overlay" onClick={() => setShowGreenModal(false)}>
          <div 
            className="glass-panel" 
            onClick={e => e.stopPropagation()} 
            style={{ 
              position: 'relative',
              width: '90vw', 
              maxWidth: '500px', 
              aspectRatio: '1/1', 
              padding: 0, 
              overflow: 'hidden',
              display: 'flex',
              flexDirection: 'column',
              margin: 0
            }}
          >
            <div style={{ position: 'absolute', top: '10px', right: '10px', zIndex: 1000 }}>
               <button 
                 onClick={() => setShowGreenModal(false)}
                 style={{ background: 'rgba(0,0,0,0.5)', border: 'none', color: 'white', fontSize: '1.5rem', width: '40px', height: '40px', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
               >
                 ×
               </button>
            </div>
            <YardageDrawingBoard 
              holeNumber={currentHole.hole}
              mode="green"
              imageUrl={`/g${currentHole.hole}.jpg`}
              drawingData={currentHole.greenDrawings}
              onSave={(data) => {
                const newHoles = [...holes];
                newHoles[currentHoleIdx] = { ...newHoles[currentHoleIdx], greenDrawings: data };
                setHoles(newHoles);
              }}
            />
          </div>
        </div>
      )}
    </div>
  );
}
