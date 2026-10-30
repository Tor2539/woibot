"use client";
import { useState } from "react";

type App = {id:string;name:string;desc:string;icon:string;status:"connected"|"disconnected"|"expired";account?:string;scopes?:string[];category:"comms"|"calendar"|"storage"|"dev"|"workspace"};
const APPS: App[] = [
  {id:"gmail",name:"Gmail",desc:"อ่าน/สรุป/ร่างตอบเมล • สร้าง Task จากเมล",icon:"✉️",status:"connected",account:"you@gmail.com",scopes:["gmail.read","gmail.send"],category:"comms"},
  {id:"calendar",name:"Google Calendar",desc:"สรุปนัดวันนี้ • เตือนก่อนเริ่ม • หาช่องว่าง",icon:"📅",status:"connected",account:"you@gmail.com",scopes:["calendar.read"],category:"calendar"},
  {id:"drive",name:"Google Drive",desc:"ซิงก์ Cloud Drive • แนบไฟล์เข้า Work",icon:"💾",status:"connected",account:"you@gmail.com",scopes:["drive.read"],category:"storage"},
  {id:"slack",name:"Slack",desc:"สรุปแชนแนล • แจ้งเตือน mention • สร้าง Task",icon:"💬",status:"disconnected",category:"comms"},
  {id:"notion",name:"Notion",desc:"อ่าน/เขียนฐานความรู้ • sync memory",icon:"📝",status:"connected",account:"my-workspace",scopes:["notion.read","notion.write"],category:"workspace"},
  {id:"github",name:"GitHub",desc:"สร้าง repo/PR • ดูโค้ด Deliverables",icon:"🐙",status:"expired",account:"@you",scopes:["repo"],category:"dev"},
  {id:"linear",name:"Linear",desc:"ซิงก์ issue ↔ Task",icon:"◧",status:"disconnected",category:"dev"},
  {id:"figma",name:"Figma",desc:"ดึงดีไซน์เข้า Work coding",icon:"🎨",status:"disconnected",category:"workspace"},
];

const CATS = [{k:"all",l:"All"},{k:"comms",l:"Comms"},{k:"calendar",l:"Calendar"},{k:"storage",l:"Storage"},{k:"workspace",l:"Workspace"},{k:"dev",l:"Dev"}] as const;

