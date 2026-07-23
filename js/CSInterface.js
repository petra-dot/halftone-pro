/**************************************************************************************************
 * Adobe CEP CSInterface v11 - condensed for Halftone Pro
 * Provides JS <-> ExtendScript <-> host app communication.
 * Original (c) Adobe Systems Incorporated. Distributed under Apache 2.0.
 **************************************************************************************************/
function CSEvent(type, scope, appId, extensionId) {
  this.type = type;
  this.scope = scope;
  this.appId = appId;
  this.extensionId = extensionId;
  this.data = "";
}
function SystemPath() {}
SystemPath.USER_DATA = "userData";
SystemPath.COMMON_FILES = "commonFiles";
SystemPath.MY_DOCUMENTS = "myDocuments";
SystemPath.APPLICATION = "application";
SystemPath.EXTENSION = "extension";
SystemPath.HOST_APPLICATION = "hostApplication";
function ColorType() {}
ColorType.rgb = "rgb";
ColorType.gradient = "gradient";
ColorType.none = "none";
function RGBColor(red, green, blue, alpha) {
  this.red = red;
  this.green = green;
  this.blue = blue;
  this.alpha = alpha;
  this.type = ColorType.rgb;
}
function Direction(x, y) {
  this.x = x;
  this.y = y;
}
function GradientStop(offset, rgbColor) {
  this.offset = offset;
  this.rgbColor = rgbColor;
}
function GradientColor(direction, numStops, gradientStopList) {
  this.direction = direction;
  this.numStops = numStops;
  this.gradientStopList = gradientStopList;
  this.type = ColorType.gradient;
}
function UIColor(type, antialiasLevel, color) {
  this.type = type;
  this.antialiasLevel = antialiasLevel;
  this.color = color;
}
function AppSkinInfo(baseFontFamily, baseFontSize, appBarBackgroundColor, panelBackgroundColor, appBarBackgroundColorSRGB, panelBackgroundColorSRGB, systemHighlightColor) {
  this.baseFontFamily = baseFontFamily;
  this.baseFontSize = baseFontSize;
  this.appBarBackgroundColor = appBarBackgroundColor;
  this.panelBackgroundColor = panelBackgroundColor;
  this.appBarBackgroundColorSRGB = appBarBackgroundColorSRGB;
  this.panelBackgroundColorSRGB = panelBackgroundColorSRGB;
  this.systemHighlightColor = systemHighlightColor;
}
function HostEnvironment(appName, appVersion, appLocale, appUILocale, appId, appData, appSandboxLevel, isMainThreadOnline, appSkinInfo) {
  this.appName = appName;
  this.appVersion = appVersion;
  this.appLocale = appLocale;
  this.appUILocale = appUILocale;
  this.appId = appId;
  this.appData = appData;
  this.appSandboxLevel = appSandboxLevel;
  this.isMainThreadOnline = isMainThreadOnline;
  this.appSkinInfo = appSkinInfo;
}
function HostCapabilities(EXTENDED_PANEL_MENU, EXTENDED_PANEL_ICONS, DELEGATE_APE_ENGINE, SUPPORT_HTML_EXTENSIONS, DISABLE_FLASH_EXTENSION, ENABLE_3D) {
  this.EXTENDED_PANEL_MENU = EXTENDED_PANEL_MENU;
  this.EXTENDED_PANEL_ICONS = EXTENDED_PANEL_ICONS;
  this.DELEGATE_APE_ENGINE = DELEGATE_APE_ENGINE;
  this.SUPPORT_HTML_EXTENSIONS = SUPPORT_HTML_EXTENSIONS;
  this.DISABLE_FLASH_EXTENSION = DISABLE_FLASH_EXTENSION;
  this.ENABLE_3D = ENABLE_3D;
}
function ApiVersion(major, minor, micro) {
  this.major = major;
  this.minor = minor;
  this.micro = micro;
}
function MenuItemStatus(menuItemLabel, enabled, checked) {
  this.menuItemLabel = menuItemLabel;
  this.enabled = enabled;
  this.checked = checked;
}
function ContextMenuItemStatus(menuItemID, enabled, checked) {
  this.menuItemID = menuItemID;
  this.enabled = enabled;
  this.checked = checked;
}
function Extension(id, name, mainPath, basePath, windowType, width, height, minWidth, minHeight, maxWidth, maxHeight, defaultExtensionData, specialExtensionData, requiredRuntimeList, isAutoVisible, isExtensionVisibleInZW) {
  this.id = id;
  this.name = name;
  this.mainPath = mainPath;
  this.basePath = basePath;
  this.windowType = windowType;
  this.width = width;
  this.height = height;
  this.minWidth = minWidth;
  this.minHeight = minHeight;
  this.maxWidth = maxWidth;
  this.maxHeight = maxHeight;
  this.defaultExtensionData = defaultExtensionData;
  this.specialExtensionData = specialExtensionData;
  this.requiredRuntimeList = requiredRuntimeList;
  this.isAutoVisible = isAutoVisible;
  this.isExtensionVisibleInZW = isExtensionVisibleInZW;
}
function CSEventScope(_type) { this._type = _type; }
CSEventScope.GLOBAL = "global";
CSEventScope.APPLICATION = "application";
CSEventScope.EXTENSION = "extension";
CSEventSourceType = { APPLICATION_ACTIVATED: "applicationActivated", APPLICATION_DEACTIVATED: "applicationDeactivated", DOCUMENT_OPENED: "documentOpened", DOCUMENT_CLOSED: "documentClosed", DOCUMENT_SAVING: "documentSaving", STATE_CHANGED: "stateChanged" };
function CSXSInterface() {
  this.hostEnvironment = null;
  this.hostCapabilities = null;
  this.apiVersion = null;
  this._events = {};
}
CSXSInterface.prototype.init = function () {
  var that = this;
  return new Promise(function (resolve, reject) {
    try {
      if (typeof window.__adobe_cep__ !== "undefined") {
        that._initFromHost();
        resolve(that);
      } else {
        var script = document.createElement("script");
        script.src = "https://wwwimages2.adobe.com/etc/clientlibs/beagle/cep/csinterface.js";
        script.onload = function () { resolve(that); };
        script.onerror = function () { resolve(that); };
        document.head.appendChild(script);
      }
    } catch (e) { resolve(that); }
  });
};
CSXSInterface.prototype._initFromHost = function () {
  var json = window.__adobe_cep__.getHostEnvironment();
  if (json) {
    var env = JSON.parse(json);
    this.hostEnvironment = new HostEnvironment(env.appName, env.appVersion, env.appLocale, env.appUILocale, env.appId, env.appData, env.appSandboxLevel, env.isMainThreadOnline, env.appSkinInfo);
  }
};
CSXSInterface.prototype.addEventListener = function (type, listener, obj) {
  if (typeof window.__adobe_cep__ !== "undefined") {
    window.__adobe_cep__.addEventListener(type, listener, obj);
  } else {
    if (!this._events[type]) this._events[type] = [];
    this._events[type].push({ listener: listener, obj: obj });
  }
};
CSXSInterface.prototype.removeEventListener = function (type, listener, obj) {
  if (typeof window.__adobe_cep__ !== "undefined") {
    window.__adobe_cep__.removeEventListener(type, listener, obj);
  } else if (this._events[type]) {
    this._events[type] = this._events[type].filter(function (e) { return e.listener !== listener; });
  }
};
CSXSInterface.prototype.dispatchEvent = function (event) {
  if (typeof window.__adobe_cep__ !== "undefined") {
    if (typeof event.data == "object") event.data = JSON.stringify(event.data);
    window.__adobe_cep__.dispatchEvent(event);
  } else if (this._events[event.type]) {
    this._events[event.type].forEach(function (e) {
      try { e.listener.call(e.obj, event); } catch (err) {}
    });
  }
};
CSXSInterface.prototype.requestExtensionExtension = function () {};
CSXSInterface.prototype.getExtensionIDs = function () { return []; };

