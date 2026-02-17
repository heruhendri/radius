import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import { existsSync } from 'fs';
import path from 'path';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  try {
    const { filename } = await params;
    const filepath = path.join(process.cwd(), 'public', 'uploads', 'logos', filename);

    // Check if file exists
    if (!existsSync(filepath)) {
      return new NextResponse('File not found', { status: 404 });
    }

    // Read file
    const fileBuffer = await readFile(filepath);

    // Determine content type based on extension
    const ext = path.extname(filename).toLowerCase();
    const contentTypes: { [key: string]: string } = {
      '.png': 'image/png',
      '.jpg': 'image/jpeg',
      '.jpeg': 'image/jpeg',
      '.svg': 'image/svg+xml',
      '.webp': 'image/webp',
    };

    const contentType = contentTypes[ext] || 'application/octet-stream';

    // Return file with proper headers
    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch (error) {
    console.error('Error serving logo:', error);
    return new NextResponse('Internal Server Error', { status: 500 });
  }
}
