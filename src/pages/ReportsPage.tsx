import { useGlobalStats, useBaseReports } from "@/hooks/useReports";
import { MetricCards } from "@/components/reports/MetricCards";
import { StageDistributionChart } from "@/components/reports/StageDistributionChart";
import { BaseReportCard } from "@/components/reports/BaseReportCard";
import { Skeleton } from "@/components/ui/skeleton";

export default function ReportsPage() {
  const { data: globalStats, isLoading: statsLoading } = useGlobalStats();
  const { data: baseReports = [], isLoading: reportsLoading } = useBaseReports();

  if (statsLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid gap-4 md:grid-cols-3 lg:grid-cols-6">
          {[1, 2, 3, 4, 5, 6].map((i) => <Skeleton key={i} className="h-24" />)}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Relatórios</h1>
        <p className="text-muted-foreground">Visão geral do desempenho de prospecção</p>
      </div>

      {globalStats && (
        <MetricCards
          totalContacts={globalStats.totalContacts}
          withEmail={globalStats.withEmail}
          withLinkedIn={globalStats.withLinkedIn}
          linkedInContacted={globalStats.linkedInContacted}
          emailsSent={globalStats.emailsSent}
          totalActivities={globalStats.totalActivities}
        />
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        {globalStats && (
          <StageDistributionChart data={globalStats.stageDistribution} />
        )}
      </div>

      <div>
        <h2 className="text-lg font-semibold mb-4">Relatórios por Base</h2>
        {reportsLoading ? (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-64" />)}
          </div>
        ) : baseReports.length === 0 ? (
          <p className="text-muted-foreground">Nenhuma base encontrada</p>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {baseReports.map((report) => (
              <BaseReportCard key={report.baseId} report={report} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
