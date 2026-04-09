/**
 * Jest configuration for lib/services unit tests
 *
 * Uses ts-jest for TypeScript support without needing the full
 * react-native preset since these are pure service tests.
 */

module.exports = {
  rootDir: '../../../',
  testMatch: ['<rootDir>/lib/services/__tests__/**/*.test.ts'],
  setupFilesAfterEnv: ['<rootDir>/lib/services/__tests__/jest.setup.js'],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json', 'node'],
  transform: {
    '^.+\\.(ts|tsx)$': ['ts-jest', {
      tsconfig: {
        module: 'commonjs',
        esModuleInterop: true,
        allowSyntheticDefaultImports: true,
        strict: true,
        skipLibCheck: true,
        moduleResolution: 'node',
      },
      diagnostics: {
        ignoreCodes: [2305], // ignore "module has no exported member" for firebase/auth types
      },
    }],
  },
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
  },
  testEnvironment: 'node',
  collectCoverageFrom: [
    'lib/services/**/*.ts',
    '!lib/services/**/*.test.ts',
    '!lib/services/__tests__/**',
  ],
};
