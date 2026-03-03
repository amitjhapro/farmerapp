module.exports = {
  presets: ['module:@react-native/babel-preset'],
  plugins: [
    // other plugins
    'react-native-reanimated/plugin', // Must be the last plugin
  ],
};
const config = {
    resetCache: true
};
