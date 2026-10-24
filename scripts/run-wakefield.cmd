@echo off
setlocal
cd /d "%~dp0.."

if not exist "node_modules\next\package.json" (
  echo Wakefield dependencies are missing. Installing them now...
  call npm.cmd install
  if errorlevel 1 exit /b 1
)

set "NEXT_PUBLIC_DATA_MODE=mock"
set "NEXT_PUBLIC_GUIDED_MODE=true"
echo Starting Wakefield at http://localhost:3000
echo Local workspace mode is on. Reports, map activity, and rewards stay in this browser.
call npm.cmd run dev
