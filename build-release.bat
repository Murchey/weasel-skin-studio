@echo off
setlocal EnableExtensions
cd /d "%~dp0"

set "APP_NAME=weasel-skin-studio"
set "RELEASE_DIR=%~dp0release"
set "BUNDLE_DIR=%~dp0src-tauri\target\release\bundle"
set "EXE_DIR=%~dp0src-tauri\target\release"
set "SKIP_BUILD=0"
if /i "%~1"=="--skip-build" set "SKIP_BUILD=1"

echo ============================================
echo   Weasel Skin Studio Build Release
echo   Output: release\
echo   Usage:  build-release.bat [--skip-build]
echo ============================================
echo.

where node >nul 2>&1
if errorlevel 1 goto :no_node
where npm >nul 2>&1
if errorlevel 1 goto :no_npm

if "%SKIP_BUILD%"=="1" goto :skip_tool_cargo
where cargo >nul 2>&1
if errorlevel 1 goto :no_cargo
:skip_tool_cargo

for /f "tokens=*" %%v in ('node -v') do set "NODE_VER=%%v"
for /f "delims=" %%v in ('node -p "require('./package.json').version"') do set "APP_VERSION=%%v"
if not defined APP_VERSION goto :no_version
if "%APP_VERSION%"=="" goto :no_version
set "OUT_SETUP=Weasel-Skin-Studio-%APP_VERSION%-setup.exe"
set "OUT_PORTABLE=Weasel-Skin-Studio-%APP_VERSION%-portable.exe"
echo [ENV] Node %NODE_VER%  /  Version %APP_VERSION%

if "%SKIP_BUILD%"=="1" goto :deps_skip
if exist "%~dp0node_modules" goto :deps_ok
echo.
echo [1/3] Installing npm dependencies...
call npm ci
if errorlevel 1 goto :npm_fail
goto :after_deps
:deps_ok
echo.
echo [1/3] node_modules exists, skip install.
goto :after_deps
:deps_skip
echo.
echo [1/3] Skip build mode - skip npm install.
:after_deps

if "%SKIP_BUILD%"=="1" goto :after_build
echo.
echo [2/3] Building Tauri release packages NSIS + MSI...
echo       First build may take several minutes.
echo.
call npm run tauri:build
if errorlevel 1 goto :build_fail
goto :after_build
:after_build

if "%SKIP_BUILD%"=="1" echo. & echo [2/3] Skip build mode - reuse existing artifacts.

echo.
echo [3/3] Collecting artifacts into release\ ...
echo       Target names:
echo         %OUT_SETUP%
echo         %OUT_PORTABLE%

if exist "%RELEASE_DIR%" rmdir /s /q "%RELEASE_DIR%"
mkdir "%RELEASE_DIR%"

set "COPIED=0"

rem 1) Tauri NSIS installer -> Weasel-Skin-Studio-{ver}-setup.exe
set "NSIS_SRC="
if exist "%BUNDLE_DIR%\nsis\*.exe" (
    for %%f in ("%BUNDLE_DIR%\nsis\*.exe") do set "NSIS_SRC=%%f"
)
if not defined NSIS_SRC goto :after_nsis
copy /y "%NSIS_SRC%" "%RELEASE_DIR%\%OUT_SETUP%" >nul
if not errorlevel 1 (
    echo   [OK] %OUT_SETUP%
    set /a COPIED+=1
)
:after_nsis

rem 2) Portable / app exe -> Weasel-Skin-Studio-{ver}-portable.exe
if not exist "%EXE_DIR%\%APP_NAME%.exe" goto :after_portable
copy /y "%EXE_DIR%\%APP_NAME%.exe" "%RELEASE_DIR%\%OUT_PORTABLE%" >nul
if not errorlevel 1 (
    echo   [OK] %OUT_PORTABLE%
    set /a COPIED+=1
)
:after_portable

if "%COPIED%"=="0" goto :no_artifact

echo.
echo [EXTRA] Writing SHA256SUMS.txt ...
powershell -NoProfile -Command "Get-ChildItem -File '%RELEASE_DIR%' | Where-Object { $_.Name -ne 'SHA256SUMS.txt' } | ForEach-Object { $h = (Get-FileHash $_.FullName -Algorithm SHA256).Hash.ToLower(); '{0}  {1}' -f $h, $_.Name } | Set-Content -Encoding ascii '%RELEASE_DIR%\SHA256SUMS.txt'"
if exist "%RELEASE_DIR%\SHA256SUMS.txt" echo   [OK] SHA256SUMS.txt

echo.
echo ============================================
echo   Done.
echo.
dir /b "%RELEASE_DIR%"
echo.
echo   Output dir: %RELEASE_DIR%
echo ============================================
echo.
if "%SKIP_BUILD%"=="0" pause
exit /b 0

:no_node
echo [ERROR] node not found. Install Node.js 18+ first.
exit /b 1

:no_npm
echo [ERROR] npm not found. Install Node.js 18+ first.
exit /b 1

:no_cargo
echo [ERROR] cargo not found. Install Rust toolchain first.
exit /b 1

:npm_fail
echo [ERROR] npm install failed.
exit /b 1

:build_fail
echo.
echo [ERROR] Tauri build failed. See logs above.
exit /b 1

:no_artifact
echo [ERROR] No installer artifacts found. Run without --skip-build first.
exit /b 1

:no_version
echo [ERROR] Cannot read version from package.json.
exit /b 1