// ─── Palette ────────────────────────────────────────────────────────────────
const C = {
  bg:          '#111111',
  dot:         '#f0dfc0',
  dotGlow:     'rgba(240,223,192,0.22)',
  dotSecondary:'rgba(240,223,192,0.35)',
  stroke:      '#ffffff',
  strokeMirror:'rgba(255,255,255,0.50)',
  guide:       'rgba(255,255,255,0.13)',
  kumkum:      '#e8732a',
  kumkumGlow:  'rgba(232,115,42,0.5)',
  startPulse:  'rgba(232,115,42,',
};

// ─── Patterns ────────────────────────────────────────────────────────────────
// Coords normalized 0–1 to the dot grid bounding box.
// (0,0) = top-left dot; (1,1) = bottom-right dot. Closed loops.
const PATTERNS = [
  {
    id: 'border_loop',
    nameEn: 'Simple Border',
    grid: { cols: 3, rows: 3 },
    symmetryAxes: 2,
    path: [
      {x: 0.0,  y:-0.28},
      {x: 0.5,  y:-0.38},
      {x: 1.0,  y:-0.28},
      {x: 1.28, y: 0.0 },
      {x: 1.38, y: 0.5 },
      {x: 1.28, y: 1.0 },
      {x: 1.0,  y: 1.28},
      {x: 0.5,  y: 1.38},
      {x: 0.0,  y: 1.28},
      {x:-0.28, y: 1.0 },
      {x:-0.38, y: 0.5 },
      {x:-0.28, y: 0.0 },
    ],
  },
  {
    id: 'figure_eight',
    nameEn: 'Figure Eight',
    grid: { cols: 3, rows: 3 },
    symmetryAxes: 2,
    path: [
      {x: 0.5,  y:-0.32},
      {x: 1.3,  y: 0.1 },
      {x: 1.3,  y: 0.9 },
      {x: 0.5,  y: 0.5 },
      {x:-0.3,  y: 0.9 },
      {x:-0.3,  y: 0.1 },
    ],
  },
  {
    id: 'four_petal',
    nameEn: 'Four Petal',
    grid: { cols: 3, rows: 3 },
    symmetryAxes: 4,
    path: [
      {x: 0.5,  y:-0.35},
      {x: 1.35, y: 0.0 },
      {x: 1.0,  y: 0.5 },
      {x: 1.35, y: 1.0 },
      {x: 0.5,  y: 1.35},
      {x: 0.0,  y: 1.0 },
      {x: 0.5,  y: 0.5 },
      {x: 0.0,  y: 0.0 },
    ],
  },
];

// ─── Config ──────────────────────────────────────────────────────────────────
const GRID_COLS      = 3;
const GRID_ROWS      = 3;
const DOT_RADIUS     = 5;
const STROKE_W       = 3.5;
const SNAP_STEP      = 4;   // px between interpolated snap path points
const SNAP_LOOKAHEAD = 80;  // max points to look ahead for nearest
const COMPLETE_THRESH = 10; // trigger completion when this many points from end
const DIR_LOCK_DIST  = 12;  // px the finger must travel before direction is locked

let SNAP_ENGAGE_RADIUS = 60; // computed from gridSpacing after resize

// ─── State ───────────────────────────────────────────────────────────────────
let canvas, ctx;
let canvasSize, gridSpacing, gridOriginX, gridOriginY;
let currentPattern = PATTERNS[0];

// Snap path — two versions (forward and reverse) starting at the same point.
// Direction is locked after the user's first meaningful movement.
let snapPathFwd  = [];  // canonical order
let snapPathRev  = [];  // reversed, same start point as fwd
let snapActive   = [];  // whichever direction was chosen
let snapDir      = null; // null | 'fwd' | 'rev'
let snapIndex    = 0;
let snappedStroke = [];

let isDrawing  = false;
let isComplete = false;
let touchCount = 0;
let animState  = null;

