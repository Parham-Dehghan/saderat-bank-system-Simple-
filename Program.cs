using System.Text.Json;
using System.Text.Json.Serialization;
using Microsoft.EntityFrameworkCore;
using SaderatBank.Data;
using SaderatBank.Models;
using BC = BCrypt.Net.BCrypt;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddDbContext<BankDbContext>(opt =>
    opt.UseSqlite("Data Source=saderat_bank.db"));

builder.Services.AddDistributedMemoryCache();
builder.Services.AddSession(o =>
{
    o.IdleTimeout = TimeSpan.FromHours(8);
    o.Cookie.HttpOnly = true;
    o.Cookie.IsEssential = true;
    o.Cookie.SameSite = SameSiteMode.Lax;
    o.Cookie.Name = ".Saderat.Session";
});

builder.Services.ConfigureHttpJsonOptions(o =>
{
    o.SerializerOptions.PropertyNamingPolicy = JsonNamingPolicy.CamelCase;
    o.SerializerOptions.DefaultIgnoreCondition = JsonIgnoreCondition.WhenWritingNull;
});

builder.Services.AddCors();

var app = builder.Build();

using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<BankDbContext>();
    BankDbContext.Seed(db);
}

app.UseStaticFiles();
app.UseSession();
app.UseCors(x => x
    .AllowAnyHeader()
    .AllowAnyMethod()
    .SetIsOriginAllowed(_ => true)
    .AllowCredentials());

User? GetSessionUser(HttpContext ctx, BankDbContext db)
{
    var id = ctx.Session.GetInt32("UserId");
    return id.HasValue ? db.Users.Find(id.Value) : null;
}

IResult ForbidJson(string message = "دسترسی مجاز نیست") =>
    Results.Json(new { success = false, message }, statusCode: 403);

IResult UnauthorizedJson(string message = "لطفاً وارد شوید") =>
    Results.Json(new { success = false, message }, statusCode: 401);

void LogAudit(BankDbContext db, int userId, string action, string detail, HttpContext ctx)
{
    db.AuditLogs.Add(new AuditLog
    {
        UserId = userId, Action = action, Detail = detail,
        IpAddress = ctx.Connection.RemoteIpAddress?.ToString() ?? "unknown"
    });
    db.SaveChanges();
}

bool IsStaff(User u) => u.Role is "admin" or "manager" or "operator";
bool IsManagerOrAdmin(User u) => u.Role is "admin" or "manager";

app.MapPost("/api/auth/login", async (HttpContext ctx, BankDbContext db) =>
{
    var body = await ctx.Request.ReadFromJsonAsync<LoginRequest>();
    if (body == null || string.IsNullOrWhiteSpace(body.Username))
        return Results.Json(new { success = false, message = "اطلاعات ناقص است" });

    var user = db.Users.FirstOrDefault(u => u.Username == body.Username && u.IsActive);
    if (user == null || !BC.Verify(body.Password ?? "", user.PasswordHash))
        return Results.Json(new { success = false, message = "نام کاربری یا رمز عبور اشتباه است" });

    user.LastLogin = DateTime.UtcNow;
    db.SaveChanges();
    ctx.Session.SetInt32("UserId", user.Id);
    ctx.Session.SetString("UserRole", user.Role);
    ctx.Session.SetString("UserName", user.FullName);
    LogAudit(db, user.Id, "ورود", "احراز هویت موفق", ctx);
    return Results.Json(new { success = true, role = user.Role, name = user.FullName, id = user.Id, email = user.Email, username = user.Username });
});

app.MapPost("/api/auth/logout", (HttpContext ctx) =>
{
    ctx.Session.Clear();
    return Results.Json(new { success = true });
});

app.MapGet("/api/auth/me", (HttpContext ctx, BankDbContext db) =>
{
    var u = GetSessionUser(ctx, db);
    if (u == null) return UnauthorizedJson();
    return Results.Json(new { id = u.Id, name = u.FullName, role = u.Role, email = u.Email, username = u.Username });
});

