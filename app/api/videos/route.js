import { NextResponse } from "next/server";
import { getVideoFeed } from "@/lib/video-provider";
import { getMacCmsVideoById } from "@/lib/maccms-provider.mjs";
import { searchVideos } from "@/lib/video-search.mjs";

// Query parameters affect the API representation. Never prerender or edge-cache
// this route: stale query-independent responses can turn 400/404 into false 200s.
export const dynamic = "force-dynamic";
export const revalidate = 0;

function apiJson(payload, status = 200) {
  return NextResponse.json(payload, {
    status,
    headers: { "Cache-Control": "no-store" }
  });
}

export async function GET(request) {
  try {
    const incoming = new URL(request.url).searchParams;
    const params = new URLSearchParams(incoming);
    const aliases = [["keyword", "q"], ["search", "q"], ["pageSize", "limit"], ["per_page", "limit"], ["currentPage", "page"]];
    for (const [legacy, canonical] of aliases) {
      if (!params.has(canonical) && params.has(legacy)) params.set(canonical, params.get(legacy));
    }

    const id = params.get("id");
    if (id?.startsWith("maccms:")) {
      const result = await getMacCmsVideoById(id);
      if (!result) return apiJson({ success: false, error: "Video not found" }, 404);
      return apiJson({ success: true, result, source: "maccms" });
    }

    // Validate request parameters before invoking any provider adapter.
    if (!id) {
      try {
        searchVideos([], params);
      } catch (error) {
        return apiJson({ success: false, error: error.message }, 400);
      }
    }

    const { results, source, providerStatus, providerErrors, rightsGate } = await getVideoFeed();
    if (id) {
      const result = results.find(video => video.id === id);
      if (!result) return apiJson({ success: false, error: "Video not found" }, 404);
      return apiJson({ success: true, result, source });
    }

    const page = searchVideos(results, params);
    return apiJson({
      success: true,
      ...page,
      results: Array.isArray(page.results) ? page.results : (Array.isArray(page.items) ? page.items : []),
      items: Array.isArray(page.items) ? page.items : (Array.isArray(page.results) ? page.results : []),
      source,
      providerStatus: providerStatus || [],
      providerErrors: providerErrors || [],
      rightsGate: rightsGate || { policy: "deny-by-default", providers: [] },
      updatedAt: new Date().toISOString()
    });
  } catch (error) {
    console.error("[videos-api]", error);
    return apiJson({ success: false, error: "Video feed is temporarily unavailable" }, 502);
  }
}

export async function HEAD(request) {
  const response = await GET(request);
  return new NextResponse(null, { status: response.status, headers: response.headers });
}

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      Allow: "GET, HEAD, OPTIONS",
      "Access-Control-Allow-Methods": "GET, HEAD, OPTIONS",
      "Access-Control-Max-Age": "600",
      "Cache-Control": "no-store"
    }
  });
}

export async function POST() {
  return apiJson({ error: "Method not allowed", allow: ["GET", "HEAD", "OPTIONS"] }, 405);
}
