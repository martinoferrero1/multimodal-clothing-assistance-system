const path = require("node:path");
const { getDefaultConfig } = require("expo/metro-config");
const config = getDefaultConfig(__dirname);

// Explicit, web-only component test harness. Native/release bundles always use
// the real SecureStore transport; no mock identity switch exists in the app UI.
if (process.env.LOOKEATE_UI_TEST === "1") {
  config.resolver.resolveRequest = (context, moduleName, platform) => {
    const resolved = context.resolveRequest(context, moduleName, platform);
    if (
      platform === "web" &&
      resolved.type === "sourceFile" &&
      resolved.filePath === path.resolve(__dirname, "src/core/client.ts")
    ) {
      return {
        type: "sourceFile",
        filePath: path.resolve(__dirname, "tests/fixtures/client.ts"),
      };
    }
    return resolved;
  };
}
module.exports = config;
