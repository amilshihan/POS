import path from "node:path";
import { execFile } from "node:child_process";
import { NextResponse } from "next/server";
import { getCurrentUserAndProfile } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

export async function POST() {
  const { user } = await getCurrentUserAndProfile();
  if (!user) {
    return NextResponse.json({ error: "Not signed in." }, { status: 401 });
  }

  const supabase = await createClient();
  const { data: settings } = await supabase.from("shop_settings").select("printer_name").single();
  const printerName = settings?.printer_name?.trim();

  if (!printerName) {
    return NextResponse.json(
      { error: "No printer configured. Set the printer name in Settings first." },
      { status: 400 }
    );
  }

  const scriptPath = path.join(process.cwd(), "scripts", "open-drawer.ps1");

  try {
    await new Promise<void>((resolve, reject) => {
      execFile(
        "powershell.exe",
        ["-NoProfile", "-ExecutionPolicy", "Bypass", "-File", scriptPath, "-PrinterName", printerName],
        { timeout: 10_000 },
        (err, stdout, stderr) => {
          if (err || !stdout.includes("OK")) {
            reject(new Error(stderr.trim() || stdout.trim() || err?.message || "Unknown printer error."));
            return;
          }
          resolve();
        }
      );
    });
    return NextResponse.json({ ok: true });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Could not open the drawer." },
      { status: 500 }
    );
  }
}
