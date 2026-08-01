namespace SaderatBank.Models;

public class User
{
    public int Id { get; set; }
    public string Username { get; set; } = "";
    public string PasswordHash { get; set; } = "";
    public string FullName { get; set; } = "";
    public string Email { get; set; } = "";
    public string Role { get; set; } = "user";
    public bool IsActive { get; set; } = true;
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public DateTime? LastLogin { get; set; }
    public ICollection<Account> Accounts { get; set; } = new List<Account>();
}

public class Account
{
    public int Id { get; set; }
    public string AccountNumber { get; set; } = "";
    public string AccountType { get; set; } = "جاری";
    public decimal Balance { get; set; } = 0;
    public string Status { get; set; } = "فعال";
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public int UserId { get; set; }
    public User? User { get; set; }
    public ICollection<Transaction> Transactions { get; set; } = new List<Transaction>();
}

public class Transaction
{
    public int Id { get; set; }
    public string TransactionCode { get; set; } = "";
    public string Type { get; set; } = "";
    public decimal Amount { get; set; }
    public string Description { get; set; } = "";
    public string Status { get; set; } = "موفق";
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public int AccountId { get; set; }
    public Account? Account { get; set; }
    public string? ToAccountNumber { get; set; }
}

public class Loan
{
    public int Id { get; set; }
    public string LoanCode { get; set; } = "";
    public string LoanType { get; set; } = "";
    public decimal Amount { get; set; }
    public double InterestRate { get; set; }
    public int Installments { get; set; }
    public string Status { get; set; } = "در بررسی";
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public int UserId { get; set; }
    public User? User { get; set; }
}

public class BankCard
{
    public int Id { get; set; }
    public string CardNumber { get; set; } = "";
    public string CardType { get; set; } = "نقدی";
    public decimal DailyLimit { get; set; } = 5000000;
    public string ExpiryDate { get; set; } = "";
    public string Status { get; set; } = "فعال";
    public int AccountId { get; set; }
    public Account? Account { get; set; }
}

public class AuditLog
{
    public int Id { get; set; }
    public string Action { get; set; } = "";
    public string Detail { get; set; } = "";
    public string IpAddress { get; set; } = "";
    public DateTime CreatedAt { get; set; } = DateTime.UtcNow;
    public int UserId { get; set; }
    public User? User { get; set; }
}
