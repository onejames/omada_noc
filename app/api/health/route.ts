import { NextResponse } from 'next/server';

/**
 * Health check endpoint for Kubernetes liveness/readiness probes and load balancers.
 * Unauthenticated and lightweight.
 */
export async function GET() {
  return NextResponse.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    service: 'noc_dash',
  });
}
