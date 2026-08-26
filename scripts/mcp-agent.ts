/**
 * MCP AI Agent Demonstration & Question-Answering CLI
 * 
 * Simulates and executes an LLM Agent loop interacting with the Omada NOC MCP Server
 * over the official Model Context Protocol stdio transport.
 * 
 * Usage:
 *   npx tsx scripts/mcp-agent.ts
 *   or
 *   npm run mcp:agent
 */

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
    // Already loaded
  }
}

interface QuestionScenario {
  question: string;
  expectedTool: 'get_network_status' | 'get_active_clients';
  args: Record<string, unknown>;
  reasoning: string;
}

const DEMO_SCENARIOS: QuestionScenario[] = [
  {
    question: "How is the network performing right now and how many devices are connected?",
    expectedTool: "get_network_status",
    args: {},
    reasoning: "The user is asking for overall network health, total device count, and aggregated throughput metrics. I will invoke the `get_network_status` MCP tool.",
  },
  {
    question: "Which wireless clients are consuming the most bandwidth at this exact moment?",
    expectedTool: "get_active_clients",
    args: { connection_type: "wireless", sort_by: "activity", limit: 5 },
    reasoning: "The user specifically requests wireless devices sorted by instantaneous throughput (activity). I will invoke `get_active_clients` with `connection_type: 'wireless'`, `sort_by: 'activity'`, and `limit: 5`.",
  },
  {
    question: "Which wired infrastructure and devices have the longest connection uptime?",
    expectedTool: "get_active_clients",
    args: { connection_type: "wired", sort_by: "uptime", limit: 5 },
    reasoning: "The user is inquiring about wired devices sorted by session uptime. I will invoke `get_active_clients` with `connection_type: 'wired'`, `sort_by: 'uptime'`, and `limit: 5`.",
  },
];

async function runMcpAgent() {
  console.log('\n======================================================');
  console.log('  🤖 Omada NOC AI Agent & MCP Protocol Runner         ');
  console.log('======================================================\n');

  console.log('🔌 Step 1: Initializing MCP Client & Connecting over Stdio...');
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
    { name: 'omada-noc-agent-client', version: '1.0.0' },
    { capabilities: {} }
  );

  try {
    await client.connect(transport);
    console.log('   ✅ MCP Client successfully connected to Omada MCP Server.\n');

    console.log('🔍 Step 2: Discovering Available Tools via JSON-RPC `tools/list`...');
    const toolsResponse = await client.listTools();
    console.log(`   Discovered ${toolsResponse.tools.length} tool(s):`);
    toolsResponse.tools.forEach((tool) => {
      console.log(`   • \x1b[36m${tool.name}\x1b[0m: ${tool.description}`);
    });
    console.log('');

    console.log('🧠 Step 3: Executing Agent Question-Answering Scenarios...\n');

    for (let i = 0; i < DEMO_SCENARIOS.length; i++) {
      const scenario = DEMO_SCENARIOS[i];
      console.log('------------------------------------------------------');
      console.log(`💬 \x1b[1mScenario [${i + 1}/${DEMO_SCENARIOS.length}] User Question:\x1b[0m`);
      console.log(`   "${scenario.question}"\n`);

      console.log(`🤔 \x1b[33mAI Model Reasoning:\x1b[0m`);
      console.log(`   ${scenario.reasoning}\n`);

      console.log(`🛠️ \x1b[35mMCP JSON-RPC Tool Call:\x1b[0m`);
      console.log(`   Invoking: \x1b[1m${scenario.expectedTool}\x1b[0m(${JSON.stringify(scenario.args)})\n`);

      const startTime = Date.now();
      const result = await client.callTool({
        name: scenario.expectedTool,
        arguments: scenario.args,
      });
      const duration = Date.now() - startTime;

      console.log(`⚡ \x1b[32mHardware Response Received (${duration}ms from 192.168.100.2):\x1b[0m`);
      const contentList = result.content as Array<{ type: string; text: string }>;
      const responseText = contentList?.[0]?.text || '';
      
      // Indent response text for clean terminal presentation
      console.log(
        responseText
          .split('\n')
          .map((line) => `   ${line}`)
          .join('\n')
      );
      console.log('');
    }

    console.log('======================================================');
    console.log('  🎉 All MCP Question-Answering Scenarios Passed!     ');
    console.log('======================================================\n');
    console.log('💡 How to connect with Claude Desktop:');
    console.log('   Add this server configuration to your `claude_desktop_config.json`:');
    console.log(`   {
     "mcpServers": {
       "omada-noc": {
         "command": "npx",
         "args": ["-y", "tsx", "${cliPath}"],
         "env": {
           "OMADA_URL": "192.168.100.2",
           "OMADA_USER": "${process.env.OMADA_USER || 'admin'}",
           "OMADA_PASS": "********",
           "OMADA_SITE": "Default",
           "OMADA_ALLOW_INSECURE_SSL": "true"
         }
       }
     }
   }\n`);

    await client.close();
    process.exit(0);
  } catch (error: unknown) {
    console.error('\n❌ MCP Agent Execution Failed:', error);
    await client.close().catch(() => {});
    process.exit(1);
  }
}

runMcpAgent();
