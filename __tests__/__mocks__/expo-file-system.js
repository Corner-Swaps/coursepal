module.exports = {
  documentDirectory: '/mock/documents/',
  cacheDirectory: '/mock/cache/',
  EncodingType: {
    UTF8: 'utf8',
    Base64: 'base64'
  },
  writeAsStringAsync: jest.fn().mockResolvedValue(undefined),
  readAsStringAsync: jest.fn().mockResolvedValue(''),
  getInfoAsync: jest.fn().mockResolvedValue({ exists: false }),
  getContentUriAsync: jest.fn(async (uri) => `content://mock/${uri.split('/').pop()}`)
};
