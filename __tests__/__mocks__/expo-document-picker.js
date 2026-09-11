module.exports = {
  getDocumentAsync: jest.fn().mockResolvedValue({
    canceled: false,
    assets: [
      {
        name: 'Sample_Syllabus.pdf',
        uri: 'file:///mock/Sample_Syllabus.pdf',
        size: 1024 * 500,
        mimeType: 'application/pdf'
      }
    ]
  })
};
