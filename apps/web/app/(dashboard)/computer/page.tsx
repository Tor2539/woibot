"use client";
import { useState } from "react";

export default function ComputerPage(){
  const [taken,setTaken]=useState(false);
  const [relay,setRelay]=useState(true);
  return (
    <div style={{fontFamily:"system-ui",maxWidth:1180,margin:"0 auto",padding:"24px 20px"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",flexWrap:"wrap",gap:12}}>
        <div>
          <h1 style={{margin:0,fontSize:22}}>Cloud Computer</h1>
          <p style={{margin:"4px 0 0",color:"#6b7280",fontSize:13}}>Live view • Take Over เพื่อควบคุม • Teammate ใช้งานแยก session • File relay อัตโนมัติ</p>
        </div>
        <div style={{display:"flex",gap:8,alignItems:"center"}}>
          <span style={{fontSize:12,padding:"4px 8px",borderRadius:999,background:taken?"#dcfce7":"#e0e7ff",color:taken?"#166534":"#3730a3",border:"1px solid #e5e7eb"}}>{taken?"You have control":"Viewing • Teammate operating"}</span>
          <button onClick={()=>setTaken(v=>!v)} style={{background:taken?"#dc2626":"#0d0d0d",color:"#fff",borderRadius:10,padding:"8px 14px",border:"none",fontWeight:700,cursor:"pointer",fontSize:13}}>{taken?"Release Control":"Take Over"}</button>
        </div>
      </div>

      {/* noVNC mock */}
      <div style={{marginTop:14,border:"1px solid #e5e7eb",borderRadius:14,overflow:"hidden",background:"#0d0d0d"}}>
        <div style={{display:"flex",alignItems:"center",gap:8,padding:"8px 12px",background:"#111827",borderBottom:"1px solid #1f2937"}}>
          <span style={{width:10,height:10,borderRadius:999,background:"#ef4444",display:"inline-block"}}/>
          <span style={{width:10,height:10,borderRadius:999,background:"#f59e0b",display:"inline-block"}}/>
          <span style={{width:10,height:10,borderRadius:999,background:"#22c55e",display:"inline-block"}}/>
          <span style={{color:"#9ca3af",fontSize:12,marginLeft:8}}>noVNC — woibot-cloud-01 — Ubuntu 22.04 — 1920×1080</span>
          <span style={{marginLeft:"auto",color:"#6b7280",fontSize:11}}>latency 42ms • 30 fps</span>
          <button onClick={()=>alert("Fullscreen noVNC (mock)")} style={{marginLeft:8,border:"1px solid #374151",background:"#1f2937",color:"#e5e7eb",borderRadius:8,padding:"4px 8px",fontSize:11,cursor:"pointer"}}>Fullscreen</button>
        </div>
        <div style={{position:"relative",height:420,background:"linear-gradient(180deg,#1f2937,#0d0d0d)",display:"flex",alignItems:"center",justifyContent:"center"}}>
          {/* mock desktop */}
          <div style={{width:"92%",height:"86%",background:"#e5e7eb",borderRadius:10,border:"1px solid #d1d5db",overflow:"hidden",display:"flex",flexDirection:"column"}}>
            <div style={{height:28,background:"#111827",display:"flex",alignItems:"center",gap:6,padding:"0 8px"}}>
              <span style={{color:"#e5e7eb",fontSize:11}}>VS Code — landing/ — woibot</span>
              <span style={{marginLeft:"auto",color:"#9ca3af",fontSize:10}}>main • 62% building...</span>
            </div>
            <div style={{flex:1,display:"grid",gridTemplateColumns:"220px 1fr",gap:0}}>
              <div style={{background:"#1f2937",color:"#d1d5db",padding:10,fontSize:11,lineHeight:1.8}}>
                <div style={{color:"#93c5fd"}}>EXPLORER</div>
                <div>▸ src/</div><div style={{paddingLeft:12}}>• Hero.tsx</div><div style={{paddingLeft:12}}>• Pricing.tsx</div><div>▸ public/</div><div>• package.json</div><div style={{marginTop:8,color:"#86efac"}}>▶ npm run build</div>
              </div>
              <div style={{background:"#0b1220",color:"#e5e7eb",padding:10,fontFamily:"ui-monospace,monospace",fontSize:11,lineHeight:1.6}}>
                <div><span style={{color:"#9ca3af"}}>$</span> pnpm build</div>
                <div style={{color:"#86efac"}}>✓ built in 2.4s — 6 routes</div>
                <div><span style={{color:"#9ca3af"}}>$</span> pnpm test</div>
                <div style={{color:"#86efac"}}>✓ 14/14 passed — cov 82%</div>
                <div style={{marginTop:8,background:"#1f2937",padding:6,borderRadius:6}}>Preview: https://woibot-preview-9f3a2c.example.run</div>
              </div>
            </div>
          </div>
          {!taken && <div style={{position:"absolute",bottom:10,left:"50%",transform:"translateX(-50%)",background:"rgba(0,0,0,.7)",color:"#fff",padding:"6px 10px",borderRadius:999,fontSize:11}}>Teammate is working — click Take Over to control keyboard/mouse</div>}
        </div>
        <div style={{display:"flex",gap:8,padding:10,background:"#111827",flexWrap:"wrap"}}>
          <button onClick={()=>alert("Send Ctrl+C")} style={{border:"1px solid #374151",background:"#1f2937",color:"#e5e7eb",borderRadius:8,padding:"6px 10px",fontSize:12,cursor:"pointer"}}>Send Ctrl+C</button>
          <button onClick={()=>alert("Restart computer (mock)")} style={{border:"1px solid #374151",background:"#1f2937",color:"#e5e7eb",borderRadius:8,padding:"6px 10px",fontSize:12,cursor:"pointer"}}>Restart</button>
          <button onClick={()=>alert("Upload file to computer")} style={{border:"1px solid #374151",background:"#1f2937",color:"#e5e7eb",borderRadius:8,padding:"6px 10px",fontSize:12,cursor:"pointer"}}>Upload File</button>
          <span style={{marginLeft:"auto",color:"#9ca3af",fontSize:11,alignSelf:"center"}}>Session isolated per task • Auto-snapshot every 5 min</span>
        </div>
      </div>

      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:12,marginTop:14}}>
        <div style={{border:"1px solid #e5e7eb",borderRadius:12,padding:12}}>
          <div style={{fontWeight:600,fontSize:13}}>Resource Usage</div>
          <div style={{marginTop:8}}>
            {[
              {k:"CPU",v:38,note:"1 vCPU • Starter"},
              {k:"RAM",v:62,note:"1.2 / 2 GB"},
              {k:"Disk",v:44,note:"22 / 50 GB"},
              {k:"GPU",v:0,note:"Idle — billed per sec when video_gen"},
            ].map(r=>(
              <div key={r.k} style={{marginTop:8}}>
                <div style={{display:"flex",justifyContent:"space-between",fontSize:12}}><span>{r.k}</span><span style={{color:"#6b7280"}}>{r.v}% • {r.note}</span></div>
                <div style={{height:6,background:"#e5e7eb",borderRadius:999,marginTop:4}}><div style={{width:`${r.v}%`,height:"100%",background:r.v>80?"#dc2626":"#2563eb",borderRadius:999}}/></div>
              </div>
            ))}
          </div>
          <div style={{fontSize:11,color:"#6b7280",marginTop:8}}>Starter plan: 1 vCPU / 2 GB RAM • Pro: 2 vCPU / 4 GB • Auto-scale for video_gen on GPU pool</div>
        </div>

        <div style={{border:"1px solid #e5e7eb",borderRadius:12,padding:12}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div style={{fontWeight:600,fontSize:13}}>File Relay</div>
            <label style={{display:"flex",alignItems:"center",gap:6,fontSize:12,cursor:"pointer"}}><input type="checkbox" checked={relay} onChange={e=>setRelay(e.target.checked)}/> Auto-relay</label>
          </div>
          <div style={{fontSize:12,color:"#6b7280",marginTop:6}}>ซิงก์ไฟล์ระหว่าง Computer ↔ Cloud Drive ↔ Deliverables อัตโนมัติ</div>
          <div style={{marginTop:10,background:"#f9fafb",border:"1px solid #e5e7eb",borderRadius:10,padding:10}}>
            {[
              {f:"landing.zip",from:"/home/woibot/landing → /Deliverables/landing.zip",when:"2 min ago",ok:true},
              {f:"Q3_Deck.pptx",from:"/home/woibot/deck → /Deliverables/Q3_Deck.pptx",when:"12 min ago",ok:true},
              {f:"ugc_raw.mp4",from:"/Cloud Drive/Video → /home/woibot/input.mp4",when:"1 h ago",ok:true},
            ].map(r=>(
              <div key={r.f} style={{display:"flex",gap:8,padding:"6px 0",borderBottom:"1px solid #f3f4f6",fontSize:12}}>
                <span style={{color:r.ok?"#16a34a":"#dc2626"}}>{r.ok?"✓":"•"}</span>
                <div><div style={{fontWeight:600}}>{r.f}</div><div style={{color:"#6b7280",fontSize:11}}>{r.from}</div></div>
                <span style={{marginLeft:"auto",color:"#9ca3af",fontSize:11}}>{r.when}</span>
              </div>
            ))}
          </div>
          <div style={{display:"flex",gap:6,marginTop:8}}>
            <button onClick={()=>alert("Open Cloud Drive file picker")} style={{border:"1px solid #e5e7eb",background:"#fff",borderRadius:8,padding:"6px 10px",fontSize:12,cursor:"pointer"}}>Send to Computer</button>
            <button onClick={()=>alert("Pull from Computer to Drive")} style={{border:"1px solid #e5e7eb",background:"#fff",borderRadius:8,padding:"6px 10px",fontSize:12,cursor:"pointer"}}>Pull to Drive</button>
          </div>
        </div>

        <div style={{border:"1px solid #e5e7eb",borderRadius:12,padding:12}}>
          <div style={{fontWeight:600,fontSize:13}}>Sessions & Logs</div>
          <div style={{fontSize:12,color:"#6b7280",marginTop:6}}>ทุกการกระทำมี traceId + audit log</div>
          <div style={{marginTop:10,background:"#0d0d0d",color:"#e5e7eb",borderRadius:10,padding:10,fontFamily:"ui-monospace,monospace",fontSize:11,lineHeight:1.6}}>
            <div>[14:22:10] task tsk_001 — build started</div>
            <div>[14:22:18] ✓ typecheck passed</div>
            <div>[14:22:22] preview: https://…/preview</div>
            <div>[14:22:30] file relay: landing.zip → deliverables</div>
            <div style={{color:"#9ca3af"}}>[14:22:31] verification queued</div>
          </div>
          <div style={{display:"flex",gap:6,marginTop:8}}>
            <button onClick={()=>alert("View full logs")} style={{border:"1px solid #e5e7eb",background:"#fff",borderRadius:8,padding:"6px 10px",fontSize:12,cursor:"pointer"}}>Full Logs</button>
            <button onClick={()=>alert("Download snapshot")} style={{border:"1px solid #e5e7eb",background:"#fff",borderRadius:8,padding:"6px 10px",fontSize:12,cursor:"pointer"}}>Snapshot</button>
          </div>
        </div>
      </div>
    </div>
  );
}
