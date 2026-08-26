import React from 'react';
import Dashboard from '@/app/components/Dashboard';
import { getOmadaClient } from '@/lib/omada/client';
import { TelemetryResponse, OmadaClientDevice } from '@/types/omada';

export const dynamic = 'force-dynamic';

export default async function Page() {
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

  const initialData: TelemetryResponse = {
    status,
    topClients: clients.slice(0, 50),
    allClients: clients,
  };

  return <Dashboard initialData={initialData} />;
}