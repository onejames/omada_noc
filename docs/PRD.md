# Product Requirements Document (PRD)

- **Project Name:** Omada NOC Dashboard & MCP Bridge
- **Target:** GlobalNOC Software & Network Engineer Interview (Sept 10)
- **Deployment Model:** Containerized Application (Podman) monitoring a Physical Hardware Controller Appliance

## 1. Executive Summary

The objective of this project is to build a containerized, full-stack observability application that interfaces with a live, **physical TP-Link Omada Hardware Controller appliance** (`192.168.100.2`) on the local network. The application visualizes real-time network telemetry and exposes that same data to Large Language Models (LLMs) via the **Model Context Protocol (MCP)**. 

This demonstrates full-stack competence, hardware-level API integration, modern UI/UX design, rootless container orchestration with Podman, and AI interoperability.

## 2. Goals & Success Criteria

- **Hardware Network Integration:** Authenticate directly with the physical Omada SDN Hardware Controller at `192.168.100.2` and ingest live telemetry across 70+ network devices.
- **Demonstrate Full-Stack Competence:** Successfully fetch, process, and display network metrics in a responsive, modern Next.js/React/Tailwind dashboard.
- **Satisfy AI/LLM Requirements:** Implement an MCP server that allows an LLM (e.g., Claude) to query live network state via structured tools (`get_network_status`, `get_active_clients`).
- **Satisfy Infrastructure Requirements:** Package and deploy the dashboard and MCP bridge using **Podman** (rootless multi-stage container build).
- **Maintainability & Reliability:** Maintain strict TypeScript types, 97%+ automated test coverage with Vitest, and clean documentation.

## 3. Core Features (MVP)

- **Physical Controller Authentication Engine:** A robust backend service handling Omada v5.15 API handshakes (`omadacId` auto-discovery, CSRF tokens, session cookies, and dynamic site resolution for sites like `"The Farm"`).
- **Telemetry Dashboard (UI):** A read-only, single-page React dashboard displaying:
  - Hardware controller health/status and site metadata.
  - High-level aggregate metrics (total live clients, Wi-Fi vs. Ethernet distribution, live throughput rate, session cumulative volume).
  - An interactive data table of connected devices with search, filtering by medium, and sorting by bandwidth activity, total data, or uptime.
- **Model Context Protocol (MCP) Server:** A standard IO server bridge exposing network query tools to compatible LLM clients:
  - **Tool 1:** `get_network_status` (Connectivity, device counts, throughput, cumulative volume).
  - **Tool 2:** `get_active_clients` (Device inventory, IP/MAC, Wi-Fi SSID/signal, switch port, throughput).
- **Diagnostic CLI Tool:** Standalone executable (`npm run test:controller`) verifying physical hardware controller reachability and measuring API latency.

## 4. Out of Scope (for MVP)

- Write/Mutation operations (e.g., blocking clients, altering VLAN/SSID config).
- Multi-controller federation (focused on single physical controller with dynamic site resolution).
- Persistent time-series database (reliant on live controller polling and Next.js ISR/SSR).