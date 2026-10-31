import { NextRequest, NextResponse } from "next/server";
import { getUserId } from "@/lib/auth";
import { writeWorkspaceBytes } from "@/lib/harness/container";
import { ensureComputer, computerFile } from "@/lib/computer";

/**
 * POST /api/uploads { fileName, dataUrl }
 * Writes the file into the user's Cloud Computer workspace so agents can
 * actually open it (no fake /uploads/... URLs).
 *
 * GET /api/uploads?path=uploads/<file>
 * Streams the real file back out of the workspace (same bytes that were
 * uploaded — verified by md5 round-trip in QA). Only paths under uploads/
 * are readable; anything else is rejected.
 */

// The manager exec transport carries the base64 payload in a shell command.
// Beyond ~10MB of base64 the exec call fails mid-flight ("fetch failed"),
// so we refuse earlier with an honest message instead of a misleading 500.
const MAX_BYTES = 8 * 1024 * 1024;

function contentTypeFor(name: string): string {
  const ext = String(name).split(".").pop()?.toLowerCase() || "";
  if (ext === "png") return "image/png";
  if (ext === "jpg" || ext === "jpeg") return "image/jpeg";
  if (ext === "gif") return "image/gif";
  if (ext === "webp") return "image/webp";
  if (ext === "svg") return "image/svg+xml";
  if (ext === "pdf") return "application/pdf";
  if (ext === "txt" || ext === "md") return "text/plain; charset=utf-8";
  if (ext === "csv") return "text/csv; charset=utf-8";
  if (ext === "json") return "application/json";
  return "application/octet-stream";
}

export async function POST(req: NextRequest) {
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const name = String(body?.fileName || "").replace(/[^A-Za-z0-9._\-\u0E00-\u0E7F ]/g, "_").slice(0, 120);
  const dataUrl = String(body?.dataUrl || "");
  if (!name || !dataUrl.includes(",")) {
    return NextResponse.json({ ok: false, error: "fileName and dataUrl are required" }, { status: 400 });
  }
  if (!/^data:[a-zA-Z0-9.+-]+\/[a-zA-Z0-9.+-]+;base64,/.test(dataUrl)) {
    return NextResponse.json({ ok: false, error: "dataUrl ต้องเป็น base64 data URL (เช่น data:image/png;base64,...)" }, { status: 400 });
  }

  const [, b64] = dataUrl.split(",", 2);
  const buf = Buffer.from(b64, "base64");
  if (buf.length === 0) return NextResponse.json({ ok: false, error: "empty file" }, { status: 400 });
  if (buf.length > MAX_BYTES) {
    return NextResponse.json({ ok: false, error: `ไฟล์ใหญ่เกิน ${(MAX_BYTES / 1024 / 1024).toFixed(0)}MB — โปรดย่อขนาดไฟล์ก่อนอัปโหลด` }, { status: 413 });
  }

  const rel = `uploads/${Date.now()}-${name}`;

  // The user's Cloud Computer may not be running yet (fresh account, after
  // pause). Ensure it once up front so the very first attachment works
  // instead of failing with "No such container".
  const ensure = await ensureComputer(userId);
  if (ensure.status === "error") {
    return NextResponse.json(
      { ok: false, error: "Cloud Computer ยังไม่พร้อมใช้งาน — ลองอีกครั้งในอีกสักครู่", detail: String(ensure.detail || "").slice(0, 120) },
      { status: 503 },
    );
  }

  let res = await writeWorkspaceBytes(userId, rel, new Uint8Array(buf));
  if (res.exitCode !== 0 && /no such container|not found|unavailable|manager/i.test(res.stderr)) {
    // Container vanished between ensure and write — ensure once more and retry.
    const again = await ensureComputer(userId);
    if (again.status !== "error") {
      res = await writeWorkspaceBytes(userId, rel, new Uint8Array(buf));
    }
  }
  if (res.exitCode !== 0) {
    return NextResponse.json(
      { ok: false, error: "เขียนไฟล์ลง Cloud Computer ไม่สำเร็จ", detail: res.stderr.slice(0, 200) },
      { status: 502 },
    );
  }
  return NextResponse.json({ ok: true, path: rel, bytes: buf.length });
}

export async function GET(req: NextRequest) {
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const path = req.nextUrl.searchParams.get("path") || "";
  // Only files this user uploaded may be read back — never arbitrary paths.
  const normalized = path.replace(/\\/g, "/").replace(/\.\.+/g, ".").replace(/^\/+/, "");
  if (!normalized.startsWith("uploads/") || normalized.includes("..") || normalized.length > 200) {
    return NextResponse.json({ ok: false, error: "path ต้องอยู่ภายใต้ uploads/ เท่านั้น" }, { status: 400 });
  }

  const upstream = await computerFile(userId, `workspace/${normalized}`);
  if (!upstream || !upstream.ok || !upstream.body) {
    return NextResponse.json({ ok: false, error: "ไม่พบไฟล์ใน Cloud Computer workspace" }, { status: 404 });
  }

  const fileName = normalized.split("/").pop() || "upload.bin";
  const headers = new Headers();
  headers.set("content-type", contentTypeFor(fileName));
  const len = upstream.headers.get("content-length");
  if (len) headers.set("content-length", len);
  headers.set("content-disposition", `inline; filename="${encodeURIComponent(fileName)}"`);
  headers.set("cache-control", "no-store");
  return new NextResponse(upstream.body, { headers });
}