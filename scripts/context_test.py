#!/usr/bin/env python3
"""
Context-understanding field test for the woibot teammate chat.

Simulates a real user pasting CONTENT and then asking questions that can only
be answered by actually understanding that content (pronouns, inference,
updated state). Objective checks — no LLM judge needed:

  T1  paste meeting notes            (setup)
  T2  "ใครทำฝั่ง design / งบเท่าไร"   → น้องพิมพ์ + 850,000   (recall + pronoun)
  T3  inference                      → API พร้อม 10 ธ.ค. ก่อนส่ง 15 ธ.ค. → ทันถ้าเริ่มทันที
  T4  update: งบเพิ่มเป็น 1,200,000  → ถามงบใหม่ต้องตอบ 1,200,000 (state tracking)
  T5  negation: "ยกเลิกผู้รับผิดชอบ design" แล้วถามใครทำ design → ต้องบอกว่าไม่มีแล้ว

Run:  python scripts/context_test.py [--base https://woibot.com]
Exit 0 iff every check passes.
"""
import argparse, json, os, sys, time, urllib.request, urllib.error

EMAIL = os.environ.get("QC_EMAIL", "takin@woibot.com")
PASSWORD = os.environ.get("QC_PASSWORD", "Woibot-Strong-Pass-2026")

NOTES = (
    "นี่คือบันทึกประชุมโครงการ Nova จดไว้ให้:\n"
    "- ลูกค้า: TSK Logistics\n"
    "- กำหนดส่งงาน: 15 ธันวาคม 2569\n"
    "- งบประมาณ: 850,000 บาท\n"
    "- ผู้รับผิดชอบ backend: พี่มานะ\n"
    "- ผู้รับผิดชอบ design: น้องพิมพ์\n"
    "- ความเสี่ยงหลัก: API ของลูกค้าจะพร้อมช้าที่สุด 10 ธันวาคม\n"
    "- ขอบเขต: ระบบ track การขนส่ง + แดชบอร์ดสำหรับหัวหน้าคนขับ"
)

TURNS = [
    {
        "name": "setup.paste_notes",
        "message": NOTES,
        "checks": [],
    },
    {
        "name": "recall.pronoun",
        "message": "ตอบสั้นๆ จากบันทึกที่เพิ่งให้: ใครรับผิดชอบฝั่ง design และงบประมาณโครงการเท่าไร",
        "checks": ["พิมพ์", "850,000"],
    },
    {
        "name": "inference.deadline",
        "message": "ตอบสั้นๆ พร้อมเหตุผล: ถ้า API ของลูกค้าพร้อมวันที่ 10 ธันวาคม งานจะเสร็จทันกำหนดส่ง 15 ธันวาคมไหม",
        "checks_any": ["ทัน", "ได้", "เหลือ 5", "5 วัน"],
        "checks": [],
    },
    {
        "name": "state.update_budget",
        "message": "อัปเดตบันทึก: งบประมาณเพิ่มเป็น 1,200,000 บาท จำแทนตัวเดิม\nแล้วตอบสั้นๆ: งบประมาณโครงการ Nova ตอนนี้เท่าไร",
        "checks": ["1,200,000"],
        "must_not": ["850,000 บาท คือ"],
    },
    {
        "name": "state.negation",
        "message": "อัปเดตบันทึก: น้องพิมพ์ย้ายทีมแล้ว ยกเลิกให้เธอรับผิดชอบ design (ยังไม่มีคนใหม่)\nแล้วตอบสั้นๆ: ตอนนี้ใครรับผิดชอบฝั่ง design",
        "checks_any": ["ยังไม่มี", "ไม่มีคน", "ว่าง", "กำลังหา"],
        "checks": [],
        "must_not": ["น้องพิมพ์รับผิดชอบ"],
    },
]


def call(base, path, payload, cookie, timeout=180):
    data = json.dumps(payload, ensure_ascii=False).encode("utf-8")
    req = urllib.request.Request(base + path, data=data, method="POST")
    req.add_header("Content-Type", "application/json; charset=utf-8")
    req.add_header("Cookie", cookie)
    req.add_header("User-Agent", "Mozilla/5.0")
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            return json.loads(r.read().decode("utf-8"))
    except urllib.error.HTTPError as e:
        return {"_status": e.code}


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--base", default=os.environ.get("QC_BASE", "https://woibot.com"))
    args = ap.parse_args()

    # login
    data = json.dumps({"email": EMAIL, "password": PASSWORD}).encode("utf-8")
    req = urllib.request.Request(args.base + "/api/auth/login", data=data, method="POST")
    req.add_header("Content-Type", "application/json")
    req.add_header("User-Agent", "Mozilla/5.0")
    try:
        with urllib.request.urlopen(req, timeout=60) as r:
            cookie = r.headers.get("Set-Cookie", "").split(";")[0]
    except Exception as e:
        print("FAIL auth.login —", e)
        return 2

    results = []
    for t in TURNS:
        res = call(args.base, "/api/chat", {"teammateId": "tm_main", "message": t["message"]}, cookie)
        d = res.get("data") or {}
        am = d.get("assistantMessage") or {}
        reply = str(am.get("content") or d.get("reply") or "")
        ok = True
        notes = []
        for k in t.get("checks", []):
            if k not in reply:
                ok = False
                notes.append(f"missing:{k}")
        any_list = t.get("checks_any") or []
        if any_list and not any(a in reply for a in any_list):
            ok = False
            notes.append("missing_any:" + "/".join(any_list))
        for k in t.get("must_not", []):
            if k in reply:
                ok = False
                notes.append(f"must_not:{k}")
        results.append((t["name"], ok, "; ".join(notes) or "ok"))
        print(("PASS " if ok else "FAIL ") + t["name"] + "  — " + ("; ".join(notes) or "ok"))
        print("   reply: " + reply[:180].replace("\n", " "))

    ok_n = sum(1 for _, o, _ in results if o)
    print(f"\nCONTEXT RESULT: {ok_n}/{len(results)}")
    return 0 if ok_n == len(results) else 1


if __name__ == "__main__":
    sys.exit(main())