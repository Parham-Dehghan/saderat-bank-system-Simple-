using Microsoft.EntityFrameworkCore;
using SaderatBank.Data;
using SaderatBank.Models;
using BC = BCrypt.Net.BCrypt;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddDbContext<BankDbContext>(opt =>
    opt.UseSqlite("Data Source=saderat_bank.db"));

builder.Services.AddDistributedMemoryCache();
builder.Services.AddSession(o => { o.IdleTimeout = TimeSpan.FromHours(8); o.Cookie.HttpOnly = true; });
builder.Services.AddCors();

var app = builder.Build();

// Seed database
using (var scope = app.Services.CreateScope())
{
    var db = scope.ServiceProvider.GetRequiredService<BankDbContext>();
    BankDbContext.Seed(db);
}

app.UseStaticFiles();
app.UseSession();
app.UseCors(x => x.AllowAnyOrigin().AllowAnyMethod().AllowAnyHeader());

// ─── HELPERS ──────────────────────────────────────────────
User? GetSessionUser(HttpContext ctx, BankDbContext db)
{
    var id = ctx.Session.GetInt32("UserId");
    return id.HasValue ? db.Users.Find(id.Value) : null;
}

void LogAudit(BankDbContext db, int userId, string action, string detail, HttpContext ctx)
{
    db.AuditLogs.Add(new AuditLog
    {
        UserId = userId, Action = action, Detail = detail,
        IpAddress = ctx.Connection.RemoteIpAddress?.ToString() ?? "unknown"
    });
    db.SaveChanges();
}

// ─── AUTH ─────────────────────────────────────────────────
app.MapPost("/api/auth/login", async (HttpContext ctx, BankDbContext db) =>
{
    var body = await ctx.Request.ReadFromJsonAsync<LoginRequest>();
    if (body == null) return Results.BadRequest();
    var user = db.Users.FirstOrDefault(u => u.Username == body.Username && u.IsActive);
    if (user == null || !BC.Verify(body.Password, user.PasswordHash))
        return Results.Json(new { success = false, message = "نام کاربری یا رمز عبور اشتباه است" });
    user.LastLogin = DateTime.UtcNow;
    db.SaveChanges();
    ctx.Session.SetInt32("UserId", user.Id);
    ctx.Session.SetString("UserRole", user.Role);
    LogAudit(db, user.Id, "ورود", "احراز هویت موفق", ctx);
    return Results.Json(new { success = true, role = user.Role, name = user.FullName });
});

app.MapPost("/api/auth/logout", (HttpContext ctx) =>
{
    ctx.Session.Clear();
    return Results.Json(new { success = true });
});

app.MapGet("/api/auth/me", (HttpContext ctx, BankDbContext db) =>
{
    var u = GetSessionUser(ctx, db);
    if (u == null) return Results.Unauthorized();
    return Results.Json(new { id = u.Id, name = u.FullName, role = u.Role, email = u.Email, username = u.Username });
});

