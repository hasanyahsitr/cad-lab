// Keep the visible millimeter grid readable from small parts to building-sized drawings.
export function gridSpacing(pixelsPerMillimeter) {
  if (!Number.isFinite(pixelsPerMillimeter) || pixelsPerMillimeter <= 0)
    throw new RangeError('A positive finite view scale is required.');
  const minimum = 20 / pixelsPerMillimeter;
  const decade = 10 ** Math.floor(Math.log10(minimum));
  return [1, 2, 5, 10].find((factor) => factor * decade >= minimum) * decade;
}
