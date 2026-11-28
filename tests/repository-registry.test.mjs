import test from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";

const registryUrl = new URL("../site/providers.json", import.meta.url);
const providers = JSON.parse(await readFile(registryUrl, "utf8"));
const expected = [
  "KaigeCai/live",
  "YYYIKES/porn-description-generator",
  "HertzAdvisor78/Uncensored-ai",
  "JustalK/PORNHUB-API",
  "rlleshi/phar",
  "LucasLeandro1204/pornsearch"
];

test("integration registry includes six reviewed GitHub repositories and one pending external provider", () => {
  assert.equal(providers.length, expected.length + 1);
  assert.deepEqual(providers.slice(0, expected.length).map((item) => item.name), expected);
  assert.equal(providers.at(-1).name, "AdultEmbed");
  assert.equal(providers.at(-1).status, "PENDING");
});

test("registry entries have unique IDs and safe GitHub links", () => {
  const ids = providers.map((item) => item.id);
  assert.equal(new Set(ids).size, ids.length);
  for (const item of providers) {
    assert.ok(item.id && item.name && item.kind && item.status && item.role && item.readiness);
    const url = new URL(item.url);
    assert.equal(url.protocol, "https:");
    if (item.id === "adultembed") {
      assert.equal(url.hostname, "adultembed.com");
      assert.equal(item.publicPlaybackEnabled, false);
    } else {
      assert.equal(url.hostname, "github.com");
    }
  }
});

test("external repositories are catalogued but not enabled as media feeds", () => {
  for (const item of providers) {
    assert.ok(!Object.hasOwn(item, "streamUrl"));
    assert.ok(!Object.hasOwn(item, "apiKey"));
  }
});
