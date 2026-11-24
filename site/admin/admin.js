const $ = (selector) => document.querySelector(selector);
const apiForm = $("#api-form");
const apiUrl = $("#api-url");
const apiToken = $("#api-token");
const apiStatus = $("#api-status");
const list = $("#video-list");
const count = $("#video-count");
const player = $("#player");
const playerTitle = $("#player-title");
const playerState = $("#player-state");
const playerMessage = $("#player-message");
let apiTokenValue = "";
let savedUrl = "";
try { savedUrl = localStorage.getItem("clipviet.admin.apiUrl") || ""; } catch { /* storage may be unavailable */ }
apiUrl.value = savedUrl;

function safeHttpsUrl(value) {
  let url;
  try { url = new URL(value); } catch { throw new Error("URL không hợp lệ."); }
  if (url.protocol !== "https:") throw new Error("Chỉ chấp nhận URL HTTPS.");
  if (url.username || url.password) throw new Error("Không nhúng thông tin đăng nhập trong URL.");
  const host = url.hostname.toLowerCase();
  if (host === "localhost" || host.endsWith(".localhost") || host === "::1" ||
      /^(127\.|10\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host) ||
      host === "0.0.0.0" || host.endsWith(".local")) {
    throw new Error("Không cho phép địa chỉ localhost hoặc mạng nội bộ.");
  }
  return url.href;
}

function normalizeVideos(payload) {
  let rows = Array.isArray(payload) ? payload :
    payload && Array.isArray(payload.results) ? payload.results :
    payload && Array.isArray(payload.videos) ? payload.videos :
    payload && Array.isArray(payload.data) ? payload.data : null;
  if (!rows) throw new Error("API phải trả về JSON array hoặc object có results, videos hay data dạng array.");
  return rows.map((item, index) => ({
    id: String(item.id ?? item.video_id ?? item.slug ?? index + 1),
    title: String(item.title ?? item.name ?? "Video " + (index + 1)),
    poster: item.poster ?? item.thumbnail_url ?? item.thumbnail ?? "",
    media: item.videoUrl ?? item.video_url ?? item.url ?? item.src ?? "",
    category: item.category ?? item.genre ?? "Chưa phân loại",
    description: item.description ?? ""
  }));
}

function textElement(tag, value, className) {
  const node = document.createElement(tag);
  node.textContent = value;
  if (className) node.className = className;
  return node;
}

function playMedia(rawUrl, title) {
  let mediaUrl;
  try { mediaUrl = safeHttpsUrl(rawUrl); }
  catch (error) { playerMessage.textContent = error.message; playerState.textContent = "INVALID URL"; return; }
  player.pause();
  player.removeAttribute("src");
  player.load();
  player.src = mediaUrl;
  playerTitle.textContent = title || "Video URL";
  playerState.textContent = "READY";
  playerMessage.textContent = "Đang tải metadata video. Nếu không phát được, kiểm tra định dạng, CORS và quyền truy cập media.";
  player.load();
  player.play().then(() => { playerState.textContent = "PLAYING"; }).catch(() => { playerState.textContent = "READY"; });
}

function renderVideos(videos) {
  list.replaceChildren();
  count.textContent = videos.length + " VIDEO";
  if (!videos.length) {
    list.append(textElement("p", "API kết nối thành công nhưng chưa có video.", "empty"));
    return;
  }
  for (const video of videos) {
    const row = document.createElement("article");
    row.className = "video-row";
    if (video.poster) {
      try {
        const posterUrl = safeHttpsUrl(video.poster);
        const img = document.createElement("img");
        img.src = posterUrl; img.alt = ""; img.loading = "lazy";
        row.append(img);
      } catch { row.append(textElement("div", "CV", "poster-fallback")); }
    } else row.append(textElement("div", "CV", "poster-fallback"));
    const meta = document.createElement("div");
    meta.className = "video-meta";
    meta.append(textElement("h3", video.title), textElement("p", video.category));
    const action = document.createElement("button");
    action.type = "button"; action.className = "secondary"; action.textContent = "PHÁT THỬ";
    action.disabled = !video.media;
    action.addEventListener("click", () => playMedia(video.media, video.title));
    meta.append(action);
    row.append(meta);
    if (!video.media) row.append(textElement("span", "THIẾU MEDIA URL", "missing"));
    list.append(row);
  }
}

apiForm.addEventListener("submit", async (event) => {
  event.preventDefault();
  let endpoint;
  try { endpoint = safeHttpsUrl(apiUrl.value.trim()); }
  catch (error) { apiStatus.textContent = error.message; apiStatus.dataset.state = "error"; return; }
  apiStatus.textContent = "Đang kết nối…";
  apiStatus.dataset.state = "loading";
  const token = apiToken.value.trim();
  localStorage.setItem("clipviet.admin.apiUrl", endpoint);
  apiTokenValue = token;
  try {
    const headers = { Accept: "application/json" };
    if (apiTokenValue) headers.Authorization = "Bearer " + apiTokenValue;
    const response = await fetch(endpoint, { headers, credentials: "omit", redirect: "error", signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw new Error("API trả về HTTP " + response.status + ".");
    const type = response.headers.get("content-type") || "";
    if (!type.includes("json")) throw new Error("Endpoint không trả về JSON.");
    const videos = normalizeVideos(await response.json());
    renderVideos(videos);
    apiStatus.textContent = "Kết nối thành công · " + videos.length + " video.";
    apiStatus.dataset.state = "success";
  } catch (error) {
    apiStatus.textContent = error.name === "TimeoutError" ? "API quá thời gian chờ 15 giây." : "Không thể tải API: " + error.message + " Kiểm tra CORS, HTTPS và cấu trúc JSON.";
    apiStatus.dataset.state = "error";
    list.replaceChildren(textElement("p", "Chưa tải được danh sách video.", "empty"));
    count.textContent = "0 VIDEO";
  }
});

$("#clear-api").addEventListener("click", () => {
  localStorage.removeItem("clipviet.admin.apiUrl");
  sessionStorage.removeItem("clipviet.admin.apiToken");
  apiUrl.value = ""; apiToken.value = "";
  apiStatus.textContent = "Đã xóa cấu hình trên thiết bị này.";
  apiStatus.dataset.state = "";
  list.replaceChildren(textElement("p", "Kết nối API JSON để tải danh sách video.", "empty"));
  count.textContent = "0 VIDEO";
});

$("#direct-form").addEventListener("submit", (event) => {
  event.preventDefault();
  playMedia($("#direct-url").value.trim(), "Phát trực tiếp bằng URL");
});

player.addEventListener("playing", () => { playerState.textContent = "PLAYING"; });
player.addEventListener("pause", () => { if (!player.ended && player.currentTime > 0) playerState.textContent = "PAUSED"; });
player.addEventListener("error", () => {
  playerState.textContent = "ERROR";
  playerMessage.textContent = "Trình duyệt không phát được URL này. Kiểm tra định dạng MP4/WebM/HLS, MIME type, CORS và quyền truy cập.";
});
