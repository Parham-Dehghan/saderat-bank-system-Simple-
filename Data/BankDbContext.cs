using Microsoft.EntityFrameworkCore;
using SaderatBank.Models;
using BC = BCrypt.Net.BCrypt;

namespace SaderatBank.Data;

public class BankDbContext : DbContext
{
    public BankDbContext(DbContextOptions<BankDbContext> options) : base(options) { }

    public DbSet<User> Users => Set<User>();
    public DbSet<Account> Accounts => Set<Account>();
    public DbSet<Transaction> Transactions => Set<Transaction>();
    public DbSet<Loan> Loans => Set<Loan>();
    public DbSet<BankCard> Cards => Set<BankCard>();
    public DbSet<AuditLog> AuditLogs => Set<AuditLog>();

    protected override void OnModelCreating(ModelBuilder m)
    {
        m.Entity<Account>().Property(a => a.Balance).HasPrecision(18, 2);
        m.Entity<Transaction>().Property(t => t.Amount).HasPrecision(18, 2);
        m.Entity<Loan>().Property(l => l.Amount).HasPrecision(18, 2);
        m.Entity<BankCard>().Property(c => c.DailyLimit).HasPrecision(18, 2);

        m.Entity<User>().HasIndex(u => u.Username).IsUnique();
        m.Entity<Account>().HasIndex(a => a.AccountNumber).IsUnique();
        m.Entity<Transaction>().HasIndex(t => t.TransactionCode);
        m.Entity<Loan>().HasIndex(l => l.LoanCode);
        m.Entity<BankCard>().HasIndex(c => c.CardNumber);
    }

    public static void Seed(BankDbContext db)
    {
        db.Database.EnsureCreated();
        if (db.Users.Any()) return;

        var admin = new User { Username = "admin", PasswordHash = BC.HashPassword("Admin@1234"), FullName = "مدیر ارشد سیستم", Email = "admin@saderat.ir", Role = "admin" };
        var manager = new User { Username = "manager1", PasswordHash = BC.HashPassword("Manager@1234"), FullName = "رضا حسینی", Email = "manager@saderat.ir", Role = "manager" };
        var op = new User { Username = "operator1", PasswordHash = BC.HashPassword("Op@1234"), FullName = "سارا موسوی", Email = "op1@saderat.ir", Role = "operator" };
        var user1 = new User { Username = "ali.karimi", PasswordHash = BC.HashPassword("User@1234"), FullName = "علی کریمی", Email = "ali@gmail.com", Role = "user" };
        var user2 = new User { Username = "fateme.m", PasswordHash = BC.HashPassword("User@1234"), FullName = "فاطمه محمدی", Email = "fateme@gmail.com", Role = "user" };
        var auditor = new User { Username = "auditor", PasswordHash = BC.HashPassword("Audit@1234"), FullName = "نیلوفر احمدی", Email = "audit@saderat.ir", Role = "auditor" };

        db.Users.AddRange(admin, manager, op, user1, user2, auditor);
        db.SaveChanges();

        var acc1 = new Account { AccountNumber = "0119876543210", AccountType = "جاری", Balance = 125000000, UserId = user1.Id };
        var acc2 = new Account { AccountNumber = "0221234567890", AccountType = "پس‌انداز", Balance = 340000000, UserId = user2.Id };
        var acc3 = new Account { AccountNumber = "0330001122334", AccountType = "جاری", Balance = 1850000000, UserId = admin.Id };
        var acc4 = new Account { AccountNumber = "0445566778899", AccountType = "قرض‌الحسنه", Balance = 5000000, UserId = user1.Id };
        var acc5 = new Account { AccountNumber = "0559988776655", AccountType = "کوتاه‌مدت", Balance = 78000000, Status = "مسدود", UserId = user2.Id };

        db.Accounts.AddRange(acc1, acc2, acc3, acc4, acc5);
        db.SaveChanges();

        db.Transactions.AddRange(
            new Transaction { TransactionCode = "TX001", Type = "واریز", Amount = 15000000, Description = "حقوق ماهیانه", AccountId = acc1.Id },
            new Transaction { TransactionCode = "TX002", Type = "برداشت", Amount = 8000000, Description = "خرید", AccountId = acc2.Id },
            new Transaction { TransactionCode = "TX003", Type = "انتقال", Amount = 50000000, Description = "پرداخت قرارداد", AccountId = acc3.Id, ToAccountNumber = acc1.AccountNumber },
            new Transaction { TransactionCode = "TX004", Type = "برداشت", Amount = 3000000, Description = "ATM", AccountId = acc1.Id },
            new Transaction { TransactionCode = "TX005", Type = "واریز", Amount = 100000000, Description = "انتقال سرمایه", AccountId = acc2.Id },
            new Transaction { TransactionCode = "TX006", Type = "واریز", Amount = 200000000, Description = "فروش کالا", AccountId = acc3.Id }
        );

        db.Loans.AddRange(
            new Loan { LoanCode = "LN001", LoanType = "مسکن", Amount = 800000000, InterestRate = 18, Installments = 60, Status = "جاری", UserId = user1.Id },
            new Loan { LoanCode = "LN002", LoanType = "خودرو", Amount = 300000000, InterestRate = 22, Installments = 36, Status = "جاری", UserId = user2.Id },
            new Loan { LoanCode = "LN003", LoanType = "ازدواج", Amount = 100000000, InterestRate = 4, Installments = 84, Status = "جاری", UserId = user1.Id },
            new Loan { LoanCode = "LN004", LoanType = "قرض‌الحسنه", Amount = 50000000, InterestRate = 0, Installments = 24, Status = "تسویه", UserId = user2.Id },
            new Loan { LoanCode = "LN005", LoanType = "کسب‌وکار", Amount = 250000000, InterestRate = 20, Installments = 36, Status = "در بررسی", UserId = user1.Id }
        );

        db.Cards.AddRange(
            new BankCard { CardNumber = "6037697812345678", CardType = "نقدی", DailyLimit = 10000000, ExpiryDate = "06/1406", AccountId = acc1.Id },
            new BankCard { CardNumber = "6037697856789012", CardType = "اعتباری", DailyLimit = 50000000, ExpiryDate = "03/1405", AccountId = acc2.Id },
            new BankCard { CardNumber = "6037697890123456", CardType = "نقدی", DailyLimit = 100000000, ExpiryDate = "12/1405", Status = "مسدود", AccountId = acc3.Id }
        );

        db.AuditLogs.AddRange(
            new AuditLog { Action = "ورود", Detail = "احراز هویت موفق", IpAddress = "192.168.1.1", UserId = admin.Id },
            new AuditLog { Action = "افتتاح حساب", Detail = "ACC-001 — جاری", IpAddress = "192.168.1.1", UserId = admin.Id },
            new AuditLog { Action = "ثبت تراکنش", Detail = "TX001 — واریز ۱۵ میلیون", IpAddress = "192.168.1.5", UserId = op.Id }
        );

        db.SaveChanges();
    }
}
