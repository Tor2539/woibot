#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
benchmark_teammate.py — woibot teammate capability benchmark (objective item 7).

Scores the woibot teammate (https://woibot.com) against a "grok bot"-level bar
across 6 categories / 14 tasks, using a strict LLM rubric judge (Together AI,
DeepSeek-V4.1-Flash) plus objective keyword/structural checks.

Confirmed API shapes (read from apps/web/app/api/* before writing this script):

  POST /api/auth/login            body {email, password}
      -> 200 {ok:true, user:{id,email,name}}  + Set-Cookie: wb_session=<jwt>
  POST /api/chat                  body {message, teammateId?, effort?, ...}
      -> {ok:true, data:{message, assistantMessage:{content, meta}, routed, reply}}
      NOTE: when routed.product == "work" the server returns a CANNED handoff
      text (no model answer). lib/harness routeIntent() triggers "work" on
      words like: สร้างเว็บ|สร้างแอป|สร้างระบบ|build|create.*app|ทำคลิป|วิดีโอ|video|
      generate|รายงาน.*หน้า|presentation|วิเคราะห์.*ข้อมูล|research|เอกสาร.*หน้า|
      ทำสไลด์|ทำกราฟ|dashboard|compare|สัญญา|contract
      -> chat-task prompts below are deliberately phrased to exercise the
      teammate's DIRECT answer path (the thing being benchmarked); a startup
      lint re-checks every prompt against the same regex and warns.
  GET  /api/chat?teammateId=...   -> {ok:true, data:{teammate, teammates, messages}}
  POST /api/team/groups           {name, memberIds, tone?} -> {ok:true, group}
                                  {action:"share_memory", groupId, fromTeammateId,
                                   key, value} -> {ok:true, memory, group}
  GET  /api/team/groups           -> {ok:true, groups, count, sharedMemories}
  DELETE /api/team/groups?id=...  -> {ok:true, deleted, removedMemories}
  POST /api/team/delegate         {fromId, toId, message, groupId?}
      -> {ok:true, reply, provider, from, to, memoriesUsed, ...}  (NOT wrapped
      in "data" — unwrap() handles both shapes)
  GET  /api/memories/search?q=...&k=5 -> {ok:true, query, model, results:[...]}
      (the handoff notes said POST; the route is GET — POST is tried as fallback)

Constraints from lib/collab.ts honored here: group name <= 80 chars,
memberIds must be real non-group teammates, share_memory key <= 64 /
value <= 4000, delegate fromId != toId, message <= 4000 chars, and both bots
must be members of the group when groupId is given.

Judge policy: Together ONLY, model deepseek-ai/DeepSeek-V4.1-Flash-1017,
endpoint https://api.together.xyz/v1/chat/completions, User-Agent: Mozilla/5.0.
NEVER send response_format json_object (DeepSeek V4.1 Flash returns empty
content with it) — JSON is requested in the prompt; max_tokens >= 2000.

Usage:
  python scripts/benchmark_teammate.py [--base URL] [--email E] [--password P]
      [--judge-model M] [--out DIR] [--only CATEGORY] [--runs N] [--keep-artifacts]

Exit codes: 0 = PASS (total >= 9.0, no missing scores)
            1 = FAIL (total < 9.0; reports still written)
            2 = environment error (API unreachable / login failed / bad args)
            3 = reports written but some task has no score (API/judge failure)
This script never invents scores: missing scores are reported as null.
Stdlib only (urllib, json, time, argparse, re, statistics, ...).
"""

from __future__ import annotations

import argparse
import datetime
import json
import os
import re
import socket
import statistics
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

# --------------------------------------------------------------------------
# Constants
# --------------------------------------------------------------------------

DEFAULT_BASE = "https://woibot.com"
DEFAULT_EMAIL = "takin@woibot.com"
DEFAULT_PASSWORD = "Woibot-Strong-Pass-2026"

JUDGE_URL = "https://api.together.xyz/v1/chat/completions"
JUDGE_API_KEY = "TOGETHER_API_KEY_ENV"
JUDGE_UA = "Mozilla/5.0"
JUDGE_MODEL_DEFAULT = "deepseek-ai/DeepSeek-V4.1-Flash-1017"
JUDGE_MAX_TOKENS = 2000          # spec: >= 2000
JUDGE_TEMPERATURE = 0.0

SESSION_COOKIE = "wb_session"
CHAT_TIMEOUT = 240.0             # spec: 240s per chat task
API_TIMEOUT = 60.0
JUDGE_TIMEOUT = 150.0
RETRIES = 2                      # spec: retries x2
BACKOFF = (1.5, 4.0)
THRESHOLD = 9.0

UA_BENCHMARK = "woibot-benchmark/1.0 (+https://woibot.com)"

CATEGORIES = [
    "factual-knowledge",
    "thai-writing",
    "data-analysis",
    "web-research",
    "reasoning-math",
    "teamwork",
]

# Mirror of routeIntent()'s work-trigger regex (JS: input.toLowerCase(), no /s
# flag so "." does not cross newlines — Python default matches that). Used ONLY
# to warn if a chat prompt would be hijacked to the Work handoff path.
ROUTER_WORK_TRIGGER = re.compile(
    r"(สร้างเว็บ|สร้างแอป|สร้างระบบ|build|create.*app|ทำคลิป|วิดีโอ|video|generate"
    r"|รายงาน.*หน้า|presentation|วิเคราะห์.*ข้อมูล|research|เอกสาร.*หน้า|ทำสไลด์"
    r"|ทำกราฟ|dashboard|compare|สัญญา|contract)"
)

SOURCE_PATTERN = re.compile(
    r"(https?://\S+|www\.[^\s]+|\b[a-z0-9-]{2,}\.(?:com|net|org|io|co\.th|th|gov|edu|ai)\b"
    r"|investing\.com|bloomberg|reuters|marketwatch|yahoo finance|google finance"
    r"|tradingview|nasdaq|cnbc|energy information administration|\beia\b"
    r"|ตลาดหลักทรัพย์|ประชาชน|ธนาคาร)",
    re.IGNORECASE,
)

# --------------------------------------------------------------------------
# Errors
# --------------------------------------------------------------------------


class EnvError(Exception):
    """Environment failure: unreachable API, login failure, bad CLI args."""


class TaskError(Exception):
    """A single task's API call failed (product/infra) — score becomes null."""


class JudgeError(Exception):
    """The judge LLM call itself failed."""


# --------------------------------------------------------------------------
# HTTP layer (stdlib urllib, resilient: timeouts + retries x2)
# --------------------------------------------------------------------------


class HttpResult:
    def __init__(self, status: int, body_text: str, headers):
        self.status = status
        self.body_text = body_text or ""
        self.headers = headers

    @property
    def json(self):
        if not self.body_text:
            return None
        try:
            return json.loads(self.body_text)
        except Exception:
            return None


def http_request(
    method: str,
    url: str,
    body=None,
    headers=None,
    timeout: float = API_TIMEOUT,
    retries: int = RETRIES,
) -> HttpResult:
    """One HTTP request with JSON body. Retries on network errors and
    429/5xx (with backoff); returns the final HttpResult otherwise."""
    last_err = None
    for attempt in range(retries + 1):
        data = None
        if body is not None:
            data = json.dumps(body, ensure_ascii=False).encode("utf-8")
        req = urllib.request.Request(url, data=data, method=method)
        req.add_header("Content-Type", "application/json")
        req.add_header("Accept", "application/json")
        req.add_header("User-Agent", UA_BENCHMARK)
        for k, v in (headers or {}).items():
            req.add_header(k, v)
        try:
            with urllib.request.urlopen(req, timeout=timeout) as resp:
                return HttpResult(resp.status, resp.read().decode("utf-8", "replace"), resp.headers)
        except urllib.error.HTTPError as e:
            text = ""
            try:
                text = e.read().decode("utf-8", "replace")
            except Exception:
                pass
            res = HttpResult(e.code, text, e.headers)
            if e.code in (429, 500, 502, 503, 504) and attempt < retries:
                time.sleep(BACKOFF[min(attempt, len(BACKOFF) - 1)])
                continue
            return res
        except OSError as e:  # URLError, socket.timeout, ConnectionReset, ...
            last_err = e
            if attempt < retries:
                time.sleep(BACKOFF[min(attempt, len(BACKOFF) - 1)])
                continue
        except Exception as e:  # noqa: BLE001 — any other transport hiccup
            last_err = e
            if attempt < retries:
                time.sleep(BACKOFF[min(attempt, len(BACKOFF) - 1)])
                continue
    raise EnvError(f"network error calling {method} {url}: {last_err!r}")


def unwrap(js):
    """Chat routes wrap payloads in {ok, data}; team/delegate does not."""
    if isinstance(js, dict) and js.get("ok") is True and isinstance(js.get("data"), (dict, list)):
        return js["data"]
    return js


def extract_session_cookie(headers) -> str | None:
    try:
        cookies = headers.get_all("Set-Cookie") or []
    except Exception:
        cookies = []
    for value in cookies:
        for part in str(value).split(";"):
            part = part.strip()
            if part.startswith(SESSION_COOKIE + "="):
                return part[len(SESSION_COOKIE) + 1:]
    return None


# --------------------------------------------------------------------------
# woibot API client
# --------------------------------------------------------------------------


class WoibotClient:
    def __init__(self, base: str, cookie: str):
        self.base = base.rstrip("/")
        self.h = {"Cookie": f"{SESSION_COOKIE}={cookie}"}

    def _ok(self, res: HttpResult, what: str):
        js = res.json
        if res.status != 200 or not isinstance(js, dict) or js.get("ok") is not True:
            err = ""
            if isinstance(js, dict):
                err = str(js.get("error") or "")
            raise TaskError(f"{what}: HTTP {res.status} {err or res.body_text[:200]}")
        return js

    # -- discovery ---------------------------------------------------------

    def teammates(self):
        res = http_request(
            "GET", f"{self.base}/api/chat?teammateId=benchmark-probe", headers=self.h, timeout=API_TIMEOUT
        )
        js = self._ok(res, "GET /api/chat (teammate discovery)")
        data = unwrap(js)
        return data.get("teammates") or []

    # -- chat ----------------------------------------------------------------

    def chat(self, teammate_id: str, message: str):
        """POST /api/chat. Returns (reply_text, routed_product, model_label)."""
        res = http_request(
            "POST",
            f"{self.base}/api/chat",
            body={"message": message, "teammateId": teammate_id},
            headers=self.h,
            timeout=CHAT_TIMEOUT,
        )
        js = self._ok(res, "POST /api/chat")
        data = unwrap(js)
        reply = str(data.get("reply") or "")
        if not reply:
            am = data.get("assistantMessage") or {}
            reply = str(am.get("content") or "")
        routed = ((data.get("routed") or {}).get("product")) if isinstance(data.get("routed"), dict) else None
        am_meta = (data.get("assistantMessage") or {}).get("meta")
        if isinstance(am_meta, str):
            try:
                am_meta = json.loads(am_meta)
            except Exception:
                am_meta = {}
        model_label = ""
        if isinstance(am_meta, dict):
            model_label = str(am_meta.get("model") or am_meta.get("provider") or "")
        return reply, routed, model_label

    # -- team collaboration --------------------------------------------------

    def create_group(self, name: str, member_ids, tone=None):
        body = {"name": name, "memberIds": list(member_ids)}
        if tone:
            body["tone"] = tone
        res = http_request("POST", f"{self.base}/api/team/groups", body=body, headers=self.h, timeout=API_TIMEOUT)
        js = self._ok(res, "POST /api/team/groups (create)")
        return js.get("group") or {}

    def share_memory(self, group_id: str, from_teammate_id: str, key: str, value: str):
        body = {"action": "share_memory", "groupId": group_id, "fromTeammateId": from_teammate_id, "key": key, "value": value}
        res = http_request("POST", f"{self.base}/api/team/groups", body=body, headers=self.h, timeout=API_TIMEOUT)
        js = self._ok(res, "POST /api/team/groups (share_memory)")
        return js.get("memory") or {}, js.get("group") or {}

    def list_groups(self):
        res = http_request("GET", f"{self.base}/api/team/groups", headers=self.h, timeout=API_TIMEOUT)
        js = self._ok(res, "GET /api/team/groups")
        return js.get("groups") or []

    def delete_group(self, group_id: str):
        url = f"{self.base}/api/team/groups?id={urllib.parse.quote(group_id)}"
        res = http_request("DELETE", url, headers=self.h, timeout=API_TIMEOUT)
        return res.status == 200 and isinstance(res.json, dict) and res.json.get("ok") is True

    def delegate(self, from_id: str, to_id: str, message: str, group_id=None):
        body = {"fromId": from_id, "toId": to_id, "message": message}
        if group_id:
            body["groupId"] = group_id
        res = http_request("POST", f"{self.base}/api/team/delegate", body=body, headers=self.h, timeout=CHAT_TIMEOUT)
        js = self._ok(res, "POST /api/team/delegate")
        return js

    def memory_search(self, q: str, k: int = 5):
        """GET /api/memories/search (route is GET; POST kept as fallback)."""
        url = f"{self.base}/api/memories/search?q={urllib.parse.quote(q)}&k={k}"
        res = http_request("GET", url, headers=self.h, timeout=API_TIMEOUT)
        if res.status in (404, 405):
            res = http_request("POST", f"{self.base}/api/memories/search", body={"q": q, "k": k}, headers=self.h, timeout=API_TIMEOUT)
        return res


def is_group_row(tm: dict) -> bool:
    if tm.get("isGroup") is True:
        return True
    persona = tm.get("persona")
    if isinstance(persona, str):
        try:
            persona = json.loads(persona)
        except Exception:
            persona = {}
    return isinstance(persona, dict) and persona.get("isGroup") is True


# --------------------------------------------------------------------------
# LLM judge (Together only, strict JSON-in-prompt, no response_format)
# --------------------------------------------------------------------------

JUDGE_SYSTEM = """คุณคือผู้ตัดสินคุณภาพ (QA judge) ที่เข้มงวด ยุติธรรม และไม่ปลอบใจใคร
หน้าที่คุณคือประเมิน "คำตอบของ AI teammate" ว่าอยู่ในระดับเดียวกับแชตบอทชั้นนำหรือไม่

สเกลคะแนน 0-10:
- 10 = สมบูรณ์แบบ: ถูกต้องครบทุกประเด็นสาระสำคัญ โครงสร้างดีเยี่ยม ภาษาลื่นไหล
- 9  = ถูกต้องครบถ้วน ระดับแชตบอทชั้นนำ มีจุดฟุ้งเฟ้อนิดเดียว
- 7-8 = ถูกต้องส่วนใหญ่ มีจุดพลาดเล็กน้อยที่ไม่กระทบสาระ
- 5-6 = ถูกบางส่วน ขาดประเด็นสำคัญ หรือโครงสร้างอ่อน
- 3-4 = มีข้อผิดพลาดสำคัญ ตอบไม่ตรงคำถาม หรือขาดข้อเท็จจริงหลัก
- 0-2 = ผิดเกือบทั้งหมด ว่างเปล่า เป็นข้อความ error ของระบบ หรือหลอกลวง/hallucinate รุนแรง

กติกาพิเศษ:
- งานที่ต้องใช้ข้อมูลสด (ราคา/ข่าวปัจจุบัน): การบอกตามจริงว่าเข้าถึงข้อมูลสดไม่ได้ + ให้บริบทที่มีอย่างซื่อสัตย์พร้อมระบุว่าอาจล้าสมัย + แนะนำแหล่งอ้างอิงเชื่อถือได้ = คะแนนดี (8-9 ถ้าครบและมีประโยชน์) ส่วนการเดาตัวเลขปัจจุบันอย่างมั่นใจโดยไม่บอกข้อจำกัด = 0-3
- คำตอบที่เป็นเพียงข้อความ "ส่งงานต่อให้ Work ทำ" (handoff) โดยไม่ตอบสาระของคำถาม = 0-2 (เว้นแต่งานนั้นคาดหวัง handoff จริง)
- คำตอบภาษาไทยที่อ่านไม่ลื่น เป็นแปลตรงตัว = ลด 1-2 คะแนน
- ผลตรวจเชิงกล (objective checks) ที่ระบุ (ADVISORY) ให้เพิกเฉย ส่วนที่เป็น PASS/FAIL ใช้เป็นหลักฐานประกอบการตัดสิน

ตอบด้วย JSON เดียวเท่านั้น ห้ามมีข้อความอื่นรอบนอก ไม่ต้องใช้ markdown fence:
{"score": <จำนวนเต็ม 0-10>, "note": "<เหตุผลสั้นๆ ไม่เกิน 40 คำ>"}"""


def build_judge_user(task: dict, prompt_shown: str, judged_text: str, checks: list) -> str:
    lines = []
    lines.append("## งานที่ได้รับมอบหมาย")
    lines.append(prompt_shown.strip() or "(n/a)")
    lines.append("")
    lines.append("## คำตอบ / ผลลัพธ์ที่ต้องประเมิน")
    lines.append(judged_text.strip() if judged_text.strip() else "(ว่างเปล่า)")
    lines.append("")
    lines.append("## ข้อเท็จจริงที่ถูกต้อง (ground truth จากผู้ทำเบนมาร์ค)")
    if task.get("facts"):
        lines.extend(f"- {f}" for f in task["facts"])
    else:
        lines.append("- (ไม่มีข้อเท็จจริงตายตัว — ใช้เกณฑ์คุณภาพด้านล่างเป็นหลัก)")
    lines.append("")
    lines.append("## เกณฑ์คุณภาพที่คำตอบควรมี")
    lines.extend(f"- {q}" for q in task.get("qualities", []))
    if checks:
        lines.append("")
        lines.append("## ผลตรวจเชิงกล (objective checks ตรวจโดยสคริปต์)")
        for c in checks:
            tag = "PASS" if c["result"] else "FAIL"
            adv = " (ADVISORY)" if c.get("advisory") else ""
            detail = f" — {c['detail']}" if c.get("detail") else ""
            lines.append(f"- {c['name']}: {tag}{adv}{detail}")
    lines.append("")
    lines.append("ประเมินอย่างเข้มงวด แล้วตอบ JSON เดียว: {\"score\": <0-10>, \"note\": \"...\"}")
    return "\n".join(lines)


def parse_judge_json(text: str):
    """Robustly pull {"score", "note"} out of a judge reply. Returns
    (score_or_None, note, raw_text)."""
    raw = text.strip()
    t = raw.replace("```json", "```")
    t = t.replace("```", "")
    m = re.search(r"\{.*\}", t, re.S)
    if m:
        try:
            obj = json.loads(m.group(0))
            if isinstance(obj, dict) and "score" in obj:
                score = float(obj["score"])
                note = str(obj.get("note") or "").strip()
                if 0.0 <= score <= 10.0:
                    return round(score, 1), note, raw
        except Exception:
            pass
    m2 = re.search(r'"score"\s*:\s*([0-9]+(?:\.[0-9]+)?)', t)
    if m2:
        score = float(m2.group(1))
        note = ""
        m3 = re.search(r'"note"\s*:\s*"((?:[^"\\]|\\.)*)"', t)
        if m3:
            try:
                note = json.loads('"' + m3.group(1) + '"')
            except Exception:
                note = m3.group(1)
        if 0.0 <= score <= 10.0:
            return round(score, 1), str(note).strip(), raw
    return None, "", raw


def call_judge(model: str, user_prompt: str) -> str:
    body = {
        "model": model,
        "messages": [
            {"role": "system", "content": JUDGE_SYSTEM},
            {"role": "user", "content": user_prompt},
        ],
        "max_tokens": JUDGE_MAX_TOKENS,
        "temperature": JUDGE_TEMPERATURE,
        # NOTE: deliberately NO response_format json_object — Together's
        # DeepSeek V4.1 Flash returns an empty content field with it.
    }
    res = http_request(
        "POST",
        JUDGE_URL,
        body=body,
        headers={"Authorization": f"Bearer {JUDGE_API_KEY}", "User-Agent": JUDGE_UA},
        timeout=JUDGE_TIMEOUT,
    )
    if res.status != 200:
        raise JudgeError(f"judge HTTP {res.status}: {res.body_text[:200]}")
    js = res.json or {}
    msg = ((js.get("choices") or [{}])[0].get("message") or {}) if isinstance(js, dict) else {}
    text = str(msg.get("content") or "").strip() or str(msg.get("reasoning_content") or "").strip()
    if not text:
        raise JudgeError("judge returned empty content")
    return text


def judge_task(model: str, task: dict, prompt_shown: str, judged_text: str, checks: list):
    """Returns (score|None, note, raw). One repair retry on unparseable JSON."""
    user_prompt = build_judge_user(task, prompt_shown, judged_text, checks)
    try:
        text = call_judge(model, user_prompt)
    except JudgeError as e:
        return None, f"judge failed: {e}", ""
    score, note, raw = parse_judge_json(text)
    if score is None:
        try:
            text = call_judge(model, user_prompt + "\n\n(ครั้งก่อนผมอ่าน JSON ไม่ได้ — ตอบด้วย JSON object เท่านั้น ไม่มีข้อความอื่น)")
        except JudgeError as e:
            return None, f"judge failed: {e}", ""
        score, note, raw = parse_judge_json(text)
        if score is None:
            return None, "judge reply unparseable", raw[:500]
    return score, note, raw[:500]


# --------------------------------------------------------------------------
# Objective checks
# --------------------------------------------------------------------------

THAI_RE = re.compile(r"[\u0E00-\u0E7F]")
ALPHA_RE = re.compile(r"[A-Za-z\u0E00-\u0E7F]")


def thai_ratio(text: str) -> float:
    alphas = ALPHA_RE.findall(text)
    if not alphas:
        return 0.0
    return len(THAI_RE.findall(text)) / len(alphas)


def run_checks(task: dict, judged_text: str, extras: dict) -> list:
    results = []
    for chk in task.get("checks", []):
        kind = chk.get("kind")
        name = chk.get("name", kind)
        result, detail, advisory = False, "", False
        if kind == "keywords":
            groups = chk.get("groups", [])
            missing = []
            for gi, group in enumerate(groups, 1):
                if not any(re.search(p, judged_text, re.IGNORECASE) for p in group):
                    missing.append(f"g{gi}")
            result = not missing
            detail = "all keyword groups found" if result else f"missing keyword group(s) {', '.join(missing)}"
        elif kind == "thai_ratio":
            ratio = thai_ratio(judged_text)
            result = ratio >= float(chk.get("min", 0.5))
            detail = f"thai char ratio {ratio:.2f} (min {chk.get('min', 0.5)})"
        elif kind == "min_len":
            n = int(chk.get("n", 40))
            result = len(judged_text.strip()) >= n
            detail = f"reply length {len(judged_text.strip())} (min {n})"
        elif kind == "sources":
            n = int(chk.get("n", 2))
            found = sorted({m.group(0).lower().strip('.') for m in SOURCE_PATTERN.finditer(judged_text)})
            result = len(found) >= n
            detail = f"{len(found)} source-like mentions (min {n})" + (f": {', '.join(found[:5])}" if found else "")
        elif kind == "handback":
            result = "HAND-BACK" in judged_text
            detail = "HAND-BACK line present" if result else "HAND-BACK line missing"
        elif kind == "extra":
            ex = extras.get(chk.get("key") or name) or {}
            result = bool(ex.get("ok"))
            detail = str(ex.get("detail") or "")
            advisory = bool(ex.get("advisory"))
            name = chk.get("name") or name
        else:  # unknown check kind — record as advisory, never silently pass
            result, advisory, detail = False, True, f"unknown check kind {kind!r}"
        results.append({"name": name, "result": result, "detail": detail, "advisory": advisory})
    return results


# --------------------------------------------------------------------------
# Task suite — 14 tasks / 6 categories
# --------------------------------------------------------------------------
# Chat tasks carry "prompt" (sent to POST /api/chat). Teamwork tasks carry
# "op" + "desc"; they exercise the real /api/team endpoints with discovered
# teammate ids. Prompts avoid routeIntent() work-triggers on purpose (see
# module docstring) — the startup lint re-verifies this.

TASKS = [
    # ---------------- factual-knowledge (3) ----------------
    {
        "id": "fk1",
        "category": "factual-knowledge",
        "title": "เมืองหลวงออสเตรเลีย",
        "prompt": (
            "คำถามความรู้ทั่วไป: เมืองหลวงของประเทศออสเตรเลียคือเมืองอะไร ตั้งอยู่ในเขต/ดินแดนใด "
            "และเพราะอะไรจึงไม่ได้ตั้งเมืองหลวงอยู่ที่ซิดนีย์ ตอบกระชับ 3-5 บรรทัด"
        ),
        "facts": [
            "เมืองหลวงคือแคนเบอร์รา (Canberra)",
            "ตั้งอยู่ใน Australian Capital Territory (ACT) — เขตปกครองพิเศษ ไม่ใช่รัฐใดๆ",
            "ซิดนีย์เป็นเมืองใหญ่ของรัฐนิวเซาท์เวลส์ ไม่ใช่เมืองหลวงประเทศ",
            "เหตุผล: ประนีประนอมระหว่างเมลเบิร์นกับซิดนีย์หลังสถาปนาสหพันธ์ (เลือกทำเลในปี 1908)",
        ],
        "qualities": [
            "ถูกต้องครบ 3 ประเด็น (เมือง / เขต ACT / เหตุผลที่ไม่ใช่ซิดนีย์)",
            "กระชับ ตรงประเด็น ไม่เยิ่นเย้อ",
            "ภาษาไทยลื่นไหล",
            "ไม่แต่งข้อเท็จจริงเพิ่มเอง",
        ],
        "checks": [
            {"kind": "keywords", "name": "mentions Canberra", "groups": [["canberra", "แคนเบอร์รา"]]},
            {"kind": "keywords", "name": "mentions ACT", "groups": [[r"\bact\b", "australian capital territory", "แคปปิตอล", "capital"]]},
            {"kind": "min_len", "name": "substantive length", "n": 60},
        ],
    },
    {
        "id": "fk2",
        "category": "factual-knowledge",
        "title": "อะพอลโล 11",
        "prompt": (
            "คำถามความรู้ทั่วไป: ภารกิจอะพอลโล 11 ลงจอดบนดวงจันทร์สำเร็จเมื่อปีใด ใครเป็นมนุษย์คนแรกที่ลงจอด "
            "ใครเป็นคนที่สอง และใครที่ต้องอยู่เวียนโคจรรอยานบนวงโคจรรอบดวงจันทร์ ตอบกระชับ"
        ),
        "facts": [
            "ปี 1969 (ลงจอด 20 กรกฎาคม 1969 เวลา UTC)",
            "คนแรก: Neil Armstrong (นีล อาร์มสตรอง)",
            "คนที่สอง: Buzz Aldrin (บัซ อัลดริน)",
            "คนที่อยู่บนยานในวงโคจร: Michael Collins (ไมเคิล คอลลินส์)",
        ],
        "qualities": [
            "ตรงกับ ground truth ครบทั้ง 4 ข้อ",
            "กระชับ ไม่เล่าเรื่องยาว",
            "ภาษาไทยลื่นไหล",
        ],
        "checks": [
            {"kind": "keywords", "name": "mentions 1969", "groups": [[r"1969"]]},
            {"kind": "keywords", "name": "mentions Armstrong", "groups": [["armstrong", "อาร์มสตรอง"]]},
            {"kind": "keywords", "name": "mentions Aldrin", "groups": [["aldrin", "อัลดริน"]]},
            {"kind": "min_len", "name": "substantive length", "n": 60},
        ],
    },
    {
        "id": "fk3",
        "category": "factual-knowledge",
        "title": "ปรากฏการณ์เรือนกระจก",
        "prompt": (
            "ความรู้ทั่วไป: ปรากฏการณ์เรือนกระจกเกิดจากอะไร แก๊สใดที่มนุษย์ปล่อยและมีส่วนมากที่สุด "
            "และดาวเคราะห์ดวงใดในระบบสุริยะที่เกิดปรากฏการณ์นี้รุนแรงจนพื้นผิวร้อนจัด ตอบกระชับ 3-5 บรรทัด"
        ),
        "facts": [
            "เกิดจากแก๊สเรือนกระจกดูดซับและแผ่รังสีอินฟราเรด (ความร้อน) กลับคืนมา ทำให้ความร้อนค้างในบรรยากาศ",
            "แก๊สหลักจากกิจกรรมมนุษย์คือ CO2 (คาร์บอนไดออกไซด์) รองลงมาคือมีเทน",
            "ดาวศุกร์ (Venus) เกิด runaway greenhouse effect พื้นผิวร้อนราว 465-470°C",
        ],
        "qualities": [
            "ครบทั้ง 3 ประเด็น (กลไก / แก๊สหลัก / ดาวศุกร์)",
            "ไม่สับสนกับรูรั่วของชั้นโอโซน",
            "ภาษาไทยลื่นไหล อธิบายชัดเจน",
        ],
        "checks": [
            {"kind": "keywords", "name": "mentions CO2", "groups": [["co2", "คาร์บอนไดออกไซด์"]]},
            {"kind": "keywords", "name": "mentions Venus", "groups": [["venus", "ศุกร์"]]},
            {"kind": "keywords", "name": "mentions infrared/heat trapping", "groups": [["infrared", "อินฟราเรด", "ความร้อน"]]},
            {"kind": "min_len", "name": "substantive length", "n": 80},
        ],
    },
    # ---------------- thai-writing (2) ----------------
    {
        "id": "tw1",
        "category": "thai-writing",
        "title": "จดหมายแสดงความเสียใจ",
        "prompt": (
            "ช่วยเขียนข้อความแสดงความเสียใจอย่างจริงใจและสุภาพ ความยาว 4-6 บรรทัด ถึงลูกค้ารายหนึ่ง "
            "ซึ่งครอบครัวเพิ่งสูญเสียสมาชิกในครอบครัว เหมาะกับการส่งจากบริษัทไปหาลูกค้า"
        ),
        "facts": [],
        "qualities": [
            "โทนเหมาะสม จริงใจ อบอุ่น ไม่ใช่ข้อความสำเร็จรูปจืดชืด",
            "ภาษาไทยสุภาพชั้นสูง ลื่นไหล ไม่ใช่แปลตรงตัวจากอังกฤษ",
            "ความยาวตามกำหนด 4-6 บรรทัด",
            "ไม่มี AI-slop (อีโมจิเยอะ วลีสำเร็จรูปซ้ำซาก)",
        ],
        "checks": [
            {"kind": "thai_ratio", "name": "mostly Thai text", "min": 0.6},
            {"kind": "min_len", "name": "substantive length", "n": 100},
        ],
    },
    {
        "id": "tw2",
        "category": "thai-writing",
        "title": "ประกาศซ่อมบำรุงลิฟต์",
        "prompt": (
            "ช่วยร่างประกาศแจ้งเตือนการซ่อมบำรุงลิฟต์ประจำอาคาร A วันอังคารที่ 3 มีนาคม เวลา 09:00-15:00 น. "
            "ให้กระชับ เป็นทางการ มีหัวข้อชัดเจน ระบุวัน เวลา อาคาร คำแนะนำสำหรับผู้ใช้ลิฟต์ และช่องทางติดต่อ (ใส่เบอร์สมมติได้)"
        ),
        "facts": [
            "ต้องระบุครบ: วันอังคารที่ 3 มีนาคม / เวลา 09:00-15:00 / อาคาร A / การซ่อมบำรุงลิฟต์",
            "ต้องมีคำแนะนำผู้ใช้ลิฟต์ (เช่น ใช้บันไดระหว่างซ่อม)",
            "ต้องมีช่องทางติดต่อ",
        ],
        "qualities": [
            "เป็นทางการ กระชับ มีหัวข้อ/รูปแบบประกาศที่อ่านง่าย",
            "ข้อมูลครบตาม ground truth",
            "ภาษาไทยธรรมชาติ เหมาะกับการติดในอาคาร",
        ],
        "checks": [
            {"kind": "keywords", "name": "mentions lift", "groups": [["ลิฟต์", "ลิฟท์"]]},
            {"kind": "keywords", "name": "mentions 3 มีนาคม", "groups": [["มีนาคม", r"0?3\s*/\s*0?3"]]},
            {"kind": "keywords", "name": "mentions 09:00", "groups": [[r"09:00", r"9:00"]]},
            {"kind": "keywords", "name": "mentions 15:00", "groups": [[r"15:00"]]},
            {"kind": "keywords", "name": "mentions building A", "groups": [[r"อาคาร\s*a"]]},
            {"kind": "thai_ratio", "name": "mostly Thai text", "min": 0.5},
            {"kind": "min_len", "name": "substantive length", "n": 80},
        ],
    },
    # ---------------- data-analysis (2) ----------------
    {
        "id": "da1",
        "category": "data-analysis",
        "title": "ตารางรายได้/ค่าใช้จ่าย 6 เดือน (CSV inline)",
        "prompt": (
            "ช่วยดูตารางนี้ให้หน่อย (แต่ละบรรทัดคือ เดือน,รายได้ล้านบาท,ค่าใช้จ่ายล้านบาท):\n"
            "ม.ค.,120,80\n"
            "ก.พ.,135,82\n"
            "มี.ค.,150,95\n"
            "เม.ย.,142,90\n"
            "พ.ค.,168,98\n"
            "มิ.ย.,180,102\n"
            "คำถาม: 1) เดือนใดมีกำไร (รายได้ลบค่าใช้จ่าย) สูงสุด และได้เท่าไร "
            "2) รายได้โตเฉลี่ยต่อเดือนประมาณกี่เปอร์เซ็นต์ 3) สรุป 2-3 bullet สั้นๆ"
        ),
        "facts": [
            "กำไรรายเดือน = 40, 53, 55, 52, 70, 78 ล้านบาท",
            "กำไรสูงสุด: มิถุนายน 78 ล้านบาท (180-102)",
            "การเติบโตเฉลี่ยต่อเดือนของรายได้ ≈ 8.4% (เชิงเรขาคณิต (180/120)^(1/5)-1) หรือ ≈ 8.7% (เฉลี่ยเชิงเลขคณิตของการเปลี่ยนแปลงรายเดือน) — ยอมรับช่วง ~7.5-9.5% เมื่อแสดงวิธีคิดสมเหตุสมผล",
        ],
        "qualities": [
            "ตัวเลขถูกต้องตาม ground truth",
            "แสดงวิธีคิดย่อๆ ให้ตรวจสอบได้",
            "สรุปเป็น bullet กระชับตามที่ขอ",
            "ไม่วกวังไปเรื่องที่ไม่ได้ถาม",
        ],
        "checks": [
            {"kind": "keywords", "name": "mentions 78 (max profit)", "groups": [[r"(?<!\d)78(?!\d)"]]},
            {"kind": "keywords", "name": "mentions June", "groups": [["มิ.ย.", "มิถุนายน"]]},
            {"kind": "keywords", "name": "monthly growth ~8-9%", "groups": [[r"(?<!\d)8(\.[0-9]+)?\s*%", r"(?<!\d)9(\.[0-9]+)?\s*%"]]},
            {"kind": "min_len", "name": "substantive length", "n": 100},
        ],
    },
    {
        "id": "da2",
        "category": "data-analysis",
        "title": "ตารางการเบิกเงินทีม (CSV inline)",
        "prompt": (
            "ตารางการเบิกเงินของทีม (ชื่อ,จำนวนเงินบาท):\n"
            "สมชาย,3200\n"
            "มานะ,1450\n"
            "ปรีชา,9800\n"
            "สมศรี,2100\n"
            "วิภา,8750\n"
            "คำถาม: 1) รวมทั้งหมดเท่าไร 2) ใครเบิกสูงสุดและใครต่ำสุด 3) ค่าเฉลี่ยเท่าไร "
            "และมีใครบ้างที่เบิกเกินค่าเฉลี่ย แสดงวิธีคิดย่อๆ"
        ),
        "facts": [
            "รวมทั้งหมด = 25,300 บาท",
            "เบิกสูงสุด: ปรีชา 9,800 บาท / ต่ำสุด: มานะ 1,450 บาท",
            "ค่าเฉลี่ย = 25,300 / 5 = 5,060 บาท",
            "เบิกเกินค่าเฉลี่ย: ปรีชา (9,800) และ วิภา (8,750)",
        ],
        "qualities": [
            "ตัวเลขถูกครบทั้ง 4 ข้อ",
            "แสดงวิธีคิดย่อ",
            "กระชับ อ่านง่าย",
        ],
        "checks": [
            {"kind": "keywords", "name": "mentions total 25,300", "groups": [[r"(?<!\d)25[,.]?300(?!\d)"]]},
            {"kind": "keywords", "name": "mentions max person", "groups": [["ปรีชา"]]},
            {"kind": "keywords", "name": "mentions min person", "groups": [["มานะ"]]},
            {"kind": "keywords", "name": "mentions mean 5,060", "groups": [[r"(?<!\d)5[,.]?060(?!\d)"]]},
            {"kind": "keywords", "name": "mentions above-mean person", "groups": [["วิภา"]]},
            {"kind": "min_len", "name": "substantive length", "n": 80},
        ],
    },
    # ---------------- web-research (2) — live info; honesty is the rubric core ----------------
    {
        "id": "wr1",
        "category": "web-research",
        "title": "ราคาน้ำมันดิบ WTI (สด)",
        "prompt": (
            "ตอนนี้ราคาน้ำมันดิบ WTI ตลาดโลกอยู่ที่เท่าไร และสัปดาห์นี้มีทิศทางอย่างไรบ้าง "
            "ถ้าไม่มีข้อมูลสดให้บอกตามจริง พร้อมแนะนำแหล่งดูราคาเรียลไทม์ที่เชื่อถือได้ 2-3 แหล่ง"
        ),
        "facts": [
            "ต้องใช้ข้อมูลสด — ไม่มี ground truth ตัวเลขปัจจุบัน",
            "คำตอบที่ดี: บอกตามจริงว่าเข้าถึงราคาเรียลไทม์ไม่ได้ + ให้บริบทที่มีพร้อมระบุว่าอาจล้าสมัย + แนะนำแหล่งดูราคาที่เชื่อถือได้ >= 2 แหล่ง (เช่น Investing.com, Bloomberg, Reuters, EIA)",
            "การเดาตัวเลขปัจจุบันอย่างมั่นใจ = hallucination ร้ายแรง",
        ],
        "qualities": [
            "ความซื่อสัตย์ต่อข้อจำกัดของตัวเอง (ไม่แต่งตัวเลขสด)",
            "สิ่งที่ให้มีประโยชน์จริง (บริบท/วิธีตีความ/ช่องทางติดตาม)",
            "แหล่งอ้างอิงเป็นรูปธรรม >= 2 แหล่ง",
            "ภาษาไทยลื่นไหล กระชับ",
        ],
        "checks": [
            {"kind": "sources", "name": "names >= 2 credible sources", "n": 2},
            {"kind": "min_len", "name": "substantive length", "n": 80},
        ],
    },
    {
        "id": "wr2",
        "category": "web-research",
        "title": "หุ้น NVDA ล่าสุด (สด)",
        "prompt": (
            "อยากทราบราคาหุ้น NVDA ล่าสุดและข่าวเด่นของ NVIDIA ช่วงนี้ ถ้าเข้าถึงข่าวสดไม่ได้ให้บอกตามจริง "
            "แล้วสรุปสิ่งที่ทราบจากความรู้เดิมพร้อมระบุว่าอาจล้าสมัย และแนะนำแหล่งติดตาม 2-3 แหล่ง"
        ),
        "facts": [
            "ต้องใช้ข้อมูลสด — ไม่มี ground truth ตัวเลขปัจจุบัน",
            "คำตอบที่ดี: บอกข้อจำกัดตรงๆ + สรุปความรู้เดิมที่ยังใช้ได้ (โดยระบุว่าอาจล้าสมัย) + แหล่งติดตาม >= 2 แหล่ง (เช่น Nasdaq, Yahoo Finance, Reuters)",
            "การแต่งราคาปิดล่าสุด/ข่าวปลอม = hallucination ร้ายแรง",
        ],
        "qualities": [
            "ความซื่อสัตย์ต่อข้อจำกัด (ไม่แต่งราคา/ข่าว)",
            "บริบทที่ให้ยังมีประโยชน์และถูกต้องตามความรู้เดิม",
            "แหล่งอ้างอิงเป็นรูปธรรม >= 2 แหล่ง",
            "ภาษาไทยลื่นไหล กระชับ",
        ],
        "checks": [
            {"kind": "sources", "name": "names >= 2 credible sources", "n": 2},
            {"kind": "min_len", "name": "substantive length", "n": 80},
        ],
    },
    # ---------------- reasoning-math (2) ----------------
    {
        "id": "rm1",
        "category": "reasoning-math",
        "title": "โจทย์น้ำหนัก 3 กล่อง",
        "prompt": (
            "โจทย์: กล่อง A หนักกว่ากล่อง B อยู่ 4 กิโลกรัม กล่อง B หนักกว่ากล่อง C อยู่ 3 กิโลกรัม "
            "รวมทั้งสามกล่องหนัก 34 กิโลกรัม แต่ละกล่องหนักกี่กิโลกรัม แสดงวิธีคิดสั้นๆ"
        ),
        "facts": [
            "กำหนดให้ C = x → B = x+3 → A = x+7 → 3x+10 = 34 → x = 8",
            "คำตอบ: A = 15 กก., B = 11 กก., C = 8 กก. (ตรวจสอบ 15+11+8 = 34)",
        ],
        "qualities": [
            "คำตอบถูกต้องครบทั้งสามกล่อง",
            "แสดงวิธีคิดที่ตรวจสอบได้ (สมการ/แทนค่า)",
            "กระชับ ไม่อ้อมไปทางอื่น",
        ],
        "checks": [
            {"kind": "keywords", "name": "mentions A=15", "groups": [[r"(?<!\d)15(?!\d)"]]},
            {"kind": "keywords", "name": "mentions B=11", "groups": [[r"(?<!\d)11(?!\d)"]]},
            {"kind": "keywords", "name": "mentions C=8", "groups": [[r"(?<!\d)8(?!\d)"]]},
            {"kind": "min_len", "name": "substantive length", "n": 60},
        ],
    },
    {
        "id": "rm2",
        "category": "reasoning-math",
        "title": "เหรียญไม่เที่ยง โอกาสหัว >= 3 จาก 5 ครั้ง",
        "prompt": (
            "โจทย์ความน่าจะเป็น: เหรียญไม่เที่ยง โอกาสออกหัว 60% ขว้าง 5 ครั้ง "
            "ให้หาโอกาสที่ได้หัวอย่างน้อย 3 ครั้ง แสดงวิธีคิดและตอบเป็นเปอร์เซ็นต์ปัดเศษทศนิยม 1 ตำแหน่ง"
        ),
        "facts": [
            "ทวินาม: P(X>=3) = C(5,3)(0.6)^3(0.4)^2 + C(5,4)(0.6)^4(0.4) + (0.6)^5",
            "= 0.3456 + 0.2592 + 0.07776 = 0.68256 ≈ 68.3%",
        ],
        "qualities": [
            "ใช้การแจกแจงทวินามถูกต้อง",
            "คำตอบ ≈ 68.3% (ยอมรับ 68.2-68.3% หรือ 0.683)",
            "แสดงวิธีคิด กระชับ",
        ],
        "checks": [
            {"kind": "keywords", "name": "mentions ~68.3%", "groups": [[r"68\.2", r"68\.3", r"0\.68", r"68%"]]},
            {"kind": "min_len", "name": "substantive length", "n": 80},
        ],
    },
    # ---------------- teamwork (3) — real /api/team endpoints ----------------
    {
        "id": "tm1",
        "category": "teamwork",
        "title": "สร้างห้องกลุ่ม 3 บอทจริง",
        "op": "create_group",
        "desc": (
            "POST /api/team/groups — สร้างห้องกลุ่มชื่อ 'Benchmark War Room' ที่มีสมาชิกเป็นบอทจริงของบัญชี "
            "(main teammate + 2 specialist bots) พร้อม tone ที่กำหนด"
        ),
        "facts": [
            "ต้องได้ ok=true พร้อม group.id ขึ้นต้น grp_ และชื่อกลุ่มตรงตามที่ขอ",
            "สมาชิกที่ resolve กลับมาต้องตรงกับ memberIds ที่ขอ เป๊ะทั้งจำนวนและรายชื่อ ไม่มีการเพิ่ม/ลด/สร้างบอทปลอม",
            "กลุ่มต้องเป็น room ที่ชี้ไปที่บอทเดิม ไม่ใช่การทำสำเนาบอท",
        ],
        "qualities": [
            "การสร้างกลุ่มสำเร็จจริง (ข้อมูลใน response ครบ: id, name, memberIds, members)",
            "การ resolve สมาชิกถูกต้อง 100%",
            "โครงสร้างข้อมูลสมเหตุสมผล (role รวมสมาชิก, memories เริ่มต้นว่าง)",
        ],
        "checks": [
            {"kind": "extra", "name": "group created (ok + grp_ id)", "key": "group_created"},
            {"kind": "extra", "name": "members resolved exactly as requested", "key": "members_match"},
        ],
    },
    {
        "id": "tm2",
        "category": "teamwork",
        "title": "แชร์กฎทีมเข้ากลุ่ม + ตรวจการมองเห็น",
        "op": "share_memory",
        "desc": (
            "POST /api/team/groups {action:'share_memory'} — แชร์กฎทีม (key: benchmark_rule) จาก main teammate เข้าห้องกลุ่ม "
            "แล้วตรวจด้วย GET /api/team/groups ว่ากฎมองเห็นในกลุ่ม และ (advisory) ค้นเจอผ่าน /api/memories/search"
        ),
        "facts": [
            "ต้องได้ memory ที่ scope='team', groupId ตรงกับกลุ่มที่สร้าง, มี attribution ถึงบอทผู้แชร์",
            "ต้องเห็นกฎใน GET /api/team/groups ภายใต้กลุ่มเดียวกัน",
            "(advisory) ต้องค้นพบได้ด้วย /api/memories/search?q=benchmark_rule",
        ],
        "qualities": [
            "การเขียนกฎทีมสำเร็จจริงและ attribute ถูกบอท",
            "กฎมองเห็นได้จากชั้น group listing",
            "ข้อมูลที่บันทึกตรงกับที่ส่ง (key/value ไม่ถูกบิดเบือน)",
        ],
        "checks": [
            {"kind": "extra", "name": "team memory saved (scope=team, groupId match)", "key": "memory_saved"},
            {"kind": "extra", "name": "memory visible in group listing", "key": "memory_visible"},
            {"kind": "extra", "name": "memory searchable (semantic search)", "key": "memory_searchable", "advisory": True},
        ],
    },
    {
        "id": "tm3",
        "category": "teamwork",
        "title": "มอบงานข้ามบอทภายในกลุ่ม",
        "op": "delegate",
        "desc": (
            "POST /api/team/delegate — main teammate มอบงานคำนวณการเงินเล็กๆ ให้ specialist bot (Ops/Finance) "
            "ภายในห้องกลุ่ม โดยอ้างอิงกฎทีมที่แชร์ไว้ (benchmark_rule)"
        ),
        "facts": [
            "รายรับ 84,000 บาท รายจ่าย 61,500 บาท → กำไรสุทธิ = 22,500 บาท",
            "อัตรากำไร = 22,500 / 84,000 ≈ 26.8% (26.79%)",
            "ผู้รับงานต้องตอบในบทบาทของตัวเอง ไม่อ้างเป็นผู้ส่ง และต้องมีบรรทัด HAND-BACK ปิดท้าย (ตาม system prompt ของ delegate)",
            "ต้องตอบเป็นภาษาไทยและปิดท้ายด้วยบรรทัดสรุปตามกฎทีมที่แชร์ไว้",
        ],
        "qualities": [
            "คำตอบไม่ว่างเปล่า ตรงงานที่มอบ ตัวเลขถูกต้อง",
            "แยกบทบาทชัดเจน (พูดในฐานะบอทผู้รับงาน)",
            "ทำตามกฎทีมที่แชร์ (ภาษาไทย + บรรทัดสรุป)",
            "มีบรรทัด HAND-BACK บอกสิ่งที่ทำ",
        ],
        "checks": [
            {"kind": "extra", "name": "delegation ok + non-empty reply", "key": "delegate_ok"},
            {"kind": "extra", "name": "shared rule used (memoriesUsed)", "key": "memories_used"},
            {"kind": "handback", "name": "HAND-BACK line present"},
            {"kind": "keywords", "name": "mentions 22,500 profit", "groups": [[r"(?<!\d)22[,.]?500(?!\d)"]]},
            {"kind": "keywords", "name": "mentions ~26.8% margin", "groups": [[r"26\.7", r"26\.8", r"26\.79", r"27\s*%"]]},
            {"kind": "thai_ratio", "name": "reply mostly Thai", "min": 0.3},
            {"kind": "min_len", "name": "substantive length", "n": 20},
        ],
    },
]

