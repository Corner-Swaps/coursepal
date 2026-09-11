module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  testMatch: ['**/__tests__/**/*.test.ts'],
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/src/$1',
    '^react-native$': '<rootDir>/__tests__/__mocks__/react-native.js',
    '^react-native-svg$': '<rootDir>/__tests__/__mocks__/react-native-svg.js',
    '^react-native-safe-area-context$': '<rootDir>/__tests__/__mocks__/react-native-safe-area-context.js',
    '^expo-file-system$': '<rootDir>/__tests__/__mocks__/expo-file-system.js',
    '^expo-document-picker$': '<rootDir>/__tests__/__mocks__/expo-document-picker.js',
    '\\.(png|jpg|jpeg|gif|webp|svg)$': '<rootDir>/__tests__/__mocks__/fileMock.js',
    '\\.(mp3|wav|m4a|aac)$': '<rootDir>/__tests__/__mocks__/fileMock.js',
    '\\.(pdf)$': '<rootDir>/__tests__/__mocks__/fileMock.js'
  },
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: {
        jsx: 'react'
      }
    }]
  }
};
