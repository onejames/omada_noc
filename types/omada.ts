export interface OmadaApiResponse<T> {
  errorCode: number;
  msg: string;
  result: T;
}

export interface OmadaInfoResult {
  omadacId: string;
  controllerVer?: string;
  apiVer?: string;
  type?: number;
  vender?: string;
  supportOpenApi?: boolean;
}

export interface OmadaLoginResult {
  token: string;
  role?: number;
}

export interface OmadaSiteItem {
  siteId: string;
  name: string;
  siteKey?: string;
  type?: number;
}

export interface OmadaClientDevice {
  mac: string;
  name?: string;
  hostName?: string;
  ip: string;
  wireless: boolean;
  ssid?: string;
  apName?: string;
  apMac?: string;
  switchName?: string;
  switchMac?: string;
  port?: number;
  vlanId?: number;
  signalLevel?: number;
  signalRank?: number;
  rssi?: number;
  snr?: number;
  wifiMode?: number;
  channel?: number;
  rxRate?: number;
  txRate?: number;
  activity?: number; // Instantaneous rate in Bytes/sec
  trafficDown?: number; // Cumulative downloaded bytes
  trafficUp?: number; // Cumulative uploaded bytes
  uptime?: number; // Uptime in seconds
  ipType?: number;
  authStatus?: number;
  blocked?: boolean;
  guest?: boolean;
  deviceType?: string;
}

export interface OmadaClientsPageResult {
  totalRows: number;
  currentPage: number;
  currentSize: number;
  data: OmadaClientDevice[];
}

export interface OmadaDeviceItem {
  mac: string;
  name: string;
  type: 'ap' | 'switch' | 'gateway' | string;
  model: string;
  showModel?: string;
  ip: string;
  status: number; // e.g. 14 = connected, 15 = isolated
  statusStr?: string;
  clientNum?: number;
  cpuUtil?: number;
  memUtil?: number;
  uptime?: number;
  firmwareVersion?: string;
  needUpgrade?: boolean;
  channel?: number;
  poeRemain?: number;
  poeSupport?: boolean;
  totalPoePower?: number;
}

export interface WirelessHealthSummary {
  totalWirelessClients: number;
  weakSignalCount: number; // Clients with RSSI < -70 dBm
  criticalSignalCount: number; // Clients with RSSI < -80 dBm
  weakSignalClients: Array<{
    name: string;
    ip: string;
    mac: string;
    rssi?: number;
    ssid?: string;
    apName?: string;
    wifiMode?: number;
  }>;
  apLoadDistribution: Array<{
    apName: string;
    clientCount: number;
    model: string;
    cpuUtil?: number;
    memUtil?: number;
  }>;
}

export interface NetworkAuditReport {
  timestamp: string;
  healthScore: number; // 0 - 100
  controllerStatus: string;
  totalDevices: number;
  totalClients: number;
  alerts: string[]; // Critical issues (e.g. offline hardware)
  warnings: string[]; // Performance risks (e.g. AP imbalance, poor signal)
  recommendations: string[]; // Actionable optimization tips for network engineers/AI
}

export interface NetworkStatusSummary {
  controllerOnline: boolean;
  omadacId: string | null;
  siteId: string;
  siteName?: string;
  totalClients: number;
  wirelessClients: number;
  wiredClients: number;
  totalActivityRate: number; // Bytes/sec sum
  totalTrafficDown: number; // Cumulative bytes sum
  totalTrafficUp: number; // Cumulative bytes sum
  lastUpdated: string;
  error?: string | null;
}

export interface OmadaTopologyNode {
  type: 'gateway' | 'switch' | 'ap' | string;
  name: string;
  mac: string;
  model: string;
  ip?: string;
  status?: number;
  clientCount?: number;
  uplinkPort?: string | number;
  successors?: OmadaTopologyNode[];
}

export interface OmadaLanNetwork {
  id: string;
  name: string;
  vlan: number;
  gatewaySubnet: string;
  dhcpEnable: boolean;
  ipaddrStart?: string;
  ipaddrEnd?: string;
  domain?: string;
  purpose?: string;
  clientCount?: number;
}

export interface OmadaSsidSetting {
  id: string;
  name: string;
  band: number; // 1 = 2.4G, 2 = 5G, 3 = 2.4G+5G, 7 = 6G
  bandText?: string;
  security: number;
  securityText?: string;
  broadcast: boolean;
  vlanEnable: boolean;
  vlanId?: number;
  clientCount?: number;
}

export interface PoeDeviceBudget {
  mac: string;
  name: string;
  model: string;
  ip: string;
  poeRemain: number;
  totalPoePower?: number;
  poePowerUsed?: number;
  clientNum: number;
  cpuUtil?: number;
  memUtil?: number;
  uptime?: number;
  status: number;
}

export interface TelemetryResponse {
  status: NetworkStatusSummary;
  topClients: OmadaClientDevice[];
  allClients?: OmadaClientDevice[];
  devices?: OmadaDeviceItem[];
  topology?: OmadaTopologyNode[];
  networks?: OmadaLanNetwork[];
  ssids?: OmadaSsidSetting[];
  poeDevices?: PoeDeviceBudget[];
}
