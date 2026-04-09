import { requireOptionalNativeModule } from 'expo-modules-core';

// Returns null on non-iOS platforms or when the native module isn't compiled in.
export default requireOptionalNativeModule('ExpoClinicalRecords');
