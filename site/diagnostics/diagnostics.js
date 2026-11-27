const API = window.CLIPVIET_API_BASE || "https://clipviet-catalog-api-preview.huynhthuongg2505-f9b.workers.dev";
const PLAYBACK_API = "https://clipviet-playback-api-preview.huynhthuongg2505-f9b.workers.dev";
const $ = (id) => document.getElementById(id);
const results = $("results");
const summary = $("summary");
const run = $("run");
const video = $("test-video");
const checks = [];

$("age-confirm").addEventListener("change", updateGate);
$("rights-confirm").addEventListener("change", updateGate);

function updateGate() {
  run.disabled = !$("age-confirm").checked || !$("rights-confirm").checked;
}

function add(label, state, detail) {
  checks.push({ label, state, detail });
  const li = document.createElement("li");
  const tag = document.createElement("span");
  const text = document.createElement("span");
  tag.className = "state " + state;
  tag.textContent = state.toUpperCase();
  text.textContent = label + " — " + detail;
  li.append(tag, text);
  results.append(li);
}

function corsState(response) {
  return response.type === "cors" || response.type === "basic";
}

async function requestJsonFrom(base, path, label) {
  const response = await fetch(base + path, {
    headers: { Accept: "application/json" },
    cache: "no-store",
    credentials: "omit",
    mode: "cors",
    redirect: "error"
  });
  if (!response.ok) throw new Error(label + " HTTP " + response.status);
  const type = (response.headers.get("content-type") || "").toLowerCase();
  if (!type.includes("application/json")) throw new Error(label + " MIME " + (type || "missing"));
  if (!corsState(response)) throw new Error(label + " CORS origin không được chấp nhận");
  return response.json();
}

async function checkAdminAccess() {
  try {
    const response = await fetch(new URL("../admin/", location.href), {
      method: "GET", credentials: "omit", redirect: "manual", cache: "no-store"
    });
    const locationHeader = response.headers.get("location") || "";
    const redirected = response.status >= 300 && response.status < 400;
    const looksLikeAccess = /cloudflareaccess|access\.cloudflare|cdn-cgi\/access/i.test(locationHeader);
    if (looksLikeAccess) add("Admin Access gate", "pass", "HTTP " + response.status + " · chuyển hướng Cloudflare Access");
    else if (redirected) add("Admin Access gate", "warn", "Admin chuyển hướng HTTP " + response.status + " nhưng chưa xác định được Cloudflare Access");
    else if (response.ok) add("Admin Access gate", "warn", "/admin/ trả HTTP " + response.status + "; cần xác nhận policy phía API");
    else add("Admin Access gate", "warn", "/admin/ trả HTTP " + response.status + "; kiểm tra policy và API đăng nhập");
  } catch (error) {
    add("Admin Access gate", "warn", "Không thể xác minh bằng fetch: " + (error.message || String(error)) + " · mở /admin/ trong tab mới để xác nhận");
  }
}

async function checkAdminApi() {
  try {
    const session = await fetch(API + "/api/admin/session", {
      headers: { Accept: "application/json" }, credentials: "omit", redirect: "error", cache: "no-store"
    });
    if (session.status === 401 || session.status === 403) add("Admin session API", "pass", "Không có token hợp lệ · HTTP " + session.status);
    else if (session.status === 404) add("Admin session API", "fail", "Endpoint /api/admin/session chưa được triển khai (404)");
    else if (session.ok) add("Admin session API", "fail", "API chấp nhận phiên không có token (HTTP " + session.status + ")");
    else add("Admin session API", "warn", "HTTP " + session.status + " · cần kiểm tra phản hồi");

    const login = await fetch(API + "/api/admin/login", {
      method: "POST",
      headers: { Accept: "application/json", "Content-Type": "text/plain" },
      body: "{}",
      credentials: "omit",
      redirect: "error",
      cache: "no-store"
    });
    if (login.status === 400 || login.status === 422) add("Admin login API", "pass", "Endpoint tồn tại và kiểm tra payload · HTTP " + login.status);
    else if (login.status === 404 || login.status === 405) add("Admin login API", "fail", "Endpoint đăng nhập chưa được triển khai hoặc POST bị từ chối · HTTP " + login.status);
    else if (login.status === 401) add("Admin login API", "pass", "Endpoint từ chối payload không hợp lệ · HTTP 401");
    else add("Admin login API", "warn", "HTTP " + login.status + " · cần kiểm tra phản hồi");
  } catch (error) {
    add("Admin auth API", "fail", "Không thể gọi API đăng nhập/phiên: " + (error.message || String(error)));
  }
}

