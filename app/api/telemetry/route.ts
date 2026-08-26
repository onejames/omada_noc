import { NextResponse } from 'next/server';
import { getOmadaClient } from '@/lib/omada/client';
import { TelemetryResponse, OmadaClientDevice } from '@/types/omada';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '10', 10);
    const includeAll = searchParams.get('all') === 'true';
    const sortBy = (searchParams.get('sort') || 'activity') as 'activity' | 'traffic' | 'uptime';

    const client = getOmadaClient();
    const status = await client.getNetworkStatus();

    let topClients: OmadaClientDevice[] = [];
    let allClients: OmadaClientDevice[] | undefined = undefined;

    if (status.controllerOnline) {
      try {
        const clients = await client.getActiveClients();
        const sorted = [...clients].sort((a, b) => {
          if (sortBy === 'activity') return (b.activity || 0) - (a.activity || 0);
          if (sortBy === 'traffic') {
            const aT = (a.trafficDown || 0) + (a.trafficUp || 0);
            const bT = (b.trafficDown || 0) + (b.trafficUp || 0);
            return bT - aT;
          }
          if (sortBy === 'uptime') return (b.uptime || 0) - (a.uptime || 0);
          return 0;
        });

        topClients = sorted.slice(0, limit);
        if (includeAll) {
          allClients = sorted;
        }
      } catch (err) {
        console.error('Error fetching clients in telemetry route:', err);
      }
    }

    const payload: TelemetryResponse = {
      status,
      topClients,
      ...(includeAll && { allClients }),
    };

    return NextResponse.json(payload, {
      status: status.controllerOnline ? 200 : 503,
      headers: {
        'Cache-Control': 'no-store, max-age=0',
      },
    });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal Server Error';
    return NextResponse.json(
      {
        error: message,
        status: {
          controllerOnline: false,
          omadacId: null,
          siteId: 'unknown',
          totalClients: 0,
          wirelessClients: 0,
          wiredClients: 0,
          totalActivityRate: 0,
          totalTrafficDown: 0,
          totalTrafficUp: 0,
          lastUpdated: new Date().toISOString(),
          error: message,
        },
        topClients: [],
      },
      { status: 500 }
    );
  }
}
