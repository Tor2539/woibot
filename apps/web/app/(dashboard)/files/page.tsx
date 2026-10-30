"use client";
import { useState } from "react";

type F = {id:string;name:string;path:string;mime:string;size:number;origin:"deliverable"|"drive"|"upload";taskId?:string;updated:string;previewable:boolean};
const FILES: F[] = [
  {id:"f1",name:"Q3_Deck.pptx",path:"/Deliverables/Q3_Deck.pptx",mime:"application/vnd.openxmlformats-officedocument.presentationml.presentation",size:4200000,origin:"deliverable",taskId:"tsk_002",updated:"2026-10-30 11:20",previewable:true},
  {id:"f2",name:"landing.zip",path:"/Deliverables/landing.zip",mime:"application/zip",size:890000,origin:"deliverable",taskId:"tsk_001",updated:"2026-10-30 15:02",previewable:false},
  {id:"f3",name:"report_oct_partial.pdf",path:"/Deliverables/report_oct_partial.pdf",mime:"application/pdf",size:2100000,origin:"deliverable",taskId:"tsk_009",updated:"2026-10-27 18:00",previewable:true},
  {id:"f4",name:"logo_v2.pdf",path:"/Deliverables/logo_v2.pdf",mime:"application/pdf",size:340000,origin:"deliverable",taskId:"tsk_006",updated:"2026-10-29 17:00",previewable:true},
  {id:"f5",name:"Brief_Q4.docx",path:"/Cloud Drive/Briefs/Brief_Q4.docx",mime:"application/vnd.openxmlformats-officedocument.wordprocessingml.document",size:120000,origin:"drive",updated:"2026-10-30 09:00",previewable:true},
  {id:"f6",name:"budget_q3.xlsx",path:"/Cloud Drive/Sheets/budget_q3.xlsx",mime:"application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",size:560000,origin:"drive",updated:"2026-10-29 14:10",previewable:true},
  {id:"f7",name:"ugc_raw.mp4",path:"/Cloud Drive/Video/ugc_raw.mp4",mime:"video/mp4",size:124000000,origin:"upload",updated:"2026-10-31 11:05",previewable:true},
  {id:"f8",name:"brand_assets.zip",path:"/Cloud Drive/Assets/brand_assets.zip",mime:"application/zip",size:3400000,origin:"drive",updated:"2026-10-28 10:00",previewable:false},
];

function fmt(n:number){ if(n>1e6) return (n/1e6).toFixed(1)+" MB"; if(n>1e3) return (n/1e3).toFixed(1)+" KB"; return n+" B"; }
function iconFor(m:string){
  if(m.includes("presentation")) return "📊";
  if(m.includes("wordprocessing")||m==="application/pdf") return "📄";
  if(m.includes("spreadsheet")) return "📗";
  if(m.includes("zip")) return "📦";
  if(m.includes("video")) return "🎬";
  return "📁";
}

