'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { compressImage } from '../utils/imageCompression';

const DEFAULT_PAR = [4, 4, 4, 3, 4, 3, 5, 4, 5, 4, 4, 5, 4, 3, 4, 5, 3, 4];
const RESERVED = ['api', 'go', 'generate', 'dashboard', 'record', '_next', 'public', 'static'];
const DEFAULT_GROUP = () => ({ _id: Date.now() + Math.random(), course: '', time: '', players: '', start: 'valley' });

// ── Sub-components ──────────────────────────────────────────────────────────

function Section({ title, children, badge }) {
  const [open, setOpen] = useState(true);
  return (
    <div style={{ marginBottom: '0.75rem', border: '1px solid var(--glass-border)', borderRadius: '12px', overflow: 'hidden' }}>
      <div onClick={() => setOpen(!open)} style={{ padding: '0.85rem 1rem', cursor: 'pointer', display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(255,255,255,0.04)', userSelect: 'none' }}>
        <span style={{ fontWeight: '700', fontSize: '0.95rem' }}>{title}{badge && <span style={{ marginLeft: '0.5rem', fontSize: '0.7rem', background: 'var(--accent-neon)', color: '#000', borderRadius: '4px', padding: '1px 5px' }}>{badge}</span>}</span>
        <span style={{ color: 'var(--text-secondary)', fontSize: '0.8rem' }}>{open ? '▲' : '▼'}</span>
      </div>
      {open && <div style={{ padding: '1rem' }}>{children}</div>}
    </div>
  );
}

function FormRow({ label, children }) {
  return (
    <div style={{ marginBottom: '0.6rem' }}>
      <label style={{ display: 'block', fontSize: '0.72rem', color: 'var(--text-secondary)', marginBottom: '0.25rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{label}</label>
      {children}
    </div>
  );
}

const inp = {
  width: '100%', background: 'rgba(0,0,0,0.25)', border: '1px solid var(--glass-border)',
  borderRadius: '8px', padding: '0.65rem 0.8rem', color: 'white', fontSize: '0.9rem',
};

// Accepts File (new) or string URL (existing) or null
function ImageSlot({ hole, fileOrUrl, onChange }) {
  const ref = useRef(null);
  const isFile = fileOrUrl instanceof File;
  const isUrl = typeof fileOrUrl === 'string' && fileOrUrl.length > 0;
  const preview = isFile ? URL.createObjectURL(fileOrUrl) : (isUrl ? fileOrUrl : null);

  return (
    <div onClick={() => ref.current?.click()} style={{ border: `1px solid ${preview ? 'var(--accent-neon)' : 'var(--glass-border)'}`, borderRadius: '8px', overflow: 'hidden', cursor: 'pointer', background: 'rgba(0,0,0,0.2)', position: 'relative', aspectRatio: '9/16' }}>
      <input ref={ref} type="file" accept="image/*" style={{ display: 'none' }} onChange={e => e.target.files[0] && onChange(e.target.files[0])} />
      {preview ? (
        <img src={preview} alt={`H${hole}`} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
      ) : (
        <div style={{ width: '100%', height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '2px' }}>
          <span style={{ fontSize: '1rem' }}>+</span>
          <span style={{ fontSize: '0.6rem', color: 'var(--text-secondary)' }}>H{hole}</span>
        </div>
      )}
      <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, textAlign: 'center', fontSize: '0.6rem', background: isFile ? 'rgba(16,185,129,0.7)' : 'rgba(0,0,0,0.6)', color: 'white', padding: '1px 0' }}>
        H{hole}{isFile ? ' ✓' : ''}
      </div>
    </div>
  );
}

function TipUploadRow({ valleyName, lakeName, status, error, valleyTips, lakeTips, valleyCount, lakeCount, onUpload, onClear }) {
  const ref = useRef(null);
  const totalFilled = valleyTips.filter(t => t.tip).length + lakeTips.filter(t => t.tip).length;
  const color = status === 'loading' ? '#facc15' : status === 'done' ? 'var(--accent-neon)' : status === 'error' ? '#ef4444' : 'var(--text-secondary)';
  const msg = status === 'loading' ? 'Gemini 변환 중... (수 초 소요)' : status === 'done' ? `✓ 1H ${valleyCount}/9 · 10H ${lakeCount}/9 추출됨` : status === 'error' ? `✗ ${error || '오류'}` : '';
  const HoleChips = ({ tips, baseHole }) => (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(9, 1fr)', gap: '3px' }}>
      {tips.map((t, i) => (
        <div key={i} title={t.tip ? `${t.tip.slice(0, 80)}${t.tip.length > 80 ? '…' : ''}` : '비어있음'} style={{ textAlign: 'center', fontSize: '0.62rem', padding: '0.2rem 0', borderRadius: '4px', background: t.tip ? 'rgba(16,185,129,0.15)' : 'rgba(255,255,255,0.04)', color: t.tip ? 'var(--accent-neon)' : 'var(--text-secondary)', border: '1px solid', borderColor: t.tip ? 'rgba(16,185,129,0.3)' : 'var(--glass-border)' }}>
          {baseHole + i}H
        </div>
      ))}
    </div>
  );
  return (
    <div style={{ border: '1px solid var(--glass-border)', borderRadius: '10px', padding: '0.75rem' }}>
      <div style={{ display: 'flex', gap: '0.4rem', alignItems: 'center', flexWrap: 'wrap' }}>
        <input ref={ref} type="file" accept="application/json,.json" style={{ display: 'none' }} onChange={e => { if (e.target.files[0]) onUpload(e.target.files[0]); e.target.value = ''; }} />
        <button type="button" onClick={() => ref.current?.click()} disabled={status === 'loading'} style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid var(--glass-border)', borderRadius: '6px', color: 'white', fontSize: '0.85rem', padding: '0.5rem 0.9rem', cursor: status === 'loading' ? 'not-allowed' : 'pointer', opacity: status === 'loading' ? 0.5 : 1 }}>
          📄 공략 JSON 파일 선택
        </button>
        {totalFilled > 0 && (
          <button type="button" onClick={onClear} style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.3)', borderRadius: '6px', color: '#ef4444', fontSize: '0.75rem', padding: '0.45rem 0.8rem', cursor: 'pointer' }}>
            전체 지우기
          </button>
        )}
      </div>
      {msg && <div style={{ fontSize: '0.72rem', color, marginTop: '0.5rem' }}>{msg}</div>}
      {totalFilled > 0 && (
        <div style={{ marginTop: '0.75rem', display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          <div>
            <div style={{ fontSize: '0.7rem', color: 'var(--accent-neon)', marginBottom: '3px' }}>1H — {valleyName}</div>
            <HoleChips tips={valleyTips} baseHole={1} />
          </div>
          <div>
            <div style={{ fontSize: '0.7rem', color: '#38bdf8', marginBottom: '3px' }}>10H — {lakeName}</div>
            <HoleChips tips={lakeTips} baseHole={10} />
          </div>
        </div>
      )}
    </div>
  );
}

function ImageGrid({ files, onFileChange, bulkRef }) {
  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
        <span style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>{files.filter(Boolean).length}/18 선택됨</span>
        <button type="button" onClick={() => bulkRef.current?.click()} style={{ background: 'rgba(255,255,255,0.08)', border: '1px solid var(--glass-border)', borderRadius: '6px', color: 'white', fontSize: '0.75rem', padding: '0.3rem 0.7rem', cursor: 'pointer' }}>
          📁 일괄 선택
        </button>
      </div>
      <input ref={bulkRef} type="file" accept="image/*" multiple style={{ display: 'none' }} onChange={e => {
        const sorted = Array.from(e.target.files).sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
        sorted.slice(0, 18).forEach((f, i) => onFileChange(i, f));
        e.target.value = '';
      }} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: '4px' }}>
        {files.map((f, i) => (
          <ImageSlot key={i} hole={i + 1} fileOrUrl={f} onChange={file => onFileChange(i, file)} />
        ))}
      </div>
    </>
  );
}