// ─── Setup ───────────────────────────────────────────────────────────────────
function init() {
  canvas = document.getElementById('game-canvas');
  ctx    = canvas.getContext('2d');

  resize();
  window.addEventListener('resize', resize);

  canvas.addEventListener('pointerdown',   onPointerDown,  { passive: false });
  canvas.addEventListener('pointermove',   onPointerMove,  { passive: false });
  canvas.addEventListener('pointerup',     onPointerUp,    { passive: false });
  canvas.addEventListener('pointercancel', onPointerUp,    { passive: false });

  const selector = document.getElementById('pattern-selector');
  PATTERNS.forEach((p, i) => {
    const card = document.createElement('div');
    card.className = 'pattern-card' + (i === 0 ? ' active' : '');

    const preview = document.createElement('canvas');
    preview.className = 'card-preview';
    preview.width = preview.height = 36;
    drawPatternPreview(preview.getContext('2d'), p, 36);

    const nameEl = document.createElement('div');
    nameEl.className = 'card-name';
    nameEl.textContent = p.nameEn;

    card.appendChild(preview);
    card.appendChild(nameEl);
    card.addEventListener('click', () => selectPattern(i));
    selector.appendChild(card);
  });

  document.getElementById('try-again-btn').addEventListener('click', resetLevel);
  requestAnimationFrame(loop);
}

function resize() {
  const maxCanvas = Math.min(window.innerWidth - 40, window.innerHeight - 230, 420);
  canvasSize  = Math.max(240, maxCanvas);
  gridSpacing = canvasSize / 4;
  gridOriginX = canvasSize / 2 - gridSpacing;
  gridOriginY = canvasSize / 2 - gridSpacing;

  SNAP_ENGAGE_RADIUS = gridSpacing * 0.55;

  canvas.width = canvas.height = canvasSize;
  canvas.style.width = canvas.style.height = canvasSize + 'px';

  buildSnapPathForCurrent();
}

// ─── Grid helpers ────────────────────────────────────────────────────────────
function dotPos(col, row) {
  return {
    x: gridOriginX + col * gridSpacing,
    y: gridOriginY + row * gridSpacing,
  };
}

function normToCanvas(nx, ny) {
  const span = (GRID_COLS - 1) * gridSpacing;
  return { x: gridOriginX + nx * span, y: gridOriginY + ny * span };
}

// ─── Snap path ────────────────────────────────────────────────────────────────
function buildSnapPath(pattern) {
  const waypoints = pattern.path.map(p => normToCanvas(p.x, p.y));
  const result = [];
  for (let i = 0; i < waypoints.length; i++) {
    const a = waypoints[i];
    const b = waypoints[(i + 1) % waypoints.length];
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const steps = Math.max(2, Math.ceil(Math.sqrt(dx*dx + dy*dy) / SNAP_STEP));
    for (let s = 0; s < steps; s++) {
      result.push({ x: a.x + dx * (s / steps), y: a.y + dy * (s / steps) });
    }
  }
  return result;
}

function buildSnapPathForCurrent() {
  if (!currentPattern) return;
  snapPathFwd = buildSnapPath(currentPattern);
  // Reversed path: same start point, direction reversed through the rest.
  // snapPathFwd[0] is the anchor. Reversing [1..end] traverses the loop
  // the other way while keeping the same starting position.
  snapPathRev = snapPathFwd.length > 1
    ? [snapPathFwd[0], ...snapPathFwd.slice(1).reverse()]
    : [...snapPathFwd];
  snapActive = snapPathFwd;
  snapDir    = null;
}

// Lock which direction the user is going on first meaningful movement.
// Compares user's movement vector to the forward path tangent at the start.
// Uses a point ~10 steps along the path for a stable tangent (not just [1]).
function detectDirection(rawPt) {
  const anchor     = snappedStroke[0];
  const moveDx     = rawPt.x - anchor.x;
  const moveDy     = rawPt.y - anchor.y;
  if (moveDx*moveDx + moveDy*moveDy < DIR_LOCK_DIST*DIR_LOCK_DIST) return false;

  const sample  = Math.min(10, snapPathFwd.length - 1);
  const fwdDx   = snapPathFwd[sample].x - snapPathFwd[0].x;
  const fwdDy   = snapPathFwd[sample].y - snapPathFwd[0].y;
  const dot     = moveDx * fwdDx + moveDy * fwdDy;

  snapDir    = dot >= 0 ? 'fwd' : 'rev';
  snapActive = snapDir === 'fwd' ? snapPathFwd : snapPathRev;
  snapIndex  = 0;
  return true;
}

