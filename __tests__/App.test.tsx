/**
 * @format
 */

import React from 'react';
import ReactTestRenderer from 'react-test-renderer';
import App from '../App';

test('renders correctly', async () => {
  await ReactTestRenderer.act(() => {
    ReactTestRenderer.create(<App />);
  });
});
// simple smoke test for login content
test('initial screen is Login', async () => {
  let tree: any;
  await ReactTestRenderer.act(() => {
    tree = ReactTestRenderer.create(<App />);
  });
  const root = tree.root;
  // look for a text element that says "Login" which is rendered on login screen
  const loginText = root.findAllByProps({children: 'Login'});
  expect(loginText.length).toBeGreaterThan(0);
});

// because we changed login to push to Onboarding, we can test the existence of the
// onboarding title when we manually render that screen
test('onboarding screen renders text', () => {
  const tree = ReactTestRenderer.create(
    // render the screen directly rather than via navigation
    React.createElement(require('../src/screens/FarmerOnboardingScreen').default, {
      navigation: {replace: jest.fn()},
    }),
  );
  const root = tree.root;
  const title = root.findAllByProps({children: 'Farmer Onboarding'});
  expect(title.length).toBe(1);
});

test('onboarding screen contains first name input', () => {
  const Screen = require('../src/screens/FarmerOnboardingScreen').default;
  const tree = ReactTestRenderer.create(
    React.createElement(Screen, {navigation: {replace: jest.fn()}}),
  );
  const root = tree.root;
  // look for placeholder prop on TextInput
  const inputs = root.findAllByType('TextInput');
  const hasFirst = inputs.some((input: any) => input.props.placeholder === 'First Name');
  expect(hasFirst).toBe(true);
});

test('submit button navigates home', () => {
  const mockReplace = jest.fn();
  const Screen = require('../src/screens/FarmerOnboardingScreen').default;
  const tree = ReactTestRenderer.create(
    React.createElement(Screen, {navigation: {replace: mockReplace}}),
  );
  const root = tree.root;
  const button = root.findAllByProps({children: 'Complete Onboarding'})[0];
  ReactTestRenderer.act(() => {
    button.props.onPress();
  });
  expect(mockReplace).toHaveBeenCalledWith('Home');
});
