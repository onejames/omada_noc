import React from 'react';
import { redirect } from 'next/navigation';
import Dashboard from '@/app/components/Dashboard';
import { getOmadaClient } from '@/lib/omada/client';
import { getCurrentSession } from '@/lib/auth/session';
import { getUserDeviceTags } from '@/lib/db/queries';
import { TelemetryResponse, OmadaClientDevice } from '@/types/omada';

export const dynamic = 'force-dynamic';

export default async function Page() {
  const session = await getCurrentSession();
  if (!session) {
    redirect('/login');
    return null;
  }

  const client = getOmadaClient();
  const status = await client.getNetworkStatus();
  
  let clients: OmadaClientDevice[] = [];

  if (status.controllerOnline) {
    try {
      clients = await client.getActiveClients();
    } catch (err) {
      console.error('Failed to load initial client list:', err);
    }
  }

  // Device Tagging Matrix Scoping:
  // If user is not ADMIN and has tagged devices, scope telemetry to those devices
  let filteredClients = clients;
  if (session.role !== 'ADMIN') {
    try {
      const userTags = await getUserDeviceTags(session.userId);
      if (userTags && userTags.length > 0) {
        const allowedMacs = new Set(userTags.map((t) => t.macAddress.toUpperCase()));
        filteredClients = clients.filter((c) => allowedMacs.has(c.mac.toUpperCase()));

        // Recalculate status KPI metrics to match the scoped subset
        status.totalClients = filteredClients.length;
        status.wirelessClients = filteredClients.filter((c) => c.wireless).length;
        status.wiredClients = filteredClients.filter((c) => !c.wireless).length;
        status.totalActivityRate = filteredClients.reduce((sum, c) => sum + (c.activity || 0), 0);
        status.totalTrafficDown = filteredClients.reduce((sum, c) => sum + (c.trafficDown || 0), 0);
        status.totalTrafficUp = filteredClients.reduce((sum, c) => sum + (c.trafficUp || 0), 0);
      }
    } catch (err) {
      console.error('Error fetching user device tags for initial page render:', err);
    }
  }

  const initialData: TelemetryResponse = {
    status,
    topClients: filteredClients.slice(0, 50),
    allClients: filteredClients,
  };

  return <Dashboard initialData={initialData} />;
}