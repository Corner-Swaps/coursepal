module.exports = {
  documentDirectory: '/mock/documents/',
  EncodingType: {
    UTF8: 'utf8'
  },
  writeAsStringAsync: jest.fn().mockResolvedValue(undefined),
  readAsStringAsync: jest.fn().mockResolvedValue(''),
  getInfoAsync: jest.fn().mockResolvedValue({ exists: false })
};
