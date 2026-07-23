# Security & Installation Notes

## Installer Behavior

The provided installers (`install-mac.sh`, `install-windows.bat`) perform the following system modifications:

### macOS Installer
- Enables `PlayerDebugMode` for Adobe CSXS versions 11–15 via `defaults write`
- Copies the extension folder to `~/Library/Application Support/Adobe/CEP/extensions/`
- Requires `chmod +x` before execution

**Permissions:** Read/write to user home directory only. No admin escalation.

### Windows Installer
- Enables `PlayerDebugMode` for Adobe CSXS versions 11–15 via registry
- Requires **Administrator** privileges to modify `HKEY_CURRENT_USER\Software\Adobe\CSXS.*`
- Copies the extension folder to `%APPDATA%\Adobe\CEP\extensions\`

**Permissions:** User registry hive only. Does not modify system registry.

---

## CEP Extension Security

This extension uses Adobe's **CEP (Common Extensibility Platform)** framework to integrate with Illustrator.

- **Code execution:** ExtendScript (`jsx/engine.jsx`) runs within Illustrator's sandbox - it cannot access the filesystem outside of Illustrator's own documents, nor execute arbitrary system commands
- **Unsigned:** This extension runs unsigned and requires `PlayerDebugMode` to load. Adobe recommends disabling unsigned extensions after use for security
- **Data:** No telemetry, analytics, or data collection. All processing is local to your machine
- **Network:** No network requests

---

## Recommended Security Practice

After installation:
1. Verify the extension loads in **Window > Extensions > Halftone Pro**
2. If you don't use this extension regularly, consider disabling `PlayerDebugMode` after use:

   **macOS:**
   ```bash
   defaults delete com.adobe.CSXS.11 PlayerDebugMode
   ```

   **Windows (Admin PowerShell):**
   ```powershell
   Remove-ItemProperty -Path "HKCU:\Software\Adobe\CSXS.11" -Name PlayerDebugMode
   ```

## Reporting Security Issues

If you discover a security vulnerability, please report it privately via GitHub (do not open a public issue). Include:
- Steps to reproduce
- Affected Illustrator version and OS
- Potential impact

## Open-Source Contributions

This repository accepts bug reports and feature requests via GitHub issues. Code contributions are welcome and will be attributed to you.

See the [LICENSE](LICENSE) file for full terms.
