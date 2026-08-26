import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { OmadaClient } from '../lib/omada/client';
import { formatBytes, formatRate, formatUptime, formatMac } from '../lib/omada/formatters';

// Initialize the Omada API client from environment variables
export const omadaClient = new OmadaClient();

// Instantiate the MCP Server
export const server = new McpServer({
  name: 'omada-noc-mcp-bridge',
  version: '1.0.0',
});

/**
 * Tool 1: get_network_status
 * Retrieves high-level network health, controller status, client counts, and aggregate throughput.
 */
server.tool(
  'get_network_status',
  'Retrieve real-time Omada controller connectivity status, connected client counts (wired vs wireless), and aggregate bandwidth throughput.',
  {},
  async () => {
    try {
      const status = await omadaClient.getNetworkStatus();

      if (!status.controllerOnline) {
        return {
          content: [
            {
              type: 'text',
              text: `⚠️ Omada Controller is currently offline or unreachable.\nError: ${status.error || 'Connection refused'}\nSite: ${status.siteName || status.siteId}`,
            },
          ],
        };
      }

      const summaryText = [
        `📡 **Omada Network Status**`,
        `- **Controller Status:** Online ✅`,
        `- **Controller ID:** ${status.omadacId || 'N/A'}`,
        `- **Active Site:** ${status.siteName || status.siteId} (ID: ${status.siteId})`,
        `- **Total Connected Clients:** ${status.totalClients}`,
        `  - 📶 Wireless: ${status.wirelessClients}`,
        `  - 🔌 Wired: ${status.wiredClients}`,
        `- **Current Aggregate Throughput:** ${formatRate(status.totalActivityRate)}`,
        `- **Cumulative Transferred Data:**`,
        `  - Download: ${formatBytes(status.totalTrafficDown)}`,
        `  - Upload: ${formatBytes(status.totalTrafficUp)}`,
        `- **Last Telemetry Poll:** ${status.lastUpdated}`,
      ].join('\n');

      return {
        content: [
          {
            type: 'text',
            text: summaryText,
          },
        ],
      };
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      return {
        isError: true,
        content: [
          {
            type: 'text',
            text: `Error querying network status: ${msg}`,
          },
        ],
      };
    }
  }
);

/**
 * Tool 2: get_active_clients
 * Retrieves detailed client device telemetry with filtering and sorting options.
 */
server.tool(
  'get_active_clients',
  'Retrieve a list of active network client devices connected to the Omada network, including IP, MAC, connection type (Wi-Fi/Wired), SSID, signal strength, real-time throughput, and uptime.',
  {
    connection_type: z
      .enum(['all', 'wireless', 'wired'])
      .optional()
      .describe('Filter clients by medium: "all", "wireless", or "wired" (default: "all")'),
    sort_by: z
      .enum(['activity', 'traffic', 'uptime'])
      .optional()
      .describe('Sort clients by: "activity" (current bandwidth rate), "traffic" (cumulative bytes), or "uptime" (default: "activity")'),
    limit: z
      .number()
      .min(1)
      .max(100)
      .optional()
      .describe('Maximum number of client devices to return (default: 10)'),
  },
  async ({ connection_type = 'all', sort_by = 'activity', limit = 10 }) => {
    try {
      const rawClients = await omadaClient.getActiveClients();

      // Filter
      const filtered = rawClients.filter((c) => {
        if (connection_type === 'wireless' && !c.wireless) return false;
        if (connection_type === 'wired' && c.wireless) return false;
        return true;
      });

      // Sort
      filtered.sort((a, b) => {
        if (sort_by === 'traffic') {
          const aTraffic = (a.trafficDown || 0) + (a.trafficUp || 0);
          const bTraffic = (b.trafficDown || 0) + (b.trafficUp || 0);
          return bTraffic - aTraffic;
        }
        if (sort_by === 'uptime') {
          return (b.uptime || 0) - (a.uptime || 0);
        }
        return (b.activity || 0) - (a.activity || 0);
      });

      const topClients = filtered.slice(0, limit);

      if (topClients.length === 0) {
        return {
          content: [
            {
              type: 'text',
              text: `No connected clients found matching filter criteria (medium: ${connection_type}).`,
            },
          ],
        };
      }

      const clientListText = topClients
        .map((c, idx) => {
          const name = c.name || c.hostName || 'Unnamed Device';
          const medium = c.wireless
            ? `📶 Wireless (SSID: ${c.ssid || 'N/A'}${c.rssi ? `, Signal: ${c.rssi} dBm` : ''}${c.apName ? `, AP: ${c.apName}` : ''})`
            : `🔌 Wired (${c.switchName ? `Switch: ${c.switchName}, ` : ''}Port: ${c.port ?? 'N/A'})`;
          
          const throughput = formatRate(c.activity);
          const totalTraffic = formatBytes((c.trafficDown || 0) + (c.trafficUp || 0));
          const down = formatBytes(c.trafficDown);
          const up = formatBytes(c.trafficUp);
          const uptime = formatUptime(c.uptime);

          return [
            `${idx + 1}. **${name}**`,
            `   - **IP:** \`${c.ip || '0.0.0.0'}\` | **MAC:** \`${formatMac(c.mac)}\``,
            `   - **Medium:** ${medium}`,
            `   - **Throughput:** ${throughput}`,
            `   - **Total Traffic:** ${totalTraffic} (Down: ${down} / Up: ${up})`,
            `   - **Uptime:** ${uptime}`,
          ].join('\n');
        })
        .join('\n\n');

      const responseHeader = `📋 **Active Clients (${topClients.length} returned, filtered by ${connection_type}, sorted by ${sort_by}):**\n\n`;

      return {
        content: [
          {
            type: 'text',
            text: responseHeader + clientListText,
          },
        ],
      };
    } catch (error: unknown) {
      const msg = error instanceof Error ? error.message : 'Unknown error';
      return {
        isError: true,
        content: [
          {
            type: 'text',
            text: `Error retrieving active clients: ${msg}`,
          },
        ],
      };
    }
  }
);

// Start the server using stdio transport
export async function startMcpServer() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Omada NOC MCP Bridge running on stdio');
}
