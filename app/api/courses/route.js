import { sql } from '@vercel/postgres';
import { NextResponse } from 'next/server';

async function initDB() {
  await sql`
    CREATE TABLE IF NOT EXISTS golf_courses (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      yardage_images JSONB,
      green_images JSONB,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `;
}

export async function GET() {
  try {
    await initDB();
    const { rows } = await sql`
      SELECT id, name, yardage_images, green_images 
      FROM golf_courses 
      ORDER BY name ASC
    `;
    return NextResponse.json(rows);
  } catch (error) {
    console.error('GET Courses Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    await initDB();
    const body = await request.json();
    const { id, name, yardage_images, green_images } = body;

    if (!id || !name) {
      return NextResponse.json({ error: 'Missing ID or name' }, { status: 400 });
    }

    await sql`
      INSERT INTO golf_courses (id, name, yardage_images, green_images)
      VALUES (${id}, ${name}, ${JSON.stringify(yardage_images)}, ${JSON.stringify(green_images)})
      ON CONFLICT (id) DO UPDATE SET
        name = EXCLUDED.name,
        yardage_images = EXCLUDED.yardage_images,
        green_images = EXCLUDED.green_images;
    `;

    return NextResponse.json({ success: true, id });
  } catch (error) {
    console.error('POST Course Error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
