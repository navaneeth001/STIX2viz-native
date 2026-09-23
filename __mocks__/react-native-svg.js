/**
 * Jest mock for `react-native-svg`.
 *
 * Every SVG primitive is replaced by a host element named `RNSVG.<Name>`
 * (e.g. `RNSVG.Circle`), so tests can assert the rendered graph with
 * `root.findAll(node => node.type === "RNSVG.Circle")` without a native
 * runtime, and without the names colliding with React Native's own
 * `Text`/`Image` host components. Props are passed through untouched.
 *
 * Jest picks this file up automatically because it lives in a `__mocks__`
 * directory adjacent to `node_modules` (manual mocks for node modules do not
 * need a `jest.mock()` call).
 */
import * as React from "react";

function makeSvgPrimitive(name) {
  const Primitive = React.forwardRef(function SvgPrimitive(props, ref) {
    return React.createElement(`RNSVG.${name}`, { ...props, ref });
  });
  Primitive.displayName = `RNSVG.${name}`;
  return Primitive;
}

const primitives = {
  Svg: makeSvgPrimitive("Svg"),
  G: makeSvgPrimitive("G"),
  Circle: makeSvgPrimitive("Circle"),
  Ellipse: makeSvgPrimitive("Ellipse"),
  Rect: makeSvgPrimitive("Rect"),
  Line: makeSvgPrimitive("Line"),
  Polygon: makeSvgPrimitive("Polygon"),
  Polyline: makeSvgPrimitive("Polyline"),
  Path: makeSvgPrimitive("Path"),
  Text: makeSvgPrimitive("Text"),
  TSpan: makeSvgPrimitive("TSpan"),
  TextPath: makeSvgPrimitive("TextPath"),
  Image: makeSvgPrimitive("Image"),
  Defs: makeSvgPrimitive("Defs"),
  ClipPath: makeSvgPrimitive("ClipPath"),
  Marker: makeSvgPrimitive("Marker"),
  Use: makeSvgPrimitive("Use"),
  Symbol: makeSvgPrimitive("Symbol"),
  Mask: makeSvgPrimitive("Mask"),
  LinearGradient: makeSvgPrimitive("LinearGradient"),
  RadialGradient: makeSvgPrimitive("RadialGradient"),
  Stop: makeSvgPrimitive("Stop"),
  Pattern: makeSvgPrimitive("Pattern"),
};

module.exports = {
  __esModule: true,
  ...primitives,
  default: primitives.Svg,
};
