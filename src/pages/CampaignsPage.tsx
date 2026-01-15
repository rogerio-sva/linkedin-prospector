import { useState } from "react";
import { Send, Mail, Clock, CheckCircle, XCircle, Eye, MousePointerClick, AlertTriangle, TrendingUp, ChevronRight } from "lucide-react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { SendCampaignDialog } from "@/components/SendCampaignDialog";
import { useBases } from "@/hooks/useBases";
import { useEmailTemplates } from "@/hooks/useEmailTemplates";
import { Badge } from "@/components/ui/badge";
import { supabase } from "@/integrations/supabase/client";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { CampaignMetricsPanel } from "@/components/CampaignMetricsPanel";
import { GlobalCleanupStatus } from "@/components/GlobalCleanupStatus";
import { cn } from "@/lib/utils";

const CampaignsPage = () => {
  const { bases } = useBases();
  const { templates } = useEmailTemplates();
  const [sendDialogOpen, setSendDialogOpen] = useState(false);
  const [selectedCampaignId, setSelectedCampaignId] = useState<string | null>(null);

  // Fetch campaigns
  const { data: campaigns = [], isLoading: isLoadingCampaigns } = useQuery({
    queryKey: ["campaigns"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("email_campaigns")
        .select(`
          *,
          email_templates(name),
          bases(name)
        `)
        .order("created_at", { ascending: false });

      if (error) throw error;
      return data;
    },
  });

  // Fetch aggregated metrics for selected campaign
  const { data: campaignMetrics, isLoading: isLoadingCampaignMetrics } = useQuery({
    queryKey: ["campaign-metrics", selectedCampaignId],
    queryFn: async () => {
      if (!selectedCampaignId) return null;

      // Get total count
      const { count: totalCount } = await supabase
        .from("email_sends")
        .select("*", { count: "exact", head: true })
        .eq("campaign_id", selectedCampaignId);

      // Get delivered count
      const { count: deliveredCount } = await supabase
        .from("email_sends")
        .select("*", { count: "exact", head: true })
        .eq("campaign_id", selectedCampaignId)
        .not("delivered_at", "is", null);

      // Get opened count
      const { count: openedCount } = await supabase
        .from("email_sends")
        .select("*", { count: "exact", head: true })
        .eq("campaign_id", selectedCampaignId)
        .not("opened_at", "is", null);

      // Get clicked count
      const { count: clickedCount } = await supabase
        .from("email_sends")
        .select("*", { count: "exact", head: true })
        .eq("campaign_id", selectedCampaignId)
        .not("clicked_at", "is", null);

      // Get bounced count
      const { count: bouncedCount } = await supabase
        .from("email_sends")
        .select("*", { count: "exact", head: true })
        .eq("campaign_id", selectedCampaignId)
        .not("bounced_at", "is", null);

      // Get complained count
      const { count: complainedCount } = await supabase
        .from("email_sends")
        .select("*", { count: "exact", head: true })
        .eq("campaign_id", selectedCampaignId)
        .not("complained_at", "is", null);

      // Get failed count
      const { count: failedCount } = await supabase
        .from("email_sends")
        .select("*", { count: "exact", head: true })
        .eq("campaign_id", selectedCampaignId)
        .eq("status", "failed");

      // Get pending count
      const { count: pendingCount } = await supabase
        .from("email_sends")
        .select("*", { count: "exact", head: true })
        .eq("campaign_id", selectedCampaignId)
        .eq("status", "pending");

      return {
        total: totalCount || 0,
        delivered: deliveredCount || 0,
        opened: openedCount || 0,
        clicked: clickedCount || 0,
        bounced: bouncedCount || 0,
        complained: complainedCount || 0,
        failed: failedCount || 0,
        pending: pendingCount || 0,
      };
    },
    enabled: !!selectedCampaignId,
  });

  // Fetch sample sends for selected campaign (limit to 500 for table display)
  const { data: campaignSends = [], isLoading: isLoadingCampaignSends } = useQuery({
    queryKey: ["campaign-sends-sample", selectedCampaignId],
    queryFn: async () => {
      if (!selectedCampaignId) return [];
      const { data, error } = await supabase
        .from("email_sends")
        .select("*")
        .eq("campaign_id", selectedCampaignId)
        .order("created_at", { ascending: false })
        .limit(500);

      if (error) throw error;
      return data;
    },
    enabled: !!selectedCampaignId,
  });

  // Fetch aggregated global metrics (instead of loading all records)
  const { data: globalMetrics } = useQuery({
    queryKey: ["global-send-metrics"],
    queryFn: async () => {
      // Get total count
      const { count: totalCount } = await supabase
        .from("email_sends")
        .select("*", { count: "exact", head: true });

      // Get delivered count
      const { count: deliveredCount } = await supabase
        .from("email_sends")
        .select("*", { count: "exact", head: true })
        .not("delivered_at", "is", null);

      // Get opened count
      const { count: openedCount } = await supabase
        .from("email_sends")
        .select("*", { count: "exact", head: true })
        .not("opened_at", "is", null);

      // Get clicked count
      const { count: clickedCount } = await supabase
        .from("email_sends")
        .select("*", { count: "exact", head: true })
        .not("clicked_at", "is", null);

      // Get bounced count
      const { count: bouncedCount } = await supabase
        .from("email_sends")
        .select("*", { count: "exact", head: true })
        .not("bounced_at", "is", null);

      return {
        sent: totalCount || 0,
        delivered: deliveredCount || 0,
        opened: openedCount || 0,
        clicked: clickedCount || 0,
        bounced: bouncedCount || 0,
      };
    },
  });

  const getCampaignStatusBadge = (status: string) => {
    switch (status) {
      case "sent":
      case "completed":
        return <Badge className="bg-green-500/10 text-green-600 border-green-500/20"><CheckCircle className="h-3 w-3 mr-1" />Enviado</Badge>;
      case "pending":
      case "draft":
        return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" />Rascunho</Badge>;
      case "failed":
        return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Falhou</Badge>;
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  // Use aggregated global metrics
  const sentCount = globalMetrics?.sent || 0;
  const deliveredCount = globalMetrics?.delivered || 0;
  const openedCount = globalMetrics?.opened || 0;
  const clickedCount = globalMetrics?.clicked || 0;
  const bouncedCount = globalMetrics?.bounced || 0;

  const openRate = deliveredCount > 0 ? ((openedCount / deliveredCount) * 100).toFixed(1) : "0";
  const clickRate = openedCount > 0 ? ((clickedCount / openedCount) * 100).toFixed(1) : "0";

  const selectedCampaign = campaigns.find((c: any) => c.id === selectedCampaignId);

  return (
    <div className="p-6">
      <TooltipProvider>
        {/* Send Campaign Dialog */}
        <SendCampaignDialog
          open={sendDialogOpen}
          onOpenChange={setSendDialogOpen}
          templates={templates}
          bases={bases}
          contacts={[]}
          selectedContacts={[]}
          selectedBaseId={null}
        />

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-semibold text-foreground">Campanhas de Email</h1>
            <p className="text-sm text-muted-foreground">Envie emails e acompanhe suas campanhas</p>
          </div>
          <Button onClick={() => setSendDialogOpen(true)} disabled={templates.length === 0 || bases.length === 0}>
            <Send className="h-4 w-4 mr-2" />
            Nova Campanha
          </Button>
        </div>

        {/* Global Stats Cards */}
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-3 mb-6">
          <Card className="p-3 shadow-card">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-primary/10">
                <Mail className="h-4 w-4 text-primary" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Enviados</p>
                <p className="text-xl font-semibold text-foreground">{sentCount}</p>
              </div>
            </div>
          </Card>
          <Card className="p-3 shadow-card">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-green-500/10">
                <CheckCircle className="h-4 w-4 text-green-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Entregues</p>
                <p className="text-xl font-semibold text-foreground">{deliveredCount}</p>
              </div>
            </div>
          </Card>
          <Card className="p-3 shadow-card">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-purple-500/10">
                <Eye className="h-4 w-4 text-purple-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Aberturas</p>
                <p className="text-xl font-semibold text-foreground">{openedCount}</p>
              </div>
            </div>
          </Card>
          <Card className="p-3 shadow-card">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-blue-500/10">
                <MousePointerClick className="h-4 w-4 text-blue-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Cliques</p>
                <p className="text-xl font-semibold text-foreground">{clickedCount}</p>
              </div>
            </div>
          </Card>
          <Card className="p-3 shadow-card">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-red-500/10">
                <XCircle className="h-4 w-4 text-red-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Bounces</p>
                <p className="text-xl font-semibold text-foreground">{bouncedCount}</p>
              </div>
            </div>
          </Card>
          <Card className="p-3 shadow-card">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-emerald-500/10">
                <TrendingUp className="h-4 w-4 text-emerald-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Taxa Abertura</p>
                <p className="text-xl font-semibold text-foreground">{openRate}%</p>
              </div>
            </div>
          </Card>
          <Card className="p-3 shadow-card">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-cyan-500/10">
                <TrendingUp className="h-4 w-4 text-cyan-600" />
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Taxa Clique</p>
                <p className="text-xl font-semibold text-foreground">{clickRate}%</p>
              </div>
            </div>
          </Card>
        </div>

        {/* Global Cleanup Panel */}
        <div className="mb-6">
          <GlobalCleanupStatus />
        </div>

        {/* Main Content */}
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          {/* Campaigns List */}
          <Card className="p-4 shadow-card lg:col-span-1">
            <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-primary"></span>
              Campanhas ({campaigns.length})
            </h2>
            
            {isLoadingCampaigns ? (
              <p className="text-sm text-muted-foreground text-center py-8">Carregando...</p>
            ) : campaigns.length === 0 ? (
              <div className="text-center py-8">
                <Send className="h-10 w-10 text-muted-foreground/50 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">Nenhuma campanha enviada</p>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="mt-3"
                  onClick={() => setSendDialogOpen(true)}
                  disabled={templates.length === 0 || bases.length === 0}
                >
                  Criar Campanha
                </Button>
              </div>
            ) : (
              <ScrollArea className="h-[calc(100vh-320px)]">
                <div className="space-y-2">
                  {campaigns.map((campaign: any) => (
                    <div 
                      key={campaign.id} 
                      className={cn(
                        "p-3 rounded-lg border cursor-pointer transition-all",
                        selectedCampaignId === campaign.id 
                          ? "border-primary bg-primary/5" 
                          : "border-border hover:bg-muted/50"
                      )}
                      onClick={() => setSelectedCampaignId(campaign.id)}
                    >
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-foreground text-sm truncate">{campaign.name}</p>
                          <p className="text-xs text-muted-foreground mt-0.5 truncate">
                            {campaign.email_templates?.name || "N/A"}
                          </p>
                        </div>
                        <ChevronRight className={cn(
                          "h-4 w-4 text-muted-foreground shrink-0 transition-transform",
                          selectedCampaignId === campaign.id && "text-primary"
                        )} />
                      </div>
                      <div className="flex items-center gap-2 mt-2">
                        {getCampaignStatusBadge(campaign.status)}
                        <span className="text-xs text-muted-foreground">
                          {campaign.total_recipients || 0} dest.
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground mt-1">
                        {format(new Date(campaign.created_at), "dd/MM/yy HH:mm", { locale: ptBR })}
                      </p>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </Card>

          {/* Campaign Details */}
          <div className="lg:col-span-3">
            {selectedCampaign ? (
              <CampaignMetricsPanel
                campaign={selectedCampaign}
                sends={campaignSends}
                metrics={campaignMetrics}
                isLoading={isLoadingCampaignMetrics || isLoadingCampaignSends}
              />
            ) : (
              <Card className="p-8 shadow-card flex flex-col items-center justify-center min-h-[400px]">
                <Mail className="h-12 w-12 text-muted-foreground/30 mb-4" />
                <h3 className="text-lg font-medium text-foreground mb-1">Selecione uma campanha</h3>
                <p className="text-sm text-muted-foreground text-center">
                  Clique em uma campanha à esquerda para ver as métricas detalhadas
                </p>
              </Card>
            )}
          </div>
        </div>
      </TooltipProvider>
    </div>
  );
};

export default CampaignsPage;
