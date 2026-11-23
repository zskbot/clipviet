import { categories, videos } from "./data.js";

const grid = document.querySelector("#video-grid");
const count = document.querySelector("#result-count");
const empty = document.querySelector("#empty-state");
const search = document.querySelector("#search");
const dialog = document.querySelector("#detail-dialog");
const detail = document.querySelector("#detail-content");
const ageDialog = document.querySelector("#age-dialog");
const categoryRoot = document.querySelector("#categories");

let activeCategory = "Tất cả";
let query = new URLSearchParams(location.search).get("q") || "";

search.value = query;
document.querySelector("#year").textContent = new Date().getFullYear();

categories.forEach((category) => {
  const button = document.createElement("button");
  button.className = "category-button";
  button.type = "button";
  button.textContent = category;
  button.setAttribute("aria-pressed", String(category === activeCategory));
  button.addEventListener("click", () => {
    activeCategory = category;
    categoryRoot.querySelectorAll("button").forEach((item) => {
      item.setAttribute("aria-pressed", String(item.textContent === category));
    });
    render();
  });
  categoryRoot.append(button);
});

function render() {
  const sort = document.querySelector("#sort").value;
  const term = query.trim().toLocaleLowerCase("vi");
  const items = videos.filter((video) =>
    (activeCategory === "Tất cả" || video.category === activeCategory) &&
    [video.title, video.category, video.description]
      .join(" ")
      .toLocaleLowerCase("vi")
      .includes(term)
  );

  if (sort === "title") {
    items.sort((a, b) => a.title.localeCompare(b.title, "vi"));
  } else {
    items.sort((a, b) => b.year - a.year);
  }

  grid.replaceChildren();
  count.textContent = items.length + " VIDEO";
  empty.hidden = items.length !== 0;

  items.forEach((video) => {
    const card = document.createElement("button");
    card.className = "video-card";
    card.type = "button";
    card.innerHTML = '<div class="poster"><img loading="lazy" alt=""><span class="poster-label"></span></div><div class="card-info"><h3></h3><p></p></div>';
    card.querySelector("img").src = video.poster;
    card.querySelector("img").alt = video.title;
    card.querySelector(".poster-label").textContent = video.rating;
    card.querySelector("h3").textContent = video.title;
    card.querySelector(".card-info p").textContent = video.year + " · " + video.category;
    card.addEventListener("click", () => openDetail(video));
    grid.append(card);
  });
}

function openDetail(video) {
  detail.innerHTML = '<div class="detail-inner"><img alt=""><div><p class="eyebrow"></p><h2></h2><p class="description"></p><p class="meta"></p><p>Đây là dữ liệu thư viện demo tĩnh. Chưa có nguồn phát video được cấu hình.</p></div></div>';
  detail.querySelector("img").src = video.poster;
  detail.querySelector("img").alt = video.title;
  detail.querySelector(".eyebrow").textContent = video.category.toUpperCase();
  detail.querySelector("h2").textContent = video.title;
  detail.querySelector(".description").textContent = video.description;
  detail.querySelector(".meta").textContent = video.year + " · " + video.duration + " · " + video.rating;
  dialog.showModal();
}

document.querySelector("#close-detail").addEventListener("click", () => dialog.close());
dialog.addEventListener("click", (event) => {
  if (event.target === dialog) dialog.close();
});
document.querySelector("#search-form").addEventListener("submit", (event) => {
  event.preventDefault();
  query = search.value;
  const url = new URL(location.href);
  if (query) url.searchParams.set("q", query);
  else url.searchParams.delete("q");
  history.replaceState({}, "", url);
  render();
});
search.addEventListener("input", () => {
  query = search.value;
  render();
});
document.querySelector("#sort").addEventListener("change", render);

// A blocked storage API must not prevent the catalog from rendering or the gate from closing.
function hasAgeConfirmation() {
  try {
    return sessionStorage.getItem("clipviet-age-confirmed") === "yes";
  } catch {
    return false;
  }
}

if (!hasAgeConfirmation()) ageDialog.showModal();

ageDialog.addEventListener("cancel", (event) => {
  // Keep Escape from dismissing the age gate without an explicit choice.
  event.preventDefault();
});

document.querySelector("#confirm-age").addEventListener("click", () => {
  try {
    sessionStorage.setItem("clipviet-age-confirmed", "yes");
  } catch {
    // Continue for this page view when browser storage is unavailable.
  }
  ageDialog.close();
});
document.querySelector("#leave-button").addEventListener("click", () => {
  location.href = "https://www.google.com/";
});

render();
