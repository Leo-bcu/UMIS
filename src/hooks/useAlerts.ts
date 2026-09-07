import { useState, useEffect } from 'react';
import type { AlertEvent } from '../data/alertDataGenerator';
import { fetchAlerts } from '../api/alertApi';
import type { DataSourceType, ScenarioType } from '../types';

// Module-level cache (per dataSource)
const alertCache: Record<string, AlertEvent[] | null> = {};

export function clearAlertCache(dataSource?: DataSourceType, scenario?: ScenarioType) {
  if (!dataSource) {
    for (const key of Object.keys(alertCache)) alertCache[key] = null;
    return;
  }
  const key = dataSource === 'fracture' ? `${dataSource}:${scenario ?? 'coal'}` : dataSource;
  alertCache[key] = null;
}

export function useAlerts(dataSource: DataSourceType = 'fracture', scenario: ScenarioType = 'coal') {
  const key = dataSource === 'fracture' ? `${dataSource}:${scenario}` : dataSource;
  const [data, setData] = useState<AlertEvent[] | null>(alertCache[key]);
  const [loading, setLoading] = useState(!alertCache[key]);

  useEffect(() => {
    if (alertCache[key]) { setData(alertCache[key]); return; }
    let cancelled = false;
    setLoading(true);
    (async () => {
      const alerts = await fetchAlerts(undefined, dataSource, scenario);
      if (!cancelled) {
        alertCache[key] = alerts;
        setData(alerts);
      }
    })().finally(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [dataSource, key, scenario]);

  return { data, loading };
}
