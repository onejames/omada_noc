# Network Topology, VLAN/Wi-Fi Matrix & Hardware PoE Health Expansion

This specification details the architecture, data models, API endpoints, and user interface components for expanding the Omada NOC Dashboard with:
1. **Interactive Network Topology Map**
2. **VLANs & Wi-Fi SSIDs Spectrum Matrix**
3. **Hardware Health & PoE Power Budget Monitoring**
4. **Auto-Collapsed Client Telemetry with Top 5 Focus**

---

## 🏛️ Architecture Overview

```
┌───────────────────────────────────────────────────────────────────────────────────────────┐
│                                    OMADA NOC TELEMETRY ENGINE                             │
├─────────────────────────┬─────────────────────────┬───────────────────────────────────────┤
│   1. NETWORK TOPOLOGY   │  2. VLANS & WI-FI SSIDS │   3. HARDWARE & POE BUDGET MONITOR    │
├─────────────────────────┼─────────────────────────┼───────────────────────────────────────┤
│ • Hierarchical Node Tree│ • 5 Subnets & VLANs     │ • PoE Wattage Headroom (SG2218P/ES205)│
│ • Gateway ➔ Core Switch │ • 6 Dual-Band SSIDs     │ • Per-Device CPU & RAM Utilization    │
│ • Edge Switches ➔ APs   │ • RF Channels (1,6,11)  │ • Multi-Device Temperature & Fans     │
│ • Live Link Speeds & MAC│ • WPA2/WPA3 & Multicast │ • Uptime Counters & Firmware Ver      │
└─────────────────────────┴─────────────────────────┴───────────────────────────────────────┘
```

---

## 🗺️ Part 1: Interactive Network Topology Map

### 1. Objective
Provide real-time graphical visualization of the estate's physical network architecture, showing parent-child links from the router gateway down to edge switches, access points, and connected endpoint counts.

### 2. Live Data Source (`GET /api/v2/sites/{siteId}/topology`)
The Omada Controller exposes the physical hierarchy:
* **Root Gateway:** `Gatewat ER7206 v2.20` (IP: `192.168.100.1`)
  * ↳ **Core Backbone Switch:** `Backbone SG2218P v2.0` (18-port Gigabit PoE+, IP: `192.168.100.3`)
    * ↳ **Edge Switch 1:** `Dills ES205GP Switch` (IP: `192.168.100.18`, 5-port PoE)
    * ↳ **Edge Switch 2:** `Stables ES205GP switch` (IP: `192.168.100.14`, 5-port PoE)
    * ↳ **Edge Switch 3:** `Garden ES205GP Switch` (IP: `192.168.100.17`, 5-port PoE)
    * ↳ **Access Point Array (9 EAP Units):**
      * `Main Center EAP670` (Wi-Fi 6 AX5400)
      * `Upstaris West EAP670` (Wi-Fi 6 AX5400)
      * `Basement East EAP670` (Wi-Fi 6 AX5400)
      * `Arena EAP110` (Outdoor Long-Range AP)
      * *+ 5 additional estate APs*

### 3. UI Component Design
* **Node Types:** Gateway (Purple), Switch (Emerald), Access Point (Cyan).
* **Card Details:** Device Model, IP Address, MAC Address, Active Client Count, and Link Speed.
* **Interactive Filtering:** Focus downstream branches and inspect connected clients.

---

## 🌐 Part 2: VLANs & Wi-Fi SSIDs Spectrum Matrix

### 1. Objective
Deliver deep visibility into network segmentation (VLANs), DHCP lease allocation, wireless SSID security parameters, and AP radio spectrum utilization.

### 2. Live Data Sources
* **LAN Subnets (`/api/v2/sites/{siteId}/setting/lan/networks`):**
  * `VLAN 1 (Default)`: `192.168.100.1/24` (DHCP Pool: `192.168.100.10`–`.254`, Management & Infrastructure)
  * `VLAN 10 (Devices)`: `192.168.110.1/24` (DHCP Pool: `192.168.110.100`–`.200`)
  * `VLAN 20 (IoT)`: `192.168.120.1/24` (DHCP Pool: `192.168.120.100`–`.200`, Kasa Switches & Schlage Locks)
  * `VLAN 50 (IoT-DMZ)`: `192.168.150.1/24` (DHCP Pool: `192.168.150.100`–`.200`, Zigbee Controllers & Isolated Smart Devices)
  * `VLAN 90 (Public Access)`: `192.168.190.1/24` (DHCP Pool: `192.168.190.1`–`.254`, Guest Isolation)
* **Wireless SSIDs (`/api/v2/sites/{siteId}/setting/wlans/{wlanId}/ssids`):**
  * `TheFarmStrlnk`: Dual-Band (2.4G & 5G), WPA2/WPA3, Default VLAN 1.
  * `TheFarmIot`: Dual-Band, VLAN 20, Isolated IoT Broadcast.
  * `TheFarmAlexa`: Dual-Band, Hidden SSID, Multicast/IGMP optimized for smart speakers.
  * `TheFarmRing`: Dual-Band, Dedicated Camera SSID.
  * `iot-dmz`: Dual-Band, VLAN 50, Isolated DMZ.
  * `TheFarm2.4Ext`: 2.4 GHz Long-Range Extended Band.

---

## ⚡ Part 3: Hardware Health & PoE Budget Monitoring

### 1. Objective
Monitor physical switch power budgets (PoE headroom), thermal health, fan statuses, and CPU/RAM load across all 14 managed nodes.

### 2. Live Data Source (`GET /api/v2/sites/{siteId}/devices`)
* **PoE Headroom & Wattage Consumption:**
  * `Backbone SG2218P`: **124.5 W** remaining power headroom.
  * `Garden ES205GP`: **60.9 W** remaining headroom.
  * `Dills ES205GP`: **56.2 W** remaining headroom.
  * `Stables ES205GP`: **54.3 W** remaining headroom.
* **CPU & Memory Telemetry:**
  * Router Gateway ER7206: CPU `1%`, Memory `21%`.
  * Backbone Switch SG2218P: CPU `12%`, Memory `54%`.
  * Access Points EAP670: CPU `0%`, Memory `64%`.
* **Cumulative Throughput:**
  * Gateway Aggregate WAN: `503.5 GB Down / 230.5 GB Up`.
  * Backbone Core Switch: `800.8 GB Down / 780.4 GB Up`.

---

## 📱 Part 4: Auto-Collapsed Top 5 Client Telemetry

### 1. Objective
Reduce visual clutter on the primary dashboard by defaulting the client list to the **Top 5 active devices** (sorted by activity rate / throughput), with a clean **`Show All (69) Clients`** expansion toggle.

### 2. Interaction Model
* **Default State:** Collapsed to Top 5 high-priority devices with active traffic rates.
* **Expanded State:** Full paginated / searchable list of all 69+ connected clients with medium filters (Wireless / Wired / All).
* **Toggle Control:** Accessible button displaying current count, sort criteria, and chevron transition.