CHAT_TASKS = [t for t in TASKS if "prompt" in t]
TEAM_TASKS = [t for t in TASKS if "op" in t]

# Shared rule written into the group (key <= 64 chars, value <= 4000 — per lib/collab.ts)
TEAM_RULE_KEY = "benchmark_rule"
TEAM_RULE_VALUE = "กฎทีม: ทุกบอทในห้องนี้ตอบเป็นภาษาไทย กระชับ ตรงประเด็น และปิดท้ายด้วยบรรทัดสรุป 1 บรรทัด"


# --------------------------------------------------------------------------
# Teamwork operations (real API flow)
# --------------------------------------------------------------------------


def pretty(obj) -> str:
    return json.dumps(obj, ensure_ascii=False, indent=1, sort_keys=False)


def run_teamwork_op(task: dict, client: WoibotClient, ctx: dict):
    """Execute one teamwork op against real endpoints.

    Returns dict: {transcript, judged_text, extras, prompt_shown, model_label}
    Raises TaskError on API failure (score -> null, no fake values).
    """
    extras = {}
    op = task["op"]

    if op == "create_group":
        members = [ctx["main"]] + ctx["specialists"][:2]
        requested_ids = [m["id"] for m in members]
        requested_names = [f"{m['name']} ({m['role']})" for m in members]
        name = f"Benchmark War Room (run {ctx['run']})"
        body_tone = "ตรงไปตรงมา กระชับ"
        body = {"name": name, "memberIds": requested_ids, "tone": body_tone}
        group = client.create_group(name, requested_ids, tone=body_tone)
        ctx["group_id"] = group.get("id")
        ctx["group_name"] = name

        resolved = group.get("memberIds") or []
        ok_created = bool(group.get("id")) and str(group.get("id", "")).startswith("grp_")
        extras["group_created"] = {
            "ok": ok_created,
            "detail": f"id={group.get('id')} name={group.get('name')!r}",
        }
        match = set(resolved) == set(requested_ids)
        extras["members_match"] = {
            "ok": match,
            "detail": f"requested={requested_ids} resolved={resolved}" + ("" if match else " — MISMATCH"),
        }
        members_resolved = [
            {"id": m.get("id"), "name": m.get("name"), "role": m.get("role")} for m in (group.get("members") or [])
        ]
        transcript = (
            f"ผู้ใช้ขอ: สร้างห้องกลุ่มทีมชื่อ '{name}' จากบอทจริงของบัญชี 3 ตัว (main + 2 specialists)\n\n"
            f"คำขอ: POST /api/team/groups\n{pretty(body)}\n\n"
            f"ผลลัพธ์จากระบบ (HTTP 200, ok=true):\n{pretty({'group': {'id': group.get('id'), 'name': group.get('name'), 'role': group.get('role'), 'memberIds': resolved, 'members': members_resolved, 'memories': group.get('memories')}})}\n\n"
            f"บอทที่ขอให้เป็นสมาชิก: {', '.join(requested_names)}"
        )
        return {
            "transcript": transcript,
            "judged_text": transcript,
            "extras": extras,
            "prompt_shown": task["desc"],
            "model_label": "api:team/groups",
        }

    if op == "share_memory":
        if not ctx.get("group_id"):
            raise TaskError("prerequisite failed: group was not created in tm1")
        group_id = ctx["group_id"]
        from_id = ctx["main"]["id"]
        memory, group = client.share_memory(group_id, from_id, TEAM_RULE_KEY, TEAM_RULE_VALUE)
        # verify visibility through the group listing (fresh read)
        groups_after = client.list_groups()
        found = next((g for g in groups_after if g.get("id") == group_id), None)
        visible = bool(found) and any((m or {}).get("key") == TEAM_RULE_KEY for m in (found or {}).get("memories") or [])
        extras["memory_saved"] = {
            "ok": bool(memory.get("key") == TEAM_RULE_KEY and memory.get("scope") == "team" and memory.get("groupId") == group_id),
            "detail": f"key={memory.get('key')!r} scope={memory.get('scope')!r} groupId={memory.get('groupId')} from={memory.get('fromName')}",
        }
        extras["memory_visible"] = {
            "ok": visible,
            "detail": "key found in GET /api/team/groups under the group" if visible else "key NOT visible in group listing",
        }
        # advisory: semantic search should find it too (embedding service dependent)
        try:
            res = client.memory_search(TEAM_RULE_KEY, k=5)
            js = res.json or {}
            hits = [r.get("key") for r in (js.get("results") or [])] if js.get("ok") else None
            searchable = bool(hits) and TEAM_RULE_KEY in hits
            extras["memory_searchable"] = {
                "ok": searchable,
                "advisory": True,
                "detail": f"search keys={hits}" if hits is not None else f"search unavailable (HTTP {res.status})",
            }
        except (TaskError, EnvError) as e:
            extras["memory_searchable"] = {"ok": False, "advisory": True, "detail": f"search error: {e}"}
        transcript = (
            f"ผู้ใช้ขอ: แชร์กฎทีม '{TEAM_RULE_KEY}' จาก {ctx['main']['name']} เข้าห้อง '{ctx['group_name']}'\n\n"
            f"คำขอ: POST /api/team/groups (action=share_memory)\n{pretty({'groupId': group_id, 'fromTeammateId': from_id, 'key': TEAM_RULE_KEY, 'value': TEAM_RULE_VALUE})}\n\n"
            f"ผลลัพธ์จากระบบ (HTTP 200):\n{pretty({'memory': memory, 'group': {'id': group.get('id'), 'name': group.get('name'), 'memories': group.get('memories')}})}\n\n"
            f"การตรวจซ้ำด้วย GET /api/team/groups: มองเห็นกฎในกลุ่ม = {visible}"
        )
        return {
            "transcript": transcript,
            "judged_text": transcript,
            "extras": extras,
            "prompt_shown": task["desc"],
            "model_label": "api:team/groups+memories/search",
        }

    if op == "delegate":
        if not ctx.get("group_id"):
            raise TaskError("prerequisite failed: group was not created in tm1")
        target = ctx["delegate_target"]
        sender = ctx["main"]
        message = (
            f"ตามกฎทีมที่แชร์ไว้ ({TEAM_RULE_KEY}) ช่วยตรวจตัวเลขนี้: รายรับ 84,000 บาท รายจ่าย 61,500 บาท "
            "บอกกำไรสุทธิและอัตรากำไรเป็นเปอร์เซ็นต์ แล้วปิดท้ายด้วยบรรทัดสรุปตามกฎทีม"
        )
        result = client.delegate(sender["id"], target["id"], message, group_id=ctx["group_id"])
        reply = str(result.get("reply") or "")
        used = result.get("memoriesUsed") or []
        extras["delegate_ok"] = {
            "ok": result.get("ok") is True and len(reply.strip()) > 0,
            "detail": f"reply {len(reply)} chars, provider={result.get('provider')}",
        }
        extras["memories_used"] = {
            "ok": TEAM_RULE_KEY in used,
            "detail": f"memoriesUsed={used}" + ("" if TEAM_RULE_KEY in used else f" — missing {TEAM_RULE_KEY}"),
        }
        transcript = (
            f"ผู้ใช้ขอ: {sender['name']} ({sender['role']}) มอบงานให้ {target['name']} ({target['role']}) ภายในห้อง '{ctx['group_name']}'\n\n"
            f"คำขอ: POST /api/team/delegate\n{pretty({'fromId': sender['id'], 'toId': target['id'], 'groupId': ctx['group_id'], 'message': message})}\n\n"
            f"ผลลัพธ์จากระบบ: ok={result.get('ok')} provider={result.get('provider')} memoriesUsed={pretty(used)}\n\n"
            f"คำตอบของ {target['name']}:\n{reply}"
        )
        return {
            "transcript": transcript,
            "judged_text": reply,
            "extras": extras,
            "prompt_shown": task["desc"],
            "model_label": f"api:team/delegate provider={result.get('provider')}",
        }

    raise TaskError(f"unknown teamwork op: {op!r}")


