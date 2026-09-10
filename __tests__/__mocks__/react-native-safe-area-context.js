const React = require('react');

const mockInsets = {
  top: 47,
  bottom: 34,
  left: 0,
  right: 0
};

const mockFrame = {
  x: 0,
  y: 0,
  width: 390,
  height: 844
};

const SafeAreaContext = React.createContext(mockInsets);

module.exports = {
  SafeAreaContext,
  SafeAreaProvider: ({ children }) => children,
  SafeAreaConsumer: ({ children }) => children(mockInsets),
  useSafeAreaInsets: jest.fn(() => mockInsets),
  useSafeAreaFrame: jest.fn(() => mockFrame),
  mockInsets,
  mockFrame
};
