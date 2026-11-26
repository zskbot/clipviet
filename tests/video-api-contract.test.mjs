import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const route = await readFile(new URL("../app/api/videos/route.js", import.meta.url), "utf8");

test("video API preserves legacy parameter aliases and response aliases", () => {
  for (const token of ['["keyword", "q"]', '["search", "q"]', '["pageSize", "limit"]', '["per_page", "limit"]', '["currentPage", "page"]', "results:", "items:"]) {
    assert.ok(route.includes(token), `Missing API compatibility token: ${token}`);
  }
});

test("query-dependent API route is always dynamic and never cached", () => {
  assert.match(route, /export const dynamic = "force-dynamic"/);
  assert.match(route, /export const revalidate = 0/);
  assert.match(route, /"Cache-Control": "no-store"/);
  assert.doesNotMatch(route, /s-maxage=/);
});

test("invalid search parameters are validated before provider feed access", () => {
  assert.ok(route.indexOf("searchVideos([], params)") < route.indexOf("getVideoFeed()"));
  assert.match(route, /status:\s*400/);
});

test("video API exposes HEAD and OPTIONS and explicit 404/400/405 handling", () => {
  assert.match(route, /export async function HEAD\(/);
  assert.match(route, /export async function OPTIONS\(/);
  assert.match(route, /export async function POST\(/);
  assert.match(route, /status:\s*404/);
  assert.match(route, /status:\s*400/);
  assert.match(route, /status:\s*405/);
});