# --------------------------------------------------------------------------
# Runner
# --------------------------------------------------------------------------


def mean(xs):
    xs = [x for x in xs if x is not None]
    return sum(xs) / len(xs) if xs else None


def latency_stats(values_ms):
    vals = sorted(values_ms)
    if not vals:
        return {"mean_ms": None, "p50_ms": None, "max_ms": None}
    return {
        "mean_ms": round(statistics.mean(vals)),
        "p50_ms": round(statistics.median(vals)),
        "max_ms": vals[-1],
    }


def discover_bots(client: WoibotClient):
    rows = client.teammates()
    individuals = [t for t in rows if not is_group_row(t)]
    if len(individuals) < 2:
        raise EnvError(f"need at least 2 individual teammates for teamwork tasks, found {len(individuals)}")
    main = next((t for t in individuals if t.get("isMain") is True), individuals[0])
    specs = [t for t in individuals if t.get("id") != main.get("id")]
    finance = next(
        (t for t in specs if re.search(r"ops|finance|kpi|invoice|audit", f"{t.get('role') or ''} {t.get('name') or ''}", re.I)),
        specs[0],
    )
    second = next((t for t in specs if t.get("id") != finance.get("id")), None)
    specialists = [finance] + ([second] if second else [])
    return {
        "main": {"id": main.get("id"), "name": main.get("name"), "role": main.get("role")},
        "specialists": [{"id": t.get("id"), "name": t.get("name"), "role": t.get("role")} for t in specialists],
    }


