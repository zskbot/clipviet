import { categories, videos as demoVideos } from "./data.js";

let videos = demoVideos;
const API_BASE = window.CLIPVIET_API_BASE || "https://api.clipviet.live/api/v1";

const grid = document.querySelector("#video-grid");
const count = document.querySelector("#result-count");
const empty = document.querySelector("#empty-state");
const search = document.querySelector("#search");
const dialog = document.querySelector("#detail-dialog");
const detail = document.querySelector("#detail-content");
const ageDialog = document.querySelector("#age-dialog");
const categoryRoot = document.querySelector("#categories");
const countryRoot = document.querySelector("#country-filters");
const genreRoot = document.querySelector("#genre-filters");
const activeFiltersRoot = document.querySelector("#active-filters");
const menu = document.querySelector("#filter-menu");
const menuToggle = document.querySelector("#menu-toggle");

const countries = ["Việt Nam", "Hàn Quốc", "Trung Quốc", "Thái Lan", "Nhật Bản"];
const genres = ["JAV", "VLXX", "Loạn luân (hư cấu, 18+)", "18+ đã xác minh độ tuổi"];
let activeCategory = "Tất cả";
let activeCountry = "";
let activeGenre = "";
let query = new URLSearchParams(location.search).get("q") || "";

search.value = query;
document.querySelector("#year").textContent = new Date().getFullYear();

function makeFilterButton(label, root, getter, setter) {
  const button = document.createElement("button");
  button.className = "drawer-option";
  button.type = "button";
  button.textContent = label;
  button.setAttribute("aria-pressed", String(getter() === label));
  button.addEventListener("click", () => {
    setter(getter() === label ? "" : label);
    root.querySelectorAll("button").forEach((item) => {
      item.setAttribute("aria-pressed", String(item.textContent === getter()));
    });
    render();
  });
  root.append(button);
}

countries.forEach((country) => makeFilterButton(country, countryRoot, () => activeCountry, (value) => { activeCountry = value; }));
genres.forEach((genre) => makeFilterButton(genre, genreRoot, () => activeGenre, (value) => { activeGenre = value; }));

categories.forEach((category) => {
  const button = document.createElement("button");
  button.className = "category-button";
  button.type = "button";
  button.textContent = category;
  button.setAttribute("aria-pressed", String(category === activeCategory));
  button.addEventListener("click", () => {
    activeCategory = category;
    categoryRoot.querySelectorAll("button").forEach((item) => item.setAttribute("aria-pressed", String(item.textContent === category)));
    render();
  });
  categoryRoot.append(button);
});

function matchesGenre(video, genre) {
  if (!genre) return true;
  const metadata = [video.genre, video.category, ...(video.genres || []), ...(video.tags || [])]
    .filter(Boolean).join(" ").toLocaleLowerCase("vi");
  if (genre === "18+ đã xác minh độ tuổi") return video.ageVerified === true && video.rating === "18+";
  return metadata.includes(genre.toLocaleLowerCase("vi"));
}

function renderActiveFilters() {
  activeFiltersRoot.replaceChildren();
  const selected = [activeCountry, activeGenre].filter(Boolean);
  if (!selected.length) {
    activeFiltersRoot.hidden = true;
    return;
  }
  activeFiltersRoot.hidden = false;
  selected.forEach((label) => {
    const chip = document.createElement("span");
    chip.className = "active-filter-chip";
    chip.textContent = label;
    activeFiltersRoot.append(chip);
  });
}

function render() {
  const sort = document.querySelector("#sort").value;
  const term = query.trim().toLocaleLowerCase("vi");
  const items = videos.filter((video) => {
    const country = video.country || video.originCountry || "";
    const text = [video.title, video.category, video.genre, video.description, ...(video.tags || [])]
      .filter(Boolean).join(" ").toLocaleLowerCase("vi");
    return (activeCategory === "Tất cả" || video.category === activeCategory) &&
      (!activeCountry || country === activeCountry) &&
      matchesGenre(video, activeGenre) &&
      text.includes(term);
  });

  if (sort === "title") items.sort((a, b) => a.title.localeCompare(b.title, "vi"));
  else items.sort((a, b) => b.year - a.year);

  grid.replaceChildren();
  count.textContent = items.length + " VIDEO";
  empty.hidden = items.length !== 0;
  renderActiveFilters();

  items.forEach((video) => {
    const card = document.createElement("button");
    card.className = "video-card";
    card.type = "button";
    card.innerHTML = '<div class="poster"><img loading="lazy" alt=""><span class="poster-label"></span></div><div class="card-info"><h3></h3><p></p></div>';
    card.querySelector("img").src = video.poster;
    card.querySelector("img").decoding = "async";
    card.querySelector("img").addEventListener("error", (event) => { event.currentTarget.src = new URL("./poster-fallback.svg", import.meta.url).href; card.querySelector(".poster").classList.add("poster-unavailable"); }, { once: true });
    card.querySelector("img").alt = video.title;
    card.querySelector(".poster-label").textContent = video.rating;
    card.querySelector("h3").textContent = video.title;
    card.querySelector(".card-info p").textContent = [video.year, video.country || video.originCountry, video.category].filter(Boolean).join(" · ");
    card.addEventListener("click", () => openDetail(video));
    grid.append(card);
  });
}

