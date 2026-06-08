@echo off
REM One-click FULL backup labeled V1 (code + database + uploads + .env, zipped)
REM Output: C:\Projects\TFM-Backups\TFM-V1-Backup-<timestamp>.zip
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0backup-tfm.ps1" -Label "V1"
pause
