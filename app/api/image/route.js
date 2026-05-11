import { NextResponse } from 'next/server';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';

const s3Client = new S3Client({
  region: 'auto',
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

export async function GET(request) {
  try {
    // 환경 변수 확인
    if (!process.env.R2_ENDPOINT || !process.env.R2_ACCESS_KEY_ID || !process.env.R2_SECRET_ACCESS_KEY || !process.env.R2_BUCKET_NAME) {
      return NextResponse.json({ 
        error: 'Configuration missing', 
        details: 'R2 environment variables are not set in Vercel settings.' 
      }, { status: 500 });
    }

    const { searchParams } = new URL(request.url);
    const key = searchParams.get('key');

    if (!key) {
      return NextResponse.json({ error: 'Missing key parameter' }, { status: 400 });
    }

    const command = new GetObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: key,
    });

    const response = await s3Client.send(command);
    
    // SDK v3의 편리한 변환 메서드 사용
    const byteArray = await response.Body.transformToByteArray();
    const contentType = response.ContentType || 'image/jpeg';

    return new NextResponse(byteArray, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=86400', // 1일 캐시
      },
    });
  } catch (error) {
    console.error('Image proxy error:', error);
    return NextResponse.json({ 
      error: 'Image not found or R2 error', 
      details: error.message,
      key: request.nextUrl.searchParams.get('key')
    }, { status: 404 });
  }
}
