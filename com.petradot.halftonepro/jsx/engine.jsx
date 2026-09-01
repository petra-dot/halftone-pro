/**************************************************************************************************
 * Halftone Pro by Petra-dot v4.0 - ExtendScript (ES3) engine
 * Generates Illustrator vector halftone patterns.
 * Callable from JS via cs.evalScript().
 **************************************************************************************************/

// ====================== GLOBAL STATE ======================
// Load shared math (halftone-math.js from the js folder)
try {
  var _hmFile = new File((new File($.fileName)).parent + "/../js/halftone-math.js");
  if (_hmFile.exists) { $.evalFile(_hmFile); }
} catch (_hmE) { _log("hm load: " + _hmE.message); }

// Fallback: define hm* functions inline if halftone-math.js could not be loaded
if (typeof hmClamp === "undefined") {
  _log("halftone-math.js not found -- using inline fallback");
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
    return { r: Math.round(c1.r+(c2.r-c1.r)*t), g: Math.round(c1.g+(c2.g-c1.g)*t), b: Math.round(c1.b+(c2.b-c1.b)*t) };
  }
  function hmLerp3Color(c1, c2, c3, t) {
    if (t < 0.5) return hmLerpColor(c1, c2, t*2);
    return hmLerpColor(c2, c3, (t-0.5)*2);
  }
  function hmGradientT(nx, ny, dir) {
    switch (dir) {
      case 0: return nx;
      case 1: return 1 - nx;
      case 2: return ny;
      case 3: return 1 - ny;
      case 4: return (nx + ny) / 2;
      case 5: { var x = nx - 0.5, y = ny - 0.5; return Math.sqrt(x*x + y*y) * 1.4142135623730951; }
      default: return nx;
    }
  }
  function hmGradientColor(nx, ny, dir, colors, grad3) {
    var s1 = hmHexToRgb(colors[0] || "#000000");
    var s2 = hmHexToRgb(colors[1] || "#1a1a1a");
    var t = hmClamp(hmGradientT(nx, ny, dir), 0, 1);
    if (grad3) { var s3 = hmHexToRgb(colors[2] || "#FFFFFF"); return hmLerp3Color(s1, s2, s3, t); }
    return hmLerpColor(s1, s2, t);
  }
  function hmPickMultiColor(colors, colorEn) {
    var pool = [];
    for (var i = 0; i < 5; i++) { if (colorEn && colorEn[i]) pool.push(colors[i] || "#000000"); }
    if (!pool.length) pool = [colors[0] || "#000000"];
    return hmHexToRgb(pool[Math.floor(Math.random() * pool.length)]);
  }
  function hmDotLuma(nx, ny, src) {
    src = src || "uniform";
    var v = 1;
    if (src === "diagonal") { v = 1 - (nx + ny) / 2; }
    else if (src === "linear") { v = 1 - nx; }
    else if (src === "linear-rev") { v = nx; }
    else if (src === "radial") { var x2 = nx-0.5, y2 = ny-0.5; v = 1 - Math.sqrt(x2*x2+y2*y2)*1.4142135623730951; }
    else if (src === "random") { v = Math.random(); }
    return hmClamp(v, 0, 1);
  }
  function hmAdjustLuma(v, invert, gamma, midpoint) {
    if (invert) v = 1 - v;
    v = Math.pow(v, gamma !== undefined ? gamma : 1);
    var mp = midpoint !== undefined ? midpoint : 0.5;
    if (mp !== 0.5) { var e = Math.log(0.5) / Math.log(Math.max(0.01, Math.min(0.99, mp))); v = Math.pow(v, e); }
    return v;
  }
  function hmGridCoords(cols, rows, imgW, imgH, nx, ny) {
    if (imgW && imgH) {
      var sc = Math.min(cols / imgW, rows / imgH);
      var dw = Math.round(imgW * sc), dh = Math.round(imgH * sc);
      return { gx: Math.floor((cols-dw)/2)+nx*(dw-1), gy: Math.floor((rows-dh)/2)+ny*(dh-1) };
    }
    return { gx: nx*(cols-1), gy: ny*(rows-1) };
  }
  function hmBilinearSample(grid, cols, rows, gx, gy) {
    var gx0 = Math.floor(gx), gy0 = Math.floor(gy);
    if (gx0 < 0) gx0 = 0; if (gy0 < 0) gy0 = 0;
    var gx1 = Math.min(gx0+1, cols-1), gy1 = Math.min(gy0+1, rows-1);
    var fx = gx - gx0, fy = gy - gy0;
    var v00 = grid[gy0][gx0], v10 = grid[gy0][gx1], v01 = grid[gy1][gx0], v11 = grid[gy1][gx1];
    return v00*(1-fx)*(1-fy) + v10*fx*(1-fy) + v01*(1-fx)*fy + v11*fx*fy;
  }
  function hmImageRect(L, T, R, B, imgW, imgH) {
    if (!imgW || !imgH) return null;
    var scale = Math.min((R-L)/imgW, (B-T)/imgH);
    var iw = imgW*scale, ih = imgH*scale;
    return { L: L+(R-L-iw)/2, T: T+(B-T-ih)/2, R: L+(R-L-iw)/2+iw, B: T+(B-T-ih)/2+ih, W: iw, H: ih };
  }
}

var G_IMG_LUMA = null;   // 2D array [rows][cols] of 0..1 when image tab
var G_IMG_COLORS = null; // 2D array [rows][cols] of [r,g,b] 0..255
var G_CUSTOM_PTS = null; // array of {x,y} in -0.5..0.5
var G_HP_JSON = null;    // holds JSON string across suspendHistory calls
var G_PLACE_IMAGE = null; // { mime, data } for placeImage feature

// ====================== UTILITIES ======================
function _log(s) {
  try { $.writeln("[HalftonePro] " + s); } catch (e) {}
}

function _chr(v) { return String.fromCharCode(v); }

var _RGX = {_trim: /^\s+|\s+$/g};

