@echo off
setlocal
cd /d "%~dp0"
where npm.cmd >nul 2>&1
if errorlevel 1 goto missing
 echo [1/2] Installing build dependencies...
call npm.cmd ci
if errorlevel 1 goto failed
 echo [2/2] Building Windows x64 installer and portable executable...
call npm.cmd run dist
if errorlevel 1 goto failed
for /f "delims=" %%V in ('node -p "require('./package.json').version"') do set "KAKA_VERSION=%%V"
if not defined KAKA_VERSION goto failed
if not exist "dist\KAKA-Setup-%KAKA_VERSION%.exe" goto failed
if not exist "dist\KAKA-Portable-%KAKA_VERSION%.exe" goto failed
echo Build completed. See the dist folder.
explorer "%~dp0dist"
pause
exit /b 0
:missing
echo Node.js and npm are required on the build PC only.
goto failed
:failed
echo Build failed. Review the errors above.
pause
exit /b 1
