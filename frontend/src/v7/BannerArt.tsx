import type { CSSProperties } from 'react';

/**
 * Line drawing beside the Loans title: two rows of server racks either side of an aisle in a data hall, in a shallow
 * axonometric view, with server units on the rack fronts and status lights. Rack volumes are filled with the page
 * background, so the front row hides the back row's lines.
 *
 * Motion (styles: .mk7-banner-art in v7.css): the outline draws in, racks rise in left to right and the status lights
 * blink out of step. With reduced motion the drawing is static. Decorative only.
 */

// Axonometric axes: x runs along the row (shallow, down-right), y is rack depth (toward the viewer), z is height.
const AX = [0.97, 0.21];
const AY = [-0.6, 0.35];
const N = 8; // racks
const W = 30; // rack width
const D = 40; // rack depth
const H = 96; // rack height
const UNITS = 6; // server units drawn per rack
const AISLE = 26; // gap between the two rows
const O = [30, 130]; // screen position of the front row's back-left-bottom corner

const pt = (x: number, y: number, z: number): [number, number] => [
  O[0] + x * AX[0] + y * AY[0],
  O[1] + x * AX[1] + y * AY[1] - z,
];
const p = (x: number, y: number, z: number) =>
  pt(x, y, z)
    .map((v) => v.toFixed(1))
    .join(',');

/** Deterministic 0–1 noise, so the lights' timing is the same on every render. */
const rnd = (n: number) => {
  const s = Math.sin(n * 12.9898) * 43758.5453;
  return s - Math.floor(s);
};

// Two lights per rack, for both rows: [unit, kind]. 'blink' flickers like disk activity; 'breathe' fades slowly.
const LIGHTS: [number, 'blink' | 'breathe'][][] = Array.from({ length: 2 * N }, (_, i) => [
  [1 + Math.floor(rnd(i + 1) * 3), rnd(i + 11) > 0.5 ? 'blink' : 'breathe'],
  [4 + Math.floor(rnd(i + 21) * 3), rnd(i + 31) > 0.6 ? 'blink' : 'breathe'],
]);

/** One row of racks whose back face sits at depth y0 (0 for the front row). */
function Row({ y0, first }: { y0: number; first: number }) {
  const L = N * W;
  const q = (x: number, y: number, z: number) => p(x, y0 + y, z);
  return (
    <g>
      {/* Row volume: top, front, right end */}
      <polygon
        className="vol draw"
        pathLength={1}
        points={[q(0, 0, H), q(L, 0, H), q(L, D, H), q(0, D, H)].join(' ')}
      />
      <polygon
        className="vol draw"
        pathLength={1}
        points={[q(0, D, 0), q(L, D, 0), q(L, D, H), q(0, D, H)].join(' ')}
      />
      <polygon
        className="vol draw"
        pathLength={1}
        points={[q(L, D, 0), q(L, 0, 0), q(L, 0, H), q(L, D, H)].join(' ')}
      />
      {Array.from({ length: N }, (_, i) => (
        <g className="rack" key={i} style={{ '--i': first + i } as CSSProperties}>
          {/* Rack edges on the top and front */}
          {i ? <path className="edge" d={`M${q(i * W, 0, H)} L${q(i * W, D, H)} L${q(i * W, D, 0)}`} /> : null}
          {/* Door frame, then server units across the rack front */}
          <g className="units">
            <polygon
              points={[
                q(i * W + 3, D, 4),
                q((i + 1) * W - 3, D, 4),
                q((i + 1) * W - 3, D, H - 4),
                q(i * W + 3, D, H - 4),
              ].join(' ')}
            />
            {Array.from({ length: UNITS }, (_, k) => {
              const z = ((k + 1) * H) / (UNITS + 1);
              return <path key={k} d={`M${q(i * W + 6, D, z)} L${q((i + 1) * W - 6, D, z)}`} />;
            })}
          </g>
          {LIGHTS[(first + i) % LIGHTS.length].map(([k, kind], j) => {
            const [x, y] = pt(i * W + 7 + j * 4, y0 + D, (k * H) / (UNITS + 1) + 5);
            const n = (first + i) * 2 + j;
            return (
              <rect
                key={j}
                className={`light ${kind}`}
                x={x}
                y={y}
                width={3}
                height={3}
                style={{ '--d': `${-rnd(n + 41) * 4}s`, '--t': `${2.4 + rnd(n + 51) * 2.4}s` } as CSSProperties}
              />
            );
          })}
        </g>
      ))}
    </g>
  );
}

export function BannerArt() {
  return (
    <svg className="mk7-banner-art" viewBox="0 0 340 205" preserveAspectRatio="xMaxYMid meet" aria-hidden="true">
      {/* Back row first, so the front row's filled volumes cover it */}
      <Row y0={-(D + AISLE)} first={0} />
      <Row y0={0} first={N} />
    </svg>
  );
}
