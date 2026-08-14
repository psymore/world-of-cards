import { TYPE_SCALE, PRIMARY_SERIF_BOLD, SECONDARY_SANS_REGULAR } from "./typography";

describe("TYPE_SCALE", () => {
  it("has all seven levels", () => {
    expect(Object.keys(TYPE_SCALE).sort()).toEqual([
      "h1", "h2", "h3", "h4", "h5", "h6", "h7",
    ]);
  });

  it("matches TABLE-029's annotated H4/H5 anchors", () => {
    expect(TYPE_SCALE.h4.fontSize).toBe(32);
    expect(TYPE_SCALE.h5.fontSize).toBe(28);
  });

  it("uses the primary serif for H1-H4 and the secondary sans for H5-H7", () => {
    expect(TYPE_SCALE.h1.fontFamily).toContain("Cinzel");
    expect(TYPE_SCALE.h4.fontFamily).toContain("Cinzel");
    expect(TYPE_SCALE.h5.fontFamily).toContain("Inter");
    expect(TYPE_SCALE.h7.fontFamily).toContain("Inter");
  });

  it("decreases fontSize monotonically from h1 to h7", () => {
    const sizes = ["h1", "h2", "h3", "h4", "h5", "h6", "h7"].map(
      level => TYPE_SCALE[level as keyof typeof TYPE_SCALE].fontSize,
    );
    for (let i = 1; i < sizes.length; i++) {
      expect(sizes[i]).toBeLessThan(sizes[i - 1]);
    }
  });

  it("exports the font family constants used by consumers", () => {
    expect(PRIMARY_SERIF_BOLD).toBe("Cinzel-Bold");
    expect(SECONDARY_SANS_REGULAR).toBe("Inter-Regular");
  });
});
