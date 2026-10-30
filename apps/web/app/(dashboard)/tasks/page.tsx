"use client";
import { useState } from "react";

type Status = "queued"|"planning"|"in_progress"|"waiting_for_user"|"paused"|"reviewing"|"completed"|"partially_completed"|"failed"|"cancelled";
const STATUSES: {key:Status,label:string,color:string,dot:string}[] = [
  {key:"queued",label:"Queued",color:"#6b7280",dot:"\u25CB"},
  {key:"planning",label:"Planning",color:"#6366f1",dot:"\u25CE"},
  {key:"in_progress",label:"In Progress",color:"#2563eb",dot:"\u25CF"},
  {key:"waiting_for_user",label:"Waiting for User",color:"#f59e0b",dot:"\u25D1"},
  {key:"paused",label:"Paused",color:"#9ca3af",dot:"\u25A0"},
  {key:"reviewing",label:"Reviewing",color:"#a855f7",dot:"\u25C6"},
  {key:"completed",label:"Completed",color:"#16a34a",dot:"\u2713"},
  {key:"partially_completed",label:"Partially Completed",color:"#65a30d",dot:"\u25D0"},
  {key:"failed",label:"Failed",color:"#dc2626",dot:"\u2717"},
  {key:"cancelled",label:"Cancelled",color:"#52525b",dot:"\u2014"},
];

type Task = {
  id:string; title:string; goal:string; product:"teammate"|"work"; workKind?:string;
  status:Status; executionMode:"cloud"|"local"; traceId:string; progress:number;
  createdAt:string; estimate?:{cost:number;minutes:number}; deliverables?:string[];
};

const MOCK: Task[] = [
  {id:"tsk_001",title:"Landing page for Q4 campaign",goal:"Build responsive landing with pricing table + Thai copy",product:"work",workKind:"coding",status:"in_progress",executionMode:"cloud",traceId:"trc-9f3a2c-001",progress:62,createdAt:"2026-10-30 14:20",estimate:{cost:2.4,minutes:18},deliverables:["landing.zip","preview"]},
  {id:"tsk_002",title:"สรุปงบ Q3 → สไลด์บอร์ด",goal:"แปลงไฟล์ Excel 3 ชีตเป็นสไลด์ 12 หน้า",product:"work",workKind:"doc",status:"reviewing",executionMode:"cloud",traceId:"trc-9f3a2c-002",progress:95,createdAt:"2026-10-30 10:05",estimate:{cost:0.8,minutes:10},deliverables:["Q3_Deck.pptx"]},
  {id:"tsk_003",title:"Daily briefing setup",goal:"สรุปเมล + calendar ทุก 08:00",product:"teammate",status:"completed",executionMode:"cloud",traceId:"trc-9f3a2c-003",progress:100,createdAt:"2026-10-29 08:00",deliverables:[]},
  {id:"tsk_004",title:"Research: คู่แข่งประกันชีวิต",goal:"เทียบ 5 บริษัท สรุปตาราง + insight",product:"work",workKind:"research",status:"planning",executionMode:"cloud",traceId:"trc-9f3a2c-004",progress:12,createdAt:"2026-10-31 09:10",estimate:{cost:1.2,minutes:12},deliverables:[]},
  {id:"tsk_005",title:"วิดีโอรีวิวสินค้า 30s",goal:"ตัดต่อคลิป UGC → 3 aspect ratios + subs",product:"work",workKind:"video_gen",status:"queued",executionMode:"cloud",traceId:"trc-9f3a2c-005",progress:0,createdAt:"2026-10-31 11:00",estimate:{cost:8.5,minutes:25},deliverables:[]},
  {id:"tsk_006",title:"รอ approve โลโก้",goal:"ลูกค้ายืนยันเวอร์ชันสุดท้าย",product:"work",workKind:"doc",status:"waiting_for_user",executionMode:"cloud",traceId:"trc-9f3a2c-006",progress:70,createdAt:"2026-10-29 16:40",estimate:{cost:0.8,minutes:10},deliverables:["logo_v2.pdf"]},
  {id:"tsk_007",title:"Fix checkout bug",goal:"แก้บั๊กคูปองซ้อน + เพิ่มเทสต์",product:"work",workKind:"coding",status:"failed",executionMode:"local",traceId:"trc-9f3a2c-007",progress:88,createdAt:"2026-10-28 13:15",estimate:{cost:2.4,minutes:18},deliverables:[]},
  {id:"tsk_008",title:"Q&A bot knowledge update",goal:"อัปเดต FAQ จากไฟล์ใหม่",product:"teammate",status:"paused",executionMode:"cloud",traceId:"trc-9f3a2c-008",progress:34,createdAt:"2026-10-30 19:00",deliverables:[]},
  {id:"tsk_009",title:"Monthly report — partially done",goal:"สรุปยอดขาย ต.ค. ขาดข้อมูลสาขาเหนือ",product:"work",workKind:"doc",status:"partially_completed",executionMode:"cloud",traceId:"trc-9f3a2c-009",progress:82,createdAt:"2026-10-27 09:00",estimate:{cost:0.8,minutes:10},deliverables:["report_oct_partial.pdf"]},
  {id:"tsk_010",title:"Old campaign cleanup",goal:"ลบไฟล์เก่า + archive",product:"teammate",status:"cancelled",executionMode:"cloud",traceId:"trc-9f3a2c-010",progress:0,createdAt:"2026-10-26 11:30",deliverables:[]},
];

