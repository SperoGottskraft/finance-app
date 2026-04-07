import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  ArrowLeftRight,
  CreditCard,
  BriefcaseBusiness,
  Target,
  Tags,
  BarChart3,
  TrendingUp,
  Receipt,
  Settings,
  Wallet,
} from "lucide-react";
import { cx } from "../../lib/utils";

const LINKS = [
  { to: "/",            label: "Dashboard",    icon: LayoutDashboard },
  { to: "/transactions",label: "Transactions", icon: ArrowLeftRight  },
  { to: "/accounts",    label: "Accounts",     icon: CreditCard      },
  { to: "/investments", label: "Investments",  icon: BriefcaseBusiness },
  { to: "/budgets",     label: "Budgets",      icon: Target          },
  { to: "/categories",  label: "Categories",   icon: Tags            },
  { to: "/analytics",   label: "Analytics",    icon: BarChart3       },
  { to: "/income",      label: "Income",       icon: TrendingUp      },
  { to: "/receipts",    label: "Receipts",     icon: Receipt         },
  { to: "/settings",    label: "Settings",     icon: Settings        },
];

export function Sidebar({ mobile = false, onClose }) {
  return (
    <nav
      className={cx(
        "flex flex-col bg-[#0a0f1a] border-r border-slate-800",
        mobile ? "w-full" : "w-56 shrink-0 h-screen sticky top-0"
      )}
    >
      {/* Logo */}
      <div className="flex items-center gap-2.5 px-5 py-5 border-b border-slate-800">
        <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-blue-600/15 border border-blue-600/30">
          <Wallet className="h-4 w-4 text-blue-500" />
        </div>
        <span className="font-bold text-slate-100 tracking-tight">FinanceOS</span>
      </div>

      {/* Nav links */}
      <ul className="flex flex-col gap-0.5 p-3 flex-1">
        {LINKS.map(({ to, label, icon: Icon }) => (
          <li key={to}>
            <NavLink
              to={to}
              end={to === "/"}
              onClick={onClose}
              className={({ isActive }) =>
                cx(
                  "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm transition-colors",
                  isActive
                    ? "bg-blue-600/12 text-blue-400 font-medium border border-blue-600/20"
                    : "text-slate-400 hover:text-slate-200 hover:bg-slate-800/60"
                )
              }
            >
              <Icon className="h-4 w-4 shrink-0" />
              {label}
            </NavLink>
          </li>
        ))}
      </ul>

      <div className="p-4 border-t border-slate-800">
        <p className="text-[10px] text-slate-600 text-center">FinanceOS v1.0</p>
      </div>
    </nav>
  );
}
