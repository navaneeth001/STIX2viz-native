import { defaultTheme, groupColor, resolveTheme } from "./theme";

describe("resolveTheme", () => {
  it("returns the defaults when nothing is supplied", () => {
    expect(resolveTheme()).toBe(defaultTheme);
    expect(resolveTheme(null)).toBe(defaultTheme);
  });

  it("merges a partial theme over the defaults", () => {
    const theme = resolveTheme({ edge: "#ff0000" });

    expect(theme.edge).toBe("#ff0000");
    expect(theme.text).toBe(defaultTheme.text);
  });

  it("ignores an empty palette instead of leaving the graph colourless", () => {
    const theme = resolveTheme({ palette: [] });

    expect(theme.palette).toEqual(defaultTheme.palette);
  });

  it("keeps a custom palette", () => {
    const theme = resolveTheme({ palette: ["#111111"] });

    expect(theme.palette).toEqual(["#111111"]);
  });
});

describe("groupColor", () => {
  it("maps a STIX type to the same colour every time", () => {
    const first = groupColor("malware", defaultTheme);
    const second = groupColor("malware", defaultTheme);

    expect(first).toBe(second);
    expect(defaultTheme.palette).toContain(first);
  });

  it("prefers an explicit group colour", () => {
    const theme = resolveTheme({ groupColors: { malware: "#123456" } });

    expect(groupColor("malware", theme)).toBe("#123456");
    expect(groupColor("indicator", theme)).toBe(
      groupColor("indicator", defaultTheme)
    );
  });

  it("distributes different types across the palette", () => {
    const colours = new Set(
      ["malware", "indicator", "identity", "file", "url"].map((type) =>
        groupColor(type, defaultTheme)
      )
    );

    expect(colours.size).toBeGreaterThan(1);
  });
});
