@echo off
setlocal
cd /d "%~dp0"
where node.exe >nul 2>&1
if errorlevel 1 goto missing
where npm.cmd >nul 2>&1
if errorlevel 1 goto missing
call npm.cmd start
if errorlevel 1 goto failed
exit /b 0
:missing
echo Node.js x64 and npm are required for the source version.
:failed
echo KAKA could not start. See the error above.
pause
exit /b 1
