import { useState, useEffect, useCallback } from "react";
import {
  ScatterChart, Scatter, LineChart, Line, BarChart, Bar, AreaChart, Area,
  XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine,
  RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis
} from "recharts";
import { api, mockData, fetchWithFallback } from "../api";
import { Tip, SectionHead, TabGroup } from "../components/Shared";
import "./MLLab.css";

const f = (v, d=3) => v!=null ? (+v).toFixed(d) : "—";
const fT = iso => {
  const d = new Date(iso);
  return `${(d.getMonth()+1).toString().padStart(2,"0")}/${d.getDate()} ${d.getHours().toString().padStart(2,"0")}h`;
};

/* ── Score card ─────────────────────────── */
function Score({ label, value, unit="", tier, desc, color }) {
  const tiers = {
    excellent:{ text:"EXCELLENT", c:"var(--mint)" },
    good:     { text:"GOOD",      c:"var(--teal)" },
    fair:     { text:"FAIR",      c:"var(--gold)" },
    poor:     { text:"POOR",      c:"var(--coral)" },
  };
  const t = tiers[tier] || tiers.good;
  return (
    <div className={`score-card card score-${color}`}>
      <div className="score-top">
        <span className="card-label-sm">{label}</span>
        <span className="score-tier" style={{color:t.c,borderColor:t.c+"33"}}>{t.text}</span>
      </div>
      <div className="score-val">
        {f(value, unit==="%"?1:4)}
        <span className="score-unit">{unit}</span>
      </div>
      <div className="score-desc">{desc}</div>
    </div>
  );
}

/* ── Model data ─────────────────────────── */
const MODELS = [
  { name:"SGDRegressor", type:"Incremental",      mae:0.521,rmse:0.734,r2:0.9612,tt:"~2s",  online:true,  note:"Production — partial_fit online updates" },
  { name:"GBR",          type:"Gradient Boosting",mae:0.389,rmse:0.541,r2:0.9781,tt:"~45s", online:false, note:"Best offline accuracy" },
  { name:"XGBoost",      type:"Gradient Boosting",mae:0.401,rmse:0.558,r2:0.9763,tt:"~38s", online:false, note:"Close second in PyCaret" },
  { name:"LightGBM",     type:"Gradient Boosting",mae:0.412,rmse:0.572,r2:0.9748,tt:"~22s", online:false, note:"Fastest tree-based" },
  { name:"Random Forest",type:"Ensemble",          mae:0.447,rmse:0.623,r2:0.9694,tt:"~60s", online:false, note:"Stable, outlier-resistant" },
  { name:"Extra Trees",  type:"Ensemble",          mae:0.463,rmse:0.641,r2:0.9672,tt:"~55s", online:false, note:"Faster RF variant" },
  { name:"LASSO",        type:"Linear",            mae:0.712,rmse:0.991,r2:0.9127,tt:"~1s",  online:false, note:"L1 penalty" },
  { name:"ElasticNet",   type:"Linear",            mae:0.698,rmse:0.968,r2:0.9151,tt:"~1s",  online:false, note:"L1+L2 hybrid" },
];

const FEATURES = [
  { name:"temp_lag1",            imp:0.412, group:"lag",     safe:true },
  { name:"temp_lag2",            imp:0.187, group:"lag",     safe:true },
  { name:"temp_lag3",            imp:0.091, group:"lag",     safe:true },
  { name:"temp_delta",           imp:0.068, group:"delta",   safe:true },
  { name:"hour",                 imp:0.052, group:"time",    safe:true },
  { name:"pressure_msl",         imp:0.038, group:"meteo",   safe:true },
  { name:"relative_humidity_2m", imp:0.031, group:"meteo",   safe:true },
  { name:"humidity_roll3",       imp:0.024, group:"rolling", safe:true },
  { name:"cloud_cover",          imp:0.021, group:"meteo",   safe:true },
  { name:"wind_speed_10m",       imp:0.018, group:"meteo",   safe:true },
  { name:"pressure_roll3",       imp:0.014, group:"rolling", safe:true },
  { name:"dayofyear",            imp:0.012, group:"time",    safe:true },
  { name:"pressure_delta",       imp:0.010, group:"delta",   safe:true },
  { name:"precipitation_roll6",  imp:0.008, group:"rolling", safe:true },
  { name:"wind_gusts_10m",       imp:0.007, group:"meteo",   safe:true },
];

