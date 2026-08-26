# Implementation Plan & Timeline

> **Constraint Acknowledgment:** The developer will be away from a primary workstation (iPad only) from Sept 4 - Sept 8. All heavy coding, compilation, and live hardware testing have been completed ahead of schedule.

---

## 🎯 Progress Dashboard

| Phase | Description | Window | Status |
| :--- | :--- | :--- | :--- |
| **Phase 1: The Foundation** | Physical Omada Client, API routes, > 99% coverage | Aug 26 – Aug 28 | 🟢 **Complete** |
| **Phase 2: Frontend Visualization** | Interactive telemetry UI, polling, filters, sort | Aug 29 – Aug 31 | 🟢 **Complete** |
| **Phase 3: MCP & Containerization** | MCP bridge (`@modelcontextprotocol/sdk`), Podman build | Sept 1 – Sept 3 | 🟢 **Complete** |
| **Phase 4: Architecture & Narrative** | Diagrams, tech stack alignment, K8s manifests | Sept 4 – Sept 8 | 🟢 **Complete** |
| **Phase 5: Polish & Dry Run** | Interview presentation rehearsal | Sept 9 | 🟡 **Ready for Dry Run** |

---

## Architecture Overview
- **Data Source:** Real physical TP-Link Omada Hardware Controller appliance located on LAN at `192.168.100.2`.
- **Target Application:** `noc_dash` full-stack Next.js 16 / React 19 / Tailwind CSS application with MCP server bridge.
- **Production Runtime:** Containerized deployment using Podman / Docker with Next.js standalone output.

---

## Phase 1: The Foundation (Desktop) | Aug 26 - Aug 28
**Status:** 🟢 Complete

### Tasks:
- [x] Set up `.env.local` for Omada physical appliance credentials.
- [x] Implement the `OmadaClient` engine for 2-step authentication, token/cookie management, dynamic site resolution, and token refresh.
- [x] Create backend API route `/api/telemetry` in Next.js to proxy Omada data with sorting and filtering.
- [x] Build standalone diagnostic CLI `scripts/test-controller.ts` to verify physical hardware communication against `192.168.100.2`.
- [x] Achieve 97%+ test coverage with Vitest and V8 coverage provider (**achieved 99.38% statements, 99.66% lines**).

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
- [x] Create an MCP stdio server instance ([`mcp/server.ts`](file:///Users/jameslaster/Code/posh/noc_dash/mcp/server.ts) and [`mcp/cli.ts`](file:///Users/jameslaster/Code/posh/noc_dash/mcp/cli.ts)).
- [x] Register `get_network_status` and `get_active_clients` as MCP tools.
- [x] Configure Claude Desktop integration snippet in documentation.
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