function _parseJSON(str) {
  if (str === null || str === undefined || str === "") return null;
  if (typeof str !== "string") return str;
  try {
    var pos = 0;
    function skipWS() { while (pos < str.length && (str[pos] === ' ' || str[pos] === '\t' || str[pos] === '\n' || str[pos] === '\r')) pos++; }
    function peek() { skipWS(); return pos < str.length ? str[pos] : ''; }
    function consume(ch) { skipWS(); if (pos < str.length && str[pos] === ch) { pos++; return true; } return false; }
    function expect(ch) { skipWS(); if (pos >= str.length || str[pos] !== ch) throw new Error("Expected '" + ch + "' at " + pos); pos++; }
    function parseVal() {
      skipWS();
      if (pos >= str.length) throw new Error("Unexpected end");
      var c = str[pos];
      if (c === '"') return parseStr();
      if (c === '{') return parseObj();
      if (c === '[') return parseArr();
      if (c === 't' && str.substr(pos, 4) === 'true') { pos += 4; return true; }
      if (c === 'f' && str.substr(pos, 5) === 'false') { pos += 5; return false; }
      if (c === 'n' && str.substr(pos, 4) === 'null') { pos += 4; return null; }
      if (c === '-' || (c >= '0' && c <= '9')) return parseNum();
      throw new Error("Unexpected char '" + c + "' at " + pos);
    }
    function parseStr() {
      pos++; // skip opening "
      var out = "";
      while (pos < str.length) {
        var c = str[pos];
        if (c === '"') { pos++; return out; }
        if (c === '\\') {
          pos++;
          if (pos >= str.length) throw new Error("Truncated escape");
          var esc = str[pos];
          if (esc === '"') out += '"';
          else if (esc === '\\') out += '\\';
          else if (esc === '/') out += '/';
          else if (esc === 'b') out += '\b';
          else if (esc === 'f') out += '\f';
          else if (esc === 'n') out += '\n';
          else if (esc === 'r') out += '\r';
          else if (esc === 't') out += '\t';
          else if (esc === 'u') {
            if (pos + 4 >= str.length) throw new Error("Truncated unicode escape");
            var hex = str.substr(pos+1, 4);
            out += String.fromCharCode(parseInt(hex, 16));
            pos += 4;
          } else out += esc;
          pos++;
        } else {
          out += c;
          pos++;
        }
      }
      throw new Error("Unterminated string");
    }
    function parseNum() {
      var start = pos;
      if (str[pos] === '-') pos++;
      while (pos < str.length && str[pos] >= '0' && str[pos] <= '9') pos++;
      if (pos < str.length && str[pos] === '.') {
        pos++;
        while (pos < str.length && str[pos] >= '0' && str[pos] <= '9') pos++;
      }
      if (pos < str.length && (str[pos] === 'e' || str[pos] === 'E')) {
        pos++;
        if (pos < str.length && (str[pos] === '+' || str[pos] === '-')) pos++;
        while (pos < str.length && str[pos] >= '0' && str[pos] <= '9') pos++;
      }
      return parseFloat(str.substring(start, pos));
    }
    function parseArr() {
      pos++; // skip [
      var arr = [];
      if (consume(']')) return arr;
      while (true) {
        arr.push(parseVal());
        if (consume(']')) return arr;
        expect(',');
      }
    }
    function parseObj() {
      pos++; // skip {
      var obj = {};
      if (consume('}')) return obj;
      while (true) {
        var key = parseStr();
        expect(':');
        obj[key] = parseVal();
        if (consume('}')) return obj;
        expect(',');
      }
    }
    return parseVal();
  } catch (e) {
    _log("parseJSON failed: " + e.message + ", str=" + str.substring(0, 80));
    return null;
  }
}

function _stringify(obj) {
  var t = typeof obj;
  if (obj === null) return "null";
  if (t === "number") return (isFinite(obj)) ? ("" + obj) : "null";
  if (t === "boolean") return obj ? "true" : "false";
  if (t === "string") {
    var escaped = obj.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\n/g, "\\n").replace(/\r/g, "\\r").replace(/\t/g, "\\t");
    return '"' + escaped + '"';
  }
  if (obj instanceof Array) {
    var out = "[";
    for (var i = 0; i < obj.length; i++) {
      if (i > 0) out += ",";
      out += _stringify(obj[i]);
    }
    return out + "]";
  }
  // object
  var out2 = "{";
  var first = true;
  for (var k in obj) {
    if (!obj.hasOwnProperty || obj.hasOwnProperty(k)) {
      if (!first) out2 += ",";
      out2 += _stringify(k) + ":" + _stringify(obj[k]);
      first = false;
    }
  }
  return out2 + "}";
}

function _hexToRGB(hex) {
  var c = hmHexToRgb(hex);
  var rgb = new RGBColor();
  rgb.red = c.r; rgb.green = c.g; rgb.blue = c.b;
  return rgb;
}

function _rand(min, max) { return min + Math.random() * (max - min); }

// ====================== BOUNDS ======================
function _getBounds(doc, sel) {
  var L, T, B, R;
  if (sel && sel.length > 0) {
    try {
      var gb = sel[0].geometricBounds;
      L = gb[0]; T = gb[1]; R = gb[2]; B = gb[3];
      for (var i = 1; i < sel.length; i++) {
        var g = sel[i].geometricBounds;
        if (g[0] < L) L = g[0];
        if (g[1] > T) T = g[1];
        if (g[2] > R) R = g[2];
        if (g[3] < B) B = g[3];
      }
    } catch (e) { _log("bounds from sel failed: " + e.message); }
  }
  if (L === undefined) {
    // artboard fallback
    var ab = doc.artboards[doc.artboards.getActiveArtboardIndex()];
    var r = ab.artboardRect;
    L = r[0]; T = r[1]; R = r[2]; B = r[3];
  }
  // Normalise to Y-down (T < B) so every consumer uses the same
  // coordinate system as the preview — no silent ny inversion.
  var Tn = Math.min(T, B);
  var Bn = Math.max(T, B);
  var hasSelection = !!(sel && sel.length > 0);
  return { L: L, T: Tn, R: R, B: Bn, W: R - L, H: Bn - Tn, src: sel, hasSelection: hasSelection };
}

