import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const body = await req.json();
  const updated = await prisma.memory.update({
    where: { id },
    data: {
      key: body.key,
      value: body.value,
      scope: body.scope,
    },
  });
  return NextResponse.json({ ok: true, memory: updated });
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  await prisma.memory.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
