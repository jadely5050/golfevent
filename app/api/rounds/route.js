import { sql } from '@vercel/postgres';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const { rows } = await sql`SELECT id, date, course, score, par, putts, holes_data as holes FROM golf_rounds ORDER BY date DESC`;
    return NextResponse.json(rows);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    const { id, date, course, score, par, putts, holes } = body;

    // Initialize table if it doesn't exist
    await sql`
      CREATE TABLE IF NOT EXISTS golf_rounds (
        id TEXT PRIMARY KEY,
        date DATE,
        course TEXT,
        score INTEGER,
        par INTEGER,
        putts INTEGER,
        holes_data JSONB,
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;

    // Insert or Update round
    await sql`
      INSERT INTO golf_rounds (id, date, course, score, par, putts, holes_data)
      VALUES (${id}, ${date}, ${course}, ${score}, ${par}, ${putts}, ${JSON.stringify(holes)})
      ON CONFLICT (id) DO UPDATE SET
        date = EXCLUDED.date,
        course = EXCLUDED.course,
        score = EXCLUDED.score,
        par = EXCLUDED.par,
        putts = EXCLUDED.putts,
        holes_data = EXCLUDED.holes_data;
    `;

    return NextResponse.json({ success: true, id });
  } catch (error) {
    console.error('API Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
