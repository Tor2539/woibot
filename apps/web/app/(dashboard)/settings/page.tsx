"use client";
import { useState } from "react";

const PLANS = [
  {id:"free",name:"Free",price:0,period:"/mo",tokens:"200K",cpu:"0.5 vCPU",ram:"1 GB",routines:"3",cta:"Current",highlight:false},
  {id:"starter",name:"Starter",price:399,period:"/mo",tokens:"2M",cpu:"1 vCPU",ram:"2 GB",routines:"20",cta:"Upgrade",highlight:true},
  {id:"pro",name:"Pro",price:999,period:"/mo",tokens:"10M",cpu:"2 vCPU",ram:"4 GB",routines:"100",cta:"Upgrade",highlight:false},
];

const LEDGER = [
  {date:"2026-10-31 14:22",product:"work",kind:"coding",task:"tsk_001",detail:"Landing build",cost:2.40},
  {date:"2026-10-31 08:00",product:"teammate",kind:"—",task:"—",detail:"Daily briefing",cost:0.04},
  {date:"2026-10-30 11:20",product:"work",kind:"doc",task:"tsk_002",detail:"Q3 Deck 12 pages",cost:0.80},
  {date:"2026-10-30 16:20",product:"teammate",kind:"—",task:"—",detail:"Email summary + calendar",cost:0.06},
  {date:"2026-10-31 11:00",product:"work",kind:"video_gen",task:"tsk_005",detail:"Video gen queued (est.)",cost:8.50},
  {date:"2026-10-29 10:00",product:"teammate",kind:"—",task:"—",detail:"Routine: Slack log",cost:0.02},
];

