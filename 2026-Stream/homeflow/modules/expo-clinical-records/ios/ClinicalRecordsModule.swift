import ExpoModulesCore
import HealthKit

public class ClinicalRecordsModule: Module {
  private lazy var healthStore = HKHealthStore()

  // Map short string identifiers to HKClinicalTypeIdentifier
  private static let typeMap: [String: HKClinicalTypeIdentifier] = {
    var map: [String: HKClinicalTypeIdentifier] = [
      "allergyRecord": .allergyRecord,
      "conditionRecord": .conditionRecord,
      "immunizationRecord": .immunizationRecord,
      "labResultRecord": .labResultRecord,
      "medicationRecord": .medicationRecord,
      "procedureRecord": .procedureRecord,
      "vitalSignRecord": .vitalSignRecord,
    ]
    if #available(iOS 16.4, *) {
      map["clinicalNoteRecord"] = .clinicalNoteRecord
    }
    return map
  }()

  public func definition() -> ModuleDefinition {
    Name("ExpoClinicalRecords")

    // Check if clinical records are available on this device
    Function("isAvailable") { () -> Bool in
      guard HKHealthStore.isHealthDataAvailable() else { return false }
      return self.healthStore.supportsHealthRecords()
    }

    // Return the list of supported clinical type identifiers
    Function("getSupportedTypes") { () -> [String] in
      return Array(ClinicalRecordsModule.typeMap.keys).sorted()
    }

    // Request authorization for the given clinical record types
    AsyncFunction("requestAuthorization") { (typeNames: [String], promise: Promise) in
      guard HKHealthStore.isHealthDataAvailable(),
            self.healthStore.supportsHealthRecords() else {
        promise.resolve(["success": false, "note": "Clinical records not supported on this device."])
        return
      }

      var types = Set<HKClinicalType>()
      for name in typeNames {
        guard let identifier = ClinicalRecordsModule.typeMap[name],
              let clinicalType = HKObjectType.clinicalType(forIdentifier: identifier) else {
          continue
        }
        types.insert(clinicalType)
      }

      if types.isEmpty {
        promise.resolve(["success": false, "note": "No valid clinical record types provided."])
        return
      }

      self.healthStore.requestAuthorization(toShare: nil, read: types) { success, error in
        if let error = error {
          promise.resolve(["success": false, "note": error.localizedDescription])
        } else {
          promise.resolve([
            "success": success,
            "note": success
              ? "Authorization requested. Read permission status is always 'not determined' for privacy."
              : "Authorization was not granted.",
          ])
        }
      }
    }

    // Query clinical records of a given type
    AsyncFunction("getClinicalRecords") { (typeName: String, options: [String: Any]?, promise: Promise) in
      guard HKHealthStore.isHealthDataAvailable(),
            self.healthStore.supportsHealthRecords() else {
        promise.resolve([] as [[String: Any]])
        return
      }

      guard let identifier = ClinicalRecordsModule.typeMap[typeName],
            let clinicalType = HKObjectType.clinicalType(forIdentifier: identifier) else {
        promise.resolve([] as [[String: Any]])
        return
      }

      // Build optional date predicate
      var predicate: NSPredicate? = nil
      if let opts = options {
        let startDate = (opts["startDate"] as? String).flatMap { self.parseISO8601($0) }
        let endDate = (opts["endDate"] as? String).flatMap { self.parseISO8601($0) }
        if startDate != nil || endDate != nil {
          predicate = HKQuery.predicateForSamples(
            withStart: startDate,
            end: endDate,
            options: .strictStartDate
          )
        }
      }

      let limit = (options?["limit"] as? Int) ?? HKObjectQueryNoLimit

      let query = HKSampleQuery(
        sampleType: clinicalType,
        predicate: predicate,
        limit: limit,
        sortDescriptors: [NSSortDescriptor(key: HKSampleSortIdentifierStartDate, ascending: false)]
      ) { _, samples, error in
        guard error == nil, let records = samples as? [HKClinicalRecord] else {
          promise.resolve([] as [[String: Any]])
          return
        }

        let results: [[String: Any]] = records.compactMap { record in
          self.serializeClinicalRecord(record)
        }

        promise.resolve(results)
      }

      self.healthStore.execute(query)
    }
  }

  // MARK: - Helpers

  private func serializeClinicalRecord(_ record: HKClinicalRecord) -> [String: Any] {
    let formatter = ISO8601DateFormatter()
    formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]

    var dict: [String: Any] = [
      "id": record.uuid.uuidString,
      "clinicalType": record.clinicalType.identifier,
      "displayName": record.displayName,
      "startDate": formatter.string(from: record.startDate),
      "endDate": formatter.string(from: record.endDate),
    ]

    // Extract FHIR resource data if available
    if let fhirRecord = record.fhirResource {
      dict["fhirResourceType"] = fhirRecord.resourceType.rawValue
      dict["fhirIdentifier"] = fhirRecord.identifier
      dict["fhirSourceURL"] = fhirRecord.sourceURL?.absoluteString

      // Parse the raw FHIR JSON data
      if let json = try? JSONSerialization.jsonObject(with: fhirRecord.data, options: []) {
        dict["fhirResource"] = json
      }
    }

    return dict
  }

  private func parseISO8601(_ string: String) -> Date? {
    let formatter = ISO8601DateFormatter()
    formatter.formatOptions = [.withInternetDateTime, .withFractionalSeconds]
    return formatter.date(from: string) ?? {
      formatter.formatOptions = [.withInternetDateTime]
      return formatter.date(from: string)
    }()
  }
}
