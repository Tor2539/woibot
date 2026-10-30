import React from "react";

export default function Home() {
  return (
    <main style={{fontFamily:"system-ui", maxWidth:960, margin:"0 auto", padding:"40px 20px"}}>
      <header style={{display:"flex", justifyContent:"space-between", alignItems:"center"}}>
        <strong style={{fontSize:22}}>woibot<span style={{color:"#1757d7"}}>.com</span></strong>
        <nav style={{display:"flex", gap:16, fontSize:14}}>
          <a href="#teammate">Teammate</a><a href="#work">Work</a><a href="#pricing">Pricing</a>
        </nav>
      </header>
      <section style={{marginTop:48}}>
        <h1 style={{fontSize:44, lineHeight:1.1}}>Your Personal AI Team<br/>That Actually Gets Work Done.</h1>
        <p style={{color:"#555", fontSize:18, marginTop:16}}>Teammate ดูแลทุกวัน — Work ลงมือทำจนส่งมอบไฟล์จริง • สั่งงาน → ลงมือทำ → ตรวจสอบ → ส่งมอบ → ทำงานต่อ</p>
        <div style={{display:"flex", gap:12, marginTop:24}}>
          <a href="#demo" style={{background:"#0d0d0d", color:"#fff", padding:"12px 20px", borderRadius:999, textDecoration:"none"}}>Talk to your Teammate</a>
          <span style={{alignSelf:"center", color:"#777"}}>Cloud Computer ส่วนตัว + Work แยกต้นทุนโปร่งใส</span>
        </div>
        <div style={{display:"grid", gridTemplateColumns:"1fr 1fr", gap:16, marginTop:36}}>
          <div style={{border:"1px solid #e5e5e5", borderRadius:16, padding:20}}>
            <h3>Teammate</h3><p style={{color:"#555"}}>แชท/เสียง, Memory, Connected Apps, Routines, ติดตามงานค้าง — Cloud Only, 24h</p>
            <ul><li>Daily briefing 08:00</li><li>สรุปอีเมล/ปฏิทิน</li><li>Handoff ไป Work อัตโนมัติ</li></ul>
          </div>
          <div style={{border:"1px solid #e5e5e5", borderRadius:16, padding:20}}>
            <h3>Work</h3><p style={{color:"#555"}}>Coding / Docs / Video / Research — ส่งไฟล์ที่เปิดใช้ได้จริง + รายงานตรวจสอบ</p>
            <ul><li>Cloud หรือ Local</li><li>Estimate ก่อนเริ่ม</li><li>Verification per-type</li></ul>
          </div>
        </div>
      </section>
      <section id="pricing" style={{marginTop:48, borderTop:"1px solid #eee", paddingTop:24}}>
        <h2>Pricing — แยก Teammate / Work ชัดเจน</h2>
        <p style={{color:"#555"}}>Teammate = subscription เข้าถึงง่าย • Work = จ่ายตามงานหนัก (estimate ก่อนเริ่ม, ตั้งวงเงินได้) วิดีโอใช้ GPU pool แยก ไม่กระทบ Teammate</p>
      </section>
    </main>
  );
}
