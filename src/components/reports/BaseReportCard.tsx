import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Database, Mail, Linkedin, Send } from "lucide-react";
import { BaseReport } from "@/hooks/useReports";

interface BaseReportCardProps {
  report: BaseReport;
}

export function BaseReportCard({ report }: BaseReportCardProps) {
  const emailPercentage = report.totalContacts > 0 
    ? (report.withEmail / report.totalContacts) * 100 
    : 0;
  
  const linkedInPercentage = report.totalContacts > 0 
    ? (report.withLinkedIn / report.totalContacts) * 100 
    : 0;
  
  const linkedInContactedPercentage = report.withLinkedIn > 0 
    ? (report.linkedInContacted / report.withLinkedIn) * 100 
    : 0;

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base flex items-center gap-2">
          <Database className="h-4 w-4" />
          {report.baseName}
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-2xl font-bold">
          {report.totalContacts.toLocaleString()} contatos
        </div>
        
        <div className="space-y-3">
          <div className="space-y-1">
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-1">
                <Mail className="h-3 w-3" /> Com Email
              </span>
              <span>{report.withEmail.toLocaleString()} ({emailPercentage.toFixed(1)}%)</span>
            </div>
            <Progress value={emailPercentage} className="h-2" />
          </div>
          
          <div className="space-y-1">
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-1">
                <Linkedin className="h-3 w-3" /> Com LinkedIn
              </span>
              <span>{report.withLinkedIn.toLocaleString()} ({linkedInPercentage.toFixed(1)}%)</span>
            </div>
            <Progress value={linkedInPercentage} className="h-2" />
          </div>
          
          <div className="space-y-1">
            <div className="flex items-center justify-between text-sm">
              <span className="flex items-center gap-1">
                <Linkedin className="h-3 w-3 text-green-500" /> LinkedIn Contatado
              </span>
              <span>{report.linkedInContacted.toLocaleString()} ({linkedInContactedPercentage.toFixed(1)}%)</span>
            </div>
            <Progress value={linkedInContactedPercentage} className="h-2 bg-muted [&>div]:bg-green-500" />
          </div>
          
          <div className="flex items-center justify-between text-sm pt-2 border-t">
            <span className="flex items-center gap-1">
              <Send className="h-3 w-3" /> Emails Enviados
            </span>
            <span className="font-medium">{report.emailSent.toLocaleString()}</span>
          </div>
        </div>
        
        {/* Stage mini breakdown */}
        {Object.keys(report.byStage).length > 0 && (
          <div className="pt-2 border-t">
            <p className="text-xs text-muted-foreground mb-2">Por Estágio:</p>
            <div className="flex flex-wrap gap-1">
              {Object.entries(report.byStage).slice(0, 4).map(([stage, count]) => (
                <span 
                  key={stage} 
                  className="text-xs bg-muted px-2 py-0.5 rounded"
                >
                  {stage}: {count}
                </span>
              ))}
              {Object.keys(report.byStage).length > 4 && (
                <span className="text-xs text-muted-foreground">
                  +{Object.keys(report.byStage).length - 4} mais
                </span>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
