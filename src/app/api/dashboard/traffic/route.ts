import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { RouterOSAPI } from "node-routeros";

// Disable caching - always fetch fresh data
export const dynamic = 'force-dynamic';
export const revalidate = 0;

interface InterfaceTraffic {
  name: string;
  rxBytes: number;
  txBytes: number;
  rxRate: number;
  txRate: number;
  rxPackets: number;
  txPackets: number;
  running: boolean;
}

interface RouterTraffic {
  routerId: string;
  routerName: string;
  interfaces: InterfaceTraffic[];
  error?: string;
}

export async function GET(request: NextRequest) {
  try {
    // Check authentication
    const session = await getServerSession(authOptions);
    if (!session || !session.user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get all active routers
    const routers = await prisma.router.findMany({
      select: {
        id: true,
        name: true,
        ipAddress: true,
        port: true,
        username: true,
        password: true,
      },
    });

    if (routers.length === 0) {
      return NextResponse.json({
        success: true,
        routers: [],
        message: 'No active routers found',
      });
    }

    // Fetch traffic data from all routers in parallel
    const trafficPromises = routers.map(async (router): Promise<RouterTraffic> => {
      try {
        const conn = new RouterOSAPI({
          host: router.ipAddress,
          port: router.port || 8728,
          user: router.username,
          password: router.password,
          timeout: 5,
        });

        await conn.connect();

        // Get interface stats
        const interfaces = await conn.write('/interface/print', [
          '=.proplist=name,running,rx-byte,tx-byte,rx-packet,tx-packet',
        ]);

        await conn.close();

        // Parse interface data
        const interfaceTraffic: InterfaceTraffic[] = interfaces.map((iface: any) => {
          // MikroTik returns running status as string 'true'/'false' OR boolean true/false
          // We only check 'running' property - if it's running in MikroTik, show as running
          const isRunning = iface.running === 'true' || iface.running === true;
          
          return {
            name: iface.name || 'unknown',
            rxBytes: parseInt(iface['rx-byte'] || '0'),
            txBytes: parseInt(iface['tx-byte'] || '0'),
            rxRate: 0, // Will be calculated on frontend
            txRate: 0, // Will be calculated on frontend
            rxPackets: parseInt(iface['rx-packet'] || '0'),
            txPackets: parseInt(iface['tx-packet'] || '0'),
            // Use running status directly from MikroTik (R flag means running)
            running: isRunning,
          };
        });

        return {
          routerId: router.id,
          routerName: router.name,
          interfaces: interfaceTraffic,
        };
      } catch (error: any) {
        console.error(`[Traffic] Error fetching from ${router.name}:`, error.message);
        return {
          routerId: router.id,
          routerName: router.name,
          interfaces: [],
          error: error.message || 'Connection failed',
        };
      }
    });

    const routerTraffic = await Promise.all(trafficPromises);

    return NextResponse.json({
      success: true,
      routers: routerTraffic,
      timestamp: new Date().toISOString(),
    });
  } catch (error: any) {
    console.error("[Traffic] Error:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch traffic data",
        details: error.message,
      },
      { status: 500 }
    );
  }
}
