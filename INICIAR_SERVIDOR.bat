@echo off
title BAHIA CAPITAL - SIMULADOR EDUCACIONAL DE INVESTIMENTOS
color 0A
cls
echo ===============================================================
echo    🏛️  INICIANDO O SERVIDOR BAHIA CAPITAL CONSULTORIA
echo ===============================================================
echo.
cd /d "%~dp0"
echo [1/2] Abrindo navegador em http://localhost:4000 ...
start "" "http://localhost:4000"
echo.
echo [2/2] Subindo servidor Node.js (NAO FECHE ESTA JANELA)...
echo.
node src/server.js
pause
