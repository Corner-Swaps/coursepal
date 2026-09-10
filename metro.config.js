const path = require('path');
const { getDefaultConfig } = require('@expo/metro-config');

const config = getDefaultConfig(__dirname);

config.resolver.blockList = [
  new RegExp('^' + path.resolve(__dirname, 'ios') + '/.*'),
  new RegExp('^' + path.resolve(__dirname, 'android') + '/.*'),
  new RegExp('^' + path.resolve(__dirname, '.git') + '/.*'),
  new RegExp('^' + path.resolve(__dirname, 'dist') + '/.*'),
  new RegExp('^' + path.resolve(__dirname, 'build') + '/.*'),
  /.*\/__tests__\/.*/,
];

module.exports = config;
