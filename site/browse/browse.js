const $ = (id) => document.getElementById(id);
const PREVIEW_API_BASE = "https://clipviet-catalog-api-preview.huynhthuongg2505-f9b.workers.dev";
const API_BASE = window.CLIPVIET_API_BASE || (location.hostname.endsWith(".clipviet-live-preview.pages.dev") ? PREVIEW_API_BASE : "");
const CATALOG_URL = "../data/catalog.json";
let catalog = { videos: [], categories: [], providers: [] };
let page = 1;
let pageCount = 1;
let activeProvider = "";
let categorySourceId = "";
let categoryId = "";
let keyword = "";
let items = [];
const PAGE_SIZE = 20;

const gate = $("age-gate");
try { if (sessionStorage.getItem("clipviet-age-confirmed") === "yes") gate.hidden = true; } catch {}
$("confirm").addEventListener("click", () => { try { sessionStorage.setItem("clipviet-age-confirmed", "yes"); } catch {} gate.hidden = true; });
$("leave").addEventListener("click", () => location.replace("https://www.google.com/"));
$("year").textContent = new Date().getFullYear();

function status(message) { $("source-status").textContent = message; }
function option(label, value) { const node = document.createElement("option"); node.textContent = label; node.value = String(value); return node; }

function populateCategories() {
  const select = $("category");
  const current = select.value;
  select.replaceChildren(option("Tất cả danh mục", ""));
  catalog.categories
    .filter((item) => !categorySourceId || item.sourceId === categorySourceId)
    .forEach((item) => select.append(option(item.name, item.sourceId + ":" + item.id)));
  if ([...select.options].some((item) => item.value === current)) select.value = current;
}

function providerRows() {
  return catalog.providers.map((provider) => provider.name + ": " + provider.state + " (" + provider.count + " video)").join(" · ");
}

function render() {
  const root = $("cards");
  root.replaceChildren();
  for (const item of items) {
    const link = document.createElement("a");
    link.className = "card";
    link.href = "../watch/source.html?sourceId=" + encodeURIComponent(item.sourceId) + "&vodId=" + encodeURIComponent(item.id);
    const image = document.createElement("img");
    image.loading = "lazy";
    image.decoding = "async";
    image.alt = item.title || "";
    image.src = item.poster || "../poster-fallback.svg";
    image.addEventListener("error", () => { image.src = "../poster-fallback.svg"; }, { once: true });
    const body = document.createElement("div");
    body.className = "card-body";
    const title = document.createElement("h2");
    title.textContent = item.title || "Video";
    const meta = document.createElement("p");
    meta.textContent = [item.year, item.area, item.categoryName, item.sourceName].filter(Boolean).join(" · ");
    body.append(title, meta);
    link.append(image, body);
    root.append(link);
  }
  $("empty").hidden = items.length > 0;
  $("count").textContent = Number($("count").dataset.total || 0).toLocaleString("vi-VN") + " VIDEO";
  $("page-label").textContent = "Trang " + page + " / " + Math.max(pageCount, 1);
  $("prev").disabled = page <= 1;
  $("next").disabled = page >= pageCount;
}

