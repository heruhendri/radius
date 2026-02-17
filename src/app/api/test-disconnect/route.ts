import { NextResponse } from 'next/server'
import { disconnectExpiredSessions } from '@/lib/services/coaService'

export async function POST() {
  try {
    console.log('[TEST] Manual trigger: disconnectExpiredSessions')
    const result = await disconnectExpiredSessions()
    
    return NextResponse.json({
      success: true,
      disconnected: result.disconnected,
      message: `Disconnected ${result.disconnected} expired sessions`
    })
  } catch (error: any) {
    console.error('[TEST] Error:', error)
    return NextResponse.json({
      success: false,
      error: error.message
    }, { status: 500 })
  }
}
