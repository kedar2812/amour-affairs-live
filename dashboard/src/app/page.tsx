import { KPICards } from "@/components/dashboard/KPICards";
import { UpcomingOccasions } from "@/components/dashboard/UpcomingOccasions";
import { WebsiteTrafficStrip } from "@/components/dashboard/WebsiteTrafficStrip";
import { RevenueChart } from "@/components/dashboard/RevenueChart";
import { FunnelChart } from "@/components/dashboard/FunnelChart";
import { UpcomingShoots } from "@/components/dashboard/UpcomingShoots";
import { PackagePerformance } from "@/components/dashboard/PackagePerformance";
import { TeamStatus } from "@/components/dashboard/TeamStatus";
import { TrafficBreakdown } from "@/components/dashboard/TrafficBreakdown";
import { RetentionCallout } from "@/components/dashboard/RetentionCallout";
import { PendingActions } from "@/components/dashboard/PendingActions";

export default function Dashboard() {
  return (
    <div className="flex flex-col gap-6 max-w-[1540px] mx-auto w-full">
      {/* Row 1: KPI Strip */}
      <KPICards />

      {/* Row 1.5: Website traffic at a glance (first-party analytics) */}
      <WebsiteTrafficStrip />

      {/* Row 2: CRM occasions (WhatsApp wishes) + Retention */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 min-h-[380px]">
          <UpcomingOccasions />
        </div>
        <div className="min-h-[380px]">
          <RetentionCallout />
        </div>
      </div>

      {/* Row 3: Revenue Chart + Funnel */}
      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        <div className="lg:col-span-3 min-h-[420px]">
          <RevenueChart />
        </div>
        <div className="lg:col-span-2 min-h-[420px]">
          <FunnelChart />
        </div>
      </div>

      {/* Row 4: Upcoming Shoots + Traffic + Action Items */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="min-h-[380px]">
          <UpcomingShoots />
        </div>
        <div className="min-h-[380px]">
          <TrafficBreakdown />
        </div>
        <div className="min-h-[380px]">
          <PendingActions />
        </div>
      </div>

      {/* Row 5: Package Performance + Team */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 pb-4">
        <div className="min-h-[340px]">
          <PackagePerformance />
        </div>
        <div className="min-h-[340px]">
          <TeamStatus />
        </div>
      </div>
    </div>
  );
}
