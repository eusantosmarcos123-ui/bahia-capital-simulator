@echo off
title Parar Bahia Capital
echo Parando servidor Bahia Capital...
for /f "tokens=5" %%a in ('netstat -aon ^| findstr :4000 ^| findstr LISTENING') do taskkill /F /PID %%a 2>nul
echo Servidor finalizado com sucesso!
pause