app.MapGet("/api/dashboard", (HttpContext ctx, BankDbContext db) =>
{
    var u = GetSessionUser(ctx, db); if (u == null) return UnauthorizedJson();
    var accs = u.Role is "admin" or "manager" or "operator" or "auditor"
        ? db.Accounts.ToList()
        : db.Accounts.Where(a => a.UserId == u.Id).ToList();
    var accIds = accs.Select(a => a.Id).ToList();
    var txs = db.Transactions.Where(t => accIds.Contains(t.AccountId)).ToList();
    return Results.Json(new
    {
        totalBalance = accs.Sum(a => a.Balance),
        activeAccounts = accs.Count(a => a.Status == "فعال"),
        totalTransactions = txs.Count,
        activeLoans = db.Loans.Count(l => l.Status == "جاری"),
        recentTransactions = txs.OrderByDescending(t => t.CreatedAt).Take(6)
            .Select(t => new { t.TransactionCode, t.Type, t.Amount, t.Status, t.Description, date = t.CreatedAt.ToString("yyyy/MM/dd HH:mm") })
    });
});

app.MapGet("/api/accounts", (HttpContext ctx, BankDbContext db) =>
{
    var u = GetSessionUser(ctx, db); if (u == null) return UnauthorizedJson();
    var q = IsStaff(u)
        ? db.Accounts.Include(a => a.User).ToList()
        : db.Accounts.Include(a => a.User).Where(a => a.UserId == u.Id).ToList();
    return Results.Json(q.Select(a => new
    {
        a.Id, a.AccountNumber, a.AccountType, a.Balance, a.Status,
        ownerName = a.User?.FullName ?? "", userId = a.UserId,
        date = a.CreatedAt.ToString("yyyy/MM/dd")
    }));
});

app.MapPost("/api/accounts", async (HttpContext ctx, BankDbContext db) =>
{
    var u = GetSessionUser(ctx, db); if (u == null) return UnauthorizedJson();
    if (!IsStaff(u)) return ForbidJson("فقط کارکنان بانک می‌توانند حساب افتتاح کنند");
    var body = await ctx.Request.ReadFromJsonAsync<AccountRequest>();
    if (body == null) return Results.Json(new { success = false, message = "اطلاعات ناقص است" });
    var acc = new Account
    {
        AccountNumber = "0" + Random.Shared.Next(100000000, 999999999) + "0",
        AccountType = body.AccountType ?? "جاری",
        Balance = body.InitialBalance,
        Status = body.Status ?? "فعال",
        UserId = body.UserId ?? u.Id
    };
    db.Accounts.Add(acc);
    db.SaveChanges();
    LogAudit(db, u.Id, "افتتاح حساب", $"{acc.AccountNumber} — {acc.AccountType}", ctx);
    return Results.Json(new { success = true, id = acc.Id, accountNumber = acc.AccountNumber });
});

app.MapDelete("/api/accounts/{id:int}", (int id, HttpContext ctx, BankDbContext db) =>
{
    var u = GetSessionUser(ctx, db); if (u == null) return UnauthorizedJson();
    if (u.Role != "admin") return ForbidJson("فقط ادمین می‌تواند حساب حذف کند");
    var acc = db.Accounts.Find(id);
    if (acc == null) return Results.Json(new { success = false, message = "حساب یافت نشد" }, statusCode: 404);
    db.Accounts.Remove(acc);
    db.SaveChanges();
    LogAudit(db, u.Id, "حذف حساب", $"ACC-{id}", ctx);
    return Results.Json(new { success = true });
});