// ====================== COLOR SYSTEM ======================
function _pickColor(cfg, wx, wy, bounds) {
  var mode = cfg.cMode || 0;
  if (mode === 3) {
    if (G_IMG_COLORS) {
      var nx = bounds.W ? (wx - bounds.L) / bounds.W : 0.5;
      var ny = bounds.H ? (bounds.B - wy) / bounds.H : 0.5;
      nx = hmClamp(nx, 0, 1);
      ny = hmClamp(ny, 0, 1);
      var cols = G_IMG_COLORS[0].length, rows = G_IMG_COLORS.length;
      var gc = hmGridCoords(cols, rows, cfg.imgLoadW, cfg.imgLoadH, nx, ny);
      var gx = gc.gx, gy = gc.gy;
      var gx0 = Math.floor(gx), gy0 = Math.floor(gy);
      if (gx0 < 0) gx0 = 0;
      if (gy0 < 0) gy0 = 0;
      var gx1 = Math.min(gx0 + 1, cols - 1), gy1 = Math.min(gy0 + 1, rows - 1);
      var fx = gx - gx0, fy = gy - gy0;
      var c00 = G_IMG_COLORS[gy0][gx0], c10 = G_IMG_COLORS[gy0][gx1];
      var c01 = G_IMG_COLORS[gy1][gx0], c11 = G_IMG_COLORS[gy1][gx1];
      var cr = Math.round(c00[0]*(1-fx)*(1-fy) + c10[0]*fx*(1-fy) + c01[0]*(1-fx)*fy + c11[0]*fx*fy);
      var cg = Math.round(c00[1]*(1-fx)*(1-fy) + c10[1]*fx*(1-fy) + c01[1]*(1-fx)*fy + c11[1]*fx*fy);
      var cb = Math.round(c00[2]*(1-fx)*(1-fy) + c10[2]*fx*(1-fy) + c01[2]*(1-fx)*fy + c11[2]*fx*fy);
      var c3 = new RGBColor();
      c3.red = hmClamp(cr, 0, 255);
      c3.green = hmClamp(cg, 0, 255);
      c3.blue = hmClamp(cb, 0, 255);
      return c3;
    }
    return _hexToRGB(cfg.colors && cfg.colors[0]);
  }
  if (mode === 0) {
    return _hexToRGB(cfg.colors && cfg.colors[0]);
  } else if (mode === 1) {
    var c1 = hmPickMultiColor(cfg.colors, cfg.colorEn);
    var rgb1 = new RGBColor();
    rgb1.red = c1.r; rgb1.green = c1.g; rgb1.blue = c1.b;
    return rgb1;
  } else {
    var nx2 = (bounds.W > 0) ? (wx - bounds.L) / bounds.W : 0.5;
    var ny2 = (bounds.H > 0) ? (bounds.B - wy) / bounds.H : 0.5;
    nx2 = hmClamp(nx2, 0, 1);
    ny2 = hmClamp(ny2, 0, 1);
    var c2 = hmGradientColor(nx2, ny2, cfg.gradDir || 0, cfg.colors, cfg.grad3);
    var rgb2 = new RGBColor();
    rgb2.red = c2.r; rgb2.green = c2.g; rgb2.blue = c2.b;
    return rgb2;
  }
}

// ====================== LUMA SYSTEM ======================
function _getLuma(cfg, wx, wy, bounds, srcOverride) {
  var nx = (bounds.W > 0) ? (wx - bounds.L) / bounds.W : 0.5;
  var ny = (bounds.H > 0) ? (bounds.B - wy) / bounds.H : 0.5;
  nx = hmClamp(nx, 0, 1);
  ny = hmClamp(ny, 0, 1);
  var src = srcOverride || cfg.dotSource || "uniform";
  var v = 1;
  if (src === "image" && G_IMG_LUMA) {
    var cols = G_IMG_LUMA[0].length, rows = G_IMG_LUMA.length;
    var gc = hmGridCoords(cols, rows, cfg.imgLoadW, cfg.imgLoadH, nx, ny);
    v = hmBilinearSample(G_IMG_LUMA, cols, rows, gc.gx, gc.gy) / 255;
  } else {
    v = hmDotLuma(nx, ny, src);
  }
  v = hmAdjustLuma(v, cfg.invert, cfg.gamma, cfg.midpoint);
  return v;
}

// ====================== SHAPE PRIMITIVES ======================
function _shapeCircle(doc, parent, x, y, r) {
  var item = parent.pathItems.ellipse(y + r, x - r, r * 2, r * 2);
  return item;
}

function _shapeSquare(doc, parent, x, y, r) {
  var item = parent.pathItems.rectangle(y + r, x - r, r * 2, r * 2);
  return item;
}

function _shapeTriangle(doc, parent, x, y, r) {
  var h = r * 1.1547005383792515;
  var pts = [
    [x, y + h],
    [x + r, y - h * 0.5],
    [x - r, y - h * 0.5]
  ];
  // pathItems.add expects [left,top,right,bottom] or use entire path
  var pi = parent.pathItems.add();
  pi.setEntirePath(pts);
  return pi;
}

function _shapeHexagon(doc, parent, x, y, r) {
  var pts = [];
  for (var i = 0; i < 6; i++) {
    var a = (i * 60 + 30) * Math.PI / 180;
    pts.push([x + Math.cos(a) * r, y + Math.sin(a) * r]);
  }
  var pi = parent.pathItems.add();
  pi.setEntirePath(pts);
  return pi;
}

