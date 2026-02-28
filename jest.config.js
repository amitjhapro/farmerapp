module.exports = {
  preset: 'react-native',
  setupFiles: ['<rootDir>/jest/setup.js'],
  // react-navigation includes ES modules that jest doesn't transform by default
  transformIgnorePatterns: [
    'node_modules/(?!(react-native|@react-navigation|react-native-screens)/)'
  ],
};