async function rangeProbe(url) {
  const response = await fetch(url, {
    method: "GET",
    headers: { Range: "bytes=0-0", Accept: "*/*" },
    mode: "cors", credentials: "omit", redirect: "error", cache: "no-store"
  });
  const type = (response.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
  const contentRange = response.headers.get("content-range") || "";
  const contentLength = response.headers.get("content-length") || "";
  const validRange = /^bytes\s+0-0\/(?:[1-9]\d*|\*)$/i.test(contentRange);
  if (response.body) await response.body.cancel().catch(() => {});
  return {
    status: response.status,
    type,
    cors: corsState(response),
    contentRange,
    contentLength,
    pass: response.status === 206 && corsState(response) && validRange && (!contentLength || contentLength === "1")
  };
}

async function fetchHlsSegment(manifestUrl) {
  let url = manifestUrl;
  for (let depth = 0; depth < 3; depth++) {
    const response = await fetch(url, {
      headers: { Accept: "application/vnd.apple.mpegurl,application/x-mpegURL,*/*" },
      mode: "cors", credentials: "omit", redirect: "error", cache: "no-store"
    });
    if (!response.ok) throw new Error("HLS manifest HTTP " + response.status);
    const type = (response.headers.get("content-type") || "").toLowerCase();
    if (!corsState(response)) throw new Error("HLS manifest CORS blocked");
    if (!type.includes("mpegurl") && !type.includes("vnd.apple")) throw new Error("HLS manifest MIME " + (type || "missing"));
    const body = await response.text();
    if (body.length > 512000) throw new Error("HLS manifest exceeds 512 KB");
    const uri = body.split(/\r?\n/).map(x => x.trim()).find(x => x && !x.startsWith("#"));
    if (!uri) throw new Error("HLS playlist has no media URI");
    url = new URL(uri, url).href;
    if (/\.m3u8(?:$|[?#])/i.test(url)) continue;
    const segment = await fetch(url, {
      headers: { Range: "bytes=0-0", Accept: "*/*" },
      mode: "cors", credentials: "omit", redirect: "error", cache: "no-store"
    });
    const segmentType = (segment.headers.get("content-type") || "").split(";")[0].trim().toLowerCase();
    const range = segment.headers.get("content-range") || "";
    const ok = (segment.status === 206 || segment.status === 200) && corsState(segment);
    if (segment.body) await segment.body.cancel().catch(() => {});
    return { manifestType: type, segmentType, segmentStatus: segment.status, segmentRange: range, pass: ok };
  }
  throw new Error("HLS master playlist did not resolve to a media segment");
}

async function testPlayer(url, isHls, label) {
  video.hidden = false;
  video.crossOrigin = "anonymous";
  video.preload = "metadata";
  video.src = url;
  video.load();
  if (isHls) {
    const support = video.canPlayType("application/vnd.apple.mpegurl");
    add(label + " native HLS", support ? "pass" : "warn", support || "Safari did not report native HLS support");
  }
  await new Promise((resolve, reject) => {
    let settled = false;
    const finish = (fn, value) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      video.removeEventListener("loadedmetadata", loaded);
      video.removeEventListener("error", failed);
      fn(value);
    };
    const loaded = () => finish(resolve, true);
    const failed = () => finish(reject, new Error("HTMLVideoElement media error " + (video.error?.code || "unknown")));
    const timer = setTimeout(() => finish(reject, new Error("No loadedmetadata event within 20 seconds")), 20000);
    video.addEventListener("loadedmetadata", loaded, { once: true });
    video.addEventListener("error", failed, { once: true });
    if (video.readyState >= 1) finish(resolve, true);
  });
  add(label + " player metadata", "pass",
    "readyState=" + video.readyState + " · " + video.videoWidth + "×" + video.videoHeight + " · nhấn Play để xác nhận hình/tiếng");
  video.addEventListener("loadeddata", () => {
    add(label + " first frame", video.videoWidth > 0 ? "pass" : "warn",
      video.videoWidth + "×" + video.videoHeight + " · readyState=" + video.readyState);
  }, { once: true });
}

async function inspectApprovedVideo(providerId, videoId) {
  const response = await fetch(
    PLAYBACK_API + "/api/playback/providers/" + encodeURIComponent(providerId) + "/videos/" + encodeURIComponent(videoId),
    { headers: { Accept: "application/json" }, cache: "no-store", credentials: "omit", mode: "cors", redirect: "error" }
  );
  const body = await response.json().catch(() => ({}));
  if (response.status !== 200 || body.data?.playbackEnabled !== true || body.data?.playbackRightsApproved !== true) {
    const reason = body.code || body.error || "playback_not_approved";
    add("Video rights gate", response.status === 403 ? "warn" : "fail",
      "HTTP " + response.status + " · " + reason + " · không gửi request tới URL media");
    return false;
  }

  const episodes = (body.data.lines || []).flatMap(line => line.episodes || []);
  if (!episodes.length) {
    add("Video rights gate", "warn", "Rights đã qua nhưng provider không trả episode URL hợp lệ");
    return false;
  }
  const media = episodes.find(item => item.type === "hls" || /\.m3u8(?:$|[?#])/i.test(item.url || "")) ||
    episodes.find(item => item.type === "mp4" || /\.mp4(?:$|[?#])/i.test(item.url || "")) ||
    episodes[0];
  add("Video rights gate", "pass", providerId + ":" + videoId + " · " + episodes.length + " episode URL(s) đã được lọc theo allowlist");

  if (/\.m3u8(?:$|[?#])/i.test(media.url || "") || media.type === "hls") {
    const probe = await fetchHlsSegment(media.url);
    const mimeOk = ["video/mp2t", "video/mp4", "application/mp4", "application/octet-stream"].includes(probe.segmentType);
    add("HLS manifest", "pass", probe.manifestType);
    add("HLS segment MIME", mimeOk ? "pass" : "warn", probe.segmentType || "missing");
    add("HLS segment HTTP/CORS", probe.pass ? "pass" : "fail",
      "HTTP " + probe.segmentStatus + " · CORS " + (probe.pass ? "OK" : "FAIL") + " · " + (probe.segmentRange || "range not exposed"));
    await testPlayer(media.url, true, "HLS");
  } else {
    const probe = await rangeProbe(media.url);
    const mimeOk = probe.type === "video/mp4" || probe.type === "application/mp4";
    add("MP4 MIME", mimeOk ? "pass" : "fail", probe.type || "missing");
    add("MP4 byte-range + CORS", probe.pass ? "pass" : "fail",
      "HTTP " + probe.status + " · CORS " + (probe.cors ? "OK" : "FAIL") +
      " · Content-Range " + (probe.contentRange || "missing") + " · Content-Length " + (probe.contentLength || "not exposed"));
    await testPlayer(media.url, false, "MP4");
  }
  return true;
}

async function runChecks() {
  run.disabled = true;
  run.textContent = "ĐANG KIỂM TRA…";
  results.replaceChildren();
  checks.length = 0;
  video.hidden = true;
  video.removeAttribute("src");
  video.load();

  await checkAdminAccess();
  await checkAdminApi();

  try {
    const health = await requestJsonFrom(PLAYBACK_API, "/health", "Playback Worker health");
    const healthy = health.service === "clipviet-playback-api-preview" &&
      health.environment === "preview" && health.providerRegistryConfigured === true;
    add("Playback Worker Preview", healthy ? "pass" : "fail",
      health.service + " · " + health.environment + " · D1 " + (health.providerRegistryConfigured ? "bound" : "missing") +
      " · policy " + (health.playbackPolicy || "unknown"));

    const providers = await requestJsonFrom(PLAYBACK_API, "/api/providers", "Provider registry");
    const providerRows = Array.isArray(providers.data) ? providers.data : [];
    add("Provider registry", providerRows.length === 5 ? "pass" : "fail",
      providerRows.length + "/5 provider states returned");

    const diagnostics = await requestJsonFrom(PLAYBACK_API, "/api/providers/diagnostics", "Source diagnostics");
    const rows = Array.isArray(diagnostics.data) ? diagnostics.data : [];
    add("Source diagnostics", rows.length === 5 ? "pass" : "fail",
      rows.length + "/5 source API diagnostics returned");

    for (const item of rows) {
      const name = item.name || item.id || item.providerId || "Provider";
      const technicalState = item.operationalState === "ACTIVE" ? "pass" :
        item.operationalState === "ERROR" ? "fail" : "warn";
      const http = item.httpStatus === null || item.httpStatus === undefined ? "no HTTP response" : "HTTP " + item.httpStatus;
      const latency = Number.isFinite(Number(item.latencyMs)) ? Number(item.latencyMs) + " ms" : "latency n/a";
      const count = Number.isFinite(Number(item.catalogCount)) ? Number(item.catalogCount) + " items" : "catalog n/a";
      add(name + " API health", technicalState,
        http + " · " + latency + " · " + count + " · " + (item.reason || item.operationalState || "unknown"));
      add(name + " playback rights", item.rightsApproved === true ? "pass" : "warn",
        (item.status || "UNKNOWN") + " · mode " + (item.playbackMode || "none") +
        " · playback " + (item.playbackEnabled === true ? "enabled" : "locked"));
    }

    const providerId = $("source-id").value;
    const videoId = $("vod-id").value.trim();
    if (videoId) {
      if (!/^[0-9]{1,20}$/.test(videoId)) {
        add("Video ID", "fail", "VOD ID phải là chuỗi số từ 1–20 ký tự");
      } else {
        await inspectApprovedVideo(providerId, videoId);
      }
    } else {
      add("HLS / MP4 / MIME / CORS / Range", "pending",
        "Chưa nhập VOD ID. Không có media request nào được gửi; không dùng URL demo.");
    }

    summary.textContent = "Hoàn tất trên " + navigator.userAgent + " · Origin " + location.origin +
      ". Nếu player đã sẵn sàng, nhấn Play để xác nhận phát thật trên Safari.";
  } catch (error) {
    add("Playback diagnostics", "fail", error.message || String(error));
    summary.textContent = "Có bước diagnostics chưa đạt. Gửi kết quả trên trang này để tiếp tục xử lý.";
  } finally {
    run.disabled = false;
    run.textContent = "CHẠY LẠI KIỂM TRA";
  }
}

run.addEventListener("click", runChecks);
$("clipform").addEventListener("load", () => {
  $("form-status").textContent = "Iframe phát sinh sự kiện load. Hãy kiểm tra form có hiển thị đầy đủ và thử gửi một đề xuất thử nghiệm.";
});