function _shapeDiamond(doc, parent, x, y, r) {
  var pts = [
    [x, y + r],
    [x + r, y],
    [x, y - r],
    [x - r, y]
  ];
  var pi = parent.pathItems.add();
  pi.setEntirePath(pts);
  return pi;
}

function _shapeCustom(doc, parent, x, y, r) {
  if (!G_CUSTOM_PTS || !G_CUSTOM_PTS.length) return _shapeCircle(doc, parent, x, y, r);
  var pts = [];
  for (var i = 0; i < G_CUSTOM_PTS.length; i++) {
    var p = G_CUSTOM_PTS[i];
    pts.push([x + p.x * r * 2, y + p.y * r * 2]);
  }
  var pi = parent.pathItems.add();
  pi.setEntirePath(pts);
  return pi;
}

function _makeShape(doc, parent, kind, x, y, r) {
  switch (kind) {
    case "square":   return _shapeSquare(doc, parent, x, y, r);
    case "triangle": return _shapeTriangle(doc, parent, x, y, r);
    case "hexagon":  return _shapeHexagon(doc, parent, x, y, r);
    case "diamond":  return _shapeDiamond(doc, parent, x, y, r);
    case "custom":   return _shapeCustom(doc, parent, x, y, r);
    case "circle":
    default:          return _shapeCircle(doc, parent, x, y, r);
  }
}

// ====================== DYNAMICS ======================
function _applyDynamics(cfg, item, doc) {
  if (cfg.randRot) {
    var ang = _rand(cfg.rotMin || 0, cfg.rotMax || 360);
    item.rotate(ang, true, true, true, true, Transformation.CENTER, false);
  }
  if (cfg.flipH) item.transform(app.getScaleMatrix(-100, 100), true, false, false, false, false, Transformation.CENTER);
  if (cfg.flipV) item.transform(app.getScaleMatrix(100, -100), true, false, false, false, false, Transformation.CENTER);
  if (cfg.randOpa) {
    var o = _rand(cfg.opaMin, cfg.opaMax) / 100;
    item.opacity = hmClamp(o * 100, 0, 100);
  } else {
    item.opacity = hmClamp(cfg.opacity, 0, 100);
  }
}

// ====================== BLEND MODE ======================
function _applyBlend(cfg, item) {
  var map = {
    "normal":   BlendModes.NORMAL,
    "multiply": BlendModes.MULTIPLY,
    "screen":   BlendModes.SCREEN,
    "overlay":  BlendModes.OVERLAY,
    "softLight": BlendModes.SOFTLIGHT,
    "hardLight": BlendModes.HARDLIGHT,
    "darken":   BlendModes.DARKEN,
    "lighten":  BlendModes.LIGHTEN
  };
  var bm = map[cfg.blend];
  if (bm !== undefined) item.blendingMode = bm;
}

// ====================== SPOTS / STIPPLE / IMAGE ENGINE ======================
function _runSpots(cfg) {
  var doc = app.activeDocument;
  var bounds = _getBounds(doc, (app.selection && app.selection.length) ? app.selection : null);
  var L = bounds.L, T = bounds.T, R = bounds.R, B = bounds.B;
  var W = bounds.W, H = bounds.H;

  // Image tab: restrict dots to a "contain" rectangle preserving the
  // image's aspect ratio — no stretching or cropping.
  var imgRect = null;
  if (cfg.tab === 3 && cfg.imgLoadW && cfg.imgLoadH && W > 0 && H > 0) {
    imgRect = hmImageRect(L, T, R, B, cfg.imgLoadW, cfg.imgLoadH);
    if (imgRect) {
      L = imgRect.L; T = imgRect.T; R = imgRect.R; B = imgRect.B;
      W = imgRect.W; H = imgRect.H;
      bounds = imgRect;
    }
  }

  var cell = Math.max(1, cfg.cell);
  var gap = (cfg.gap || 0) / 100;
  var angle = (cfg.angle || 0) * Math.PI / 180;
  var cos = Math.cos(angle), sin = Math.sin(angle);
  var half = cell / 2;
  var gapScale = 1 - gap;
  var scatterAmt = (cfg.scatter || 0) / 100;

  var diag = Math.sqrt(W * W + H * H) / 2 + cell;
  var n = Math.ceil(diag / cell) + 1;

  // Limit total dots to avoid hanging Illustrator on large artboards
  var MAX_DOTS = (cfg.tab === 3) ? 100000 : 200000;
  var nSq = (2 * n + 1) * (2 * n + 1);
  if (nSq > MAX_DOTS) {
    var diagLen = Math.sqrt(W * W + H * H);
    var needed = Math.ceil(diagLen / (Math.sqrt(MAX_DOTS) - 1));
    cell = Math.max(cell, needed);
    half = cell / 2;
    diag = Math.sqrt(W * W + H * H) / 2 + cell;
    n = Math.ceil(diag / cell) + 1;
    _log("Auto-adjusted cell from " + cfg.cell + " to " + cell + " (tab " + cfg.tab + ", ~" + nSq + " -> ~" + ((2*n+1)*(2*n+1)) + " dots)");
  }
  var cx = (L + R) / 2, cy = (T + B) / 2;

  // New layer at top of layer stack
  var newLayer = doc.layers.add();
  newLayer.name = "Halftone Pro";

  var parent = newLayer;
  if (cfg.groupShapes) {
    parent = newLayer.groupItems.add();
    parent.name = "Halftone Shapes";
  }

  var count = 0;
  var shape = cfg.shape || "circle";
  if (shape === "custom" && !G_CUSTOM_PTS) shape = "circle";

  for (var gx = -n; gx <= n; gx++) {
    for (var gy = -n; gy <= n; gy++) {
      var ox = gx * cell;
      var oy = gy * cell;
      if (scatterAmt > 0) {
        ox += _rand(-scatterAmt, scatterAmt) * cell;
        oy += _rand(-scatterAmt, scatterAmt) * cell;
      }
      var wx = cx + ox * cos - oy * sin;
      var wy = cy + ox * sin + oy * cos;
      // cull if centre not strictly inside bounds
      if (!(wx > L && wx < R && wy > T && wy < B)) continue;
      var luma = _getLuma(cfg, wx, wy, bounds);
      var scBase = (cfg.minScale + (1 - luma) * (cfg.maxScale - cfg.minScale)) / 100;
      if (cfg.randSize) scBase *= _rand(0.5, 1.5);
      var r = half * scBase * gapScale;
      if (r < 0.05) continue;
      var item = _makeShape(doc, parent, shape, wx, wy, r);
      // fill color
      var c = _pickColor(cfg, wx, wy, bounds);
      item.filled = true;
      item.fillColor = c;
      item.stroked = false;
      _applyDynamics(cfg, item, doc);
      _applyBlend(cfg, item);
      count++;
    }
  }

  return { count: count, bounds: bounds, newLayer: newLayer, group: parent };
}

