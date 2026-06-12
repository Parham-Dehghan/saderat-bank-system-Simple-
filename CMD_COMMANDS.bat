@echo off
chcp 65001 >nul
title دستورات CMD - بانک صادرات

echo.
echo ════════════════════════════════════════════════════════════
echo   📋 راهنمای دستورات CMD - سامانه بانک صادرات ایران
echo ════════════════════════════════════════════════════════════
echo.
echo ─── مرحله ۱: بررسی .NET ────────────────────────────────────
echo.
echo     dotnet --version
echo     dotnet --list-sdks
echo.
echo ─── مرحله ۲: باز کردن ZIP ──────────────────────────────────
echo.
echo     powershell -Command "Expand-Archive -Path 'SaderatBank_Full_Project.zip' -DestinationPath 'C:\Projects' -Force"
echo.
echo ─── مرحله ۳: رفتن به پوشه ──────────────────────────────────
echo.
echo     cd C:\Projects\SaderatBank
echo.
echo ─── مرحله ۴: دانلود کتابخانه‌ها ────────────────────────────
echo.
echo     dotnet restore
echo.
echo ─── مرحله ۵: Build کردن ────────────────────────────────────
echo.
echo     dotnet build
echo.
echo ─── مرحله ۶: اجرا ──────────────────────────────────────────
echo.
echo     dotnet run
echo     dotnet run --urls "http://localhost:5000"
echo.
echo ─── دستورات اضافه ──────────────────────────────────────────
echo.
echo     dotnet run --environment Production   (حالت Production)
echo     dotnet publish -c Release -o .\publish (انتشار)
echo.
echo ════════════════════════════════════════════════════════════
echo   🌐  http://localhost:5000
echo ════════════════════════════════════════════════════════════
echo.
pause
