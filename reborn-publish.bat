@echo off
title Reborn - Publish to Netlify
cd /d "%~dp0"

echo ============================================
echo    Reborn - Publishing Updates to Netlify
echo ============================================
echo.

where git >nul 2>nul
if errorlevel 1 goto NoGit

if not exist ".git" (
  echo [1/3] Initializing local Git repository...
  git init -b main
  git remote add origin "https://github.com/benreborn555-rehab/reborn-website.git"
  echo.
)

echo [2/3] Adding files and saving local changes...
git add .
git commit -m "Site content update from local editor"

echo.
echo [3/3] Uploading changes to GitHub...
echo * Note: If this is your first time, a login window for GitHub will pop up.
echo.
git push -u origin main
if errorlevel 1 goto PushFailed

echo.
echo ============================================
echo [X] SUCCESS! Uploaded successfully to GitHub
echo     Netlify will update your live site in 20 seconds.
echo ============================================
echo.
goto End

:NoGit
echo [!] ERROR: Git is not installed on this computer!
echo     Please install it for free from: https://git-scm.com
echo     After installing, open this file again.
echo.
goto End

:PushFailed
echo.
echo [!] ERROR: Upload failed.
echo     Please make sure you created a repository named "reborn-website" at:
echo     https://github.com/benreborn555-rehab/reborn-website
echo.
goto End

:End
pause