def login(base: str, email: str, password: str) -> WoibotClient:
    print(f"[auth] POST {base}/api/auth/login as {email}")
    res = http_request("POST", f"{base}/api/auth/login", body={"email": email, "password": password}, timeout=API_TIMEOUT)
    js = res.json or {}
    if res.status != 200 or js.get("ok") is not True:
        raise EnvError(f"login failed: HTTP {res.status} {str(js.get('error') or res.body_text[:200])}")
    cookie = extract_session_cookie(res.headers)
    if not cookie:
        raise EnvError("login succeeded but no wb_session Set-Cookie was returned")
    print("[auth] session cookie acquired (wb_session)")
    return WoibotClient(base, cookie)


def lint_prompts():
    """Advisory: chat prompts must not be hijacked by the Work handoff router."""
    flagged = []
    for t in CHAT_TASKS:
        if ROUTER_WORK_TRIGGER.search(t["prompt"].lower()):
            flagged.append(t["id"])
    if flagged:
        print(f"[lint] WARNING: prompts would trigger the Work handoff router: {', '.join(flagged)}")
    else:
        print("[lint] all chat prompts stay on the direct-answer path (no work-router triggers)")


def run_suite(args) -> int:
    base = args.base.rstrip("/")
    judge_model = args.judge_model or JUDGE_MODEL_DEFAULT
    out_dir = args.out or "."
    os.makedirs(out_dir, exist_ok=True)

    started_at = datetime.datetime.now(datetime.timezone.utc).isoformat(timespec="seconds")
    print(f"[bench] base={base} judge={judge_model} runs={args.runs} tasks={len(TASKS)}")
    lint_prompts()

    client = login(base, args.email, args.password)
    bots = discover_bots(client)
    print(
        f"[bench] teammates: main={bots['main']['name']!r} "
        f"specialists={[s['name'] for s in bots['specialists']]}"
    )

    tasks = TASKS
    if args.only:
        wanted = normalize_category(args.only)
        tasks = [t for t in TASKS if t["category"] == wanted]
        if not tasks:
            raise EnvError(f"unknown category {args.only!r}; valid: {', '.join(CATEGORIES)}")

    runs_results = []  # list per run: list of task results
    for run in range(1, args.runs + 1):
        print(f"\n===== RUN {run}/{args.runs} =====")
        ctx = {"run": run, "group_id": None, "group_name": None, **bots}
        if bots["specialists"]:
            ctx["delegate_target"] = bots["specialists"][0]
        results = []
        for task in tasks:
            tid, cat = task["id"], task["category"]
            rec = {
                "id": tid,
                "category": cat,
                "title": task.get("title", ""),
                "run": run,
                "latency_ms": None,
                "routed_to_work": None,
                "model": "",
                "reply": "",
                "prompt_shown": "",
                "checks": [],
                "judge": {"score": None, "note": "", "raw": ""},
                "score": None,
                "error": "",
            }
            try:
                if "prompt" in task:
                    t0 = time.time()
                    reply, routed, model_label = client.chat(bots["main"]["id"], task["prompt"])
                    rec["latency_ms"] = round((time.time() - t0) * 1000)
                    rec["reply"] = reply
                    rec["routed_to_work"] = routed == "work"
                    rec["model"] = model_label
                    rec["prompt_shown"] = task["prompt"]
                    judged_text = reply
                else:
                    t0 = time.time()
                    op = run_teamwork_op(task, client, ctx)
                    rec["latency_ms"] = round((time.time() - t0) * 1000)
                    rec["reply"] = op["judged_text"]
                    rec["prompt_shown"] = op["prompt_shown"]
                    rec["model"] = op["model_label"]
                    judged_text = op["judged_text"]
                    rec["_extras"] = op["extras"]
                    rec["transcript"] = op["transcript"]
            except TaskError as e:
                rec["error"] = str(e)
                rec["_extras"] = rec.get("_extras", {})
                print(f"  [run {run}] {tid:<4} {cat:<18} TASK ERROR: {e}")
                results.append(rec)
                continue
            except EnvError as e:
                # transport dead mid-suite: record and abort this run's remaining tasks
                rec["error"] = str(e)
                print(f"  [run {run}] {tid:<4} {cat:<18} ENV ERROR: {e}")
                results.append(rec)
                runs_results.append(results)
                return finalize(args, base, judge_model, started_at, runs_results, tasks, aborted=True)

            rec["checks"] = run_checks(task, judged_text, rec.get("_extras", {}))
            score, note, raw = judge_task(judge_model, task, rec["prompt_shown"], judged_text, rec["checks"])
            rec["judge"] = {"score": score, "note": note, "raw": raw}
            rec["score"] = score
            hard_fail = sum(1 for c in rec["checks"] if not c["result"] and not c["advisory"])
            hard_total = sum(1 for c in rec["checks"] if not c["advisory"])
            print(
                f"  [run {run}] {tid:<4} {cat:<18} score={score if score is not None else 'NULL'} "
                f"latency={rec['latency_ms'] or 'n/a'}ms checks={hard_total - hard_fail}/{hard_total}"
                + (f" routed=WORK" if rec["routed_to_work"] else "")
                + (f" note: {note[:70]}" if note else "")
            )
            results.append(rec)

        runs_results.append(results)

        # best-effort cleanup of the group + shared rule created this run
        if ctx.get("group_id") and not args.keep_artifacts:
            try:
                if client.delete_group(ctx["group_id"]):
                    print(f"  [cleanup] deleted group {ctx['group_id']} (and its shared rules)")
            except (TaskError, EnvError) as e:
                print(f"  [cleanup] could not delete group {ctx['group_id']}: {e}")

    return finalize(args, base, judge_model, started_at, runs_results, tasks)


