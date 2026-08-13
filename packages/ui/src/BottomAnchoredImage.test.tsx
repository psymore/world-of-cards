import React from 'react';
import { render, screen, fireEvent } from '@testing-library/react-native';
import { BottomAnchoredImage, computeBottomAnchoredImageHeight } from './BottomAnchoredImage';

const FAKE_SOURCE = { uri: 'fake-wooden-frame.png' };
const IMAGE_TEST_ID = 'bottom-anchored-image-under-test';

function renderTestImage() {
  return render(
    <BottomAnchoredImage
      source={FAKE_SOURCE}
      assetWidth={1200}
      assetHeight={800}
      imageProps={{ testID: IMAGE_TEST_ID }}
    />,
  );
}

async function fireLayout(width: number, height = 0) {
  // Must be awaited: fireEvent's state update reaches the rendered tree asynchronously in this
  // testing-library version (same as this repo's `await fireEvent.press(...)` calls elsewhere).
  await fireEvent(screen.getByTestId('bottom-anchored-image-container'), 'layout', {
    nativeEvent: { layout: { x: 0, y: 0, width, height } },
  });
}

function flatStyle(image: ReturnType<typeof screen.getByTestId>) {
  return Array.isArray(image.props.style)
    ? Object.assign({}, ...image.props.style)
    : image.props.style;
}

describe('computeBottomAnchoredImageHeight', () => {
  it('derives height from width using the asset aspect ratio', () => {
    expect(computeBottomAnchoredImageHeight(1200, 800, 390)).toBe(260);
  });

  it('scales proportionally for a different container width', () => {
    expect(computeBottomAnchoredImageHeight(1200, 800, 430)).toBeCloseTo(286.6667, 3);
  });

  it('is independent of any fixed device width', () => {
    // Same asset ratio, arbitrary container widths — nothing here references a device size.
    expect(computeBottomAnchoredImageHeight(1000, 2000, 100)).toBe(200);
    expect(computeBottomAnchoredImageHeight(1000, 2000, 750)).toBe(1500);
  });
});

describe('BottomAnchoredImage', () => {
  it('renders nothing until the container is measured', async () => {
    await renderTestImage();
    expect(screen.queryByTestId(IMAGE_TEST_ID)).toBeNull();
  });

  it('fills the container width and derives a proportional, undistorted height', async () => {
    await renderTestImage();
    await fireLayout(390, 844);

    const image = screen.getByTestId(IMAGE_TEST_ID);
    const style = flatStyle(image);
    expect(style.width).toBe(390);
    expect(style.height).toBe(260);
    expect(style.position).toBe('absolute');
    expect(style.left).toBeCloseTo(0, 10);
    expect(style.bottom).toBe(0);
    expect(image.props.resizeMode).toBe('stretch');
  });

  it('is bottom-anchored, not top-anchored: it never claims the full container height', async () => {
    await renderTestImage();
    await fireLayout(390, 844);

    const style = flatStyle(screen.getByTestId(IMAGE_TEST_ID));
    // containerHeight (844) - renderedHeight (260) = 584: the image occupies only its own
    // bottom slice; `top` is implied by `bottom: 0` + this height, never forced to 0.
    expect(style.height).toBeLessThan(844);
    expect(844 - style.height).toBe(584);
  });

  it('recomputes height when the container width changes (orientation/resize)', async () => {
    await renderTestImage();

    await fireLayout(390, 844);
    expect(flatStyle(screen.getByTestId(IMAGE_TEST_ID))).toMatchObject({
      width: 390,
      height: 260,
    });

    // Simulated rotation to landscape: wider container, height must scale with it.
    await fireLayout(844, 390);
    expect(flatStyle(screen.getByTestId(IMAGE_TEST_ID))).toMatchObject({
      width: 844,
      height: computeBottomAnchoredImageHeight(1200, 800, 844),
    });
  });

  it('preserves the source aspect ratio at every container width', async () => {
    await renderTestImage();
    for (const width of [320, 390, 430, 768, 1024]) {
      await fireLayout(width, 900);
      const style = flatStyle(screen.getByTestId(IMAGE_TEST_ID));
      expect(style.width / style.height).toBeCloseTo(1200 / 800, 5);
    }
  });

  it('compensates for transparent content padding baked into the source asset', async () => {
    // A "photoroom"-style asset whose opaque artwork stops short of its own file edges: 34/941
    // transparent on the left, 33/941 on the right (the real wooden-frame measurements).
    await render(
      <BottomAnchoredImage
        source={FAKE_SOURCE}
        assetWidth={941}
        assetHeight={1672}
        contentInsetLeftFraction={34 / 941}
        contentInsetRightFraction={33 / 941}
        imageProps={{ testID: IMAGE_TEST_ID }}
      />,
    );
    await fireLayout(390, 900);

    const style = flatStyle(screen.getByTestId(IMAGE_TEST_ID));
    const contentWidthFraction = 1 - 34 / 941 - 33 / 941;
    const expectedRenderedWidth = 390 / contentWidthFraction;
    // Rendered wider than the container (the transparent margin is inside that extra width)...
    expect(style.width).toBeCloseTo(expectedRenderedWidth, 5);
    // ...and shifted left so the real (opaque) content starts exactly at the container's edge.
    expect(style.left).toBeCloseTo(-(34 / 941) * expectedRenderedWidth, 5);
    // The visible content span (from the shifted left edge to width - right margin) still equals
    // the container's own width, i.e. the artwork itself reaches both true edges.
    const visibleContentWidth =
      style.width * contentWidthFraction;
    expect(visibleContentWidth).toBeCloseTo(390, 5);
  });

  it('defaults to zero content inset (no behavior change for assets without padding)', async () => {
    await renderTestImage();
    await fireLayout(390, 844);
    const style = flatStyle(screen.getByTestId(IMAGE_TEST_ID));
    expect(style.width).toBe(390);
    expect(style.left).toBeCloseTo(0, 10);
  });
});
