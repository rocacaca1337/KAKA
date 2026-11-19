@echo off
powershell.exe -NoProfile -ExecutionPolicy Bypass -File "%~dp0setup-fonts.ps1"
if errorlevel 1 (echo Font setup failed. Please copy the error message.)
pause
