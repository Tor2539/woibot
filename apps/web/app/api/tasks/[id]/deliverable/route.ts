import { NextRequest, NextResponse } from "next/server";
import { getUserId } from "@/lib/auth";
import { computerFile } from "@/lib/computer";

/** GET /api/tasks/[id]/deliverable?path=report.md — streams the real file from the container. */
export async function GET(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });

  const rel = req.nextUrl.searchParams.get("path");
  if (!rel) return NextResponse.json({ ok: false, error: "path is required" }, { status: 400 });

  const relPath = rel.startsWith("workspace/") ? rel : `workspace/${rel}`;
  const upstream = await computerFile(userId, relPath);
  if (!upstream || !upstream.ok || !upstream.body) {
    return NextResponse.json({ ok: false, error: "file_not_found_in_workspace" }, { status: 404 });
  }

  const headers = new Headers();
  headers.set("content-type", upstream.headers.get("content-type") || "application/octet-stream");
  const len = upstream.headers.get("content-length");
  if (len) headers.set("content-length", len);
  headers.set("content-disposition", `attachment; filename="${rel.split("/").pop()}"`);
  headers.set("cache-control", "no-store");

  return new NextResponse(upstream.body, { headers });
}
