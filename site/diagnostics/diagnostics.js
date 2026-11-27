const API = window.CLIPVIET_API_BASE || "https://clipviet-catalog-api-preview.huynhthuongg2505-f9b.workers.dev";
const PLAYBACK_API = "https://clipviet-playback-api-preview.huynhthuongg2505-f9b.workers.dev";
const $ = (id) => document.getElementById(id);
const results = $("results");
const summary = $("summary");
const run = $("run");
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

async function runChecks() {
  run.disabled = true;
  run.textContent = "ĐANG KIỂM TRA…";
  results.replaceChildren();
  checks.length = 0;

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

      const rightsApproved = item.rightsApproved === true;
      add(name + " playback rights", rightsApproved ? "pass" : "warn",
        (item.status || "UNKNOWN") + " · mode " + (item.playbackMode || "none") +
        " · playback " + (item.playbackEnabled === true ? "enabled" : "locked"));
    }

    const approved = rows.filter(item =>
      item.rightsApproved === true && item.status === "PLAYBACK_APPROVED" && item.playbackEnabled === true
    );
    if (!approved.length) {
      add("HLS / MP4 / MIME / CORS / Range", "pending",
        "Bỏ qua kiểm tra media: chưa có provider và video được duyệt quyền phát. Không dùng URL mẫu hoặc vượt rights gate.");
    } else {
      add("Media acceptance", "pending",
        "Có provider được duyệt (" + approved.map(item => item.name || item.id).join(", ") +
        "), nhưng cần ID video và URL media thuộc hồ sơ quyền đã duyệt trước khi probe HLS/MP4.");
    }

    summary.textContent = "Hoàn tất kiểm tra trên " + navigator.userAgent + " · Origin " + location.origin +
      ". Kết quả API không thay thế thử phát video thật trên Safari.";
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
