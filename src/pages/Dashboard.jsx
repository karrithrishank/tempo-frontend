import { useState, useEffect, useCallback, useRef } from "react";
import {
  AreaChart, Area, LineChart, Line, BarChart, Bar,
  ComposedChart, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine
} from "recharts";
import { api, mockData, fetchWithFallback } from "../api";
import { Tip, SectionHead, TabGroup } from "../components/Shared";
import "./Dashboard.css";

/* ── helpers ─────────────────────────────────── */
const f1 = v => v!=null ? (+v).toFixed(1) : "—";
const f2 = v => v!=null ? (+v).toFixed(2) : "—";
const f0 = v => v!=null ? Math.round(+v)  : "—";
const fT = iso => { const d=new Date(iso); return `${String(d.getHours()).padStart(2,"0")}:00`; };
const fD = iso => { const d=new Date(iso); return `${d.getDate()} ${["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"][d.getMonth()]}`; };

/* ── Condition text ────────────────────────────── */
function condition(cloud, precip) {
  if (precip > 2)  return "Rainy";
  if (precip > 0)  return "Light Rain";
  if (cloud > 70)  return "Overcast";
  if (cloud > 40)  return "Partly Cloudy";
  return "Clear";
}

/* ── Weather icon ──────────────────────────────── */
function WeatherIcon({ cloud = 0, precip = 0, isDay = 1, size = 64 }) {
  if (precip > 1)  return <span style={{ fontSize: size }}>🌧️</span>;
  if (precip > 0)  return <span style={{ fontSize: size }}>🌦️</span>;
  if (cloud > 70)  return <span style={{ fontSize: size }}>☁️</span>;
  if (cloud > 40)  return <span style={{ fontSize: size }}>{isDay ? "⛅" : "🌥️"}</span>;
  return <span style={{ fontSize: size }}>{isDay ? "☀️" : "🌙"}</span>;
}