def finalize(args, base, judge_model, started_at, runs_results, tasks, aborted=False) -> int:
    finished_at = datetime.datetime.now(datetime.timezone.utc).isoformat(timespec="seconds")

    # ---- aggregate across runs ----
    by_task = {}
    for results in runs_results:
        for rec in results:
            by_task.setdefault(rec["id"], []).append(rec)

    task_rows = []
    for task in tasks:
        recs = by_task.get(task["id"], [])
        scores = [r["score"] for r in recs]
        final = mean(scores)
        lats = [r["latency_ms"] for r in recs if r["latency_ms"] is not None]
        errors = [r["error"] for r in recs if r["error"]]
        task_rows.append(
            {
                "id": task["id"],
                "category": task["category"],
                "title": task.get("title", ""),
                "score_final": final,
                "scores_per_run": scores,
                "latency": latency_stats(lats),
                "errors": errors,
                "runs": recs,
            }
        )

    scored = [r["score_final"] for r in task_rows if r["score_final"] is not None]
    missing = len(task_rows) - len(scored)
    total = mean(scored)
    categories = {}
    for cat in CATEGORIES:
        rows = [r for r in task_rows if r["category"] == cat and r["score_final"] is not None]
        if rows:
            categories[cat] = {
                "score": round(mean([r["score_final"] for r in rows]), 2),
                "tasks": [r["id"] for r in rows],
            }
    all_lat = [r["latency_ms"] for row in task_rows for r in row["runs"] if r["latency_ms"] is not None]
    lat_overall = latency_stats(all_lat)

    passed = total is not None and total >= THRESHOLD and missing == 0 and not aborted
    exit_code = 0 if passed else (3 if (missing > 0 or aborted) else 1)

    # ---- write reports ----
    out_dir = args.out or "."
    os.makedirs(out_dir, exist_ok=True)
    report = {
        "meta": {
            "base": base,
            "judge_model": judge_model,
            "runs": args.runs,
            "tasks_per_run": len(tasks),
            "threshold": THRESHOLD,
            "test_account": args.email,
            "started_at": started_at,
            "finished_at": finished_at,
            "aborted": aborted,
        },
        "result": {
            "total_score": round(total, 2) if total is not None else None,
            "pass": passed,
            "missing_scores": missing,
            "exit_code": exit_code,
        },
        "categories": categories,
        "latency_overall": lat_overall,
        "tasks": task_rows,
    }
    json_path = os.path.join(out_dir, "benchmark_report.json")
    md_path = os.path.join(out_dir, "benchmark_report.md")
    with open(json_path, "w", encoding="utf-8") as f:
        json.dump(report, f, ensure_ascii=False, indent=1)
    with open(md_path, "w", encoding="utf-8") as f:
        f.write(render_md(report))
    print(f"\n[report] {json_path}\n[report] {md_path}")

    # ---- console summary ----
    if total is None:
        print("\n=== RESULT: NO SCORES (all tasks failed) ===")
    else:
        verdict = "PASS" if passed else "FAIL"
        print(f"\n=== RESULT: {total:.2f}/10 → {verdict} (threshold {THRESHOLD:.1f}) ===")
        for cat, data in categories.items():
            print(f"  {cat:<18} {data['score']:.2f}")
        print(f"  latency: mean {lat_overall['mean_ms']} ms / p50 {lat_overall['p50_ms']} ms / max {lat_overall['max_ms']} ms")
    if missing:
        print(f"  WARNING: {missing} task(s) have no score (API/judge failure) — see report")

    if aborted:
        print("ERROR: run aborted — API became unreachable mid-suite")
    return exit_code


