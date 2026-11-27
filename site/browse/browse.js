const $ = (id) => document.getElementById(id);
const API_BASE = "https://clipviet-catalog-metadata-preview.huynhthuongg2505-f9b.workers.dev";
const PAGE_SIZE = 30;
let providers = [];
let currentItems = [];
let currentPage = 1;
let pageCount = 1;
let totalCount = 0;
let selectedSource = "";
let categoryId = "";
let keyword = "";
let country = "";
let duration = "";
let quickCategory = new URLSearchParams(location.search).get("quick") || "";
const gate = $("age-gate");

try { if (sessionStorage.getItem("clipviet-age-confirmed") === "yes") gate.hidden = true; } catch {}
$("confirm").addEventListener("click", () => {
  try { sessionStorage.setItem("clipviet-age-confirmed", "yes"); } catch {}
  gate.hidden = true;
});
$("leave").addEventListener("click", () => location.replace("https://www.google.com/"));
$("year").textContent = new Date().getFullYear();

function status(message) { $("source-status").textContent = message; }
function option(label, value) {
  const node = document.createElement("option");
  node.textContent = label;
  node.value = String(value);
  return node;
}
async function api(path) {
  const response = await fetch(API_BASE + path, {
    headers: { Accept: "application/json" },
    cache: "no-store"
  });
  const body = await response.text();
  let payload;
  try { payload = JSON.parse(body); } catch { throw new Error("API trả dữ liệu không phải JSON (HTTP " + response.status + ")."); }
  if (!response.ok) throw new Error(payload.error || ("API HTTP " + response.status));
  return payload;
}
function providerLabel(id) {
  return providers.find((item) => item.id === id)?.name || id || "Nguồn tự động";
}
function populateCountryOptions() {
  const select = $("country");
  const previous = select.value;
  select.replaceChildren(option("Tất cả quốc gia", ""));
  const values = [...new Set(currentItems.map((item) => String(item.area || "").trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b, "vi"));
  for (const value of values) select.append(option(value, value));
  if (values.includes(previous)) select.value = previous;
}
function populateProviders() {
  const select = $("source");
  select.replaceChildren(option("Tự động · nguồn chính và dự phòng", ""));
  for (const provider of providers) {
    const node = option(provider.name + (provider.configured ? "" : " · chưa cấu hình"), provider.id);
    node.disabled = !provider.configured;
    select.append(node);
  }
}
async function populateCategories() {
  const select = $("category");
  const previous = select.value;
  select.replaceChildren(option("Tất cả danh mục", ""));
  const path = selectedSource
    ? "/api/providers/" + encodeURIComponent(selectedSource) + "/categories"
    : "/api/catalog/categories";
  const payload = await api(path);
  const categories = Array.isArray(payload.data) ? payload.data : [];
  for (const item of categories) select.append(option(item.name || "Khác", item.id));
  if ([...select.options].some((item) => item.value === previous)) select.value = previous;
}
function durationMinutes(value) {
  const text = String(value || "").toLocaleLowerCase("vi");
  const h = text.match(/(\d+(?:[.,]\d+)?)\s*(?:giờ|hours?|hrs?|h)\b/);
  const m = text.match(/(\d+(?:[.,]\d+)?)\s*(?:phút|minutes?|mins?|m)\b/);
  if (h || m) return (h ? Number(h[1].replace(",", ".")) * 60 : 0) + (m ? Number(m[1].replace(",", ".")) : 0);
  const clock = text.match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (clock) return Number(clock[1]) * 60 + Number(clock[2]);
  return null;
}
function matchesLocalFilters(item) {
  const haystack = [item.title, item.description, item.categoryName, item.actors, item.area, item.sourceName].filter(Boolean).join(" ").toLocaleLowerCase("vi");
  const quickMatchers = {
    jav: /\b(jav|japan|japanese|nhật|nhat)\b/i,
    china: /(trung quốc|china|chinese|cn)/i,
    europe: /(châu âu|europe|european|pháp|đức|anh|italy|spanish)/i,
    vietnam: /(việt nam|viet nam|vietnam|vietnamese)/i,
    vietsub: /(vietsub|viet sub|phụ đề việt|sub tiếng việt)/i,
    "south-asia": /(nam á|south asia|india|indian|pakistan|bangladesh|nepal|sri lanka)/i,
    actors: /.+/,
    genres: /.+/
  };
  if (quickCategory && quickMatchers[quickCategory] && !quickMatchers[quickCategory].test(haystack)) return false;
  if (quickCategory === "actors" && !item.actors) return false;
  if (quickCategory === "genres" && !item.categoryName) return false;
  if (country && String(item.area || "").toLocaleLowerCase("vi") !== country.toLocaleLowerCase("vi")) return false;
  if (duration) {
    const minutes = durationMinutes(item.duration || item.remarks);
    if (minutes === null) return false;
    if (duration === "0-5" && minutes >= 5) return false;
    if (duration === "5-10" && (minutes < 5 || minutes > 10)) return false;
    if (duration === "10-20" && (minutes <= 10 || minutes > 20)) return false;
    if (duration === "20-60" && (minutes <= 20 || minutes > 60)) return false;
    if (duration === "60+" && minutes <= 60) return false;
  }
  return true;
}
function renderTrending(items) {
  const root = $("trending-card");
  const picks = $("hot-recommendations");
  root.replaceChildren();
  picks.replaceChildren();
  const playable = items.filter((item) => Array.isArray(item.lines) && item.lines.some((line) => line.episodes?.length));
  if (!playable.length) {
    root.textContent = "Nguồn hiện chưa trả về video có đường phát HTTPS.";
    $("trending-index").textContent = "—";
    return;
  }
  const href = (item) => "../watch/source.html?sourceId=" + encodeURIComponent(item.sourceId) + "&vodId=" + encodeURIComponent(item.id);
  const item = playable[0];
  const hero = document.createElement("a");
  hero.className = "hot-stage";
  hero.href = href(item);
  const image = document.createElement("img");
  image.className = "hot-cover";
  image.src = item.poster || "../poster-fallback.svg";
  image.alt = "";
  image.loading = "eager";
  const content = document.createElement("div");
  content.className = "hot-stage-content";
  const kicker = document.createElement("span");
  kicker.className = "hot-kicker";
  kicker.textContent = "★ VIDEO HOT";
  const title = document.createElement("h3");
  title.textContent = item.title || "Video";
  const meta = document.createElement("p");
  meta.className = "hot-stage-meta";
  meta.textContent = [item.area, item.categoryName, item.duration, item.sourceName].filter(Boolean).join(" · ");
  const play = document.createElement("span");
  play.className = "hot-play";
  play.textContent = "▶  XEM NGAY";
  content.append(kicker, title, meta, play);
  hero.append(image, content);
  root.append(hero);
  for (const pick of playable.slice(1, 9)) {
    const card = document.createElement("a");
    card.className = "hot-pick";
    card.href = href(pick);
    const poster = document.createElement("img");
    poster.loading = "lazy";
    poster.src = pick.poster || "../poster-fallback.svg";
    poster.alt = "";
    const name = document.createElement("strong");
    name.textContent = pick.title || "Video";
    card.append(poster, name);
    picks.append(card);
  }
  $("trending-index").textContent = "1 / " + playable.length;
}
function render() {
  const root = $("cards");
  root.replaceChildren();
  const visible = currentItems.filter(matchesLocalFilters);
  for (const item of visible) {
    const link = document.createElement("a");
    link.className = "card";
    link.href = "../watch/source.html?sourceId=" + encodeURIComponent(item.sourceId) + "&vodId=" + encodeURIComponent(item.id);
    const image = document.createElement("img");
    image.loading = "lazy";
    image.decoding = "async";
    image.alt = item.title || "Video";
    image.src = item.poster || "../poster-fallback.svg";
    image.addEventListener("error", () => { image.src = "../poster-fallback.svg"; }, { once: true });
    const body = document.createElement("div");
    body.className = "card-body";
    const title = document.createElement("h2");
    title.textContent = item.title || "Video";
    const meta = document.createElement("p");
    meta.textContent = [item.year, item.area, item.categoryName, item.duration, item.sourceName].filter(Boolean).join(" · ");
    body.append(title, meta);
    link.append(image, body);
    root.append(link);
  }
  $("empty").hidden = visible.length > 0;
  $("count").textContent = totalCount.toLocaleString("vi-VN") + " VIDEO";
  $("page-label").textContent = "Trang " + currentPage + " / " + Math.max(pageCount, 1) + " · " + visible.length + " video trên trang";
  $("prev").disabled = currentPage <= 1;
  $("next").disabled = currentPage >= pageCount;
  $("prev").textContent = "← TRANG TRƯỚC";
  $("next").textContent = "TRANG SAU →";
  renderTrending(visible);
}
async function loadVideos() {
  const params = new URLSearchParams({ page: String(currentPage) });
  if (selectedSource) params.set("sourceId", selectedSource);
  if (categoryId) params.set("categoryId", categoryId);
  if (keyword) params.set("keyword", keyword);
  const path = selectedSource
    ? "/api/providers/" + encodeURIComponent(selectedSource) + "/videos?" + params.toString()
    : "/api/catalog/videos?" + params.toString();
  status("Đang tải dữ liệu trực tiếp từ AppleCMS Worker…");
  $("cards").replaceChildren();
  $("empty").hidden = true;
  try {
    const payload = await api(path);
    currentItems = Array.isArray(payload.items) ? payload.items : [];
    populateCountryOptions();
    totalCount = Math.max(0, Number(payload.total) || 0);
    pageCount = Math.max(1, Number(payload.pageCount) || Math.ceil(totalCount / Math.max(1, Number(payload.limit) || PAGE_SIZE)));
    currentPage = Math.max(1, Math.min(currentPage, pageCount));
    const sourceName = payload.provider?.name || (payload.failover ? "Nguồn dự phòng" : providerLabel(selectedSource));
    status("APPLECMS WORKER · " + sourceName + " · " + totalCount.toLocaleString("vi-VN") + " bản ghi · trang " + currentPage + "/" + pageCount + (payload.failover ? " · ĐÃ CHUYỂN SANG NGUỒN DỰ PHÒNG" : ""));
    $("count").dataset.total = String(totalCount);
    render();
  } catch (error) {
    currentItems = [];
    totalCount = 0;
    pageCount = 1;
    $("cards").replaceChildren();
    $("empty").textContent = "Không thể tải catalog từ nguồn AppleCMS. Đây là lỗi kết nối, không phải catalog có 0 video.";
    $("empty").hidden = false;
    $("count").textContent = "API ERROR";
    $("page-label").textContent = "API chưa khả dụng";
    $("prev").disabled = true;
    $("next").disabled = true;
    status("Không tải được catalog Worker: " + error.message);
  }
}
document.querySelectorAll(".category-chip").forEach((button) => {
  button.classList.toggle("is-active", button.dataset.category === quickCategory);
  button.setAttribute("aria-pressed", String(button.dataset.category === quickCategory));
  button.addEventListener("click", () => {
    quickCategory = button.dataset.category === quickCategory ? "" : button.dataset.category;
    document.querySelectorAll(".category-chip").forEach((chip) => {
      const active = chip.dataset.category === quickCategory;
      chip.classList.toggle("is-active", active);
      chip.setAttribute("aria-pressed", String(active));
    });
    currentPage = 1;
    render();
  });
});
$("filters").addEventListener("submit", async (event) => {
  event.preventDefault();
  selectedSource = $("source").value;
  categoryId = $("category").value;
  keyword = $("keyword").value.trim().slice(0, 100);
  country = $("country").value;
  duration = $("duration").value;
  currentPage = 1;
  try { await populateCategories(); } catch (error) { status("Không tải được danh mục: " + error.message); }
  await loadVideos();
});
$("source").addEventListener("change", async () => {
  selectedSource = $("source").value;
  categoryId = "";
  $("category").value = "";
  currentPage = 1;
  try { await populateCategories(); } catch (error) { status("Không tải được danh mục: " + error.message); }
  await loadVideos();
});
$("category").addEventListener("change", () => { categoryId = $("category").value; currentPage = 1; loadVideos(); });
$("country").addEventListener("change", () => { country = $("country").value; render(); });
$("duration").addEventListener("change", () => { duration = $("duration").value; render(); });
$("prev").addEventListener("click", () => { if (currentPage > 1) { currentPage -= 1; loadVideos(); window.scrollTo({ top: 0, behavior: "smooth" }); } });
$("next").addEventListener("click", () => { if (currentPage < pageCount) { currentPage += 1; loadVideos(); window.scrollTo({ top: 0, behavior: "smooth" }); } });

(async () => {
  try {
    const payload = await api("/api/providers");
    providers = Array.isArray(payload.data) ? payload.data : [];
    populateProviders();
    await populateCategories();
    await loadVideos();
  } catch (error) {
    status("Không kết nối được AppleCMS Worker: " + error.message);
    $("empty").textContent = "Không thể tải catalog từ nguồn AppleCMS. Đây là lỗi kết nối, không phải catalog có 0 video.";
    $("count").textContent = "API ERROR";
    $("empty").hidden = false;
  }
})();