// ====================== LINES ENGINE ======================
function _runLines(cfg) {
  var doc = app.activeDocument;
  var bounds = _getBounds(doc, (app.selection && app.selection.length) ? app.selection : null);
  var L = bounds.L, T = bounds.T, R = bounds.R, B = bounds.B;
  var W = bounds.W, H = bounds.H;

  var spacing = Math.max(1, cfg.lineSpacing || 8);
  var angle = (cfg.lineAngle || 0) * Math.PI / 180;
  var wMin = cfg.lineW || 0.5;
  var wMax = cfg.lineWMax || 3;
  var mode = cfg.lineMode || "straight";
  var passes = (mode === "cross") ? (cfg.wavyPasses || 2) : 1;
  var cx = (L + R) / 2, cy = (T + B) / 2;
  var diag = Math.sqrt(W * W + H * H) / 2 + spacing * 2;
  var numLines = Math.ceil(diag / spacing);

  // Limit total lines to avoid hanging Illustrator on large artboards
  var totalLinesEst = passes * (2 * numLines + 1);
  var MAX_LINES = 30000;
  if (totalLinesEst > MAX_LINES) {
    var needed = Math.ceil(passes * (2 * (Math.sqrt(W * W + H * H) / 2 + spacing * 2) / spacing + 1) / MAX_LINES);
    spacing = Math.max(spacing, needed);
    diag = Math.sqrt(W * W + H * H) / 2 + spacing * 2;
    numLines = Math.ceil(diag / spacing);
    _log("Auto-adjusted lineSpacing from " + cfg.lineSpacing + " to " + spacing + " (tab 1, ~" + totalLinesEst + " -> ~" + (passes * (2 * numLines + 1)) + " lines)");
  }

  var newLayer = doc.layers.add();
  newLayer.name = "Halftone Pro Lines";

  var parent = newLayer;
  if (cfg.groupShapes) {
    parent = newLayer.groupItems.add();
    parent.name = "Halftone Lines";
  }

  var count = 0;
  for (var p = 0; p < passes; p++) {
    var passAng = angle + (p * (cfg.passAngle || 0)) * Math.PI / 180;
    var dx = Math.cos(passAng), dy = Math.sin(passAng);
    var px2 = -Math.sin(passAng), py2 = Math.cos(passAng);
    var passSrc = (cfg.crossSources && cfg.crossSources[p]) || undefined;
    var isPerp = (passSrc === "perp" || passSrc === "perp-rev");
    var waveSrc = isPerp ? undefined : passSrc;
    var isWavy = (mode !== "straight");
    var freq = cfg.wavyFreq || 4;
    var amp = cfg.wavyAmp || 18;

    for (var i = -numLines; i <= numLines; i++) {
      var off = i * spacing;
      var startPt = [cx + px2 * off - dx * diag, cy + py2 * off - dy * diag];
      var endPt   = [cx + px2 * off + dx * diag, cy + py2 * off + dy * diag];

      var midX = (startPt[0] + endPt[0]) / 2;
      var midY = (startPt[1] + endPt[1]) / 2;

      if (isPerp) {
        var t = Math.max(0, Math.min(1, (midY - bounds.T) / (bounds.B - bounds.T)));
        var perpW = wMin + (passSrc === "perp-rev" ? 1 - t : t) * (wMax - wMin);
        if (cfg.randSize) perpW *= _rand(0.5, 1.5);
        var pi = parent.pathItems.add();
        pi.setEntirePath([startPt, endPt]);
        pi.filled = false;
        pi.stroked = true;
        pi.strokeWidth = Math.max(0.25, perpW);
        try { pi.strokeCap = StrokeCap.ROUNDENDCAP; } catch (e) {}
        try { pi.strokeJoin = StrokeJoin.ROUNDJOIN; } catch (e) {}
        var c = _pickColor(cfg, midX, midY, bounds);
        var sc = new RGBColor();
        sc.red = (c && c.red !== undefined) ? c.red : 0;
        sc.green = (c && c.green !== undefined) ? c.green : 0;
        sc.blue = (c && c.blue !== undefined) ? c.blue : 0;
        pi.strokeColor = sc;
        _applyDynamics(cfg, pi, doc);
        _applyBlend(cfg, pi);
        count++;
        continue;
      }

      // Compute line width from vertical position
      var t = Math.max(0, Math.min(1, (midY - bounds.T) / (bounds.B - bounds.T)));
      var w = wMin + t * (wMax - wMin);
      if (cfg.randSize) w *= _rand(0.5, 1.5);
      w = Math.max(0.25, w);

      // Build path (wavy or straight)
      var pts;
      if (isWavy) {
        pts = [];
        var wavyPts = Math.max(20, Math.round(freq * 10));
        for (var s = 0; s <= wavyPts; s++) {
          var t2 = s / wavyPts;
          var bx = startPt[0] + (endPt[0] - startPt[0]) * t2;
          var by = startPt[1] + (endPt[1] - startPt[1]) * t2;
          var lumaW = _getLuma(cfg, bx, by, bounds, waveSrc);
          var wave = Math.sin(t2 * 2 * Math.PI * freq) * amp * (1 - lumaW);
          bx += -dy * wave;
          by += dx * wave;
          pts.push([bx, by]);
        }
      } else {
        pts = [startPt, endPt];
      }

      // Scatter offset (whole-line shift)
      var scAmt = (cfg.scatter || 0) / 100;
      if (scAmt > 0) {
        var scOff = _rand(-scAmt * spacing, scAmt * spacing);
        var scOffX = -dy * scOff, scOffY = dx * scOff;
        for (var s2 = 0; s2 < pts.length; s2++) {
          pts[s2][0] += scOffX;
          pts[s2][1] += scOffY;
        }
      }

      var pi = parent.pathItems.add();
      pi.filled = false;
      pi.stroked = true;
      pi.strokeWidth = w;
      try { pi.strokeCap = StrokeCap.ROUNDENDCAP; } catch (e) {}
      try { pi.strokeJoin = StrokeJoin.ROUNDJOIN; } catch (e) {}
      if (pts.length > 2) {
        var n2 = pts.length;
        for (var k = 0; k < n2; k++) {
          var pt = pts[k];
          var pti = pi.pathPoints.add();
          pti.anchor = pt;
          if (k === 0) {
            pti.leftDirection = pt;
            pti.rightDirection = [pt[0] + (pts[1][0] - pt[0]) / 6, pt[1] + (pts[1][1] - pt[1]) / 6];
          } else if (k === n2 - 1) {
            pti.leftDirection = [pt[0] - (pt[0] - pts[n2-2][0]) / 6, pt[1] - (pt[1] - pts[n2-2][1]) / 6];
            pti.rightDirection = pt;
          } else {
            var dx1 = (pts[k+1][0] - pts[k-1][0]) / 6, dy1 = (pts[k+1][1] - pts[k-1][1]) / 6;
            pti.leftDirection = [pt[0] - dx1, pt[1] - dy1];
            pti.rightDirection = [pt[0] + dx1, pt[1] + dy1];
          }
          pti.pointType = PointType.CORNER;
        }
      } else {
        pi.setEntirePath(pts);
      }
      var c = _pickColor(cfg, midX, midY, bounds);
      var sc = new RGBColor();
      sc.red = (c && c.red !== undefined) ? c.red : 0;
      sc.green = (c && c.green !== undefined) ? c.green : 0;
      sc.blue = (c && c.blue !== undefined) ? c.blue : 0;
      pi.strokeColor = sc;
      _applyDynamics(cfg, pi, doc);
      _applyBlend(cfg, pi);
      count++;
    }
  }

  return { count: count, bounds: bounds, newLayer: newLayer, group: parent };
}