function advanceSnap(rawPt) {
  if (isComplete) return;

  // Wait until direction is locked
  if (snapDir === null) {
    if (snappedStroke.length < 1) return;
    if (!detectDirection(rawPt)) return;
  }

  if (snapActive.length === 0) return;

  const lookEnd = Math.min(snapIndex + SNAP_LOOKAHEAD, snapActive.length - 1);
  let bestDist  = Infinity;
  let bestIdx   = -1;

  for (let i = snapIndex + 1; i <= lookEnd; i++) {
    const p  = snapActive[i];
    const dx = rawPt.x - p.x;
    const dy = rawPt.y - p.y;
    const d  = Math.sqrt(dx*dx + dy*dy);
    if (d < bestDist) { bestDist = d; bestIdx = i; }
  }

  if (bestIdx === -1 || bestDist > SNAP_ENGAGE_RADIUS) return;

  for (let i = snapIndex + 1; i <= bestIdx; i++) {
    snappedStroke.push(snapActive[i]);
  }
  snapIndex = bestIdx;

  if (snapIndex >= snapActive.length - COMPLETE_THRESH) {
    snappedStroke.push({ ...snapActive[0] });
    completeKolam();
  }
}

// ─── Pattern select & reset ───────────────────────────────────────────────────
function selectPattern(index) {
  currentPattern = PATTERNS[index];
  document.querySelectorAll('.pattern-card').forEach((c, i) =>
    c.classList.toggle('active', i === index));
  resetLevel();
}

function resetLevel() {
  snappedStroke = [];
  snapIndex     = 0;
  snapDir       = null;
  snapActive    = snapPathFwd;
  isDrawing     = false;
  isComplete    = false;
  touchCount    = 0;
  animState     = null;
  buildSnapPathForCurrent();
  document.getElementById('completion-overlay').classList.remove('visible');
}

// ─── Input ───────────────────────────────────────────────────────────────────
function canvasPoint(e) {
  const r = canvas.getBoundingClientRect();
  return {
    x: (e.clientX - r.left) * (canvas.width  / r.width),
    y: (e.clientY - r.top)  * (canvas.height / r.height),
  };
}

function onPointerDown(e) {
  e.preventDefault();
  if (isComplete) return;
  canvas.setPointerCapture(e.pointerId);
  isDrawing = true;
  touchCount++;
  if (snappedStroke.length === 0 && snapPathFwd.length > 0) {
    snappedStroke.push({ ...snapPathFwd[0] });
  }
}

function onPointerMove(e) {
  e.preventDefault();
  if (!isDrawing || isComplete) return;
  advanceSnap(canvasPoint(e));
}

function onPointerUp(e) {
  e.preventDefault();
  isDrawing = false;
}

// ─── Completion ───────────────────────────────────────────────────────────────
function completeKolam() {
  isDrawing  = false;
  isComplete = true;
  animState  = { startTime: performance.now(), phase: 'glow' };
}

// ─── Symmetry ────────────────────────────────────────────────────────────────
function mirrorPoints(pts, cx, cy) {
  const m = [
    pts.map(p => ({ x: p.x,        y: 2*cy - p.y })),
    pts.map(p => ({ x: 2*cx - p.x, y: p.y        })),
    pts.map(p => ({ x: 2*cx - p.x, y: 2*cy - p.y })),
  ];
  if (currentPattern.symmetryAxes === 4) {
    m.push(pts.map(p => ({ x: cx + (p.y-cy), y: cy + (p.x-cx) })));
    m.push(pts.map(p => ({ x: cx - (p.y-cy), y: cy - (p.x-cx) })));
    m.push(pts.map(p => ({ x: cx + (p.y-cy), y: cy - (p.x-cx) })));
    m.push(pts.map(p => ({ x: cx - (p.y-cy), y: cy + (p.x-cx) })));
  }
  return m;
}

