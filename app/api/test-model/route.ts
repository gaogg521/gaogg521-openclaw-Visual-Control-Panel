import { NextResponse } from "next/server";
import {
  DEFAULT_MODEL_PROBE_TIMEOUT_MS,
  humanizeModelProbeError,
  probeModel,
} from "@/lib/model-probe";

const PROBE_TIMEOUT_MS = DEFAULT_MODEL_PROBE_TIMEOUT_MS;

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));
    const providerId = String(body?.provider || "").trim();
    const modelId = String(body?.modelId || "").trim();
    const agentId =
      typeof body?.agentId === "string" && body.agentId.trim() ? body.agentId.trim() : undefined;
    const probePresetId =
      typeof body?.probePresetId === "string" && body.probePresetId.trim()
        ? body.probePresetId.trim()
        : undefined;
    const overrideApiKey =
      typeof body?.overrideApiKey === "string" && body.overrideApiKey.trim()
        ? body.overrideApiKey.trim()
        : undefined;
    const rawCh = body?.customHttp;
    const customHttp =
      rawCh &&
      typeof rawCh === "object" &&
      typeof (rawCh as any).baseUrl === "string" &&
      String((rawCh as any).baseUrl).trim() &&
      typeof (rawCh as any).protocol === "string" &&
      String((rawCh as any).protocol).trim()
        ? {
            baseUrl: String((rawCh as any).baseUrl).trim(),
            protocol: String((rawCh as any).protocol).trim(),
          }
        : undefined;

    if (!modelId) {
      return NextResponse.json({ error: "Missing modelId" }, { status: 400 });
    }
    if (!providerId && !probePresetId && !customHttp) {
      return NextResponse.json(
        { error: "Missing provider, probePresetId, or customHttp" },
        { status: 400 },
      );
    }

    const result = await probeModel({
      ...(providerId ? { providerId } : {}),
      modelId,
      timeoutMs: PROBE_TIMEOUT_MS,
      ...(agentId ? { agentId } : {}),
      ...(overrideApiKey ? { overrideApiKey } : {}),
      ...(probePresetId ? { probePresetId } : {}),
      ...(customHttp ? { customHttp } : {}),
    });
    const errorHint = !result.ok ? humanizeModelProbeError(result.error) : undefined;
    return NextResponse.json({
      ok: result.ok,
      elapsed: result.elapsed,
      model: result.model,
      mode: result.mode,
      status: result.status,
      error: result.error,
      errorHint,
      text: result.text,
      precision: result.precision,
      source: result.source,
    });
  } catch (err: any) {
    return NextResponse.json(
      { ok: false, error: err.message || "Probe failed", elapsed: 0 },
      { status: 500 }
    );
  }
}

