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
set "ANALYSIS_PROVIDER=ollama"
call node scripts\setup-local-ai.mjs --start
echo Starting Wakefield. Open the Local address printed below.
echo Reports, map activity, and rewards stay in this browser. Photo AI runs locally through Ollama.
call npm.cmd run dev
