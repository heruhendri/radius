import { NextRequest, NextResponse } from 'next/server';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ filename: string }> }
) {
  try {
    const { filename } = await params;
    
    // Security: Prevent path traversal
    if (filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      return NextResponse.json(
        { error: 'Invalid filename' },
        { status: 400 }
      );
    }
    
    const filepath = join(process.cwd(), 'public', 'uploads', 'payment-proofs', filename);
    
    if (!existsSync(filepath)) {
      return NextResponse.json(
        { error: 'File not found' },
        { status: 404 }
      );
    }
    
    const file = await readFile(filepath);
    
    // Determine content type based on extension
    const ext = filename.split('.').pop()?.toLowerCase();
    let contentType = 'image/jpeg';
    
    if (ext === 'png') contentType = 'image/png';
    else if (ext === 'webp') contentType = 'image/webp';
    else if (ext === 'jpg' || ext === 'jpeg') contentType = 'image/jpeg';
    
    return new NextResponse(file, {
      headers: {
        'Content-Type': contentType,
        'Cache-Control': 'public, max-age=31536000, immutable',
      },
    });
  } catch (error) {
    console.error('Serve file error:', error);
    return NextResponse.json(
      { error: 'Failed to serve file' },
      { status: 500 }
    );
  }
}
