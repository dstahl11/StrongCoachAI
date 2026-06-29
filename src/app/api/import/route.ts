import { NextResponse } from "next/server";
import { revalidatePath } from "next/cache";
import { parseWorkoutCsv, importWorkouts } from "@/lib/import";
import { getCurrentUser } from "@/lib/auth/current-user";

export const dynamic = "force-dynamic";
export const maxDuration = 300;

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: "unauthorized" }, { status: 401 });
    }
    const form = await req.formData();
    const file = form.get("file");
    const replace = form.get("mode") !== "append";

    if (!(file instanceof File)) {
      return NextResponse.json({ error: "No file uploaded." }, { status: 400 });
    }
    const text = await file.text();
    const rows = parseWorkoutCsv(text);
    if (rows.length === 0) {
      return NextResponse.json(
        { error: "No rows found in CSV." },
        { status: 400 },
      );
    }
    const summary = await importWorkouts(rows, { replace, userId: user.id });

    revalidatePath("/calendar");
    revalidatePath("/dashboard");
    revalidatePath("/exercises");

    return NextResponse.json({ ok: true, summary });
  } catch (e) {
    console.error("import failed", e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Import failed." },
      { status: 500 },
    );
  }
}
