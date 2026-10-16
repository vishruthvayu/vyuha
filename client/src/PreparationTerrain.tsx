/** Illustrated context only: no contacts, sensor reports, scored geometry or
 * calibration. The actual frozen environment appears after preparation.
 * The landscape is the team's own illustrative concept image (see
 * premium/media/PROVENANCE.md), drawn as a CSS background so the stage keeps
 * working without JavaScript asset imports. The SVG shares the image's
 * coordinate space (1586 × 812, cover/slice) and only adds a quiet reticle on
 * the single drone in the sky: the smallest signal the trainee learns to read. */
export function PreparationTerrain() {
  return (
    <div className="preparation-terrain" aria-hidden="true">
      <svg viewBox="0 0 1586 812" preserveAspectRatio="xMidYMid slice">
        <g className="preparation-reticle" transform="translate(1188 277)">
          <circle className="preparation-reticle-pulse" r="30" />
          <path d="M-26 -14 V-26 H-14 M14 -26 H26 V-14 M26 14 V26 H14 M-14 26 H-26 V14" />
        </g>
      </svg>
    </div>
  );
}
