/* Halftone Pro - Shared math (ES3 compatible, safe for ExtendScript & CEF) */

function hmClamp(v, lo, hi) { return v < lo ? lo : (v > hi ? hi : v); }

function hmHexToRgb(hex) {
  if (typeof hex !== "string") return { r: 0, g: 0, b: 0 };
  hex = hex.replace("#", "");
  if (hex.length === 3) hex = hex.charAt(0)+hex.charAt(0)+hex.charAt(1)+hex.charAt(1)+hex.charAt(2)+hex.charAt(2);
  var n = parseInt(hex, 16);
  return { r: (n>>16)&255, g: (n>>8)&255, b: n&255 };
}

function hmRgbStr(r, g, b) { return "rgb("+Math.round(r)+","+Math.round(g)+","+Math.round(b)+")"; }

function hmLerpColor(c1, c2, t) {
  return {
    r: Math.round(c1.r + (c2.r - c1.r) * t),
    g: Math.round(c1.g + (c2.g - c1.g) * t),
    b: Math.round(c1.b + (c2.b - c1.b) * t)
  };
}

function hmLerp3Color(c1, c2, c3, t) {
  if (t < 0.5) return hmLerpColor(c1, c2, t * 2);
  return hmLerpColor(c2, c3, (t - 0.5) * 2);
}

/* Gradient direction: returns t in 0..1 given normalized coords 0..1 */
function hmGradientT(nx, ny, dir) {
  switch (dir) {
    case 0: return nx;                    // Horizontal L-R
    case 1: return 1 - nx;               // Horizontal R-L
    case 2: return ny;                    // Vertical T-B
    case 3: return 1 - ny;                // Vertical B-T
    case 4: return (nx + ny) / 2;         // Diagonal
    case 5: {                             // Radial outward
      var cx = nx - 0.5, cy = ny - 0.5;
      return Math.sqrt(cx*cx + cy*cy) * 1.4142135623730951;
    }
    default: return nx;
  }
}

/* Pick gradient color from 2 or 3 stops, returns {r,g,b} */
function hmGradientColor(nx, ny, dir, colors, grad3) {
  var s1 = hmHexToRgb(colors[0] || "#000000");
  var s2 = hmHexToRgb(colors[1] || "#1a1a1a");
  var t = hmGradientT(nx, ny, dir);
  t = hmClamp(t, 0, 1);
  if (grad3) {
    var s3 = hmHexToRgb(colors[2] || "#FFFFFF");
    return hmLerp3Color(s1, s2, s3, t);
  }
  return hmLerpColor(s1, s2, t);
}

/* Multi-color random pick from enabled slots */
function hmPickMultiColor(colors, colorEn) {
  var pool = [];
  for (var i = 0; i < 5; i++) {
    if (colorEn && colorEn[i]) pool.push(colors[i] || "#000000");
  }
  if (!pool.length) pool = [colors[0] || "#000000"];
  var hex = pool[Math.floor(Math.random() * pool.length)];
  return hmHexToRgb(hex);
}

/* Dot source luma: returns 0..1 (1=light) */
function hmDotLuma(nx, ny, src) {
  src = src || "uniform";
  var v = 1;
  if (src === "diagonal") {
    v = 1 - (nx + ny) / 2;
  } else if (src === "linear") {
    v = 1 - nx;
  } else if (src === "linear-rev") {
    v = nx;
  } else if (src === "radial") {
    var cx = nx - 0.5, cy = ny - 0.5;
    v = 1 - Math.sqrt(cx*cx + cy*cy) * 1.4142135623730951;
  } else if (src === "random") {
    v = Math.random();
  }
  v = hmClamp(v, 0, 1);
  return v;
}

/* Apply invert, gamma, midpoint adjustments */
function hmAdjustLuma(v, invert, gamma, midpoint) {
  if (invert) v = 1 - v;
  v = Math.pow(v, gamma !== undefined ? gamma : 1);
  var mp = midpoint !== undefined ? midpoint : 0.5;
  if (mp !== 0.5) {
    var e = Math.log(0.5) / Math.log(Math.max(0.01, Math.min(0.99, mp)));
    v = Math.pow(v, e);
  }
  return v;
}

/* Contain-offset grid coordinates for image luma/color grids */
function hmGridCoords(cols, rows, imgW, imgH, nx, ny) {
  var gx, gy;
  if (imgW && imgH) {
    var sc = Math.min(cols / imgW, rows / imgH);
    var dw = Math.round(imgW * sc);
    var dh = Math.round(imgH * sc);
    gx = Math.floor((cols - dw) / 2) + nx * (dw - 1);
    gy = Math.floor((rows - dh) / 2) + ny * (dh - 1);
  } else {
    gx = nx * (cols - 1);
    gy = ny * (rows - 1);
  }
  return { gx: gx, gy: gy };
}

/* Bilinear sample a 2D grid (array of arrays) at gx,gy */
function hmBilinearSample(grid, cols, rows, gx, gy) {
  var gx0 = Math.floor(gx), gy0 = Math.floor(gy);
  if (gx0 < 0) gx0 = 0;
  if (gy0 < 0) gy0 = 0;
  var gx1 = Math.min(gx0 + 1, cols - 1), gy1 = Math.min(gy0 + 1, rows - 1);
  var fx = gx - gx0, fy = gy - gy0;
  var v00 = grid[gy0][gx0], v10 = grid[gy0][gx1];
  var v01 = grid[gy1][gx0], v11 = grid[gy1][gx1];
  return v00 * (1-fx)*(1-fy) + v10 * fx*(1-fy) + v01 * (1-fx)*fy + v11 * fx*fy;
}

/* Image contain rect within a bounds */
function hmImageRect(L, T, R, B, imgW, imgH) {
  if (!imgW || !imgH) return null;
  var W = R - L, H = B - T;
  var scale = Math.min(W / imgW, H / imgH);
  var iw = imgW * scale, ih = imgH * scale;
  return { L: L + (W-iw)/2, T: T + (H-ih)/2, R: L + (W-iw)/2 + iw, B: T + (H-ih)/2 + ih, W: iw, H: ih };
}