// ─── DASHBOARD ────────────────────────────────────────────
app.MapGet("/api/dashboard", (HttpContext ctx, BankDbContext db) =>
{
    var u = GetSessionUser(ctx, db); if (u == null) return Results.Unauthorized();
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

// ─── ACCOUNTS ─────────────────────────────────────────────
app.MapGet("/api/accounts", (HttpContext ctx, BankDbContext db) =>
{
    var u = GetSessionUser(ctx, db); if (u == null) return Results.Unauthorized();
    var q = u.Role is "admin" or "manager" or "operator"
        ? db.Accounts.Include(a => a.User).ToList()
        : db.Accounts.Include(a => a.User).Where(a => a.UserId == u.Id).ToList();
    return Results.Json(q.Select(a => new
    {
        a.Id, a.AccountNumber, a.AccountType, a.Balance, a.Status,
        ownerName = a.User?.FullName ?? "",
        date = a.CreatedAt.ToString("yyyy/MM/dd")
    }));
});

app.MapPost("/api/accounts", async (HttpContext ctx, BankDbContext db) =>
{
    var u = GetSessionUser(ctx, db); if (u == null) return Results.Unauthorized();
    if (u.Role is not ("admin" or "manager" or "operator")) return Results.Forbid();
    var body = await ctx.Request.ReadFromJsonAsync<AccountRequest>();
    if (body == null) return Results.BadRequest();
    var acc = new Account
    {
        AccountNumber = "0" + new Random().Next(100000000, 999999999) + "0",
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
    var u = GetSessionUser(ctx, db); if (u == null) return Results.Unauthorized();
    if (u.Role != "admin") return Results.Forbid();
    var acc = db.Accounts.Find(id);
    if (acc == null) return Results.NotFound();
    db.Accounts.Remove(acc);
    db.SaveChanges();
    LogAudit(db, u.Id, "حذف حساب", $"ACC-{id}", ctx);
    return Results.Json(new { success = true });
});

// ─── TRANSACTIONS ─────────────────────────────────────────
app.MapGet("/api/transactions", (HttpContext ctx, BankDbContext db) =>
{
    var u = GetSessionUser(ctx, db); if (u == null) return Results.Unauthorized();
    var accIds = u.Role is "admin" or "manager" or "operator" or "auditor"
        ? db.Accounts.Select(a => a.Id).ToList()
        : db.Accounts.Where(a => a.UserId == u.Id).Select(a => a.Id).ToList();
    var txs = db.Transactions.Include(t => t.Account)
        .Where(t => accIds.Contains(t.AccountId))
        .OrderByDescending(t => t.CreatedAt).Take(50)
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
    var u = GetSessionUser(ctx, db); if (u == null) return Results.Unauthorized();
    if (u.Role is "auditor") return Results.Forbid();
    var body = await ctx.Request.ReadFromJsonAsync<TransactionRequest>();
    if (body == null) return Results.BadRequest();
    var acc = db.Accounts.Find(body.AccountId);
    if (acc == null) return Results.NotFound(new { message = "حساب یافت نشد" });
    if (body.Type == "برداشت" && acc.Balance < body.Amount)
        return Results.Json(new { success = false, message = "موجودی ناکافی" });
    acc.Balance += body.Type == "واریز" ? body.Amount : -body.Amount;
    var code = "TX" + DateTime.Now.ToString("yyMMddHHmmss");
    db.Transactions.Add(new Transaction
    {
        TransactionCode = code, Type = body.Type!, Amount = body.Amount,
        Description = body.Description ?? "تراکنش", Status = "موفق", AccountId = body.AccountId
    });
    db.SaveChanges();
    LogAudit(db, u.Id, "ثبت تراکنش", $"{code} — {body.Type} {body.Amount:N0}", ctx);
    return Results.Json(new { success = true, code, newBalance = acc.Balance });
});

// ─── TRANSFER ─────────────────────────────────────────────
app.MapPost("/api/transfer", async (HttpContext ctx, BankDbContext db) =>
{
    var u = GetSessionUser(ctx, db); if (u == null) return Results.Unauthorized();
    if (u.Role is "auditor") return Results.Forbid();
    var body = await ctx.Request.ReadFromJsonAsync<TransferRequest>();
    if (body == null) return Results.BadRequest();
    var from = db.Accounts.Find(body.FromAccountId);
    var to = db.Accounts.FirstOrDefault(a => a.AccountNumber == body.ToAccountNumber);
    if (from == null) return Results.Json(new { success = false, message = "حساب مبدأ یافت نشد" });
    if (to == null) return Results.Json(new { success = false, message = "حساب مقصد یافت نشد" });
    if (from.Id == to.Id) return Results.Json(new { success = false, message = "حساب مبدأ و مقصد یکی است" });
    if (from.Balance < body.Amount) return Results.Json(new { success = false, message = "موجودی ناکافی" });
    from.Balance -= body.Amount;
    to.Balance += body.Amount;
    var code = "TR" + DateTime.Now.ToString("yyMMddHHmmss");
    db.Transactions.Add(new Transaction
    {
        TransactionCode = code, Type = "انتقال", Amount = body.Amount,
        Description = body.Description ?? "انتقال وجه", Status = "موفق",
        AccountId = from.Id, ToAccountNumber = to.AccountNumber
    });
    db.SaveChanges();
    LogAudit(db, u.Id, "انتقال وجه", $"{from.AccountNumber} → {to.AccountNumber} — {body.Amount:N0}", ctx);
    return Results.Json(new { success = true, code, fromBalance = from.Balance });
});

// ─── LOANS ────────────────────────────────────────────────
app.MapGet("/api/loans", (HttpContext ctx, BankDbContext db) =>
{
    var u = GetSessionUser(ctx, db); if (u == null) return Results.Unauthorized();
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
    var u = GetSessionUser(ctx, db); if (u == null) return Results.Unauthorized();
    var body = await ctx.Request.ReadFromJsonAsync<LoanRequest>();
    if (body == null) return Results.BadRequest();
    var code = "LN" + DateTime.Now.ToString("yyMMdd") + new Random().Next(100, 999);
    db.Loans.Add(new Loan
    {
        LoanCode = code, LoanType = body.LoanType!, Amount = body.Amount,
        InterestRate = body.InterestRate, Installments = body.Installments,
        Status = "در بررسی", UserId = u.Id
    });
    db.SaveChanges();
    LogAudit(db, u.Id, "درخواست وام", $"{code} — {body.LoanType} {body.Amount:N0}", ctx);
    return Results.Json(new { success = true, code });
});

app.MapPut("/api/loans/{id:int}/status", async (int id, HttpContext ctx, BankDbContext db) =>
{
    var u = GetSessionUser(ctx, db); if (u == null) return Results.Unauthorized();
    if (u.Role is not ("admin" or "manager")) return Results.Forbid();
    var body = await ctx.Request.ReadFromJsonAsync<StatusRequest>();
    var loan = db.Loans.Find(id); if (loan == null) return Results.NotFound();
    loan.Status = body?.Status ?? loan.Status;
    db.SaveChanges();
    LogAudit(db, u.Id, "تغییر وضعیت وام", $"LN-{id} → {loan.Status}", ctx);
    return Results.Json(new { success = true });
});

// ─── CARDS ────────────────────────────────────────────────
app.MapGet("/api/cards", (HttpContext ctx, BankDbContext db) =>
{
    var u = GetSessionUser(ctx, db); if (u == null) return Results.Unauthorized();
    var accIds = u.Role is "admin" or "manager" or "operator"
        ? db.Accounts.Select(a => a.Id).ToList()
        : db.Accounts.Where(a => a.UserId == u.Id).Select(a => a.Id).ToList();
    return Results.Json(db.Cards.Include(c => c.Account).ThenInclude(a => a!.User)
        .Where(c => accIds.Contains(c.AccountId))
        .Select(c => new
        {
            c.Id, c.CardNumber, c.CardType, c.DailyLimit, c.ExpiryDate, c.Status,
            accountNumber = c.Account!.AccountNumber, ownerName = c.Account.User!.FullName
        }));
});

app.MapPost("/api/cards", async (HttpContext ctx, BankDbContext db) =>
{
    var u = GetSessionUser(ctx, db); if (u == null) return Results.Unauthorized();
    if (u.Role is not ("admin" or "manager" or "operator")) return Results.Forbid();
    var body = await ctx.Request.ReadFromJsonAsync<CardRequest>();
    if (body == null) return Results.BadRequest();
    var rnd = new Random();
    var num = "6037" + rnd.Next(1000, 9999).ToString() + rnd.Next(10000000, 99999999).ToString();
    db.Cards.Add(new BankCard
    {
        CardNumber = num, CardType = body.CardType ?? "نقدی",
        DailyLimit = body.DailyLimit, ExpiryDate = "12/1406",
        AccountId = body.AccountId
    });
    db.SaveChanges();
    LogAudit(db, u.Id, "صدور کارت", $"{num} — {body.CardType}", ctx);
    return Results.Json(new { success = true, cardNumber = num });
});

app.MapPut("/api/cards/{id:int}/toggle", (int id, HttpContext ctx, BankDbContext db) =>
{
    var u = GetSessionUser(ctx, db); if (u == null) return Results.Unauthorized();
    if (u.Role is not ("admin" or "manager" or "operator")) return Results.Forbid();
    var card = db.Cards.Find(id); if (card == null) return Results.NotFound();
    card.Status = card.Status == "فعال" ? "مسدود" : "فعال";
    db.SaveChanges();
    LogAudit(db, u.Id, $"{(card.Status == "فعال" ? "فعال‌سازی" : "مسدود")} کارت", $"CRD-{id}", ctx);
    return Results.Json(new { success = true, status = card.Status });
});

// ─── USERS ────────────────────────────────────────────────
app.MapGet("/api/users", (HttpContext ctx, BankDbContext db) =>
{
    var u = GetSessionUser(ctx, db); if (u == null) return Results.Unauthorized();
    if (u.Role is not ("admin" or "manager")) return Results.Forbid();
    return Results.Json(db.Users.Select(u => new
    {
        u.Id, u.Username, u.FullName, u.Email, u.Role, u.IsActive,
        lastLogin = u.LastLogin.HasValue ? u.LastLogin.Value.ToString("yyyy/MM/dd HH:mm") : "هرگز"
    }));
});

app.MapPost("/api/users", async (HttpContext ctx, BankDbContext db) =>
{
    var u = GetSessionUser(ctx, db); if (u == null) return Results.Unauthorized();
    if (u.Role != "admin") return Results.Forbid();
    var body = await ctx.Request.ReadFromJsonAsync<UserRequest>();
    if (body == null || string.IsNullOrEmpty(body.Username)) return Results.BadRequest();
    if (db.Users.Any(x => x.Username == body.Username))
        return Results.Json(new { success = false, message = "نام کاربری تکراری است" });
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

app.MapDelete("/api/users/{id:int}", (int id, HttpContext ctx, BankDbContext db) =>
{
    var u = GetSessionUser(ctx, db); if (u == null) return Results.Unauthorized();
    if (u.Role != "admin") return Results.Forbid();
    var target = db.Users.Find(id);
    if (target == null) return Results.NotFound();
    target.IsActive = false;
    db.SaveChanges();
    return Results.Json(new { success = true });
});

// ─── AUDIT LOG ────────────────────────────────────────────
app.MapGet("/api/audit", (HttpContext ctx, BankDbContext db) =>
{
    var u = GetSessionUser(ctx, db); if (u == null) return Results.Unauthorized();
    if (u.Role is not ("admin" or "auditor")) return Results.Forbid();
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

// ─── SERVE FRONTEND ───────────────────────────────────────
app.MapGet("/", (HttpContext ctx) =>
{
    var userId = ctx.Session.GetInt32("UserId");
    if (userId.HasValue)
        return Results.Redirect("/dashboard.html");
    return Results.Redirect("/login.html");
});

app.Run();

// ─── REQUEST MODELS ───────────────────────────────────────
record LoginRequest(string Username, string Password);
record AccountRequest(string? AccountType, decimal InitialBalance, string? Status, int? UserId);
record TransactionRequest(int AccountId, string? Type, decimal Amount, string? Description);
record TransferRequest(int FromAccountId, string ToAccountNumber, decimal Amount, string? Description);
record LoanRequest(string? LoanType, decimal Amount, double InterestRate, int Installments);
record CardRequest(int AccountId, string? CardType, decimal DailyLimit);
record UserRequest(string? Username, string? FullName, string? Email, string? Role, string? Password);
record StatusRequest(string? Status);