const GROUP_C = { lag:"var(--gold)",delta:"var(--coral)",time:"var(--lilac)",meteo:"var(--sky)",rolling:"var(--teal)" };

const REMOVED = [
  { name:"temp_roll3_mean",      reason:"Rolling avg of TARGET — corr 0.9986" },
  { name:"temp_roll7_mean",      reason:"Rolling avg of TARGET — corr 0.9516" },
  { name:"dewspread",            reason:"(temp - dew_point) encodes target" },
  { name:"humidity_temp_ratio",  reason:"(humidity / temp) encodes target" },
  { name:"apparent_temperature", reason:"Derived from temperature" },
  { name:"dew_point_2m",         reason:"Partially derived from temperature" },
  { name:"visibility",           reason:"Near-zero correlation (0.019)" },
  { name:"snowfall",             reason:"All-zero in this dataset" },
];

const RADAR = [
  { m:"Accuracy",  SGD:72,GBR:91,XGB:89 },
  { m:"Speed",     SGD:98,GBR:62,XGB:68 },
  { m:"Online",    SGD:100,GBR:0,XGB:0  },
  { m:"Stability", SGD:78,GBR:85,XGB:83 },
  { m:"Memory",    SGD:96,GBR:55,XGB:58 },
  { m:"Latency",   SGD:99,GBR:70,XGB:72 },
];

const DECISIONS = [
  { icon:"⚡", title:"SGD over LR/Ridge",        desc:"LR/Ridge algebraically reconstruct the target using lag features (fake R²≈1.0). Tree-based and SGD models produce honest ~0.90 R²." },
  { icon:"📐", title:"squared_error loss",        desc:"Huber loss was unstable with temperature-scale targets. MSE provides stable convergence on this dataset." },
  { icon:"📉", title:"constant learning rate",    desc:"invscaling decayed too aggressively during partial_fit updates. eta0=0.001 maintains steady adaptation without explosion." },
  { icon:"📅", title:"Chronological split",       desc:"Train/test split preserves temporal order. Random splits on time-series data leak future information into training." },
  { icon:"🔄", title:"Online learning",           desc:"partial_fit() on every ESP32 reading adapts to seasonal drift without full retraining — improving with every data point." },
  { icon:"🎯", title:"RMSE threshold retrain",    desc:"Scheduler checks rolling RMSE every 6 hours. If >1.5°C, partial_fit passes over recent 168 error rows nudge the model back." },
];

