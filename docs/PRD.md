# Product Requirements Document (PRD)

- **Project Name:** Omada NOC Dashboard & MCP Bridge
- **Target:** GlobalNOC Software & Network Engineer Interview (Sept 10)
- **Deployment Model:** Containerized Application (Podman) monitoring a Physical Hardware Controller Appliance

## 1. Executive Summary

The objective of this project is to build a containerized, full-stack observability platform that interfaces with a live, **physical TP-Link Omada Hardware Controller appliance** (`192.168.100.2`) managing 14 physical devices (9 APs, 4 Switches, 1 Gateway) and 70+ client devices. The application visualizes real-time network telemetry in a Next.js dashboard and exposes that data to Large Language Models (LLMs) via the **Model Context Protocol (MCP)** with automated diagnostic audit scoring and interactive copilot workflows.

This demonstrates full-stack software development, hardware-level API integration, modern UX/UI design, rootless container orchestration with Podman, and cutting-edge AI agent interoperability.

## 2. Goals & Success Criteria

- **Hardware Network Integration:** Authenticate directly with the physical Omada SDN Hardware Controller at `192.168.100.2` and ingest live telemetry across infrastructure and client devices.
- **Demonstrate Full-Stack Competence:** Successfully fetch, process, and display network metrics in a responsive, modern Next.js/React/Tailwind dashboard.
- **Satisfy AI/LLM Requirements:** Implement an MCP server with 5 specialized tools allowing LLMs (e.g., Claude) to query state, inspect hardware, and generate actionable optimization recommendations.
- **Satisfy Infrastructure Requirements:** Package and deploy the dashboard and MCP bridge using **Podman** (rootless multi-stage container build) and declarative Kubernetes/Kustomize manifests.
- **Maintainability & Reliability:** Maintain strict TypeScript types, 98%+ automated test coverage with Vitest, and complete documentation.

## 3. Core Features (MVP)

- **Physical Controller Authentication Engine:** A robust backend service handling Omada v5.15 API handshakes (`omadacId` auto-discovery, CSRF tokens, session cookies, and dynamic site resolution for sites like `"The Farm"`).
- **Telemetry Dashboard (UI):** A read-only, single-page React dashboard displaying:
  - Hardware controller health/status and site metadata.
  - High-level aggregate metrics (total live clients, Wi-Fi vs. Ethernet distribution, live throughput rate, session cumulative volume).
  - An interactive data table of connected devices with search, filtering by medium, and sorting by bandwidth activity, total data, or uptime.
- **Model Context Protocol (MCP) Server:** Standard IO server bridge exposing 5 network query and diagnostic tools:
  - **Tool 1:** `get_network_status` (Connectivity, device counts, throughput, cumulative volume).
  - **Tool 2:** `get_active_clients` (Device inventory, IP/MAC, Wi-Fi SSID/signal, switch port, throughput).
  - **Tool 3:** `get_network_devices` (Hardware inventory: 9 APs, 4 Switches, 1 Gateway, CPU %, Memory %, Client load per AP).
  - **Tool 4:** `get_client_detail` (Deep-dive RF telemetry: RSSI dBm, signal %, RF channel, negotiated PHY rates, connected AP/port).
  - **Tool 5:** `audit_network_health` (Automated network health scoring, critical alerts, performance warnings, and tuning suggestions).
- **Interactive AI Copilot & Agent CLIs:**
  - `npm run mcp:copilot` (Interactive conversational terminal REPL for natural-language network queries).
  - `npm run mcp:agent` (Automated 4-stage LLM question-answering demonstration).
  - `npm run mcp:inspect` (Visual Anthropic MCP web inspector).
  - `npm run test:controller` (Standalone hardware diagnostic tool).

## 4. Out of Scope (for MVP)

- Write/Mutation operations (e.g., blocking clients, altering VLAN/SSID config).
- Multi-controller federation (focused on single physical controller with dynamic site resolution).
- Persistent time-series database (reliant on live controller polling and Next.js ISR/SSR).