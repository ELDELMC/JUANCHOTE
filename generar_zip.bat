@echo off
echo 🚀 Iniciando generación de bot.zip para BoxMineWorld...
echo.

powershell -ExecutionPolicy Bypass -File "%~dp0generar_zip.ps1"

echo.
echo ✅ Proceso terminado.
pause
