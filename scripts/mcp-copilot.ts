/**
 * Interactive Omada Network AI Copilot CLI
 * 
 * Interactive terminal assistant that allows network engineers to ask free-form questions
 * about the network and leverages the Omada NOC MCP Server to retrieve real-time data
 * and generate optimization suggestions.
 * 
 * Usage:
 *   npx tsx scripts/mcp-copilot.ts
 *   or
 *   npm run mcp:copilot
 */

import readline from 'readline';
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { StdioClientTransport } from '@modelcontextprotocol/sdk/client/stdio.js';
import path from 'path';
import fs from 'fs';

// Automatically load .env.local if present
const envPath = path.resolve(process.cwd(), '.env.local');
if (fs.existsSync(envPath) && typeof process.loadEnvFile === 'function') {
  try {
    process.loadEnvFile(envPath);
  } catch {
    // Loaded
  }
}

async function startCopilot() {
  console.log('\n===============================================================');
  console.log('  🌐 Omada Network AI Copilot (Interactive Terminal Chat)    ');
  console.log('===============================================================\n');
  console.log('🔌 Connecting to Omada NOC MCP Bridge...');

  const cliPath = path.resolve(process.cwd(), 'mcp/cli.ts');
  const transport = new StdioClientTransport({
    command: 'npx',
    args: ['tsx', cliPath],
    env: {
      ...process.env,
      OMADA_URL: process.env.OMADA_URL || '192.168.100.2',
      OMADA_USER: process.env.OMADA_USER || 'admin',
      OMADA_PASS: process.env.OMADA_PASS || 'password',
      OMADA_SITE: process.env.OMADA_SITE || 'Default',
      OMADA_ALLOW_INSECURE_SSL: 'true',
    },
  });

  const client = new Client(
    { name: 'omada-copilot-client', version: '1.0.0' },
    { capabilities: {} }
  );

  await client.connect(transport);
  const toolsResult = await client.listTools();
  console.log(`✅ Connected! Available MCP Tools: ${toolsResult.tools.map((t) => t.name).join(', ')}\n`);
  console.log('💡 Example questions you can ask:');
  console.log('  • "audit network" or "how is the network health?"');
  console.log('  • "list access points" or "show me all switches"');
  console.log('  • "which devices are using the most bandwidth?"');
  console.log('  • "inspect Master Bedroom TV" or "inspect 192.168.100.74"');
  console.log('  • Type "exit" or "quit" to leave.\n');

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const askQuestion = () => {
    rl.question('\n\x1b[1m\x1b[36mYou:\x1b[0m ', async (userInput) => {
      const input = userInput.trim();
      if (!input || input.toLowerCase() === 'exit' || input.toLowerCase() === 'quit') {
        console.log('\n👋 Exiting Omada Copilot. Goodbye!');
        await client.close().catch(() => {});
        rl.close();
        process.exit(0);
      }

      console.log('\n🤔 \x1b[33mThinking & Selecting MCP Tool...\x1b[0m');

      try {
        let toolName: string = 'get_network_status';
        let toolArgs: Record<string, unknown> = {};

        const lower = input.toLowerCase();

        if (lower.includes('audit') || lower.includes('health') || lower.includes('score') || lower.includes('suggest') || lower.includes('recommend')) {
          toolName = 'audit_network_health';
          toolArgs = {};
        } else if (lower.includes('ap') || lower.includes('access point') || lower.includes('switch') || lower.includes('gateway') || lower.includes('router') || lower.includes('device') || lower.includes('hardware') || lower.includes('infrastructure')) {
          toolName = 'get_network_devices';
          if (lower.includes('ap') || lower.includes('access point')) {
            toolArgs = { device_type: 'ap' };
          } else if (lower.includes('switch')) {
            toolArgs = { device_type: 'switch' };
          } else if (lower.includes('gateway') || lower.includes('router')) {
            toolArgs = { device_type: 'gateway' };
          }
        } else if (lower.includes('inspect') || lower.includes('detail') || lower.includes('lookup') || lower.includes('ip') || lower.includes('mac') || lower.includes('tv') || lower.includes('iphone') || lower.includes('xbox') || lower.includes('why is')) {
          toolName = 'get_client_detail';
          // Extract target query
          const target = input.replace(/inspect|detail|lookup|why is|about|device|client/gi, '').trim() || input;
          toolArgs = { query: target };
        } else if (lower.includes('bandwidth') || lower.includes('top') || lower.includes('traffic') || lower.includes('wifi') || lower.includes('wireless') || lower.includes('wired') || lower.includes('client')) {
          toolName = 'get_active_clients';
          const medium = lower.includes('wireless') || lower.includes('wifi') ? 'wireless' : lower.includes('wired') || lower.includes('ethernet') ? 'wired' : 'all';
          const sortBy = lower.includes('traffic') || lower.includes('data') || lower.includes('download') ? 'traffic' : lower.includes('uptime') ? 'uptime' : 'activity';
          toolArgs = { connection_type: medium, sort_by: sortBy, limit: 5 };
        }

        console.log(`🛠️ \x1b[35mExecuting MCP Tool:\x1b[0m \x1b[1m${toolName}\x1b[0m(${JSON.stringify(toolArgs)})`);
        
        const startTime = Date.now();
        const res = await client.callTool({
          name: toolName,
          arguments: toolArgs,
        });
        const duration = Date.now() - startTime;

        console.log(`⚡ \x1b[32mReceived Live Telemetry (${duration}ms):\x1b[0m\n`);
        const contentList = res.content as Array<{ type: string; text: string }>;
        const text = contentList?.[0]?.text || '';
        console.log(text);
      } catch (err: unknown) {
        console.error('❌ Error executing copilot query:', err);
      }

      askQuestion();
    });
  };

  askQuestion();
}

startCopilot().catch(console.error);