export default function SettingsPage(){
  const [plan,setPlan]=useState("free");
  const [cap,setCap]=useState(50);
  const [perTask,setPerTask]=useState(5);
  const [quotaUsed]=useState(12.40);
  const teammateCost = LEDGER.filter(r=>r.product==="teammate").reduce((s,r)=>s+r.cost,0);
  const workCost = LEDGER.filter(r=>r.product==="work").reduce((s,r)=>s+r.cost,0);
  const total = teammateCost + workCost;
  return (
    <div style={{fontFamily:"system-ui",maxWidth:1180,margin:"0 auto",padding:"24px 20px"}}>
      <h1 style={{margin:0,fontSize:22}}>Settings</h1>
      <p style={{margin:"4px 0 0",color:"#6b7280",fontSize:13}}>Plans • Work quotas • Usage แยก Teammate vs Work โปร่งใส • Ledger</p>

      <h3 style={{margin:"18px 0 8px",fontSize:14}}>Plans — Teammate subscription / Work pay-per-task</h3>
      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(260px,1fr))",gap:12}}>
        {PLANS.map(p=>(
          <div key={p.id} style={{border:p.highlight?"2px solid #0d0d0d":"1px solid #e5e7eb",borderRadius:14,padding:16,background:p.highlight?"#fff":"#fff"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div style={{fontWeight:700}}>{p.name} {p.highlight && <span style={{background:"#0d0d0d",color:"#fff",fontSize:10,padding:"2px 6px",borderRadius:6,marginLeft:6}}>POPULAR</span>}</div>
              <div><span style={{fontSize:22,fontWeight:800}}>{p.price===0?"Free":`฿${p.price}`}</span><span style={{color:"#6b7280",fontSize:12}}>{p.period}</span></div>
            </div>
            <div style={{fontSize:12,color:"#374151",marginTop:10,lineHeight:1.8}}>
              <div>Tokens: <b>{p.tokens}</b> / mo</div>
              <div>Compute: <b>{p.cpu} • {p.ram}</b></div>
              <div>Routines: <b>{p.routines}</b></div>
              <div style={{color:"#6b7280"}}>Teammate Cloud 24h • Work แยกบิลตาม estimate</div>
            </div>
            <button onClick={()=>setPlan(p.id)} style={{marginTop:12,width:"100%",padding:"8px 10px",borderRadius:10,border:plan===p.id?"1px solid #16a34a":"1px solid #e5e7eb",background:plan===p.id?"#dcfce7":"#0d0d0d",color:plan===p.id?"#166534":"#fff",fontWeight:700,cursor:"pointer",fontSize:13}}>{plan===p.id?"✓ Current plan":p.cta}</button>
          </div>
        ))}
      </div>
      <div style={{fontSize:11,color:"#6b7280",marginTop:6}}>วิดีโอใช้ GPU pool แยก ไม่กระทบโควตา Teammate • ประเมินราคาก่อนเริ่มทุก Work task • ตั้งวงเงินได้</div>

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginTop:16}}>
        <div style={{border:"1px solid #e5e7eb",borderRadius:14,padding:14}}>
          <div style={{fontWeight:700,fontSize:13}}>Work Quotas & Limits</div>
          <div style={{marginTop:10}}>
            <label style={{fontSize:12}}>Monthly cap (USD)<input type="number" value={cap} onChange={e=>setCap(Number(e.target.value))} style={{width:"100%",marginTop:4,border:"1px solid #e5e7eb",borderRadius:8,padding:"8px 10px"}}/></label>
            <label style={{fontSize:12,display:"block",marginTop:8}}>Per-task cap (USD)<input type="number" value={perTask} onChange={e=>setPerTask(Number(e.target.value))} style={{width:"100%",marginTop:4,border:"1px solid #e5e7eb",borderRadius:8,padding:"8px 10px"}}/></label>
            <div style={{marginTop:10,background:"#f9fafb",border:"1px solid #e5e7eb",borderRadius:10,padding:10}}>
              <div style={{display:"flex",justifyContent:"space-between",fontSize:12}}><span>Used this month</span><span style={{fontWeight:700}}>${quotaUsed.toFixed(2)} / ${cap.toFixed(2)}</span></div>
              <div style={{height:8,background:"#e5e7eb",borderRadius:999,marginTop:6}}><div style={{width:`${Math.min(100, quotaUsed/cap*100)}%`,height:"100%",background:quotaUsed/cap>0.8?"#dc2626":quotaUsed/cap>0.6?"#f59e0b":"#16a34a",borderRadius:999}}/></div>
              <div style={{fontSize:11,color:"#6b7280",marginTop:4}}>{quotaUsed/cap>0.8?"⚠️ ใกล้เต็ม — จะขอ approve ก่อนเริ่ม task ใหม่":"ปกติ — ต้อง approve เมื่อเกิน per-task cap"}</div>
            </div>
            <button onClick={()=>alert("Saved quotas")} style={{marginTop:10,background:"#0d0d0d",color:"#fff",borderRadius:8,padding:"8px 12px",border:"none",fontWeight:600,cursor:"pointer",fontSize:12}}>Save quotas</button>
          </div>
        </div>

        <div style={{border:"1px solid #e5e7eb",borderRadius:14,padding:14}}>
          <div style={{fontWeight:700,fontSize:13}}>Usage — Teammate vs Work แยกชัด</div>
          <div style={{display:"flex",gap:8,marginTop:10}}>
            <div style={{flex:1,background:"#eff6ff",border:"1px solid #dbeafe",borderRadius:10,padding:10}}>
              <div style={{fontSize:11,color:"#1d4ed8",fontWeight:700}}>TEAMMATE</div>
              <div style={{fontSize:20,fontWeight:800}}>${teammateCost.toFixed(2)}</div>
              <div style={{fontSize:11,color:"#6b7280"}}>{LEDGER.filter(r=>r.product==="teammate").length} events • chat + routines</div>
              <div style={{height:6,background:"#dbeafe",borderRadius:999,marginTop:6}}><div style={{width:`${teammateCost/total*100}%`,height:"100%",background:"#2563eb",borderRadius:999}}/></div>
            </div>
            <div style={{flex:1,background:"#f0fdf4",border:"1px solid #bbf7d0",borderRadius:10,padding:10}}>
              <div style={{fontSize:11,color:"#166534",fontWeight:700}}>WORK</div>
              <div style={{fontSize:20,fontWeight:800}}>${workCost.toFixed(2)}</div>
              <div style={{fontSize:11,color:"#6b7280"}}>{LEDGER.filter(r=>r.product==="work").length} tasks • coding/doc/video</div>
              <div style={{height:6,background:"#bbf7d0",borderRadius:999,marginTop:6}}><div style={{width:`${workCost/total*100}%`,height:"100%",background:"#16a34a",borderRadius:999}}/></div>
            </div>
          </div>
          <div style={{marginTop:10,background:"#f9fafb",border:"1px solid #e5e7eb",borderRadius:10,padding:10}}>
            <div style={{fontSize:11,color:"#6b7280"}}>Cost by kind</div>
            <div style={{display:"flex",gap:6,flexWrap:"wrap",marginTop:6}}>
              {Array.from(new Set(LEDGER.map(r=>r.kind))).map(k=>{
                const c = LEDGER.filter(r=>r.kind===k).reduce((s,r)=>s+r.cost,0);
                return <span key={k} style={{fontSize:11,background:"#fff",border:"1px solid #e5e7eb",padding:"4px 8px",borderRadius:999}}>{k}: ${c.toFixed(2)}</span>;
              })}
            </div>
          </div>
          <div style={{fontSize:11,color:"#6b7280",marginTop:8}}>บิลแยก product ชัดเจน • Work มี estimate ก่อนเริ่ม • GPU video แยก pool ไม่กินโควตา Teammate</div>
        </div>
      </div>

      <div style={{marginTop:14,border:"1px solid #e5e7eb",borderRadius:14,overflow:"hidden"}}>
        <div style={{padding:"10px 12px",background:"#f9fafb",borderBottom:"1px solid #e5e7eb",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div style={{fontWeight:700,fontSize:13}}>Ledger — ทุก UsageEvent</div>
          <button onClick={()=>alert("Export CSV")} style={{border:"1px solid #e5e7eb",background:"#fff",borderRadius:8,padding:"6px 10px",fontSize:11,cursor:"pointer"}}>Export CSV</button>
        </div>
        <div style={{overflowX:"auto"}}>
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:12}}>
            <thead><tr style={{background:"#fff",textAlign:"left",color:"#6b7280",fontSize:11}}>
              <th style={{padding:"8px 12px"}}>DATE</th><th style={{padding:8}}>PRODUCT</th><th style={{padding:8}}>KIND</th><th style={{padding:8}}>TASK</th><th style={{padding:8}}>DETAIL</th><th style={{padding:8}}>COST</th>
            </tr></thead>
            <tbody>
              {LEDGER.map((r,i)=>(
                <tr key={i} style={{borderTop:"1px solid #f3f4f6"}}>
                  <td style={{padding:"8px 12px",whiteSpace:"nowrap"}}>{r.date}</td>
                  <td style={{padding:8}}><span style={{fontSize:11,padding:"2px 6px",borderRadius:6,background:r.product==="work"?"#0d0d0d":"#eff6ff",color:r.product==="work"?"#fff":"#1d4ed8"}}>{r.product}</span></td>
                  <td style={{padding:8}}>{r.kind}</td>
                  <td style={{padding:8}}><code style={{background:"#f3f4f6",padding:"2px 6px",borderRadius:6,fontSize:11}}>{r.task}</code></td>
                  <td style={{padding:8}}>{r.detail}</td>
                  <td style={{padding:8,fontWeight:700}}>${r.cost.toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot><tr style={{borderTop:"2px solid #e5e7eb",background:"#f9fafb",fontWeight:700}}><td colSpan={5} style={{padding:"8px 12px",textAlign:"right"}}>Total (Teammate ${teammateCost.toFixed(2)} + Work ${workCost.toFixed(2)})</td><td style={{padding:8}}>${total.toFixed(2)}</td></tr></tfoot>
          </table>
        </div>
      </div>

      <div style={{marginTop:14,border:"1px solid #e5e7eb",borderRadius:12,padding:12,background:"#fff"}}>
        <div style={{fontWeight:700,fontSize:13}}>Approval & Privacy</div>
        <div style={{fontSize:12,color:"#6b7280",marginTop:6,lineHeight:1.6}}>• Work ทุก task ประเมินราคาก่อนเริ่ม — เกิน per-task cap ต้องกด Approve<br/>• Approvals: ใช้ Cloud Drive, ส่งเมล/โพสต์ — ขอ permission ก่อน<br/>• ข้อมูล Teammate เก็บแยกจาก Work • ลบ account = ลบ UsageEvent + Files ตาม GDPR</div>
        <div style={{display:"flex",gap:8,marginTop:10}}>
          <button onClick={()=>alert("Manage approvals")} style={{border:"1px solid #e5e7eb",background:"#fff",borderRadius:8,padding:"6px 10px",fontSize:12,cursor:"pointer"}}>Approvals</button>
          <button onClick={()=>alert("Privacy settings")} style={{border:"1px solid #e5e7eb",background:"#fff",borderRadius:8,padding:"6px 10px",fontSize:12,cursor:"pointer"}}>Privacy</button>
          <button onClick={()=>alert("Delete account (confirm)")} style={{border:"1px solid #fecaca",background:"#fff",color:"#dc2626",borderRadius:8,padding:"6px 10px",fontSize:12,cursor:"pointer"}}>Delete Account</button>
        </div>
      </div>
    </div>
  );
}