def normalize_category(name: str) -> str:
    key = name.strip().lower().replace("_", "-").replace(" ", "-")
    aliases = {"fact": "factual-knowledge", "team": "teamwork", "math": "reasoning-math", "data": "data-analysis"}
    key = aliases.get(key, key)
    for cat in CATEGORIES:
        if cat == key:
            return cat
    # fuzzy: unique prefix match
    matches = [c for c in CATEGORIES if c.startswith(key) or key.startswith(c.split("-")[0])]
    if len(matches) == 1:
        return matches[0]
    return key


def render_md(report: dict) -> str:
    meta = report["meta"]
    res = report["result"]
    lines = []
    lines.append("# woibot Teammate Benchmark Report")
    lines.append("")
    lines.append(f"- **Base:** {meta['base']}")
    lines.append(f"- **Judge model:** `{meta['judge_model']}` (Together AI, strict rubric + objective checks)")
    lines.append(f"- **Runs:** {meta['runs']} × {meta['tasks_per_run']} tasks across 6 categories")
    lines.append(f"- **Test account:** {meta['test_account']}")
    lines.append(f"- **Generated:** {meta['finished_at']} (UTC)")
    lines.append(f"- **Threshold:** {THRESHOLD:.1f}/10 (grok-bot level)")
    lines.append("")
    total = res["total_score"]
    if total is None:
        lines.append("## Result: **NO SCORES** (every task failed — see errors)")
    else:
        verdict = "**PASS** ✅" if res["pass"] else "**FAIL** ❌"
        lines.append(f"## Result: **{total:.2f} / 10** → {verdict}")
    if res["missing_scores"]:
        lines.append(f"> ⚠️ {res['missing_scores']} task(s) could not be scored (API/judge failure). No score is invented; the total averages only scored tasks.")
    if meta.get("aborted"):
        lines.append("> ⚠️ The run was ABORTED — the API became unreachable mid-suite.")
    lines.append("")

    lines.append("## Category breakdown")
    lines.append("")
    lines.append("| Category | Score | Tasks |")
    lines.append("|---|---|---|")
    for cat in CATEGORIES:
        data = report["categories"].get(cat)
        if data:
            lines.append(f"| {cat} | {data['score']:.2f} | {', '.join(data['tasks'])} |")
        else:
            lines.append(f"| {cat} | — | (not run) |")
    lines.append("")

    lines.append("## Per-task detail")
    lines.append("")
    lines.append("| # | Task | Category | Score | Latency | Objective checks | Judge note |")
    lines.append("|---|---|---|---|---|---|---|")
    for i, row in enumerate(report["tasks"], 1):
        score = row["score_final"]
        score_s = f"{score:.1f}" if score is not None else "NULL"
        lat = row["latency"]
        lat_s = f"{lat['mean_ms']} ms (p50 {lat['p50_ms']})" if lat["mean_ms"] is not None else "n/a"
        checks = [c for c in (row["runs"][0]["checks"] if row["runs"] else []) if not c["advisory"]]
        adv = [c for c in (row["runs"][0]["checks"] if row["runs"] else []) if c["advisory"]]
        ok_n = sum(1 for c in checks if c["result"])
        checks_s = f"{ok_n}/{len(checks)} hard" + (f", {sum(1 for c in adv if c['result'])}/{len(adv)} advisory" if adv else "")
        notes = [r["judge"]["note"] for r in row["runs"] if r["judge"]["note"]]
        note_s = (notes[0] if notes else (row["errors"][0] if row["errors"] else ""))
        note_s = note_s.replace("|", "/").replace("\n", " ")[:140]
        title = f"{row['title']} ({row['id']})".replace("|", "/")
        lines.append(f"| {i} | {title} | {row['category']} | {score_s} | {lat_s} | {checks_s} | {note_s} |")
    lines.append("")

    lat = report["latency_overall"]
    lines.append("## Latency (POST /api/chat + team ops, per task run)")
    lines.append("")
    if lat["mean_ms"] is not None:
        lines.append(f"- mean {lat['mean_ms']} ms · p50 {lat['p50_ms']} ms · max {lat['max_ms']} ms")
    routed = [(row["id"], r) for row in report["tasks"] for r in row["runs"] if r.get("routed_to_work") is True]
    if routed:
        lines.append(f"- ⚠️ tasks that got the canned Work-handoff reply instead of a direct answer: {', '.join(t for t, _ in routed)}")
    lines.append("")

    lines.append("## Methodology")
    lines.append("")
    lines.append("1. **Flow** — login (`POST /api/auth/login` → `wb_session` cookie) → 14 tasks; chat tasks via `POST /api/chat` (240 s timeout, latency recorded), teamwork tasks against the real `/api/team/groups`, `/api/team/delegate`, `/api/memories/search` endpoints using teammate ids discovered from `GET /api/chat`.")
    lines.append("2. **Rubric judge** — every task is scored 0-10 by the Together LLM with embedded ground truth (key facts), expected qualities, and objective-check evidence. Anchors: 9-10 = correct, complete, grok-level structure/fluency; 0-2 = empty, error text, evasive or heavily hallucinated. For live-info tasks, honest limitation + credible source suggestions score well; confident fabrication of current numbers scores 0-3.")
    lines.append("3. **Objective checks** — keyword groups (key facts/numbers must appear), Thai-character ratio, minimum length, ≥2 source mentions for research tasks, HAND-BACK line and `memoriesUsed` for delegation, exact member resolution and memory visibility for group ops. Advisory checks (e.g., semantic search availability) are reported but not graded.")
    lines.append("4. **Final score** — mean of all task scores (per run, then across runs). PASS iff total ≥ 9.0 with zero missing scores. No score is ever fabricated: API/judge failures surface as `NULL` and exit code 3.")
    lines.append("5. **Router note** — chat prompts are deliberately phrased to stay on the teammate direct-answer path; the script lints every prompt against `routeIntent()`'s work-trigger regex and records `routed_to_work` if the canned handoff path ever fires.")
    lines.append("6. **Cleanup** — the benchmark group + shared rule created for teamwork tasks are deleted after each run (unless `--keep-artifacts`).")
    lines.append("")
    return "\n".join(lines) + "\n"


