@echo off
title GREYNATION NEURAL OS — STARTUP
color 0B

echo.
echo  ██████╗ ██████╗ ███████╗██╗   ██╗███╗   ██╗ █████╗ ████████╗██╗ ██████╗ ███╗   ██╗
echo ██╔════╝ ██╔══██╗██╔════╝╚██╗ ██╔╝████╗  ██║██╔══██╗╚══██╔══╝██║██╔═══██╗████╗  ██║
echo ██║  ███╗██████╔╝█████╗   ╚████╔╝ ██╔██╗ ██║███████║   ██║   ██║██║   ██║██╔██╗ ██║
echo ██║   ██║██╔══██╗██╔══╝    ╚██╔╝  ██║╚██╗██║██╔══██║   ██║   ██║██║   ██║██║╚██╗██║
echo ╚██████╔╝██║  ██║███████╗   ██║   ██║ ╚████║██║  ██║   ██║   ██║╚██████╔╝██║ ╚████║
echo  ╚═════╝ ╚═╝  ╚═╝╚══════╝   ╚═╝   ╚═╝  ╚═══╝╚═╝  ╚═╝   ╚═╝   ╚═╝ ╚═════╝ ╚═╝  ╚═══╝
echo.
echo  NEURAL OS // JARVIS MODE // BOOTING ALL SYSTEMS...
echo.

set ANTHROPIC_API_KEY=your_anthropic_api_key_here
set GRAVITY_CLAW=C:\Users\hustl\Downloads\New folder\gravity-claw
set OPENJARVIS=%GRAVITY_CLAW%\OpenJarvis

echo [1/5] Starting OpenJarvis server on port 8000...
start "OPENJARVIS" cmd /k "cd /d "%OPENJARVIS%" && set ANTHROPIC_API_KEY=%ANTHROPIC_API_KEY% && uv run jarvis serve --port 8000"
timeout /t 3 /nobreak >nul

echo [2/5] Starting CORS proxy for OpenJarvis on port 8010...
start "CORS-OPENJARVIS" cmd /k "npx local-cors-proxy --proxyUrl http://127.0.0.1:8000 --port 8010"
timeout /t 2 /nobreak >nul

echo [3/5] Starting Vision Agent on port 3200...
start "VISION-AGENT" cmd /k "cd /d "%GRAVITY_CLAW%" && set ANTHROPIC_API_KEY=%ANTHROPIC_API_KEY% && npx tsx src\vision-agent.ts"
timeout /t 2 /nobreak >nul

echo [4/5] Starting Hands Agent on port 3300...
start "HANDS-AGENT" cmd /k "cd /d "%GRAVITY_CLAW%" && npx tsx src\hands-agent.ts"
timeout /t 2 /nobreak >nul

echo [5/5] Starting Jarvis Interface server on port 3002...
start "JARVIS-INTERFACE" cmd /k "cd /d "%GRAVITY_CLAW%" && npx serve . -p 3002"
timeout /t 3 /nobreak >nul

echo.
echo  ALL SYSTEMS ONLINE. Opening Jarvis interface...
echo.
echo  Ports active:
echo    8000 - OpenJarvis ^(Claude brain^)
echo    8010 - CORS Proxy
echo    3200 - Vision Agent
echo    3300 - Hands Agent
echo    3002 - Jarvis Interface
echo.
start chrome http://localhost:3002/hapda-jarvis-v2.html

echo  GREYNATION is live. Press any key to shut down all systems.
pause >nul

echo Shutting down GREYNATION...
taskkill /FI "WINDOWTITLE eq OPENJARVIS*" /F >nul 2>&1
taskkill /FI "WINDOWTITLE eq CORS-OPENJARVIS*" /F >nul 2>&1
taskkill /FI "WINDOWTITLE eq VISION-AGENT*" /F >nul 2>&1
taskkill /FI "WINDOWTITLE eq HANDS-AGENT*" /F >nul 2>&1
taskkill /FI "WINDOWTITLE eq JARVIS-INTERFACE*" /F >nul 2>&1
echo Done. All systems offline.