/* ── MAIN ─────────────────────────────── */
export default function MLLab() {
  const [perf,   setPerf]   = useState(null);
  const [status, setStatus] = useState(null);
  const [loading, setLoad]  = useState(true);
  const [tab,    setTab]    = useState("overview");
  const [sortCol,setSortC]  = useState("rmse");
  const [sortDir,setSortD]  = useState("asc");
  const [perfN,  setPerfN]  = useState(48);

  const load = useCallback(async () => {
    setLoad(true);
    const [s, p] = await Promise.all([
      fetchWithFallback(api.modelStatus,      mockData.modelStatus),
      fetchWithFallback(api.modelPerformance, mockData.modelPerformance, perfN),
    ]);
    setStatus(s); setPerf(p); setLoad(false);
  }, [perfN]);

  useEffect(() => { load(); }, [load]);

  const preds  = (perf?.predictions || []).slice().reverse();
  const errors = preds.map(p => p.absolute_error || Math.abs((p.actual_temp||0)-(p.predicted_temp||0)));
  const mae    = errors.length ? errors.reduce((a,b)=>a+b,0)/errors.length : 0;
  const rmse   = errors.length ? Math.sqrt(errors.map(e=>e*e).reduce((a,b)=>a+b,0)/errors.length) : 0;
  const actuals= preds.map(p => p.actual_temp||0);
  const meanA  = actuals.reduce((a,b)=>a+b,0)/Math.max(actuals.length,1);
  const ssTot  = actuals.map(v=>Math.pow(v-meanA,2)).reduce((a,b)=>a+b,0);
  const ssRes  = errors.map(e=>e*e).reduce((a,b)=>a+b,0);
  const r2     = ssTot > 0 ? Math.max(0, 1 - ssRes/ssTot) : 0;

  const sorted = [...MODELS].sort((a,b) => {
    const d = sortDir==="asc" ? 1 : -1;
    return (a[sortCol] > b[sortCol] ? 1 : -1) * d;
  });

  const predChart = preds.slice(-perfN).map(p => ({
    time:      fT(p.predicted_at),
    actual:    +(+p.actual_temp||0).toFixed(2),
    predicted: +(+p.predicted_temp||0).toFixed(2),
    error:     +(p.absolute_error||Math.abs((p.actual_temp||0)-(p.predicted_temp||0))).toFixed(3),
  }));

  const errDist = Array.from({length:20},(_,i)=>{
    const lo=i*0.1, hi=lo+0.1;
    return { range:`${lo.toFixed(1)}`, count:errors.filter(e=>e>=lo&&e<hi).length };
  }).filter(b=>b.count>0);

  const TABS = [
    {id:"overview",    label:"Overview"},
    {id:"predictions", label:"Predictions"},
    {id:"features",    label:"Features"},
    {id:"audit",       label:"Leakage Audit"},
  ];

  return (
    <div className="mllab">
      {/* Header */}
      <div className="ml-header">
        <div>
          <div className="ml-eyebrow">MACHINE LEARNING LABORATORY</div>
          <h1 className="ml-title">Model <em>Performance</em> & Analysis</h1>
          <p className="ml-sub">SGDRegressor incremental learning — ANITS Open-Meteo historical data</p>
        </div>
        <TabGroup tabs={TABS} active={tab} onChange={setTab}/>
      </div>

      {/* ── OVERVIEW ── */}
      {tab === "overview" && (
        <div className="ml-section">
          <div className="grid-4" style={{marginBottom:16}}>
            <Score label="RMSE 7-DAY" value={status?.rolling_rmse_7d||rmse} unit="°C"
              tier={rmse<0.6?"excellent":rmse<1?"good":rmse<1.5?"fair":"poor"}
              desc="Root Mean Square Error — penalises large misses" color="gold"/>
            <Score label="MAE 7-DAY" value={status?.rolling_mae_7d||mae} unit="°C"
              tier={mae<0.5?"excellent":mae<0.8?"good":mae<1.2?"fair":"poor"}
              desc="Mean Absolute Error — average prediction miss" color="teal"/>
            <Score label="R² SCORE" value={r2} unit=""
              tier={r2>0.95?"excellent":r2>0.9?"good":r2>0.8?"fair":"poor"}
              desc="Coefficient of determination (1.0 = perfect)" color="sky"/>
            <Score label="LOGGED" value={(status?.n_predictions||1183).toLocaleString()} unit=""
              tier="good" desc="Total predictions in Supabase" color="lilac"/>
          </div>

          <div className="grid-2" style={{marginBottom:16}}>
            {/* Radar */}
            <div className="card">
              <SectionHead title="CAPABILITY RADAR"/>
              <ResponsiveContainer width="100%" height={270}>
                <RadarChart data={RADAR}>
                  <PolarGrid stroke="rgba(255,255,255,0.05)"/>
                  <PolarAngleAxis dataKey="m" tick={{fill:"var(--t2)",fontSize:10,fontFamily:"var(--f-body)",fontWeight:500}}/>
                  <PolarRadiusAxis tick={{fill:"var(--t4)",fontSize:8}} domain={[0,100]}/>
                  <Radar name="SGD"     dataKey="SGD" stroke="var(--gold)"  fill="var(--gold)"  fillOpacity={0.12} strokeWidth={2}/>
                  <Radar name="GBR"     dataKey="GBR" stroke="var(--teal)"  fill="var(--teal)"  fillOpacity={0.08} strokeWidth={1.5}/>
                  <Radar name="XGBoost" dataKey="XGB" stroke="var(--lilac)" fill="var(--lilac)" fillOpacity={0.08} strokeWidth={1.5}/>
                  <Tooltip contentStyle={{background:"var(--bg-3)",border:"1px solid var(--line)",borderRadius:8,fontFamily:"var(--f-body)",fontSize:11}}/>
                </RadarChart>
              </ResponsiveContainer>
              <div className="radar-legend">
                {[["SGDRegressor","gold"],["GBR","teal"],["XGBoost","lilac"]].map(([n,c])=>(
                  <span key={n} style={{display:"flex",alignItems:"center",gap:5}}>
                    <span style={{width:8,height:8,borderRadius:"50%",background:`var(--${c})`,display:"inline-block"}}/>
                    <span style={{fontFamily:"var(--f-body)",fontSize:"0.65rem",color:"var(--t2)"}}>{n}</span>
                  </span>
                ))}
              </div>
            </div>

            {/* Error distribution */}
            <div className="card">
              <SectionHead title="ERROR DISTRIBUTION"/>
              <ResponsiveContainer width="100%" height={220}>
                <BarChart data={errDist} margin={{top:8,right:12,left:-18,bottom:0}}>
                  <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)"/>
                  <XAxis dataKey="range" tick={{fill:"var(--t3)",fontSize:9,fontFamily:"var(--f-mono)"}} tickLine={false} axisLine={false}/>
                  <YAxis tick={{fill:"var(--t3)",fontSize:9,fontFamily:"var(--f-mono)"}} tickLine={false} axisLine={false}/>
                  <Tooltip content={<Tip/>}/>
                  <Bar dataKey="count" name="Count" fill="var(--gold)" opacity={0.7} radius={[3,3,0,0]}/>
                </BarChart>
              </ResponsiveContainer>
              <div className="dist-stats">
                <span>Mean <b>{f(mae,3)}°C</b></span>
                <span>Median <b>{f([...errors].sort((a,b)=>a-b)[Math.floor(errors.length/2)],3)}°C</b></span>
                <span>Max <b>{f(Math.max(...errors,0),3)}°C</b></span>
              </div>
            </div>
          </div>

          {/* Model comparison table */}
          <div className="card">
            <SectionHead title="MODEL COMPARISON — PYCARET RESULTS" badge="OFFLINE EVAL"/>
            <div className="table-scroll">
              <table className="ml-table">
                <thead>
                  <tr>
                    {[["name","Model"],["type","Type"],["mae","MAE"],["rmse","RMSE"],["r2","R²"],["tt","Train"],["online","Online"],["note","Notes"]].map(([k,l])=>(
                      <th key={k} className={sortCol===k?"sorted":""} onClick={()=>{
                        sortCol===k ? setSortD(d=>d==="asc"?"desc":"asc") : (setSortC(k),setSortD("asc"));
                      }}>{l}{sortCol===k?(sortDir==="asc"?" ↑":" ↓"):""}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {sorted.map(m=>(
                    <tr key={m.name} className={m.name==="SGDRegressor"?"tr-highlight":""}>
                      <td><span className="model-nm">{m.name}</span>{m.name==="SGDRegressor"&&<span className="prod-tag">PROD</span>}</td>
                      <td><span className="type-tag">{m.type}</span></td>
                      <td style={{color:m.mae<0.5?"var(--teal)":m.mae<0.7?"var(--gold)":"var(--coral)",fontWeight:600}}>{f(m.mae)}</td>
                      <td style={{color:m.rmse<0.6?"var(--teal)":m.rmse<0.9?"var(--gold)":"var(--coral)",fontWeight:600}}>{f(m.rmse)}</td>
                      <td style={{color:m.r2>0.97?"var(--teal)":m.r2>0.94?"var(--gold)":"var(--coral)",fontWeight:600}}>{f(m.r2)}</td>
                      <td style={{color:"var(--t2)"}}>{m.tt}</td>
                      <td><span className={m.online?"yes-tag":"no-tag"}>{m.online?"✓ YES":"✗ NO"}</span></td>
                      <td className="note-cell">{m.note}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* ── PREDICTIONS ── */}
      {tab === "predictions" && (
        <div className="ml-section">
          <div style={{display:"flex",justifyContent:"flex-end",marginBottom:12}}>
            <TabGroup small tabs={[{id:24,label:"24H"},{id:48,label:"48H"},{id:96,label:"4D"},{id:168,label:"7D"}]}
              active={perfN} onChange={v=>setPerfN(+v)}/>
          </div>

          <div className="card" style={{marginBottom:16}}>
            <SectionHead title="ACTUAL vs PREDICTED TEMPERATURE"/>
            <ResponsiveContainer width="100%" height={280}>
              <LineChart data={predChart} margin={{top:8,right:12,left:-18,bottom:0}}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)"/>
                <XAxis dataKey="time" tick={{fill:"var(--t3)",fontSize:9,fontFamily:"var(--f-mono)"}} tickLine={false} axisLine={false} interval={Math.floor(predChart.length/8)}/>
                <YAxis tick={{fill:"var(--t3)",fontSize:9,fontFamily:"var(--f-mono)"}} tickLine={false} axisLine={false}/>
                <Tooltip content={<Tip unit="°C"/>}/>
                <Line type="monotone" dataKey="actual"    name="Actual"    stroke="var(--gold)"  strokeWidth={2}   dot={false}/>
                <Line type="monotone" dataKey="predicted" name="Predicted" stroke="var(--teal)"  strokeWidth={1.5} dot={false} strokeDasharray="5 3"/>
              </LineChart>
            </ResponsiveContainer>
          </div>

          <div className="card" style={{marginBottom:16}}>
            <SectionHead title="ABSOLUTE ERROR OVER TIME"/>
            <ResponsiveContainer width="100%" height={180}>
              <AreaChart data={predChart} margin={{top:8,right:12,left:-18,bottom:0}}>
                <defs>
                  <linearGradient id="errG" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%"  stopColor="var(--coral)" stopOpacity={0.3}/>
                    <stop offset="95%" stopColor="var(--coral)" stopOpacity={0}/>
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)"/>
                <XAxis dataKey="time" tick={{fill:"var(--t3)",fontSize:9,fontFamily:"var(--f-mono)"}} tickLine={false} axisLine={false} interval={Math.floor(predChart.length/8)}/>
                <YAxis tick={{fill:"var(--t3)",fontSize:9,fontFamily:"var(--f-mono)"}} tickLine={false} axisLine={false}/>
                <Tooltip content={<Tip unit="°C"/>}/>
                <ReferenceLine y={mae} stroke="var(--gold)" strokeDasharray="4 3"
                  label={{value:`MAE ${f(mae,3)}`,fill:"var(--gold)",fontSize:9,fontFamily:"var(--f-mono)"}}/>
                <Area type="monotone" dataKey="error" name="Error" stroke="var(--coral)" strokeWidth={1.5} fill="url(#errG)" dot={false}/>
              </AreaChart>
            </ResponsiveContainer>
          </div>

          <div className="card">
            <SectionHead title="ACTUAL vs PREDICTED SCATTER" badge="PERFECT = DIAGONAL"/>
            <ResponsiveContainer width="100%" height={260}>
              <ScatterChart margin={{top:10,right:20,left:-10,bottom:0}}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.03)"/>
                <XAxis dataKey="x" name="Actual" type="number" domain={["auto","auto"]}
                  tick={{fill:"var(--t3)",fontSize:9,fontFamily:"var(--f-mono)"}} tickLine={false} axisLine={false}
                  label={{value:"Actual (°C)",fill:"var(--t2)",fontSize:10,dy:18,fontFamily:"var(--f-body)"}}/>
                <YAxis dataKey="y" name="Predicted" type="number" domain={["auto","auto"]}
                  tick={{fill:"var(--t3)",fontSize:9,fontFamily:"var(--f-mono)"}} tickLine={false} axisLine={false}
                  label={{value:"Predicted (°C)",fill:"var(--t2)",fontSize:10,angle:-90,dx:-18,fontFamily:"var(--f-body)"}}/>
                <Tooltip contentStyle={{background:"var(--bg-3)",border:"1px solid var(--line)",borderRadius:8,fontFamily:"var(--f-body)",fontSize:11}}/>
                <Scatter data={predChart.map(p=>({x:p.actual,y:p.predicted}))}
                  fill="var(--gold)" fillOpacity={0.55} name="Predictions"/>
                {predChart.length > 0 && (()=>{
                  const xs = predChart.map(p=>p.actual);
                  const mn = Math.min(...xs), mx = Math.max(...xs);
                  return <ReferenceLine segment={[{x:mn,y:mn},{x:mx,y:mx}]} stroke="var(--teal)" strokeDasharray="4 3"/>;
                })()}
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* ── FEATURES ── */}
      {tab === "features" && (
        <div className="ml-section">
          <div className="card" style={{marginBottom:16}}>
            <SectionHead title="FEATURE IMPORTANCE (SGD COEFFICIENTS)"
              right={
                <div style={{display:"flex",gap:10,flexWrap:"wrap"}}>
                  {Object.entries(GROUP_C).map(([g,c])=>(
                    <span key={g} style={{display:"flex",alignItems:"center",gap:4,
                      fontFamily:"var(--f-body)",fontSize:"0.62rem",color:"var(--t2)"}}>
                      <span style={{width:7,height:7,borderRadius:"50%",background:c,display:"inline-block"}}/>
                      {g}
                    </span>
                  ))}
                </div>
              }/>
            <div className="feat-list">
              {[...FEATURES].sort((a,b)=>b.imp-a.imp).map((feat,i)=>(
                <div key={feat.name} className="feat-row" style={{animationDelay:`${i*0.03}s`}}>
                  <span className="feat-name">{feat.name}</span>
                  <div className="feat-track">
                    <div className="feat-fill" style={{
                      width:`${feat.imp/FEATURES[0].imp*100}%`,
                      background:GROUP_C[feat.group],opacity:0.75
                    }}/>
                  </div>
                  <span className="feat-pct" style={{color:GROUP_C[feat.group]}}>
                    {(feat.imp*100).toFixed(1)}%
                  </span>
                  <span className="feat-grp" style={{color:GROUP_C[feat.group]}}>{feat.group}</span>
                </div>
              ))}
            </div>
          </div>

          <div className="grid-3">
            {Object.entries(GROUP_C).map(([group,color])=>{
              const feats = FEATURES.filter(f=>f.group===group);
              const total = feats.reduce((s,f)=>s+f.imp,0);
              return (
                <div key={group} className="card group-card">
                  <div className="group-hd">
                    <span style={{width:8,height:8,borderRadius:"50%",background:color,display:"inline-block"}}/>
                    <span className="group-nm">{group.toUpperCase()}</span>
                    <span className="group-pct" style={{color}}>{(total*100).toFixed(1)}%</span>
                  </div>
                  {feats.map(f=>(
                    <div key={f.name} className="group-feat">
                      <span>{f.name}</span>
                      <span style={{color,fontWeight:600}}>{(f.imp*100).toFixed(1)}%</span>
                    </div>
                  ))}
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* ── AUDIT ── */}
      {tab === "audit" && (
        <div className="ml-section">
          <div className="audit-banner card">
            <span className="audit-icon-big">🔍</span>
            <div>
              <div className="audit-title">DATA LEAKAGE AUDIT — COMPLETED</div>
              <div className="audit-sub">8 features removed to prevent target leakage. Features correlated with the target in ways only knowable after prediction time produce unrealistically high scores and fail on live data.</div>
            </div>
          </div>

          <div className="card" style={{marginTop:14}}>
            <SectionHead title="REMOVED FEATURES" badge="LEAKAGE RISK"/>
            <div className="table-scroll">
              <table className="audit-table">
                <thead><tr><th>Feature</th><th>Reason</th><th>Risk</th></tr></thead>
                <tbody>
                  {REMOVED.map(r=>(
                    <tr key={r.name}>
                      <td><code className="feat-code">{r.name}</code></td>
                      <td style={{color:"var(--t2)",fontSize:"0.75rem"}}>{r.reason}</td>
                      <td><span className="risk-tag">HIGH</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className="card" style={{marginTop:14}}>
            <SectionHead title="LEAKAGE IMPACT"/>
            <div className="impact-grid">
              <div className="impact-side bad-side">
                <div className="impact-hd bad-hd">WITH LEAKY FEATURES</div>
                <div className="impact-metric"><span>MAE</span><span className="bad-val">≈ 0.04°C</span></div>
                <div className="impact-metric"><span>RMSE</span><span className="bad-val">≈ 0.06°C</span></div>
                <div className="impact-metric"><span>R²</span><span className="bad-val">≈ 0.9998</span></div>
                <div className="impact-note bad-note">⚠ Deceptively perfect — model memorises target encoding, fails on live data</div>
              </div>
              <div className="impact-arrow">→</div>
              <div className="impact-side good-side">
                <div className="impact-hd good-hd">AFTER REMOVAL</div>
                <div className="impact-metric"><span>MAE</span><span className="good-val">≈ 0.52°C</span></div>
                <div className="impact-metric"><span>RMSE</span><span className="good-val">≈ 0.73°C</span></div>
                <div className="impact-metric"><span>R²</span><span className="good-val">≈ 0.9612</span></div>
                <div className="impact-note good-note">✓ Honest performance — real meteorological patterns learned</div>
              </div>
            </div>
          </div>

          <div className="card" style={{marginTop:14}}>
            <SectionHead title="MODEL DESIGN DECISIONS"/>
            <div className="decisions-grid">
              {DECISIONS.map(d=>(
                <div key={d.title} className="decision-card">
                  <span className="dec-icon">{d.icon}</span>
                  <div>
                    <div className="dec-title">{d.title}</div>
                    <div className="dec-desc">{d.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
