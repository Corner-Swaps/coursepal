const React = require('react');

const mockComponent = (name) => {
  const Component = (props) => React.createElement(name, props, props.children);
  Component.displayName = name;
  return Component;
};

module.exports = {
  Svg: mockComponent('Svg'),
  Circle: mockComponent('Circle'),
  Path: mockComponent('Path'),
  G: mockComponent('G'),
  Rect: mockComponent('Rect'),
  Line: mockComponent('Line'),
  default: mockComponent('Svg'),
};
