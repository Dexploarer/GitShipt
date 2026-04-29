import { NextResponse } from "next/server";
import { z } from "zod";

import { check } from "@/lib/rate-limit";
import { captureEvent } from "@/lib/observability";

/**
 * Content-Security-Policy violation receiver.
 *
 * Browsers POST violation reports here in two shapes:
 *   - Reporting API v1 (modern):  application/reports+json — array of
 *     `{ type, age, url, body: {...} }` records.
 *   - Legacy report-uri:          application/csp-report — single object
 *     wrapped in `{ "csp-report": {...} }`.
 *
 * Both are accepted, normalized, and forwarded to the observability sink as
 * structured events. Body is read once, parsed leniently, and rate-limited
 * per IP so a hostile origin cannot exhaust logging budget.
 */

const LegacyReportSchema = z
  .object({
    "csp-report": z
      .object({
        "blocked-uri": z.string().optional(),
        "violated-directive": z.string().optional(),
        "effective-directive": z.string().optional(),
        "document-uri": z.string().optional(),
        "source-file": z.string().optional(),
        "line-number": z.number().optional(),
        "column-number": z.number().optional(),
        "script-sample": z.string().optional(),
        disposition: z.string().optional(),
      })
      .partial()
      .passthrough(),
  })
  .passthrough();

const ReportingApiEntry = z
  .object({
    type: z.string(),
    age: z.number().optional(),
    url: z.string().optional(),
    user_agent: z.string().optional(),
    body: z.record(z.string(), z.unknown()).optional(),
  })
  .passthrough();

const ReportingApiSchema = z.array(ReportingApiEntry);

export async function POST(req: Request): Promise<Response> {
  const ip =
    req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "unknown";
  const limit = await check("csp-report", `csp:${ip}`);
  if (!limit.success) {
    return new NextResponse(null, { status: 429 });
  }

  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    // Many browsers send malformed JSON or empty bodies on first violation.
    // Don't 4xx — silently accept so we don't churn client-side.
    return new NextResponse(null, { status: 204 });
  }

  if (Array.isArray(raw)) {
    const parsed = ReportingApiSchema.safeParse(raw);
    if (parsed.success) {
      for (const entry of parsed.data) {
        if (entry.type !== "csp-violation") continue;
        captureEvent("csp.violation", {
          area: "csp.report",
          severity: "warning",
          tags: {
            disposition:
              (entry.body?.["disposition"] as string | undefined) ?? "enforce",
            directive:
              (entry.body?.["effectiveDirective"] as string | undefined) ??
              (entry.body?.["violatedDirective"] as string | undefined) ??
              "unknown",
          },
          extra: {
            documentUrl: entry.url,
            blockedUrl: entry.body?.["blockedURL"],
            sourceFile: entry.body?.["sourceFile"],
            lineNumber: entry.body?.["lineNumber"],
            scriptSample: entry.body?.["sample"],
          },
        });
      }
      return new NextResponse(null, { status: 204 });
    }
  }

  const legacy = LegacyReportSchema.safeParse(raw);
  if (legacy.success) {
    const r = legacy.data["csp-report"];
    captureEvent("csp.violation", {
      area: "csp.report",
      severity: "warning",
      tags: {
        disposition: r.disposition ?? "enforce",
        directive:
          r["effective-directive"] ?? r["violated-directive"] ?? "unknown",
      },
      extra: {
        documentUrl: r["document-uri"],
        blockedUrl: r["blocked-uri"],
        sourceFile: r["source-file"],
        lineNumber: r["line-number"],
        columnNumber: r["column-number"],
        scriptSample: r["script-sample"],
      },
    });
    return new NextResponse(null, { status: 204 });
  }

  // Unknown shape — capture the raw envelope at debug level so we can adapt.
  captureEvent("csp.violation_unknown_shape", {
    area: "csp.report",
    severity: "info",
    extra: { sample: typeof raw === "object" ? raw : String(raw) },
  });
  return new NextResponse(null, { status: 204 });
}
