/** All cockpit instruments are world-anchored at the same depth. Public layout
 * units are metres; no head pose, target truth or simulation input is required. */
export type SpatialSurface = {
  x: number;
  y: number;
  width: number;
  height: number;
  id: string;
};
export const VR_SPATIAL = {
  header: { id: "header", x: 0, y: 2.12, width: 2.8, height: 0.19 },
  evidence: {
    id: "contact-evidence",
    x: -0.98,
    y: 1.57,
    width: 0.88,
    height: 0.4,
  },
  pause: { id: "pause", x: -0.98, y: 1.9, width: 0.88, height: 0.12 },
  contactPage: {
    id: "contact-page",
    x: -0.98,
    y: 0.67,
    width: 0.88,
    height: 0.12,
  },
  status: { id: "status", x: 0.98, y: 1.68, width: 0.88, height: 0.36 },
  acquisition: {
    id: "acquisition",
    x: 0.98,
    y: 0.9,
    width: 0.88,
    height: 0.75,
  },
  legend: { id: "legend", x: 0, y: 0.44, width: 2.8, height: 0.12 },
  notes: { id: "notes", x: 0, y: 0.22, width: 2.8, height: 0.2 },
} as const;
export function spatialSurface(r: SpatialSurface) {
  return {
    position: [r.x, r.y, -1.9] as [number, number, number],
    width: r.width,
    height: r.height,
  };
}
export const vrContactSurface = (i: number): SpatialSurface => ({
  id: `contact-${i}`,
  x: -0.98,
  y: 1.3 - i * 0.14,
  width: 0.88,
  height: 0.12,
});
export const vrActionSurface = (i: number): SpatialSurface => ({
  id: `action-${i}`,
  x: 0,
  y: 1.72 - i * 0.14,
  width: 0.86,
  height: 0.12,
});
export const vrInstrumentSurface = (i: number): SpatialSurface => ({
  id: `instrument-${i}`,
  x: -0.29 + i * 0.29,
  y: 1.92,
  width: 0.26,
  height: 0.11,
});
export function cockpitSurfaces(
  actions: number,
  contacts: number,
  acquisition: boolean,
) {
  if (actions < 0 || actions > 9 || contacts < 0 || contacts > 4)
    throw new RangeError("Cockpit page exceeds spatial capacity");
  return [
    VR_SPATIAL.header,
    VR_SPATIAL.evidence,
    VR_SPATIAL.pause,
    VR_SPATIAL.contactPage,
    VR_SPATIAL.status,
    VR_SPATIAL.legend,
    VR_SPATIAL.notes,
    ...(acquisition ? [VR_SPATIAL.acquisition] : []),
    ...Array.from({ length: 3 }, (_, i) => vrInstrumentSurface(i)),
    ...Array.from({ length: contacts }, (_, i) => vrContactSurface(i)),
    ...Array.from({ length: actions }, (_, i) => vrActionSurface(i)),
  ];
}
