import { NextResponse } from "next/server";
import { generateSciencePaper } from "@/lib/sciencePaper";

export const runtime = "nodejs";

export async function POST(request) {
  try {
    const body = await request.json().catch(() => ({}));

    const result = await generateSciencePaper({
      classLevel: body.classLevel ?? 10,
      subject: body.subject ?? "Science",
      chapters: body.chapters ?? [],
      difficulty: body.difficulty ?? "balanced",
      maxMarks: body.maxMarks ?? 80,
      durationMinutes: body.durationMinutes ?? 180,
      sections: body.sections,
      prompt: body.prompt,
    });

    return NextResponse.json(result);
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unexpected error occurred.";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

