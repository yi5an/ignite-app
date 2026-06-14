// Minimal mock for React Native modules so pure logic tests can run
module.exports = {
  Platform: { OS: 'web' },
  StyleSheet: { create: (s) => s },
};
