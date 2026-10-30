"use client";
import { useState } from "react";

type Routine = {id:string;title:string;trigger:string;action:string;status:"active"|"paused"|"failed";lastRun?:string;nextRun?:string;runCount:number;failCount:number;cost:number};
const MOCK: Routine[] = [
  {id:"r1",title:"Daily briefing 08:00",trigger:"cron 0 8 * * * (Asia/Bangkok)",action:"Summarize unread emails + today calendar → chat",status:"active",lastRun:"2026-10-31 08:00",nextRun:"2026-11-01 08:00",runCount:42,failCount:1,cost:0.12},
  {id:"r2",title:"New email from boss → notify",trigger:"event gmail.new (from: boss@)",action:"Push + create Task if action needed",status:"active",lastRun:"2026-10-30 16:20",nextRun:"— (event)",runCount:18,failCount:0,cost:0.08},
  {id:"r3",title:"Weekly report Monday 09:00",trigger:"cron 0 9 * * 1",action:"Generate weekly summary doc from Drive",status:"paused",lastRun:"2026-10-27 09:00",nextRun:"2026-11-03 09:00",runCount:9,failCount:0,cost:0.20},
  {id:"r4",title:"Slack #deals → log to sheet",trigger:"event slack.message (#deals)",action:"Append to /Cloud Drive/deals_log.xlsx",status:"failed",lastRun:"2026-10-31 10:12",nextRun:"retry in 5m",runCount:31,failCount:4,cost:0.05},
];

