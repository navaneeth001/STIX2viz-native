/**
 * Jest configuration for the library.
 *
 * `@react-native/jest-preset` is the preset React Native itself uses: it stubs
 * the native modules, polyfills the RN globals and transpiles via `babel-jest`
 * (see babel.config.js). React Native components are rendered with
 * `react-test-renderer`, so no native runtime is involved.
 */
module.exports = {
  preset: "@react-native/jest-preset",
  testMatch: ["<rootDir>/src/**/*.test.ts?(x)"],
  clearMocks: true,
  // Metro resolves image imports to asset handles; Jest needs a stand-in.
  moduleNameMapper: {
    "\\.(png|jpg|jpeg|gif|webp)$": "<rootDir>/__mocks__/assetMock.js",
  },
  collectCoverageFrom: [
    "src/**/*.{ts,tsx}",
    "!src/**/*.test.{ts,tsx}",
    "!src/icons/registry.ts",
    "!src/index.tsx",
    "!example/**",
  ],
  coverageThreshold: {
    global: {
      statements: 85,
      branches: 75,
      functions: 85,
      lines: 85,
    },
  },
};
