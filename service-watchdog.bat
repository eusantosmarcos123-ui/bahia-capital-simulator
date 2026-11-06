@echo off
title Bahia Capital - Permanent Service Watchdog
cd /d "%~dp0"

:loop
echo [%date% %time%] Iniciando servidor Bahia Capital... >> watchdog.log
node src/server.js >> server.log 2>&1
echo [%date% %time%] Servidor parou com codigo %errorlevel%. Reiniciando em 2 segundos... >> watchdog.log
timeout /t 2 /nobreak >nul
goto loop