app.MapGet("/api/transactions", (HttpContext ctx, BankDbContext db) =>
{
    var u = GetSessionUser(ctx, db); if (u == null) return UnauthorizedJson();
    var accIds = u.Role is "admin" or "manager" or "operator" or "auditor"
        ? db.Accounts.Select(a => a.Id).ToList()
        : db.Accounts.Where(a => a.UserId == u.Id).Select(a => a.Id).ToList();
    var txs = db.Transactions.Include(t => t.Account)
        .Where(t => accIds.Contains(t.AccountId))
        .OrderByDescending(t => t.CreatedAt).Take(100)
        .Select(t => new
        {
            t.Id, t.TransactionCode, t.Type, t.Amount, t.Description, t.Status,
            t.ToAccountNumber, accountNumber = t.Account!.AccountNumber,
            date = t.CreatedAt.ToString("yyyy/MM/dd HH:mm")
        }).ToList();
    return Results.Json(txs);
});

app.MapPost("/api/transactions", async (HttpContext ctx, BankDbContext db) =>
{
    var u = GetSessionUser(ctx, db); if (u == null) return UnauthorizedJson();
    if (u.Role == "auditor") return ForbidJson("حسابرس اجازه ثبت تراکنش ندارد");
    var body = await ctx.Request.ReadFromJsonAsync<TransactionRequest>();
    if (body == null || body.Amount <= 0)
        return Results.Json(new { success = false, message = "مبلغ نامعتبر است" });
    var acc = db.Accounts.Find(body.AccountId);
    if (acc == null) return Results.Json(new { success = false, message = "حساب یافت نشد" });
    if (acc.Status != "فعال") return Results.Json(new { success = false, message = "حساب فعال نیست" });
    var type = body.Type ?? "واریز";
    if (type == "برداشت" && acc.Balance < body.Amount)
        return Results.Json(new { success = false, message = "موجودی ناکافی" });
    if (type == "برداشت" && acc.Balance - body.Amount < 10000)
        return Results.Json(new { success = false, message = "حداقل موجودی ۱۰٬۰۰۰ تومان باید باقی بماند" });
    acc.Balance += type == "واریز" ? body.Amount : -body.Amount;
    var code = "TX" + DateTime.Now.ToString("yyMMddHHmmss") + Random.Shared.Next(10, 99);
    db.Transactions.Add(new Transaction
    {
        TransactionCode = code, Type = type, Amount = body.Amount,
        Description = body.Description ?? "تراکنش", Status = "موفق", AccountId = body.AccountId
    });
    db.SaveChanges();
    LogAudit(db, u.Id, "ثبت تراکنش", $"{code} — {type} {body.Amount:N0}", ctx);
    return Results.Json(new { success = true, code, newBalance = acc.Balance });
});

app.MapPost("/api/transfer", async (HttpContext ctx, BankDbContext db) =>
{
    var u = GetSessionUser(ctx, db); if (u == null) return UnauthorizedJson();
    if (u.Role == "auditor") return ForbidJson();
    var body = await ctx.Request.ReadFromJsonAsync<TransferRequest>();
    if (body == null || body.Amount <= 0)
        return Results.Json(new { success = false, message = "مبلغ نامعتبر است" });
    var from = db.Accounts.Find(body.FromAccountId);
    var to = db.Accounts.FirstOrDefault(a => a.AccountNumber == body.ToAccountNumber);
    if (from == null) return Results.Json(new { success = false, message = "حساب مبدأ یافت نشد" });
    if (to == null) return Results.Json(new { success = false, message = "حساب مقصد یافت نشد" });
    if (from.Id == to.Id) return Results.Json(new { success = false, message = "حساب مبدأ و مقصد یکی است" });
    if (from.Status != "فعال") return Results.Json(new { success = false, message = "حساب مبدأ فعال نیست" });
    if (to.Status != "فعال") return Results.Json(new { success = false, message = "حساب مقصد فعال نیست" });
    if (from.Balance < body.Amount) return Results.Json(new { success = false, message = "موجودی ناکافی" });
    if (from.Balance - body.Amount < 10000)
        return Results.Json(new { success = false, message = "حداقل موجودی ۱۰٬۰۰۰ تومان باید باقی بماند" });
    if (body.Amount > 500_000_000m)
        return Results.Json(new { success = false, message = "سقف انتقال روزانه ۵۰۰ میلیون تومان است" });

    var status = body.Amount >= 100_000_000m && u.Role is not ("admin" or "manager") ? "در انتظار" : "موفق";
    if (status == "موفق") { from.Balance -= body.Amount; to.Balance += body.Amount; }

    var code = "TR" + DateTime.Now.ToString("yyMMddHHmmss") + Random.Shared.Next(10, 99);
    db.Transactions.Add(new Transaction
    {
        TransactionCode = code, Type = "انتقال", Amount = body.Amount,
        Description = body.Description ?? "انتقال وجه", Status = status,
        AccountId = from.Id, ToAccountNumber = to.AccountNumber
    });
    db.SaveChanges();
    LogAudit(db, u.Id, "انتقال وجه", $"{from.AccountNumber} → {to.AccountNumber} — {body.Amount:N0} ({status})", ctx);
    return Results.Json(new
    {
        success = true, code, status, fromBalance = from.Balance,
        message = status == "در انتظار" ? "انتقال بالای ۱۰۰ میلیون نیاز به تأیید مدیر دارد" : "انتقال با موفقیت انجام شد"
    });
});

