import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { seedParameterDisplayConfig } from '../../../../../../../prisma/seeds/parameter-display-config';

// POST - Reset to default configurations
export async function POST(request: NextRequest) {
  try {
    console.log('🔄 Resetting parameter display configurations to defaults...');
    
    // Run the seed function
    await seedParameterDisplayConfig();

    console.log('✅ Parameter display configurations reset successfully');

    return NextResponse.json({
      success: true,
      message: 'Configurations reset to defaults successfully'
    });
  } catch (error: any) {
    console.error('❌ Error resetting parameter display configs:', error);
    return NextResponse.json(
      { success: false, error: error.message },
      { status: 500 }
    );
  }
}