export default function AppsPage(){
  const [apps,setApps]=useState<App[]>(APPS);
  const [cat,setCat]=useState<string>("all");
  const [q,setQ]=useState("");
  const toggle = (id:string, to:"connected"|"disconnected")=> setApps(a=>a.map(x=> x.id===id ? {...x,status:to,account:to==="connected"?(x.account||"connected"):""} : x));
  const filtered = apps.filter(a=> (cat==="all"||a.category===cat) && (!q || (a.name+a.desc).toLowerCase().includes(q.toLowerCase())));
  return (
    <div style={{fontFamily:"system-ui",maxWidth:1180,margin:"0 auto",padding:"24px 20px"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:12}}>
        <div>
          <h1 style={{margin:0,fontSize:22}}>Connected Apps</h1>
          <p style={{margin:"4px 0 0",color:"#6b7280",fontSize:13}}>เชื่อม Gmail/Calendar/Slack/Notion/Drive/GitHub • OAuth แยกแอปละ scope • Revoke ได้ทันที</p>
        </div>
        <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search apps" style={{border:"1px solid #e5e7eb",borderRadius:10,padding:"8px 12px",minWidth:220,fontSize:13}}/>
      </div>

      <div style={{display:"flex",gap:6,flexWrap:"wrap",marginTop:14}}>
        {CATS.map(c=>(
          <button key={c.k} onClick={()=>setCat(c.k)} style={{padding:"6px 10px",borderRadius:999,border:cat===c.k?"1px solid #0d0d0d":"1px solid #e5e7eb",background:cat===c.k?"#0d0d0d":"#fff",color:cat===c.k?"#fff":"#374151",fontSize:12,fontWeight:600,cursor:"pointer"}}>{c.l}</button>
        ))}
        <span style={{alignSelf:"center",color:"#9ca3af",fontSize:12,marginLeft:6}}>{apps.filter(a=>a.status==="connected").length} connected • {apps.filter(a=>a.status==="expired").length} need re-auth</span>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"repeat(auto-fill,minmax(260px,1fr))",gap:12,marginTop:14}}>
        {filtered.map(a=>(
          <div key={a.id} style={{border:"1px solid #e5e7eb",borderRadius:14,padding:14,background:a.status==="connected"?"#fff":"#f9fafb"}}>
            <div style={{display:"flex",gap:10,alignItems:"center"}}>
              <div style={{width:42,height:42,borderRadius:10,background:"#f3f4f6",display:"flex",alignItems:"center",justifyContent:"center",fontSize:22}}>{a.icon}</div>
              <div style={{flex:1}}>
                <div style={{fontWeight:700,fontSize:13}}>{a.name}</div>
                <div style={{fontSize:11,color:"#6b7280"}}>{a.category}</div>
              </div>
              <span style={{fontSize:11,padding:"3px 8px",borderRadius:999,border:"1px solid #e5e7eb",background:a.status==="connected"?"#dcfce7":a.status==="expired"?"#fef3c7":"#fff",color:a.status==="connected"?"#166534":a.status==="expired"?"#92400e":"#6b7280"}}>{a.status}</span>
            </div>
            <div style={{fontSize:12,color:"#374151",marginTop:8,lineHeight:1.5}}>{a.desc}</div>
            {a.account && <div style={{fontSize:11,color:"#6b7280",marginTop:6}}>Account: {a.account}</div>}
            {a.scopes && <div style={{fontSize:11,color:"#6b7280"}}>Scopes: {a.scopes.join(", ")}</div>}
            <div style={{display:"flex",gap:6,marginTop:10}}>
              {a.status==="connected" ? (
                <>
                  <button onClick={()=>toggle(a.id,"disconnected")} style={{border:"1px solid #fecaca",background:"#fff",color:"#dc2626",borderRadius:8,padding:"6px 10px",fontSize:12,cursor:"pointer"}}>Revoke</button>
                  <button onClick={()=>alert("Manage scopes for "+a.name)} style={{border:"1px solid #e5e7eb",background:"#fff",borderRadius:8,padding:"6px 10px",fontSize:12,cursor:"pointer"}}>Manage</button>
                </>
              ) : a.status==="expired" ? (
                <button onClick={()=>toggle(a.id,"connected")} style={{background:"#f59e0b",color:"#fff",borderRadius:8,padding:"6px 10px",border:"none",fontSize:12,fontWeight:600,cursor:"pointer"}}>Re-authorize</button>
              ) : (
                <button onClick={()=>toggle(a.id,"connected")} style={{background:"#0d0d0d",color:"#fff",borderRadius:8,padding:"6px 10px",border:"none",fontSize:12,fontWeight:600,cursor:"pointer"}}>Connect</button>
              )}
              <span style={{marginLeft:"auto",fontSize:11,color:"#9ca3af",alignSelf:"center"}}>OAuth 2.0</span>
            </div>
          </div>
        ))}
      </div>

      <div style={{marginTop:14,border:"1px solid #e5e7eb",borderRadius:12,padding:12,background:"#eff6ff"}}>
        <div style={{fontWeight:600,fontSize:13}}>Privacy</div>
        <div style={{fontSize:12,color:"#6b7280",marginTop:4}}>Teammate อ่านเฉพาะ scope ที่คุณอนุญาต • ไม่เก็บรหัสผ่าน • Revoke แล้ว token หมดอายุทันที • Work ไม่เข้าถึง Connected Apps โดยตรง (ผ่าน Handoff packet เท่านั้น)</div>
      </div>
    </div>
  );
}
