import { sql } from '@vercel/postgres';
import { notFound } from 'next/navigation';
import RecordViewer from './RecordViewer';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }) {
  const slug = decodeURIComponent(params.slug);
  try {
    const { rows } = await sql`SELECT course_name FROM event_pages WHERE slug = ${slug}`;
    if (rows.length === 0) return { title: '야디지 뷰어' };
    return { title: `${rows[0].course_name || '코스'} 야디지 뷰어` };
  } catch {
    return { title: '야디지 뷰어' };
  }
}

export default async function RecordPage({ params }) {
  const slug = decodeURIComponent(params.slug);

  let event;
  try {
    const { rows } = await sql`
      SELECT course_name, par_info, yardage_images, green_images, groups
      FROM event_pages WHERE slug = ${slug}
    `;
    if (rows.length === 0) notFound();
    event = rows[0];
  } catch (err) {
    if (err?.message?.includes('does not exist') || err?.digest?.includes('NEXT_NOT_FOUND')) {
      notFound();
    }
    throw err;
  }

  return (
    <RecordViewer
      slug={slug}
      courseName={event.course_name}
      parInfo={event.par_info || [4,4,4,3,4,3,5,4,5,4,4,5,4,3,4,5,3,4]}
      yardageImages={event.yardage_images || []}
      greenImages={event.green_images || []}
      groups={event.groups || []}
    />
  );
}
