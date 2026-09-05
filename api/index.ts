// Vercel's Node runtime loads this entry as CommonJS, so keep require() here.
/* eslint-disable @typescript-eslint/no-require-imports */
const { createRequestHandler } = require('expo-server/adapter/vercel');
const path = require('path');

module.exports = createRequestHandler({
  build: path.join(__dirname, '../dist/server'),
});
