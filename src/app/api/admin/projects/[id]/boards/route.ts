import prisma from "@/lib/db";
import { z } from "zod";
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

const AddBoardSchema = z.object({
  connectorId: z.string(),
  boardId: z.string(),
  boardName: z.string(),
  boardType: z.enum(["scrum", "kanban"]).default("scrum"),
});

export async function GET(_: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const boards = await prisma.projectBoard.findMany({
    where: { projectId: id },
    include: { connector: { select: { id: true, type: true, name: true } } },
    orderBy: { createdAt: "asc" },
  });
  return NextResponse.json(boards);
}

export async function POST(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: projectId } = await params;
  const body = await req.json();
  const parsed = AddBoardSchema.safeParse(body);
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const board = await prisma.projectBoard.create({
    data: { ...parsed.data, projectId },
    include: { connector: { select: { id: true, type: true, name: true } } },
  });
  return NextResponse.json(board, { status: 201 });
}

export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id: projectId } = await params;
  const { boardId } = await req.json();
  await prisma.projectBoard.deleteMany({ where: { projectId, id: boardId } });
  return new NextResponse(null, { status: 204 });
}
