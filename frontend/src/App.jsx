import { BrowserRouter, Routes, Route } from "react-router-dom";
import { AppShell } from "./components/layout/AppShell";
import Dashboard    from "./pages/Dashboard";
import Transactions from "./pages/Transactions";
import Accounts     from "./pages/Accounts";
import Investments  from "./pages/Investments";
import Budgets      from "./pages/Budgets";
import Categories   from "./pages/Categories";
import Analytics    from "./pages/Analytics";
import Income       from "./pages/Income";
import Receipts     from "./pages/Receipts";
import Settings     from "./pages/Settings";

export default function App() {
  return (
    <BrowserRouter>
      <AppShell>
        <Routes>
          <Route path="/"             element={<Dashboard />}    />
          <Route path="/transactions" element={<Transactions />} />
          <Route path="/accounts"     element={<Accounts />}     />
          <Route path="/investments"  element={<Investments />}  />
          <Route path="/budgets"      element={<Budgets />}      />
          <Route path="/categories"   element={<Categories />}   />
          <Route path="/analytics"    element={<Analytics />}    />
          <Route path="/income"       element={<Income />}       />
          <Route path="/receipts"     element={<Receipts />}     />
          <Route path="/settings"     element={<Settings />}     />
        </Routes>
      </AppShell>
    </BrowserRouter>
  );
}
