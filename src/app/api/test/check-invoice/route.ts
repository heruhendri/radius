import { NextRequest, NextResponse } from 'next/server';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

export async function GET(request: NextRequest) {
  const invoiceId = request.nextUrl.searchParams.get('id');
  
  if (!invoiceId) {
    return NextResponse.json({ error: 'Missing invoice ID' }, { status: 400 });
  }

  const invoice = await prisma.invoice.findUnique({
    where: { id: invoiceId },
    select: {
      id: true,
      status: true,
      paymentToken: true,
      paymentLink: true,
    },
  });

  return NextResponse.json(invoice);
}
