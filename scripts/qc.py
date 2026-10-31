#!/usr/bin/env python3
"""
woibot QC gate — proves every advertised capability works on the live system.

Run:  python scripts/qc.py [--base https://woibot.com]
Exit code 0 only when every check passes. Each check prints PASS/FAIL with the
evidence it actually received (no optimistic defaults).
"""
import argparse, base64, json, os, sys, time, urllib.request, urllib.error, urllib.parse, http.cookiejar

EMAIL = os.environ.get("QC_EMAIL", "takin@woibot.com")
PASSWORD = os.environ.get("QC_PASSWORD", "Woibot-Strong-Pass-2026")

results = []

def rec(name, ok, detail=""):
    results.append((name, ok, detail))
    print(("PASS " if ok else "FAIL ") + name + ("  — " + str(detail)[:180] if detail else ""))

class Client:
    def __init__(self, base):
        self.base = base.rstrip("/")
        self.jar = http.cookiejar.CookieJar()
        self.opener = urllib.request.build_opener(urllib.request.HTTPCookieProcessor(self.jar))

    def call(self, path, body=None, method=None, timeout=320, raw=False):
        url = self.base + path
        data = json.dumps(body).encode() if body is not None else None
        req = urllib.request.Request(url, data=data, method=method or ("POST" if data else "GET"))
        req.add_header("Content-Type", "application/json")
        req.add_header("User-Agent", "woibot-qc/1.0")
        try:
            with self.opener.open(req, timeout=timeout) as r:
                payload = r.read()
                if raw:
                    return r.status, payload, dict(r.headers)
                try:
                    return r.status, json.loads(payload or b"{}"), dict(r.headers)
                except Exception:
                    return r.status, {"_raw": payload[:400].decode("utf-8", "ignore")}, dict(r.headers)
        except urllib.error.HTTPError as e:
            return e.code, {"error": e.read()[:400].decode("utf-8", "ignore")}, dict(e.headers)

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--base", default=os.environ.get("QC_BASE", "https://woibot.com"))
    ap.add_argument("--only", default="", help="comma separated subset: doc,xlsx,csv,pdf,image,video,research,coding,chat,voice,team")
    args = ap.parse_args()
    only = {s.strip() for s in args.only.split(",") if s.strip()}
    c = Client(args.base)

    st, body, _ = c.call("/api/auth/login", {"email": EMAIL, "password": PASSWORD})
    if st != 200:
        st, body, _ = c.call("/api/auth/signup", {"email": EMAIL, "password": PASSWORD, "name": "QC"})
    rec("auth.login", st == 200, f"HTTP {st}")

    st, comp, _ = c.call("/api/computer?action=ensure", timeout=240)
    comp = (comp or {}).get("computer", {})
    rec("computer.running", comp.get("status") == "running", comp.get("name"))

    kinds = []
    if not only or "doc" in only: kinds.append(("doc", "QC — รายงานผู้บริหาร", "เขียนรายงานผู้บริหาร 3 หัวข้อ มีตาราง KPI"))
    if not only or "xlsx" in only: kinds.append(("data", "QC — ตาราง Excel ยอดขาย", "สร้างไฟล์ Excel (xlsx) สรุปยอดขายพร้อมสูตรและกราฟ"))
    if not only or "csv" in only: kinds.append(("data", "QC — ไฟล์ CSV ลูกค้า", "สร้างไฟล์ csv รายชื่อลูกค้าพร้อมคอลัมน์พื้นฐาน"))
    if not only or "research" in only: kinds.append(("research", "QC — วิเคราะห์ตลาด AI teammate", "เปรียบเทียบผู้เล่นหลักและอ้างอิงแหล่งข้อมูล"))
    if not only or "video" in only: kinds.append(("video_analysis", "QC — วิเคราะห์คลิป", "ตรวจวิดีโอใน workspace และตัดไฮไลต์"))
    if not only or "coding" in only: kinds.append(("coding", "QC — หน้า landing เล็ก", "สร้างหน้า HTML เดียวที่ใช้งานได้"))

    task_ids = {}
    for kind, title, goal in kinds:
        st, res, _ = c.call("/api/tasks", {"title": title, "product": "work", "workKind": kind, "goal": goal})
        data = (res or {}).get("data") or res or {}
        tid = data.get("id") or (data.get("task") or {}).get("id")
        if st >= 300 or not tid:
            rec(f"task.create.{kind}", False, res)
            continue
        task_ids[kind] = tid
        rec(f"task.create.{kind}", True, tid)

        st, run, _ = c.call(f"/api/tasks/{tid}/run", {}, timeout=300)
        st2, fresh, _ = c.call(f"/api/tasks/{tid}")
        task = (fresh or {}).get("data") or (fresh or {}).get("task") or (run or {}).get("task") or {}
        ver = (run or {}).get("verification") or {}
        files = [d.get("fileName") for d in task.get("deliverables", [])]
        rec(f"task.run.{kind}", task.get("status") == "completed", f"status={task.get('status')} err={(run or {}).get('error')}")
        rec(f"task.files.{kind}", len(files) > 0, files)
        rec(f"task.verify.{kind}", ver.get("mode") == "live" and bool(ver.get("passed")), ver.get("summary"))

        if files:
            st, blob, headers = c.call(f"/api/tasks/{tid}/deliverable?path={urllib.parse.quote(files[0])}", raw=True)
            rec(f"task.download.{kind}", st == 200 and len(blob) > 80, f"{len(blob)} bytes {headers.get('Content-Type')}")

    if not only or "chat" in only:
        st, res, _ = c.call("/api/chat", {"teammateId": "tm_main", "message": "ตอบสั้นๆ: วันนี้ฉันควรโฟกัสอะไร"})
        txt = json.dumps(res)[:200]
        rec("chat.reply", st == 200 and bool((res.get("data") or {}).get("assistantMessage") or (res.get("data") or {}).get("reply") or res.get("reply")), txt)

    if not only or "image" in only:
        png = base64.b64encode(bytes.fromhex(
            "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000a49444154789c6300010000050001"
            "0d0a2db40000000049454e44ae426082")).decode()
        st, up, _ = c.call("/api/uploads", {"fileName": "qc-sample.png", "dataUrl": "data:image/png;base64," + png})
        rec("upload.image", st == 200 and bool((up or {}).get("ok")), json.dumps(up)[:120])
        st, res, _ = c.call("/api/tasks", {"title": "QC — อ่านภาพ", "product": "work", "workKind": "image",
                                           "goal": "อ่านภาพที่อัปโหลดและสรุปว่าเห็นอะไร"})
        data = (res or {}).get("data") or {}
        tid_i = data.get("id")
        if tid_i:
            c.call(f"/api/tasks/{tid_i}/run", {}, timeout=300)
            st2, fresh, _ = c.call(f"/api/tasks/{tid_i}")
            task_i = (fresh or {}).get("data") or {}
            ver_i = json.loads(task_i.get("verification") or "{}") if isinstance(task_i.get("verification"), str) else (task_i.get("verification") or {})
            rec("task.run.image", task_i.get("status") == "completed", task_i.get("status"))
            rec("task.verify.image", ver_i.get("mode") == "live" and bool(ver_i.get("passed")), ver_i.get("summary"))
        else:
            rec("task.run.image", False, res)

        png = base64.b64encode(bytes.fromhex(
            "89504e470d0a1a0a0000000d49484452000000010000000108060000001f15c4890000000a49444154789c6300010000050001"
            "0d0a2db40000000049454e44ae426082")).decode()
        st, res, _ = c.call("/api/chat", {"teammateId": "tm_main", "message": "ภาพนี้คืออะไร",
                                          "images": ["data:image/png;base64," + png]})
        rec("chat.vision", st == 200, json.dumps(res)[:160])

    if not only or "voice" in only:
        st, res, _ = c.call("/api/voice/command", {"text": "ถ่ายภาพหน้าจอ"})
        rec("voice.command", st == 200, json.dumps(res)[:200])

    if not only or "team" in only:
        st, mates, _ = c.call("/api/teammate")
        ids = [t["id"] for t in (mates.get("teammates") or [])][:2]
        if len(ids) >= 2:
            st, g, _ = c.call("/api/team/groups", {"name": "QC Squad", "memberIds": ids})
            rec("team.group", st == 200, json.dumps(g)[:150])
            st, d, _ = c.call("/api/team/delegate", {"fromId": ids[0], "toId": ids[1], "message": "ช่วยสรุปงานที่ค้างให้หน่อย"})
            rec("team.delegate", st == 200 and bool((d or {}).get("reply")), json.dumps(d)[:160])
        else:
            rec("team.group", False, "fewer than 2 teammates")

    ok = sum(1 for _, o, _ in results if o)
    total = len(results)
    print(f"\n{'='*60}\nQC RESULT: {ok}/{total} checks passed")
    if ok != total:
        print("FAILED:", ", ".join(n for n, o, _ in results if not o))
    return 0 if ok == total else 1

if __name__ == "__main__":
    sys.exit(main())
