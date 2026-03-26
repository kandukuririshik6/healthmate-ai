@echo off
title HealthMate AI Backend Restarter
echo Stopping any existing node processes...
taskkill /F /IM node.exe 2>nul
cd backend
echo Starting HealthMate AI Backend from backend directory...
node server.js
pause
