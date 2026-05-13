module.exports = {
  testEnvironment: 'node',
  globalSetup: './tests/globalSetup.js',
  globalTeardown: './tests/globalTeardown.js',
  testTimeout: 30000,
  collectCoverageFrom: [
    'routes/**/*.js',
    'middleware/**/*.js',
    'database.js',
    '!node_modules/**',
    '!public/**'
  ],
  coverageDirectory: 'coverage',
};