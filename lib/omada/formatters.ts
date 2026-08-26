/**
 * Format bytes into human-readable strings (e.g. 1024 -> "1.00 KB")
 */
export function formatBytes(bytes: number | undefined | null, decimals = 2): string {
  if (bytes === undefined || bytes === null || isNaN(bytes) || bytes === 0) {
    return '0 B';
  }

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB', 'PB'];

  const i = Math.floor(Math.log(Math.abs(bytes)) / Math.log(k));
  const clampedIndex = Math.min(i, sizes.length - 1);

  return `${parseFloat((bytes / Math.pow(k, clampedIndex)).toFixed(dm))} ${sizes[clampedIndex]}`;
}

/**
 * Format bandwidth rate into human-readable strings (e.g. 204800 -> "200.00 KB/s")
 */
export function formatRate(bytesPerSecond: number | undefined | null, decimals = 1): string {
  if (bytesPerSecond === undefined || bytesPerSecond === null || isNaN(bytesPerSecond) || bytesPerSecond === 0) {
    return '0 B/s';
  }

  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B/s', 'KB/s', 'MB/s', 'GB/s'];

  const i = Math.floor(Math.log(Math.abs(bytesPerSecond)) / Math.log(k));
  const clampedIndex = Math.min(i, sizes.length - 1);

  return `${parseFloat((bytesPerSecond / Math.pow(k, clampedIndex)).toFixed(dm))} ${sizes[clampedIndex]}`;
}

/**
 * Format seconds of uptime into a human-readable duration (e.g. 90061 -> "1d 1h 1m")
 */
export function formatUptime(seconds: number | undefined | null): string {
  if (!seconds || seconds <= 0) return '0s';

  const days = Math.floor(seconds / 86400);
  const hours = Math.floor((seconds % 86400) / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const remainingSeconds = Math.floor(seconds % 60);

  const parts: string[] = [];
  if (days > 0) parts.push(`${days}d`);
  if (hours > 0) parts.push(`${hours}h`);
  if (minutes > 0 && days === 0) parts.push(`${minutes}m`);
  if (parts.length === 0 || (days === 0 && hours === 0 && minutes < 5)) {
    parts.push(`${remainingSeconds}s`);
  }

  return parts.join(' ');
}

/**
 * Format MAC address with standard colons and uppercase (e.g. "AA:BB:CC:DD:EE:FF")
 */
export function formatMac(mac: string | undefined | null): string {
  if (!mac) return '--:--:--:--:--:--';
  const clean = mac.replace(/[^a-fA-F0-9]/g, '').toUpperCase();
  if (clean.length === 12) {
    return clean.match(/.{1,2}/g)?.join(':') || mac;
  }
  return mac.toUpperCase();
}
