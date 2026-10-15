/** Illustrated context only: no contacts, sensor reports, scored geometry or
 * calibration. The actual frozen environment appears after preparation.
 * Original artwork: layered ridgelines at dusk, a schematic outpost and
 * topographic contours, drawn in the VYUHA palette. */
export function PreparationTerrain() {
  const contours = Array.from({ length: 9 }, (_, i) => i);
  return (
    <svg
      className="preparation-terrain"
      viewBox="0 0 1600 900"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="prep-sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#0d1214" />
          <stop offset="0.55" stopColor="#1a2224" />
          <stop offset="0.78" stopColor="#3a3328" />
          <stop offset="1" stopColor="#1a1d1c" />
        </linearGradient>
        <radialGradient id="prep-glow" cx="0.72" cy="0.62" r="0.45">
          <stop offset="0" stopColor="#d8bf8d" stopOpacity="0.32" />
          <stop offset="1" stopColor="#d8bf8d" stopOpacity="0" />
        </radialGradient>
        <linearGradient id="prep-ground" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#151a1b" />
          <stop offset="1" stopColor="#0a0c0d" />
        </linearGradient>
        <clipPath id="prep-ground-clip">
          <path d="M0 640 C 300 610 520 600 800 612 S 1320 630 1600 606 V900 H0Z" />
        </clipPath>
      </defs>
      <rect width="1600" height="900" fill="url(#prep-sky)" />
      <rect width="1600" height="900" fill="url(#prep-glow)" />
      <path
        fill="#222a2b"
        opacity="0.9"
        d="M0 560 L120 520 260 548 380 500 520 532 640 470 780 520 900 488 1040 530 1180 478 1320 520 1460 490 1600 524 V900 H0Z"
      />
      <path
        fill="#1a2021"
        d="M0 600 L160 560 300 590 470 548 620 584 760 552 920 590 1080 556 1240 594 1400 560 1600 590 V900 H0Z"
      />
      <path
        fill="url(#prep-ground)"
        d="M0 640 C 300 610 520 600 800 612 S 1320 630 1600 606 V900 H0Z"
      />
      <g
        clipPath="url(#prep-ground-clip)"
        fill="none"
        stroke="#d8bf8d"
        strokeOpacity="0.07"
        strokeWidth="1"
      >
        {contours.map((i) => (
          <ellipse
            key={i}
            cx="1060"
            cy="760"
            rx={120 + i * 90}
            ry={26 + i * 20}
          />
        ))}
      </g>
      <g fill="#0f1314" stroke="#5c6664" strokeOpacity="0.55" strokeWidth="1">
        <path d="M980 628 h120 v-34 h-120Z" />
        <path d="M1110 628 h70 v-52 h-70Z" />
        <path d="M940 628 h36 v-22 h-36Z" />
        <path d="M1190 628 h54 v-28 h-54Z" />
      </g>
      <g stroke="#a9b0a8" strokeOpacity="0.55" strokeWidth="1.4" fill="none">
        <path d="M1146 576 V520" />
        <path d="M1132 534 h28" />
        <circle cx="1146" cy="514" r="7" />
      </g>
      <circle cx="1146" cy="514" r="2" fill="#d8bf8d" />
      <path
        d="M0 640 C 300 610 520 600 800 612 S 1320 630 1600 606"
        fill="none"
        stroke="#d8bf8d"
        strokeOpacity="0.18"
      />
    </svg>
  );
}