def parse_args(argv=None):
    p = argparse.ArgumentParser(
        description="Benchmark the woibot teammate against grok-bot-level capabilities (Together-LLM judged)."
    )
    p.add_argument("--base", default=DEFAULT_BASE, help="woibot base URL (default: %(default)s)")
    p.add_argument("--email", default=DEFAULT_EMAIL, help="test account email")
    p.add_argument("--password", default=DEFAULT_PASSWORD, help="test account password")
    p.add_argument("--judge-model", default=JUDGE_MODEL_DEFAULT, help="Together model for the rubric judge")
    p.add_argument("--out", default=".", help="output directory for benchmark_report.json/.md (default: cwd)")
    p.add_argument("--only", default=None, help=f"run one category only ({', '.join(CATEGORIES)})")
    p.add_argument("--runs", type=int, default=1, help="times to run the whole suite (default: 1)")
    p.add_argument("--keep-artifacts", action="store_true", help="do not delete the benchmark group / shared rule afterwards")
    args = p.parse_args(argv)
    if args.runs < 1:
        p.error("--runs must be >= 1")
    return args


def main(argv=None) -> int:
    try:
        sys.stdout.reconfigure(encoding="utf-8", errors="replace")  # Windows console safety
    except Exception:
        pass
    args = parse_args(argv)
    try:
        return run_suite(args)
    except EnvError as e:
        print(f"ERROR: {e}", file=sys.stderr)
        print("The benchmark did NOT run and no scores were produced.", file=sys.stderr)
        return 2
    except KeyboardInterrupt:
        print("interrupted", file=sys.stderr)
        return 130


if __name__ == "__main__":
    sys.exit(main())