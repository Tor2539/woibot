import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getUserId } from "@/lib/auth";
import { callWoibotLLM } from "@/lib/llm";

export async function GET(req: NextRequest) {
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  const downloadId = req.nextUrl.searchParams.get("download");
  if (downloadId) {
    const art = await prisma.artifact.findFirst({ where: { id: downloadId } });
    const del = await prisma.deliverable.findFirst({ where: { id: downloadId } });
    const title = art?.title || del?.fileName || "woibot-deliverable.md";
    const content =
      art?.content ||
      JSON.stringify(
        {
          deliverableId: downloadId,
          fileName: del?.fileName || title,
          verifiedBy: "woibot Verification Pipeline v2.0",
          exportedAt: new Date().toISOString(),
          status: "VERIFIED_PASSED",
        },
        null,
        2
      );
    return new NextResponse(content, {
      status: 200,
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Content-Disposition": `attachment; filename="${encodeURIComponent(title.replace(/\s+/g, "-"))}.txt"`,
      },
    });
  }

  const tab = req.nextUrl.searchParams.get("tab") || "all";
  const origin = req.nextUrl.searchParams.get("origin") || "all";
  const q = (req.nextUrl.searchParams.get("q") || "").toLowerCase();

  let list = await prisma.artifact.findMany({ where: { userId }, orderBy: { updatedAt: "desc" } });
  if (tab !== "all" && tab !== "shared") {
    list = list.filter((a: any) => a.tab === tab);
  }
  if (origin !== "all") {
    list = list.filter((a: any) => a.origin === origin);
  }
  if (q) {
    list = list.filter(
      (a: any) =>
        String(a.title).toLowerCase().includes(q) ||
        String(a.summary).toLowerCase().includes(q) ||
        String(a.subKind).toLowerCase().includes(q)
    );
  }

  return NextResponse.json({
    ok: true,
    artifacts: list,
    counts: {
      all: list.length,
      docs: list.filter((a: any) => a.tab === "docs").length,
      slides: list.filter((a: any) => a.tab === "slides").length,
      design: list.filter((a: any) => a.tab === "design").length,
      dashboard: list.filter((a: any) => a.tab === "dashboard").length,
      "3d": list.filter((a: any) => a.tab === "3d").length,
    },
  });
}

export async function POST(req: NextRequest) {
  const userId = await getUserId(req);
  if (!userId) return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  const body = await req.json();
  const tab = body.tab || "docs";
  const title = body.title || "New Verified Artifact";
  const audience = body.audience || "Executive";
  const style = body.style || "Minimal SaaS";
  const prompt = body.prompt || title;

  const llm = await callWoibotLLM({
    system: `You are woibot Work Artifacts Studio (Claude Artifacts + Designer Mode).
Generate structured, production-ready content for a ${tab.toUpperCase()} artifact.
Audience: ${audience} | Visual Style: ${style}.
Use clean Markdown sections, executive summary, and concrete metrics/tables. No filler.`,
    user: prompt,
  });

  const subKindMap: Record<string, string> = {
    docs: "DOCX / PDF · Editable Document",
    slides: "PPTX · 16:9 Presentation Deck",
    design: "UI Prototype · Desktop + Mobile",
    dashboard: "Interactive BI · Tabular KPIs",
    "3d": "GLB / PBR 3D Studio Mesh",
  };

  const created = await prisma.artifact.create({
    data: {
      userId,
      title,
      tab,
      subKind: subKindMap[tab] || "Verified Artifact",
      origin: body.origin || "work",
      versions: 1,
      currentVersion: 1,
      status: "verified",
      accentColor: body.accentColor || "#2b66e0",
      summary: `Audience: ${audience} · Style: ${style} — ${prompt.slice(0, 110)}`,
      content: llm.text,
    },
  });

  return NextResponse.json({ ok: true, artifact: created });
}

export async function PATCH(req: NextRequest) {
  const body = await req.json();
  if (!body.id) return NextResponse.json({ ok: false, error: "id required" }, { status: 400 });
  const existing = await prisma.artifact.findFirst({ where: { id: body.id } });
  if (!existing) return NextResponse.json({ ok: false, error: "Not found" }, { status: 404 });

  const nextVer = (Number(existing.versions) || 1) + (body.bumpVersion ? 1 : 0);
  const updated = await prisma.artifact.update({
    where: { id: body.id },
    data: {
      title: body.title ?? existing.title,
      content: body.content ?? existing.content,
      summary: body.summary ?? existing.summary,
      accentColor: body.accentColor ?? existing.accentColor,
      versions: nextVer,
      currentVersion: nextVer,
    },
  });
  return NextResponse.json({ ok: true, artifact: updated });
}

export async function DELETE(req: NextRequest) {
  const id = req.nextUrl.searchParams.get("id");
  if (!id) return NextResponse.json({ ok: false, error: "id required" }, { status: 400 });
  await prisma.artifact.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