export default function RoutinesPage(){
  const [open,setOpen]=useState(false);
  const [form,setForm]=useState({title:"",type:"cron",expr:"0 8 * * *",action:""});
  const [list,setList]=useState<Routine[]>(MOCK);
  const toggle = (id:string)=> setList(l=>l.map(r=> r.id===id ? {...r, status: r.status==="active"?"paused":"active"} as Routine : r));
  return (
    <div style={{fontFamily:"system-ui",maxWidth:1180,margin:"0 auto",padding:"24px 20px"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:12}}>
        <div>
          <h1 style={{margin:0,fontSize:22}}>Routines</h1>
          <p style={{margin:"4px 0 0",color:"#6b7280",fontSize:13}}>Cron / Event triggers • lastRun / nextRun • success/fail + cost ต่อรัน • ทำงานบน Cloud Teammate</p>
        </div>
        <button onClick={()=>setOpen(true)} style={{background:"#0d0d0d",color:"#fff",borderRadius:10,padding:"8px 14px",border:"none",fontWeight:700,cursor:"pointer",fontSize:13}}>+ Create Routine</button>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))",gap:12,marginTop:14}}>
        {[
          {k:"Active",v:list.filter(r=>r.status==="active").length},
          {k:"Paused",v:list.filter(r=>r.status==="paused").length},
          {k:"Failed need attention",v:list.filter(r=>r.status==="failed").length},
          {k:"Total cost (30d)",v:"$"+list.reduce((s,r)=>s+r.cost,0).toFixed(2)},
        ].map(s=>(
          <div key={s.k} style={{border:"1px solid #e5e7eb",borderRadius:12,padding:12,background:"#fff"}}>
            <div style={{fontSize:11,color:"#6b7280"}}>{s.k}</div><div style={{fontSize:20,fontWeight:700,marginTop:4}}>{s.v}</div>
          </div>
        ))}
      </div>

      <div style={{marginTop:14,border:"1px solid #e5e7eb",borderRadius:14,overflow:"hidden"}}>
        <div style={{overflowX:"auto"}}>
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
            <thead><tr style={{background:"#f9fafb",textAlign:"left",color:"#6b7280",fontSize:11}}>
              <th style={{padding:"10px 12px"}}>ROUTINE</th><th style={{padding:10}}>TRIGGER</th><th style={{padding:10}}>STATUS</th><th style={{padding:10}}>LAST RUN</th><th style={{padding:10}}>NEXT RUN</th><th style={{padding:10}}>RUNS</th><th style={{padding:10}}>COST</th><th style={{padding:10}}></th>
            </tr></thead>
            <tbody>
              {list.map(r=>(
                <tr key={r.id} style={{borderTop:"1px solid #f3f4f6",background:r.status==="failed"?"#fef2f2":"#fff"}}>
                  <td style={{padding:"10px 12px",minWidth:240}}>
                    <div style={{fontWeight:600}}>{r.title}</div>
                    <div style={{fontSize:11,color:"#6b7280"}}>{r.action}</div>
                  </td>
                  <td style={{padding:10}}><code style={{background:"#f3f4f6",padding:"2px 6px",borderRadius:6,fontSize:11}}>{r.trigger}</code></td>
                  <td style={{padding:10}}><span style={{fontSize:11,padding:"3px 8px",borderRadius:999,background:r.status==="active"?"#dcfce7":r.status==="paused"?"#f3f4f6":"#fee2e2",color:r.status==="active"?"#166534":r.status==="paused"?"#52525b":"#991b1b",border:"1px solid #e5e7eb"}}>{r.status}</span></td>
                  <td style={{padding:10,fontSize:12,whiteSpace:"nowrap"}}>{r.lastRun ?? "—"}<div style={{fontSize:11,color:r.failCount? "#dc2626":"#6b7280"}}>{r.failCount? r.failCount+" fails":""}</div></td>
                  <td style={{padding:10,fontSize:12,whiteSpace:"nowrap"}}>{r.nextRun ?? "—"}</td>
                  <td style={{padding:10,fontSize:12}}>{r.runCount} <span style={{color:"#16a34a"}}>✓ {r.runCount - r.failCount}</span> <span style={{color:"#dc2626"}}>✗ {r.failCount}</span></td>
                  <td style={{padding:10,fontSize:12}}>${r.cost.toFixed(2)}/run</td>
                  <td style={{padding:10}}>
                    <div style={{display:"flex",gap:6}}>
                      <button onClick={()=>toggle(r.id)} style={{border:"1px solid #e5e7eb",background:"#fff",borderRadius:8,padding:"5px 8px",fontSize:11,cursor:"pointer"}}>{r.status==="active"?"Pause":"Resume"}</button>
                      <button onClick={()=>alert("Run now: "+r.title)} style={{background:"#0d0d0d",color:"#fff",borderRadius:8,padding:"5px 8px",border:"none",fontSize:11,cursor:"pointer"}}>Run now</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{padding:"10px 12px",background:"#f9fafb",borderTop:"1px solid #e5e7eb",fontSize:11,color:"#6b7280"}}>Tip: Event routines ทำงานทันทีเมื่อ Gmail/Calendar/Slack มีเหตุการณ์ • Cron ใช้ timezone Asia/Bangkok • ล้มเหลว 3 ครั้งติดจะ pause อัตโนมัติ</div>
      </div>

      <div style={{marginTop:14,border:"1px solid #e5e7eb",borderRadius:12,padding:12,background:"#fff9db"}}>
        <div style={{fontWeight:600,fontSize:13}}>Quota: Routines per plan</div>
        <div style={{fontSize:12,color:"#6b7280",marginTop:4}}>Free 3 • Starter 20 • Pro 100 — นับเฉพาะ active + paused (failed ไม่นับ)</div>
      </div>

      {open && (
        <div onClick={()=>setOpen(false)} style={{position:"fixed",inset:0,background:"rgba(0,0,0,.45)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:50,padding:20}}>
          <div onClick={e=>e.stopPropagation()} style={{background:"#fff",borderRadius:14,width:"min(560px,100%)",padding:18}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <h3 style={{margin:0}}>Create Routine</h3>
              <button onClick={()=>setOpen(false)} style={{border:"1px solid #e5e7eb",background:"#fff",borderRadius:8,padding:"6px 10px",cursor:"pointer"}}>Close</button>
            </div>
            <div style={{display:"grid",gap:12,marginTop:14}}>
              <label style={{fontSize:12}}>Title<input value={form.title} onChange={e=>setForm({...form,title:e.target.value})} placeholder="เช่น Daily briefing 08:00" style={{width:"100%",marginTop:4,border:"1px solid #e5e7eb",borderRadius:8,padding:"8px 10px"}}/></label>
              <div style={{display:"flex",gap:8}}>
                <label style={{fontSize:12,flex:1}}>Type<select value={form.type} onChange={e=>setForm({...form,type:e.target.value})} style={{width:"100%",marginTop:4,border:"1px solid #e5e7eb",borderRadius:8,padding:"8px 10px"}}><option value="cron">Cron</option><option value="event">Event</option></select></label>
                <label style={{fontSize:12,flex:2}}>{form.type==="cron"?"Cron expr":"Event"}<input value={form.expr} onChange={e=>setForm({...form,expr:e.target.value})} placeholder={form.type==="cron"?"0 8 * * *":"gmail.new / calendar.create"} style={{width:"100%",marginTop:4,border:"1px solid #e5e7eb",borderRadius:8,padding:"8px 10px"}}/></label>
              </div>
              <label style={{fontSize:12}}>Action (what Teammate does)<textarea value={form.action} onChange={e=>setForm({...form,action:e.target.value})} placeholder="Summarize + create Task if needed" rows={3} style={{width:"100%",marginTop:4,border:"1px solid #e5e7eb",borderRadius:8,padding:"8px 10px"}}/></label>
              <div style={{fontSize:11,color:"#6b7280"}}>Cron timezone = Asia/Bangkok • Event รองรับ: gmail.new, calendar.create/update, slack.message, drive.change</div>
              <button onClick={()=>{
                if(!form.title) return alert("ใส่ title ก่อน");
                setList(l=>[...l,{id:"r"+(l.length+1),title:form.title,trigger:form.type+" "+form.expr,action:form.action||"—",status:"active",lastRun:undefined,nextRun:form.type==="cron"?"next tick":"— (event)",runCount:0,failCount:0,cost:0.1}]);
                setOpen(false);
              }} style={{background:"#0d0d0d",color:"#fff",borderRadius:10,padding:"10px 14px",border:"none",fontWeight:700,cursor:"pointer"}}>Create</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
