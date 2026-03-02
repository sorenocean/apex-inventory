import { useState, useEffect, useCallback, useMemo } from "react";
import { supabase } from './supabase.js';

/* ═══════════════════════════════════════════════════════════════
   APEX COOL LABS — Assembly & Parts Tracker
   Multi-stage: Parts → Handles → Seal Plates → Narwalls → Packages → Ship
   ═══════════════════════════════════════════════════════════════ */

// ── Persistence (Supabase) ────────────────────────────────────
async function dbGet() {
  try {
    const [partsRes, assRes, logRes] = await Promise.all([
      supabase.from('parts').select('*'),
      supabase.from('assemblies').select('*').eq('id', 'main').single(),
      supabase.from('log').select('*').order('date', { ascending: false }).limit(500),
    ]);
    if (partsRes.error || assRes.error || logRes.error) {
      console.error('Load error:', partsRes.error, assRes.error, logRes.error);
      return null;
    }
    return {
      parts: partsRes.data,
      built: {
        handles: assRes.data.handles || 0,
        bases: assRes.data.bases || 0,
        coolpacks: assRes.data.coolpacks || 0,
        narwalls: assRes.data.narwalls || 0,
        packages: assRes.data.packages || 0,
      },
      log: logRes.data,
    };
  } catch (e) { console.error('dbGet failed:', e); return null; }
}

async function dbSet(data) {
  try {
    if (data.parts) {
      for (const p of data.parts) {
        await supabase.from('parts').upsert({
          id:p.id, name:p.name, sku:p.sku, cat:p.cat,
          qty:p.qty, low:p.low, cost:p.cost, supplier:p.supplier||'', note:p.note||''
        }, { onConflict: 'id' });
      }
    }
    if (data.built) {
      await supabase.from('assemblies').upsert({
        id:'main',
        handles: data.built.handles,
        bases: data.built.bases,
        coolpacks: data.built.coolpacks,
        narwalls: data.built.narwalls,
        packages: data.built.packages,
      }, { onConflict: 'id' });
    }
    if (data.log && data.log.length > 0) {
      const latest = data.log[0];
      await supabase.from('log').upsert({
        id:latest.id, type:latest.type, name:latest.name,
        change:latest.change, note:latest.note, date:latest.date
      }, { onConflict: 'id' });
    }
  } catch (e) { console.error('dbSet failed:', e); }
}

// ── Helpers ───────────────────────────────────────────────────
const uid = () => crypto.randomUUID ? crypto.randomUUID().slice(0,8) : Math.random().toString(36).slice(2,10);
const ts = () => new Date().toISOString();
const fmtDate = d => new Date(d).toLocaleDateString("en-US",{month:"short",day:"numeric",hour:"2-digit",minute:"2-digit"});

// ── Colors ────────────────────────────────────────────────────
const C = {
  bg:"#0a0c10", panel:"#12151c", card:"#181c26", raised:"#1f2433",
  bdr:"#262d3d", bdrL:"#333c52",
  txt:"#dce1eb", sub:"#7d879e", dim:"#4a5268",
  blue:"#3b8bff", blueS:"rgba(59,139,255,.1)",
  cyan:"#06d6a0", cyanS:"rgba(6,214,160,.08)",
  amber:"#ffb627", amberS:"rgba(255,182,39,.1)",
  red:"#ff5c5c", redS:"rgba(255,92,92,.1)",
  violet:"#9580ff", violetS:"rgba(149,128,255,.1)",
  teal:"#2dd4bf", tealS:"rgba(45,212,191,.08)",
};

// ── Icons ─────────────────────────────────────────────────────
const P = {
  home:"M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z",
  wrench:"M14.7 6.3a1 1 0 000 1.4l1.6 1.6a1 1 0 001.4 0l3.77-3.77a6 6 0 01-7.94 7.94l-6.91 6.91a2.12 2.12 0 01-3-3l6.91-6.91a6 6 0 017.94-7.94l-3.76 3.76z",
  layers:"M12 2L2 7l10 5 10-5-10-5zM2 17l10 5 10-5M2 12l10 5 10-5",
  truck:"M1 3h15v13H1zM16 8h4l3 3v5h-7V8zM5.5 21.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5zM18.5 21.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5z",
  clock:"M12 8v4l3 3M3 12a9 9 0 1018 0 9 9 0 00-18 0z",
  alert:"M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0zM12 9v4M12 17h.01",
  plus:"M12 5v14M5 12h14",
  x:"M18 6L6 18M6 6l12 12",
  edit:"M11 4H4a2 2 0 00-2 2v14a2 2 0 002 2h14a2 2 0 002-2v-7M18.5 2.5a2.12 2.12 0 013 3L12 15l-4 1 1-4 9.5-9.5z",
  trash:"M3 6h18M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2",
  check:"M20 6L9 17l-5-5",
  up:"M12 19V5M5 12l7-7 7 7",
  down:"M12 5v14M19 12l-7 7-7-7",
  box:"M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16z",
  pkg:"M16.5 9.4l-9-5.19M21 16V8a2 2 0 00-1-1.73l-7-4a2 2 0 00-2 0l-7 4A2 2 0 003 8v8a2 2 0 001 1.73l7 4a2 2 0 002 0l7-4A2 2 0 0021 16zM3.27 6.96L12 12.01l8.73-5.05M12 22.08V12",
  reset:"M1 4v6h6M23 20v-6h-6M20.49 9A9 9 0 005.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 013.51 15",
  zap:"M13 2L3 14h9l-1 10 10-12h-9l1-10z",
};
const Ic = ({d,s=16,c="currentColor"}) => <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d={d}/></svg>;

// ── Default Data ──────────────────────────────────────────────
const INIT = () => ({
  parts: [
    {id:"hp",  name:"Heat Pipe",             sku:"NW-HP-001",  cat:"Component", qty:0, low:50, cost:0, supplier:"", note:""},
    {id:"htc", name:"Handle Top Cap",         sku:"NW-HTC-001", cat:"Component", qty:0, low:10, cost:0, supplier:"", note:""},
    {id:"hb",  name:"Handle Base",            sku:"NW-HB-001",  cat:"Component", qty:0, low:10, cost:0, supplier:"", note:""},
    {id:"sp",  name:"Seal Plate",             sku:"NW-SP-001",  cat:"Component", qty:0, low:10, cost:0, supplier:"", note:""},
    {id:"gsk", name:"Gasket",                 sku:"NW-GSK-001", cat:"Component", qty:0, low:10, cost:0, supplier:"", note:""},
    {id:"bs",  name:"Base Sleeve",            sku:"NW-BS-001",  cat:"Component", qty:0, low:10, cost:0, supplier:"", note:""},
    {id:"ssc", name:"Stainless Steel Container", sku:"NW-SSC-001", cat:"Component", qty:0, low:10, cost:0, supplier:"", note:""},
    {id:"cp",  name:"Cool Pack",              sku:"NW-CP-001",  cat:"Accessory", qty:0, low:25, cost:0, supplier:"", note:""},
    {id:"bx",  name:"Shipping Box",           sku:"NW-BX-001",  cat:"Packaging", qty:0, low:15, cost:0, supplier:"", note:""},
  ],
  built: { handles:0, bases:0, coolpacks:0, narwalls:0, packages:0 },
  log: [],
});

