import { createMeshConfig } from "@baditaflorin/mesh-common";

export const config = createMeshConfig({
  appName: "mesh-dj-deck",
  description: "Single-DJ rotation; claim the deck 90s, drop tracks, audience reacts.",
  accentHex: "#b366ff",
  version: __APP_VERSION__,
  commit: __GIT_COMMIT__,
});
