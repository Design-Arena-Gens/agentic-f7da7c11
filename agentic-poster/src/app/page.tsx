import Dashboard from "@/components/dashboard";
import { getDashboardSnapshot } from "@/lib/db";

export default async function Home() {
  const snapshot = await getDashboardSnapshot();
  return (
    <div className="app-shell">
      <Dashboard snapshot={snapshot} />
    </div>
  );
}