// ── Presets for quick-input ───────────────────────────────────
const PRESETS = [10, 25, 50, 100];

// ════════════════════════════════════════════════════════════════
// MAIN APP
// ════════════════════════════════════════════════════════════════
export default function App() {
  const [db, setDb] = useState(null);
  const [view, setView] = useState("dash");
  const [mod, setMod] = useState(null);
  const [srch, setSrch] = useState("");

  useEffect(()=>{ (async()=>{ const d = await dbGet(); setDb(d||INIT()); })(); },[]);

  const save = useCallback(fn => {
    setDb(prev => { const next = fn(prev); dbSet(next); return next; });
  },[]);

  const part = useCallback(pid => db?.parts.find(p=>p.id===pid), [db]);

  const log = useCallback((type, name, change, note) => {
    save(d => ({...d, log:[{id:uid(),type,name,change,note,date:ts()},...d.log].slice(0,500)}));
  },[save]);

  // ── Max buildable calculations ──────────────────────────────
  const maxHandles = useMemo(()=>{
    if(!db) return 0;
    return Math.min(Math.floor((part("hp")?.qty||0)/8),part("htc")?.qty||0,part("hb")?.qty||0,part("sp")?.qty||0,part("gsk")?.qty||0);
  },[db,part]);

  const maxBases = useMemo(()=>{
    if(!db) return 0;
    return Math.min(part("ssc")?.qty||0,part("bs")?.qty||0,part("stk")?.qty||0);
  },[db,part]);

  const maxCoolPacks = useMemo(()=>{
    if(!db) return 0;
    return Math.min(part("cpc")?.qty||0,part("cpb")?.qty||0);
  },[db,part]);

  const maxNarwalls = useMemo(()=>{
    if(!db) return 0;
    return Math.min(db.built.handles, db.built.bases||0);
  },[db]);

  const maxPackages = useMemo(()=>{
    if(!db) return 0;
    return Math.min(Math.floor(db.built.narwalls/2),Math.floor((db.built.coolpacks||0)/4),Math.floor((part("foam")?.qty||0)/2),part("bx")?.qty||0);
  },[db,part]);

  const lowParts = useMemo(()=> db ? db.parts.filter(p=>p.qty<=p.low) : [],[db]);

  const filteredParts = useMemo(()=>{
    if(!db) return [];
    if(!srch) return db.parts;
    const q = srch.toLowerCase();
    return db.parts.filter(p => p.name.toLowerCase().includes(q)||p.sku.toLowerCase().includes(q)||p.cat.toLowerCase().includes(q));
  },[db,srch]);

  // ── Actions ─────────────────────────────────────────────────
  const adjustStock = (pid, delta, note) => {
    save(d => ({...d, parts:d.parts.map(p => p.id===pid ? {...p, qty:Math.max(0,p.qty+delta)} : p)}));
    const p = part(pid);
    log(delta>0?"restock":"use", p?.name||pid, delta, note||"");
  };

  const buildCoolPacks = (qty) => {
    if(qty<1||qty>maxCoolPacks) return;
    save(d => ({
      ...d,
      parts: d.parts.map(p => {
        if(p.id==="cpc") return {...p, qty:p.qty - qty};
        if(p.id==="cpb") return {...p, qty:p.qty - qty};
        return p;
      }),
      built: {...d.built, coolpacks: (d.built.coolpacks||0) + qty},
    }));
    log("build","Cool Pack",qty,`Built ${qty}`);
  };

  const buildHandles = (qty) => {
    if(qty<1||qty>maxHandles) return;
    save(d => ({
      ...d,
      parts: d.parts.map(p => {
        if(p.id==="hp")  return {...p, qty:p.qty - 8*qty};
        if(p.id==="htc") return {...p, qty:p.qty - qty};
        if(p.id==="hb")  return {...p, qty:p.qty - qty};
        if(p.id==="sp")  return {...p, qty:p.qty - qty};
        if(p.id==="gsk") return {...p, qty:p.qty - qty};
        return p;
      }),
      built: {...d.built, handles: d.built.handles + qty},
    }));
    log("build","Handle",qty,`Built ${qty}`);
  };

  const buildBases = (qty) => {
    if(qty<1||qty>maxBases) return;
    save(d => ({
      ...d,
      parts: d.parts.map(p => {
        if(p.id==="ssc") return {...p, qty:p.qty - qty};
        if(p.id==="bs")  return {...p, qty:p.qty - qty};
        if(p.id==="stk") return {...p, qty:p.qty - qty};
        return p;
      }),
      built: {...d.built, bases: (d.built.bases||0) + qty},
    }));
    log("build","Base",qty,`Built ${qty}`);
  };

  const buildNarwalls = (qty) => {
    if(qty<1||qty>maxNarwalls) return;
    save(d => ({
      ...d,
      built: {...d.built, handles:d.built.handles-qty, bases:(d.built.bases||0)-qty, narwalls:d.built.narwalls+qty},
    }));
    log("build","Narwall",qty,`Built ${qty}`);
  };

  const buildPackages = (qty) => {
    if(qty<1||qty>maxPackages) return;
    save(d => ({
      ...d,
      parts: d.parts.map(p => {
        if(p.id==="foam") return {...p, qty:p.qty - 2*qty};
        if(p.id==="bx")   return {...p, qty:p.qty - qty};
        return p;
      }),
      built: {...d.built, narwalls:d.built.narwalls-2*qty, coolpacks:(d.built.coolpacks||0)-4*qty, packages:d.built.packages+qty},
    }));
    log("package","Ship Package",qty,`Packaged ${qty}`);
  };

  const shipPackages = (qty) => {
    if(qty<1||qty>(db?.built.packages||0)) return;
    save(d => ({...d, built:{...d.built, packages:d.built.packages-qty}}));
    log("ship","Ship Package",-qty,`Shipped ${qty}`);
  };

  const savePart = (form, editId) => {
    if(editId){
      save(d=>({...d, parts:d.parts.map(p=>p.id===editId?{...p,...form}:p)}));
      log("edit",form.name,null,"Updated");
    } else {
      save(d=>({...d, parts:[...d.parts,{id:uid(),...form}]}));
      log("add",form.name,form.qty,"Added");
    }
    setMod(null);
  };

  const deletePart = pid => {
    const p = part(pid);
    save(d=>({...d,parts:d.parts.filter(x=>x.id!==pid)}));
    supabase.from('parts').delete().eq('id', pid);
    log("remove",p?.name||"",null,"Deleted");
    setMod(null);
  };

  // ── Helpers ─────────────────────────────────────────────────
  const stkC = p => p.qty===0?C.red:p.qty<=p.low?C.amber:C.cyan;
  const stkBg = p => p.qty===0?C.redS:p.qty<=p.low?C.amberS:C.cyanS;
  const stkLabel = p => p.qty===0?"OUT":p.qty<=p.low?"LOW":"OK";
  const logColor = {restock:{c:C.cyan,bg:C.cyanS,l:"Restock"},use:{c:C.amber,bg:C.amberS,l:"Used"},build:{c:C.blue,bg:C.blueS,l:"Build"},package:{c:C.violet,bg:C.violetS,l:"Package"},ship:{c:C.teal,bg:C.tealS,l:"Shipped"},add:{c:C.blue,bg:C.blueS,l:"Added"},edit:{c:C.violet,bg:C.violetS,l:"Edit"},remove:{c:C.red,bg:C.redS,l:"Removed"}};
  const lc = type => logColor[type]||{c:C.sub,bg:C.raised,l:type};

  if(!db) return <div style={{height:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:C.bg,fontFamily:"'Nunito Sans',sans-serif",color:C.sub,fontSize:13}}>Loading inventory…</div>;

  // ── Nav ─────────────────────────────────────────────────────
  const NAV = [
    {id:"dash",  icon:P.home,   label:"Dashboard"},
    {id:"build", icon:P.wrench, label:"Assembly"},
    {id:"parts", icon:P.layers, label:"Parts"},
    {id:"log",   icon:P.clock,  label:"History"},
    {id:"alerts",icon:P.alert,  label:"Alerts", badge:lowParts.length},
  ];

  // ════════════════════════════════════════════════════════════
  //  RENDER
  // ════════════════════════════════════════════════════════════
  return (
    <div style={{display:"flex",height:"100vh",background:C.bg,overflow:"hidden",fontFamily:"'Nunito Sans',sans-serif",color:C.txt}}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Space+Mono:wght@400;700&family=Nunito+Sans:wght@400;600;700;800&display=swap');
        *{margin:0;padding:0;box-sizing:border-box}
        body{background:${C.bg};font-family:'Nunito Sans',sans-serif;color:${C.txt}}
        ::-webkit-scrollbar{width:5px}::-webkit-scrollbar-track{background:transparent}::-webkit-scrollbar-thumb{background:${C.bdr};border-radius:3px}
        @keyframes fadeIn{from{opacity:0;transform:translateY(4px)}to{opacity:1;transform:none}}
        .fi{animation:fadeIn .2s ease both}
        input,select,button{font-family:inherit}
      `}</style>

      {/* ═══ SIDEBAR ═══ */}
      <nav style={{width:196,background:C.panel,borderRight:`1px solid ${C.bdr}`,display:"flex",flexDirection:"column",flexShrink:0}}>
        <div style={{padding:"16px 12px",display:"flex",alignItems:"center",gap:9,borderBottom:`1px solid ${C.bdr}`}}>
          <img src="/logo.png" style={{width:140,height:"auto",objectFit:"contain",flexShrink:0}} alt="Apex Cool Labs"/>
          <div style={{fontSize:9,color:C.dim,fontWeight:700,letterSpacing:".12em",marginTop:2}}>INVENTORY</div>
        </div>
        <div style={{padding:"8px 6px",flex:1}}>
          {NAV.map(n=>(
            <button key={n.id} onClick={()=>setView(n.id)} style={{display:"flex",alignItems:"center",gap:8,width:"100%",padding:"8px 10px",marginBottom:1,border:"none",borderRadius:7,cursor:"pointer",background:view===n.id?C.blueS:"transparent",color:view===n.id?C.blue:C.sub,fontSize:13,fontWeight:600,transition:"all .12s"}}>
              <Ic d={n.icon} s={15}/>{n.label}
              {n.badge>0&&<span style={{marginLeft:"auto",background:C.red,color:"#fff",fontSize:9,fontWeight:800,padding:"1px 5px",borderRadius:6}}>{n.badge}</span>}
            </button>
          ))}
        </div>
        <div style={{padding:"8px 10px",borderTop:`1px solid ${C.bdr}`}}>
          <button onClick={()=>setMod({t:"reset"})} style={{display:"flex",alignItems:"center",gap:5,width:"100%",padding:"6px 8px",border:"none",borderRadius:6,cursor:"pointer",background:"transparent",color:C.dim,fontSize:11,fontWeight:600}}><Ic d={P.reset} s={12}/>Reset All</button>
        </div>
      </nav>

      {/* ═══ MAIN ═══ */}
      <main style={{flex:1,overflow:"auto",padding:"22px 26px"}}>

      {/* ═══════ DASHBOARD ═══════ */}
      {view==="dash"&&<div className="fi">
        <h1 style={{fontSize:21,fontWeight:800,marginBottom:3}}>Dashboard</h1>
        <p style={{color:C.sub,fontSize:13,marginBottom:20}}>Production pipeline overview</p>

        {/* Pipeline stats */}
        <div style={{display:"flex",gap:10,flexWrap:"wrap",marginBottom:20}}>
          {[
            {l:"Cool Packs",v:db.built.coolpacks||0,c:C.amber,bg:C.amberS,icon:P.snowflake},
            {l:"Handles",v:db.built.handles,c:C.blue,bg:C.blueS,icon:P.wrench},
            {l:"Bases",v:db.built.bases||0,c:C.pink,bg:C.pinkS,icon:P.disc},
            {l:"Narwalls",v:db.built.narwalls,c:C.teal,bg:C.tealS,icon:P.zap},
            {l:"Ship Ready",v:db.built.packages,c:C.cyan,bg:C.cyanS,icon:P.box},
          ].map(s=>(
            <div key={s.l} style={{background:C.panel,border:`1px solid ${C.bdr}`,borderRadius:10,padding:"13px 15px",flex:1,minWidth:100}}>
              <div style={{display:"flex",alignItems:"center",gap:6,marginBottom:5}}>
                <div style={{width:26,height:26,borderRadius:6,background:s.bg,display:"flex",alignItems:"center",justifyContent:"center"}}><Ic d={s.icon} s={13} c={s.c}/></div>
                <span style={{fontSize:9,color:C.sub,fontWeight:700,textTransform:"uppercase",letterSpacing:".05em"}}>{s.l}</span>
              </div>
              <div style={{fontSize:22,fontWeight:800,fontFamily:"'Space Mono'",color:s.c}}>{s.v}</div>
            </div>
          ))}
        </div>

        {/* Pipeline flow visual */}
        <div style={{background:C.panel,border:`1px solid ${C.bdr}`,borderRadius:10,padding:16,marginBottom:20}}>
          <div style={{fontSize:13,fontWeight:700,marginBottom:12,display:"flex",alignItems:"center",gap:6}}><Ic d={P.zap} s={14} c={C.blue}/>Assembly Pipeline — Max Buildable</div>
          <div style={{display:"flex",alignItems:"stretch",gap:6,flexWrap:"wrap"}}>
            <div style={{display:"flex",flexDirection:"column",gap:6,flex:1,minWidth:100}}>
              <div style={{fontSize:9,fontWeight:700,color:C.sub,textTransform:"uppercase",letterSpacing:".06em",textAlign:"center",marginBottom:2}}>Stage 1</div>
              {[{l:"Cool Packs",v:maxCoolPacks,c:C.amber},{l:"Handles",v:maxHandles,c:C.blue},{l:"Bases",v:maxBases,c:C.pink}].map(s=>(
                <div key={s.l} style={{background:C.card,border:`1px solid ${C.bdr}`,borderRadius:7,padding:"8px 10px",textAlign:"center"}}>
                  <div style={{fontSize:10,color:C.sub,fontWeight:600}}>{s.l}</div>
                  <div style={{fontSize:16,fontWeight:800,fontFamily:"'Space Mono'",color:s.v>0?s.c:C.dim}}>{s.v}</div>
                </div>
              ))}
            </div>
            <div style={{display:"flex",alignItems:"center",color:C.dim,fontSize:20}}>→</div>
            <div style={{display:"flex",flexDirection:"column",justifyContent:"center",flex:1,minWidth:100}}>
              <div style={{fontSize:9,fontWeight:700,color:C.sub,textTransform:"uppercase",letterSpacing:".06em",textAlign:"center",marginBottom:2}}>Stage 2</div>
              <div style={{background:C.card,border:`1px solid ${C.bdr}`,borderRadius:7,padding:"12px 10px",textAlign:"center"}}>
                <div style={{fontSize:10,color:C.sub,fontWeight:600}}>Narwalls</div>
                <div style={{fontSize:16,fontWeight:800,fontFamily:"'Space Mono'",color:maxNarwalls>0?C.teal:C.dim}}>{maxNarwalls}</div>
              </div>
            </div>
            <div style={{display:"flex",alignItems:"center",color:C.dim,fontSize:20}}>→</div>
            <div style={{display:"flex",flexDirection:"column",justifyContent:"center",flex:1,minWidth:100}}>
              <div style={{fontSize:9,fontWeight:700,color:C.sub,textTransform:"uppercase",letterSpacing:".06em",textAlign:"center",marginBottom:2}}>Stage 3</div>
              <div style={{background:C.card,border:`1px solid ${C.bdr}`,borderRadius:7,padding:"12px 10px",textAlign:"center"}}>
                <div style={{fontSize:10,color:C.sub,fontWeight:600}}>Packages</div>
                <div style={{fontSize:16,fontWeight:800,fontFamily:"'Space Mono'",color:maxPackages>0?C.violet:C.dim}}>{maxPackages}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Low stock */}
        {lowParts.length>0&&<div style={{background:C.panel,border:`1px solid ${C.bdr}`,borderRadius:10,padding:16,marginBottom:18}}>
          <div style={{fontSize:12,fontWeight:700,marginBottom:10,display:"flex",alignItems:"center",gap:5}}><Ic d={P.alert} s={13} c={C.amber}/>Low Stock ({lowParts.length})</div>
          {lowParts.slice(0,5).map(p=>(
            <div key={p.id} style={{display:"flex",alignItems:"center",justifyContent:"space-between",padding:"7px 10px",background:C.card,borderRadius:7,marginBottom:5}}>
              <span style={{fontSize:12,fontWeight:600}}>{p.name}</span>
              <div style={{display:"flex",alignItems:"center",gap:8}}>
                <span style={{fontFamily:"'Space Mono'",fontSize:13,fontWeight:700,color:stkC(p)}}>{p.qty}</span>
                <SmBtn c={C.cyan} onClick={()=>setMod({t:"adj",part:p})}>+ Stock</SmBtn>
              </div>
            </div>
          ))}
        </div>}

        {/* Recent log */}
        {db.log.length>0&&<div style={{background:C.panel,border:`1px solid ${C.bdr}`,borderRadius:10,padding:16}}>
          <div style={{fontSize:12,fontWeight:700,marginBottom:10,display:"flex",alignItems:"center",gap:5}}><Ic d={P.clock} s={13} c={C.blue}/>Recent Activity</div>
          {db.log.slice(0,6).map(h=>{const info=lc(h.type);return(
            <div key={h.id} style={{display:"flex",alignItems:"center",gap:8,padding:"6px 0",borderBottom:`1px solid ${C.bdr}`}}>
              <Tag c={info.c} bg={info.bg}>{info.l}</Tag>
              <span style={{fontSize:12,fontWeight:500,flex:1}}>{h.name}</span>
              {h.change!=null&&<span style={{fontSize:12,fontFamily:"'Space Mono'",fontWeight:600,color:h.change>0?C.cyan:C.red}}>{h.change>0?"+":""}{h.change}</span>}
              <span style={{fontSize:10,color:C.dim,whiteSpace:"nowrap"}}>{fmtDate(h.date)}</span>
            </div>
          );})}
        </div>}
      </div>}

      {/* ═══════ ASSEMBLY ═══════ */}
      {view==="build"&&<div className="fi">
        <h1 style={{fontSize:21,fontWeight:800,marginBottom:3}}>Assembly Station</h1>
        <p style={{color:C.sub,fontSize:13,marginBottom:20}}>Build in bulk — parts auto-deducted</p>

        <div style={{display:"flex",gap:10,flexWrap:"wrap",marginBottom:22}}>
          {[
            {l:"Cool Packs",v:db.built.coolpacks||0,c:C.amber,bg:C.amberS,icon:P.snowflake},
            {l:"Handles",v:db.built.handles,c:C.blue,bg:C.blueS,icon:P.wrench},
            {l:"Bases",v:db.built.bases||0,c:C.pink,bg:C.pinkS,icon:P.disc},
            {l:"Narwalls",v:db.built.narwalls,c:C.teal,bg:C.tealS,icon:P.zap},
            {l:"Packages",v:db.built.packages,c:C.cyan,bg:C.cyanS,icon:P.box},
          ].map(s=>(
            <div key={s.l} style={{background:C.panel,border:`1px solid ${C.bdr}`,borderRadius:10,padding:"10px 14px",flex:1,minWidth:90}}>
              <div style={{display:"flex",alignItems:"center",gap:5,marginBottom:3}}>
                <div style={{width:22,height:22,borderRadius:5,background:s.bg,display:"flex",alignItems:"center",justifyContent:"center"}}><Ic d={s.icon} s={11} c={s.c}/></div>
                <span style={{fontSize:9,color:C.sub,fontWeight:700,textTransform:"uppercase",letterSpacing:".04em"}}>{s.l}</span>
              </div>
              <div style={{fontSize:20,fontWeight:800,fontFamily:"'Space Mono'",color:s.c}}>{s.v}</div>
            </div>
          ))}
        </div>

        <div style={{fontSize:11,fontWeight:700,color:C.sub,textTransform:"uppercase",letterSpacing:".06em",marginBottom:10}}>Stage 1 — Sub-Assemblies</div>

        <BuildSection title="Build Cool Packs" sub="Cool Pack Cap + Cool Pack Bottle" color={C.amber} icon={P.snowflake} max={maxCoolPacks} onBuild={buildCoolPacks} parts={[
          {name:"Cool Pack Cap",need:1,have:part("cpc")?.qty||0},
          {name:"Cool Pack Bottle",need:1,have:part("cpb")?.qty||0},
        ]}/>

        <BuildSection title="Build Handles" sub="8 Heat Pipes + Top Cap + Handle Base + Seal Plate + Gasket" color={C.blue} icon={P.wrench} max={maxHandles} onBuild={buildHandles} parts={[
          {name:"Heat Pipe",need:8,have:part("hp")?.qty||0},
          {name:"Handle Top Cap",need:1,have:part("htc")?.qty||0},
          {name:"Handle Base",need:1,have:part("hb")?.qty||0},
          {name:"Seal Plate",need:1,have:part("sp")?.qty||0},
          {name:"Gasket",need:1,have:part("gsk")?.qty||0},
        ]}/>

        <BuildSection title="Build Bases" sub="SS Container + Base Sleeve + Sticker" color={C.pink} icon={P.disc} max={maxBases} onBuild={buildBases} parts={[
          {name:"SS Container",need:1,have:part("ssc")?.qty||0},
          {name:"Base Sleeve",need:1,have:part("bs")?.qty||0},
          {name:"Sticker",need:1,have:part("stk")?.qty||0},
        ]}/>

        <div style={{fontSize:11,fontWeight:700,color:C.sub,textTransform:"uppercase",letterSpacing:".06em",marginBottom:10,marginTop:8}}>Stage 2 — Narwall Assembly</div>

        <BuildSection title="Build Narwalls" sub="1 Handle + 1 Base" color={C.teal} icon={P.zap} max={maxNarwalls} onBuild={buildNarwalls} parts={[
          {name:"Handle (built)",need:1,have:db.built.handles,isBuilt:true},
          {name:"Base (built)",need:1,have:db.built.bases||0,isBuilt:true},
        ]}/>

        <div style={{fontSize:11,fontWeight:700,color:C.sub,textTransform:"uppercase",letterSpacing:".06em",marginBottom:10,marginTop:8}}>Stage 3 — Package & Ship</div>

        <BuildSection title="Build Ship Packages" sub="2 Narwalls + 4 Cool Packs + 2 Foam Covers + 1 Box" color={C.violet} icon={P.pkg} max={maxPackages} onBuild={buildPackages} parts={[
          {name:"Narwall (built)",need:2,have:db.built.narwalls,isBuilt:true},
          {name:"Cool Pack (built)",need:4,have:db.built.coolpacks||0,isBuilt:true},
          {name:"Foam Cover",need:2,have:part("foam")?.qty||0},
          {name:"Shipping Box",need:1,have:part("bx")?.qty||0},
        ]}/>

        <div style={{background:C.panel,border:`1px solid ${C.bdr}`,borderRadius:10,padding:18,marginBottom:16}}>
          <div style={{display:"flex",alignItems:"center",gap:7,marginBottom:6}}>
            <Ic d={P.truck} s={15} c={C.cyan}/><span style={{fontSize:14,fontWeight:700}}>Ship Packages</span>
            <span style={{fontSize:12,color:C.sub,marginLeft:4}}>{db.built.packages} ready</span>
          </div>
          <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
            {[1,5,10,25].map(n=>(<Btn key={n} c={C.cyan} disabled={db.built.packages<n} onClick={()=>shipPackages(n)}>Ship {n}</Btn>))}
          </div>
        </div>
      </div>}

      {/* ═══════ PARTS ═══════ */}
      {view==="parts"&&<div className="fi">
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
          <div><h1 style={{fontSize:21,fontWeight:800,marginBottom:3}}>Parts Inventory</h1><p style={{color:C.sub,fontSize:13}}>{db.parts.length} part types</p></div>
          <Btn c={C.blue} onClick={()=>setMod({t:"part"})}><Ic d={P.plus} s={13}/>Add Part</Btn>
        </div>

        <div style={{marginBottom:14,position:"relative",maxWidth:280}}>
          <div style={{position:"absolute",left:10,top:"50%",transform:"translateY(-50%)"}}><Ic d={P.home} s={13} c={C.dim}/></div>
          <input placeholder="Search parts…" value={srch} onChange={e=>setSrch(e.target.value)}
            style={{width:"100%",padding:"7px 10px 7px 30px",background:C.panel,border:`1px solid ${C.bdr}`,borderRadius:7,color:C.txt,fontSize:13,outline:"none"}}/>
        </div>

        <div style={{background:C.panel,border:`1px solid ${C.bdr}`,borderRadius:10,overflow:"hidden"}}>
          <div style={{overflowX:"auto"}}>
            <table style={{width:"100%",borderCollapse:"collapse"}}>
              <thead><tr>
                {["Part","SKU","Cat","Qty","Adjust","Status",""].map(h=>
                  <th key={h} style={{padding:"9px 10px",textAlign:h===""?"right":"left",fontSize:10,fontWeight:700,color:C.sub,textTransform:"uppercase",letterSpacing:".05em",borderBottom:`1px solid ${C.bdr}`,whiteSpace:"nowrap"}}>{h}</th>
                )}
              </tr></thead>
              <tbody>
                {filteredParts.map(p=>(
                  <tr key={p.id} style={{borderBottom:`1px solid ${C.bdr}`}}>
                    <td style={{padding:"10px",fontSize:13,fontWeight:600}}>{p.name}</td>
                    <td style={{padding:"10px",fontSize:11,fontFamily:"'Space Mono'",color:C.sub}}>{p.sku}</td>
                    <td style={{padding:"10px"}}><Tag c={C.sub} bg={C.raised}>{p.cat}</Tag></td>
                    <td style={{padding:"10px",fontFamily:"'Space Mono'",fontWeight:700,fontSize:14,color:stkC(p)}}>{p.qty}</td>
                    <td style={{padding:"10px"}}>
                      <InlineAdjust onAdjust={(delta)=>adjustStock(p.id,delta,delta>0?`Added ${delta}`:`Removed ${Math.abs(delta)}`)} currentQty={p.qty}/>
                    </td>
                    <td style={{padding:"10px"}}><Tag c={stkC(p)} bg={stkBg(p)}>{stkLabel(p)}</Tag></td>
                    <td style={{padding:"10px",textAlign:"right"}}>
                      <div style={{display:"flex",gap:3,justifyContent:"flex-end"}}>
                        <SmBtn c={C.sub} onClick={()=>setMod({t:"part",data:p})}><Ic d={P.edit} s={11}/></SmBtn>
                        <SmBtn c={C.red} onClick={()=>setMod({t:"delPart",id:p.id,name:p.name})}><Ic d={P.trash} s={11}/></SmBtn>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>}

      {/* ═══════ HISTORY ═══════ */}
      {view==="log"&&<div className="fi">
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
          <div><h1 style={{fontSize:21,fontWeight:800,marginBottom:3}}>History</h1><p style={{color:C.sub,fontSize:13}}>{db.log.length} events</p></div>
          {db.log.length>0&&<SmBtn c={C.red} onClick={()=>save(d=>({...d,log:[]}))}>Clear</SmBtn>}
        </div>
        {db.log.length===0?<EmptyMsg icon={P.clock} msg="No activity yet"/>:
        <div style={{background:C.panel,border:`1px solid ${C.bdr}`,borderRadius:10,overflow:"hidden"}}>
          {db.log.map((h,i)=>{const info=lc(h.type);return(
            <div key={h.id} style={{display:"flex",alignItems:"center",gap:10,padding:"11px 16px",borderBottom:i<db.log.length-1?`1px solid ${C.bdr}`:"none"}}>
              <Tag c={info.c} bg={info.bg}>{info.l}</Tag>
              <div style={{flex:1,minWidth:0}}>
                <span style={{fontSize:12,fontWeight:600}}>{h.name}</span>
                {h.note&&<span style={{fontSize:11,color:C.sub,marginLeft:6}}>— {h.note}</span>}
              </div>
              {h.change!=null&&<span style={{fontSize:12,fontFamily:"'Space Mono'",fontWeight:700,color:h.change>0?C.cyan:C.red}}>{h.change>0?"+":""}{h.change}</span>}
              <span style={{fontSize:10,color:C.dim,whiteSpace:"nowrap"}}>{fmtDate(h.date)}</span>
            </div>
          );})}
        </div>}
      </div>}

      {/* ═══════ ALERTS ═══════ */}
      {view==="alerts"&&<div className="fi">
        <h1 style={{fontSize:21,fontWeight:800,marginBottom:3}}>Low Stock Alerts</h1>
        <p style={{color:C.sub,fontSize:13,marginBottom:16}}>{lowParts.length} part{lowParts.length!==1?"s":""} below threshold</p>
        {lowParts.length===0?<EmptyMsg icon={P.check} msg="All stocked up!"/>:
        <div style={{display:"flex",flexDirection:"column",gap:10}}>
          {lowParts.map(p=>{
            const pct=p.low>0?Math.min(100,(p.qty/p.low)*100):0;
            return <div key={p.id} style={{background:C.panel,border:`1px solid ${C.bdr}`,borderRadius:10,padding:16}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:10}}>
                <div><span style={{fontSize:14,fontWeight:700}}>{p.name}</span><span style={{fontSize:11,color:C.dim,marginLeft:7}}>{p.sku}</span></div>
                <Tag c={stkC(p)} bg={stkBg(p)}>{stkLabel(p)}</Tag>
              </div>
              <div style={{display:"flex",alignItems:"center",gap:12}}>
                <div style={{flex:1}}>
                  <div style={{display:"flex",justifyContent:"space-between",fontSize:11,marginBottom:4}}>
                    <span style={{color:C.sub}}>Current: <b style={{color:stkC(p)}}>{p.qty}</b></span>
                    <span style={{color:C.dim}}>Threshold: {p.low}</span>
                  </div>
                  <div style={{height:4,background:C.bg,borderRadius:2,overflow:"hidden"}}>
                    <div style={{height:"100%",width:`${pct}%`,background:stkC(p),borderRadius:2}}/>
                  </div>
                </div>
                <Btn c={C.cyan} onClick={()=>setMod({t:"adj",part:p})}><Ic d={P.up} s={13}/>Restock</Btn>
              </div>
            </div>;
          })}
        </div>}
      </div>}

      </main>

      {/* ═══ MODALS ═══ */}

      {mod?.t==="adj"&&<Overlay onClose={()=>setMod(null)}>
        <ModalBox title={`Adjust — ${mod.part.name}`} onClose={()=>setMod(null)} w={400}>
          <AdjustForm current={mod.part.qty} color={stkC(mod.part)} onDone={(delta,note)=>{adjustStock(mod.part.id,delta,note);setMod(null);}}/>
        </ModalBox>
      </Overlay>}

      {mod?.t==="part"&&<Overlay onClose={()=>setMod(null)}>
        <ModalBox title={mod.data?"Edit Part":"Add Part"} onClose={()=>setMod(null)} w={500}>
          <PartForm data={mod.data} onSave={savePart} onClose={()=>setMod(null)}/>
        </ModalBox>
      </Overlay>}

      {mod?.t==="delPart"&&<Overlay onClose={()=>setMod(null)}>
        <ModalBox title="Delete Part?" onClose={()=>setMod(null)} w={360}>
          <p style={{fontSize:13,color:C.sub,marginBottom:16}}>Delete <b style={{color:C.txt}}>{mod.name}</b>? Cannot undo.</p>
          <div style={{display:"flex",gap:8}}>
            <Btn c={C.sub} onClick={()=>setMod(null)} style={{flex:1}}>Cancel</Btn>
            <Btn c={C.red} onClick={()=>deletePart(mod.id)} style={{flex:1}}>Delete</Btn>
          </div>
        </ModalBox>
      </Overlay>}

      {mod?.t==="reset"&&<Overlay onClose={()=>setMod(null)}>
        <ModalBox title="Reset All Data?" onClose={()=>setMod(null)} w={360}>
          <p style={{fontSize:13,color:C.sub,marginBottom:16}}>This resets all parts, assemblies, and history. Cannot undo.</p>
          <div style={{display:"flex",gap:8}}>
            <Btn c={C.sub} onClick={()=>setMod(null)} style={{flex:1}}>Cancel</Btn>
            <Btn c={C.red} onClick={()=>{save(()=>INIT());setMod(null);}} style={{flex:1}}>Reset</Btn>
          </div>
        </ModalBox>
      </Overlay>}

    </div>
  );
}

// ════════════════════════════════════════════════════════════════
// SUB-COMPONENTS
// ════════════════════════════════════════════════════════════════

function Btn({children,c=C.blue,onClick,disabled,style}){
  return <button onClick={onClick} disabled={disabled} style={{display:"inline-flex",alignItems:"center",gap:5,padding:"7px 14px",border:"none",borderRadius:7,cursor:disabled?"not-allowed":"pointer",background:`${c}18`,color:c,fontSize:12,fontWeight:700,transition:"all .12s",opacity:disabled?.4:1,whiteSpace:"nowrap",...style}}>{children}</button>;
}
function SmBtn({children,c=C.sub,onClick,style}){
  return <button onClick={onClick} style={{display:"inline-flex",alignItems:"center",gap:4,padding:"4px 8px",border:"none",borderRadius:5,cursor:"pointer",background:"transparent",color:c,fontSize:11,fontWeight:600,transition:"all .1s",...style}}>{children}</button>;
}
function Tag({children,c,bg}){
  return <span style={{display:"inline-flex",alignItems:"center",padding:"2px 8px",borderRadius:5,fontSize:10,fontWeight:700,background:bg,color:c,letterSpacing:".03em",whiteSpace:"nowrap"}}>{children}</span>;
}
function EmptyMsg({icon,msg}){
  return <div style={{display:"flex",flexDirection:"column",alignItems:"center",padding:"40px 20px",color:C.dim}}>
    <Ic d={icon} s={32} c={C.dim}/><div style={{marginTop:10,fontSize:14,fontWeight:600,color:C.sub}}>{msg}</div>
  </div>;
}
function Overlay({children,onClose}){
  return <div style={{position:"fixed",inset:0,zIndex:1000,display:"flex",alignItems:"center",justifyContent:"center",background:"rgba(0,0,0,.6)",backdropFilter:"blur(4px)"}} onClick={onClose}>{children}</div>;
}
function ModalBox({title,onClose,w=480,children}){
  return <div className="fi" onClick={e=>e.stopPropagation()} style={{background:C.panel,border:`1px solid ${C.bdr}`,borderRadius:14,width:w,maxWidth:"95vw",maxHeight:"90vh",overflow:"auto",padding:22}}>
    <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:16}}>
      <h3 style={{fontSize:16,fontWeight:700}}>{title}</h3>
      <SmBtn c={C.sub} onClick={onClose}><Ic d={P.x} s={14}/></SmBtn>
    </div>
    {children}
  </div>;
}
function Inp({label,...p}){
  return <div style={{display:"flex",flexDirection:"column",gap:3}}>
    {label&&<label style={{fontSize:10,fontWeight:700,color:C.sub,textTransform:"uppercase",letterSpacing:".06em"}}>{label}</label>}
    <input {...p} style={{padding:"7px 10px",background:C.bg,border:`1px solid ${C.bdr}`,borderRadius:7,color:C.txt,fontSize:13,outline:"none",...(p.style||{})}}/>
  </div>;
}
function Sel({label,options,...p}){
  return <div style={{display:"flex",flexDirection:"column",gap:3}}>
    {label&&<label style={{fontSize:10,fontWeight:700,color:C.sub,textTransform:"uppercase",letterSpacing:".06em"}}>{label}</label>}
    <select {...p} style={{padding:"7px 10px",background:C.bg,border:`1px solid ${C.bdr}`,borderRadius:7,color:C.txt,fontSize:13,outline:"none",...(p.style||{})}}>
      {options.map(o=><option key={o.v} value={o.v}>{o.l}</option>)}
    </select>
  </div>;
}

// ── Build Section (reusable for each assembly stage) ──────────
function BuildSection({title, sub, color, icon, max, onBuild, parts}){
  const [qty, setQty] = useState("");
  const q = parseInt(qty)||0;

  const handleBuild = () => {
    if(q>=1 && q<=max){ onBuild(q); setQty(""); }
  };

  return (
    <div style={{background:C.panel,border:`1px solid ${C.bdr}`,borderRadius:10,padding:18,marginBottom:16}}>
      <div style={{display:"flex",alignItems:"center",gap:7,marginBottom:4}}>
        <Ic d={icon} s={15} c={color}/>
        <span style={{fontSize:14,fontWeight:700}}>{title}</span>
        <span style={{fontSize:12,color:C.dim,marginLeft:4}}>max: {max}</span>
      </div>
      <p style={{fontSize:11,color:C.sub,marginBottom:14}}>{sub}</p>

      {/* Parts needed */}
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(140px,1fr))",gap:8,marginBottom:14}}>
        {parts.map(p=>{
          const ok = p.have >= p.need;
          return <div key={p.name} style={{background:C.card,borderRadius:7,padding:"8px 10px",border:`1px solid ${ok?C.bdr:`${C.red}40`}`}}>
            <div style={{fontSize:11,fontWeight:600,marginBottom:3,lineHeight:1.3}}>{p.name}</div>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <span style={{fontSize:10,color:C.dim}}>×{p.need}/ea</span>
              <span style={{fontSize:13,fontFamily:"'Space Mono'",fontWeight:700,color:ok?C.cyan:C.red}}>{p.have}</span>
            </div>
          </div>;
        })}
      </div>

      {/* Quantity input + presets */}
      <div style={{display:"flex",gap:8,alignItems:"end",flexWrap:"wrap"}}>
        <Inp label="Qty" type="number" min="1" value={qty} onChange={e=>setQty(e.target.value)} style={{width:80}} placeholder="0"/>
        <div style={{display:"flex",gap:4}}>
          {PRESETS.map(n=>(
            <button key={n} onClick={()=>setQty(String(n))} disabled={n>max}
              style={{padding:"6px 10px",border:`1px solid ${C.bdr}`,borderRadius:6,background:parseInt(qty)===n?`${color}20`:C.card,color:parseInt(qty)===n?color:C.sub,fontSize:11,fontWeight:700,cursor:n>max?"not-allowed":"pointer",opacity:n>max?.3:1,transition:"all .1s"}}>
              {n}
            </button>
          ))}
        </div>
        <Btn c={color} disabled={q<1||q>max} onClick={handleBuild}>Build {q||0}</Btn>
      </div>
    </div>
  );
}

// ── Adjust Stock Form ─────────────────────────────────────────
function AdjustForm({current,color,onDone}){
  const [qty,setQty]=useState("");
  const [note,setNote]=useState("");
  const q=parseInt(qty)||0;
  return <>
    <div style={{textAlign:"center",padding:12,background:C.card,borderRadius:8,marginBottom:14}}>
      <div style={{fontSize:9,color:C.dim,fontWeight:700,letterSpacing:".08em",marginBottom:2}}>CURRENT STOCK</div>
      <div style={{fontSize:30,fontWeight:800,fontFamily:"'Space Mono'",color}}>{current}</div>
    </div>
    <Inp label="Quantity" type="number" min="1" value={qty} onChange={e=>setQty(e.target.value)} placeholder="Amount"/>
    <div style={{display:"flex",gap:4,marginTop:8}}>
      {PRESETS.map(n=>(
        <button key={n} onClick={()=>setQty(String(n))}
          style={{padding:"5px 10px",border:`1px solid ${C.bdr}`,borderRadius:6,background:parseInt(qty)===n?C.blueS:C.card,color:parseInt(qty)===n?C.blue:C.sub,fontSize:11,fontWeight:700,cursor:"pointer",transition:"all .1s"}}>
          {n}
        </button>
      ))}
    </div>
    <div style={{marginTop:10}}><Inp label="Note (optional)" value={note} onChange={e=>setNote(e.target.value)} placeholder="e.g. Received shipment"/></div>
    <div style={{display:"flex",gap:8,marginTop:16}}>
      <Btn c={C.cyan} onClick={()=>q>0&&onDone(q,note||"Restocked")} disabled={q<1} style={{flex:1}}><Ic d={P.up} s={13}/>Add</Btn>
      <Btn c={C.red} onClick={()=>q>0&&onDone(-q,note||"Removed")} disabled={q<1} style={{flex:1}}><Ic d={P.down} s={13}/>Remove</Btn>
    </div>
  </>;
}

// ── Part Form ─────────────────────────────────────────────────
function PartForm({data:d,onSave,onClose}){
  const [f,sF]=useState({
    name:d?.name||"",sku:d?.sku||`NW-${Math.random().toString(36).slice(2,6).toUpperCase()}`,
    cat:d?.cat||"Component",qty:d?.qty??0,low:d?.low??10,cost:d?.cost??0,note:d?.note||""
  });
  const u=(k,v)=>sF(p=>({...p,[k]:v}));
  return <>
    <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10}}>
      <div style={{gridColumn:"1/-1"}}><Inp label="Name" value={f.name} onChange={e=>u("name",e.target.value)} placeholder="e.g. Heat Pipe"/></div>
      <Inp label="SKU" value={f.sku} onChange={e=>u("sku",e.target.value)}/>
      <Sel label="Category" value={f.cat} onChange={e=>u("cat",e.target.value)} options={["Component","Accessory","Packaging","Hardware","Other"].map(c=>({v:c,l:c}))}/>
      <Inp label="Quantity" type="number" min="0" value={f.qty} onChange={e=>u("qty",parseInt(e.target.value)||0)}/>
      <Inp label="Low Stock" type="number" min="0" value={f.low} onChange={e=>u("low",parseInt(e.target.value)||0)}/>
      <Inp label="Cost ($)" type="number" min="0" step=".01" value={f.cost} onChange={e=>u("cost",parseFloat(e.target.value)||0)}/>
      <div><Inp label="Notes" value={f.note} onChange={e=>u("note",e.target.value)}/></div>
    </div>
    <div style={{display:"flex",gap:8,marginTop:16,justifyContent:"flex-end"}}>
      <Btn c={C.sub} onClick={onClose}>Cancel</Btn>
      <Btn c={C.blue} disabled={!f.name} onClick={()=>onSave(f,d?.id)}>{d?"Save":"Add Part"}</Btn>
    </div>
  </>;
}

// ── Inline Adjust (simple +/- with input) ─────────────────────
function InlineAdjust({onAdjust, currentQty}){
  const [val, setVal] = useState("");
  const v = parseInt(val)||0;
  return (
    <div style={{display:"flex",alignItems:"center",gap:0}}>
      <button onClick={()=>{if(v>0 && currentQty>=v){onAdjust(-v);setVal("");}}}
        disabled={v<1||currentQty<v}
        style={{width:28,height:28,border:`1px solid ${C.bdr}`,borderRadius:"6px 0 0 6px",background:C.card,color:v>0&&currentQty>=v?C.red:C.dim,fontSize:14,fontWeight:800,cursor:v>0&&currentQty>=v?"pointer":"not-allowed",display:"flex",alignItems:"center",justifyContent:"center",opacity:v>0&&currentQty>=v?1:.4}}>−</button>
      <input type="number" min="1" value={val} onChange={e=>setVal(e.target.value)} placeholder="0"
        style={{width:52,height:28,border:`1px solid ${C.bdr}`,borderLeft:"none",borderRight:"none",background:C.bg,color:C.txt,fontSize:12,fontFamily:"'Space Mono'",textAlign:"center",outline:"none"}}/>
      <button onClick={()=>{if(v>0){onAdjust(v);setVal("");}}}
        disabled={v<1}
        style={{width:28,height:28,border:`1px solid ${C.bdr}`,borderRadius:"0 6px 6px 0",background:C.card,color:v>0?C.cyan:C.dim,fontSize:14,fontWeight:800,cursor:v>0?"pointer":"not-allowed",display:"flex",alignItems:"center",justifyContent:"center",opacity:v>0?1:.4}}>+</button>
    </div>
  );
}
