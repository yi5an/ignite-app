const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Keep Metro scoped to this app so startup doesn't walk parent workspace folders.
config.projectRoot = __dirname;
config.watchFolders = [];
config.maxWorkers = 1;

module.exports = config;
