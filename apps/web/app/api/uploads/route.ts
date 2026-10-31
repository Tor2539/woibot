import { NextRequest, NextResponse } from "next/server";
import { getUserId } from "@/lib/auth";
import { writeWorkspaceBytes } from "@/lib/harness/container";

/**
 * POST /api/uploads { fileName, dataUrl }
 * Writes the file into the user's Cloud Computer workspace so agents can
 * actually open it (no fake /uploads/... URLs).
 */
export async function POST(req: NextRequest) {
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const name = String(body.fileName || "").replace(/[^A-Za-z0-9._\-\u0E00-\u0E7F ]/g, "_").slice(0, 120);
  const dataUrl = String(body.dataUrl || "");
  if (!name || !dataUrl.includes(",")) {
    return NextResponse.json({ ok: false, error: "fileName and dataUrl are required" }, { status: 400 });
  }

  const [, b64] = dataUrl.split(",", 2);
  const buf = Buffer.from(b64, "base64");
  if (buf.length === 0) return NextResponse.json({ ok: false, error: "empty file" }, { status: 400 });
  if (buf.length > 12 * 1024 * 1024) return NextResponse.json({ ok: false, error: "ไฟล์ใหญ่เกิน 12MB" }, { status: 413 });

  const rel = `uploads/${Date.now()}-${name}`;
  const res = await writeWorkspaceBytes(userId, rel, new Uint8Array(buf));
  if (res.exitCode !== 0) {
    return NextResponse.json({ ok: false, error: res.stderr.slice(0, 200) }, { status: 500 });
  }
  return NextResponse.json({ ok: true, path: rel, bytes: buf.length });
}
