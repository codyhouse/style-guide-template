// Generated scales (spacing, radius, font-size). The generator lives in the group's
// $extensions; tokens hold the computed values so any DTCG tool can read them.
const round = (n) => Math.round(n * 1e4) / 1e4;

export function generateScale({ base, steps, ratio }) {
  return Object.fromEntries(Object.entries(steps).map(([name, step]) => [
    name,
    { value: round(ratio ? base.value * ratio ** step : base.value * step), unit: base.unit },
  ]));
}

export function applyScale(group, vendor) {
  const out = structuredClone(group);
  const scale = out.$extensions?.[vendor]?.scale;
  if (!scale) return out;
  for (const [name, value] of Object.entries(generateScale(scale))) {
    if (out[name]?.$extensions?.[vendor]?.overridden) continue;
    out[name] = { ...out[name], $value: value };
  }
  return out;
}

export function setStep(group, step, dimension, vendor) {
  const out = structuredClone(group);
  const ext = out[step]?.$extensions ?? {};
  out[step] = { ...out[step], $value: dimension, $extensions: { ...ext, [vendor]: { ...ext[vendor], overridden: true } } };
  return out;
}
