@echo off
cd /d "%~dp0"
:loop
node src/server.js
timeout /t 2 /nobreak >nul
goto loop
