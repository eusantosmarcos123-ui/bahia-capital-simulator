@echo off
title Bahia Capital - Simulador de Investimentos
cd /d "%~dp0"
echo ===============================================================
echo   BAHIA CAPITAL CONSULTORIA - SIMULADOR DE INVESTIMENTOS
echo   Iniciando servidor local na porta 4000...
echo ===============================================================
start http://localhost:4000
node src/server.js
pause
