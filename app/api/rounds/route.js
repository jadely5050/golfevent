import { sql } from '@vercel/postgres';
import { NextResponse } from 'next/server';

export async function GET() {
  try {
    const { rows } = await sql`SELECT id, date, course, score, par, putts, holes_data as holes, images_data as images FROM golf_rounds ORDER BY date DESC`;
    return NextResponse.json(rows);
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    const body = await request.json();
    console.log('API Request Body:', JSON.stringify(body, null, 2)); // 데이터 확인용 로그
    
    const { id, date, course, score, par, putts, holes, images } = body;

    if (!id) {
      return NextResponse.json({ error: 'Missing round ID' }, { status: 400 });
    }

    // 1. 테이블 및 컬럼 초기화 (더 확실한 방식)
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
        created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      );
    `;

    // 2. 컬럼이 없을 경우를 대비한 명시적 추가
    try {
      await sql`ALTER TABLE golf_rounds ADD COLUMN IF NOT EXISTS images_data JSONB;`;
      console.log('Checked/Added images_data column');
    } catch (columnError) {
      console.log('images_data column already exists or table issue:', columnError.message);
    }

    // 3. Insert or Update 실행
    const holesJson = JSON.stringify(holes || []);
    const imagesJson = JSON.stringify(images || []);

    console.log('Saving imagesJson:', imagesJson);

    await sql`
      INSERT INTO golf_rounds (id, date, course, score, par, putts, holes_data, images_data)
      VALUES (
        ${id}, 
        ${date}, 
        ${course}, 
        ${score}, 
        ${par}, 
        ${putts}, 
        ${holesJson}, 
        ${imagesJson}
      )
      ON CONFLICT (id) DO UPDATE SET
        date = EXCLUDED.date,
        course = EXCLUDED.course,
        score = EXCLUDED.score,
        par = EXCLUDED.par,
        putts = EXCLUDED.putts,
        holes_data = EXCLUDED.holes_data,
        images_data = EXCLUDED.images_data;
    `;

    console.log('Successfully saved to Neon DB');
    return NextResponse.json({ success: true, id });
  } catch (error) {
    console.error('CRITICAL API ERROR:', error); // 상세 에러 로그
    return NextResponse.json({ 
      error: error.message,
      stack: error.stack 
    }, { status: 500 });
  }
}
