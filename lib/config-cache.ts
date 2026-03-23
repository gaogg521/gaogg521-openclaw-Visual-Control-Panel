type ConfigCacheEntry = {
  data: any;
  ts: number;
};

let configCache: ConfigCacheEntry | null = null;

export function getConfigCache(): ConfigCacheEntry | null {
  return configCache;
}

export function setConfigCache(entry: ConfigCacheEntry): void {
  configCache = entry;
}

export function clearConfigCache(): void {
  configCache = null;
}