app.MapPost("/api/payments", async (HttpContext ctx, BankDbContext db) =>
{
    var u = GetSessionUser(ctx, db); if (u == null) return UnauthorizedJson();
    if (u.Role == "auditor") return ForbidJson();
    var body = await ctx.Request.ReadFromJsonAsync<PaymentRequest>();
    if (body == null || body.Amount <= 0)
        return Results.Json(new { success = false, message = "مبلغ نامعتبر است" });
    if (string.IsNullOrWhiteSpace(body.BillId))
        return Results.Json(new { success = false, message = "شناسه قبض الزامی است" });
    var acc = db.Accounts.Find(body.AccountId);
    if (acc == null) return Results.Json(new { success = false, message = "حساب یافت نشد" });
    if (acc.Status != "فعال") return Results.Json(new { success = false, message = "حساب فعال نیست" });
    if (acc.Balance < body.Amount) return Results.Json(new { success = false, message = "موجودی ناکافی" });
    if (acc.Balance - body.Amount < 10000)
        return Results.Json(new { success = false, message = "حداقل موجودی ۱۰٬۰۰۰ تومان باید باقی بماند" });
    if (!IsStaff(u) && acc.UserId != u.Id)
        return ForbidJson("این حساب متعلق به شما نیست");

    acc.Balance -= body.Amount;
    var billType = body.BillType ?? "قبض";
    var code = "PAY" + DateTime.Now.ToString("yyMMddHHmmss");
    db.Transactions.Add(new Transaction
    {
        TransactionCode = code, Type = "برداشت", Amount = body.Amount,
        Description = $"پرداخت {billType} — شناسه {body.BillId}",
        Status = "موفق", AccountId = body.AccountId
    });
    db.SaveChanges();
    LogAudit(db, u.Id, "پرداخت قبض", $"{billType} / {body.BillId} — {body.Amount:N0}", ctx);
    return Results.Json(new { success = true, code, newBalance = acc.Balance, message = $"قبض {billType} با موفقیت پرداخت شد" });
});

app.MapGet("/api/loans", (HttpContext ctx, BankDbContext db) =>
{
    var u = GetSessionUser(ctx, db); if (u == null) return UnauthorizedJson();
    var q = u.Role is "admin" or "manager" or "operator" or "auditor"
        ? db.Loans.Include(l => l.User).ToList()
        : db.Loans.Include(l => l.User).Where(l => l.UserId == u.Id).ToList();
    return Results.Json(q.Select(l => new
    {
        l.Id, l.LoanCode, l.LoanType, l.Amount, l.InterestRate, l.Installments, l.Status,
        userName = l.User?.FullName ?? "", date = l.CreatedAt.ToString("yyyy/MM/dd")
    }));
});

