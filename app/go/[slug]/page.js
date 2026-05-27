import { sql } from '@vercel/postgres';
import { notFound } from 'next/navigation';
import EventHome from './EventHome';

export const dynamic = 'force-dynamic';

export async function generateMetadata({ params }) {
  const slug = decodeURIComponent(params.slug);
  try {
    const { rows } = await sql`SELECT title, subtitle, course_name FROM event_pages WHERE slug = ${slug}`;
    if (rows.length === 0) return { title: '페이지 없음' };
    const row = rows[0];
    return {
      title: row.title || '골프 행사 안내',
      description: row.subtitle || `${row.course_name || ''} 라운딩 행사 안내`,
    };
  } catch {
    return { title: '골프 행사 안내' };
  }
}

export default async function GoPage({ params }) {
  const slug = decodeURIComponent(params.slug);

  let event;
  try {
    const { rows } = await sql`SELECT * FROM event_pages WHERE slug = ${slug}`;
    if (rows.length === 0) notFound();
    event = rows[0];
  } catch (err) {
    if (err?.message?.includes('does not exist') || err?.digest?.includes('NEXT_NOT_FOUND')) {
      notFound();
    }
    throw err;
  }

  return <EventHome event={event} slug={slug} />;
}
