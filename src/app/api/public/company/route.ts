import { NextResponse } from 'next/server';
import { prisma } from '@/server/db/client';

export async function GET() {
  try {
    const company = await prisma.company.findFirst({
      select: {
        name: true,
        logo: true,
        phone: true,
        poweredBy: true,
        footerAdmin: true,
        footerCustomer: true,
        footerTechnician: true,
      }
    });

    return NextResponse.json({
      success: true,
      company: {
        name: company?.name || 'SALFANET RADIUS',
        logo: company?.logo || null,
        phone: company?.phone || null,
        poweredBy: company?.poweredBy || 'SALFANET RADIUS',
        footerAdmin: company?.footerAdmin || null,
        footerCustomer: company?.footerCustomer || null,
        footerTechnician: company?.footerTechnician || null,
      }
    });
  } catch (error: any) {
    console.error('Get company error:', error);
    return NextResponse.json({
      success: true,
      company: {
        name: 'SALFANET RADIUS',
        logo: null,
        phone: null,
        poweredBy: 'SALFANET RADIUS',
        footerAdmin: null,
        footerCustomer: null,
        footerTechnician: null,
      }
    });
  }
}