app.MapPost("/api/loans", async (HttpContext ctx, BankDbContext db) =>
{
    var u = GetSessionUser(ctx, db); if (u == null) return UnauthorizedJson();
    var body = await ctx.Request.ReadFromJsonAsync<LoanRequest>();
    if (body == null || body.Amount <= 0)
        return Results.Json(new { success = false, message = "مبلغ نامعتبر است" });
    var code = "LN" + DateTime.Now.ToString("yyMMdd") + Random.Shared.Next(100, 999);
    db.Loans.Add(new Loan
    {
        LoanCode = code, LoanType = body.LoanType ?? "قرض‌الحسنه", Amount = body.Amount,
        InterestRate = body.InterestRate, Installments = body.Installments > 0 ? body.Installments : 12,
        Status = "در بررسی", UserId = u.Id
    });
    db.SaveChanges();
    LogAudit(db, u.Id, "درخواست وام", $"{code} — {body.LoanType} {body.Amount:N0}", ctx);
    return Results.Json(new { success = true, code });
});

app.MapPut("/api/loans/{id:int}/status", async (int id, HttpContext ctx, BankDbContext db) =>
{
    var u = GetSessionUser(ctx, db); if (u == null) return UnauthorizedJson();
    if (!IsManagerOrAdmin(u)) return ForbidJson("فقط مدیر یا ادمین می‌تواند وضعیت وام را تغییر دهد");
    var body = await ctx.Request.ReadFromJsonAsync<StatusRequest>();
    var loan = db.Loans.Find(id);
    if (loan == null) return Results.Json(new { success = false, message = "وام یافت نشد" }, statusCode: 404);
    loan.Status = body?.Status ?? loan.Status;
    db.SaveChanges();
    LogAudit(db, u.Id, "تغییر وضعیت وام", $"LN-{id} → {loan.Status}", ctx);
    return Results.Json(new { success = true, status = loan.Status });
});

app.MapGet("/api/cards", (HttpContext ctx, BankDbContext db) =>
{
    var u = GetSessionUser(ctx, db); if (u == null) return UnauthorizedJson();
    var accIds = IsStaff(u)
        ? db.Accounts.Select(a => a.Id).ToList()
        : db.Accounts.Where(a => a.UserId == u.Id).Select(a => a.Id).ToList();
    return Results.Json(db.Cards.Include(c => c.Account).ThenInclude(a => a!.User)
        .Where(c => accIds.Contains(c.AccountId))
        .Select(c => new
        {
            c.Id, c.CardNumber, c.CardType, c.DailyLimit, c.ExpiryDate, c.Status,
            accountNumber = c.Account!.AccountNumber,
            ownerName = c.Account.User != null ? c.Account.User.FullName : ""
        }));
});

app.MapPost("/api/cards", async (HttpContext ctx, BankDbContext db) =>
{
    var u = GetSessionUser(ctx, db); if (u == null) return UnauthorizedJson();
    if (!IsStaff(u)) return ForbidJson();
    var body = await ctx.Request.ReadFromJsonAsync<CardRequest>();
    if (body == null) return Results.Json(new { success = false, message = "اطلاعات ناقص است" });
    var acc = db.Accounts.Find(body.AccountId);
    if (acc == null) return Results.Json(new { success = false, message = "حساب یافت نشد" });
    var num = "6037" + Random.Shared.Next(1000, 9999) + Random.Shared.Next(10000000, 99999999);
    db.Cards.Add(new BankCard
    {
        CardNumber = num.ToString(), CardType = body.CardType ?? "نقدی",
        DailyLimit = body.DailyLimit > 0 ? body.DailyLimit : 5_000_000,
        ExpiryDate = "12/1406", AccountId = body.AccountId
    });
    db.SaveChanges();
    LogAudit(db, u.Id, "صدور کارت", $"{num} — {body.CardType}", ctx);
    return Results.Json(new { success = true, cardNumber = num.ToString() });
});

