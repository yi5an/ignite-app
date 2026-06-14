module.exports = function (api) {
  api.cache(true);
  return {
    presets: [
      [
        'babel-preset-expo',
        {
          reanimated: false,
          'react-compiler': false,
        },
      ],
    ],
    plugins: ['react-native-reanimated/plugin'],
  };
};
