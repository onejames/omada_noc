/**
 * Omada Physical Hardware Controller Live Integration Diagnostic Test Script
 * 
 * Target: Physical Omada Hardware Controller Appliance at 192.168.100.2
 * 
 * Usage:
 *   npx tsx scripts/test-controller.ts
 *   or
 *   npm run test:controller
 */

import fs from 'fs';
import path from 'path';
import { OmadaClient } from '../lib/omada/client';
import { formatBytes, formatRate, formatMac } from '../lib/omada/formatters';

// Automatically load .env.local if not already in environment
const envPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envPath) && typeof process.loadEnvFile === 'function') {
  try {
    process.loadEnvFile(envPath);
  } catch {
    // Already loaded or unsupported
  }
}

async function runControllerDiagnostics() {
  console.log('\n======================================================');
  console.log('  🔍 Omada Physical Hardware Controller Diagnostics  ');
  console.log('======================================================\n');

  const config = {
    baseUrl: process.env.OMADA_URL || 'https://192.168.100.2',
    username: process.env.OMADA_USER || 'admin',
    siteNameOrId: process.env.OMADA_SITE || 'Default',
  };

  console.log(`[1/4] Target Controller Appliance Configuration:`);
  console.log(`      - Physical IP / URL:  ${config.baseUrl}`);
  console.log(`      - Admin User:         ${config.username}`);
  console.log(`      - Target Site:        ${config.siteNameOrId}`);
  console.log(`      - Hardware Appliance: Yes (LAN accessible)\n`);

  const client = new OmadaClient();
  const startTime = Date.now();

  try {
    // Step 1: Authentication Handshake with Physical Controller
    console.log('[2/4] Executing 2-Step Authentication Handshake...');
    await client.login(true);
    const loginDuration = Date.now() - startTime;
    console.log(`      ✅ Successfully authenticated with Omada Controller (${loginDuration}ms)`);

    // Step 2: Site Discovery & Resolution
    console.log('\n[3/4] Discovering Sites & Resolving Target Site ID...');
    const sites = await client.getSites();
    console.log(`      Found ${sites.length} accessible site(s) on controller:`);
    sites.forEach((s) => console.log(`      - "${s.name}" (Site ID: ${s.siteId})`));

    const resolvedSiteId = await client.getResolvedSiteId();
    console.log(`      ✅ Target site resolved to internal ID: "${resolvedSiteId}"`);

    // Step 3: Live Telemetry Extraction
    console.log('\n[4/4] Fetching Live Client Device Telemetry...');
    const status = await client.getNetworkStatus();
    const clients = await client.getActiveClients();
    const totalDuration = Date.now() - startTime;

    console.log(`      ✅ Live telemetry extracted successfully (${totalDuration}ms total)\n`);
    console.log('------------------------------------------------------');
    console.log('  📊 Physical Network Status Summary:');
    console.log('------------------------------------------------------');
    console.log(`  • Controller ID:      ${status.omadacId}`);
    console.log(`  • Active Site:        ${status.siteName} (${status.siteId})`);
    console.log(`  • Total Live Clients: ${status.totalClients}`);
    console.log(`    - 📶 Wireless:      ${status.wirelessClients}`);
    console.log(`    - 🔌 Wired:         ${status.wiredClients}`);
    console.log(`  • Total Throughput:   ${formatRate(status.totalActivityRate)}`);
    console.log(`  • Cumulative Traffic:`);
    console.log(`    - Download:         ${formatBytes(status.totalTrafficDown)}`);
    console.log(`    - Upload:           ${formatBytes(status.totalTrafficUp)}`);

    if (clients.length > 0) {
      console.log('\n  📱 Top Active Client Devices:');
      const sorted = [...clients].sort((a, b) => (b.activity || 0) - (a.activity || 0)).slice(0, 10);
      sorted.forEach((c, idx) => {
        const name = c.name || c.hostName || 'Unnamed Device';
        const type = c.wireless ? `Wi-Fi (${c.ssid || 'SSID'})` : `Wired (Port ${c.port ?? 'N/A'})`;
        console.log(`    ${(idx + 1).toString().padStart(2)}. ${name.padEnd(24)} | IP: ${(c.ip || 'N/A').padEnd(15)} | MAC: ${formatMac(c.mac)} | ${type.padEnd(20)} | Rate: ${formatRate(c.activity)}`);
      });
    }

    console.log('\n======================================================');
    console.log('  🎉 All diagnostics passed! Hardware controller online.');
    console.log('======================================================\n');
    process.exit(0);
  } catch (error: unknown) {
    const totalDuration = Date.now() - startTime;
    const msg = error instanceof Error ? error.message : String(error);

    console.error('\n❌ Controller Connection Failed!');
    console.error(`   Error details: ${msg} (after ${totalDuration}ms)\n`);
    console.error('💡 Troubleshooting Suggestions:');
    console.error('   1. Verify physical hardware controller is powered on at 192.168.100.2.');
    console.error('   2. Verify OMADA_URL, OMADA_USER, OMADA_PASS in `.env.local`.');
    console.error('   3. Ensure your workstation is on the 192.168.100.0/24 subnet or route is reachable.');
    console.error('   4. Ensure OMADA_ALLOW_INSECURE_SSL=true for self-signed hardware certificates.\n');

    process.exit(1);
  }
}

runControllerDiagnostics();
