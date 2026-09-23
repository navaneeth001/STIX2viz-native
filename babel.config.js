// Babel is only used by Jest here — the published build is produced by `tsc`
// (see tsconfig.build.json), and Metro compiles the *consumer's* app with its
// own Babel config. This file therefore never ships (package.json `files` only
// includes `dist`).
module.exports = {
  presets: ["module:@react-native/babel-preset"],
};
