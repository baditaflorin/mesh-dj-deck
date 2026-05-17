import { expect, test } from "@playwright/test";
import { openTwoPeers } from "@baditaflorin/mesh-common/testing";
import { readFileSync } from "node:fs";

const pkg = JSON.parse(readFileSync(new URL("../../package.json", import.meta.url), "utf8")) as {
  name: string;
};
const storagePrefix = pkg.name;

test("alice claims deck, drops a track → bob sees it now-playing + reacts", async ({
  browser,
  baseURL,
}) => {
  const { a, b, cleanup } = await openTwoPeers(browser, baseURL ?? "", { storagePrefix });
  try {
    await a.getByPlaceholder("your name").fill("alice");
    await b.getByPlaceholder("your name").fill("bob");
    await a.waitForTimeout(500);

    await a.getByRole("button", { name: "take the deck", exact: true }).click();
    await a.getByPlaceholder("title").fill("Mesh Beat");
    await a.getByPlaceholder("artist").fill("Various Peers");
    await a.getByRole("button", { name: "drop track", exact: true }).click();

    await expect(b.locator(".dj-now")).toContainText("Mesh Beat");
    await expect(b.locator(".dj-now")).toContainText("alice");

    await b.getByRole("button", { name: "react fire", exact: true }).first().click();
    await expect(a.locator(".dj-now")).toContainText("🔥");
  } finally {
    await cleanup();
  }
});
