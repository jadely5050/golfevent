import { sql } from '@vercel/postgres';
import { NextResponse } from 'next/server';

export async function DELETE(request, { params }) {
  try {
    const { id } = params;
    await sql`DELETE FROM golf_rounds WHERE id = ${id}`;
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
