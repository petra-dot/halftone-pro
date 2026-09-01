/* Halftone Pro by Petra-dot - v4.0
 * Canvas preview renderer.
 * Approximates the halftone pattern produced by the Illustrator engine.
 * Exposes window.HalftonePreview: setBg, render, scheduleRender, loadImage, clearImage.
 */
(function () {
  "use strict";

  const GRID = 256;                 // image luma grid resolution
  var canvas, ctx;
  var bg = "white";                  // 'white' | 'black' | 'checker'
  var imgCanvas = null;              // offscreen canvas of loaded image
  var lumaGrid = null;               // 2D number[GRID][GRID] in 0..255; may have _offX/_offY/_w/_h metadata
  var imgColorGrid = null;           // 2D [r,g,b][GRID][GRID] 0..255
  var imgNaturalW = 0;               // native image width  (for aspect-ratio-preserving rect)
  var imgNaturalH = 0;               // native image height
  var timer = null;
  var cfg = null;

  /** Bilinear sample color grid at world position */
  function getColorFromGrid(wx, wy, bounds) {
    if (!imgColorGrid) return null;
    var cols = imgColorGrid[0].length, rows = imgColorGrid.length;
    var nx = bounds.W ? (wx - bounds.L) / bounds.W : 0.5;
    var ny = bounds.H ? (wy - bounds.T) / bounds.H : 0.5;
    nx = Math.max(0, Math.min(1, nx));
    ny = Math.max(0, Math.min(1, ny));
    var gc = hmGridCoords(cols, rows, imgNaturalW, imgNaturalH, nx, ny);
    var gx = gc.gx, gy = gc.gy;
    var gx0 = Math.floor(gx), gy0 = Math.floor(gy);
    if (gx0 < 0) gx0 = 0;
    if (gy0 < 0) gy0 = 0;
    var gx1 = Math.min(gx0 + 1, cols - 1), gy1 = Math.min(gy0 + 1, rows - 1);
    var fx = gx - gx0, fy = gy - gy0;
    var c00 = imgColorGrid[gy0][gx0], c10 = imgColorGrid[gy0][gx1];
    var c01 = imgColorGrid[gy1][gx0], c11 = imgColorGrid[gy1][gx1];
    var r = Math.round(c00[0] * (1-fx)*(1-fy) + c10[0]*fx*(1-fy) + c01[0]*(1-fx)*fy + c11[0]*fx*fy);
    var g = Math.round(c00[1] * (1-fx)*(1-fy) + c10[1]*fx*(1-fy) + c01[1]*(1-fx)*fy + c11[1]*fx*fy);
    var b = Math.round(c00[2] * (1-fx)*(1-fy) + c10[2]*fx*(1-fy) + c01[2]*(1-fx)*fy + c11[2]*fx*fy);
    return [Math.max(0, Math.min(255, r)), Math.max(0, Math.min(255, g)), Math.max(0, Math.min(255, b))];
  }

  /** Sample a color based on cfg color mode + grid coordinates in 0..1. */
  function getColor(wx, wy, bounds) {
    if (!cfg) return "#000000";
    if (cfg.cMode === 3 && imgColorGrid) {
      var c = getColorFromGrid(wx, wy, bounds);
      if (c) return "rgb(" + c[0] + "," + c[1] + "," + c[2] + ")";
    }
    if (cfg.cMode === 3) return cfg.colors[0] || "#000000";
    // normalise dot position into 0..1 across bounds
    var nx = bounds.W ? (wx - bounds.L) / bounds.W : 0.5;
    var ny = bounds.H ? (wy - bounds.T) / bounds.H : 0.5;
    nx = Math.max(0, Math.min(1, nx));
    ny = Math.max(0, Math.min(1, ny));

    if (cfg.cMode === 0) {
      return cfg.colors[0];
    } else if (cfg.cMode === 1) {
      var c = hmPickMultiColor(cfg.colors, cfg.colorEn);
      return hmRgbStr(c.r, c.g, c.b);
    } else {
      var c2 = hmGradientColor(nx, ny, cfg.gradDir || 0, cfg.colors, cfg.grad3);
      return hmRgbStr(c2.r, c2.g, c2.b);
    }
  }



  /** Compute luma 0..1 (1=light, 0=dark) at world position wx,wy within bounds. */
  function getLuma(wx, wy, bounds, src) {
    if (!cfg) return 1;
    var nx = bounds.W ? (wx - bounds.L) / bounds.W : 0.5;
    var ny = bounds.H ? (wy - bounds.T) / bounds.H : 0.5;
    nx = Math.max(0, Math.min(1, nx));
    ny = Math.max(0, Math.min(1, ny));
    var v;
    src = src || cfg.dotSource || "uniform";
    if (src === "image" && lumaGrid) {
      var cols = lumaGrid[0].length, rows = lumaGrid.length;
      var gc = hmGridCoords(cols, rows, imgNaturalW, imgNaturalH, nx, ny);
      v = hmBilinearSample(lumaGrid, cols, rows, gc.gx, gc.gy) / 255;
    } else {
      v = hmDotLuma(nx, ny, src);
    }
    v = hmAdjustLuma(v, cfg.invert, cfg.gamma, cfg.midpoint);
    return v;
  }

  function drawBg() {
    var w = canvas.width, h = canvas.height;
    if (bg === "white") {
      ctx.fillStyle = "#ffffff"; ctx.fillRect(0, 0, w, h);
    } else if (bg === "black") {
      ctx.fillStyle = "#000000"; ctx.fillRect(0, 0, w, h);
    } else {
      var sz = 8;
      for (var y = 0; y < h; y += sz) {
        for (var x = 0; x < w; x += sz) {
          ctx.fillStyle = ((x / sz + y / sz) % 2 === 0) ? "#cccccc" : "#ffffff";
          ctx.fillRect(x, y, sz, sz);
        }
      }
    }
  }

  // ====================== SHAPE DRAWING ======================
  // Note: path-based fill() is broken in this CEF, using stroke() with thick
  // lineWidth as fill workaround. fillRect() is safe to use.

  /** Compensate stroke width for canvas scale transform. */
  function _lw(base) {
    return cfg._ps > 0 ? base / cfg._ps : base;
  }

  function drawCircle(x, y, r) {
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + 0.001, y);
    // Use _lw only for the visibility floor (minimum screen-size line).
    // The diameter r*2 must remain in document-space so the canvas
    // scale transform produces the correct screen size.
    ctx.lineWidth = Math.max(_lw(0.5), r * 2);
    ctx.lineCap = "round";
    ctx.stroke();
  }

  function drawSquare(x, y, r) {
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }

  function drawTriangle(x, y, r) {
    var h = r * 1.1547;
    ctx.beginPath();
    ctx.moveTo(x, y - h);
    ctx.lineTo(x + r, y + h * 0.5);
    ctx.lineTo(x - r, y + h * 0.5);
    ctx.closePath();
    ctx.lineWidth = Math.max(_lw(0.5), r * 1.2);
    ctx.lineJoin = "round";
    ctx.stroke();
  }

  function drawHexagon(x, y, r) {
    ctx.beginPath();
    for (var i = 0; i < 6; i++) {
      var a = (i * 60 + 30) * Math.PI / 180;
      var px = x + Math.cos(a) * r, py = y + Math.sin(a) * r;
      if (i === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
    }
    ctx.closePath();
    ctx.lineWidth = Math.max(_lw(0.5), r * 1.2);
    ctx.lineJoin = "round";
    ctx.stroke();
  }

  function drawDiamond(x, y, r) {
    ctx.beginPath();
    ctx.moveTo(x, y - r);
    ctx.lineTo(x + r, y);
    ctx.lineTo(x, y + r);
    ctx.lineTo(x - r, y);
    ctx.closePath();
    ctx.lineWidth = Math.max(_lw(0.5), r * 1.2);
    ctx.lineJoin = "round";
    ctx.stroke();
  }

  function drawCustom(x, y, r) {
    if (cfg.customPts && cfg.customPts.length) {
      ctx.beginPath();
      for (var j = 0; j < cfg.customPts.length; j++) {
        var px = x + cfg.customPts[j].x * r * 2;
        var py = y + cfg.customPts[j].y * r * 2;
        if (j === 0) ctx.moveTo(px, py); else ctx.lineTo(px, py);
      }
      ctx.closePath();
      ctx.lineWidth = Math.max(_lw(0.5), r * 1.2);
      ctx.lineJoin = "round";
      ctx.stroke();
    } else {
      drawCircle(x, y, r);
    }
  }

  function drawShape(x, y, r, shape, rot) {
    rot = rot || 0;
    ctx.save();
    if (rot) {
      ctx.translate(x, y);
      ctx.rotate(rot);
      x = 0; y = 0;
    }
    switch (shape) {
      case "square": drawSquare(x, y, r); break;
      case "triangle": drawTriangle(x, y, r); break;
      case "hexagon": drawHexagon(x, y, r); break;
      case "diamond": drawDiamond(x, y, r); break;
      case "custom": drawCustom(x, y, r); break;
      default: drawCircle(x, y, r);
    }
    ctx.restore();
  }

  function renderSpots(bounds) {
    var cell = Math.max(1, cfg.cell);
    var gap = cfg.gap / 100;
    var ang = cfg.angle * Math.PI / 180;
    var cos = Math.cos(ang), sin = Math.sin(ang);
    var half = cell / 2;
    var gapScale = 1 - gap;
    var lo = bounds.L, ro = bounds.R, to = bounds.T, bo = bounds.B;
    var cx = (lo + ro) / 2, cy = (to + bo) / 2;
    var diag = Math.sqrt(bounds.W * bounds.W + bounds.H * bounds.H) / 2 + cell;
    var n = Math.ceil(diag / cell) + 1;

    // Match engine auto-adjust — limit dots on all tabs
    var MAX_DOTS = (cfg.tab === 3) ? 100000 : 200000;
    var nSq = (2 * n + 1) * (2 * n + 1);
    if (nSq > MAX_DOTS) {
      var diagLen = Math.sqrt(bounds.W * bounds.W + bounds.H * bounds.H);
      var needed = Math.ceil(diagLen / (Math.sqrt(MAX_DOTS) - 1));
      cell = Math.max(cell, needed);
      half = cell / 2;
      diag = Math.sqrt(bounds.W * bounds.W + bounds.H * bounds.H) / 2 + cell;
      n = Math.ceil(diag / cell) + 1;
    }

    for (var i = -n; i <= n; i++) {
      for (var j = -n; j <= n; j++) {
        var ox = i * cell, oy = j * cell;
        // scatter jitter
        if (cfg.scatter > 0) {
          oy += (Math.random() - 0.5) * cfg.scatter / 100 * cell * 2;
          ox += (Math.random() - 0.5) * cfg.scatter / 100 * cell * 2;
        }
        // rotate grid
        var wx = cx + ox * cos - oy * sin;
        var wy = cy + ox * sin + oy * cos;
        if (wx <= lo || wx >= ro || wy >= bo || wy <= to) continue;
        var luma = getLuma(wx, wy, bounds, cfg.tab === 3 ? "image" : null);
        var scBase = cfg.minScale + (1 - luma) * (cfg.maxScale - cfg.minScale);
        scBase /= 100;
        if (cfg.randSize) scBase *= 0.5 + Math.random();
        var r = half * scBase * gapScale;
        if (r < 0.05) continue;
        var col = getColor(wx, wy, bounds);
        ctx.fillStyle = col;
        ctx.strokeStyle = col;
        var rot = 0;
        if (cfg.randRot) rot = (cfg.rotMin + Math.random() * (cfg.rotMax - cfg.rotMin)) * Math.PI / 180;
        if (cfg.randOpa) ctx.globalAlpha = (cfg.opaMin + Math.random() * (cfg.opaMax - cfg.opaMin)) / 100;
        else ctx.globalAlpha = cfg.opacity / 100;
        if (cfg.flipH || cfg.flipV) {
          ctx.save();
          ctx.translate(wx, wy);
          ctx.scale(cfg.flipH ? -1 : 1, cfg.flipV ? -1 : 1);
          drawShape(0, 0, r, cfg.shape, rot);
          ctx.restore();
        } else {
          drawShape(wx, wy, r, cfg.shape, rot);
        }
        ctx.globalAlpha = 1;
      }
    }
  }

  function renderLines(bounds) {
    var spacing = cfg.lineSpacing || 8;
    var ang = cfg.lineAngle * Math.PI / 180;
    var wMin = cfg.lineW, wMax = cfg.lineWMax;
    var mode = cfg.lineMode || "straight";
    var passes = (mode === "cross") ? cfg.wavyPasses : 1;
    var perpX = -Math.sin(ang), perpY = Math.cos(ang);
    var dirX = Math.cos(ang), dirY = Math.sin(ang);
    var cx = (bounds.L + bounds.R) / 2, cy = (bounds.T + bounds.B) / 2;
    var diag = Math.sqrt(bounds.W * bounds.W + bounds.H * bounds.H) / 2 + spacing * 2;
    var numLines = Math.ceil(diag / spacing);

    // Match engine auto-adjust — limit total lines
    var totalLinesEst = passes * (2 * numLines + 1);
    var MAX_LINES = 30000;
    if (totalLinesEst > MAX_LINES) {
      var needed = Math.ceil(passes * (2 * (Math.sqrt(bounds.W * bounds.W + bounds.H * bounds.H) / 2 + spacing * 2) / spacing + 1) / MAX_LINES);
      spacing = Math.max(spacing, needed);
      diag = Math.sqrt(bounds.W * bounds.W + bounds.H * bounds.H) / 2 + spacing * 2;
      numLines = Math.ceil(diag / spacing);
    }

    ctx.lineCap = "round";
    ctx.lineJoin = "round";

    for (var p = 0; p < passes; p++) {
      var passAng = ang + (p * cfg.passAngle * Math.PI / 180);
      var px = -Math.sin(passAng), py = Math.cos(passAng);
      var dx = Math.cos(passAng), dy = Math.sin(passAng);
      var passSrc = (cfg.crossSources && cfg.crossSources[p]) || null;
      var isPerp = (passSrc === "perp" || passSrc === "perp-rev");
      var waveSrc = isPerp ? null : passSrc;
      var isWavy = (mode !== "straight");
      var freq = cfg.wavyFreq || 4;
      var amp = cfg.wavyAmp || 18;

      for (var i = -numLines; i <= numLines; i++) {
        var off = i * spacing;
        var x0 = cx + px * off - dx * diag;
        var y0 = cy + py * off - dy * diag;
        var x1 = cx + px * off + dx * diag;
        var y1 = cy + py * off + dy * diag;

        if (isPerp) {
          var midY = (y0 + y1) / 2;
          var t = Math.max(0, Math.min(1, (midY - bounds.T) / (bounds.B - bounds.T)));
          var perpW = wMin + (passSrc === "perp-rev" ? 1 - t : t) * (wMax - wMin);
          if (cfg.randSize) perpW *= 0.5 + Math.random();
          var lineAlpha = cfg.opacity / 100;
          if (cfg.randOpa) lineAlpha *= (cfg.opaMin + Math.random() * (cfg.opaMax - cfg.opaMin)) / 100;
          ctx.strokeStyle = getColor(cx, cy, bounds);
          ctx.lineWidth = Math.max(_lw(0.5), perpW);
          ctx.lineJoin = "round";
          ctx.globalAlpha = lineAlpha;
          ctx.beginPath();
          ctx.moveTo(x0, y0);
          ctx.lineTo(x1, y1);
          ctx.stroke();
          continue;
        }

        // Generate points along the line (wavy or straight)
        var pts;
        if (isWavy) {
          pts = [];
          var wavyPts = Math.max(20, Math.round(freq * 10));
          for (var s = 0; s <= wavyPts; s++) {
            var t = s / wavyPts;
            var bx = x0 + (x1 - x0) * t;
            var by = y0 + (y1 - y0) * t;
            var lumaW = getLuma(bx, by, bounds, waveSrc);
            var wave = Math.sin(t * 2 * Math.PI * freq) * amp * (1 - lumaW);
            bx += -dy * wave;
            by += dx * wave;
            pts.push([bx, by]);
          }
        } else {
          pts = [[x0, y0], [x1, y1]];
        }

        // Compute line width from vertical position
        var midX = (x0 + x1) / 2, midY = (y0 + y1) / 2;
        var t = Math.max(0, Math.min(1, (midY - bounds.T) / (bounds.B - bounds.T)));
        var w = wMin + t * (wMax - wMin);
        if (cfg.randSize) w *= 0.5 + Math.random();

        // Scatter offset (whole-line shift)
        var scAmt = cfg.scatter || 0;
        if (scAmt > 0) {
          var scOff = (Math.random() - 0.5) * scAmt / 100 * spacing;
          var scOffX = -dy * scOff, scOffY = dx * scOff;
          for (var s2 = 0; s2 < pts.length; s2++) {
            pts[s2][0] += scOffX;
            pts[s2][1] += scOffY;
          }
        }

        var lineAlpha = cfg.opacity / 100;
        if (cfg.randOpa) lineAlpha *= (cfg.opaMin + Math.random() * (cfg.opaMax - cfg.opaMin)) / 100;
        ctx.strokeStyle = getColor(midX, midY, bounds);
        ctx.lineWidth = Math.max(_lw(0.25), w);
        ctx.lineJoin = "round";
        ctx.globalAlpha = lineAlpha;
        ctx.beginPath();
        ctx.moveTo(pts[0][0], pts[0][1]);
        if (pts.length === 2) {
          ctx.lineTo(pts[1][0], pts[1][1]);
        } else {
          var n2 = pts.length;
          for (var s3 = 0; s3 < n2 - 1; s3++) {
            var p0 = s3 === 0 ? pts[0] : pts[s3 - 1];
            var p1 = pts[s3];
            var p2 = pts[s3 + 1];
            var p3 = s3 === n2 - 2 ? pts[n2 - 1] : pts[s3 + 2];
            ctx.bezierCurveTo(
              p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6,
              p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6,
              p2[0], p2[1]
            );
          }
        }
        ctx.stroke();
      }
    }
    ctx.globalAlpha = 1;
  }

  function render(newCfg) {
    if (newCfg) cfg = newCfg;
    if (!canvas) return;
    try {
      // Always reconcile canvas buffer with actual CSS size before drawing.
      // This ensures every render path (slider, preset, generate, resize,
      // initial load) uses the correct dimensions for centering.
      resize();

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      drawBg();
      if (!cfg) return;

      var cw = canvas.width, ch = canvas.height;
      var pad = 8;
      var bounds, db = cfg.docBounds;

      if (db && db.W > 0 && db.H > 0) {
        // Normalise to Y-down coords (Illustrator uses Y-up: T > B)
        var L = db.L, R = db.R;
        var T = Math.min(db.T, db.B);
        var B = Math.max(db.T, db.B);
        var W = R - L, H = B - T;

        // object-fit: contain — scale to fit, preserve aspect, centre
        var availW = cw - pad * 2, availH = ch - pad * 2;
        var vs = Math.min(availW / W, availH / H);
        var vw = W * vs, vh = H * vs;
        var vx = (cw - vw) / 2, vy = (ch - vh) / 2;

        // Apply canvas transform so all drawing happens in doc-space
        // Translate to centre the artboard itself, not just the origin.
        // Without this, an artboard at non-zero document coordinates (e.g.
        // T=0, B=-800 normalised to T=-800) renders shifted and clipped.
        ctx.save();
        ctx.translate(vx - L * vs, vy - T * vs);
        ctx.scale(vs, vs);

        // Subtle artboard border (dashed, 1 screen-pixel wide)
        ctx.save();
        ctx.strokeStyle = "rgba(160,160,160,0.5)";
        ctx.lineWidth = Math.max(0.5, 1 / vs);
        ctx.setLineDash([Math.max(1, 4 / vs), Math.max(1, 4 / vs)]);
        ctx.strokeRect(L, T, W, H);
        ctx.restore();

        // Store scale for stroke-width compensation in draw helpers
        cfg._ps = vs;
        bounds = { L: L, T: T, R: R, B: B, W: W, H: H };

        // Apply selection path clipping if available
        if (db.selPaths && db.selPaths.length > 0) {
          ctx.beginPath();
          for (var sp = 0; sp < db.selPaths.length; sp++) {
            var selPath = db.selPaths[sp];
            if (!selPath.pts || selPath.pts.length < 2) continue;
            // Convert from Y-up (Illustrator) to Y-down (canvas)
            var fp = selPath.pts[0];
            ctx.moveTo(fp.a[0], T + B - fp.a[1]);
            for (var pi = 1; pi < selPath.pts.length; pi++) {
              var cp = selPath.pts[pi];
              var pp = selPath.pts[pi - 1];
              ctx.bezierCurveTo(
                pp.r[0], T + B - pp.r[1],
                cp.l[0], T + B - cp.l[1],
                cp.a[0], T + B - cp.a[1]
              );
            }
            if (selPath.closed && selPath.pts.length > 2) {
              var lp = selPath.pts[selPath.pts.length - 1];
              ctx.bezierCurveTo(
                lp.r[0], T + B - lp.r[1],
                fp.l[0], T + B - fp.l[1],
                fp.a[0], T + B - fp.a[1]
              );
              ctx.closePath();
            }
          }
          ctx.clip();
        }
      } else {
        cfg._ps = 0;
        bounds = { L: pad, T: pad, R: cw - pad, B: ch - pad, W: cw - pad * 2, H: ch - pad * 2 };
      }

      // Image with spots: restrict dots to the image's aspect-ratio rectangle
      // so the halftone is never stretched or cropped.
      var drawBounds = bounds;
      if (cfg.tab === 3 && lumaGrid) {
        var ir = getImageRect(bounds);
        if (ir) drawBounds = ir;
      }
      if (cfg.tab === 1) { renderLines(drawBounds); }
      else { renderSpots(drawBounds); }

      if (db && db.W > 0 && db.H > 0) ctx.restore();
    } catch (e) {
      ctx.font = "10px sans-serif";
      ctx.strokeStyle = "#FF0000";
      ctx.strokeText("PV ERR", 4, 12);
    }
  }

  /** Compute the image's "contain" rectangle within a given bounds rect.
   *  Returns null when no image is loaded. */
  function getImageRect(bounds) {
    if (!imgNaturalW || !imgNaturalH || !bounds || !bounds.W || !bounds.H) return null;
    return hmImageRect(bounds.L, bounds.T, bounds.R, bounds.B, imgNaturalW, imgNaturalH);
  }

  /** Unsharp mask on RGBA pixel data — enhances edges for crisper halftone */
  function _sharpenGrid(data, w, h) {
    var src = new Uint8Array(data);
    var amount = 0.35;
    for (var y = 1; y < h - 1; y++) {
      for (var x = 1; x < w - 1; x++) {
        for (var c = 0; c < 3; c++) {
          var idx = (y * w + x) * 4 + c;
          var blurred = (
            src[((y-1)*w + x-1) * 4 + c] + src[((y-1)*w + x) * 4 + c] + src[((y-1)*w + x+1) * 4 + c] +
            src[(y*w + x-1) * 4 + c]     + src[(y*w + x) * 4 + c]     + src[(y*w + x+1) * 4 + c] +
            src[((y+1)*w + x-1) * 4 + c] + src[((y+1)*w + x) * 4 + c] + src[((y+1)*w + x+1) * 4 + c]
          ) / 9;
          var diff = src[idx] - blurred;
          data[idx] = Math.max(0, Math.min(255, Math.round(src[idx] + amount * diff)));
        }
      }
    }
  }

  function scheduleRender(newCfg) {
    if (newCfg) cfg = newCfg;
    if (timer) clearTimeout(timer);
    timer = setTimeout(function () { render(); }, 250);
  }

  function setBg(b) { bg = b; scheduleRender(); }

  function loadImage(src, callback) {
    var img = new Image();
    img.onload = function () {
      imgNaturalW = img.naturalWidth || img.width;
      imgNaturalH = img.naturalHeight || img.height;
      if (imgNaturalW < 1 || imgNaturalH < 1) { if (callback) callback(false, null); return; }

      imgCanvas = document.createElement("canvas");
      imgCanvas.width = GRID;
      imgCanvas.height = GRID;
      var ic = imgCanvas.getContext("2d");
      ic.imageSmoothingEnabled = true;
      ic.imageSmoothingQuality = "high";

      // Use CONTAIN scaling so the image fits entirely within the grid
      // (CSS object-fit: contain equivalent).  Areas the image doesn't
      // cover get luma=255 (white = no dots).
      var scale = Math.min(GRID / imgNaturalW, GRID / imgNaturalH);
      var drawW = Math.round(imgNaturalW * scale);
      var drawH = Math.round(imgNaturalH * scale);
      var offX = Math.floor((GRID - drawW) / 2);
      var offY = Math.floor((GRID - drawH) / 2);

      // Fill background white
      ic.fillStyle = "#ffffff";
      ic.fillRect(0, 0, GRID, GRID);

      // Draw image centred with contain scaling
      ic.drawImage(img, offX, offY, drawW, drawH);

      // Apply unsharp mask to enhance edges for crisper halftone
      var imageData = ic.getImageData(0, 0, GRID, GRID);
      _sharpenGrid(imageData.data, GRID, GRID);
      var data = imageData.data;
      lumaGrid = [];
      imgColorGrid = [];
      for (var y = 0; y < GRID; y++) {
        var lumaRow = [];
        var colorRow = [];
        for (var x = 0; x < GRID; x++) {
          var idx = (y * GRID + x) * 4;
          var r = data[idx], g = data[idx + 1], b = data[idx + 2], a = data[idx + 3];
          var lum = Math.round(0.299 * r + 0.587 * g + 0.114 * b);
          if (a < 32) { lum = 255; r = 255; g = 255; b = 255; }
          lumaRow.push(lum);
          colorRow.push([r, g, b]);
        }
        lumaGrid.push(lumaRow);
        imgColorGrid.push(colorRow);
      }
      if (callback) callback(true, lumaGrid, imgNaturalW, imgNaturalH);
    };
    img.onerror = function () { if (callback) callback(false, null); };
    img.src = src;
  }

  function clearImage() {
    imgCanvas = null;
    lumaGrid = null;
    imgColorGrid = null;
    imgNaturalW = 0;
    imgNaturalH = 0;
  }

  function resize() {
    if (!canvas) return false;
    var stage = canvas.parentElement;
    // clientWidth/clientHeight exclude borders — reliable integer values
    var w = stage.clientWidth;
    var h = stage.clientHeight;
    if (w > 0 && h > 0 && (canvas.width !== w || canvas.height !== h)) {
      canvas.width = w;
      canvas.height = h;
      return true;
    }
    return false;
  }

  function init() {
    canvas = document.getElementById("preview");
    ctx = canvas.getContext("2d");
    resize();

    // ── Layer 1: window.resize event (immediate, debounced via rAF) ──
    var rafId = null;
    function onResizeFrame() {
      rafId = null;
      if (resize() && cfg) render();
    }
    window.addEventListener("resize", function () {
      if (!rafId) rafId = requestAnimationFrame(onResizeFrame);
    });

    // ── Layer 2: polling fallback (catches layout changes that may
    //    not fire window.resize, e.g. panel snap / dock changes) ──
    setInterval(function () {
      if (resize() && cfg) render();
    }, 250);

    // ── Layer 3: settle render after initial layout ──
    // The very first render after DOMContentLoaded might read the
    // canvas before flex layout has fully settled.  A final pass
    // ~200 ms later guarantees correct dimensions.
    setTimeout(function () {
      resize();
      if (cfg) render();
      else if (canvas) {
        // Even without a config, draw the background so the
        // preview area isn't blank/transparent.
        drawBg();
      }
    }, 200);
  }

  window.HalftonePreview = {
    init: init,
    setBg: setBg,
    render: render,
    scheduleRender: scheduleRender,
    loadImage: loadImage,
    clearImage: clearImage,
    getLumaGrid: function () { return lumaGrid; },
    getColorGrid: function () { return imgColorGrid; },
    getImageDims: function () { return { w: imgNaturalW, h: imgNaturalH }; }
  };

  document.addEventListener("DOMContentLoaded", init);
})();