// ── Main Page ────────────────────────────────────────────────────────────────

export default function GeneratePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const editSlug = searchParams.get('edit');
  const [isEditing, setIsEditing] = useState(false);
  const [loadingEdit, setLoadingEdit] = useState(false);

  // Existing image records (for key preservation on edit)
  const [existingYardageImages, setExistingYardageImages] = useState([]);
  const [existingGreenImages, setExistingGreenImages] = useState([]);

  // Basic
  const [slug, setSlug] = useState('');
  const [slugStatus, setSlugStatus] = useState(null);
  const [title, setTitle] = useState('');
  const [subtitle, setSubtitle] = useState('');
  const [eventDate, setEventDate] = useState('');
  const [parInfo, setParInfo] = useState([...DEFAULT_PAR]);

  // Course
  const [courseName, setCourseName] = useState('');
  const [courseAddress, setCourseAddress] = useState('');
  const [coursePhone, setCoursePhone] = useState('');
  const [courseDistNote, setCourseDistNote] = useState('');
  const [mapNaver, setMapNaver] = useState('');
  const [mapKakao, setMapKakao] = useState('');
  const [mapTmap, setMapTmap] = useState('');

  // Schedule & Groups
  const [schedule, setSchedule] = useState([{ time: '', text: '' }]);
  const [groups, setGroups] = useState([DEFAULT_GROUP()]);
  const [valleyCourseName, setValleyCourseName] = useState('');
  const [lakeCourseName, setLakeCourseName] = useState('');

  // Award
  const [awardText, setAwardText] = useState('');
  const [settlementText, setSettlementText] = useState('');

  // Lunch
  const [lunchEnabled, setLunchEnabled] = useState(false);
  const [lunch, setLunch] = useState({ name: '', address: '', phone: '', menu: '', mapNaver: '', mapKakao: '' });

  // Notice
  const [noticeEnabled, setNoticeEnabled] = useState(false);
  const [notice, setNotice] = useState({ emoji: '🔔', title: '', body: '' });

  // Images (File | string URL | null)
  const [yardageFiles, setYardageFiles] = useState(Array(18).fill(null));
  const [greenFiles, setGreenFiles] = useState(Array(18).fill(null));
  const yardageBulkRef = useRef(null);
  const greenBulkRef = useRef(null);

  // Hole tips (1-9: valley/1H, 10-18: lake/10H). Array of { hole, tip } length 18.
  const [holeTips, setHoleTips] = useState(Array.from({ length: 18 }, (_, i) => ({ hole: i + 1, tip: '' })));
  const [tipStatus, setTipStatus] = useState(null); // null | 'loading' | 'done' | 'error'
  const [tipError, setTipError] = useState('');
  const [tipResult, setTipResult] = useState({ valleyCount: 0, lakeCount: 0 });

  // Submit
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitStep, setSubmitStep] = useState('');
  const [uploadProgress, setUploadProgress] = useState(0);

  // Allow body scroll
  useEffect(() => {
    document.body.classList.add('allow-scroll');
    return () => document.body.classList.remove('allow-scroll');
  }, []);

  // Edit mode: load existing data
  useEffect(() => {
    if (!editSlug) return;
    setIsEditing(true);
    setSlug(editSlug);
    setSlugStatus('exists');
    setLoadingEdit(true);

    fetch(`/api/events/${encodeURIComponent(editSlug)}`)
      .then(res => res.json())
      .then(event => {
        setTitle(event.title || '');
        setSubtitle(event.subtitle || '');
        setEventDate(event.event_date ? event.event_date.slice(0, 10) : '');
        setParInfo(Array.isArray(event.par_info) ? event.par_info : DEFAULT_PAR);
        setCourseName(event.course_name || '');
        setCourseAddress(event.course_address || '');
        setCoursePhone(event.course_phone || '');
        setCourseDistNote(event.course_distance_note || '');
        setMapNaver(event.map_links?.naver || '');
        setMapKakao(event.map_links?.kakao || '');
        setMapTmap(event.map_links?.tmap || '');
        setSchedule(event.schedule?.length ? event.schedule : [{ time: '', text: '' }]);
        setGroups(event.groups?.length ? event.groups.map(g => ({ ...DEFAULT_GROUP(), ...g, _id: g._id || Date.now() + Math.random() })) : [DEFAULT_GROUP()]);
        setValleyCourseName(event.valley_course_name || '');
        setLakeCourseName(event.lake_course_name || '');
        setAwardText(event.award_text || '');
        setSettlementText(event.settlement_text || '');
        if (event.lunch) {
          setLunchEnabled(true);
          setLunch(prev => ({ ...prev, ...event.lunch }));
        }
        if (event.notice?.enabled) {
          setNoticeEnabled(true);
          setNotice(prev => ({ ...prev, ...event.notice }));
        }
        // Pre-fill images from existing URLs
        const yardageByHole = Object.fromEntries((event.yardage_images || []).map(img => [img.hole, img.url]));
        const greenByHole = Object.fromEntries((event.green_images || []).map(img => [img.hole, img.url]));
        setYardageFiles(Array.from({ length: 18 }, (_, i) => yardageByHole[i + 1] || null));
        setGreenFiles(Array.from({ length: 18 }, (_, i) => greenByHole[i + 1] || null));
        setExistingYardageImages(event.yardage_images || []);
        setExistingGreenImages(event.green_images || []);
        if (Array.isArray(event.hole_tips) && event.hole_tips.length) {
          const map = Object.fromEntries(event.hole_tips.map(t => [Number(t.hole), t.tip || '']));
          const next = Array.from({ length: 18 }, (_, i) => ({ hole: i + 1, tip: map[i + 1] || '' }));
          setHoleTips(next);
          const valleyCount = next.slice(0, 9).filter(t => t.tip).length;
          const lakeCount = next.slice(9, 18).filter(t => t.tip).length;
          if (valleyCount || lakeCount) {
            setTipStatus('done');
            setTipResult({ valleyCount, lakeCount });
          }
        }
      })
      .catch(() => alert('페이지 데이터를 불러오지 못했습니다.'))
      .finally(() => setLoadingEdit(false));
  }, [editSlug]);

  // Slug validation (debounced, skipped when editing)
  const slugTimer = useRef(null);
  const validateSlug = useCallback((v) => {
    if (!v) { setSlugStatus(null); return; }
    const ok = /^[\p{L}\p{N}\-_]{2,40}$/u.test(v) && !RESERVED.includes(v.toLowerCase());
    if (!ok) { setSlugStatus('invalid'); return; }
    setSlugStatus('checking');
    clearTimeout(slugTimer.current);
    slugTimer.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/events/${encodeURIComponent(v)}`);
        setSlugStatus(res.ok ? 'exists' : 'available');
      } catch {
        setSlugStatus('available');
      }
    }, 600);
  }, []);

  const handleSlugChange = v => {
    if (isEditing) return; // slug locked when editing
    setSlug(v);
    validateSlug(v);
  };

  const slugColor = { null: 'var(--text-secondary)', checking: '#facc15', available: 'var(--accent-neon)', exists: '#f97316', invalid: '#ef4444' }[slugStatus] || 'var(--text-secondary)';
  const slugMsg = { null: '', checking: '확인 중...', available: '✓ 사용 가능', exists: isEditing ? '✏️ 수정 모드' : '⚠ 이미 존재 (덮어씁니다)', invalid: '✗ 사용 불가 (한글/영문/숫자/-_ 2~40자, 예약어 제외)' }[slugStatus] || '';

  // Image handlers
  const handleYardageChange = (i, f) => setYardageFiles(prev => { const a = [...prev]; a[i] = f; return a; });
  const handleGreenChange = (i, f) => setGreenFiles(prev => { const a = [...prev]; a[i] = f; return a; });

  // Hole tip JSON upload handler (single file → Gemini가 valley/lake 자동 분리)
  const handleTipJsonUpload = async (file) => {
    setTipStatus('loading');
    setTipError('');
    try {
      const text = await file.text();
      let parsed;
      try { parsed = JSON.parse(text); } catch { throw new Error('JSON 파싱 실패: 올바른 JSON 파일이 아닙니다.'); }
      const res = await fetch('/api/transform-tips', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ source: parsed, valleyCourseName, lakeCourseName }),
      });
      const data = await res.json();
      if (!res.ok) {
        const errMsg = data.detail ? `${data.error || 'Gemini 변환 실패'} — ${data.detail}` : (data.error || 'Gemini 변환 실패');
        throw new Error(errMsg);
      }
      const valley = Array.isArray(data.valley) ? data.valley : [];
      const lake = Array.isArray(data.lake) ? data.lake : [];
      const next = Array.from({ length: 18 }, (_, i) => ({ hole: i + 1, tip: '' }));
      valley.forEach(t => {
        const slot = Number(t.hole);
        if (slot >= 1 && slot <= 9) next[slot - 1] = { hole: slot, tip: t.tip || '' };
      });
      lake.forEach(t => {
        const slot = Number(t.hole) + 9; // hole 1~9 → slot 10~18
        if (slot >= 10 && slot <= 18) next[slot - 1] = { hole: slot, tip: t.tip || '' };
      });
      setHoleTips(next);
      const valleyCount = next.slice(0, 9).filter(t => t.tip).length;
      const lakeCount = next.slice(9, 18).filter(t => t.tip).length;
      setTipResult({ valleyCount, lakeCount });
      if (!valleyCount && !lakeCount) throw new Error('입력 데이터에서 코스 공략을 추출하지 못했습니다. 코스명을 확인해주세요.');
      setTipStatus('done');
    } catch (err) {
      setTipStatus('error');
      setTipError(err.message || '오류');
    }
  };

  const clearTips = () => {
    setHoleTips(Array.from({ length: 18 }, (_, i) => ({ hole: i + 1, tip: '' })));
    setTipStatus(null);
    setTipError('');
    setTipResult({ valleyCount: 0, lakeCount: 0 });
  };

  // Schedule
  const addScheduleRow = () => setSchedule(s => [...s, { time: '', text: '' }]);
  const updateSchedule = (i, k, v) => setSchedule(s => s.map((r, idx) => idx === i ? { ...r, [k]: v } : r));
  const removeSchedule = (i) => setSchedule(s => s.filter((_, idx) => idx !== i));

  // Groups
  const addGroup = () => setGroups(g => [...g, DEFAULT_GROUP()]);
  const updateGroup = (i, k, v) => setGroups(g => g.map((r, idx) => idx === i ? { ...r, [k]: v } : r));
  const removeGroup = (i) => setGroups(g => g.filter((_, idx) => idx !== i));

  // Submit
  const handleSubmit = async () => {
    if (!slug || slugStatus === 'invalid') { alert('올바른 슬러그를 입력해주세요.'); return; }
    if (!title) { alert('타이틀을 입력해주세요.'); return; }
    if (yardageFiles.some(f => !f)) { alert(`야디지 이미지 18장을 모두 선택해주세요. (${yardageFiles.filter(Boolean).length}/18)`); return; }
    if (greenFiles.some(f => !f)) { alert(`그린 이미지 18장을 모두 선택해주세요. (${greenFiles.filter(Boolean).length}/18)`); return; }
    if (!isEditing && slugStatus === 'exists') {
      if (!window.confirm(`"${slug}" 슬러그는 이미 존재합니다.\n기존 페이지를 덮어쓸까요?`)) return;
    }

    setIsSubmitting(true);
    try {
      // Separate: existing URLs (keep) vs new Files (upload)
      const yardageJobs = yardageFiles.map((f, i) => ({ f, hole: i + 1, fileName: `h${i + 1}.jpg`, type: 'yardage' }));
      const greenJobs = greenFiles.map((f, i) => ({ f, hole: i + 1, fileName: `g${i + 1}.jpg`, type: 'green' }));

      const yardageResults = yardageJobs
        .filter(j => typeof j.f === 'string')
        .map(j => existingYardageImages.find(img => img.hole === j.hole) || { hole: j.hole, url: j.f });
      const greenResults = greenJobs
        .filter(j => typeof j.f === 'string')
        .map(j => existingGreenImages.find(img => img.hole === j.hole) || { hole: j.hole, url: j.f });

      const toUpload = [...yardageJobs, ...greenJobs].filter(j => j.f instanceof File);

      if (toUpload.length > 0) {
        setSubmitStep('이미지 압축 중...');
        const compressed = await Promise.all(toUpload.map(async job => {
          const blob = await compressImage(job.f, { maxWidth: 1920, maxHeight: 1920, quality: 0.85 });
          return { ...job, blob };
        }));

        setSubmitStep('R2 업로드 중...');
        const BATCH = 4;
        for (let i = 0; i < compressed.length; i += BATCH) {
          const batch = compressed.slice(i, i + BATCH);
          await Promise.all(batch.map(async ({ blob, type, hole, fileName }) => {
            const fd = new FormData();
            fd.append('file', blob, fileName);
            fd.append('fileName', fileName);
            fd.append('path', `events/${slug}/${type}`);
            const res = await fetch('/api/upload', { method: 'POST', body: fd });
            if (!res.ok) throw new Error(`업로드 실패: ${fileName}`);
            const { url, key } = await res.json();
            (type === 'yardage' ? yardageResults : greenResults).push({ hole, url, key });
          }));
          setUploadProgress(Math.round(((i + batch.length) / compressed.length) * 100));
        }
      }

      yardageResults.sort((a, b) => a.hole - b.hole);
      greenResults.sort((a, b) => a.hole - b.hole);

      setSubmitStep('페이지 저장 중...');
      const payload = {
        slug, title,
        subtitle: subtitle || null,
        event_date: eventDate || null,
        course_name: courseName || null,
        course_address: courseAddress || null,
        course_phone: coursePhone || null,
        course_distance_note: courseDistNote || null,
        map_links: { naver: mapNaver, kakao: mapKakao, tmap: mapTmap },
        schedule,
        groups,
        valley_course_name: valleyCourseName || null,
        lake_course_name: lakeCourseName || null,
        award_text: awardText || null,
        settlement_text: settlementText || null,
        lunch: lunchEnabled ? { ...lunch } : null,
        notice: noticeEnabled ? { enabled: true, ...notice } : null,
        par_info: parInfo,
        yardage_images: yardageResults,
        green_images: greenResults,
        hole_tips: holeTips,
      };

      const saveRes = await fetch('/api/events', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!saveRes.ok) {
        const err = await saveRes.json();
        throw new Error(err.error || '저장 실패');
      }

      setSubmitStep('완료! 이동 중...');
      setTimeout(() => router.push(`/go/${encodeURIComponent(slug)}`), 600);
    } catch (err) {
      alert(`오류: ${err.message}`);
      setIsSubmitting(false);
      setSubmitStep('');
    }
  };

  if (loadingEdit) {
    return (
      <div style={{ position: 'fixed', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--bg-color)', flexDirection: 'column', gap: '1rem' }}>
        <div style={{ fontSize: '2rem' }}>⛳</div>
        <div style={{ color: 'var(--text-secondary)' }}>페이지 데이터 불러오는 중...</div>
      </div>
    );
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div style={{ position: 'fixed', inset: 0, overflowY: 'auto', background: 'var(--bg-color)' }}>
      <div style={{ maxWidth: 640, margin: '0 auto', padding: '1.5rem 1rem 4rem' }}>
        <h2 style={{ color: 'var(--accent-neon)', marginBottom: '0.25rem', fontSize: '1.4rem' }}>
          {isEditing ? '✏️ 안내 페이지 수정' : '⛳ 안내 페이지 생성'}
        </h2>
        {isEditing && (
          <div style={{ fontSize: '0.8rem', color: '#f97316', marginBottom: '1rem', padding: '0.5rem 0.75rem', background: 'rgba(249,115,22,0.1)', border: '1px solid rgba(249,115,22,0.3)', borderRadius: '8px' }}>
            수정 모드: <strong>{slug}</strong> 페이지를 편집 중입니다. 이미지를 다시 선택하지 않으면 기존 이미지가 유지됩니다.
          </div>
        )}

        {/* ─ 기본 정보 ─ */}
        <Section title="기본 정보">
          <FormRow label="슬러그 (홈페이지 이름) *">
            <input style={{ ...inp, opacity: isEditing ? 0.6 : 1 }} value={slug} onChange={e => handleSlugChange(e.target.value)} placeholder="예) 클럽359-6월 또는 my-club-june" readOnly={isEditing} />
            {slugStatus && <div style={{ fontSize: '0.72rem', color: slugColor, marginTop: '3px' }}>{slugMsg}</div>}
            {slug && slugStatus === 'available' && <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginTop: '2px' }}>접속 URL: /go/{slug}</div>}
          </FormRow>
          <FormRow label="타이틀 *">
            <input style={inp} value={title} onChange={e => setTitle(e.target.value)} placeholder="May the PAR be with you!" />
          </FormRow>
          <FormRow label="부제">
            <input style={inp} value={subtitle} onChange={e => setSubtitle(e.target.value)} placeholder="2026년 6월 클럽 359 라운딩" />
          </FormRow>
          <FormRow label="행사 일자">
            <input style={inp} type="date" value={eventDate} onChange={e => setEventDate(e.target.value)} />
          </FormRow>
        </Section>

        {/* ─ 골프장 정보 ─ */}
        <Section title="골프장 정보">
          <FormRow label="골프장명">
            <input style={inp} value={courseName} onChange={e => setCourseName(e.target.value)} placeholder="용인 세현CC" />
          </FormRow>
          <FormRow label="주소">
            <input style={inp} value={courseAddress} onChange={e => setCourseAddress(e.target.value)} placeholder="경기 용인시 처인구 이동읍 백자로 450" />
          </FormRow>
          <FormRow label="전화번호">
            <input style={inp} value={coursePhone} onChange={e => setCoursePhone(e.target.value)} placeholder="031-670-8800" />
          </FormRow>
          <FormRow label="거리 안내 (선택)">
            <input style={inp} value={courseDistNote} onChange={e => setCourseDistNote(e.target.value)} placeholder="여의도 기준 약 1h 35m" />
          </FormRow>
          <div style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.25rem' }}>지도 링크 (선택 — 있는 것만 표시됨)</div>
          <FormRow label="네이버지도 URL"><input style={inp} value={mapNaver} onChange={e => setMapNaver(e.target.value)} placeholder="https://map.naver.com/..." /></FormRow>
          <FormRow label="카카오지도 URL"><input style={inp} value={mapKakao} onChange={e => setMapKakao(e.target.value)} placeholder="https://map.kakao.com/..." /></FormRow>
          <FormRow label="티맵 URL"><input style={inp} value={mapTmap} onChange={e => setMapTmap(e.target.value)} placeholder="https://tmap.co.kr/..." /></FormRow>
        </Section>

        {/* ─ 상세 일정 ─ */}
        <Section title="상세 일정" badge={`${schedule.length}개`}>
          {schedule.map((row, i) => (
            <div key={i} style={{ display: 'flex', gap: '6px', marginBottom: '6px', alignItems: 'center' }}>
              <input style={{ ...inp, width: '90px', flexShrink: 0 }} value={row.time} onChange={e => updateSchedule(i, 'time', e.target.value)} placeholder="07:25" />
              <input style={{ ...inp, flex: 1 }} value={row.text} onChange={e => updateSchedule(i, 'text', e.target.value)} placeholder="집합 및 기념 사진 촬영" />
              <button type="button" onClick={() => removeSchedule(i)} style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: '1rem', cursor: 'pointer', padding: '0 4px', flexShrink: 0 }}>×</button>
            </div>
          ))}
          <button type="button" onClick={addScheduleRow} style={{ background: 'rgba(255,255,255,0.06)', border: '1px dashed var(--glass-border)', borderRadius: '6px', color: 'var(--text-secondary)', fontSize: '0.8rem', padding: '0.4rem 0.8rem', cursor: 'pointer', width: '100%', marginTop: '4px' }}>+ 행 추가</button>
        </Section>

        {/* ─ 조편성 ─ */}
        <Section title="조편성" badge={`${groups.length}개`}>
          {/* 코스 이름 (1H / 10H) */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', marginBottom: '10px' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.72rem', color: 'var(--accent-neon)', marginBottom: '0.25rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>1H 코스명</label>
              <input style={inp} value={valleyCourseName} onChange={e => setValleyCourseName(e.target.value)} placeholder="밸리" />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.72rem', color: '#38bdf8', marginBottom: '0.25rem', textTransform: 'uppercase', letterSpacing: '0.05em' }}>10H 코스명</label>
              <input style={inp} value={lakeCourseName} onChange={e => setLakeCourseName(e.target.value)} placeholder="레이크" />
            </div>
          </div>
          <div style={{ fontSize: '0.7rem', color: 'var(--text-secondary)', marginBottom: '6px' }}>조명 · 시간 · 참석자 · 시작홀</div>
          {groups.map((g, i) => (
            <div key={g._id ?? i} style={{ display: 'grid', gridTemplateColumns: '70px 70px 1fr 44px auto', gap: '4px', marginBottom: '6px', alignItems: 'center' }}>
              <input style={inp} value={g.course} onChange={e => updateGroup(i, 'course', e.target.value)} placeholder="1조" />
              <input style={inp} value={g.time} onChange={e => updateGroup(i, 'time', e.target.value)} placeholder="07:59" />
              <input style={inp} value={g.players} onChange={e => updateGroup(i, 'players', e.target.value)} placeholder="홍길동/김철수/이영희/박민수" />
              {/* 시작홀 토글: 1H ↔ 10H */}
              <button
                type="button"
                onMouseDown={e => e.preventDefault()}
                onClick={() => updateGroup(i, 'start', g.start === 'valley' ? 'lake' : 'valley')}
                style={{
                  height: '100%', padding: '0 4px',
                  background: g.start === 'valley' ? 'rgba(16,185,129,0.2)' : 'rgba(56,189,248,0.2)',
                  border: `1px solid ${g.start === 'valley' ? 'var(--accent-neon)' : '#38bdf8'}`,
                  borderRadius: '8px',
                  color: g.start === 'valley' ? 'var(--accent-neon)' : '#38bdf8',
                  fontSize: '0.75rem', fontWeight: 'bold', cursor: 'pointer', whiteSpace: 'nowrap',
                }}
              >
                {g.start === 'valley' ? '1H' : '10H'}
              </button>
              <button type="button" onClick={() => removeGroup(i)} style={{ background: 'none', border: 'none', color: '#ef4444', fontSize: '1rem', cursor: 'pointer', padding: '0 4px' }}>×</button>
            </div>
          ))}
          <button type="button" onClick={addGroup} style={{ background: 'rgba(255,255,255,0.06)', border: '1px dashed var(--glass-border)', borderRadius: '6px', color: 'var(--text-secondary)', fontSize: '0.8rem', padding: '0.4rem 0.8rem', cursor: 'pointer', width: '100%', marginTop: '4px' }}>+ 조 추가</button>
        </Section>

        {/* ─ 시상/정산 ─ */}
        <Section title="시상 및 정산">
          <FormRow label="시상 내용">
            <textarea style={{ ...inp, minHeight: '80px', resize: 'vertical' }} value={awardText} onChange={e => setAwardText(e.target.value)} placeholder="- 5등 Vice 골프공 더즌 증정" />
          </FormRow>
          <FormRow label="정산 안내">
            <textarea style={{ ...inp, minHeight: '80px', resize: 'vertical' }} value={settlementText} onChange={e => setSettlementText(e.target.value)} placeholder="- 캐디피(15만), 카트비(12만) 개인 정산&#10;- 기타 조별/개인 정산" />
          </FormRow>
        </Section>

        {/* ─ 중식 (선택) ─ */}
        <div style={{ marginBottom: '0.75rem', border: '1px solid var(--glass-border)', borderRadius: '12px', overflow: 'hidden' }}>
          <div style={{ padding: '0.85rem 1rem', display: 'flex', alignItems: 'center', gap: '0.75rem', background: 'rgba(255,255,255,0.04)', cursor: 'pointer' }} onClick={() => setLunchEnabled(v => !v)}>
            <input type="checkbox" checked={lunchEnabled} onChange={() => {}} style={{ width: '16px', height: '16px', cursor: 'pointer', accentColor: 'var(--accent-neon)' }} />
            <span style={{ fontWeight: '700', fontSize: '0.95rem' }}>🍽️ 중식 정보 포함</span>
          </div>
          {lunchEnabled && (
            <div style={{ padding: '1rem' }}>
              <FormRow label="음식점명"><input style={inp} value={lunch.name} onChange={e => setLunch(v => ({ ...v, name: e.target.value }))} placeholder="약속하오리" /></FormRow>
              <FormRow label="주소"><input style={inp} value={lunch.address} onChange={e => setLunch(v => ({ ...v, address: e.target.value }))} placeholder="경기 용인시 처인구 이동읍 서리로137번길 14" /></FormRow>
              <FormRow label="전화번호"><input style={inp} value={lunch.phone} onChange={e => setLunch(v => ({ ...v, phone: e.target.value }))} placeholder="0507-1487-5293" /></FormRow>
              <FormRow label="메뉴"><input style={inp} value={lunch.menu} onChange={e => setLunch(v => ({ ...v, menu: e.target.value }))} placeholder="오리 로스" /></FormRow>
              <FormRow label="네이버지도 URL"><input style={inp} value={lunch.mapNaver} onChange={e => setLunch(v => ({ ...v, mapNaver: e.target.value }))} placeholder="https://map.naver.com/..." /></FormRow>
              <FormRow label="카카오지도 URL"><input style={inp} value={lunch.mapKakao} onChange={e => setLunch(v => ({ ...v, mapKakao: e.target.value }))} placeholder="https://map.kakao.com/..." /></FormRow>
            </div>
          )}
        </div>

        {/* ─ 공지 팝업 (선택) ─ */}
        <div style={{ marginBottom: '0.75rem', border: '1px solid var(--glass-border)', borderRadius: '12px', overflow: 'hidden' }}>
          <div style={{ padding: '0.85rem 1rem', display: 'flex', alignItems: 'center', gap: '0.75rem', background: 'rgba(255,255,255,0.04)', cursor: 'pointer' }} onClick={() => setNoticeEnabled(v => !v)}>
            <input type="checkbox" checked={noticeEnabled} onChange={() => {}} style={{ width: '16px', height: '16px', cursor: 'pointer', accentColor: 'var(--accent-neon)' }} />
            <span style={{ fontWeight: '700', fontSize: '0.95rem' }}>🔔 공지 팝업 포함</span>
          </div>
          {noticeEnabled && (
            <div style={{ padding: '1rem' }}>
              <FormRow label="이모지">
                <input style={{ ...inp, width: '80px' }} value={notice.emoji} onChange={e => setNotice(v => ({ ...v, emoji: e.target.value }))} placeholder="🌧️" />
              </FormRow>
              <FormRow label="제목"><input style={inp} value={notice.title} onChange={e => setNotice(v => ({ ...v, title: e.target.value }))} placeholder="비로 인해 우천 취소 되었습니다" /></FormRow>
              <FormRow label="본문"><textarea style={{ ...inp, minHeight: '60px', resize: 'vertical' }} value={notice.body} onChange={e => setNotice(v => ({ ...v, body: e.target.value }))} placeholder="9월에 더 좋은 라운드로 만나뵙겠습니다 ⛳" /></FormRow>
            </div>
          )}
        </div>

        {/* ─ PAR 정보 ─ */}
        <Section title="PAR 정보 (18홀)">
          <div style={{ marginBottom: '4px', fontSize: '0.7rem', color: 'var(--text-secondary)' }}>앞 9홀</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(9, 1fr)', gap: '4px', marginBottom: '8px' }}>
            {parInfo.slice(0, 9).map((p, i) => (
              <div key={i} style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '0.6rem', color: 'var(--text-secondary)', marginBottom: '2px' }}>{i + 1}H</div>
                <input type="number" min={3} max={5} style={{ ...inp, padding: '0.3rem', textAlign: 'center', fontSize: '0.9rem' }} value={p}
                  onChange={e => setParInfo(v => { const a = [...v]; a[i] = Number(e.target.value); return a; })} />
              </div>
            ))}
          </div>
          <div style={{ marginBottom: '4px', fontSize: '0.7rem', color: 'var(--text-secondary)' }}>뒤 9홀</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(9, 1fr)', gap: '4px' }}>
            {parInfo.slice(9).map((p, i) => (
              <div key={i + 9} style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '0.6rem', color: 'var(--text-secondary)', marginBottom: '2px' }}>{i + 10}H</div>
                <input type="number" min={3} max={5} style={{ ...inp, padding: '0.3rem', textAlign: 'center', fontSize: '0.9rem' }} value={p}
                  onChange={e => setParInfo(v => { const a = [...v]; a[i + 9] = Number(e.target.value); return a; })} />
              </div>
            ))}
          </div>
        </Section>

        {/* ─ 야디지 이미지 ─ */}
        <Section title="야디지 이미지" badge={`${yardageFiles.filter(Boolean).length}/18`}>
          {isEditing && <div style={{ fontSize: '0.75rem', color: '#f97316', marginBottom: '8px' }}>기존 이미지가 표시됩니다. 교체할 홀만 클릭하여 새 파일을 선택하세요.</div>}
          <ImageGrid files={yardageFiles} onFileChange={handleYardageChange} bulkRef={yardageBulkRef} />
        </Section>

        {/* ─ 그린 이미지 ─ */}
        <Section title="그린 이미지" badge={`${greenFiles.filter(Boolean).length}/18`}>
          {isEditing && <div style={{ fontSize: '0.75rem', color: '#f97316', marginBottom: '8px' }}>기존 이미지가 표시됩니다. 교체할 홀만 클릭하여 새 파일을 선택하세요.</div>}
          <ImageGrid files={greenFiles} onFileChange={handleGreenChange} bulkRef={greenBulkRef} />
        </Section>

        {/* ─ 홀 공략 (JSON 업로드 → Gemini 변환) ─ */}
        <Section title="홀 공략 (선택)" badge={`${holeTips.filter(t => t.tip).length}/18`}>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-secondary)', marginBottom: '0.75rem', lineHeight: 1.5 }}>
            골프장 홈페이지에서 긁어온 임의 형식의 JSON을 올리면 Gemini가 위에 입력한 1H/10H 코스명을 기준으로 각 홀의 공략 텍스트를 자동 분리·추출합니다.
          </div>
          <TipUploadRow
            valleyName={valleyCourseName || '밸리'}
            lakeName={lakeCourseName || '레이크'}
            status={tipStatus}
            error={tipError}
            valleyTips={holeTips.slice(0, 9)}
            lakeTips={holeTips.slice(9, 18)}
            valleyCount={tipResult.valleyCount}
            lakeCount={tipResult.lakeCount}
            onUpload={handleTipJsonUpload}
            onClear={clearTips}
          />
        </Section>

        {/* ─ 제출 ─ */}
        <button
          onClick={handleSubmit}
          disabled={isSubmitting}
          style={{ width: '100%', padding: '1rem', background: isEditing ? 'linear-gradient(135deg, #3b82f6, #2563eb)' : 'linear-gradient(135deg, #10b981, #059669)', border: 'none', borderRadius: '12px', color: 'white', fontSize: '1.1rem', fontWeight: '700', cursor: isSubmitting ? 'not-allowed' : 'pointer', opacity: isSubmitting ? 0.7 : 1, marginTop: '0.5rem' }}
        >
          {isSubmitting ? (submitStep || '처리 중...') : (isEditing ? '✏️ 페이지 수정 저장' : '⛳ 안내페이지 생성')}
        </button>
      </div>

      {/* ─ Progress Overlay ─ */}
      {isSubmitting && (
        <div style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', zIndex: 999, backdropFilter: 'blur(6px)' }}>
          <div style={{ background: '#1e293b', border: '1px solid var(--glass-border)', borderRadius: '16px', padding: '2rem', width: 'min(320px, 90vw)', textAlign: 'center' }}>
            <div style={{ fontSize: '2rem', marginBottom: '1rem' }}>{isEditing ? '✏️' : '⛳'}</div>
            <div style={{ fontWeight: '700', marginBottom: '0.5rem' }}>{submitStep}</div>
            {uploadProgress > 0 && uploadProgress < 100 && (
              <>
                <div style={{ background: 'rgba(255,255,255,0.1)', borderRadius: '9999px', height: '6px', overflow: 'hidden', margin: '0.75rem 0' }}>
                  <div style={{ height: '100%', width: `${uploadProgress}%`, background: 'var(--accent-neon)', borderRadius: '9999px', transition: 'width 0.3s' }} />
                </div>
                <div style={{ fontSize: '0.8rem', color: 'var(--text-secondary)' }}>이미지 업로드 {uploadProgress}%</div>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
