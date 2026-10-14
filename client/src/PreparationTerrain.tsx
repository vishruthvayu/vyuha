/** Illustrated context only: no contacts, sensor reports, scored geometry or
 * calibration. The actual frozen environment appears after preparation. */
export function PreparationTerrain() {
  return (
    <svg
      className="preparation-terrain"
      viewBox="0 0 1200 650"
      preserveAspectRatio="xMidYMid slice"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="preparation-sky" x2="0" y2="1">
          <stop stopColor="#415965" />
          <stop offset="1" stopColor="#25383b" />
        </linearGradient>
        <linearGradient id="preparation-ground" x2="0" y2="1">
          <stop stopColor="#45574d" />
          <stop offset="1" stopColor="#1b292c" />
        </linearGradient>
      </defs>
      <path fill="url(#preparation-sky)" d="M0 0h1200v650H0z" />
      <path
        fill="#334748"
        d="M0 340 210 150 430 350 650 120 850 330 1040 160 1200 340V650H0z"
      />
      <path
        fill="url(#preparation-ground)"
        d="m0 430 360-95 190 80 400-80 250 90v225H0z"
      />
      <path fill="#2b393e" d="m0 590 760-180 170 14L0 650z" />
      <g fill="#465a5a" stroke="#70817b" strokeWidth="1">
        <path d="m610 400 100-35 100 45-100 38z" />
        <path fill="#293a3e" d="m610 400 100 48v95l-100-49z" />
        <path fill="#344a4c" d="m710 448 100-38v84l-100 49z" />
        <path d="m870 363 60-22 80 37-60 26z" />
        <path fill="#283b3e" d="m870 363 80 41v75l-80-39z" />
        <path fill="#3d5354" d="m950 404 60-26v65l-60 36z" />
      </g>
      <g stroke="#9aab9d" fill="none" strokeWidth="2">
        <path d="m868 411 18-106 16 99m-34-14h33m-29-24h25" />
        <ellipse
          cx="888"
          cy="295"
          rx="26"
          ry="9"
          transform="rotate(-15 888 295)"
        />
      </g>
      <g fill="#223734">
        <path d="m1075 310-25 88h50z" />
        <path d="m1020 440-32 100h64z" />
        <path d="m580 310-22 74h44z" />
      </g>
    </svg>
  );
}
