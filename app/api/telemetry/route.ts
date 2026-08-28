import { NextResponse } from 'next/server';
import { getOmadaClient } from '@/lib/omada/client';
import { TelemetryResponse, OmadaClientDevice } from '@/types/omada';
import { getCurrentSession } from '@/lib/auth/session';
import { getUserDeviceTags } from '@/lib/db/queries';
import { resolveClientVlan } from '@/lib/omada/formatters';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const limit = parseInt(searchParams.get('limit') || '10', 10);
    const includeAll = searchParams.get('all') === 'true';
    const sortBy = (searchParams.get('sort') || 'activity') as 'activity' | 'traffic' | 'uptime';

    const client = getOmadaClient();
    const rawStatus = await client.getNetworkStatus();

    let topClients: OmadaClientDevice[] = [];
    let allClients: OmadaClientDevice[] | undefined = undefined;
    let status = { ...rawStatus };

    let topology = undefined;
    let networks = undefined;
    let ssids = undefined;
    let poeDevices = undefined;
    let devices = undefined;

    if (status.controllerOnline) {
      try {
        const [rawClients, topoData, netData, ssidData, poeData, devData] = await Promise.all([
          client.getActiveClients(),
          typeof client.getTopology === 'function' ? client.getTopology().catch(() => []) : Promise.resolve([]),
          typeof client.getLanNetworks === 'function' ? client.getLanNetworks().catch(() => []) : Promise.resolve([]),
          typeof client.getSsids === 'function' ? client.getSsids().catch(() => []) : Promise.resolve([]),
          typeof client.getPoeBudgets === 'function' ? client.getPoeBudgets().catch(() => []) : Promise.resolve([]),
          typeof client.getDevices === 'function' ? client.getDevices().catch(() => []) : Promise.resolve([]),
        ]);

        // Enrich clients with resolved vlanId
        let clients = (rawClients || []).map((c) => ({
          ...c,
          vlanId: resolveClientVlan(c, netData, ssidData),
        }));
        topology = topoData;
        poeDevices = poeData;
        devices = devData;

        // Map live client counts into networks & SSIDs
        if (netData && netData.length > 0) {
          networks = netData.map((net) => ({
            ...net,
            clientCount: clients.filter((c) => c.vlanId === net.vlan).length,
          }));
        } else {
          networks = netData;
        }

        if (ssidData && ssidData.length > 0) {
          ssids = ssidData.map((s) => ({
            ...s,
            clientCount: clients.filter((c) => c.ssid?.toLowerCase() === s.name.toLowerCase()).length,
          }));
        } else {
          ssids = ssidData;
        }

        // 1. Check Session & Device Tagging Scoping
        const session = await getCurrentSession();
        if (session && session.role !== 'ADMIN') {
          const userTags = await getUserDeviceTags(session.userId);
          if (userTags.length > 0) {
            const allowedMacs = new Set(userTags.map((t) => t.macAddress.toUpperCase()));
            // Scope clients strictly to tagged MACs
            clients = clients.filter((c) => allowedMacs.has((c.mac || '').toUpperCase()));

            // Recalculate KPIs for scoped user view
            const wirelessCount = clients.filter((c) => c.wireless).length;
            const wiredCount = clients.filter((c) => !c.wireless).length;
            const totalActivity = clients.reduce((acc, c) => acc + (c.activity || 0), 0);
            const totalDown = clients.reduce((acc, c) => acc + (c.trafficDown || 0), 0);
            const totalUp = clients.reduce((acc, c) => acc + (c.trafficUp || 0), 0);

            status = {
              ...status,
              totalClients: clients.length,
              wirelessClients: wirelessCount,
              wiredClients: wiredCount,
              totalActivityRate: totalActivity,
              totalTrafficDown: totalDown,
              totalTrafficUp: totalUp,
            };
          }
          // If userTags.length === 0: Fallback rule "if nothing is tagged then you get to see everything."
        }

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
      ...(topology && { topology }),
      ...(networks && { networks }),
      ...(ssids && { ssids }),
      ...(poeDevices && { poeDevices }),
      ...(devices && { devices }),
    };

    return NextResponse.json(payload, {
      status: 200,
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
