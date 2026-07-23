@echo off
SETLOCAL EnableDelayedExpansion
echo ============================================
echo  Halftone Pro by Petra-dot - v4.0
echo  Windows installer
echo ============================================
echo.
echo.⚠️  This installer will:
echo    1. Enable PlayerDebugMode for Adobe CSXS extensions
echo    2. Copy the extension to %%APPDATA%%\Adobe\CEP\extensions\
echo.
echo No system files will be modified. To reverse, run uninstall-windows.bat
echo.
set /p proceed="Continue? (y/n): "
if /i not "%proceed%"=="y" exit /b 1

REM ---- Enable PlayerDebugMode so unsigned CEP extensions load ----
echo Enabling PlayerDebugMode for CSXS.11 and CSXS.12 ...
for %%v in (11 12 13 14 15) do reg add "HKEY_CURRENT_USER\Software\Adobe\CSXS.%%v" /v PlayerDebugMode /t REG_SZ /d 1 /f >nul 2>&1

REM ---- Locate extension folder (this script sits next to it) ----
set "SRC=%~dp0com.petradot.halftonepro"
if not exist "%SRC%" (
  set "SRC=%~dp0"
)
if not exist "%SRC%\CSXS\manifest.xml" (
  echo ERROR: Cannot find CSXS\manifest.xml next to this installer.
  echo Expected at: %SRC%\CSXS\
  pause
  exit /b 1
)

set "DEST=%APPDATA%\Adobe\CEP\extensions\com.petradot.halftonepro"

echo.
echo Installing extension to:
echo   %DEST%
if exist "%DEST%" rmdir /S /Q "%DEST%"
xcopy "%SRC%" "%DEST%\" /E /I /Y /Q
if errorlevel 1 (
  echo Install failed.
  pause
  exit /b 1
)

echo.
echo ============================================
echo  Done. Restart Adobe Illustrator, then:
echo  Window ^> Extensions ^> Halftone Pro
echo ============================================
echo.
pause
