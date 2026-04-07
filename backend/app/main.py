import os
from contextlib import asynccontextmanager
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from .config import settings
from .database import engine, Base

# Import all models so SQLAlchemy registers them before create_all
from .models import (  # noqa: F401
    Account, Transaction, TransactionSplit, Category, Budget, Receipt, PlaidItem,
    InvestmentAccount, InvestmentHolding,
    IrregularExpense, RegularExpense,
    AccountBalanceSnapshot,
)

from .routers import (
    accounts, transactions, categories, budgets,
    receipts, plaid, import_csv, analytics
)
from .routers import investments, expense_history
from .routers import account_snapshots

DEFAULT_CATEGORIES = [
    # Income
    {"name": "Paycheck",        "color": "#22c55e", "icon": "Banknote",        "is_income": True,  "is_system": True},
    {"name": "Freelance",       "color": "#16a34a", "icon": "Laptop",          "is_income": True,  "is_system": True},
    {"name": "Investment Return","color": "#15803d", "icon": "TrendingUp",      "is_income": True,  "is_system": True},
    {"name": "Reimbursement",   "color": "#4ade80", "icon": "RotateCcw",       "is_income": True,  "is_system": True},
    # Housing
    {"name": "Rent/Mortgage",   "color": "#6366f1", "icon": "House",           "is_income": False, "is_system": True},
    {"name": "Utilities",       "color": "#818cf8", "icon": "Zap",             "is_income": False, "is_system": True},
    {"name": "Internet/Phone",  "color": "#a5b4fc", "icon": "Wifi",            "is_income": False, "is_system": True},
    # Food
    {"name": "Groceries",       "color": "#f97316", "icon": "ShoppingCart",    "is_income": False, "is_system": True},
    {"name": "Restaurants",     "color": "#fb923c", "icon": "UtensilsCrossed", "is_income": False, "is_system": True},
    {"name": "Coffee",          "color": "#c2410c", "icon": "Coffee",          "is_income": False, "is_system": True},
    # Transport
    {"name": "Gas",             "color": "#eab308", "icon": "Fuel",            "is_income": False, "is_system": True},
    {"name": "Public Transit",  "color": "#fbbf24", "icon": "Bus",             "is_income": False, "is_system": True},
    {"name": "Rideshare",       "color": "#d97706", "icon": "Car",             "is_income": False, "is_system": True},
    # Health
    {"name": "Medical",         "color": "#ef4444", "icon": "HeartPulse",      "is_income": False, "is_system": True},
    {"name": "Pharmacy",        "color": "#f87171", "icon": "Pill",            "is_income": False, "is_system": True},
    {"name": "Fitness",         "color": "#dc2626", "icon": "Dumbbell",        "is_income": False, "is_system": True},
    # Shopping
    {"name": "Clothing",        "color": "#ec4899", "icon": "ShoppingBag",     "is_income": False, "is_system": True},
    {"name": "Electronics",     "color": "#db2777", "icon": "Monitor",         "is_income": False, "is_system": True},
    {"name": "Online Shopping", "color": "#be185d", "icon": "Package",         "is_income": False, "is_system": True},
    # Entertainment
    {"name": "Streaming",       "color": "#8b5cf6", "icon": "Play",            "is_income": False, "is_system": True},
    {"name": "Games",           "color": "#7c3aed", "icon": "Gamepad2",        "is_income": False, "is_system": True},
    # Finance
    {"name": "Subscriptions",   "color": "#0ea5e9", "icon": "RefreshCw",       "is_income": False, "is_system": True},
    {"name": "Insurance",       "color": "#0284c7", "icon": "Shield",          "is_income": False, "is_system": True},
    {"name": "Bank Fees",       "color": "#075985", "icon": "Landmark",        "is_income": False, "is_system": True},
    {"name": "Taxes",           "color": "#0c4a6e", "icon": "Receipt",         "is_income": False, "is_system": True},
    # Transfers (excluded from expense totals — used for credit card payments, account moves)
    {"name": "Transfer",        "color": "#64748b", "icon": "ArrowLeftRight",  "is_income": False, "is_system": True},
    # Other
    {"name": "Travel",          "color": "#14b8a6", "icon": "Plane",           "is_income": False, "is_system": True},
    {"name": "Gifts",           "color": "#06b6d4", "icon": "Gift",            "is_income": False, "is_system": True},
    {"name": "Education",       "color": "#10b981", "icon": "GraduationCap",   "is_income": False, "is_system": True},
    {"name": "Uncategorized",   "color": "#6b7280", "icon": "CircleHelp",      "is_income": False, "is_system": True},
]


def seed_categories(db):
    from .models.category import Category
    for cat_data in DEFAULT_CATEGORIES:
        if not db.query(Category).filter(Category.name == cat_data["name"]).first():
            db.add(Category(**cat_data))
    db.commit()


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Create all tables
    Base.metadata.create_all(bind=engine)
    # Seed default categories on first run
    from .database import SessionLocal
    with SessionLocal() as db:
        seed_categories(db)
        # Demo mode: seed / refresh fake data each calendar month
        if os.getenv("DEMO_MODE", "").lower() in ("1", "true", "yes"):
            from .demo_seed import needs_reseed, run_demo_seed
            if needs_reseed():
                run_demo_seed(db)
    yield


app = FastAPI(title="Personal Finance API", lifespan=lifespan)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(accounts.router,     prefix="/api/accounts",     tags=["accounts"])
app.include_router(transactions.router, prefix="/api/transactions",  tags=["transactions"])
app.include_router(categories.router,   prefix="/api/categories",    tags=["categories"])
app.include_router(budgets.router,      prefix="/api/budgets",       tags=["budgets"])
app.include_router(receipts.router,     prefix="/api/receipts",      tags=["receipts"])
app.include_router(plaid.router,        prefix="/api/plaid",         tags=["plaid"])
app.include_router(import_csv.router,   prefix="/api/import",        tags=["import"])
app.include_router(analytics.router,      prefix="/api/analytics",      tags=["analytics"])
app.include_router(investments.router,    prefix="/api/investments",    tags=["investments"])
app.include_router(expense_history.router, prefix="/api/expense-history", tags=["expense-history"])
app.include_router(account_snapshots.router, prefix="/api/accounts", tags=["account-snapshots"])


@app.get("/api/health")
def health():
    return {"status": "ok"}