// ====================== CLIP MASK ======================
function _applyClipMask(doc, result, cfg, bounds, clipPaths) {
  if (!cfg.clipMask) return;
  try {
    var maskParent = result.group || result.newLayer;
    if (clipPaths && clipPaths.length > 0) {
      // Move clip paths to FRONT (PLACEATBEGINNING) of the group —
      // Illustrator requires the mask path to be the first (topmost) item.
      for (var i = 0; i < clipPaths.length; i++) {
        clipPaths[i].filled = false;
        clipPaths[i].stroked = false;
        clipPaths[i].move(maskParent, ElementPlacement.PLACEATBEGINNING);
        clipPaths[i].clipping = true;
      }
      // Mark the group as clipped — this activates the clipping mask
      if (maskParent.typename === "GroupItem") {
        maskParent.clipped = true;
      }
    } else {
      // Fallback: rectangular clip from bounds
      var rect = maskParent.pathItems.rectangle(
        bounds.T, bounds.L, bounds.W, bounds.H
      );
      rect.filled = false;
      rect.stroked = false;
      rect.move(maskParent, ElementPlacement.PLACEATBEGINNING);
      rect.clipping = true;
      if (maskParent.typename === "GroupItem") {
        maskParent.clipped = true;
      }
    }
  } catch (e) { _log("clipMask failed: " + e.message); }
}

// ====================== PLACE SOURCE IMAGE ======================
function _placeImage(cfg, result) {
  if (!G_PLACE_IMAGE) return;
  var mime = G_PLACE_IMAGE.mime;
  var b64 = G_PLACE_IMAGE.data;
  if (!b64) return;

  var ext = "png";
  if (mime === "image/jpeg" || mime === "image/jpg") ext = "jpg";
  else if (mime === "image/gif") ext = "gif";
  else if (mime === "image/webp") ext = "webp";
  else if (mime === "image/bmp") ext = "bmp";

  // Decode base64 and write to temp file
  var chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  var tempFile = new File(Folder.temp.fsName + "/hp-place." + ext);
  tempFile.encoding = "binary";
  tempFile.open("w");
  var buffer = 0, bits = 0;
  for (var i = 0; i < b64.length; i++) {
    var c = b64.charAt(i);
    if (c === "=") break;
    var idx = chars.indexOf(c);
    if (idx < 0) continue;
    buffer = (buffer << 6) | idx;
    bits += 6;
    if (bits >= 8) {
      bits -= 8;
      tempFile.write(String.fromCharCode((buffer >> bits) & 0xFF));
    }
  }
  tempFile.close();

  // Place in document
  var doc = app.activeDocument;
  var pl = doc.placedItems.add();
  pl.file = tempFile;

  // Scale to fit bounds preserving aspect ratio
  var b = result.bounds;
  var iw = cfg.imgLoadW || pl.width, ih = cfg.imgLoadH || pl.height;
  var ib = hmImageRect(b.L, b.T, b.R, b.B, iw, ih);
  if (ib) {
    pl.position = [ib.L, ib.T + ib.H];
    pl.width = ib.W;
    pl.height = ib.H;
  } else {
    pl.position = [b.L, b.T + b.H];
  }

  // Clean up temp file
  try { tempFile.remove(); } catch (e) {}
  G_PLACE_IMAGE = null;
}