function StatusBadge({s}:{s:Status}){
  const m = STATUSES.find(x=>x.key===s)!;
  return <span style={{display:"inline-flex",alignItems:"center",gap:6,background:m.color+"14",color:m.color,border:`1px solid ${m.color}30`,padding:"3px 8px",borderRadius:999,fontSize:11,fontWeight:600}}><span>{m.dot}</span>{m.label}</span>;
}
function ProductPill({p}:{p:"teammate"|"work"}){
  return <span style={{fontSize:10,fontWeight:700,letterSpacing:.6,padding:"2px 6px",borderRadius:6,background:p==="work"?"#0d0d0d":"#eff6ff",color:p==="work"?"#fff":"#1d4ed8"}}>{p==="work"?"WORK":"TEAMMATE"}</span>;
}

export default function TasksPage(){
  const [filter,setFilter]=useState<Status|"all">("all");
  const [product,setProduct]=useState<"all"|"teammate"|"work">("all");
  const [q,setQ]=useState("");
  const [selected,setSelected]=useState<Task|null>(null);
  const filtered = MOCK.filter(t=>
    (filter==="all"||t.status===filter) &&
    (product==="all"||t.product===product) &&
    (!q || (t.title+" "+t.goal+" "+t.traceId).toLowerCase().includes(q.toLowerCase()))
  );
  const counts = Object.fromEntries(STATUSES.map(s=>[s.key,MOCK.filter(t=>t.status===s.key).length]));

  return (
    <div style={{fontFamily:"system-ui",maxWidth:1180,margin:"0 auto",padding:"24px 20px"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:12}}>
        <div>
          <h1 style={{margin:0,fontSize:22}}>Tasks — Teammate + Work</h1>
          <p style={{margin:"4px 0 0",color:"#6b7280",fontSize:13}}>Unified board • 10 statuses • traceId เชื่อม Teammate → Work อัตโนมัติ • Handoff packet ครบ</p>
        </div>
        <div style={{display:"flex",gap:8}}>
          <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search title / goal / traceId" style={{border:"1px solid #e5e7eb",borderRadius:10,padding:"8px 12px",minWidth:240,fontSize:13}}/>
          <button onClick={()=>alert("New task → Teammate chat or Work estimate")} style={{background:"#0d0d0d",color:"#fff",borderRadius:10,padding:"8px 14px",border:"none",fontWeight:600,cursor:"pointer"}}>+ New Task</button>
        </div>
      </div>

      {/* Status filter chips */}
      <div style={{display:"flex",gap:6,flexWrap:"wrap",marginTop:16}}>
        <button onClick={()=>setFilter("all")} style={{padding:"6px 10px",borderRadius:999,border:filter==="all"?"1px solid #0d0d0d":"1px solid #e5e7eb",background:filter==="all"?"#0d0d0d":"#fff",color:filter==="all"?"#fff":"#374151",fontSize:12,fontWeight:600,cursor:"pointer"}}>All ({MOCK.length})</button>
        {STATUSES.map(s=>(
          <button key={s.key} onClick={()=>setFilter(s.key)} style={{padding:"6px 10px",borderRadius:999,border:filter===s.key?`1px solid ${s.color}`:"1px solid #e5e7eb",background:filter===s.key?s.color+"14":"#fff",color:filter===s.key?s.color:"#374151",fontSize:12,cursor:"pointer"}}>{s.label} ({(counts as any)[s.key]})</button>
        ))}
      </div>

      <div style={{display:"flex",gap:8,marginTop:12}}>
        {(["all","teammate","work"] as const).map(p=>(
          <button key={p} onClick={()=>setProduct(p)} style={{padding:"6px 10px",borderRadius:8,border:product===p?"1px solid #0d0d0d":"1px solid #e5e7eb",background:product===p?"#f9fafb":"#fff",fontSize:12,fontWeight:600,cursor:"pointer"}}>{p==="all"?"All products":p==="teammate"?"Teammate only":"Work only"}</button>
        ))}
        <span style={{alignSelf:"center",color:"#9ca3af",fontSize:12,marginLeft:8}}>Tip: traceId เดียวกันผูก Teammate chat → Work execution → deliverables</span>
      </div>

      {/* Table */}
      <div style={{marginTop:16,border:"1px solid #e5e7eb",borderRadius:14,overflow:"hidden"}}>
        <div style={{overflowX:"auto"}}>
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
            <thead><tr style={{background:"#f9fafb",textAlign:"left",color:"#6b7280",fontSize:11,letterSpacing:.5}}>
              <th style={{padding:"10px 12px"}}>TASK</th><th style={{padding:10}}>STATUS</th><th style={{padding:10}}>PRODUCT</th><th style={{padding:10}}>PROGRESS</th><th style={{padding:10}}>TRACE ID</th><th style={{padding:10}}>MODE</th><th style={{padding:10}}>CREATED</th><th style={{padding:10}}></th>
            </tr></thead>
            <tbody>
              {filtered.map(t=>(
                <tr key={t.id} style={{borderTop:"1px solid #f3f4f6"}}>
                  <td style={{padding:"10px 12px",minWidth:260}}>
                    <div style={{fontWeight:600}}>{t.title}</div>
                    <div style={{color:"#6b7280",fontSize:12,whiteSpace:"nowrap",overflow:"hidden",textOverflow:"ellipsis",maxWidth:360}}>{t.goal}</div>
                    {(t.estimate || t.deliverables?.length) && <div style={{fontSize:11,color:"#6b7280",marginTop:2}}>{t.estimate?`$${t.estimate.cost} • ${t.estimate.minutes}min • `:""}{t.deliverables?.length?("📎 "+t.deliverables.join(", ")):""}</div>}
                  </td>
                  <td style={{padding:10}}><StatusBadge s={t.status}/></td>
                  <td style={{padding:10}}><ProductPill p={t.product}/>{t.workKind && <div style={{fontSize:11,color:"#6b7280"}}>{t.workKind}</div>}</td>
                  <td style={{padding:10,minWidth:120}}>
                    <div style={{height:6,background:"#e5e7eb",borderRadius:999,overflow:"hidden",width:90}}><div style={{width:`${t.progress}%`,height:"100%",background: t.status==="failed"?"#dc2626":t.status==="completed"?"#16a34a":"#2563eb"}}/></div>
                    <div style={{fontSize:11,color:"#6b7280"}}>{t.progress}%</div>
                  </td>
                  <td style={{padding:10}}><code style={{background:"#f3f4f6",padding:"2px 6px",borderRadius:6,fontSize:11}}>{t.traceId}</code></td>
                  <td style={{padding:10}}><span style={{fontSize:11,background:t.executionMode==="local"?"#fef3c7":"#e0e7ff",padding:"2px 6px",borderRadius:6}}>{t.executionMode}</span></td>
                  <td style={{padding:10,fontSize:12,color:"#6b7280",whiteSpace:"nowrap"}}>{t.createdAt}</td>
                  <td style={{padding:10}}><button onClick={()=>setSelected(t)} style={{border:"1px solid #e5e7eb",background:"#fff",borderRadius:8,padding:"6px 10px",cursor:"pointer",fontSize:12}}>View</button></td>
                </tr>
              ))}
              {filtered.length===0 && <tr><td colSpan={8} style={{padding:20,textAlign:"center",color:"#9ca3af"}}>No tasks match filters</td></tr>}
            </tbody>
          </table>
        </div>
      </div>

      {/* Detail drawer */}
      {selected && (
        <div onClick={()=>setSelected(null)} style={{position:"fixed",inset:0,background:"rgba(0,0,0,.4)",display:"flex",justifyContent:"flex-end",zIndex:50}}>
          <div onClick={e=>e.stopPropagation()} style={{width:520,background:"#fff",height:"100%",overflow:"auto",padding:20}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <h3 style={{margin:0}}>{selected.title}</h3>
              <button onClick={()=>setSelected(null)} style={{border:"1px solid #e5e7eb",background:"#fff",borderRadius:8,padding:"6px 10px",cursor:"pointer"}}>Close</button>
            </div>
            <div style={{display:"flex",gap:8,marginTop:10,flexWrap:"wrap"}}><StatusBadge s={selected.status}/><ProductPill p={selected.product}/><code style={{background:"#f3f4f6",padding:"2px 6px",borderRadius:6,fontSize:11}}>{selected.traceId}</code></div>
            <p style={{color:"#374151",fontSize:13,marginTop:12}}><b>Goal:</b> {selected.goal}</p>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:10,marginTop:12}}>
              <div style={{border:"1px solid #e5e7eb",borderRadius:12,padding:12}}><div style={{fontSize:11,color:"#6b7280"}}>Progress</div><div style={{height:8,background:"#e5e7eb",borderRadius:999,marginTop:6}}><div style={{width:`${selected.progress}%`,height:"100%",background:"#2563eb",borderRadius:999}}/></div><div style={{fontSize:12,marginTop:4}}>{selected.progress}% — {selected.status}</div></div>
              <div style={{border:"1px solid #e5e7eb",borderRadius:12,padding:12}}><div style={{fontSize:11,color:"#6b7280"}}>Execution</div><div style={{fontSize:13,marginTop:6}}>{selected.executionMode} • {selected.workKind ?? "—"}</div>{selected.estimate && <div style={{fontSize:12,color:"#6b7280"}}>${selected.estimate.cost} • {selected.estimate.minutes}min</div>}</div>
            </div>
            <div style={{marginTop:14,border:"1px solid #e5e7eb",borderRadius:12,padding:12}}>
              <div style={{fontWeight:600,fontSize:13}}>Handoff Packet (Teammate → Work)</div>
              <pre style={{background:"#0d0d0d",color:"#e5e7eb",padding:12,borderRadius:8,overflow:"auto",fontSize:11,marginTop:8}}>{JSON.stringify({trace_id:selected.traceId,goal:selected.goal,execution_mode:selected.executionMode,verification_criteria:["deliverable openable","preview smoke pass"],constraints:{budget:selected.estimate?.cost}},null,2)}</pre>
              <div style={{display:"flex",gap:8,marginTop:10}}>
                <a href={`/work/${selected.id}`} style={{background:"#0d0d0d",color:"#fff",padding:"8px 12px",borderRadius:8,textDecoration:"none",fontSize:12}}>Open Work page</a>
                <button onClick={()=>alert("Copied traceId "+selected.traceId)} style={{border:"1px solid #e5e7eb",background:"#fff",borderRadius:8,padding:"8px 12px",fontSize:12,cursor:"pointer"}}>Copy traceId</button>
              </div>
            </div>
            <div style={{marginTop:12,border:"1px solid #e5e7eb",borderRadius:12,padding:12}}>
              <div style={{fontWeight:600,fontSize:13}}>Timeline</div>
              <div style={{fontSize:12,color:"#6b7280",marginTop:6,lineHeight:1.7}}>
                Queued → Planning → In Progress → {selected.status==="waiting_for_user"?"Waiting for User (needs approval)":selected.status} <br/>
                <span style={{background:"#fef3c7",padding:"2px 6px",borderRadius:6}}>Waiting for User = ต้องการ approve / เติมข้อมูล — จะแจ้งเตือนในแชท</span>
              </div>
            </div>
          </div>
        </div>
      )}

      <div style={{marginTop:16,display:"flex",gap:12,flexWrap:"wrap"}}>
        <div style={{border:"1px solid #e5e7eb",borderRadius:12,padding:12,flex:"1 1 220px"}}>
          <div style={{fontWeight:600,fontSize:13}}>Seamless Handoff</div>
          <div style={{fontSize:12,color:"#6b7280",marginTop:4}}>คุยกับ Teammate → สั่ง "เอาเลย" → สร้าง Work task พร้อม traceId เดียวกัน → ติดตามที่นี่</div>
        </div>
        <div style={{border:"1px solid #e5e7eb",borderRadius:12,padding:12,flex:"1 1 220px"}}>
          <div style={{fontWeight:600,fontSize:13}}>10 statuses อธิบาย</div>
          <div style={{fontSize:11,color:"#6b7280",marginTop:4,lineHeight:1.6}}>Queued/Planning/In Progress/Waiting for User/Paused/Reviewing/Completed/Partially Completed/Failed/Cancelled — กด filter ด้านบนเพื่อดู</div>
        </div>
      </div>
    </div>
  );
}
