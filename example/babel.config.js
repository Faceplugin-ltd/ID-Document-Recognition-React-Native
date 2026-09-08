const path = require('path');
const pak = require('../package.json');

module.exports = {
  presets: ['module:@react-native/babel-preset'],
  plugins: [
    [
      'module-resolver',
      {
        extensions: ['.tsx', '.ts', '.js', '.json'],
        alias: {
          [`${pak.name}/locate`]: path.join(__dirname, '..', 'src', 'locate'),
          [`${pak.name}/result`]: path.join(__dirname, '..', 'src', 'resultParser'),
          [pak.name]: path.join(__dirname, '..', 'src'),
        },
      },
    ],
  ],
};
