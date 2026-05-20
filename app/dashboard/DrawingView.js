'use client';

import YardageDrawingBoard from '../record/YardageDrawingBoard';

export default function DrawingView({ hole, round, courses }) {
  const holeIdx = (hole.hole || 1) - 1;
  const courseId = round.courseId || round.course_id || '';
  const course = courses?.find(c => c.id === courseId);
  const imageUrl = course?.yardage_images?.[holeIdx];

  return (
    <YardageDrawingBoard
      holeNumber={hole.hole}
      drawingData={hole.drawings || { paths: [], markers: [] }}
      imageUrl={imageUrl}
      readOnly={true}
      mode="yardage"
      onSave={() => {}}
    />
  );
}
