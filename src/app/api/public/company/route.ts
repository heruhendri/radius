import { NextResponse } from 'next/server';
import { getCompanyInfo } from '@/lib/company';

export async function GET() {
  try {
    const company = await getCompanyInfo();
    
    return NextResponse.json({
      success: true,
      company: {
        name: company.name,
        logo: (company as any).logo || null,
        poweredBy: (company as any).poweredBy || 'SALFANET RADIUS',
      }
    });
  } catch (error: any) {
    console.error('Get company error:', error);
    return NextResponse.json(
      { 
        success: true, 
        company: { name: 'SALFANET RADIUS', logo: null, poweredBy: 'SALFANET RADIUS' } 
      }
    );
  }
}