app.MapPut("/api/cards/{id:int}/toggle", (int id, HttpContext ctx, BankDbContext db) =>
{
    var u = GetSessionUser(ctx, db); if (u == null) return UnauthorizedJson();
    if (!IsStaff(u)) return ForbidJson();
    var card = db.Cards.Find(id);
    if (card == null) return Results.Json(new { success = false, message = "کارت یافت نشد" }, statusCode: 404);
    card.Status = card.Status == "فعال" ? "مسدود" : "فعال";
    db.SaveChanges();
    LogAudit(db, u.Id, card.Status == "فعال" ? "فعال‌سازی کارت" : "مسدود کردن کارت", $"CRD-{id}", ctx);
    return Results.Json(new { success = true, status = card.Status });
});

app.MapGet("/api/users", (HttpContext ctx, BankDbContext db) =>
{
    var u = GetSessionUser(ctx, db); if (u == null) return UnauthorizedJson();
    if (!IsManagerOrAdmin(u)) return ForbidJson("فقط مدیر و ادمین به مدیریت کاربران دسترسی دارند");
    return Results.Json(db.Users.OrderBy(x => x.Id).Select(x => new
    {
        x.Id, x.Username, x.FullName, x.Email, x.Role, x.IsActive,
        lastLogin = x.LastLogin.HasValue ? x.LastLogin.Value.ToString("yyyy/MM/dd HH:mm") : "هرگز"
    }));
});

app.MapGet("/api/customers", (HttpContext ctx, BankDbContext db) =>
{
    var u = GetSessionUser(ctx, db); if (u == null) return UnauthorizedJson();
    if (!IsStaff(u) && u.Role != "auditor") return ForbidJson();
    return Results.Json(db.Users.OrderBy(x => x.Id).Select(x => new
    {
        x.Id, x.Username, x.FullName, x.Email, x.Role, x.IsActive,
        lastLogin = x.LastLogin.HasValue ? x.LastLogin.Value.ToString("yyyy/MM/dd HH:mm") : "هرگز"
    }));
});

app.MapPost("/api/users", async (HttpContext ctx, BankDbContext db) =>
{
    var u = GetSessionUser(ctx, db); if (u == null) return UnauthorizedJson();
    if (u.Role != "admin") return ForbidJson("فقط ادمین می‌تواند کاربر جدید بسازد");
    var body = await ctx.Request.ReadFromJsonAsync<UserRequest>();
    if (body == null || string.IsNullOrWhiteSpace(body.Username))
        return Results.Json(new { success = false, message = "نام کاربری الزامی است" });
    if (db.Users.Any(x => x.Username == body.Username))
        return Results.Json(new { success = false, message = "نام کاربری تکراری است" });
    if (!string.IsNullOrEmpty(body.Password) && body.Password.Length < 6)
        return Results.Json(new { success = false, message = "رمز عبور حداقل ۶ کاراکتر باشد" });
    db.Users.Add(new User
    {
        Username = body.Username!, FullName = body.FullName ?? body.Username!,
        Email = body.Email ?? "", Role = body.Role ?? "user",
        PasswordHash = BC.HashPassword(body.Password ?? "User@1234")
    });
    db.SaveChanges();
    LogAudit(db, u.Id, "ایجاد کاربر", $"{body.Username} — {body.Role}", ctx);
    return Results.Json(new { success = true });
});


