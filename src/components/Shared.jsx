export function Tip({ active, payload, label, unit = "" }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background:"var(--bg-3)",border:"1px solid var(--line-med)",
      borderRadius:"var(--r2)",padding:"10px 14px",
      fontFamily:"var(--f-body)",fontSize:"0.75rem",minWidth:130,
      boxShadow:"0 12px 40px rgba(0,0,0,0.5)"
    }}>
      <div style={{color:"var(--t2)",marginBottom:6,fontSize:"0.65rem",
        fontFamily:"var(--f-mono)",letterSpacing:"0.08em"}}>{label}</div>
      {payload.map((p,i)=>(
        <div key={i} style={{display:"flex",alignItems:"center",gap:6,marginBottom:2}}>
          <span style={{width:7,height:7,borderRadius:"50%",background:p.color,flexShrink:0}}/>
          <span style={{color:"var(--t2)",flex:1}}>{p.name}</span>
          <span style={{color:"var(--t1)",fontWeight:600}}>
            {typeof p.value==="number"?p.value.toFixed(2):p.value}{unit}
          </span>
        </div>
      ))}
    </div>
  );
}

export function SectionHead({ title, badge, right }) {
  return (
    <div style={{display:"flex",alignItems:"center",justifyContent:"space-between",marginBottom:18}}>
      <div style={{display:"flex",alignItems:"center",gap:10}}>
        <span style={{color:"var(--gold)",fontSize:"0.75rem"}}>◈</span>
        <span style={{fontFamily:"var(--f-body)",fontWeight:700,fontSize:"0.9rem",color:"var(--t1)",letterSpacing:"0.01em"}}>{title}</span>
        {badge&&<span style={{fontFamily:"var(--f-mono)",fontSize:"0.52rem",letterSpacing:"0.15em",padding:"2px 8px",borderRadius:99,border:"1px solid var(--line-warm)",background:"var(--gold-glow)",color:"var(--gold)"}}>{badge}</span>}
      </div>
      {right&&<div>{right}</div>}
    </div>
  );
}

export function TabGroup({ tabs, active, onChange, small }) {
  return (
    <div style={{display:"flex",gap:3}}>
      {tabs.map(({id,label})=>(
        <button key={id} onClick={()=>onChange(id)} style={{
          fontFamily:"var(--f-body)",fontSize:small?"0.68rem":"0.72rem",fontWeight:500,
          padding:small?"4px 10px":"5px 14px",borderRadius:"var(--r1)",
          border:`1px solid ${active===id?"var(--line-warm)":"var(--line)"}`,
          background:active===id?"var(--gold-glow)":"transparent",
          color:active===id?"var(--gold-lt)":"var(--t2)",
          cursor:"pointer",transition:"all 0.18s var(--ease)"
        }}>{label}</button>
      ))}
    </div>
  );
}