// ====================== MAIN ENTRY ======================
function generate(jsonStr) {
  try {
    var cfg = _parseJSON(jsonStr);
    if (!cfg) return _stringify({ ok: false, msg: "Bad config payload" });

    var doc;
    try { doc = app.activeDocument; }
    catch (e) { return _stringify({ ok: false, msg: "No open document" }); }
    if (!doc) return _stringify({ ok: false, msg: "No open document" });

    app.executeEffectCommand && (function () {})(); // no-op guard

    // ── Debug dump ──
    var _dbg = {
      G_IMG_LUMA: !!G_IMG_LUMA,
      G_IMG_COLORS: !!G_IMG_COLORS,
      dotSource: cfg.dotSource,
      tab: cfg.tab
    };
    if (G_IMG_LUMA && G_IMG_LUMA.length > 0 && G_IMG_LUMA[0].length > 0) {
      _dbg.lumaRows = G_IMG_LUMA.length;
      _dbg.lumaCols = G_IMG_LUMA[0].length;
      _dbg.lumaSample00 = G_IMG_LUMA[0][0];
      _dbg.lumaSampleMid = G_IMG_LUMA[Math.floor(G_IMG_LUMA.length/2)][Math.floor(G_IMG_LUMA[0].length/2)];
      _dbg.lumaSampleEnd = G_IMG_LUMA[G_IMG_LUMA.length-1][G_IMG_LUMA[0].length-1];
    }
    _log("generate debug: " + _stringify(_dbg));
    // ──────────────────

    // Grids are sent via setImageLuma / setImageColors BEFORE generate,
    // so they're already in G_IMG_LUMA / G_IMG_COLORS.  Do NOT read
    // them from cfg — the generate payload is intentionally grid-free
    // to stay well under CEP's evalScript string limit.

    // Restore custom pts from saved G state if cfg brings them
    if (cfg.customPts && cfg.customPts.length) {
      G_CUSTOM_PTS = cfg.customPts;
    }

    var refSel = null;
    try { if (app.selection && app.selection.length) refSel = app.selection; } catch (e) {}

    // Clone selection as source shape if clip with selection shape is desired
    // (For simplicity, we just use bounding rect for clip — spec mentions auto-clip rect.)

    var result;
    var tab = (cfg.tab !== undefined) ? cfg.tab : 0;
    if (tab === 1) {
      result = _runLines(cfg);
    } else {
      // tabs 0 (spots), 2 (stipple), 3 (image) — all use spots engine by default
      if (tab === 2) {
        if (!cfg.scatter) cfg.scatter = 0;
      } else if (tab === 3) {
        cfg.dotSource = "image";
        cfg.scatter = 0; cfg.randSize = false; cfg.randOpa = false;
        cfg.flipH = false; cfg.flipV = false; cfg.randRot = false;
      }
      if (!result) result = _runSpots(cfg);
    }

    // Build clip mask paths from selection before removal
    var clipPaths = null;
    if (refSel && refSel.length > 0) {
      clipPaths = [];
      for (var i = 0; i < refSel.length; i++) {
        try {
          var src = refSel[i];
          if (src.typename === "PathItem" && src.pathPoints && src.pathPoints.length > 0) {
            // Create fresh path from selection's points (more reliable for masking than duplicate)
            var maskParent = result.group || result.newLayer;
            var pi = maskParent.pathItems.add();
            pi.filled = false;
            pi.stroked = false;
            for (var p = 0; p < src.pathPoints.length; p++) {
              var sp = src.pathPoints[p];
              var pt = pi.pathPoints.add();
              pt.anchor = sp.anchor;
              pt.leftDirection = sp.leftDirection;
              pt.rightDirection = sp.rightDirection;
              pt.pointType = sp.pointType;
            }
            pi.closed = src.closed;
            clipPaths.push(pi);
          }
        } catch (e) {}
      }
      if (!cfg.keepSrc) {
        for (var i = 0; i < refSel.length; i++) {
          try { refSel[i].remove(); } catch (e) {}
        }
      }
    }

    // Clip mask — only when user selected a path to clip to
    if (cfg.clipMask && clipPaths.length > 0) _applyClipMask(doc, result, cfg, result.bounds, clipPaths);

    // Place source image on artboard (image tab)
    if (cfg.placeImage && G_PLACE_IMAGE && tab === 3) {
      _placeImage(cfg, result);
    }

    return _stringify({
      ok: true,
      count: result.count,
      hit: (result.count > 0),
      name: tab === 1 ? "Halftone Lines" : "Halftone Shapes",
      _dbg: {
        bounds: { L: result.bounds.L, T: result.bounds.T, R: result.bounds.R, B: result.bounds.B, W: result.bounds.W, H: result.bounds.H },
        G_IMG_LUMA: !!G_IMG_LUMA,
        dotSource: cfg.dotSource,
        lumaDims: G_IMG_LUMA ? [G_IMG_LUMA.length, G_IMG_LUMA[0].length] : null,
        lumaMid: G_IMG_LUMA ? G_IMG_LUMA[Math.floor(G_IMG_LUMA.length/2)][Math.floor(G_IMG_LUMA[0].length/2)] : null,
        lumaAt00: G_IMG_LUMA ? G_IMG_LUMA[0][0] : null,
        lumaAtEnd: G_IMG_LUMA ? G_IMG_LUMA[G_IMG_LUMA.length-1][G_IMG_LUMA[0].length-1] : null,
        testLumaCenter: _getLuma(cfg, (result.bounds.L+result.bounds.R)/2, (result.bounds.T+result.bounds.B)/2, result.bounds),
        testLumaTop: _getLuma(cfg, (result.bounds.L+result.bounds.R)/2, result.bounds.T + result.bounds.H*0.01, result.bounds),
        testLumaBot: _getLuma(cfg, (result.bounds.L+result.bounds.R)/2, result.bounds.T + result.bounds.H*0.99, result.bounds)
      }
    });
  } catch (e) {
    _log("generate error: " + e.message + "\n" + (e.line || ""));
    return _stringify({ ok: false, msg: "Error: " + e.message });
  }
}

