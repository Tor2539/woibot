import { NextRequest, NextResponse } from "next/server";
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const body = await req.json().catch(() => ({}));
  return NextResponse.json({ ok: true, id, patch: body });
}
export async function DELETE(_req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return NextResponse.json({ ok: true, id, deleted: true });
}
