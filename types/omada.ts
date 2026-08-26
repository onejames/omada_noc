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
  activity?: number; // Instantaneous rate in Bytes/sec
  trafficDown?: number; // Cumulative downloaded bytes
  trafficUp?: number; // Cumulative uploaded bytes
  uptime?: number; // Uptime in seconds
  ipType?: number;
  authStatus?: number;
  blocked?: boolean;
  guest?: boolean;
}

export interface OmadaClientsPageResult {
  totalRows: number;
  currentPage: number;
  currentSize: number;
  data: OmadaClientDevice[];
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

export interface TelemetryResponse {
  status: NetworkStatusSummary;
  topClients: OmadaClientDevice[];
  allClients?: OmadaClientDevice[];
}
