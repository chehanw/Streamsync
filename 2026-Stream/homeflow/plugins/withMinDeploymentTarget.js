const { withDangerousMod } = require("expo/config-plugins");
const fs = require("fs");
const path = require("path");

/**
 * Forces all CocoaPods targets to use at least the specified iOS deployment target.
 * This fixes build failures where individual pods (e.g. NitroModules) have a lower
 * deployment target than what CxxStdlib requires on x86_64.
 */
module.exports = function withMinDeploymentTarget(config, { deploymentTarget = "16.0" } = {}) {
  return withDangerousMod(config, [
    "ios",
    async (config) => {
      const podfilePath = path.join(config.modRequest.platformProjectRoot, "Podfile");
      let podfile = fs.readFileSync(podfilePath, "utf8");

      const snippet = `
    # Force minimum deployment target for all pods
    installer.pods_project.targets.each do |target|
      target.build_configurations.each do |config|
        if config.build_settings['IPHONEOS_DEPLOYMENT_TARGET'].to_f < ${deploymentTarget}
          config.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = '${deploymentTarget}'
        end
      end
    end`;

      // Insert inside the existing post_install block, before the closing "end"
      podfile = podfile.replace(
        /post_install do \|installer\|([\s\S]*?)(^\s*end\s*$)/m,
        (match, body, closingEnd) => {
          return `post_install do |installer|${body}${snippet}\n${closingEnd}`;
        }
      );

      fs.writeFileSync(podfilePath, podfile);
      return config;
    },
  ]);
};
