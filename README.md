# 🏦 سامانه بانکداری بانک صادرات ایران
## Bank Saderat Iran - Digital Banking System

---

## 📋 فهرست مطالب

1. [معرفی پروژه](#1-معرفی-پروژه)
2. [فناوری‌های استفاده‌شده](#2-فناوری‌های-استفاده‌شده)
3. [ساختار پروژه](#3-ساختار-پروژه)
4. [نصب و راه‌اندازی](#4-نصب-و-راه‌اندازی)
5. [مستندات API](#5-مستندات-api)
6. [مستندات فرانت‌اند](#6-مستندات-فرانت‌اند)
7. [پایگاه داده SQLite](#7-پایگاه-داده-sqlite)
8. [نقش‌ها و دسترسی‌ها](#8-نقشها-و-دسترسیها)
9. [حساب‌های آزمایشی](#9-حسابهای-آزمایشی)

---

## 1. معرفی پروژه

سامانه جامع بانکداری الکترونیک بانک صادرات ایران — طراحی شده با:

- **بک‌اند:** ASP.NET Core 10 (Minimal API)
- **پایگاه داده:** SQLite (Entity Framework Core 9)
- **فرانت‌اند:** HTML5 / CSS3 / Vanilla JavaScript
- **احراز هویت:** Session-based + BCrypt password hashing
- **تم:** رنگ‌بندی رسمی بانک صادرات (آبی‌بنفش #2D2B8F + سفید)

### امکانات کلیدی:
- ✅ صفحه لاگین با لوگوی واقعی بانک صادرات
- ✅ داشبورد پنل‌های چندگانه (ادمین / مدیر / اپراتور / کاربر / حسابرس)
- ✅ مدیریت کامل حساب‌ها، تراکنش‌ها، وام‌ها، کارت‌ها
- ✅ انتقال وجه بین‌حسابی
- ✅ پرداخت قبوض
- ✅ پنل ادمین با کنسول SQL
- ✅ گزارشات مالی
- ✅ Audit Log کامل
- ✅ مدیریت کاربران و ماتریس دسترسی‌ها
- ✅ طراحی Responsive

---

## 2. فناوری‌های استفاده‌شده

| لایه | تکنولوژی | نسخه |
|------|-----------|-------|
| Backend | ASP.NET Core Minimal API | .NET 10 |
| ORM | Entity Framework Core | 9.0.0 |
| Database | SQLite | 3.x |
| Password Hash | BCrypt.Net-Next | 4.0.3 |
| Auth | Session-based | - |
| Frontend | HTML5 + CSS3 + JS | ES2022 |
| Font | Vazirmatn (Google Fonts) | - |
| Icons | Unicode Emoji | - |

---

## 3. ساختار پروژه

```
SaderatBank/
├── SaderatBank.csproj          # فایل پروژه .NET 10
├── Program.cs                  # نقطه ورود + تمام Minimal API ها
├── appsettings.json            # تنظیمات برنامه
├── appsettings.Development.json
├── Properties/
│   └── launchSettings.json     # تنظیمات اجرا و پورت
├── Models/
│   └── Models.cs               # مدل‌های EF Core (6 entity)
├── Data/
│   └── BankDbContext.cs        # DbContext + Seed data
└── wwwroot/                    # فایل‌های استاتیک (فرانت‌اند)
    ├── login.html              # صفحه ورود
    ├── dashboard.html          # داشبورد اصلی
    ├── css/
    │   └── saderat.css         # استایل‌های سراسری
    └── js/
        └── app.js              # منطق JavaScript
```

---

## 4. نصب و راه‌اندازی

### پیش‌نیازها

```bash
# بررسی نصب .NET 10
dotnet --version
# باید عدد 10.x.x نمایش دهد

# در صورت عدم نصب:
# Windows: https://dotnet.microsoft.com/download/dotnet/10.0
# Linux/Mac:
wget https://dot.net/v1/dotnet-install.sh
chmod +x dotnet-install.sh
./dotnet-install.sh --channel 10.0
```

### اجرای پروژه

```bash
# ۱. رفتن به پوشه پروژه
cd SaderatBank

# ۲. Restore کردن پکیج‌ها
dotnet restore

# ۳. Build کردن
dotnet build

# ۴. اجرا کردن
dotnet run

# یا با پورت مشخص:
dotnet run --urls "http://localhost:5000"
```

### باز کردن در مرورگر

```
http://localhost:5000
```

مرورگر به صورت خودکار به `/login.html` هدایت می‌شود.

### اجرا در حالت Production

```bash
dotnet run --environment Production

# یا publish کردن:
dotnet publish -c Release -o ./publish
cd ./publish
dotnet SaderatBank.dll
```

---

## 5. مستندات API

### Base URL
```
http://localhost:5000/api
```

### احراز هویت (Auth)

#### POST `/api/auth/login`
ورود به سیستم

**Request Body:**
```json
{
  "username": "admin",
  "password": "Admin@1234"
}
```

**Response موفق:**
```json
{
  "success": true,
  "role": "admin",
  "name": "مدیر ارشد سیستم"
}
```

**Response ناموفق:**
```json
{
  "success": false,
  "message": "نام کاربری یا رمز عبور اشتباه است"
}
```

---

#### POST `/api/auth/logout`
خروج از سیستم

**Response:**
```json
{ "success": true }
```

---

#### GET `/api/auth/me`
اطلاعات کاربر جاری

**Response:**
```json
{
  "id": 1,
  "name": "مدیر ارشد سیستم",
  "role": "admin",
  "email": "admin@saderat.ir",
  "username": "admin"
}
```

---

### داشبورد

#### GET `/api/dashboard`
آمار کلی داشبورد (نیاز به احراز هویت)

**Response:**
```json
{
  "totalBalance": 2398000000,
  "activeAccounts": 4,
  "totalTransactions": 8,
  "activeLoans": 3,
  "recentTransactions": [
    {
      "transactionCode": "TX001",
      "type": "واریز",
      "amount": 15000000,
      "status": "موفق",
      "description": "حقوق ماهیانه",
      "date": "1404/03/10 09:30"
    }
  ]
}
```

---

### حساب‌ها (Accounts)

#### GET `/api/accounts`
لیست حساب‌ها

**دسترسی:** همه نقش‌ها (admin/manager/operator تمام حساب‌ها، user فقط حساب‌های خود)

**Response:**
```json
[
  {
    "id": 1,
    "accountNumber": "0119876543210",
    "accountType": "جاری",
    "balance": 125000000,
    "status": "فعال",
    "ownerName": "احمد رضایی",
    "date": "1404/01/15"
  }
]
```

---

#### POST `/api/accounts`
ایجاد حساب جدید

**دسترسی:** admin, manager, operator

**Request Body:**
```json
{
  "accountType": "جاری",
  "initialBalance": 1000000,
  "status": "فعال",
  "userId": 4
}
```

**Response:**
```json
{
  "success": true,
  "id": 6,
  "accountNumber": "0123456789"
}
```

---

#### DELETE `/api/accounts/{id}`
حذف حساب

**دسترسی:** admin

**Response:**
```json
{ "success": true }
```

---

### تراکنش‌ها (Transactions)

#### GET `/api/transactions`
لیست تراکنش‌ها (آخرین ۵۰ مورد)

**Response:**
```json
[
  {
    "id": 1,
    "transactionCode": "TX001",
    "type": "واریز",
    "amount": 15000000,
    "description": "حقوق ماهیانه",
    "status": "موفق",
    "accountNumber": "0119876543210",
    "toAccountNumber": null,
    "date": "1404/03/10 09:30"
  }
]
```

---

#### POST `/api/transactions`
ثبت تراکنش جدید

**دسترسی:** admin, manager, operator, user (به جز auditor)

**Request Body:**
```json
{
  "accountId": 1,
  "type": "واریز",
  "amount": 5000000,
  "description": "واریز نقدی"
}
```

**Response موفق:**
```json
{
  "success": true,
  "code": "TX240615143022",
  "newBalance": 130000000
}
```

**Response ناموفق (موجودی ناکافی):**
```json
{
  "success": false,
  "message": "موجودی ناکافی"
}
```

---

### انتقال وجه (Transfer)

#### POST `/api/transfer`
انتقال وجه بین حساب‌ها

**دسترسی:** admin, manager, operator, user

**Request Body:**
```json
{
  "fromAccountId": 1,
  "toAccountNumber": "0221234567890",
  "amount": 10000000,
  "description": "پرداخت اجاره"
}
```

**Response موفق:**
```json
{
  "success": true,
  "code": "TR240615143055",
  "fromBalance": 115000000
}
```

---

### وام‌ها (Loans)

#### GET `/api/loans`
لیست وام‌ها

**Response:**
```json
[
  {
    "id": 1,
    "loanCode": "LN001",
    "loanType": "مسکن",
    "amount": 800000000,
    "interestRate": 18,
    "installments": 60,
    "status": "جاری",
    "userName": "احمد رضایی",
    "date": "1404/01/01"
  }
]
```

---

#### POST `/api/loans`
درخواست وام جدید

**Request Body:**
```json
{
  "loanType": "مسکن",
  "amount": 500000000,
  "interestRate": 18,
  "installments": 60
}
```

**Response:**
```json
{
  "success": true,
  "code": "LN240615001"
}
```

---

#### PUT `/api/loans/{id}/status`
تغییر وضعیت وام

**دسترسی:** admin, manager

**Request Body:**
```json
{ "status": "جاری" }
```

---

### کارت‌ها (Cards)

#### GET `/api/cards`
لیست کارت‌های بانکی

**Response:**
```json
[
  {
    "id": 1,
    "cardNumber": "6037697812345678",
    "cardType": "نقدی",
    "dailyLimit": 10000000,
    "expiryDate": "06/1406",
    "status": "فعال",
    "accountNumber": "0119876543210",
    "ownerName": "احمد رضایی"
  }
]
```

---

#### POST `/api/cards`
صدور کارت جدید

**دسترسی:** admin, manager, operator

**Request Body:**
```json
{
  "accountId": 1,
  "cardType": "نقدی",
  "dailyLimit": 5000000
}
```

---

#### PUT `/api/cards/{id}/toggle`
فعال/مسدود کردن کارت

**Response:**
```json
{
  "success": true,
  "status": "مسدود"
}
```

---

### کاربران (Users)

#### GET `/api/users`
لیست کاربران سیستم

**دسترسی:** admin, manager

---

#### POST `/api/users`
ایجاد کاربر جدید

**دسترسی:** admin

**Request Body:**
```json
{
  "username": "newuser",
  "fullName": "نام کاربر",
  "email": "user@saderat.ir",
  "role": "operator",
  "password": "Password@1234"
}
```

---

#### DELETE `/api/users/{id}`
غیرفعال‌سازی کاربر

**دسترسی:** admin

---

### حسابرسی (Audit)

#### GET `/api/audit`
گزارش حسابرسی (آخرین ۱۰۰ رویداد)

**دسترسی:** admin, auditor

**Response:**
```json
[
  {
    "id": 1,
    "action": "ورود",
    "detail": "احراز هویت موفق",
    "ipAddress": "192.168.1.1",
    "userName": "مدیر ارشد سیستم",
    "userRole": "admin",
    "date": "1404/03/10 13:22:05"
  }
]
```

---

## 6. مستندات فرانت‌اند

### فایل‌ها

#### `login.html`
صفحه ورود با دو بخش:
- **چپ:** پنل آبی با لوگوی بانک صادرات و ویژگی‌های سیستم
- **راست:** فرم ورود + حساب‌های آزمایشی

**توابع:**
- `fillLogin(username, password)` — پر کردن خودکار فرم
- `doLogin()` — ارسال درخواست ورود به API

---

#### `dashboard.html`
داشبورد اصلی با Sidebar + Topbar + Content

**ساختار:**
```
#app
├── #sidebar          ← منوی کناری ثابت
│   ├── .sb-header    ← لوگو
│   ├── .role-sel     ← انتخاب نقش
│   └── .nav-item[]   ← آیتم‌های منو
└── #main
    ├── #topbar       ← نوار بالا
    └── #content
        └── .page[]   ← صفحات مختلف (فقط یکی active)
```

**صفحات موجود:**
| id | نام | دسترسی |
|----|-----|---------|
| page-dashboard | داشبورد اصلی | همه |
| page-my-accounts | حساب‌های من | user+ |
| page-transfer | انتقال وجه | user+ |
| page-transactions | تراکنش‌ها | همه |
| page-loans | وام‌ها | user+ |
| page-cards | کارت‌ها | user+ |
| page-payments | پرداخت قبوض | user+ |
| page-accounts | مدیریت حساب‌ها | operator+ |
| page-customers | مشتریان | operator+ |
| page-reports | گزارشات | manager+ |
| page-audit | حسابرسی | admin, auditor |
| page-admin-panel | پنل ادمین | admin |
| page-user-mgmt | مدیریت کاربران | admin, manager |
| page-settings | تنظیمات | همه |

---

#### `css/saderat.css`
استایل‌های سراسری با متغیرهای CSS

**رنگ‌های اصلی:**
```css
--bs-navy:   #2D2B8F;  /* آبی‌بنفش اصلی بانک صادرات */
--bs-blue:   #3D3BAF;  /* آبی میانه */
--bs-indigo: #1E1C6E;  /* تیره‌ترین */
--bs-gold:   #C8A020;  /* طلایی */
--bs-white:  #FFFFFF;
--bs-bg:     #F2F3FA;  /* پس‌زمینه */
```

**کلاس‌های اصلی:**
| کلاس | کاربرد |
|------|---------|
| `.card` | کارت‌های محتوا |
| `.tbl` | جداول داده |
| `.badge` | برچسب‌های وضعیت |
| `.btn-primary` | دکمه اصلی (آبی) |
| `.btn-gold` | دکمه طلایی |
| `.bk-card` | کارت بانکی گرافیکی |
| `.stat-card` | کارت آمار |
| `.mo` | Modal پوشش‌دهنده |
| `.fa` | آیتم فرم |

---

#### `js/app.js`
منطق اصلی برنامه

**ثابت‌های اصلی:**
```javascript
const API = '';           // base URL (خالی = همان origin)
let currentUser = null;   // کاربر جاری
let currentRole = 'admin'; // نقش فعال
let allAccounts = [];     // cache حساب‌ها
let allTransactions = []; // cache تراکنش‌ها
```

**توابع اصلی:**

| تابع | توضیح |
|------|-------|
| `checkAuth()` | بررسی احراز هویت در لود صفحه |
| `setRole(role)` | تغییر نقش و به‌روزرسانی UI |
| `showPage(name)` | نمایش صفحه مورد نظر |
| `loadDashboard()` | بارگذاری آمار داشبورد |
| `doTransfer()` | انجام انتقال وجه |
| `addTx()` | ثبت تراکنش جدید |
| `addLoan()` | ثبت درخواست وام |
| `addCard()` | صدور کارت |
| `addAcc()` | افتتاح حساب |
| `addUser()` | ایجاد کاربر |
| `loadAudit()` | بارگذاری لاگ‌های حسابرسی |
| `runSQL()` | اجرای کوئری SQL (شبیه‌ساز) |
| `showToast(msg, type)` | نمایش پیام موقت |
| `openMo(id) / closeMo(id)` | باز/بستن Modal |
| `fmt(n)` | فرمت اعداد فارسی |
| `toFa(n)` | تبدیل اعداد به فارسی |
| `apiCall(url, method, body)` | wrapper برای fetch |

**سیستم Demo Fallback:**
اگر API در دسترس نباشد، توابع `getDemo*()` داده‌های نمونه برمی‌گردانند:
```javascript
getDemoAccounts()    // داده نمونه حساب‌ها
getDemoTx()          // داده نمونه تراکنش‌ها
getDemoLoans()       // داده نمونه وام‌ها
getDemoCards()       // داده نمونه کارت‌ها
getDemoUsers()       // داده نمونه کاربران
getDemoAudit()       // داده نمونه audit log
```

---

## 7. پایگاه داده SQLite

### فایل
`saderat_bank.db` — ساخته می‌شود به صورت خودکار در اولین اجرا

### جداول

#### `Users`
| ستون | نوع | توضیح |
|------|-----|-------|
| Id | INTEGER PK | شناسه |
| Username | TEXT UNIQUE | نام کاربری |
| PasswordHash | TEXT | BCrypt hash رمز عبور |
| FullName | TEXT | نام کامل |
| Email | TEXT | ایمیل |
| Role | TEXT | نقش (admin/manager/operator/user/auditor) |
| IsActive | BOOLEAN | وضعیت فعال بودن |
| CreatedAt | TEXT | تاریخ ایجاد |
| LastLogin | TEXT | آخرین ورود |

#### `Accounts`
| ستون | نوع | توضیح |
|------|-----|-------|
| Id | INTEGER PK | شناسه |
| AccountNumber | TEXT | شماره حساب |
| AccountType | TEXT | نوع (جاری/پس‌انداز/...) |
| Balance | REAL | موجودی |
| Status | TEXT | وضعیت (فعال/مسدود/غیرفعال) |
| CreatedAt | TEXT | تاریخ افتتاح |
| UserId | INTEGER FK | شناسه صاحب حساب |

#### `Transactions`
| ستون | نوع | توضیح |
|------|-----|-------|
| Id | INTEGER PK | شناسه |
| TransactionCode | TEXT | کد تراکنش |
| Type | TEXT | نوع (واریز/برداشت/انتقال) |
| Amount | REAL | مبلغ |
| Description | TEXT | توضیحات |
| Status | TEXT | وضعیت (موفق/در انتظار/ناموفق) |
| ToAccountNumber | TEXT | حساب مقصد (انتقال) |
| CreatedAt | TEXT | تاریخ |
| AccountId | INTEGER FK | شناسه حساب |

#### `Loans`
| ستون | نوع | توضیح |
|------|-----|-------|
| Id | INTEGER PK | شناسه |
| LoanCode | TEXT | کد وام |
| LoanType | TEXT | نوع (مسکن/خودرو/ازدواج/...) |
| Amount | REAL | مبلغ |
| InterestRate | REAL | نرخ سود |
| Installments | INTEGER | تعداد اقساط |
| Status | TEXT | وضعیت (در بررسی/جاری/تسویه) |
| CreatedAt | TEXT | تاریخ |
| UserId | INTEGER FK | شناسه کاربر |

#### `Cards`
| ستون | نوع | توضیح |
|------|-----|-------|
| Id | INTEGER PK | شناسه |
| CardNumber | TEXT | شماره ۱۶ رقمی |
| CardType | TEXT | نوع (نقدی/اعتباری/مجازی) |
| DailyLimit | REAL | سقف روزانه |
| ExpiryDate | TEXT | تاریخ انقضا |
| Status | TEXT | وضعیت (فعال/مسدود) |
| AccountId | INTEGER FK | شناسه حساب |

#### `AuditLogs`
| ستون | نوع | توضیح |
|------|-----|-------|
| Id | INTEGER PK | شناسه |
| Action | TEXT | نوع عملیات |
| Detail | TEXT | جزئیات |
| IpAddress | TEXT | آدرس IP |
| CreatedAt | TEXT | زمان |
| UserId | INTEGER FK | شناسه کاربر |

### Seed Data
در اولین اجرا، داده‌های اولیه به صورت خودکار در پایگاه داده درج می‌شوند:
- ۶ کاربر (admin, manager, operator, 2×user, auditor)
- ۵ حساب بانکی
- ۶ تراکنش
- ۴ وام
- ۳ کارت بانکی
- ۳ رویداد audit log

---

## 8. نقش‌ها و دسترسی‌ها

| نقش | label | دسترسی‌ها |
|-----|-------|------------|
| admin | ادمین سیستم | همه بخش‌ها |
| manager | مدیر شعبه | همه به جز پنل ادمین |
| operator | اپراتور | حساب‌ها، تراکنش‌ها، مشتریان (بدون گزارش/حسابرسی) |
| user | کاربر بانکی | حساب خود، انتقال، وام، کارت، پرداخت |
| auditor | حسابرس | تراکنش‌ها، گزارشات، حسابرسی (فقط خواندن) |

---

## 9. حساب‌های آزمایشی

| نقش | نام کاربری | رمز عبور |
|-----|-----------|----------|
| ادمین | `admin` | `Admin@1234` |
| مدیر | `manager1` | `Manager@1234` |
| اپراتور | `operator1` | `Op@1234` |
| کاربر | `ali.karimi` | `User@1234` |
| کاربر ۲ | `fateme.m` | `User@1234` |
| حسابرس | `auditor` | `Audit@1234` |

---

## سوالات متداول

**Q: پایگاه داده SQLite کجا ذخیره می‌شود؟**
A: فایل `saderat_bank.db` در همان پوشه‌ای که `dotnet run` اجرا می‌شود ساخته می‌شود.

**Q: آیا برای اجرا به اتصال اینترنت نیاز است؟**
A: خیر. تنها در صورت نداشتن Vazirmatn در cache، فونت از Google Fonts لود می‌شود.

**Q: چطور پایگاه داده را ریست کنم؟**
A: فایل `saderat_bank.db` را حذف کنید و دوباره `dotnet run` بزنید.

**Q: چطور پورت را تغییر دهم؟**
A: در `Properties/launchSettings.json` مقدار `applicationUrl` را تغییر دهید. یا:
```bash
dotnet run --urls "http://localhost:8080"
```
