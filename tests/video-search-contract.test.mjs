import test from "node:test";
import assert from "node:assert/strict";
import { searchVideos } from "../lib/video-search.mjs";

const videos = [
  { id: "a", title: "Hành trình Việt Nam", description: "du lịch", category: "Du lịch" },
  { id: "b", title: "Ẩm thực miền Tây", description: "món ngon", category: "Ẩm thực" },
  { id: "c", title: "Việt Nam về đêm", description: "thành phố", category: "Du lịch" }
];

test("search supports canonical query, category and pagination", () => {
  const page = searchVideos(videos, new URLSearchParams("q=vi%E1%BB%87t&page=1&limit=1"));
  assert.equal(page.total, 2);
  assert.equal(page.results.length, 1);
  assert.equal(page.page, 1);
  assert.equal(page.limit, 1);
  assert.equal(page.hasMore, true);
});

test("legacy categoryId remains supported as a category slug", () => {
  const page = searchVideos(videos, new URLSearchParams("categoryId=du-lich"));
  assert.deepEqual(page.results.map(item => item.id), ["a", "c"]);
});

test("invalid page and limit are rejected", () => {
  assert.throws(() => searchVideos(videos, new URLSearchParams("page=0")), /positive integer/);
  assert.throws(() => searchVideos(videos, new URLSearchParams("limit=101")), /between 1 and 100/);
});
