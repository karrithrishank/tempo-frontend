const BASE = "https://tempo-backend-wx2w.onrender.com";

async function get(path) {
  const res = await fetch(`${BASE}${path}`);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

export const api = {
  modelStatus:      ()        => get("/model/status"),
  modelPerformance: (n = 48)  => get(`/model/performance?n=${n}`),
  analyticsHourly:  (l = 168) => get(`/analytics/hourly?limit=${l}`),
  analyticsDaily:   ()        => get("/analytics/daily"),
};

/* ── Mock data generators ─────────────────────────────────────── */
function seed(n) { return Math.sin(n * 9301 + 49297) * 0.5 + 0.5; }

function generateHourly(n = 168) {
  const now = Date.now(), hour = 3600000;
  return Array.from({ length: n }, (_, i) => {
    const t = now - (n - i) * hour;
    const d = new Date(t);
    const h = d.getHours();
    const base = 26 + 6 * Math.sin((h - 5) * Math.PI / 14);
    const s = seed(i);
    const temp = +(base + (s - 0.5) * 2).toFixed(2);
    return {
      hour_start:      d.toISOString(),
      avg_temperature: temp,
      predicted_temp:  +(temp + (seed(i + 100) - 0.5) * 1.1).toFixed(2),
      avg_humidity:    +(60 + 20 * Math.sin(h * 0.4) + seed(i + 200) * 8).toFixed(1),
      avg_pressure_mb: +(1010 + Math.sin(i * 0.05) * 4).toFixed(1),
      avg_wind_kph:    +(6 + seed(i + 300) * 18).toFixed(1),
      avg_cloud_cover: +(20 + seed(i + 400) * 70).toFixed(0),
      total_precip_mm: seed(i + 500) > 0.82 ? +(seed(i + 600) * 5).toFixed(1) : 0,
    };
  });
}

function generateDaily(n = 30) {
  const now = Date.now(), day = 86400000;
  return Array.from({ length: n }, (_, i) => {
    const t = now - (n - i) * day;
    const d = new Date(t);
    const base = 29 + Math.sin(i * 0.2) * 3;
    const mae  = +(0.45 + seed(i) * 0.7).toFixed(3);
    return {
      date:            d.toISOString().slice(0, 10),
      min_temperature: +(base - 5 - seed(i + 10) * 2).toFixed(2),
      max_temperature: +(base + 5 + seed(i + 20) * 2).toFixed(2),
      avg_temperature: +base.toFixed(2),
      avg_humidity:    +(58 + seed(i + 30) * 20).toFixed(1),
      total_precip_mm: seed(i + 40) > 0.68 ? +(seed(i + 50) * 10).toFixed(1) : 0,
      mae,
      rmse: +(mae * 1.28 + seed(i + 60) * 0.15).toFixed(3),
    };
  });
}

function generatePredictions(n = 48) {
  const now = Date.now();
  return Array.from({ length: n }, (_, i) => {
    const t = now - (n - i) * 3600000;
    const actual = +(26 + 6 * Math.sin(i * 0.4) + (seed(i) - 0.5)).toFixed(2);
    const predicted = +(actual + (seed(i + 200) - 0.5) * 1.2).toFixed(2);
    return {
      predicted_at:    new Date(t).toISOString(),
      actual_temp:     actual,
      predicted_temp:  predicted,
      absolute_error:  +Math.abs(actual - predicted).toFixed(3),
    };
  });
}

export const mockData = {
  modelStatus: () => ({
    model_loaded:    true,
    model_type:      "SGDRegressor",
    feature_count:   27,
    history_length:  1247,
    rolling_rmse_7d: 0.734,
    rolling_mae_7d:  0.521,
    n_predictions:   1183,
    period_start:    new Date(Date.now() - 7 * 86400000).toISOString(),
    period_end:      new Date().toISOString(),
    sensor_location: { lat: 14.4426, lon: 79.9865 },
  }),
  modelPerformance: (n = 48) => ({ count: n, predictions: generatePredictions(n) }),
  analyticsHourly:  (l = 168) => ({ count: l, data: generateHourly(l) }),
  analyticsDaily:   ()        => ({ count: 30, data: generateDaily(30) }),
};

export async function fetchWithFallback(apiFn, mockFn, ...args) {
  try { return await apiFn(...args); }
  catch { return mockFn(...args); }
}
