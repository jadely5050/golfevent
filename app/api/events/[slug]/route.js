import { sql } from '@vercel/postgres';
import { NextResponse } from 'next/server';

export async function GET(request, { params }) {
  try {
    const { slug } = params;
    const { rows } = await sql`
      SELECT * FROM event_pages WHERE slug = ${slug}
    `;
    if (rows.length === 0) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    return NextResponse.json(rows[0]);
  } catch (error) {
    // Table might not exist yet
    if (error.message?.includes('does not exist')) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    console.error('GET /api/events/[slug] error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const { slug } = params;
    await sql`DELETE FROM event_pages WHERE slug = ${slug}`;
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('DELETE /api/events/[slug] error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
