import React from "react";
import {
  act,
  create,
  type ReactTestInstance,
  type ReactTestRenderer,
} from "react-test-renderer";

import { StixDetailsPanel } from "./StixDetailsPanel";

function findAllByTestId(renderer: ReactTestRenderer, testID: string) {
  return renderer.root.findAll((node) => node.props.testID === testID);
}

function findByTestId(renderer: ReactTestRenderer, testID: string) {
  return findAllByTestId(renderer, testID).filter(
    (node) => typeof node.type === "string"
  );
}

function press(renderer: ReactTestRenderer, testID: string) {
  const target = findAllByTestId(renderer, testID).find(
    (node: ReactTestInstance) => typeof node.props.onPress === "function"
  );

  if (!target) throw new Error(`No pressable element with testID "${testID}"`);

  act(() => {
    target.props.onPress();
  });
}

function renderPanel(
  props: Partial<React.ComponentProps<typeof StixDetailsPanel>>
) {
  let renderer!: ReactTestRenderer;

  act(() => {
    renderer = create(
      <StixDetailsPanel id="malware--1" stixObject={null} {...props} />
    );
  });

  return renderer;
}

const OBJECT = {
  type: "malware",
  id: "malware--1",
  name: "Adversary-in-the-middle",
  description: "A description",
  labels: ["malware", "apt"],
  confidence: 80,
  is_family: false,
};

describe("StixDetailsPanel", () => {
  it("uses the object's name as the heading and lists key fields", () => {
    const renderer = renderPanel({ stixObject: OBJECT });

    expect(
      findByTestId(renderer, "stix2vis-details-heading")[0]!.props.children
    ).toBe("Adversary-in-the-middle");
    expect(
      findByTestId(renderer, "stix2vis-details-description")[0]!.props.children
    ).toBe("A description");
    expect(
      findByTestId(renderer, "stix2vis-details-labels")[0]!.props.children
    ).toBe("malware, apt");
    expect(
      findByTestId(renderer, "stix2vis-details-confidence")[0]!.props.children
    ).toBe("80");
    // Not part of the summary table.
    expect(findByTestId(renderer, "stix2vis-details-is_family")).toHaveLength(
      0
    );
  });

  it("falls back to value, then type, then the id for the heading", () => {
    expect(
      findByTestId(
        renderPanel({ stixObject: { type: "ipv4-addr", value: "1.2.3.4" } }),
        "stix2vis-details-heading"
      )[0]!.props.children
    ).toBe("1.2.3.4");

    expect(
      findByTestId(
        renderPanel({ stixObject: { type: "url", id: "url--1" } }),
        "stix2vis-details-heading"
      )[0]!.props.children
    ).toBe("url");

    expect(
      findByTestId(
        renderPanel({ stixObject: {}, id: "custom--1" }),
        "stix2vis-details-heading"
      )[0]!.props.children
    ).toBe("custom--1");
  });

  it("explains nodes with no backing STIX object", () => {
    const renderer = renderPanel({ stixObject: null, id: "threat-actor--1" });

    expect(
      findByTestId(renderer, "stix2vis-details-heading")[0]!.props.children
    ).toBe("threat-actor--1");
    expect(findByTestId(renderer, "stix2vis-details-empty")).toHaveLength(1);
    expect(findByTestId(renderer, "stix2vis-details-toggle-json")).toHaveLength(
      0
    );
  });

  it("reveals the full JSON on request", () => {
    const renderer = renderPanel({ stixObject: OBJECT });

    expect(findByTestId(renderer, "stix2vis-details-json")).toHaveLength(0);

    press(renderer, "stix2vis-details-toggle-json");

    expect(
      findByTestId(renderer, "stix2vis-details-json")[0]!.props.children
    ).toBe(JSON.stringify(OBJECT, null, 2));

    press(renderer, "stix2vis-details-toggle-json");

    expect(findByTestId(renderer, "stix2vis-details-json")).toHaveLength(0);
  });

  it("offers a copy button only when the app provides one", () => {
    const renderer = renderPanel({ stixObject: OBJECT });

    expect(findByTestId(renderer, "stix2vis-details-copy")).toHaveLength(0);
  });

  it("hands the JSON to the copy handler", () => {
    const onCopyJson = jest.fn();
    const renderer = renderPanel({ stixObject: OBJECT, onCopyJson });

    press(renderer, "stix2vis-details-copy");

    expect(onCopyJson).toHaveBeenCalledWith(JSON.stringify(OBJECT, null, 2));
  });

  it("offers a close button only when the app provides one", () => {
    const onClose = jest.fn();
    const renderer = renderPanel({ stixObject: OBJECT, onClose });

    press(renderer, "stix2vis-details-close");

    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
