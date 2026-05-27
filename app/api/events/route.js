import { sql } from '@vercel/postgres';
import { NextResponse } from 'next/server';

async function initDB() {
  await sql`
    CREATE TABLE IF NOT EXISTS event_pages (
      slug                TEXT PRIMARY KEY,
      title               TEXT NOT NULL,
      subtitle            TEXT,
      event_date          DATE,
      course_name         TEXT,
      course_address      TEXT,
      course_phone        TEXT,
      course_distance_note TEXT,
      map_links           JSONB DEFAULT '{}'::jsonb,
      schedule            JSONB DEFAULT '[]'::jsonb,
      groups              JSONB DEFAULT '[]'::jsonb,
      award_text          TEXT,
      settlement_text     TEXT,
      lunch               JSONB,
      notice              JSONB,
      par_info            JSONB DEFAULT '[4,4,4,3,4,3,5,4,5,4,4,5,4,3,4,5,3,4]'::jsonb,
      yardage_images      JSONB DEFAULT '[]'::jsonb,
      green_images        JSONB DEFAULT '[]'::jsonb,
      created_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      updated_at          TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `;
}

export async function GET() {
  try {
    await initDB();
    const { rows } = await sql`
      SELECT slug, title, subtitle, event_date, course_name, created_at
      FROM event_pages
      ORDER BY created_at DESC
    `;
    return NextResponse.json(rows);
  } catch (error) {
    console.error('GET /api/events error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(request) {
  try {
    await initDB();
    const body = await request.json();

    const {
      slug, title, subtitle, event_date,
      course_name, course_address, course_phone, course_distance_note,
      map_links, schedule, groups,
      award_text, settlement_text,
      lunch, notice,
      par_info, yardage_images, green_images,
    } = body;

    if (!slug || !title) {
      return NextResponse.json({ error: 'slug와 title은 필수입니다.' }, { status: 400 });
    }

    await sql`
      INSERT INTO event_pages (
        slug, title, subtitle, event_date,
        course_name, course_address, course_phone, course_distance_note,
        map_links, schedule, groups,
        award_text, settlement_text,
        lunch, notice,
        par_info, yardage_images, green_images,
        updated_at
      )
      VALUES (
        ${slug},
        ${title},
        ${subtitle || null},
        ${event_date || null},
        ${course_name || null},
        ${course_address || null},
        ${course_phone || null},
        ${course_distance_note || null},
        ${JSON.stringify(map_links || {})},
        ${JSON.stringify(schedule || [])},
        ${JSON.stringify(groups || [])},
        ${award_text || null},
        ${settlement_text || null},
        ${lunch ? JSON.stringify(lunch) : null},
        ${notice ? JSON.stringify(notice) : null},
        ${JSON.stringify(par_info || [4,4,4,3,4,3,5,4,5,4,4,5,4,3,4,5,3,4])},
        ${JSON.stringify(yardage_images || [])},
        ${JSON.stringify(green_images || [])},
        NOW()
      )
      ON CONFLICT (slug) DO UPDATE SET
        title               = EXCLUDED.title,
        subtitle            = EXCLUDED.subtitle,
        event_date          = EXCLUDED.event_date,
        course_name         = EXCLUDED.course_name,
        course_address      = EXCLUDED.course_address,
        course_phone        = EXCLUDED.course_phone,
        course_distance_note = EXCLUDED.course_distance_note,
        map_links           = EXCLUDED.map_links,
        schedule            = EXCLUDED.schedule,
        groups              = EXCLUDED.groups,
        award_text          = EXCLUDED.award_text,
        settlement_text     = EXCLUDED.settlement_text,
        lunch               = EXCLUDED.lunch,
        notice              = EXCLUDED.notice,
        par_info            = EXCLUDED.par_info,
        yardage_images      = EXCLUDED.yardage_images,
        green_images        = EXCLUDED.green_images,
        updated_at          = NOW()
    `;

    return NextResponse.json({ success: true, slug });
  } catch (error) {
    console.error('POST /api/events error:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