// ─── Render helpers ───────────────────────────────────────────────────────────
function drawSmoothPath(pts, color, lineWidth, shadowColor, shadowBlur) {
  if (pts.length < 2) return;
  ctx.save();
  ctx.strokeStyle = color;
  ctx.lineWidth   = lineWidth;
  ctx.lineCap     = 'round';
  ctx.lineJoin    = 'round';
  if (shadowColor) {
    ctx.shadowColor = shadowColor;
    ctx.shadowBlur  = shadowBlur || 8;
  }
  ctx.beginPath();
  ctx.moveTo(pts[0].x, pts[0].y);
  for (let i = 1; i < pts.length - 1; i++) {
    const mx = (pts[i].x + pts[i+1].x) / 2;
    const my = (pts[i].y + pts[i+1].y) / 2;
    ctx.quadraticCurveTo(pts[i].x, pts[i].y, mx, my);
  }
  ctx.lineTo(pts[pts.length-1].x, pts[pts.length-1].y);
  ctx.stroke();
  ctx.restore();
}

function drawGuidePath() {
  if (snapPathFwd.length < 2) return;
  ctx.save();
  ctx.strokeStyle = C.guide;
  ctx.lineWidth   = 1.5;
  ctx.lineCap     = 'round';
  ctx.lineJoin    = 'round';
  ctx.setLineDash([5, 7]);
  ctx.beginPath();
  ctx.moveTo(snapPathFwd[0].x, snapPathFwd[0].y);
  for (let i = 1; i < snapPathFwd.length; i++) ctx.lineTo(snapPathFwd[i].x, snapPathFwd[i].y);
  ctx.closePath();
  ctx.stroke();
  ctx.restore();
}

// Secondary dots at each waypoint of the pattern — gives users visual anchors
// to understand where the path goes, since the path weaves outside the main grid.
function drawWaypointDots() {
  const pts = currentPattern.path.map(p => normToCanvas(p.x, p.y));
  pts.forEach(({ x, y }) => {
    ctx.beginPath();
    ctx.arc(x, y, 3, 0, 6.283);
    ctx.fillStyle = C.dotSecondary;
    ctx.fill();
  });
}

function drawDots() {
  for (let row = 0; row < GRID_ROWS; row++) {
    for (let col = 0; col < GRID_COLS; col++) {
      const { x, y } = dotPos(col, row);
      // Glow halo
      const grad = ctx.createRadialGradient(x, y, DOT_RADIUS * 0.4, x, y, DOT_RADIUS * 3);
      grad.addColorStop(0, C.dotGlow);
      grad.addColorStop(1, 'rgba(0,0,0,0)');
      ctx.beginPath();
      ctx.arc(x, y, DOT_RADIUS * 3, 0, 6.283);
      ctx.fillStyle = grad;
      ctx.fill();
      // Dot
      ctx.beginPath();
      ctx.arc(x, y, DOT_RADIUS, 0, 6.283);
      ctx.fillStyle = C.dot;
      ctx.fill();
    }
  }
}