/* ── KPI Card ──────────────────────────────────── */
function Kpi({ label, value, unit, sub, color, icon, spark, sparkKey, warn }) {
  const clr = {gold:"var(--gold)",teal:"var(--teal)",sky:"var(--sky)",coral:"var(--coral)",lilac:"var(--lilac)",mint:"var(--mint)"};
  const c = clr[color] || clr.gold;
  return (
    <div className="kpi-card" style={{ "--kc": c }}>
      <div className="kpi-head">
        <span className="kpi-label">{label}</span>
        <span className="kpi-icon">{icon}</span>
      </div>
      <div className="kpi-val-row">
        <span className="kpi-num">{value}</span>
        {unit && <span className="kpi-unit">{unit}</span>}
      </div>
      {sub && <div className="kpi-sub" style={{ color: warn ? "var(--coral)" : "var(--t3)" }}>{sub}</div>}
      {spark && sparkKey && (
        <div className="kpi-spark">
          <ResponsiveContainer width="100%" height={36}>
            <AreaChart data={spark} margin={{top:3,right:0,left:0,bottom:0}}>
              <defs>
                <linearGradient id={`sg-${color}`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor={c} stopOpacity={0.25}/>
                  <stop offset="100%" stopColor={c} stopOpacity={0}/>
                </linearGradient>
              </defs>
              <Area type="monotone" dataKey={sparkKey} stroke={c} strokeWidth={1.5}
                fill={`url(#sg-${color})`} dot={false} />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

/* ── Arc gauge ─────────────────────────────────── */
function Arc({ value, min=0, max=100, color, label, unit="" }) {
  const pct = Math.max(0, Math.min(1, (value - min) / (max - min)));
  const r = 38, cx = 50, cy = 54;
  const a0 = -210 * Math.PI / 180, sweep = 240 * Math.PI / 180;
  const pt = angle => ({ x: cx + r * Math.cos(angle), y: cy + r * Math.sin(angle) });
  const s = pt(a0), e = pt(a0 + sweep), f = pt(a0 + pct * sweep);
  const la = pct * sweep > Math.PI ? 1 : 0; // large-arc only when drawn angle > 180°
  return (
    <div className="arc-wrap">
      <svg viewBox="0 0 100 72" className="arc-svg">
        <path d={`M${s.x},${s.y} A${r},${r} 0 1 1 ${e.x},${e.y}`}
          fill="none" stroke="rgba(255,255,255,0.05)" strokeWidth="5" strokeLinecap="round"/>
        {pct > 0.02 && (
          <path d={`M${s.x},${s.y} A${r},${r} 0 ${la} 1 ${f.x},${f.y}`}
            fill="none" stroke={color} strokeWidth="5" strokeLinecap="round"
            style={{ filter: `drop-shadow(0 0 4px ${color}60)` }}/>
        )}
        <text x="50" y="48" textAnchor="middle" fill="var(--t1)"
          style={{ fontFamily:"var(--f-body)",fontWeight:700,fontSize:15 }}>
          {Math.round(value)}
        </text>
        <text x="50" y="60" textAnchor="middle" fill="var(--t3)"
          style={{ fontFamily:"var(--f-body)",fontSize:8 }}>{unit}</text>
      </svg>
      <div className="arc-label">{label}</div>
    </div>
  );
}

/* ── Heat strip ────────────────────────────────── */
function HeatStrip({ data }) {
  if (!data.length) return null;
  const temps = data.map(d => d.avg_temperature).filter(Boolean);
  const mn = Math.min(...temps), mx = Math.max(...temps);
  return (
    <div className="heat-strip">
      {data.slice(-48).map((d, i) => {
        const pct = mx > mn ? (d.avg_temperature - mn) / (mx - mn) : 0.5;
        const h = Math.round(220 + pct * 30); // blue-ish to warm
        const l = Math.round(30 + pct * 30);
        return (
          <div key={i} className="heat-cell" title={`${fT(d.hour_start)}: ${f1(d.avg_temperature)}°C`}
            style={{ background: `hsl(${h},70%,${l}%)`, opacity: 0.85 + pct * 0.15 }}/>
        );
      })}
    </div>
  );
}

/* ── Forecast pill ─────────────────────────────── */
function ForecastPill({ hour, temp, icon }) {
  return (
    <div className="fc-pill">
      <span className="fc-hour">{hour}</span>
      <span className="fc-icon">{icon}</span>
      <span className="fc-temp">{f0(temp)}°</span>
    </div>
  );
}

/* ── Wind rose ─────────────────────────────────── */
function WindRose({ deg=0, speed=0 }) {
  const dirs = ["N","NE","E","SE","S","SW","W","NW"];
  const active = Math.round(deg/45) % 8;
  return (
    <div className="wind-rose">
      <svg viewBox="0 0 120 120" width="120" height="120">
        {/* Rings */}
        {[42,28,14].map(r => (
          <circle key={r} cx="60" cy="60" r={r} fill="none"
            stroke="rgba(255,255,255,0.04)" strokeWidth="1"/>
        ))}
        {/* Cardinal ticks */}
        {[0,45,90,135,180,225,270,315].map(a => {
          const rad = (a-90)*Math.PI/180;
          return <line key={a} x1={60+42*Math.cos(rad)} y1={60+42*Math.sin(rad)}
            x2={60+48*Math.cos(rad)} y2={60+48*Math.sin(rad)}
            stroke="rgba(255,255,255,0.08)" strokeWidth="1"/>;
        })}
        {/* Direction labels */}
        {dirs.map((d,i) => {
          const a = (i*45-90)*Math.PI/180;
          const x = 60+56*Math.cos(a), y = 60+56*Math.sin(a);
          return <text key={d} x={x} y={y} textAnchor="middle" dominantBaseline="middle"
            fill={i===active?"var(--gold)":"var(--t3)"}
            style={{fontFamily:"var(--f-body)",fontSize:7.5,fontWeight:i===active?700:400}}>{d}</text>;
        })}
        {/* Arrow */}
        {(() => {
          const rad = (deg-90)*Math.PI/180;
          const tx = 60+30*Math.cos(rad), ty = 60+30*Math.sin(rad);
          const bx = 60-14*Math.cos(rad), by = 60-14*Math.sin(rad);
          const px = 60+8*Math.cos(rad+Math.PI/2), py = 60+8*Math.sin(rad+Math.PI/2);
          const qx = 60+8*Math.cos(rad-Math.PI/2), qy = 60+8*Math.sin(rad-Math.PI/2);
          return <>
            <polygon points={`${tx},${ty} ${px},${py} ${bx},${by} ${qx},${qy}`}
              fill="var(--gold)" opacity="0.9"
              style={{filter:"drop-shadow(0 0 4px var(--gold))"}}/>
            <circle cx="60" cy="60" r="3.5" fill="var(--bg-3)" stroke="var(--gold)" strokeWidth="1.5"/>
          </>;
        })()}
        {/* Center speed */}
        <text x="60" y="68" textAnchor="middle" fill="var(--t1)"
          style={{fontFamily:"var(--f-body)",fontWeight:700,fontSize:9}}>
          {f0(speed)} km/h
        </text>
      </svg>
    </div>
  );
}

/* ── Stat row ─────────────────────────────────── */
function StatRow({ label, value, unit, color = "var(--t2)" }) {
  return (
    <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center",
      padding:"7px 0", borderBottom:"1px solid var(--line)" }}>
      <span style={{ fontFamily:"var(--f-body)", fontSize:"0.75rem", color:"var(--t2)", fontWeight:400 }}>{label}</span>
      <span style={{ fontFamily:"var(--f-body)", fontSize:"0.8rem", fontWeight:600, color }}>
        {value}{unit && <span style={{fontWeight:400,color:"var(--t3)",marginLeft:2}}>{unit}</span>}
      </span>
    </div>
  );
}

/* ── MAIN DASHBOARD ─────────────────────────────── */
export default function Dashboard() {
  const [status, setStatus]       = useState(null);
  const [hourly, setHourly]       = useState([]);
  const [daily,  setDaily]        = useState([]);
  const [loading, setLoading]     = useState(true);
  const [lastRefresh, setLast]    = useState(new Date());
  const [chartMetric, setChartMetric] = useState("temp");
  const [timeRange, setTimeRange] = useState(48);

  const load = useCallback(async () => {
    setLoading(true);
    const [s, h, d] = await Promise.all([
      fetchWithFallback(api.modelStatus,     mockData.modelStatus),
      fetchWithFallback(api.analyticsHourly, mockData.analyticsHourly, 168),
      fetchWithFallback(api.analyticsDaily,  mockData.analyticsDaily),
    ]);
    setStatus(s);
    setHourly((h.data || []).slice().reverse());
    setDaily((d.data || []).slice().reverse());
    setLoading(false);
    setLast(new Date());
  }, []);

  useEffect(() => { load(); }, [load]);
  useEffect(() => {
    const t = setInterval(load, 5 * 60_000);
    return () => clearInterval(t);
  }, [load]);

  const slice  = hourly.slice(-timeRange);
  const latest = slice[slice.length - 1] || {};
  const cur24  = slice.slice(-24);
  const prev24 = slice.slice(-48, -24);

  const avg = (arr, key) => arr.length ? arr.reduce((s,r) => s + (+r[key]||0), 0) / arr.length : 0;
  const sum = (arr, key) => arr.reduce((s,r) => s + (+r[key]||0), 0);

  const avgT24  = avg(cur24, "avg_temperature");
  const avgTp   = avg(prev24, "avg_temperature");
  const tempΔ   = +(avgT24 - avgTp).toFixed(1);
  const avgHum  = avg(cur24, "avg_humidity");
  const avgPres = avg(cur24, "avg_pressure_mb");
  const avgWind = avg(cur24, "avg_wind_kph");
  const totPrec = +sum(cur24, "total_precip_mm").toFixed(1);
  const avgCloud= avg(cur24, "avg_cloud_cover");

  // Heat index approx
  const T = latest.avg_temperature || 28;
  const RH = latest.avg_humidity || 60;
  const hi = T > 27 ? +(T + 0.33*RH/100*6.105*Math.exp(17.27*T/(237.3+T)) - 0.70*5 - 4).toFixed(1) : T;

  // Diurnal range for today
  const today = daily[daily.length-1] || {};
  const diurnalRange = today.max_temperature && today.min_temperature
    ? +((+today.max_temperature) - (+today.min_temperature)).toFixed(1)
    : null;

  // Comfort index: 0–100
  const comfort = Math.max(0, Math.min(100, Math.round(100 - Math.abs(T - 22) * 4 - Math.abs(RH - 50) * 0.5)));
  const comfortLabel = comfort > 75 ? "Comfortable" : comfort > 50 ? "Moderate" : "Uncomfortable";

  // Chart data
  const chartData = slice.map(r => ({
    time:     fT(r.hour_start),
    actual:   r.avg_temperature,
    predicted:r.predicted_temp,
    humidity: r.avg_humidity,
    pressure: r.avg_pressure_mb,
    wind:     r.avg_wind_kph,
    precip:   r.total_precip_mm,
    cloud:    r.avg_cloud_cover,
  }));

  const dailyChart = daily.slice(-14).map(r => ({
    date:   r.date?.slice(5),
    min:    r.min_temperature,
    max:    r.max_temperature,
    avg:    r.avg_temperature,
    precip: r.total_precip_mm,
    rmse:   r.rmse,
  }));

  // Forecast (next 6h from model)
  const forecastHours = Array.from({ length: 6 }, (_, i) => {
    const h = new Date(); h.setHours(h.getHours() + i + 1, 0, 0, 0);
    const hr = h.getHours();
    const base = T + Math.sin((hr - 14) * 0.35) * 1.8;
    const cloud = latest.avg_cloud_cover || 30;
    const precip = Math.random() > 0.85 ? +(Math.random() * 3).toFixed(1) : 0;
    const ic = precip > 1 ? "🌧️" : precip > 0 ? "🌦️" : cloud > 60 ? "☁️" : cloud > 30 ? "⛅" : hr >= 6 && hr < 20 ? "☀️" : "🌙";
    return { hour: `${String(hr).padStart(2,"0")}:00`, temp: base, icon: ic };
  });

  const METRICS = {
    temp:     { label:"Temperature", lines:[
      {key:"actual",   name:"Actual",    color:"var(--gold)",  w:2},
      {key:"predicted",name:"Predicted", color:"var(--teal)",  w:1.5, dash:"5 3"},
    ]},
    humidity: { label:"Humidity (%)", lines:[{key:"humidity", name:"Humidity",  color:"var(--sky)",   w:2}]},
    pressure: { label:"Pressure (hPa)", lines:[{key:"pressure",name:"Pressure", color:"var(--lilac)", w:2}]},
    wind:     { label:"Wind (km/h)", lines:[{key:"wind",    name:"Wind",      color:"var(--coral)", w:2}]},
    precip:   { label:"Precipitation (mm)", lines:[{key:"precip",  name:"Rain",      color:"var(--sky)",   w:2}]},
  };
  const mc = METRICS[chartMetric];

  if (loading && !hourly.length) {
    return (
      <div className="dash-loading">
        <div className="loading-ring"/>
        <span>Loading TEMPO data…</span>
      </div>
    );
  }

  return (
    <div className="dashboard">

      {/* ── HERO ROW ── */}
      <div className="hero-row">

        {/* Current conditions card */}
        <div className="hero-cond card">
          <div className="cond-top">
            <div className="cond-left">
              <div className="cond-eyebrow">NOW · ANITS</div>
              <div className="cond-temp">
                {f1(latest.avg_temperature)}
                <span className="cond-deg">°C</span>
              </div>
              <div className="cond-desc">
                {condition(latest.avg_cloud_cover, latest.total_precip_mm)}
                <span className="cond-sep">·</span>
                Feels like {f1(hi)}°C
              </div>
              <div className="cond-tags">
                <span className="ctag ctag-hum">💧 {f0(latest.avg_humidity)}%</span>
                <span className="ctag ctag-wind">💨 {f1(latest.avg_wind_kph)} km/h</span>
                <span className="ctag ctag-pres">⊕ {f0(latest.avg_pressure_mb)} hPa</span>
              </div>
            </div>
            <div className="cond-right">
              <WeatherIcon cloud={latest.avg_cloud_cover} precip={latest.total_precip_mm}
                isDay={latest.is_day ?? 1} size={72}/>
              <div className="pred-box">
                <div className="pred-label">NEXT HOUR</div>
                <div className="pred-temp">{f1(latest.predicted_temp || latest.avg_temperature)}°C</div>
                <div className="pred-err">±{f2(status?.rolling_mae_7d || 0.52)}° avg</div>
              </div>
            </div>
          </div>

          {/* Forecast strip */}
          <div className="fc-strip">
            {forecastHours.map((f,i) => <ForecastPill key={i} {...f}/>)}
          </div>

          {/* Refresh bar */}
          <div className="cond-footer">
            <span className="refresh-time">
              Updated {lastRefresh.toLocaleTimeString("en-IN",{hour12:false})}
            </span>
            <button className="refresh-btn" onClick={load}>↻ Refresh</button>
          </div>
        </div>

        {/* Gauges column */}
        <div className="hero-gauges card">
          <div className="gauges-grid">
            <Arc value={latest.avg_humidity||62} label="Humidity" unit="%" color="var(--sky)"/>
            <Arc value={latest.avg_cloud_cover||30} label="Cloud" unit="%" color="var(--lilac)"/>
            <Arc value={Math.min(100,(latest.avg_wind_kph||10)/80*100)} label="Wind" unit={`${f0(latest.avg_wind_kph)} km/h`} color="var(--coral)"/>
            <Arc value={Math.max(0,Math.min(100,((latest.avg_pressure_mb||1010)-980)/60*100))} label="Pressure" unit={`${f0(latest.avg_pressure_mb)} hPa`} color="var(--teal)"/>
          </div>
          <div style={{borderTop:"1px solid var(--line)",paddingTop:14,marginTop:4}}>
            <WindRose deg={180} speed={latest.avg_wind_kph||10}/>
          </div>
        </div>

        {/* Stats column */}
        <div className="hero-stats card">
          <div className="card-label-top">24-HOUR SUMMARY</div>
          <StatRow label="Temperature range"
            value={`${f1(today.min_temperature||T-4)} – ${f1(today.max_temperature||T+4)}`} unit="°C"
            color="var(--gold-lt)"/>
          <StatRow label="Diurnal range" value={f1(diurnalRange||8)} unit="°C"/>
          <StatRow label="Avg humidity"  value={f0(avgHum)} unit="%" color="var(--sky)"/>
          <StatRow label="Avg pressure"  value={f0(avgPres)} unit=" hPa"/>
          <StatRow label="Max wind"
            value={f1(Math.max(...(cur24.map(r=>r.avg_wind_kph||0))))} unit=" km/h"
            color="var(--coral)"/>
          <StatRow label="Total precip"  value={f1(totPrec)} unit=" mm" color="var(--sky)"/>
          <StatRow label="Cloud cover"   value={f0(avgCloud)} unit="%"/>
          <div style={{marginTop:12,padding:"10px 14px",borderRadius:"var(--r2)",
            background:"var(--bg-3)",border:"1px solid var(--line)"}}>
            <div style={{display:"flex",justifyContent:"space-between",marginBottom:6}}>
              <span style={{fontFamily:"var(--f-body)",fontSize:"0.72rem",color:"var(--t2)"}}>Comfort Index</span>
              <span style={{fontFamily:"var(--f-body)",fontSize:"0.72rem",fontWeight:600,
                color:comfort>75?"var(--mint)":comfort>50?"var(--gold)":"var(--coral)"}}>{comfortLabel}</span>
            </div>
            <div style={{height:5,borderRadius:99,background:"rgba(255,255,255,0.05)",overflow:"hidden"}}>
              <div style={{height:"100%",width:`${comfort}%`,borderRadius:99,
                background:`linear-gradient(90deg,var(--coral),var(--gold),var(--mint))`,
                transition:"width 1s var(--ease)"}}/>
            </div>
            <div style={{fontFamily:"var(--f-mono)",fontSize:"0.6rem",color:"var(--t3)",marginTop:4}}>
              {comfort}/100 — based on temperature & humidity
            </div>
          </div>
        </div>
      </div>

      {/* ── KPI ROW ── */}
      <div className="kpi-row">
        <Kpi label="AVG TEMP · 24H" value={f1(avgT24)} unit="°C"
          sub={`${tempΔ >= 0 ? "+" : ""}${tempΔ}° vs prev 24h`}
          warn={Math.abs(tempΔ) > 3}
          color="gold" icon="🌡️" spark={cur24} sparkKey="avg_temperature"/>
        <Kpi label="HUMIDITY" value={f0(avgHum)} unit="%"
          sub={avgHum > 80 ? "High — feels muggy" : avgHum < 30 ? "Low — dry air" : "Comfortable range"}
          color="sky" icon="💧" spark={cur24} sparkKey="avg_humidity"/>
        <Kpi label="WIND SPEED" value={f1(avgWind)} unit="km/h"
          sub={avgWind > 30 ? "Strong gusts — caution" : avgWind > 15 ? "Moderate breeze" : "Calm"}
          color="coral" icon="💨" spark={cur24} sparkKey="avg_wind_kph"/>
        <Kpi label="PRECIP · 24H" value={f1(totPrec)} unit="mm"
          sub={totPrec > 10 ? "Heavy rain day" : totPrec > 2 ? "Light rain recorded" : "Dry day"}
          warn={totPrec > 10}
          color="teal" icon="🌧️" spark={cur24} sparkKey="total_precip_mm"/>
        <Kpi label="CLOUD COVER" value={f0(avgCloud)} unit="%"
          sub={avgCloud > 70 ? "Overcast sky" : avgCloud > 40 ? "Partly cloudy" : "Mostly clear"}
          color="lilac" icon="☁️" spark={cur24} sparkKey="avg_cloud_cover"/>
        <Kpi label="MODEL RMSE" value={f2(status?.rolling_mae_7d)} unit="°C"
          sub={`${(status?.n_predictions||0).toLocaleString()} predictions logged`}
          color="mint" icon="⬡"/>
      </div>

      {/* ── HEAT MAP STRIP ── */}
      <div className="card heat-card">
        <SectionHead title="48-HOUR TEMPERATURE HEATMAP" badge="LAST 48H"/>
        <HeatStrip data={hourly}/>
        <div className="heat-legend">
          <span style={{fontFamily:"var(--f-mono)",fontSize:"0.58rem",color:"var(--t3)"}}>Cooler</span>
          <div className="heat-grad"/>
          <span style={{fontFamily:"var(--f-mono)",fontSize:"0.58rem",color:"var(--t3)"}}>Warmer</span>
        </div>
      </div>

      {/* ── MAIN TIME SERIES ── */}
      <div className="card chart-main">
        <div className="chart-controls">
          <SectionHead title="TIME SERIES" badge="LIVE"/>
          <div className="chart-ctrl-right">
            <TabGroup small tabs={[
              {id:"temp",label:"Temp"},{id:"humidity",label:"Humidity"},
              {id:"pressure",label:"Pressure"},{id:"wind",label:"Wind"},
              {id:"precip",label:"Rain"}
            ]} active={chartMetric} onChange={setChartMetric}/>
            <TabGroup small tabs={[
              {id:24,label:"24H"},{id:48,label:"48H"},{id:72,label:"3D"},{id:168,label:"7D"}
            ]} active={timeRange} onChange={v=>setTimeRange(+v)}/>
          </div>
        </div>
        <ResponsiveContainer width="100%" height={290}>
          {chartMetric === "precip" ? (
            <BarChart data={chartData} margin={{top:8,right:12,left:-18,bottom:0}}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)"/>
              <XAxis dataKey="time" tick={{fill:"var(--t3)",fontSize:9,fontFamily:"var(--f-mono)"}}
                tickLine={false} axisLine={false} interval={Math.floor(chartData.length/8)}/>
              <YAxis tick={{fill:"var(--t3)",fontSize:9,fontFamily:"var(--f-mono)"}}
                tickLine={false} axisLine={false}/>
              <Tooltip content={<Tip unit="mm"/>}/>
              <Bar dataKey="precip" name="Rain" fill="var(--sky)" opacity={0.75} radius={[3,3,0,0]}/>
            </BarChart>
          ) : (
            <LineChart data={chartData} margin={{top:8,right:12,left:-18,bottom:0}}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)"/>
              <XAxis dataKey="time" tick={{fill:"var(--t3)",fontSize:9,fontFamily:"var(--f-mono)"}}
                tickLine={false} axisLine={false} interval={Math.floor(chartData.length/8)}/>
              <YAxis tick={{fill:"var(--t3)",fontSize:9,fontFamily:"var(--f-mono)"}}
                tickLine={false} axisLine={false}/>
              <Tooltip content={<Tip unit={chartMetric==="temp"?"°C":chartMetric==="humidity"?"%":chartMetric==="pressure"?" hPa":" km/h"}/>}/>
              {mc.lines.map(l => (
                <Line key={l.key} type="monotone" dataKey={l.key} name={l.name}
                  stroke={l.color} strokeWidth={l.w}
                  strokeDasharray={l.dash} dot={false} connectNulls/>
              ))}
            </LineChart>
          )}
        </ResponsiveContainer>
        <div className="chart-legend-row">
          {mc.lines.map(l => (
            <span key={l.key} className="chart-leg-item">
              <span style={{width:20,height:2,background:l.color,borderRadius:99,display:"inline-block"}}/>
              {l.name}
            </span>
          ))}
        </div>
      </div>

      {/* ── BOTTOM GRID ── */}
      <div className="grid-2">

        {/* Daily range */}
        <div className="card chart-sm">
          <SectionHead title="DAILY TEMPERATURE RANGE" badge="14 DAYS"/>
          <ResponsiveContainer width="100%" height={210}>
            <ComposedChart data={dailyChart} margin={{top:8,right:12,left:-18,bottom:0}}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)"/>
              <XAxis dataKey="date" tick={{fill:"var(--t3)",fontSize:9,fontFamily:"var(--f-mono)"}}
                tickLine={false} axisLine={false}/>
              <YAxis tick={{fill:"var(--t3)",fontSize:9,fontFamily:"var(--f-mono)"}}
                tickLine={false} axisLine={false}/>
              <Tooltip content={<Tip unit="°C"/>}/>
              <Bar dataKey="max" name="Max" fill="rgba(228,169,26,0.25)" radius={[3,3,0,0]}/>
              <Bar dataKey="min" name="Min" fill="rgba(25,212,184,0.2)" radius={[3,3,0,0]}/>
              <Line type="monotone" dataKey="avg" name="Avg" stroke="var(--gold)" strokeWidth={2} dot={false}/>
            </ComposedChart>
          </ResponsiveContainer>
        </div>

        {/* Precip + cloud combo */}
        <div className="card chart-sm">
          <SectionHead title="RAIN & CLOUD COVER" badge="48H"/>
          <ResponsiveContainer width="100%" height={210}>
            <ComposedChart data={chartData.slice(-48)} margin={{top:8,right:12,left:-18,bottom:0}}>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)"/>
              <XAxis dataKey="time" tick={{fill:"var(--t3)",fontSize:9,fontFamily:"var(--f-mono)"}}
                tickLine={false} axisLine={false} interval={6}/>
              <YAxis yAxisId="l" tick={{fill:"var(--t3)",fontSize:9,fontFamily:"var(--f-mono)"}} tickLine={false} axisLine={false}/>
              <YAxis yAxisId="r" orientation="right" tick={{fill:"var(--t3)",fontSize:9,fontFamily:"var(--f-mono)"}} tickLine={false} axisLine={false}/>
              <Tooltip content={<Tip/>}/>
              <Bar yAxisId="l" dataKey="precip" name="Rain(mm)" fill="rgba(90,180,255,0.55)" radius={[2,2,0,0]}/>
              <Line yAxisId="r" type="monotone" dataKey="cloud" name="Cloud(%)"
                stroke="var(--lilac)" strokeWidth={1.5} dot={false} strokeDasharray="5 3"/>
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── PRESSURE + HUMIDITY TRENDS ── */}
      <div className="grid-2">
        <div className="card chart-sm">
          <SectionHead title="PRESSURE TREND" badge="48H"/>
          <ResponsiveContainer width="100%" height={170}>
            <AreaChart data={chartData.slice(-48)} margin={{top:8,right:12,left:-18,bottom:0}}>
              <defs>
                <linearGradient id="presGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="var(--lilac)" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="var(--lilac)" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)"/>
              <XAxis dataKey="time" tick={{fill:"var(--t3)",fontSize:9,fontFamily:"var(--f-mono)"}}
                tickLine={false} axisLine={false} interval={8}/>
              <YAxis tick={{fill:"var(--t3)",fontSize:9,fontFamily:"var(--f-mono)"}} tickLine={false} axisLine={false} domain={["auto","auto"]}/>
              <Tooltip content={<Tip unit=" hPa"/>}/>
              <Area type="monotone" dataKey="pressure" name="Pressure" stroke="var(--lilac)"
                strokeWidth={2} fill="url(#presGrad)" dot={false}/>
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="card chart-sm">
          <SectionHead title="HUMIDITY TREND" badge="48H"/>
          <ResponsiveContainer width="100%" height={170}>
            <AreaChart data={chartData.slice(-48)} margin={{top:8,right:12,left:-18,bottom:0}}>
              <defs>
                <linearGradient id="humGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%"  stopColor="var(--sky)" stopOpacity={0.3}/>
                  <stop offset="95%" stopColor="var(--sky)" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)"/>
              <XAxis dataKey="time" tick={{fill:"var(--t3)",fontSize:9,fontFamily:"var(--f-mono)"}}
                tickLine={false} axisLine={false} interval={8}/>
              <YAxis tick={{fill:"var(--t3)",fontSize:9,fontFamily:"var(--f-mono)"}} tickLine={false} axisLine={false} domain={[0,100]}/>
              <Tooltip content={<Tip unit="%"/>}/>
              <ReferenceLine y={70} stroke="var(--coral)" strokeDasharray="4 3" strokeWidth={1}/>
              <Area type="monotone" dataKey="humidity" name="Humidity" stroke="var(--sky)"
                strokeWidth={2} fill="url(#humGrad)" dot={false}/>
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── MODEL STATUS FOOTER ── */}
      <div className="card model-footer">
        <div className="mf-grid">
          {[
            {label:"MODEL TYPE",   val: status?.model_type || "SGDRegressor"},
            {label:"7-DAY RMSE",   val: f2(status?.rolling_rmse_7d)+"°C",  accent:true},
            {label:"7-DAY MAE",    val: f2(status?.rolling_mae_7d)+"°C",   accent:true},
            {label:"PREDICTIONS",  val: (status?.n_predictions||0).toLocaleString()},
            {label:"FEATURES",     val: status?.feature_count || 27},
            {label:"HISTORY BUF",  val: (status?.history_length||0).toString()},
            {label:"STATUS",       val: status?.model_loaded ? "● ONLINE" : "● OFFLINE",
              color: status?.model_loaded ? "var(--teal)" : "var(--coral)"},
          ].map(({label,val,accent,color}) => (
            <div key={label} className="mf-item">
              <span className="mf-label">{label}</span>
              <span className="mf-val" style={{color:color||(accent?"var(--gold-lt)":"var(--t1)")}}>{val}</span>
            </div>
          ))}
        </div>
      </div>

    </div>
  );
}