function generateWithUndo(jsonStr) {
  G_HP_JSON = jsonStr;
  try {
    if (typeof app.suspendHistory === "function") {
      return app.suspendHistory("Halftone Pro", "generate(G_HP_JSON)");
    }
  } catch (e) {}
  return generate(jsonStr);
}

// ====================== IMAGE LUMA ======================
function setImageLuma(jsonStr) {
  try {
    if (!jsonStr || jsonStr === "" || jsonStr === "[]") {
      G_IMG_LUMA = null;
      return '{"ok":true}';
    }
    G_IMG_LUMA = _parseJSON(jsonStr);
    if (!G_IMG_LUMA) return '{"ok":false,"msg":"parse failed"}';
    return '{"ok":true}';
  } catch (e) {
    return _stringify({ ok: false, msg: e.message });
  }
}

function setImageColors(jsonStr) {
  try {
    if (!jsonStr || jsonStr === "" || jsonStr === "[]") {
      G_IMG_COLORS = null;
      return '{"ok":true}';
    }
    G_IMG_COLORS = _parseJSON(jsonStr);
    if (!G_IMG_COLORS) return '{"ok":false,"msg":"parse failed"}';
    return '{"ok":true}';
  } catch (e) {
    return _stringify({ ok: false, msg: e.message });
  }
}

var G_PLACE_CHUNKS = null;

function setPlaceImageChunk(jsonStr) {
  try {
    var ch = _parseJSON(jsonStr);
    if (!ch || !ch.data) return '{"ok":false}';
    if (!G_PLACE_CHUNKS) G_PLACE_CHUNKS = [];
    G_PLACE_CHUNKS[ch.idx] = ch.data;
    // Last chunk — assemble
    if (ch.idx === ch.total - 1) {
      var full = "";
      for (var i = 0; i < ch.total; i++) full += G_PLACE_CHUNKS[i];
      G_PLACE_IMAGE = { mime: ch.mime, data: full };
      G_PLACE_CHUNKS = null;
    }
    return '{"ok":true}';
  } catch (e) {
    return _stringify({ ok: false, msg: e.message });
  }
}

// ====================== CUSTOM SHAPE CAPTURE ======================
function captureCustomShape() {
  try {
    var doc = app.activeDocument;
    if (!doc) return _stringify({ ok: false, msg: "No open document" });
    var sel = doc.selection;
    if (!sel || sel.length === 0) return _stringify({ ok: false, msg: "Select a path first" });
    sel = sel[0];
    if (!sel.pathPoints || sel.pathPoints.length < 2) {
      return _stringify({ ok: false, msg: "Selection must be a single path" });
    }

    var gb = sel.geometricBounds;
    var w = gb[2] - gb[0];
    var h = gb[1] - gb[3];
    if (w <= 0 || h <= 0) return _stringify({ ok: false, msg: "Empty path bounds" });
    var maxDim = Math.max(w, h);
    var cx = (gb[0] + gb[2]) / 2;
    var cy = (gb[1] + gb[3]) / 2;

    var pts = [];
    var pp = sel.pathPoints;
    for (var i = 0; i < pp.length; i++) {
      var anchor = pp[i].anchor;
      // normalise to -0.5..0.5 (using max dimension so aspect preserved)
      var nx = (anchor[0] - cx) / maxDim;
      var ny = -((anchor[1] - cy) / maxDim); // flip Y for canvas-like orientation
      pts.push({ x: nx, y: ny });
    }
    G_CUSTOM_PTS = pts;
    var nm = "Custom " + pts.length + "pt";
    try { nm = sel.name || nm; } catch (e) {}
    return _stringify({ ok: true, pts: pts, name: nm });
  } catch (e) {
    return _stringify({ ok: false, msg: "Error: " + e.message });
  }
}

function setCustomPts(jsonStr) {
  try {
    var arr = _parseJSON(jsonStr);
    if (!arr || !arr.length) {
      G_CUSTOM_PTS = null;
      return '{"ok":true}';
    }
    G_CUSTOM_PTS = arr;
    return '{"ok":true}';
  } catch (e) {
    return _stringify({ ok: false, msg: e.message });
  }
}

// ====================== GET DOCUMENT BOUNDS ======================
function getDocBounds() {
  try {
    var doc = app.activeDocument;
    if (!doc) return _stringify({ ok: false, msg: "No open document" });
    var sel = (app.selection && app.selection.length) ? app.selection : null;
    var bounds = _getBounds(doc, sel);
    var result = {
      ok: true,
      L: bounds.L, T: bounds.T, R: bounds.R, B: bounds.B,
      W: bounds.W, H: bounds.H,
      hasSelection: bounds.hasSelection
    };
    // Return selection path data for preview clipping
    if (sel && sel.length > 0) {
      var paths = [];
      for (var i = 0; i < sel.length; i++) {
        try {
          if (sel[i].typename === "PathItem" && sel[i].pathPoints && sel[i].pathPoints.length > 0) {
            var pts = [];
            for (var p = 0; p < sel[i].pathPoints.length; p++) {
              var sp = sel[i].pathPoints[p];
              pts.push({ a: sp.anchor, l: sp.leftDirection, r: sp.rightDirection });
            }
            paths.push({ pts: pts, closed: sel[i].closed });
          }
        } catch (e) {}
      }
      if (paths.length > 0) result.selPaths = paths;
    }
    return _stringify(result);
  } catch (e) {
    return _stringify({ ok: false, msg: "Error: " + e.message });
  }
}

// ====================== EXPOSED API ======================
// Top-level functions are auto-accessible from evalScript since this script
// runs in the persistent ExtendScript engine context.

// Self-register hint (Illustrator auto-evaluates ScriptPath on panel load)
_log("Halftone Pro engine ready.");
