# Implementation Plan & Timeline

> **Constraint Acknowledgment:** The developer will be away from a primary workstation (iPad only) from Sept 4 - Sept 8. All heavy coding, compilation, containerization, and live hardware testing have been completed ahead of schedule.

---

## 🎯 Progress Dashboard

| Phase | Description | Window | Status |
| :--- | :--- | :--- | :--- |
| **Phase 1: The Foundation** | Physical Omada Client, API routes, > 98% coverage | Aug 26 – Aug 28 | 🟢 **Complete** |
| **Phase 2: Frontend Visualization** | Interactive telemetry UI, polling, filters, sort | Aug 29 – Aug 31 | 🟢 **Complete** |
| **Phase 3: MCP & Containerization** | 5 MCP Tools, AI Copilot, Podman container build | Sept 1 – Sept 3 | 🟢 **Complete** |
| **Phase 4: Architecture & Narrative** | Diagrams, tech stack alignment, K8s manifests | Sept 4 – Sept 8 | 🟢 **Complete** |
| **Phase 5: Polish & Dry Run** | Interview presentation rehearsal | Sept 9 | 🟡 **Ready for Dry Run** |

---

## Architecture Overview
- **Data Source:** Real physical TP-Link Omada Hardware Controller appliance located on LAN at `192.168.100.2` (14 physical devices: 9 APs, 4 Switches, 1 Gateway, 70+ client devices).
- **Target Application:** `noc_dash` full-stack Next.js 16 / React 19 / Tailwind CSS application with 5-tool MCP server bridge and interactive AI copilot.
- **Production Runtime:** Containerized deployment using Podman / Docker with Next.js standalone output.

---

## Phase 1: The Foundation (Desktop) | Aug 26 - Aug 28
**Status:** 🟢 Complete

### Tasks:
- [x] Set up `.env.local` for Omada physical appliance credentials.
- [x] Implement the `OmadaClient` engine for 2-step authentication, token/cookie management, dynamic site resolution, and token refresh.
- [x] Create backend API route `/api/telemetry` in Next.js to proxy Omada data with sorting and filtering.
- [x] Build standalone diagnostic CLI `scripts/test-controller.ts` to verify physical hardware communication against `192.168.100.2`.
- [x] Achieve 98%+ test coverage with Vitest and V8 coverage provider (**achieved 78 tests passing**).

---

## Phase 2: Frontend Visualization (Desktop) | Aug 29 - Aug 31
**Status:** 🟢 Complete

### Tasks:
- [x] Implement the Next.js UI using Tailwind CSS v4 and high-contrast dark-mode aesthetics.
- [x] Build the summary metrics grid (Total, Wired, Wireless clients, instantaneous throughput rate, cumulative data volume).
- [x] Build the interactive client telemetry table with live search, medium filter (All / Wi-Fi / Ethernet), and sorting (Activity / Traffic / Uptime).
- [x] Handle error and reconnect states with troubleshooting instructions.
- [x] Implement selectable live auto-polling intervals (5s Live, 10s, 30s, Paused) and manual refresh trigger.

---

## Phase 3: MCP & Containerization (Desktop) | Sept 1 - Sept 3
**Status:** 🟢 Complete

### Tasks:
- [x] Install `@modelcontextprotocol/sdk` and `zod`.
- [x] Implement 5 specialized MCP tools in [`mcp/server.ts`](file:///Users/jameslaster/Code/posh/noc_dash/mcp/server.ts):
  - `get_network_status` (High-level status & KPIs)
  - `get_active_clients` (Client device list with filtering & sorting)
  - `get_network_devices` (Infrastructure hardware: APs, Switches, Gateway)
  - `get_client_detail` (Deep RF telemetry: RSSI dBm, channel, negotiated PHY rates)
  - `audit_network_health` (Automated network health score, alerts, & recommendations)
- [x] Build interactive terminal AI Copilot CLI ([`scripts/mcp-copilot.ts`](file:///Users/jameslaster/Code/posh/noc_dash/scripts/mcp-copilot.ts) / `npm run mcp:copilot`).
- [x] Build automated AI Agent runner ([`scripts/mcp-agent.ts`](file:///Users/jameslaster/Code/posh/noc_dash/scripts/mcp-agent.ts) / `npm run mcp:agent`).
- [x] Configure Claude Desktop integration snippet and Anthropic MCP Inspector (`npm run mcp:inspect`).
- [x] Write multi-stage `Containerfile` / `.dockerignore` / `compose.yaml`.
- [x] Build and run the containerized application (`./scripts/build-container.sh` and `./scripts/run-container.sh`) verifying live connectivity to `192.168.100.2`.
- [x] Add Kubernetes declarative manifests with Kustomize (`k8s/deployment.yaml`, `k8s/service.yaml`, `k8s/kustomization.yaml`).

---

## Phase 4: Architecture & Narrative (iPad) | Sept 4 - Sept 8
**Status:** 🟢 Complete

### Tasks:
- [x] Draft `README.md` containing setup instructions, Podman commands, and MCP integration details.
- [x] Create Mermaid.js sequence diagrams for Omada Auth flow, physical hardware topology, and MCP architecture.
- [x] Review GlobalNOC job description ([`docs/posting.md`](file:///Users/jameslaster/Code/posh/noc_dash/docs/posting.md)) and map every requirement directly to the built codebase in [`docs/techStack.md`](file:///Users/jameslaster/Code/posh/noc_dash/docs/techStack.md).

---

## Phase 5: Polish & Dry Run (Desktop) | Sept 9
**Status:** 🟡 Ready for Dry Run

### Tasks:
- [ ] Pull latest code to desktop.
- [ ] Run a fresh container build (`./scripts/build-container.sh`) and verify connection to `192.168.100.2`.
- [ ] Rehearse a 5-10 minute presentation of the code, UI, live hardware telemetry, and MCP integration for the interview.