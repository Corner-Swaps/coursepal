const React = require('react');

const mockComponent = (name) => {
  const Component = (props) => React.createElement(name, props, props.children);
  Component.displayName = name;
  return Component;
};

module.exports = {
  View: mockComponent('View'),
  Text: mockComponent('Text'),
  Image: mockComponent('Image'),
  TouchableOpacity: mockComponent('TouchableOpacity'),
  ActivityIndicator: mockComponent('ActivityIndicator'),
  StyleSheet: {
    create: (styles) => styles,
    flatten: (style) => (Array.isArray(style) ? Object.assign({}, ...style) : style || {}),
  },
  Dimensions: {
    get: jest.fn(() => ({ width: 375, height: 812 })),
    set: jest.fn(),
    addEventListener: jest.fn(() => ({ remove: jest.fn() })),
  },
  Platform: {
    OS: 'ios',
    select: (obj) => (obj.ios !== undefined ? obj.ios : obj.default),
  },
  Animated: {
    Value: function (val) {
      this._value = val;
      this.setValue = (v) => { this._value = v; };
      this.interpolate = jest.fn(() => this);
    },
    timing: jest.fn(() => ({
      start: jest.fn((cb) => cb && cb({ finished: true })),
      stop: jest.fn(),
    })),
    parallel: jest.fn(() => ({
      start: jest.fn((cb) => cb && cb({ finished: true })),
    })),
    sequence: jest.fn(() => ({
      start: jest.fn((cb) => cb && cb({ finished: true })),
    })),
    View: mockComponent('Animated.View'),
    Text: mockComponent('Animated.Text'),
    Image: mockComponent('Animated.Image'),
    spring: jest.fn(() => ({
      start: jest.fn((cb) => cb && cb({ finished: true })),
      stop: jest.fn(),
    })),
    loop: jest.fn(() => ({
      start: jest.fn(),
      stop: jest.fn(),
    })),
  },
  AppState: {
    currentState: 'active',
    addEventListener: jest.fn((type, handler) => {
      return { remove: jest.fn() };
    }),
  },
  StatusBar: mockComponent('StatusBar'),
  PanResponder: {
    create: (config) => ({
      panHandlers: {},
      ...config,
    }),
  },
  Easing: {
    linear: (t) => t,
    ease: (t) => t,
    inOut: () => (t) => t,
  },
  Share: {
    share: jest.fn(() => Promise.resolve({ action: 'sharedAction' })),
    sharedAction: 'sharedAction',
    dismissedAction: 'dismissedAction',
  },
};