function openDetail(video) {
  detail.innerHTML = '<div class="detail-inner"><img alt=""><div><p class="eyebrow"></p><h2></h2><p class="description"></p><p class="meta"></p><p class="detail-source"></p><a class="primary-link watch-link" hidden>PHÁT VIDEO <span>↗</span></a></div></div>';
  detail.querySelector("img").src = video.poster;
  detail.querySelector("img").addEventListener("error", (event) => { event.currentTarget.src = new URL("./poster-fallback.svg", import.meta.url).href; }, { once: true });
  detail.querySelector("img").alt = video.title;
  detail.querySelector(".eyebrow").textContent = video.category.toUpperCase();
  detail.querySelector("h2").textContent = video.title;
  detail.querySelector(".description").textContent = video.description;
  detail.querySelector(".meta").textContent = [video.year, video.duration, video.rating, video.country || video.originCountry].filter(Boolean).join(" · ");
  detail.querySelector(".detail-source").textContent = video.apiManaged ? "Nguồn phát đã đăng ký trong ClipViet API." : "Bản ghi demo, chưa có nguồn phát.";
  if (video.apiManaged) { const link = detail.querySelector(".watch-link"); link.hidden = false; link.href = "./watch/?id=" + encodeURIComponent(video.id); }
  dialog.showModal();
}

function closeMenu({ returnFocus = false } = {}) {
  menu.hidden = true;
  menuToggle.setAttribute("aria-expanded", "false");
  menuToggle.setAttribute("aria-label", "Mở menu điều hướng");
  if (returnFocus) menuToggle.focus();
}
menuToggle.addEventListener("click", () => {
  const opening = menu.hidden;
  menu.hidden = !opening;
  menuToggle.setAttribute("aria-expanded", String(opening));
  menuToggle.setAttribute("aria-label", opening ? "Đóng menu điều hướng" : "Mở menu điều hướng");
  if (opening) menu.querySelector(".drawer-nav a")?.focus();
});
document.querySelector("#menu-close").addEventListener("click", () => closeMenu({ returnFocus: true }));
menu.querySelectorAll(".drawer-nav a").forEach((link) => link.addEventListener("click", () => closeMenu()));
document.addEventListener("pointerdown", (event) => {
  if (menu.hidden || menu.contains(event.target) || menuToggle.contains(event.target)) return;
  closeMenu();
});
document.addEventListener("keydown", (event) => {
  if (event.key === "Escape" && !menu.hidden) closeMenu({ returnFocus: true });
});
document.querySelector("#reset-filters").addEventListener("click", () => {
  activeCountry = "";
  activeGenre = "";
  countryRoot.querySelectorAll("button").forEach((button) => button.setAttribute("aria-pressed", "false"));
  genreRoot.querySelectorAll("button").forEach((button) => button.setAttribute("aria-pressed", "false"));
  render();
});
document.querySelector("#close-detail").addEventListener("click", () => dialog.close());
dialog.addEventListener("click", (event) => { if (event.target === dialog) dialog.close(); });
document.querySelector("#search-form").addEventListener("submit", (event) => {
  event.preventDefault();
  query = search.value;
  const url = new URL(location.href);
  if (query) url.searchParams.set("q", query);
  else url.searchParams.delete("q");
  history.replaceState({}, "", url);
  render();
});
search.addEventListener("input", () => { query = search.value; render(); });
document.querySelector("#sort").addEventListener("change", render);

function hasAgeConfirmation() {
  try { return sessionStorage.getItem("clipviet-age-confirmed") === "yes"; }
  catch { return false; }
}
if (!hasAgeConfirmation()) ageDialog.showModal();
ageDialog.addEventListener("cancel", (event) => event.preventDefault());
document.querySelector("#confirm-age").addEventListener("click", () => {
  try { sessionStorage.setItem("clipviet-age-confirmed", "yes"); } catch {}
  ageDialog.close();
});
document.querySelector("#leave-button").addEventListener("click", () => { location.href = "https://www.google.com/"; });

render();

async function loadPublishedCatalog() {
  try {
    const response = await fetch(API_BASE + "/videos", { headers: { Accept: "application/json" }, credentials: "include", redirect: "error", cache: "no-store" });
    if (!response.ok) throw new Error("HTTP " + response.status);
    const payload = await response.json();
    if (!Array.isArray(payload.data)) throw new Error("Invalid catalog");
    const live = payload.data.map((item) => ({
      id: item.id, title: item.title, category: item.genre || "Khác", genre: item.genre || "",
      year: item.created_at ? new Date(item.created_at).getFullYear() : new Date().getFullYear(),
      duration: item.duration || "", rating: "ĐÃ KIỂM DUYỆT", description: item.description || "",
      poster: item.poster_url || "./poster-fallback.svg", country: item.country || "", apiManaged: true
    }));
    if (live.length) {
      videos = live;
      render();
      const note = document.querySelector(".data-note");
      if (note) note.textContent = "LIVE API CATALOG · " + live.length + " VIDEO";
    }
  } catch {
    const note = document.querySelector(".data-note");
    if (note) note.textContent = "API CHƯA KẾT NỐI · ĐANG HIỂN THỊ BẢN GHI DEMO, KHÔNG CÓ STREAM";
  }
}
loadPublishedCatalog();
