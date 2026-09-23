/**
 * Stand-in for bundled image assets under Jest.
 *
 * Metro turns `require("./icon.png")` into an asset handle (a number) at bundle
 * time; Jest has no asset pipeline, so image imports are mapped to this file
 * (see `moduleNameMapper` in jest.config.js) and resolve to the same kind of
 * opaque handle.
 */
module.exports = 1;
