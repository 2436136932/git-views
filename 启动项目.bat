@echo off
setlocal
cd /d "%~dp0"

if not exist node_modules (
  echo [info] node_modules not found, running npm install...
  call npm install
  if errorlevel 1 goto :fail
)

echo [info] starting Vite and Electron...
call npm run start
if errorlevel 1 goto :fail

goto :eof

:fail
echo.
echo [error] startup failed.
pause
exit /b 1
