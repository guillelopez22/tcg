import { DashboardNav } from '@/components/dashboard-nav';
import { DashboardGuard } from '@/components/dashboard-guard';

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <DashboardGuard>
      <div className="flex min-h-screen flex-col bg-surface">
        <DashboardNav />
        <main id="main-content" className="flex-1 lg-container py-6 lg-page-padding">
          {children}
        </main>
      </div>
    </DashboardGuard>
  );
}
