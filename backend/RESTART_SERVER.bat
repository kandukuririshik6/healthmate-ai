@echo off
title HealthMate AI Backend Restarter
echo Stopping any existing node processes...
taskkill /F /IM node.exe 2>nul
echo Starting HealthMate AI Backend...
node server.js
pause
