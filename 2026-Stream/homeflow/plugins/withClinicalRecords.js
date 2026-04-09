const { withEntitlementsPlist, withInfoPlist } = require("expo/config-plugins");

/**
 * Expo config plugin that enables Apple Health Clinical Records (FHIR).
 *
 * Adds:
 * - HealthKit Clinical Health Records entitlement
 * - NSHealthClinicalHealthRecordsShareUsageDescription to Info.plist
 *
 * Usage in app.config.js:
 *   ["./plugins/withClinicalRecords", {
 *     usageDescription: "StreamSync would like to access your clinical health records..."
 *   }]
 *
 * Removing this plugin entry removes the entitlement entirely,
 * causing isAvailable() to return false and all queries to return [].
 */

const DEFAULT_USAGE_DESCRIPTION =
  "StreamSync would like to access your clinical health records to import medications, lab results, and conditions — reducing manual data entry.";

function withClinicalRecordsEntitlement(config) {
  return withEntitlementsPlist(config, (mod) => {
    // Ensure the base HealthKit entitlement exists
    if (!mod.modResults["com.apple.developer.healthkit"]) {
      mod.modResults["com.apple.developer.healthkit"] = true;
    }

    // Add clinical health records access
    const existingAccess = mod.modResults["com.apple.developer.healthkit.access"] || [];
    if (!existingAccess.includes("health-records")) {
      mod.modResults["com.apple.developer.healthkit.access"] = [
        ...existingAccess,
        "health-records",
      ];
    }

    return mod;
  });
}

function withClinicalRecordsInfoPlist(config, usageDescription) {
  return withInfoPlist(config, (mod) => {
    mod.modResults.NSHealthClinicalHealthRecordsShareUsageDescription =
      usageDescription || DEFAULT_USAGE_DESCRIPTION;

    return mod;
  });
}

module.exports = function withClinicalRecords(config, props = {}) {
  const { usageDescription } = props;

  config = withClinicalRecordsEntitlement(config);
  config = withClinicalRecordsInfoPlist(config, usageDescription);

  return config;
};