/** Main CSInterface class used by panels. */
function CSInterface() {
  this.hostEnvironment = JSON.parse(window.__adobe_cep__ ? window.__adobe_cep__.getHostEnvironment() : '{"appName":"ILST"}');
  this.os = (function () {
    if (typeof navigator != "undefined" && navigator.appVersion) {
      var ua = navigator.appVersion.toLowerCase();
      if (ua.indexOf("win") != -1) return "Windows";
      if (ua.indexOf("mac") != -1) return "MacOS";
      if (ua.indexOf("linux") != -1) return "Linux";
    }
    return "Unknown";
  })();
  this.hostCapabilities = JSON.parse(window.__adobe_cep__ ? window.__adobe_cep__.getHostCapabilities() : "{}");
  this.apiVersion = window.__adobe_cep__ ? window.__adobe_cep__._getCurrentApiVersion ? JSON.parse(window.__adobe_cep__.getCurrentApiVersion()) : { major: 11, minor: 0, micro: 0 } : { major: 11, minor: 0, micro: 0 };
}
CSInterface.THEME_COLOR_CHANGED_EVENT = "com.adobe.csxs.events.ThemeColorChanged";
CSInterface.prototype.getHostEnvironment = function () { return this.hostEnvironment; };
CSInterface.prototype.closeExtension = function () { window.__adobe_cep__.closeExtension(); };
CSInterface.prototype.getSystemPath = function (pathType) {
  if (!window.__adobe_cep__) return "";
  var path = decodeURI(window.__adobe_cep__.getSystemPath(pathType));
  var OSVersion = this.getOSInformation();
  if (OSVersion.indexOf("Windows") >= 0) {
    path = path.replace("file:///", "");
  } else if (OSVersion.indexOf("Mac") >= 0) {
    path = path.replace("file://", "");
  }
  return path;
};
CSInterface.prototype.evalScript = function (script, callback) {
  if (callback === null || callback === undefined) callback = function (result) {};
  if (window.__adobe_cep__) {
    window.__adobe_cep__.evalScript(script, callback);
  } else {
    try { callback(JSON.stringify({ ok: false, msg: "Not running inside CEP host." })); }
    catch (e) { callback("evalScript unavailable"); }
  }
};
CSInterface.prototype.getApplicationID = function () { return this.hostEnvironment.appId; };
CSInterface.prototype.getHostCapabilities = function () { return this.hostCapabilities; };
CSInterface.prototype.dispatchEvent = function (event) {
  if (typeof event.data == "object") event.data = JSON.stringify(event.data);
  window.__adobe_cep__ && window.__adobe_cep__.dispatchEvent(event);
};
CSInterface.prototype.addEventListener = function (type, listener, obj) {
  window.__adobe_cep__ && window.__adobe_cep__.addEventListener(type, listener, obj);
};
CSInterface.prototype.removeEventListener = function (type, listener, obj) {
  window.__adobe_cep__ && window.__adobe_cep__.removeEventListener(type, listener, obj);
};
CSInterface.prototype.requestOpenExtension = function (extensionId, params) {
  window.__adobe_cep__ && window.__adobe_cep__.requestOpenExtension(extensionId, params);
};
CSInterface.prototype.getExtensions = function (extensionIds, callback) {
  if (window.__adobe_cep__) window.__adobe_cep__.getExtensions(extensionIds, callback); else callback([]);
};
CSInterface.prototype.getNetworkPreferences = function () {
  if (!window.__adobe_cep__) return {};
  return JSON.parse(window.__adobe_cep__.getNetworkPreferences());
};
CSInterface.prototype.initResourceBundle = function () { return {}; };
CSInterface.prototype.getCurrentApiVersion = function () { return this.apiVersion; };
CSInterface.prototype.setPanelFlyoutMenu = function (menu) { window.__adobe_cep__ && window.__adobe_cep__.invokeSync("setPanelFlyoutMenu", menu); };
CSInterface.prototype.updatePanelMenuItem = function (menuItemLabel, enabled, checked) {
  var ret = false;
  if (this.getExtensionID && window.__adobe_cep__) {
    var itemStatus = new MenuItemStatus(menuItemLabel, enabled, checked);
    ret = window.__adobe_cep__.invokeSync("updatePanelMenuItem", JSON.stringify(itemStatus));
  }
  return ret;
};
CSInterface.prototype.setContextMenu = function (menu, callback) { window.__adobe_cep__ && window.__adobe_cep__.invokeAsync("setContextMenu", menu, callback); };
CSInterface.prototype.setContextMenuByJSON = function (menu, callback) { window.__adobe_cep__ && window.__adobe_cep__.invokeAsync("setContextMenuByJSON", menu, callback); };
CSInterface.prototype.updateContextMenuItem = function (menuItemID, enabled, checked) {
  var itemStatus = new ContextMenuItemStatus(menuItemID, enabled, checked);
  window.__adobe_cep__ && window.__adobe_cep__.invokeSync("updateContextMenuItem", JSON.stringify(itemStatus));
};
CSInterface.prototype.isWindowVisible = function () { return window.__adobe_cep__ ? window.__adobe_cep__.invokeSync("isWindowVisible", "") : false; };
CSInterface.prototype.resizeContent = function (width, height) { window.__adobe_cep__ && window.__adobe_cep__.resizeContent(width, height); };
CSInterface.prototype.registerInvalidCertificateCallback = function (callback) { window.__adobe_cep__ && window.__adobe_cep__.registerInvalidCertificateCallback(callback); };
CSInterface.prototype.registerKeyEventsInterest = function (keyEventsInterest) { return window.__adobe_cep__ ? window.__adobe_cep__.registerKeyEventsInterest(keyEventsInterest) : null; };
CSInterface.prototype.setWindowTitle = function (title) { window.__adobe_cep__ && window.__adobe_cep__.invokeSync("setWindowTitle", title); };
CSInterface.prototype.getWindowTitle = function () { return window.__adobe_cep__ ? window.__adobe_cep__.invokeSync("getWindowTitle", "") : ""; };
CSInterface.prototype.getOSInformation = function () { return this.os + " " + (navigator.userAgentData ? "" : navigator.userAgent); };
