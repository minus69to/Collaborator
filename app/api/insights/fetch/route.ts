import { NextRequest } from "next/server";
import { requireUser } from "@/lib/auth";
import { toErrorResponse, badRequest } from "@/lib/errors";
import { getHMSRecordingAssets, getHMSRecordingAssetDownloadUrl } from "@/lib/hms";

/**
 * Fetch transcript text and AI summary text for a recording
 * GET /api/insights/fetch?recordingId=REC_ID
 */
export async function GET(request: NextRequest) {
  try {
    await requireUser();
    const searchParams = request.nextUrl.searchParams;
    const recordingId = searchParams.get("recordingId");
    if (!recordingId) {
      throw badRequest("recordingId is required");
    }

    const assets = await getHMSRecordingAssets(recordingId);

    // Prefer transcript txt > transcript json > transcript srt
    const transcriptTxt = assets.find(
      (a: any) =>
        a.status === "completed" &&
        (
          (typeof a.type === "string" && a.type.toLowerCase().includes("transcript")) ||
          (typeof a.name === "string" && a.name.toLowerCase().includes("transcript")) ||
          (typeof a.file_name === "string" && a.file_name.toLowerCase().includes("transcript")) ||
          (a.file_extension && ["txt"].includes(String(a.file_extension).toLowerCase()))
        )
    );
    const transcriptJson = assets.find(
      (a: any) =>
        a.status === "completed" &&
        (
          (typeof a.type === "string" && a.type.toLowerCase().includes("transcript")) ||
          (typeof a.name === "string" && a.name.toLowerCase().includes("transcript")) ||
          (typeof a.file_name === "string" && a.file_name.toLowerCase().includes("transcript")) ||
          (a.file_extension && ["json"].includes(String(a.file_extension).toLowerCase()))
        )
    );
    const transcriptSrt = assets.find(
      (a: any) =>
        a.status === "completed" &&
        (
          (typeof a.type === "string" && a.type.toLowerCase().includes("transcript")) ||
          (typeof a.name === "string" && a.name.toLowerCase().includes("transcript")) ||
          (typeof a.file_name === "string" && a.file_name.toLowerCase().includes("transcript")) ||
          (a.file_extension && ["srt", "vtt"].includes(String(a.file_extension).toLowerCase()))
        )
    );

    function isTranscriptLike(a: any): boolean {
      const all = [
        a?.type, a?.name, a?.file_name, a?.format, a?.file_extension
      ].map((v: any) => String(v || "").toLowerCase());
      return all.some((s) => s.includes("transcript"));
    }
    function isSummaryLike(a: any): boolean {
      const all = [
        a?.type, a?.name, a?.file_name, a?.format, a?.file_extension
      ].map((v: any) => String(v || "").toLowerCase());
      return (
        all.some((s) => s.includes("summary")) ||
        (all.some((s) => s.includes("ai")) && all.some((s) => s.includes("summary"))) ||
        all.some((s) => s.includes("insight"))
      );
    }
    const summaryJson =
      assets.find(
        (a: any) =>
          a.status === "completed" && isSummaryLike(a)
      ) ||
      // Fallback: any JSON asset that is not clearly transcript-like
      assets.find(
        (a: any) =>
          a.status === "completed" &&
          String(a?.file_extension || a?.format || "").toLowerCase() === "json" &&
          !isTranscriptLike(a)
      );

    function formatTranscriptFromJson(json: any): string {
      try {
        if (!json) return "";
        if (typeof json === "string") return json;
        // Common fields
        if (typeof json.transcript === "string") return json.transcript;
        if (typeof json.text === "string") return json.text;
        // Segments array
        if (Array.isArray(json.segments)) {
          return json.segments
            .map((s: any) => {
              const speaker = s?.speaker || s?.speaker_name || s?.speakerId || "";
              const text = s?.text || "";
              return speaker ? `${speaker}: ${text}` : text;
            })
            .join("\n\n");
        }
        // Array of blocks with paragraph/bullets
        if (Array.isArray(json)) {
          const parts: string[] = [];
          json.forEach((b: any) => {
            if (typeof b?.paragraph === "string" && b.paragraph.trim()) {
              parts.push(b.paragraph.trim());
            }
            if (Array.isArray(b?.bullets)) {
              b.bullets.forEach((it: any) => {
                if (typeof it === "string" && it.trim()) {
                  parts.push(`- ${it.trim()}`);
                }
              });
            }
          });
          return parts.join("\n");
        }
        // Generic bullets/paragraph
        const bullets = Array.isArray(json.bullets) ? json.bullets : [];
        const paragraph = typeof json.paragraph === "string" ? json.paragraph : "";
        if (bullets.length || paragraph) {
          return [paragraph, ...bullets.map((b: any) => `- ${b}`)].filter(Boolean).join("\n");
        }
        return "";
      } catch {
        return "";
      }
    }

    function formatSummaryFromJson(json: any): string {
      try {
        if (!json) return "";
        if (typeof json === "string") return json;
        // Handle { sections: [...] } shape
        if (Array.isArray(json.sections)) {
          const lines: string[] = [];
          json.sections.forEach((sec: any) => {
            if (Array.isArray(sec?.bullets)) {
              sec.bullets.forEach((b: any) => {
                if (typeof b === "string" && b.trim()) {
                  lines.push(`- ${b.trim()}`);
                }
              });
            }
            if (typeof sec?.paragraph === "string" && sec.paragraph.trim()) {
              lines.push(sec.paragraph.trim());
            }
          });
          return lines.join("\n");
        }
        const title = json.title || json.heading || "";
        const bullets: string[] =
          (Array.isArray(json.bullets) && json.bullets) ||
          (Array.isArray(json.points) && json.points) ||
          (Array.isArray(json.items) && json.items) ||
          [];
        const paragraph: string =
          json.paragraph || json.text || json.summary || json.ai_summary || "";
        const lines: string[] = [];
        if (title) lines.push(title);
        if (bullets.length) lines.push(...bullets.map((b: any) => `- ${String(b)}`));
        if (paragraph) lines.push(paragraph);
        // If it's an array of blocks
        if (Array.isArray(json)) {
          const parts: string[] = [];
          json.forEach((b: any) => {
            if (Array.isArray(b?.bullets)) {
              b.bullets.forEach((it: any) => parts.push(`- ${String(it)}`));
            }
            if (typeof b?.paragraph === "string" && b.paragraph.trim()) {
              parts.push(b.paragraph.trim());
            }
          });
          return parts.join("\n");
        }
        return lines.filter(Boolean).join("\n");
      } catch {
        return "";
      }
    }

    let transcriptText: string | null = null;
    // Try TXT first
    if (transcriptTxt?.id) {
      const url = await getHMSRecordingAssetDownloadUrl(transcriptTxt.id);
      if (url) {
        const resp = await fetch(url);
        transcriptText = await resp.text();
      }
    } else if (transcriptJson?.id) {
      const url = await getHMSRecordingAssetDownloadUrl(transcriptJson.id);
      if (url) {
        const resp = await fetch(url);
        try {
          const json = await resp.json();
          const formatted = formatTranscriptFromJson(json);
          transcriptText = formatted || null;
        } catch {
          transcriptText = await resp.text();
        }
      }
    } else if (transcriptSrt?.id) {
      const url = await getHMSRecordingAssetDownloadUrl(transcriptSrt.id);
      if (url) {
        const resp = await fetch(url);
        transcriptText = await resp.text();
      }
    }

    // Summary
    let summaryText: string | null = null;
    if (summaryJson?.id) {
      const url = await getHMSRecordingAssetDownloadUrl(summaryJson.id);
      if (url) {
        const resp = await fetch(url);
        try {
          const json = await resp.json();
          const formatted = formatSummaryFromJson(json);
          summaryText = formatted || null;
        } catch {
          summaryText = await resp.text();
        }
      }
    }
    // Fallback: if summary not found as a separate asset, try deriving from transcript JSON
    if (!summaryText && transcriptJson?.id) {
      const url = await getHMSRecordingAssetDownloadUrl(transcriptJson.id);
      if (url) {
        try {
          const resp = await fetch(url);
          const json = await resp.json().catch(() => null);
          if (json) {
            // Heuristics: look for blocks with title including "summary" or fields summary/ai_summary
            if (typeof json.summary === "string" && json.summary.trim()) {
              summaryText = json.summary.trim();
            } else if (typeof json.ai_summary === "string" && json.ai_summary.trim()) {
              summaryText = json.ai_summary.trim();
            } else if (Array.isArray(json)) {
              const bullets: string[] = [];
              const paras: string[] = [];
              json.forEach((b: any) => {
                const title = (b?.title || "").toString().toLowerCase();
                if (title.includes("summary")) {
                  if (Array.isArray(b?.bullets)) {
                    b.bullets.forEach((it: any) => {
                      if (typeof it === "string" && it.trim()) bullets.push(it.trim());
                    });
                  }
                  if (typeof b?.paragraph === "string" && b.paragraph.trim()) {
                    paras.push(b.paragraph.trim());
                  }
                }
              });
              if (bullets.length || paras.length) {
                summaryText = [...bullets.map(b => `- ${b}`), ...paras].join("\n");
              }
            }
          }
        } catch {
          // ignore
        }
      }
    }

    return Response.json({
      ok: true,
      recordingId,
      transcriptText,
      summaryText,
    });
  } catch (error) {
    return toErrorResponse(error);
  }
}