// ─── Render loop ─────────────────────────────────────────────────────────────
function loop(ts) {
  ctx.fillStyle = C.bg;
  ctx.fillRect(0, 0, canvasSize, canvasSize);

  drawGuidePath();
  drawWaypointDots();
  drawDots();

  const cx = canvasSize / 2;
  const cy = canvasSize / 2;

  let strokeColor = C.stroke;
  let glowColor   = 'rgba(255,255,255,0.35)';
  let glowBlur    = 10;

  if (animState) {
    const t0 = ts - animState.startTime;
    if (t0 < 300) {
      const t = t0 / 300;
      strokeColor = lerpColor(C.stroke, C.kumkum, t);
      glowColor   = lerpColor('rgba(255,255,255,0.35)', C.kumkumGlow, t);
      glowBlur    = 10 + 18 * t;
    } else if (t0 < 700) {
      strokeColor = C.kumkum; glowColor = C.kumkumGlow; glowBlur = 28;
    } else if (t0 < 1100) {
      const t = (t0 - 700) / 400;
      strokeColor = lerpColor(C.kumkum, '#f0dfc0', t);
      glowColor   = lerpColor(C.kumkumGlow, 'rgba(240,223,192,0.22)', t);
      glowBlur    = 28 - 20 * t;
    } else {
      strokeColor = '#f0dfc0'; glowColor = 'rgba(240,223,192,0.22)'; glowBlur = 8;
      if (animState.phase !== 'done') {
        animState.phase = 'done';
        showCompletionOverlay();
      }
    }
  }

  if (snappedStroke.length > 1) {
    mirrorPoints(snappedStroke, cx, cy)
      .forEach(m => drawSmoothPath(m, C.strokeMirror, STROKE_W - 0.5, null, 0));
    drawSmoothPath(snappedStroke, strokeColor, STROKE_W, glowColor, glowBlur);
  }

  // Pulsing start ring — shown only before drawing begins
  if (snappedStroke.length === 0 && snapPathFwd.length > 0) {
    const sp    = snapPathFwd[0];
    const pulse = (Math.sin(ts / 450) + 1) / 2;
    ctx.save();
    ctx.beginPath();
    ctx.arc(sp.x, sp.y, 9 + pulse * 5, 0, 6.283);
    ctx.strokeStyle = `${C.startPulse}${(0.35 + pulse * 0.45).toFixed(2)})`;
    ctx.lineWidth = 2;
    ctx.stroke();
    ctx.restore();
  }

  requestAnimationFrame(loop);
}

// ─── Completion overlay ───────────────────────────────────────────────────────
function showCompletionOverlay() {
  document.getElementById('touch-count').textContent = touchCount;
  document.getElementById('completion-overlay').classList.add('visible');
}

// ─── Pattern card preview ─────────────────────────────────────────────────────
function drawPatternPreview(pctx, pattern, size) {
  const pad  = 7;
  const span = size - pad * 2;
  const cols = pattern.grid.cols;
  const rows = pattern.grid.rows;
  const spX  = span / (cols - 1);
  const spY  = span / (rows - 1);

  pctx.fillStyle = '#111111';
  pctx.fillRect(0, 0, size, size);

  const pts = pattern.path.map(p => ({ x: pad + p.x * span, y: pad + p.y * span }));
  pctx.strokeStyle = 'rgba(255,255,255,0.4)';
  pctx.lineWidth   = 1.5;
  pctx.lineCap     = pctx.lineJoin = 'round';
  pctx.beginPath();
  pctx.moveTo(pts[0].x, pts[0].y);
  pts.slice(1).forEach(p => pctx.lineTo(p.x, p.y));
  pctx.closePath();
  pctx.stroke();

  // Waypoint dots on preview
  pts.forEach(({ x, y }) => {
    pctx.beginPath();
    pctx.arc(x, y, 1.5, 0, 6.283);
    pctx.fillStyle = 'rgba(240,223,192,0.4)';
    pctx.fill();
  });

  // Main grid dots
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      pctx.beginPath();
      pctx.arc(pad + c * spX, pad + r * spY, 1.8, 0, 6.283);
      pctx.fillStyle = '#f0dfc0';
      pctx.fill();
    }
  }
}

// ─── Utility ─────────────────────────────────────────────────────────────────
function lerpColor(a, b, t) {
  const ca = parseColor(a), cb = parseColor(b);
  return `rgba(${Math.round(ca[0]+(cb[0]-ca[0])*t)},${Math.round(ca[1]+(cb[1]-ca[1])*t)},${Math.round(ca[2]+(cb[2]-ca[2])*t)},${(ca[3]+(cb[3]-ca[3])*t).toFixed(2)})`;
}

const _colorCache = {};
function parseColor(str) {
  if (_colorCache[str]) return _colorCache[str];
  if (str[0] === '#') {
    const n = parseInt(str.slice(1), 16);
    return (_colorCache[str] = [(n>>16)&255, (n>>8)&255, n&255, 1]);
  }
  const m = str.match(/rgba?\((\d+),\s*(\d+),\s*(\d+)(?:,\s*([\d.]+))?\)/);
  if (m) return (_colorCache[str] = [+m[1],+m[2],+m[3], m[4]!==undefined?+m[4]:1]);
  return (_colorCache[str] = [255,255,255,1]);
}

window.addEventListener('DOMContentLoaded', init);