app.MapPut("/api/users/{id:int}", async (int id, HttpContext ctx, BankDbContext db) =>
{
    var u = GetSessionUser(ctx, db); if (u == null) return UnauthorizedJson();
    if (u.Role != "admin" && !(u.Role == "manager")) return ForbidJson("فقط ادمین و مدیر می‌توانند کاربر را ویرایش کنند");
    var body = await ctx.Request.ReadFromJsonAsync<UserUpdateRequest>();
    if (body == null) return Results.Json(new { success = false, message = "اطلاعات ناقص است" });
    var target = db.Users.Find(id);
    if (target == null) return Results.Json(new { success = false, message = "کاربر یافت نشد" }, statusCode: 404);
    // manager cannot promote to admin or edit admins
    if (u.Role == "manager" && (target.Role == "admin" || body.Role == "admin"))
        return ForbidJson("مدیر نمی‌تواند نقش ادمین را تغییر دهد");
    if (!string.IsNullOrWhiteSpace(body.FullName)) target.FullName = body.FullName!;
    if (!string.IsNullOrWhiteSpace(body.Email)) target.Email = body.Email!;
    if (!string.IsNullOrWhiteSpace(body.Role)) target.Role = body.Role!;
    if (body.IsActive.HasValue) target.IsActive = body.IsActive.Value;
    if (!string.IsNullOrWhiteSpace(body.Password))
    {
        if (body.Password!.Length < 6)
            return Results.Json(new { success = false, message = "رمز عبور حداقل ۶ کاراکتر باشد" });
        target.PasswordHash = BC.HashPassword(body.Password);
    }
    db.SaveChanges();
    LogAudit(db, u.Id, "ویرایش کاربر", $"{target.Username} — نقش: {target.Role}", ctx);
    return Results.Json(new { success = true, message = "کاربر با موفقیت به‌روزرسانی شد" });
});

app.MapDelete("/api/users/{id:int}", (int id, HttpContext ctx, BankDbContext db) =>
{
    var u = GetSessionUser(ctx, db); if (u == null) return UnauthorizedJson();
    if (u.Role != "admin") return ForbidJson();
    var target = db.Users.Find(id);
    if (target == null) return Results.Json(new { success = false, message = "کاربر یافت نشد" }, statusCode: 404);
    if (target.Id == u.Id) return Results.Json(new { success = false, message = "نمی‌توانید خودتان را غیرفعال کنید" });
    target.IsActive = false;
    db.SaveChanges();
    LogAudit(db, u.Id, "غیرفعال‌سازی کاربر", target.Username, ctx);
    return Results.Json(new { success = true });
});

app.MapGet("/api/audit", (HttpContext ctx, BankDbContext db) =>
{
    var u = GetSessionUser(ctx, db); if (u == null) return UnauthorizedJson();
    if (u.Role is not ("admin" or "auditor")) return ForbidJson();
    return Results.Json(db.AuditLogs.Include(l => l.User)
        .OrderByDescending(l => l.CreatedAt).Take(100)
        .Select(l => new
        {
            l.Id, l.Action, l.Detail, l.IpAddress,
            userName = l.User != null ? l.User.FullName : "سیستم",
            userRole = l.User != null ? l.User.Role : "",
            date = l.CreatedAt.ToString("yyyy/MM/dd HH:mm:ss")
        }));
});

app.MapGet("/", (HttpContext ctx) =>
{
    var userId = ctx.Session.GetInt32("UserId");
    if (userId.HasValue) return Results.Redirect("/dashboard.html");
    return Results.Redirect("/login.html");
});

app.Run();

record LoginRequest(string? Username, string? Password);
record AccountRequest(string? AccountType, decimal InitialBalance, string? Status, int? UserId);
record TransactionRequest(int AccountId, string? Type, decimal Amount, string? Description);
record TransferRequest(int FromAccountId, string? ToAccountNumber, decimal Amount, string? Description);
record LoanRequest(string? LoanType, decimal Amount, double InterestRate, int Installments);
record CardRequest(int AccountId, string? CardType, decimal DailyLimit);
record UserRequest(string? Username, string? FullName, string? Email, string? Role, string? Password);
record UserUpdateRequest(string? FullName, string? Email, string? Role, string? Password, bool? IsActive);
record StatusRequest(string? Status);
record PaymentRequest(int AccountId, string? BillType, string? BillId, decimal Amount);