export default function FilesPage(){
  const [tab,setTab]=useState<"all"|"deliverables"|"drive">("all");
  const [sel,setSel]=useState<F|null>(null);
  const [q,setQ]=useState("");
  const list = FILES.filter(f=>{
    if(tab==="deliverables" && f.origin!=="deliverable") return false;
    if(tab==="drive" && f.origin==="deliverable") return false;
    if(q && ! (f.name+" "+f.path).toLowerCase().includes(q.toLowerCase())) return false;
    return true;
  });
  return (
    <div style={{fontFamily:"system-ui",maxWidth:1180,margin:"0 auto",padding:"24px 20px"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:12}}>
        <div>
          <h1 style={{margin:0,fontSize:22}}>Files</h1>
          <p style={{margin:"4px 0 0",color:"#6b7280",fontSize:13}}>Deliverables (จาก Work) + Cloud Drive (ซิงก์ 24h) • Preview / Download / ส่งต่อเข้า Task</p>
        </div>
        <div style={{display:"flex",gap:8,flexWrap:"wrap"}}>
          <input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search name / path" style={{border:"1px solid #e5e7eb",borderRadius:10,padding:"8px 12px",minWidth:220,fontSize:13}}/>
          <button onClick={()=>alert("Upload → /Cloud Drive (mock)")} style={{border:"1px solid #e5e7eb",background:"#fff",borderRadius:10,padding:"8px 12px",fontWeight:600,cursor:"pointer",fontSize:13}}>⬆ Upload</button>
          <button onClick={()=>alert("New folder in Cloud Drive")} style={{background:"#0d0d0d",color:"#fff",borderRadius:10,padding:"8px 12px",border:"none",fontWeight:600,cursor:"pointer",fontSize:13}}>+ New Folder</button>
        </div>
      </div>

      <div style={{display:"flex",gap:8,marginTop:14}}>
        {(["all","deliverables","drive"] as const).map(t=>(
          <button key={t} onClick={()=>setTab(t)} style={{padding:"7px 12px",borderRadius:999,border:t===tab?"1px solid #0d0d0d":"1px solid #e5e7eb",background:t===tab?"#0d0d0d":"#fff",color:t===tab?"#fff":"#374151",fontSize:12,fontWeight:600,cursor:"pointer"}}>
            {t==="all"?"All":t==="deliverables"?"Deliverables ("+FILES.filter(f=>f.origin==="deliverable").length+")":"Cloud Drive ("+FILES.filter(f=>f.origin!=="deliverable").length+")"}
          </button>
        ))}
        <span style={{alignSelf:"center",color:"#9ca3af",fontSize:12,marginLeft:6}}>Deliverables ล็อกตาม task • Cloud Drive แชร์ข้าม Teammate/Work</span>
      </div>

      <div style={{marginTop:14,border:"1px solid #e5e7eb",borderRadius:14,overflow:"hidden"}}>
        <div style={{display:"flex",alignItems:"center",gap:8,padding:"10px 12px",background:"#f9fafb",borderBottom:"1px solid #e5e7eb"}}>
          <span style={{fontSize:12,color:"#6b7280"}}>Path: <code style={{background:"#fff",padding:"2px 6px",borderRadius:6,border:"1px solid #e5e7eb"}}>{tab==="deliverables"?"/Deliverables":tab==="drive"?"/Cloud Drive":"/"}</code></span>
          <span style={{fontSize:11,color:"#9ca3af"}}>• {list.length} files • {fmt(list.reduce((s,f)=>s+f.size,0))} total</span>
          <span style={{marginLeft:"auto",fontSize:11,color:"#6b7280"}}>Cloud Drive synced • 24h retention for Teammate context</span>
        </div>
        <div style={{overflowX:"auto"}}>
          <table style={{width:"100%",borderCollapse:"collapse",fontSize:13}}>
            <thead><tr style={{background:"#fff",textAlign:"left",color:"#6b7280",fontSize:11}}>
              <th style={{padding:"8px 12px"}}>NAME</th><th style={{padding:8}}>ORIGIN</th><th style={{padding:8}}>SIZE</th><th style={{padding:8}}>UPDATED</th><th style={{padding:8}}>ACTIONS</th>
            </tr></thead>
            <tbody>
              {list.map(f=>(
                <tr key={f.id} style={{borderTop:"1px solid #f3f4f6"}}>
                  <td style={{padding:"8px 12px",minWidth:320}}>
                    <div style={{display:"flex",gap:8,alignItems:"center"}}>
                      <span style={{fontSize:18}}>{iconFor(f.mime)}</span>
                      <div>
                        <div style={{fontWeight:600}}>{f.name}</div>
                        <div style={{fontSize:11,color:"#6b7280"}}>{f.path}</div>
                      </div>
                    </div>
                  </td>
                  <td style={{padding:8}}><span style={{fontSize:11,padding:"2px 7px",borderRadius:6,background:f.origin==="deliverable"?"#dcfce7":"#e0e7ff",color:f.origin==="deliverable"?"#166534":"#3730a3"}}>{f.origin}</span>{f.taskId && <div style={{fontSize:11,color:"#6b7280"}}>{f.taskId}</div>}</td>
                  <td style={{padding:8,fontSize:12}}>{fmt(f.size)}</td>
                  <td style={{padding:8,fontSize:12,color:"#6b7280",whiteSpace:"nowrap"}}>{f.updated}</td>
                  <td style={{padding:8}}>
                    <div style={{display:"flex",gap:6,flexWrap:"wrap"}}>
                      <button onClick={()=>setSel(f)} style={{border:"1px solid #e5e7eb",background:"#fff",borderRadius:8,padding:"5px 8px",fontSize:12,cursor:"pointer"}}>Preview</button>
                      <button onClick={()=>alert("Download "+f.name+" (mock)")} style={{border:"1px solid #e5e7eb",background:"#fff",borderRadius:8,padding:"5px 8px",fontSize:12,cursor:"pointer"}}>Download</button>
                      <button onClick={()=>alert("Use in new Work task: "+f.path)} style={{background:"#0d0d0d",color:"#fff",borderRadius:8,padding:"5px 8px",border:"none",fontSize:12,cursor:"pointer"}}>Use in Task</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:12,marginTop:14}}>
        <div style={{border:"1px solid #e5e7eb",borderRadius:12,padding:12}}>
          <div style={{fontWeight:600,fontSize:13}}>Cloud Drive — how it works</div>
          <div style={{fontSize:12,color:"#6b7280",marginTop:6,lineHeight:1.6}}>ไฟล์อัปโหลด/ซิงก์จาก Drive → ใช้เป็น context ให้ Teammate + แนบเข้า Work task ผ่าน Handoff packet • เก็บถาวร แยกจาก Teammate 24h ephemeral memory</div>
        </div>
        <div style={{border:"1px solid #e5e7eb",borderRadius:12,padding:12}}>
          <div style={{fontWeight:600,fontSize:13}}>Deliverables guarantee</div>
          <div style={{fontSize:12,color:"#6b7280",marginTop:6,lineHeight:1.6}}>ทุก Work task ต้องมีไฟล์ที่เปิดได้จริง (ZIP/PDF/PPTX/MP4) + verification report ก่อน mark Completed • ไฟล์ editable ไม่ใช่สกรีนช็อต</div>
        </div>
      </div>

      {sel && (
        <div onClick={()=>setSel(null)} style={{position:"fixed",inset:0,background:"rgba(0,0,0,.45)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:50,padding:20}}>
          <div onClick={e=>e.stopPropagation()} style={{background:"#fff",borderRadius:14,width:"min(820px,100%)",maxHeight:"90vh",overflow:"auto"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:"14px 16px",borderBottom:"1px solid #e5e7eb"}}>
              <div><div style={{fontWeight:700}}>{sel.name}</div><div style={{fontSize:12,color:"#6b7280"}}>{sel.path} • {fmt(sel.size)} • {sel.mime}</div></div>
              <button onClick={()=>setSel(null)} style={{border:"1px solid #e5e7eb",background:"#fff",borderRadius:8,padding:"6px 10px",cursor:"pointer"}}>Close</button>
            </div>
            <div style={{padding:16}}>
              {sel.mime.includes("pdf") ? (
                <div style={{background:"#f9fafb",border:"1px solid #e5e7eb",borderRadius:10,padding:12}}>
                  <div style={{height:320,background:"#fff",border:"1px solid #e5e7eb",borderRadius:8,display:"flex",alignItems:"center",justifyContent:"center",color:"#9ca3af"}}>PDF preview — {sel.name} (mock viewer, 12 pages)</div>
                  <div style={{fontSize:12,color:"#6b7280",marginTop:8}}>Fonts embedded • TOC linked • เปิดด้วย PDF viewer ได้จริง</div>
                </div>
              ) : sel.mime.includes("presentation") ? (
                <div style={{background:"#f9fafb",border:"1px solid #e5e7eb",borderRadius:10,padding:12}}>
                  <div style={{height:320,background:"#111827",borderRadius:8,display:"flex",alignItems:"center",justifyContent:"center",color:"#e5e7eb"}}>PPTX preview — slide thumbnails (mock)</div>
                </div>
              ) : sel.mime.includes("video") ? (
                <div style={{background:"#0d0d0d",borderRadius:10,padding:12}}>
                  <div style={{height:320,background:"#1f2937",borderRadius:8,display:"flex",alignItems:"center",justifyContent:"center",color:"#e5e7eb"}}>▶ Video player — {sel.name} (mock, 30s)</div>
                  <div style={{fontSize:12,color:"#9ca3af",marginTop:8}}>H.264/AAC • 1920×1080 • subs TH/EN</div>
                </div>
              ) : sel.mime.includes("zip") ? (
                <div style={{background:"#f9fafb",border:"1px solid #e5e7eb",borderRadius:10,padding:12}}>
                  <div style={{fontSize:13,fontWeight:600}}>ZIP contents</div>
                  <ul style={{fontSize:12,color:"#374151",marginTop:6}}><li>src/ ...</li><li>README.md</li><li>.env.example</li><li>package.json</li></ul>
                </div>
              ) : (
                <div style={{background:"#f9fafb",border:"1px solid #e5e7eb",borderRadius:10,padding:20,textAlign:"center",color:"#6b7280"}}>Preview for {sel.mime} (mock)</div>
              )}
              <div style={{display:"flex",gap:8,marginTop:12}}>
                <button onClick={()=>alert("Download "+sel.name)} style={{background:"#0d0d0d",color:"#fff",borderRadius:8,padding:"8px 12px",border:"none",fontSize:12,cursor:"pointer"}}>Download</button>
                <button onClick={()=>alert("Copy link "+sel.path)} style={{border:"1px solid #e5e7eb",background:"#fff",borderRadius:8,padding:"8px 12px",fontSize:12,cursor:"pointer"}}>Copy link</button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
