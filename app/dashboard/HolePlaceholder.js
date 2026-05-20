'use client';

import { useEffect, useState } from 'react';
import HoleViewer from './HoleViewer';
import HoleZoomModal from './HoleZoomModal';
import PhotoLightbox from './PhotoLightbox';

function hasMapData(hole, round) {
  const hasPhoto = (round.images || []).some(i => i.hole === hole.hole && i.latitude && i.longitude);
  const hasPutt = (hole.shots || []).some(s => s.club === 'Pt' && s.coords && s.coords.lat);
  return hasPhoto || hasPutt || !!hole.pinCoords || !!hole.teeCoords;
}

export default function HolePlaceholder({ hole, round, courses, onPhotoHoleChange, isSavingPhoto }) {
  const [mode, setMode] = useState('drawing');
  const [zoomOpen, setZoomOpen] = useState(false);
  const [lightbox, setLightbox] = useState(null);

  // Reset mode whenever the selected hole changes
  useEffect(() => {
    setMode(hasMapData(hole, round) ? 'map' : 'drawing');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hole.hole]);

  // Keep lightbox in sync with latest round.images (after hole change save)
  useEffect(() => {
    if (!lightbox) return;
    const latest = (round.images || []).find(i => i.id === lightbox.id);
    if (latest && latest.hole !== lightbox.hole) {
      setLightbox(latest);
    }
  }, [round.images]); // eslint-disable-line react-hooks/exhaustive-deps

  const openLightbox = (image) => setLightbox(image);
  const closeLightbox = () => setLightbox(null);

  return (
    <>
      <HoleViewer
        hole={hole}
        round={round}
        courses={courses}
        mode={mode}
        onModeChange={setMode}
        onPhotoClick={openLightbox}
        onExpand={() => setZoomOpen(true)}
      />

      {zoomOpen && (
        <HoleZoomModal
          hole={hole}
          round={round}
          courses={courses}
          mode={mode}
          onModeChange={setMode}
          onPhotoClick={openLightbox}
          onClose={() => setZoomOpen(false)}
        />
      )}

      {lightbox && (
        <PhotoLightbox
          image={lightbox}
          onClose={closeLightbox}
          onHoleChange={onPhotoHoleChange}
          isSaving={isSavingPhoto}
        />
      )}
    </>
  );
}
