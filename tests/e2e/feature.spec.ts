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

// The headline claim is "Single-DJ ROTATION". The defining property is mutual
// exclusion across the mesh: while one peer holds the deck, no other peer can
// take it or drop a track — and when the holder releases, the deck rotates and
// the next peer can claim + drop. This drives that exclusivity + rotation
// cross-peer. It fails on any code where the claim lives in local state instead
// of the shared Yjs claim record (bob would still see a free deck / a drop form).
test("single-DJ exclusivity rotates across peers", async ({ browser, baseURL }) => {
  const { a, b, cleanup } = await openTwoPeers(browser, baseURL ?? "", { storagePrefix });
  try {
    await a.getByPlaceholder("your name").fill("alice");
    await b.getByPlaceholder("your name").fill("bob");
    await a.waitForTimeout(500);

    const takeA = a.getByRole("button", { name: "take the deck", exact: true });
    const takeB = b.getByRole("button", { name: "take the deck", exact: true });

    // Deck starts open: both (named) peers may take it.
    await expect(takeA).toBeEnabled();
    await expect(takeB).toBeEnabled();

    // Alice claims. The claim record is a shared Y.Map, so BOTH peers must see
    // alice spinning, bob's take-the-deck must lock, and bob must NOT get a drop
    // form (the single-DJ guard, enforced from bob's machine).
    await takeA.click();
    await expect(a.locator(".dj-status")).toContainText("alice is spinning");
    await expect(b.locator(".dj-status")).toContainText("alice is spinning");
    await expect(takeB).toBeDisabled();
    await expect(a.locator(".dj-form")).toBeVisible();
    await expect(b.locator(".dj-form")).toHaveCount(0);

    // Alice releases → the deck rotates. Bob's take-the-deck re-enables on his
    // own machine purely from the shared claim deletion propagating.
    await a.getByRole("button", { name: "release deck", exact: true }).click();
    await expect(a.locator(".dj-status")).toContainText("deck is open");
    await expect(b.locator(".dj-status")).toContainText("deck is open");
    await expect(takeB).toBeEnabled();

    // Bob takes the rotated deck and drops a track; alice (now audience) sees it
    // now-playing with bob credited — the rotation completed peer→peer.
    await takeB.click();
    await expect(a.locator(".dj-status")).toContainText("bob is spinning");
    await b.getByPlaceholder("title").fill("Rotation Anthem");
    await b.getByPlaceholder("artist").fill("Second DJ");
    await b.getByRole("button", { name: "drop track", exact: true }).click();
    await expect(a.locator(".dj-now")).toContainText("Rotation Anthem");
    await expect(a.locator(".dj-now")).toContainText("bob");
    // And alice (the non-holder) still has no drop form.
    await expect(a.locator(".dj-form")).toHaveCount(0);
  } finally {
    await cleanup();
  }
});
