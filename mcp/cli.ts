#!/usr/bin/env node
import { startMcpServer } from './server';

startMcpServer().catch((error) => {
  console.error('Fatal MCP server error:', error);
  process.exit(1);
});