async function loadApiCategories(sourceId = "") {
  const url = new URL(API_BASE + "/api/catalog/categories");
  if (sourceId) url.searchParams.set("sourceId", sourceId);
  const response = await fetch(url, { cache: "no-store", headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error("Categories API HTTP " + response.status);
  const result = await response.json();
  if (!Array.isArray(result.data)) throw new Error("Categories API response không hợp lệ");
  categorySourceId = result.sourceId || sourceId;
  catalog.categories = result.data.map((item) => ({
    id: String(item.id), name: item.name, sourceId: categorySourceId,
    sourceName: catalog.providers.find((provider) => provider.id === categorySourceId)?.name || categorySourceId
  }));
  populateCategories();
}

async function loadApiVideos() {
  const url = new URL(API_BASE + "/api/catalog/videos");
  url.searchParams.set("page", String(page));
  const selectedSource = $("source").value;
  const sourceId = selectedSource || (categoryId ? categorySourceId : "");
  if (sourceId) url.searchParams.set("sourceId", sourceId);
  if (categoryId) url.searchParams.set("categoryId", categoryId);
  if (keyword) url.searchParams.set("keyword", keyword);
  status("Đang truy vấn Cloudflare Preview API…");
  const response = await fetch(url, { cache: "no-store", headers: { Accept: "application/json" } });
  const result = await response.json();
  if (!response.ok) throw new Error(result.error || "Videos API HTTP " + response.status);
  if (!Array.isArray(result.items)) throw new Error("Videos API response không hợp lệ");
  items = result.items;
  page = Number(result.page) || page;
  pageCount = Math.max(1, Number(result.pageCount) || 1);
  $("count").dataset.total = String(Number(result.total) || 0);
  activeProvider = result.provider?.id || activeProvider;
  render();
  status("Cloudflare Preview API · " + (result.provider?.name || activeProvider) + " · " + items.length + " mục · " + (result.failover ? "đã chuyển nguồn dự phòng" : "kết nối trực tiếp"));
}

function loadStaticVideos() {
  const filtered = catalog.videos.filter((item) =>
    (!activeProvider || item.sourceId === activeProvider) &&
    (!categoryId || String(item.categoryId) === categoryId) &&
    (!keyword || [item.title, item.description, item.categoryName, item.actors, item.area].join(" ").toLocaleLowerCase("vi").includes(keyword.toLocaleLowerCase("vi")))
  );
  const total = filtered.length;
  pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));
  page = Math.min(page, pageCount);
  items = filtered.slice((page - 1) * PAGE_SIZE, page * PAGE_SIZE);
  $("count").dataset.total = String(total);
  render();
  status("Catalog tĩnh GitHub Pages · " + providerRows() + " · Cập nhật " + new Date(catalog.updatedAt).toLocaleString("vi-VN"));
}

async function loadVideos() {
  if (API_BASE) {
    try { await loadApiVideos(); return; }
    catch (error) { status("Preview API lỗi: " + error.message); }
  }
  loadStaticVideos();
}

$("filters").addEventListener("submit", async (event) => {
  event.preventDefault();
  page = 1;
  const selected = $("category").value;
  if (selected) {
    const [source, ...parts] = selected.split(":");
    categorySourceId = source;
    categoryId = parts.join(":");
  } else categoryId = "";
  keyword = $("keyword").value.trim();
  await loadVideos();
});

$("source").addEventListener("change", async () => {
  activeProvider = $("source").value;
  categoryId = "";
  $("category").value = "";
  page = 1;
  if (API_BASE) {
    try { await loadApiCategories(activeProvider); }
    catch (error) { status("Không tải được danh mục: " + error.message); return; }
  } else {
    categorySourceId = activeProvider;
    populateCategories();
  }
  await loadVideos();
});

$("category").addEventListener("change", async () => {
  const selected = $("category").value;
  if (selected) {
    const [source, ...parts] = selected.split(":");
    categorySourceId = source;
    categoryId = parts.join(":");
  } else categoryId = "";
  page = 1;
  await loadVideos();
});

$("prev").addEventListener("click", async () => { if (page > 1) { page -= 1; await loadVideos(); } });
$("next").addEventListener("click", async () => { if (page < pageCount) { page += 1; await loadVideos(); } });

(async () => {
  try {
    const response = await fetch(CATALOG_URL, { cache: "no-store", headers: { Accept: "application/json" } });
    if (response.ok) {
      catalog = await response.json();
      if (!Array.isArray(catalog.videos) || !Array.isArray(catalog.providers)) throw new Error("Catalog format is invalid");
    }
  } catch { catalog = { videos: [], categories: [], providers: [] }; }

  if (API_BASE) {
    try {
      const response = await fetch(API_BASE + "/api/providers", { cache: "no-store", headers: { Accept: "application/json" } });
      if (!response.ok) throw new Error("Providers API HTTP " + response.status);
      const result = await response.json();
      catalog.providers = result.data || [];
      const source = $("source");
      const selected = source.value;
      source.replaceChildren(option("Tự động · nguồn chính và dự phòng", ""));
      catalog.providers.filter((provider) => provider.configured).forEach((provider) => source.append(option(provider.name, provider.id)));
      if ([...source.options].some((item) => item.value === selected)) source.value = selected;
      await loadApiCategories(source.value);
      await loadVideos();
      return;
    } catch (error) { status("Không kết nối được Preview API: " + error.message); }
  }

  categorySourceId = $("source").value;
  populateCategories();
  if (catalog.videos.length) {
    $("count").dataset.total = String(catalog.videos.length);
    await loadVideos();
  } else {
    status("API Preview chưa sẵn sàng và chưa có catalog tĩnh.");
    $("empty").hidden = false;
  }
})();
