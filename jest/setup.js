// jest setup file for mocking navigation and native modules

// react-native-gesture-handler mock (if used in the future)
jest.mock('react-native-gesture-handler', () => ({}));

// mock react-native-screens to avoid native dependency errors
jest.mock('react-native-screens', () => ({
  enableScreens: jest.fn(),
  // export everything else so import works
  ...jest.requireActual('react-native-screens'),
}));

// minimal mock for @react-navigation/native
jest.mock('@react-navigation/native', () => {
  const actualNav = jest.requireActual('@react-navigation/native');
  return {
    ...actualNav,
    useNavigation: () => ({
      navigate: jest.fn(),
      replace: jest.fn(),
    }),
  };
});
