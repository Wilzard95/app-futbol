import { strict as assert } from "node:assert";
import { test } from "node:test";
import { appBaseUrl } from "./app-url.ts";

test("redirects and invitations retain the GitHub Pages project path", () => {
  assert.equal(appBaseUrl("./", "https://wilzard95.github.io/app-futbol/?account=1").href,
    "https://wilzard95.github.io/app-futbol/");
  assert.equal(appBaseUrl("./", "http://127.0.0.1:5174/?account=1").href,
    "http://127.0.0.1:5174/");
});
