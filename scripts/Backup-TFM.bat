@echo off
REM ============================================================
REM  TFM System - Full Backup (double-click launcher)
REM  Runs the PowerShell backup script: code + database + uploads
REM ============================================================
echo.
echo Starting full TFM System backup...
echo.
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0backup-tfm.ps1" %*
echo.
echo Done. Review the messages above for the backup location.
pause
