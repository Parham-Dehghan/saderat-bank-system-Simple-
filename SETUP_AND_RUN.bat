@echo off
chcp 65001 >nul
title بانک صادرات ایران - راه‌اندازی سامانه

echo.
echo  ╔══════════════════════════════════════════════════════╗
echo  ║       بانک صادرات ایران - راه‌اندازی خودکار          ║
echo  ║       Bank Saderat Iran - Auto Setup Script          ║
echo  ╚══════════════════════════════════════════════════════╝
echo.

REM ─── مرحله ۱: بررسی نصب .NET ───────────────────────────
echo [1/5] بررسی نصب .NET 10...
dotnet --version >nul 2>&1
IF %ERRORLEVEL% NEQ 0 (
    echo.
    echo  ❌ خطا: .NET نصب نیست!
    echo  ──────────────────────────────────────────────────
    echo  لطفاً ابتدا .NET 10 SDK را نصب کنید:
    echo  https://dotnet.microsoft.com/en-us/download/dotnet/10.0
    echo  ──────────────────────────────────────────────────
    pause
    exit /b 1
)
echo  ✅ .NET نصب است: 
dotnet --version
echo.

REM ─── مرحله ۲: Extract کردن ZIP ─────────────────────────
echo [2/5] Extract کردن فایل ZIP...
IF NOT EXIST "SaderatBank" (
    IF EXIST "SaderatBank_Full_Project.zip" (
        powershell -Command "Expand-Archive -Path 'SaderatBank_Full_Project.zip' -DestinationPath '.' -Force"
        echo  ✅ ZIP باز شد
    ) ELSE (
        echo  ℹ️  پوشه پروژه از قبل موجود است
    )
) ELSE (
    echo  ℹ️  پوشه SaderatBank از قبل موجود است
)
echo.

REM ─── مرحله ۳: رفتن به پوشه پروژه ──────────────────────
echo [3/5] رفتن به پوشه پروژه...
cd SaderatBank
IF %ERRORLEVEL% NEQ 0 (
    echo  ❌ پوشه SaderatBank پیدا نشد!
    pause
    exit /b 1
)
echo  ✅ در پوشه: %CD%
echo.

REM ─── مرحله ۴: Restore پکیج‌ها ──────────────────────────
echo [4/5] دانلود کتابخانه‌های NuGet...
echo  (اتصال به اینترنت لازم است - چند ثانیه صبر کنید)
echo.
dotnet restore
IF %ERRORLEVEL% NEQ 0 (
    echo.
    echo  ❌ خطا در دانلود پکیج‌ها!
    echo  اتصال اینترنت را بررسی کنید
    pause
    exit /b 1
)
echo.
echo  ✅ پکیج‌ها با موفقیت دانلود شدند
echo.

REM ─── مرحله ۵: اجرای برنامه ────────────────────────────
echo [5/5] اجرای سامانه بانکداری...
echo.
echo  ══════════════════════════════════════════════════════
echo   🌐 آدرس سامانه:  http://localhost:5000
echo   🔑 ادمین:  admin / Admin@1234
echo   👤 کاربر:  ali.karimi / User@1234
echo   📊 مدیر:   manager1 / Manager@1234
echo  ══════════════════════════════════════════════════════
echo.
echo  برای توقف: Ctrl+C بزنید
echo.

REM باز کردن مرورگر بعد از ۳ ثانیه
start /b cmd /c "timeout /t 3 /nobreak >nul && start http://localhost:5000"

dotnet run --urls "http://localhost:5000"

pause
