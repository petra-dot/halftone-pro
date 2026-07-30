/* Halftone Pro by Petra-dot - v4.0
 * Main panel controller.
 * Wires UI to state, talks to ExtendScript via CSInterface.evalScript.
 */
(function () {
  "use strict";

  var cs = new CSInterface();

  // ---------- DEFAULTS ----------
  var DEFAULTS = {
    tab: 0,
    shape: "circle",
    cell: 6, gap: 3, minScale: 5, maxScale: 100, angle: 45,
    randSize: false, scatter: 0, dotSource: "uniform", invert: false, gamma: 1.0, midpoint: 0.5,
    placeImage: false,
    lineMode: "straight", lineSpacing: 8, lineAngle: 45,
    lineW: 0.5, lineWMax: 3, wavyFreq: 4, wavyAmp: 18, wavyPasses: 2, passAngle: 30,
    randRot: false, rotMin: 0, rotMax: 360, randOpa: false, opaMin: 40, opaMax: 100,
    flipH: false, flipV: false,
    cMode: 0,
    colors: ["#000000", "#FF6B35", "#3399FF", "#66FF66", "#FF33CC"],
    colorEn: [true, false, false, false, false],
    grad3: false, gradDir: 0,
    clipMask: true, keepSrc: false, groupShapes: true, crossSources: null,
    blend: "normal", opacity: 100
  };
  var state = {};
  function resetState() {
    Object.keys(DEFAULTS).forEach(function (k) {
      state[k] = (k === "colors" || k === "colorEn")
        ? DEFAULTS[k].slice()
        : JSON.parse(JSON.stringify(DEFAULTS[k]));
    });
  }
  resetState();
  state.customPts = null;
  state.customName = null;

  // Per-tab snapshot storage — saves/restores tab-specific keys on switch
  var TAB_SPECIFIC = ["shape","cell","gap","minScale","maxScale","angle","dotSource","randSize","scatter","lineMode","lineSpacing","lineAngle","lineW","lineWMax","wavyFreq","wavyAmp","wavyPasses","passAngle","crossSources","placeImage","randRot","rotMin","rotMax","randOpa","opaMin","opaMax","flipH","flipV"];
  var tabSnapshots = [{},{},{},{}];
  function saveTabState(tab) {
    var snap = tabSnapshots[tab] = {};
    for (var si = 0; si < TAB_SPECIFIC.length; si++) {
      var k = TAB_SPECIFIC[si];
      snap[k] = (k === "colors" || k === "colorEn") ? (state[k] ? state[k].slice() : state[k]) : JSON.parse(JSON.stringify(state[k]));
    }
  }
  function restoreTabState(tab) {
    var snap = tabSnapshots[tab];
    for (var si = 0; si < TAB_SPECIFIC.length; si++) {
      var k = TAB_SPECIFIC[si];
      if (snap.hasOwnProperty(k)) state[k] = (k === "colors" || k === "colorEn") ? (snap[k] ? snap[k].slice() : snap[k]) : JSON.parse(JSON.stringify(snap[k]));
    }
  }
  // Seed first-time snapshots from current defaults
  for (var t0 = 0; t0 < 4; t0++) saveTabState(t0);

  // ---------- PRESETS ----------
  var PRESETS = [
    // ========== SPOTS (tab 0) ==========
    { name: "Classic Newspaper", tab: 0, shape: "circle", cell: 12, gap: 5, minScale: 25, maxScale: 100, angle: 45, dotSource: "diagonal", gamma: 1.6,
      cMode: 0, colors: ["#1a1a1a", "", "", "", ""], colorEn: [true, false, false, false, false], blend: "multiply", opacity: 100 },
    { name: "Fine Art Screen", tab: 0, shape: "circle", cell: 8, gap: 4, minScale: 18, maxScale: 100, angle: 30, dotSource: "diagonal", gamma: 1,
      cMode: 0, colors: ["#222222", "", "", "", ""], colorEn: [true, false, false, false, false], blend: "multiply", opacity: 100 },
    { name: "Coarse Pop-Art", tab: 0, shape: "circle", cell: 22, gap: 3, minScale: 80, maxScale: 90, angle: 0, dotSource: "uniform", gamma: 1,
      cMode: 0, colors: ["#D91616", "", "", "", ""], colorEn: [true, false, false, false, false], blend: "multiply", opacity: 100 },
    { name: "Gradient Wash", tab: 0, shape: "diamond", cell: 16, gap: 8, minScale: 12, maxScale: 100, angle: 45, dotSource: "diagonal", gamma: 1.2,
      cMode: 2, colors: ["#FF6B35", "#1a1a1a", "#FFFFFF", "", ""], colorEn: [true, true, true, false, false], grad3: true, gradDir: 4, blend: "multiply", opacity: 100 },
    { name: "Hex Honeycomb", tab: 0, shape: "hexagon", cell: 18, gap: 5, minScale: 40, maxScale: 100, angle: 0, dotSource: "diagonal", gamma: 1,
      cMode: 0, colors: ["#D4880F", "", "", "", ""], colorEn: [true, false, false, false, false], blend: "multiply", opacity: 100 },
    { name: "Diamond Editorial", tab: 0, shape: "diamond", cell: 14, gap: 6, minScale: 20, maxScale: 100, angle: 22, dotSource: "diagonal", gamma: 1.3,
      cMode: 1, colors: ["#1A1A1A", "#CCCCCC", "", "", ""], colorEn: [true, true, false, false, false], blend: "multiply", opacity: 95 },
    { name: "Risograph", tab: 0, shape: "square", cell: 16, gap: 8, minScale: 22, maxScale: 80, angle: 22.5, dotSource: "random", gamma: 0.7, scatter: 35, randSize: true, randRot: true, rotMin: 5, rotMax: 15,
      cMode: 1, colors: ["#FF4400", "#0044CC", "#FFCC00", "#EE1177", ""], colorEn: [true, true, true, true, false], blend: "multiply", opacity: 90 },
    { name: "Scatter Pop", tab: 0, shape: "circle", cell: 16, gap: 8, minScale: 55, maxScale: 85, angle: 22.5, dotSource: "diagonal", gamma: 1, scatter: 35, randSize: true, randRot: true, rotMin: 0, rotMax: 90,
      cMode: 1, colors: ["#FF2200", "#00D4FF", "#FF00AA", "#FFEE00", ""], colorEn: [true, true, true, true, false], blend: "multiply", opacity: 90 },
    { name: "Radial Burst", tab: 0, shape: "circle", cell: 12, gap: 10, minScale: 10, maxScale: 100, angle: 0, dotSource: "radial", invert: true, gamma: 1,
      cMode: 2, colors: ["#FFD700", "#FF6B35", "#1a1a1a", "", ""], colorEn: [true, true, true, false, false], grad3: true, gradDir: 5, blend: "normal", opacity: 100 },
    { name: "Offset Press", tab: 0, shape: "circle", cell: 12, gap: 4, minScale: 15, maxScale: 100, angle: 75, dotSource: "diagonal", gamma: 1,
      cMode: 1, colors: ["#00B7EC", "#FF00FF", "#FFE600", "#000000", ""], colorEn: [true, true, true, true, true], blend: "normal", opacity: 100 },
    // ========== LINES (tab 1) ==========
    { name: "Banknote Engraving", tab: 1, lineMode: "wavy", lineSpacing: 4, lineAngle: 30, lineW: 0.5, lineWMax: 2, wavyFreq: 8, wavyAmp: 10, dotSource: "diagonal", gamma: 1.2,
      cMode: 0, colors: ["#082040", "", "", "", ""], colorEn: [true, false, false, false, false], blend: "multiply", opacity: 100 },
    { name: "Cross-Hatch Shadow", tab: 1, lineMode: "cross", lineSpacing: 3, lineAngle: 30, lineW: 0.25, lineWMax: 2.0, wavyPasses: 3, passAngle: 60, wavyFreq: 1, wavyAmp: 0, dotSource: "diagonal", gamma: 0.6, scatter: 8, randSize: true, randOpa: true, opaMin: 40, opaMax: 90, crossSources: ["perp", "perp-rev", "perp"],
      cMode: 0, colors: ["#000000", "", "", "", ""], colorEn: [true, false, false, false, false], blend: "multiply", opacity: 65 },
    { name: "Ribbon Lines", tab: 1, lineMode: "wavy", lineSpacing: 10, lineAngle: 45, lineW: 0.4, lineWMax: 3.5, wavyFreq: 2, wavyAmp: 45, dotSource: "diagonal", gamma: 1,
      cMode: 2, colors: ["#FF3366", "#FFCC00", "", "", ""], colorEn: [true, true, false, false, false], grad3: false, gradDir: 4, blend: "screen", opacity: 100 },
    { name: "Blueprint Grid", tab: 1, lineMode: "cross", lineSpacing: 3, lineAngle: 0, lineW: 0.25, lineWMax: 0.6, wavyPasses: 2, passAngle: 90, wavyFreq: 0, wavyAmp: 0, dotSource: "linear", gamma: 1.2,
      cMode: 0, colors: ["#0055FF", "", "", "", ""], colorEn: [true, false, false, false, false], blend: "normal", opacity: 100 },
    { name: "Poster Hatch", tab: 1, lineMode: "cross", lineSpacing: 14, lineAngle: 30, lineW: 0.6, lineWMax: 4, wavyPasses: 2, passAngle: 90, wavyFreq: 3, wavyAmp: 10, dotSource: "linear", gamma: 1,
      cMode: 1, colors: ["#111111", "#FF2200", "", "", ""], colorEn: [true, true, false, false, false], blend: "multiply", opacity: 100 },
    // ========== STIPPLE (tab 2) ==========
    { name: "Stipple Portrait", tab: 2, shape: "circle", cell: 6, gap: 3, minScale: 18, maxScale: 100, angle: 0, scatter: 80, dotSource: "diagonal", gamma: 1.4,
      cMode: 0, colors: ["#222222", "", "", "", ""], colorEn: [true, false, false, false, false], blend: "multiply", opacity: 100 },
    { name: "Brutalist Scatter", tab: 2, shape: "square", cell: 20, gap: 10, minScale: 45, maxScale: 100, angle: 0, scatter: 70, dotSource: "uniform", gamma: 1, randSize: true, randRot: true, rotMin: 0, rotMax: 180,
      cMode: 0, colors: ["#000000", "", "", "", ""], colorEn: [true, false, false, false, false], blend: "normal", opacity: 100 },
    { name: "Ink Splatter", tab: 2, shape: "circle", cell: 5, gap: 2, minScale: 15, maxScale: 100, angle: 0, scatter: 100, dotSource: "diagonal", gamma: 1, randSize: true, randRot: true,
      cMode: 2, colors: ["#1a1a1a", "#662200", "", "", ""], colorEn: [true, true, false, false, false], grad3: false, gradDir: 4, blend: "multiply", opacity: 100 },
    { name: "Grit Texture", tab: 2, shape: "diamond", cell: 4, gap: 1, minScale: 25, maxScale: 40, angle: 0, scatter: 90, dotSource: "diagonal", gamma: 1.8,
      cMode: 0, colors: ["#222222", "", "", "", ""], colorEn: [true, false, false, false, false], blend: "multiply", opacity: 50 },
    { name: "Pointillism", tab: 2, shape: "circle", cell: 4, gap: 2, minScale: 20, maxScale: 100, angle: 0, scatter: 100, dotSource: "diagonal", gamma: 1.6,
      cMode: 3, colors: ["#000000", "", "", "", ""], colorEn: [true, false, false, false, false], blend: "normal", opacity: 100 },
    // ========== IMAGE (tab 3) ==========
    { name: "CMYK Print", tab: 3, shape: "circle", cell: 10, gap: 4, minScale: 25, maxScale: 100, angle: 45, dotSource: "diagonal", gamma: 1,
      cMode: 1, colors: ["#00B7EC", "#FF00FF", "#FFE600", "#000000", ""], colorEn: [true, true, true, true, false], blend: "multiply", opacity: 100 },
    { name: "Duotone Dream", tab: 3, shape: "circle", cell: 12, gap: 6, minScale: 22, maxScale: 100, angle: 45, dotSource: "diagonal", gamma: 1, midpoint: 0.4,
      cMode: 2, colors: ["#1a1a1a", "#FF6B35", "", "", ""], colorEn: [true, true, false, false, false], grad3: false, gradDir: 4, blend: "multiply", opacity: 100 },
    { name: "Posterized", tab: 3, shape: "square", cell: 16, gap: 4, minScale: 25, maxScale: 85, angle: 0, dotSource: "uniform", gamma: 2.5, midpoint: 0.5,
      cMode: 0, colors: ["#000000", "", "", "", ""], colorEn: [true, false, false, false, false], blend: "normal", opacity: 100 },
    { name: "Watercolor Edge", tab: 3, shape: "diamond", cell: 14, gap: 8, minScale: 30, maxScale: 100, angle: 45, dotSource: "diagonal", gamma: 1, placeImage: true,
      cMode: 2, colors: ["#225566", "#88BBDD", "", "", ""], colorEn: [true, true, false, false, false], grad3: false, gradDir: 4, blend: "normal", opacity: 80 },
    { name: "Neon Glow", tab: 3, shape: "circle", cell: 8, gap: 3, minScale: 22, maxScale: 100, angle: 45, dotSource: "diagonal", gamma: 1.8, placeImage: true,
      cMode: 2, colors: ["#FF0088", "#00FFCC", "", "", ""], colorEn: [true, true, false, false, false], grad3: false, gradDir: 4, blend: "screen", opacity: 100 }
  ];

  // ---------- HELPERS ----------
  function $(sel, root) { return (root || document).querySelector(sel); }
  function $all(sel, root) { return Array.prototype.slice.call((root || document).querySelectorAll(sel)); }
  function round(v, d) { d = d || 0; var m = Math.pow(10, d); return Math.round(v * m) / m; }

  /** Run an array of commands sequentially via evalScript. Each command:
   *    { cmd: "funcName", args: data, skipOkCheck: true }
   *  If skipOkCheck is falsy and the response doesn't contain "ok":true, the chain aborts. */
  function runEvalChain(chain, finalCb) {
    var idx = 0;
    function next() {
      if (idx >= chain.length) { return; }
      var task = chain[idx++];
      var isLast = (idx >= chain.length);
      var jsonData = (task.args !== undefined) ? JSON.stringify(task.args) : "";
      var safeData = jsonData.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
      cs.evalScript(task.cmd + "('" + safeData + "')", function (res) {
        if (!task.skipOkCheck && (!res || res.indexOf('"ok":true') === -1)) {
          toast((task.label || "Step") + " failed — aborting", "error");
          if (finalCb) finalCb(res);
          return;
        }
        if (isLast) {
          if (finalCb) finalCb(res);
        } else {
          next();
        }
      });
    }
    next();
  }

  /** Build and run the pre-generate chain: send grids (if needed) then generate. */
  function sendGridsThenGenerate(payload, tab, dotSource, cMode) {
    var chain = [];
    var needsGrid = (tab === 3) || (dotSource === "image");
    if (needsGrid) {
      var grid = HalftonePreview.getLumaGrid();
      if (grid) {
        chain.push({ cmd: "setImageLuma", args: grid, label: "Luma grid" });
        if (cMode === 3) {
          var cg = HalftonePreview.getColorGrid();
          if (cg) chain.push({ cmd: "setImageColors", args: cg, label: "Color grid" });
        }
      }
    }
    if (tab === 3 && state.placeImage && state.imgDataB64) {
      var b64 = state.imgDataB64;
      var mime = state.imgDataMime;
      var CHUNK_SIZE = 35000;
      var total = Math.ceil(b64.length / CHUNK_SIZE);
      for (var ci = 0; ci < total; ci++) {
        var chunkData = b64.substring(ci * CHUNK_SIZE, (ci + 1) * CHUNK_SIZE);
        chain.push({
          cmd: "setPlaceImageChunk",
          args: { idx: ci, total: total, mime: mime, data: chunkData },
          skipOkCheck: true,
          label: "Image " + (ci + 1) + "/" + total
        });
      }
    }
    chain.push({ cmd: "generateWithUndo", args: payload, skipOkCheck: true });
    runEvalChain(chain, generateCb);
  }

  // Debug toggle: double-click v4.0 label
  function initDebugToggle() {
    var ver = document.getElementById("hdr-ver");
    if (ver) {
      ver.style.cursor = "pointer";
      ver.addEventListener("dblclick", function () {
        var d = document.getElementById("debug-raw");
        if (d) d.style.display = d.style.display === "none" ? "block" : "none";
      });
    }
  }

  // ---------- TOAST ----------
  var toastTimer = null;
  function toast(msg, type, duration) {
    var el = document.getElementById("toast");
    el.textContent = msg;
    el.className = "show " + (type || "");
    if (toastTimer) clearTimeout(toastTimer);
    toastTimer = setTimeout(function () { el.className = ""; }, duration || 2500);
  }

  // ---------- TABS ----------
  function initTabs() {
    $all(".tab").forEach(function (btn) {
      btn.addEventListener("click", function () {
        var prev = state.tab;
        var t = parseInt(btn.getAttribute("data-tab"), 10);
        if (t === prev) return;
        saveTabState(prev);
        state.tab = t;
        restoreTabState(t);
        $all(".tab").forEach(function (b) { b.classList.toggle("active", b === btn); });
        $all(".tab-panel").forEach(function (p) {
          p.classList.toggle("hidden", parseInt(p.getAttribute("data-panel"), 10) !== t);
        });
        updateColorUI();
        syncUIFromState();
        schedulePreview();
      });
    });
  }

  // ---------- SLIDERS ----------
  function initAllSliders() {
    $all('input[type=range][data-key]').forEach(function (s) {
      var key = s.getAttribute("data-key");
      s.addEventListener("input", function () {
        var v = parseFloat(s.value);
        if (key === "gamma") v = round(v, 2);
        state[key] = v;
        var valSpans = document.querySelectorAll('.val[data-val="' + key + '"]');
        var txt = (key === "gamma" || key === "midpoint" || key === "lineW" || key === "lineWMax") ? v.toFixed(2) : '' + Math.round(v);
        for (var vi = 0; vi < valSpans.length; vi++) valSpans[vi].textContent = txt;
        schedulePreview();
      });
    });
  }

  // ---------- SHAPES ----------
  function initShapeRadios() {
    function bind(group, key, source) {
      $all('input[name="' + group + '"]').forEach(function (r) {
        r.addEventListener("change", function () {
          if (r.checked) state[key] = r.value;
          schedulePreview();
        });
      });
    }
    bind("spots-shape", "shape");
    bind("img-shape", "shape");
    // source radios
    bind("spots-src", "dotSource");
    bind("line-src", "dotSource");
    bind("stipple-src", "dotSource");
  }

  // ---------- LINE MODE ----------
  function initLineMode() {
    $all('input[name="line-mode"]').forEach(function (r) {
      r.addEventListener("change", function () {
        if (!r.checked) return;
        state.lineMode = r.value;
        var wavy = document.getElementById("wavy-section");
        wavy.style.display = (r.value === "straight") ? "none" : "block";
        schedulePreview();
      });
    });
  }

  // ---------- COLOR ----------
  function initColor() {
    $all('input[name="color-mode"]').forEach(function (r) {
      r.addEventListener("change", function () {
        if (!r.checked) return;
        state.cMode = parseInt(r.value, 10);
        updateColorUI();
        schedulePreview();
      });
    });
    $all(".slot input[type=checkbox]").forEach(function (cb) {
      cb.addEventListener("change", function () {
        state.colorEn[parseInt(cb.getAttribute("data-color"), 10)] = cb.checked;
        schedulePreview();
      });
    });
    $all(".cpick[data-cidx]").forEach(function (p) {
      p.addEventListener("input", function () {
        state.colors[parseInt(p.getAttribute("data-cidx"), 10)] = p.value;
        schedulePreview();
      });
    });
    $all(".cpick[data-gidx]").forEach(function (p) {
      p.addEventListener("input", function () {
        state.colors[parseInt(p.getAttribute("data-gidx"), 10)] = p.value;
        schedulePreview();
      });
    });
    var g3 = document.querySelector('input[type=checkbox][data-key="grad3"]');
    g3.addEventListener("change", function () {
      state.grad3 = g3.checked;
      document.getElementById("g3-row").classList.toggle("hidden", !g3.checked);
      schedulePreview();
    });
    document.getElementById("grad-dir").addEventListener("change", function (e) {
      state.gradDir = parseInt(e.target.value, 10);
      schedulePreview();
    });
  }

  function updateColorUI() {
    var slots = document.getElementById("color-slots");
    var grad = document.getElementById("color-gradient");
    slots.style.display = (state.cMode === 0 || state.cMode === 1) ? "flex" : "none";
    grad.style.display = (state.cMode === 2) ? "block" : "none";
    document.getElementById("g3-row").classList.toggle("hidden", !state.grad3);
    // enable/disable flat slot 0 always, others only in multi mode
    $all("#color-slots .slot").forEach(function (slot, i) {
      var enBlock = (state.cMode === 0) ? (i === 0) : true;
      slot.style.opacity = enBlock ? "1" : (state.cMode === 0 ? "0.4" : "1");
    });
  }

  // ---------- CHECKBOXES (dynamics, output, invert) ----------
  function initCheckboxes() {
    $all('input[type=checkbox][data-key]').forEach(function (cb) {
      if (cb.id === "grad3") return; // handled above
      cb.addEventListener("change", function () {
        var key = cb.getAttribute("data-key");
        state[key] = cb.checked;
        if (key === "randRot" || key === "randOpa" || key === "flipH" || key === "flipV") {
          schedulePreview();
        }
        if (key === "invert") schedulePreview();
      });
    });
    document.getElementById("blend-mode").addEventListener("change", function (e) {
      state.blend = e.target.value;
      schedulePreview();
    });
  }

  // ---------- SECTIONS COLLAPSIBLE ----------
  function initSections() {
    $all(".sec-head").forEach(function (h) {
      h.addEventListener("click", function () {
        h.parentNode.classList.toggle("collapsed");
      });
    });
  }

  // ---------- CUSTOM SYMBOL ----------
  function initCustomSymbol() {
    var capBtn = document.getElementById("cap-shape");
    var clrBtn = document.getElementById("cap-clear");
    var nameEl = document.getElementById("sym-name");

    capBtn.addEventListener("click", function () {
      capBtn.disabled = true;
      cs.evalScript("captureCustomShape()", function (res) {
        capBtn.disabled = false;
        if (!res) { toast("No response from engine", "error"); return; }
        try {
          var obj = JSON.parse(res);
          if (obj.ok) {
            state.customPts = obj.pts;
            state.customName = obj.name;
            nameEl.textContent = "Custom: " + obj.name + " (" + obj.pts.length + " pts)";
            // auto-select Custom shape if currently on spots tab
            var cr = document.querySelector('input[name="spots-shape"][value="custom"]');
            if (cr) cr.checked = true;
            state.shape = "custom";
            saveState();
            schedulePreview();
            toast("Custom dot captured", "success");
          } else {
            toast(obj.msg || "Capture failed", "error");
          }
        } catch (e) {
          toast("Bad response from engine", "error");
        }
      });
    });

    clrBtn.addEventListener("click", function () {
      state.customPts = null;
      state.customName = null;
      nameEl.textContent = "No custom symbol captured";
      saveState();
      schedulePreview();
    });
  }

  // ---------- IMAGE IMPORT ----------
  function initImageImport() {
    var dz = document.getElementById("drop-zone");
    var input = document.getElementById("img-input");

    dz.addEventListener("click", function () { input.click(); });
    input.addEventListener("change", function (e) {
      var f = e.target.files[0];
      if (f) handleFile(f);
    });
    ["dragenter", "dragover"].forEach(function (ev) {
      dz.addEventListener(ev, function (e) { e.preventDefault(); dz.classList.add("dragover"); });
    });
    ["dragleave", "drop"].forEach(function (ev) {
      dz.addEventListener(ev, function (e) { e.preventDefault(); dz.classList.remove("dragover"); });
    });
    dz.addEventListener("drop", function (e) {
      var dt = e.dataTransfer;
      if (dt && dt.files.length) handleFile(dt.files[0]);
    });
    document.getElementById("img-clear").addEventListener("click", function () {
      HalftonePreview.clearImage();
      state.imgDataB64 = null;
      state.imgDataMime = null;
      document.getElementById("img-name").textContent = "No image loaded";
      input.value = "";
      toast("Image cleared", "success");
      schedulePreview();
    });
  }

  function handleFile(f) {
    if (!f.type.startsWith("image/")) { toast("Not an image file", "error"); return; }
    var reader = new FileReader();
    reader.onload = function (e) {
      var src = e.target.result;
      var parts = src.split(",");
      var header = parts[0];
      state.imgDataMime = header.split(":")[1].split(";")[0];
      state.imgDataB64 = parts[1];
      document.getElementById("img-name").textContent = "Loaded: " + f.name;
      HalftonePreview.loadImage(src, function (ok, grid, imgW, imgH) {
        if (ok && grid) {
          state.imgLoadW = imgW || 0;
          state.imgLoadH = imgH || 0;
          schedulePreview();
          toast("Image loaded (" + f.name + ")", "success");
        } else {
          toast("Failed to load image", "error");
        }
      });
    };
    reader.readAsDataURL(f);
  }

  // ---------- PRESETS ----------
  function initPresets() {
    var sel = document.getElementById("preset-select");
    sel.innerHTML = '<option value="-1">— Presets —</option>';
    PRESETS.forEach(function (p, i) {
      var o = document.createElement("option");
      o.value = i; o.textContent = p.name;
      sel.appendChild(o);
    });
    sel.addEventListener("change", function () {
      var idx = parseInt(sel.value, 10);
      if (idx < 0 || idx >= PRESETS.length) return;
      applyPreset(PRESETS[idx]);
    });
  }

  function applyPreset(p) {
    // Save current tab state before reset
    saveTabState(state.tab);
    // Reset to defaults so unset properties don't leak from previous preset
    var cpts = state.customPts, cnm = state.customName;
    resetState();
    state.customPts = cpts;
    state.customName = cnm;
    Object.keys(p).forEach(function (k) {
      if (k === "name") return;
      state[k] = (k === "colors") ? p.colors.slice() :
                 (k === "colorEn") ? p.colorEn.slice() :
                 JSON.parse(JSON.stringify(p[k]));
    });
    // switch tabs and reseed snapshot for the target tab
    state.tab = p.tab;
    saveTabState(p.tab);
    $all(".tab").forEach(function (b) {
      b.classList.toggle("active", parseInt(b.getAttribute("data-tab"), 10) === p.tab);
    });
    $all(".tab-panel").forEach(function (panel) {
      panel.classList.toggle("hidden", parseInt(panel.getAttribute("data-panel"), 10) !== p.tab);
    });
    // line wavy section
    var wavy = document.getElementById("wavy-section");
    wavy.style.display = (state.lineMode === "straight") ? "none" : "block";
    updateColorUI();
    syncUIFromState();
    schedulePreview();
    toast("Preset: " + p.name, "success");
  }

  // ---------- SYNC UI FROM STATE ----------
  function syncUIFromState() {
    // sliders
    $all('input[type=range][data-key]').forEach(function (s) {
      var key = s.getAttribute("data-key");
      if (state[key] === undefined) return;
      s.value = state[key];
      var valSpans = document.querySelectorAll('.val[data-val="' + key + '"]');
      var txt = (key === "gamma" || key === "midpoint" || key === "lineW" || key === "lineWMax") ? parseFloat(state[key]).toFixed(2) : '' + Math.round(state[key]);
      for (var vi = 0; vi < valSpans.length; vi++) valSpans[vi].textContent = txt;
    });
    // checkboxes
    $all('input[type=checkbox][data-key]').forEach(function (cb) {
      var key = cb.getAttribute("data-key");
      if (state[key] !== undefined) cb.checked = !!state[key];
    });
    // selects
    var bm = document.getElementById("blend-mode");
    if (bm) bm.value = state.blend;
    var gd = document.getElementById("grad-dir");
    if (gd) gd.value = state.gradDir;
    // shape radios per visible tab
    var shapeGroup = state.tab === 0 ? "spots-shape" :
                     state.tab === 3 ? "img-shape" : null;
    if (shapeGroup) {
      $all('input[name="' + shapeGroup + '"]').forEach(function (r) {
        r.checked = (r.value === state.shape);
      });
    }
    // source radios per tab
    var srcGroup = state.tab === 0 ? "spots-src" :
                   state.tab === 1 ? "line-src" :
                   state.tab === 2 ? "stipple-src" : null;
    if (srcGroup) {
      $all('input[name="' + srcGroup + '"]').forEach(function (r) {
        r.checked = (r.value === state.dotSource);
      });
    }
    // line mode
    if (state.tab === 1) {
      $all('input[name="line-mode"]').forEach(function (r) { r.checked = (r.value === state.lineMode); });
      document.getElementById("wavy-section").style.display = (state.lineMode === "straight") ? "none" : "block";
    }
    // color mode
    $all('input[name="color-mode"]').forEach(function (r) {
      r.checked = (parseInt(r.value, 10) === state.cMode);
    });
    // color enable checkboxes
    $all("#color-slots .slot input[type=checkbox]").forEach(function (cb) {
      var i = parseInt(cb.getAttribute("data-color"), 10);
      cb.checked = !!state.colorEn[i];
    });
    // color pickers
    $all(".cpick[data-cidx]").forEach(function (p) {
      p.value = state.colors[parseInt(p.getAttribute("data-cidx"), 10)] || "#000000";
    });
    $all(".cpick[data-gidx]").forEach(function (p) {
      p.value = state.colors[parseInt(p.getAttribute("data-gidx"), 10)] || "#000000";
    });
    // g3 row
    document.getElementById("g3-row").classList.toggle("hidden", !state.grad3);
    // custom sym name
    var sn = document.getElementById("sym-name");
    if (state.customName) sn.textContent = "Custom: " + state.customName + " (" + (state.customPts ? state.customPts.length : 0) + " pts)";
  }

  // ---------- GENERATE ----------
  var generateCb = null; // set inside initGenerate

  function initGenerate() {
    var btn = document.getElementById("generate");
    generateCb = function (res) {
      btn.disabled = false;
      btn.textContent = "Generate";
      var dbg = document.getElementById("debug-raw");
      if (dbg) { dbg.textContent = "RAW: " + (res ? res.substring(0, 800) : "(null)"); dbg.style.display = "block"; }
      if (!res) { toast("No response from Illustrator", "error"); return; }
      try {
        var obj = JSON.parse(res);
        if (obj.ok) {
          var extra = obj._dbg ? " | bnds:" + obj._dbg.bounds.W + "x" + obj._dbg.bounds.H + " L:" + Math.round(obj._dbg.testLumaCenter*100) + " T:" + Math.round(obj._dbg.testLumaTop*100) + " B:" + Math.round(obj._dbg.testLumaBot*100) : "";
          toast("Generated " + obj.count + " shape" + ((obj.count === 1) ? "" : "s") + extra, "success", 5000);
        } else {
          toast(obj.msg || "Generation failed", "error", 3500);
        }
      } catch (e) {
        toast("Generation failed (bad response)", "error", 3500);
      }
    };

    btn.addEventListener("click", function () {
      btn.disabled = true;
      btn.textContent = "Generating…";
      // Build config payload (NO grid data — sent separately)
      var config = {};
      for (var k in state) config[k] = state[k];
      // Remove data-only keys — grids and image data go through separate evalScript calls
      delete config.lumaGrid;
      delete config.imgColorGrid;
      delete config.imageGrids;
      delete config.imgDataB64;
      delete config.imgDataMime;
      delete config.docBounds; // engine recomputes bounds from document
      // Send raw config object — runEvalChain handles JSON.stringify + escaping
      sendGridsThenGenerate(config, state.tab, state.dotSource, state.cMode);
    });
  }

  // ---------- PREVIEW SCHEDULING ----------
  function schedulePreview() {
    HalftonePreview.scheduleRender(Object.assign({}, state));
  }

  // ---------- STATE PERSISTENCE ----------
  function saveState() {
    try {
      localStorage.setItem("hp4_customPts", JSON.stringify(state.customPts));
      localStorage.setItem("hp4_customName", state.customName || "");
    } catch (e) {}
  }
  function loadSavedState() {
    try {
      var pts = localStorage.getItem("hp4_customPts");
      var nm = localStorage.getItem("hp4_customName");
      if (pts) state.customPts = JSON.parse(pts);
      if (nm) state.customName = nm;
      if (state.customName) {
        var sn = document.getElementById("sym-name");
        if (sn) sn.textContent = "Custom: " + state.customName + " (" + (state.customPts ? state.customPts.length : 0) + " pts)";
      }
      if (state.customPts) {
        // restore into engine
        var payload = JSON.stringify(state.customPts);
        var safe = payload.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
        cs.evalScript("setCustomPts('" + safe + "')", function () {});
      }
    } catch (e) {}
  }

  // ---------- DOCUMENT BOUNDS ----------
  function refreshDocBounds(cb) {
    cs.evalScript("getDocBounds()", function (res) {
      if (!res) { if (cb) cb(null); return; }
      try {
        var obj = JSON.parse(res);
        if (obj.ok && obj.W > 0 && obj.H > 0) {
          state.docBounds = { L: obj.L, T: obj.T, R: obj.R, B: obj.B, W: obj.W, H: obj.H, hasSelection: obj.hasSelection };
        } else {
          state.docBounds = null;
        }
      } catch (e) { state.docBounds = null; }
      if (cb) cb(state.docBounds);
      // Re-render preview with new bounds
      schedulePreview();
    });
  }

  // ---------- BACKGROUND TOGGLE / REFRESH ----------
  function initPreviewControls() {
    $all(".bg-btn").forEach(function (b) {
      b.addEventListener("click", function () {
        $all(".bg-btn").forEach(function (x) { x.classList.remove("active"); });
        b.classList.add("active");
        HalftonePreview.setBg(b.getAttribute("data-bg"));
      });
    });
    document.getElementById("preview-refresh").addEventListener("click", function () {
      refreshDocBounds();
    });
  }

  // ---------- INIT ----------
  function init() {
    initTabs();
    initAllSliders();
    initShapeRadios();
    initLineMode();
    initColor();
    initCheckboxes();
    initSections();
    initCustomSymbol();
    initImageImport();
    initPresets();
    initGenerate();
    initPreviewControls();
    initDebugToggle();
    updateColorUI();
    loadSavedState();
    syncUIFromState();
    HalftonePreview.setBg("white");
    // Fetch doc bounds asynchronously; preview will update once received
    refreshDocBounds();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }
})();
