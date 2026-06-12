# 📐 نمودارهای UML — سامانه بانک صادرات ایران

این فایل سه نمودار اصلی UML پروژه را شامل می‌شود:

1. **نمودار کلاس (Class Diagram)** — ساختار مدل‌های داده و روابط بین آن‌ها
2. **نمودار شیء (Object Diagram)** — نمونه‌ای از داده‌های واقعی در زمان اجرا
3. **نمودار مؤلفه (Component Diagram)** — اجزای معماری سیستم و ارتباط آن‌ها

> برای مشاهده نمودارها به صورت گرافیکی، این فایل را در **GitHub**, **GitLab**, یا یک ویرایشگر Markdown با پشتیبانی از Mermaid (مثل VS Code + پلاگین Mermaid، یا [mermaid.live](https://mermaid.live)) باز کنید.

---

## 1️⃣ نمودار کلاس (Class Diagram)

این نمودار ۶ موجودیت (Entity) اصلی پروژه را که در `Models/Models.cs` تعریف شده‌اند، به همراه روابط (Relationships) و Multiplicity آن‌ها نشان می‌دهد.

```mermaid
classDiagram
    class User {
        +int Id
        +string Username
        +string PasswordHash
        +string FullName
        +string Email
        +string Role
        +bool IsActive
        +DateTime CreatedAt
        +DateTime? LastLogin
        +ICollection~Account~ Accounts
    }

    class Account {
        +int Id
        +string AccountNumber
        +string AccountType
        +decimal Balance
        +string Status
        +DateTime CreatedAt
        +int UserId
        +User User
        +ICollection~Transaction~ Transactions
    }

    class Transaction {
        +int Id
        +string TransactionCode
        +string Type
        +decimal Amount
        +string Description
        +string Status
        +DateTime CreatedAt
        +int AccountId
        +Account Account
        +string? ToAccountNumber
    }

    class Loan {
        +int Id
        +string LoanCode
        +string LoanType
        +decimal Amount
        +double InterestRate
        +int Installments
        +string Status
        +DateTime CreatedAt
        +int UserId
        +User User
    }

    class BankCard {
        +int Id
        +string CardNumber
        +string CardType
        +decimal DailyLimit
        +string ExpiryDate
        +string Status
        +int AccountId
        +Account Account
    }

    class AuditLog {
        +int Id
        +string Action
        +string Detail
        +string IpAddress
        +DateTime CreatedAt
        +int UserId
        +User User
    }

    %% ─── Relationships ───────────────────────────
    User "1" --> "0..*" Account : دارد (Owns)
    User "1" --> "0..*" Loan : درخواست می‌دهد (Requests)
    User "1" --> "0..*" AuditLog : ایجاد می‌کند (Generates)
    Account "1" --> "0..*" Transaction : شامل (Has)
    Account "1" --> "0..*" BankCard : صادر می‌شود برای (Issued for)
```

### توضیح روابط

| رابطه | نوع | توضیح |
|-------|-----|-------|
| `User → Account` | One-to-Many | هر کاربر می‌تواند چند حساب داشته باشد |
| `User → Loan` | One-to-Many | هر کاربر می‌تواند چند درخواست وام داشته باشد |
| `User → AuditLog` | One-to-Many | هر کاربر چندین رویداد حسابرسی ایجاد می‌کند |
| `Account → Transaction` | One-to-Many | هر حساب چندین تراکنش دارد |
| `Account → BankCard` | One-to-Many | برای هر حساب می‌توان چند کارت صادر کرد |

---

## 2️⃣ نمودار شیء (Object Diagram)

این نمودار یک نمونه واقعی (Instance) از داده‌ها را در یک لحظه از اجرای برنامه نشان می‌دهد — بر اساس داده‌های Seed موجود در `BankDbContext.cs`.

```mermaid
classDiagram
    class user1_admin {
        Id = 1
        Username = "admin"
        FullName = "مدیر ارشد سیستم"
        Email = "admin@saderat.ir"
        Role = "admin"
        IsActive = true
    }

    class user2_ali {
        Id = 4
        Username = "ali.karimi"
        FullName = "علی کریمی"
        Email = "ali@gmail.com"
        Role = "user"
        IsActive = true
    }

    class acc1 {
        Id = 1
        AccountNumber = "0119876543210"
        AccountType = "جاری"
        Balance = 125000000
        Status = "فعال"
        UserId = 4
    }

    class acc4 {
        Id = 4
        AccountNumber = "0445566778899"
        AccountType = "قرض‌الحسنه"
        Balance = 5000000
        Status = "فعال"
        UserId = 4
    }

    class tx1 {
        Id = 1
        TransactionCode = "TX001"
        Type = "واریز"
        Amount = 15000000
        Description = "حقوق ماهیانه"
        Status = "موفق"
        AccountId = 1
    }

    class loan3 {
        Id = 3
        LoanCode = "LN003"
        LoanType = "ازدواج"
        Amount = 100000000
        InterestRate = 4
        Installments = 84
        Status = "جاری"
        UserId = 4
    }

    class card1 {
        Id = 1
        CardNumber = "6037697812345678"
        CardType = "نقدی"
        DailyLimit = 10000000
        ExpiryDate = "06/1406"
        Status = "فعال"
        AccountId = 1
    }

    class audit1 {
        Id = 1
        Action = "ورود"
        Detail = "احراز هویت موفق"
        IpAddress = "192.168.1.1"
        UserId = 1
    }

    user2_ali "1" --> "2" acc1 : Accounts
    user2_ali --> acc4 : Accounts
    acc1 "1" --> "1" tx1 : Transactions
    acc1 "1" --> "1" card1 : Cards
    user2_ali "1" --> "1" loan3 : Loans
    user1_admin "1" --> "1" audit1 : AuditLogs
```

### توضیح نمونه

این نمودار نشان می‌دهد کاربر **علی کریمی** (`ali.karimi`، Id=4، نقش `user`) دارای دو حساب است:
- حساب جاری `0119876543210` با موجودی ۱۲۵,۰۰۰,۰۰۰ تومان که یک تراکنش واریز (`TX001`) و یک کارت نقدی روی آن صادر شده.
- حساب قرض‌الحسنه `0445566778899` با موجودی ۵,۰۰۰,۰۰۰ تومان.

همچنین یک وام ازدواج (`LN003`) با وضعیت «جاری» به نام او ثبت شده، و کاربر **ادمین** یک رویداد ورود (`audit1`) در سیستم ثبت کرده است.

---

## 3️⃣ نمودار مؤلفه (Component Diagram)

این نمودار معماری کلی سیستم را در سه لایه نشان می‌دهد: **فرانت‌اند**، **بک‌اند (ASP.NET Core 10)** و **پایگاه داده (SQLite)**.

```mermaid
graph TB
    subgraph CLIENT["🖥️ لایه کلاینت (Browser)"]
        LoginUI["login.html<br/>صفحه ورود"]
        DashUI["dashboard.html<br/>داشبورد اصلی"]
        AppJS["app.js<br/>منطق فرانت‌اند"]
        CSS["saderat.css<br/>تم بانک صادرات"]
        LoginUI --> AppJS
        DashUI --> AppJS
        AppJS --> CSS
    end

    subgraph BACKEND["⚙️ لایه بک‌اند (ASP.NET Core 10 - Minimal API)"]
        Program["Program.cs<br/>نقطه ورود + Endpoint ها"]
        AuthEP["Auth Endpoints<br/>/api/auth/*"]
        AccEP["Account Endpoints<br/>/api/accounts/*"]
        TxEP["Transaction Endpoints<br/>/api/transactions, /api/transfer"]
        LoanEP["Loan Endpoints<br/>/api/loans/*"]
        CardEP["Card Endpoints<br/>/api/cards/*"]
        UserEP["User Mgmt Endpoints<br/>/api/users/*"]
        AuditEP["Audit Endpoints<br/>/api/audit"]
        Session["Session Middleware<br/>احراز هویت"]
        BCryptLib["BCrypt.Net<br/>رمزنگاری پسورد"]

        Program --> AuthEP
        Program --> AccEP
        Program --> TxEP
        Program --> LoanEP
        Program --> CardEP
        Program --> UserEP
        Program --> AuditEP
        AuthEP --> Session
        AuthEP --> BCryptLib
    end

    subgraph DATA["🗄️ لایه داده (Data Access)"]
        DbContext["BankDbContext<br/>(EF Core)"]
        Models["Models.cs<br/>(6 Entity)"]
        SQLite[("SQLite Database<br/>saderat_bank.db")]
        DbContext --> Models
        DbContext --> SQLite
    end

    %% ─── ارتباطات بین لایه‌ها ───
    AppJS -- "HTTP fetch (JSON)<br/>REST API" --> Program
    AuthEP --> DbContext
    AccEP --> DbContext
    TxEP --> DbContext
    LoanEP --> DbContext
    CardEP --> DbContext
    UserEP --> DbContext
    AuditEP --> DbContext

    style CLIENT fill:#EEF0FA,stroke:#2D2B8F,stroke-width:2px
    style BACKEND fill:#F5F6FD,stroke:#3D3BAF,stroke-width:2px
    style DATA fill:#FFF8E1,stroke:#C8A020,stroke-width:2px
    style SQLite fill:#2D2B8F,stroke:#1E1C6E,color:#fff
```

### توضیح مؤلفه‌ها

| لایه | مؤلفه | نقش |
|------|-------|------|
| **کلاینت** | `login.html` / `dashboard.html` | رابط کاربری (UI) |
| **کلاینت** | `app.js` | منطق سمت کلاینت، فراخوانی API، مدیریت نقش‌ها |
| **کلاینت** | `saderat.css` | تم رنگی بانک صادرات (آبی‌بنفش/سفید) |
| **بک‌اند** | `Program.cs` | تعریف تمام Endpoint های REST API (Minimal API) |
| **بک‌اند** | Session Middleware | نگهداری وضعیت ورود کاربر |
| **بک‌اند** | BCrypt.Net | هش کردن و تطبیق رمز عبور |
| **داده** | `BankDbContext` | پل ارتباطی EF Core با SQLite |
| **داده** | `Models.cs` | تعریف ۶ Entity (User, Account, Transaction, Loan, BankCard, AuditLog) |
| **داده** | `saderat_bank.db` | فایل فیزیکی پایگاه داده SQLite |

### جریان یک درخواست نمونه (مثال: انتقال وجه)

```mermaid
sequenceDiagram
    actor U as کاربر
    participant FE as app.js (Frontend)
    participant API as Program.cs (/api/transfer)
    participant DB as BankDbContext
    participant SQL as SQLite

    U->>FE: کلیک روی "انتقال وجه"
    FE->>API: POST /api/transfer {fromAccountId, toAccountNumber, amount}
    API->>DB: db.Accounts.Find(fromAccountId)
    DB->>SQL: SELECT * FROM Accounts WHERE Id=?
    SQL-->>DB: نتیجه
    API->>DB: بررسی موجودی و کسر/افزایش مبلغ
    API->>DB: db.Transactions.Add(newTx)
    API->>DB: db.AuditLogs.Add(logEntry)
    DB->>SQL: UPDATE Accounts / INSERT Transactions / INSERT AuditLogs
    SQL-->>DB: Commit
    API-->>FE: { success: true, code, fromBalance }
    FE-->>U: نمایش Toast "انتقال موفق"
```

---

## 📦 جمع‌بندی

| نمودار | فایل مرتبط | هدف |
|--------|-----------|------|
| Class Diagram | `Models/Models.cs`, `Data/BankDbContext.cs` | نشان دادن ساختار داده و روابط Entity ها |
| Object Diagram | `Data/BankDbContext.cs` (Seed Data) | نمونه واقعی داده در زمان اجرا |
| Component Diagram | کل پروژه (`Program.cs`, `wwwroot/*`) | معماری کلی و ارتباط لایه‌ها |
| Sequence Diagram | `Program.cs` (`/api/transfer`) | جریان یک عملیات از کلاینت تا دیتابیس |
