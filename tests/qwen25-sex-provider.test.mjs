import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { getQwen25SexProviderStatus } = require("../lib/qwen25-sex-provider.js");

test("Qwen provider stays disabled by default", () => {
  const status = getQwen25SexProviderStatus({});
  assert.equal(status.enabled, false);
  assert.equal(status.generationEnabled, false);
});

test("Qwen provider requires explicit enablement, HTTPS endpoint, and API key", () => {
  const status = getQwen25SexProviderStatus({
    QWEN25_SEX_ENABLED: "true",
    QWEN25_SEX_API_URL: "http://inference.example.test/v1",
    QWEN25_SEX_API_KEY: "test-only",
  });
  assert.equal(status.configured, false);
});

test("Qwen provider reports configured without exposing its API key", () => {
  const status = getQwen25SexProviderStatus({
    QWEN25_SEX_ENABLED: "true",
    QWEN25_SEX_API_URL: "https://inference.example.test/v1",
    QWEN25_SEX_API_KEY: "test-only-secret",
  });
  assert.equal(status.configured, true);
  assert.equal(JSON.stringify(status).includes("test-only-secret"), false);
});
