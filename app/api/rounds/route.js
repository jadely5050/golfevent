import { sql } from '@vercel/postgres';
import { NextResponse } from 'next/server';

async function initDB() {
  // 1. 테이블 생성
  await sql`
    CREATE TABLE IF NOT EXISTS golf_rounds (
      id TEXT PRIMARY KEY,
      date DATE,
      course TEXT,
      score INTEGER,
      par INTEGER,
      putts INTEGER,
      holes_data JSONB,
      images_data JSONB,
      drawings_data JSONB,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `;

  // 2. 누락된 컬럼 추가 (기존 테이블 대응)
  try {
    await sql`ALTER TABLE golf_rounds ADD COLUMN IF NOT EXISTS images_data JSONB;`;
    await sql`ALTER TABLE golf_rounds ADD COLUMN IF NOT EXISTS drawings_data JSONB;`;
  } catch (err) {
    console.log('Column initialization info:', err.message);
  }
}

export async function GET() {
  try {
    await initDB();
    const { rows } = await sql`
      SELECT 
        id, date, course, score, par, putts, 
        holes_data as holes, 
        images_data as images, 
        drawings_data as drawings 
      FROM golf_rounds 
      ORDER BY date DESC
    `;
    return NextResponse.json(rows);
  } catch (error) {
    console.error('GET Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    await initDB();
    const body = await request.json();
    const { id, date, course, score, par, putts, holes, images, drawings } = body;

    if (!id) {
      return NextResponse.json({ error: 'Missing round ID' }, { status: 400 });
    }

    const holesJson = JSON.stringify(holes || []);
    const imagesJson = JSON.stringify(images || []);
    const drawingsJson = JSON.stringify(drawings || {});

    await sql`
      INSERT INTO golf_rounds (id, date, course, score, par, putts, holes_data, images_data, drawings_data)
      VALUES (
        ${id}, 
        ${date}, 
        ${course}, 
        ${score}, 
        ${par}, 
        ${putts}, 
        ${holesJson}, 
        ${imagesJson},
        ${drawingsJson}
      )
      ON CONFLICT (id) DO UPDATE SET
        date = EXCLUDED.date,
        course = EXCLUDED.course,
        score = EXCLUDED.score,
        par = EXCLUDED.par,
        putts = EXCLUDED.putts,
        holes_data = EXCLUDED.holes_data,
        images_data = EXCLUDED.images_data,
        drawings_data = EXCLUDED.drawings_data;
    `;

    return NextResponse.json({ success: true, id });
  } catch (error) {
    console.error('POST Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

