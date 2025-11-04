/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'node',
  roots: ['<rootDir>'],
  testMatch: ['**/__tests__/**/*.test.js'],
  moduleDirectories: ['node_modules', '<rootDir>'],
  verbose: true,
  setupFiles: [],
};


