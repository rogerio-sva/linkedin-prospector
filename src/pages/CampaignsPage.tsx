import { useState } from "react";
import { Send, Mail, Clock, CheckCircle, XCircle, Eye, MousePointerClick, AlertTriangle, TrendingUp } from "lucide-react";
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

const CampaignsPage = () => {
  const { bases } = useBases();
  const { templates } = useEmailTemplates();
  const [sendDialogOpen, setSendDialogOpen] = useState(false);

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

  // Fetch recent sends with tracking data
  const { data: recentSends = [], isLoading: isLoadingSends } = useQuery({
    queryKey: ["recent-sends"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("email_sends")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);

      if (error) throw error;
      return data;
    },
  });

  const getStatusBadge = (send: any) => {
    if (send.complained_at) {
      return <Badge variant="destructive"><AlertTriangle className="h-3 w-3 mr-1" />Spam</Badge>;
    }
    if (send.bounced_at) {
      return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Bounce</Badge>;
    }
    if (send.status === "failed") {
      return <Badge variant="destructive"><XCircle className="h-3 w-3 mr-1" />Falhou</Badge>;
    }
    if (send.status === "delivered" || send.delivered_at) {
      return <Badge className="bg-green-500/10 text-green-600 border-green-500/20"><CheckCircle className="h-3 w-3 mr-1" />Entregue</Badge>;
    }
    if (send.status === "sent") {
      return <Badge className="bg-blue-500/10 text-blue-600 border-blue-500/20"><Send className="h-3 w-3 mr-1" />Enviado</Badge>;
    }
    if (send.status === "pending") {
      return <Badge variant="secondary"><Clock className="h-3 w-3 mr-1" />Pendente</Badge>;
    }
    return <Badge variant="outline">{send.status}</Badge>;
  };

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

  // Calculate metrics
  const sentCount = recentSends.filter(s => s.status === "sent" || s.status === "delivered" || s.delivered_at).length;
  const deliveredCount = recentSends.filter(s => s.delivered_at || s.status === "delivered").length;
  const openedCount = recentSends.filter(s => s.opened_at).length;
  const clickedCount = recentSends.filter(s => s.clicked_at).length;
  const bouncedCount = recentSends.filter(s => s.bounced_at).length;
  const failedCount = recentSends.filter(s => s.status === "failed" || s.bounced_at || s.complained_at).length;

  const openRate = deliveredCount > 0 ? ((openedCount / deliveredCount) * 100).toFixed(1) : "0";
  const clickRate = openedCount > 0 ? ((clickedCount / openedCount) * 100).toFixed(1) : "0";

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

        {/* Stats Cards - Row 1: Delivery Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
          <Card className="p-4 shadow-card">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-primary/10">
                <Mail className="h-5 w-5 text-primary" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Enviados</p>
                <p className="text-2xl font-semibold text-foreground">{sentCount}</p>
              </div>
            </div>
          </Card>
          <Card className="p-4 shadow-card">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-green-500/10">
                <CheckCircle className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Entregues</p>
                <p className="text-2xl font-semibold text-foreground">{deliveredCount}</p>
              </div>
            </div>
          </Card>
          <Card className="p-4 shadow-card">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-red-500/10">
                <XCircle className="h-5 w-5 text-red-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Bounces</p>
                <p className="text-2xl font-semibold text-foreground">{bouncedCount}</p>
              </div>
            </div>
          </Card>
          <Card className="p-4 shadow-card">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-accent/10">
                <Send className="h-5 w-5 text-accent" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Campanhas</p>
                <p className="text-2xl font-semibold text-foreground">{campaigns.length}</p>
              </div>
            </div>
          </Card>
        </div>

        {/* Stats Cards - Row 2: Engagement Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
          <Card className="p-4 shadow-card">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-500/10">
                <Eye className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Aberturas</p>
                <p className="text-2xl font-semibold text-foreground">{openedCount}</p>
              </div>
            </div>
          </Card>
          <Card className="p-4 shadow-card">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-500/10">
                <MousePointerClick className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Cliques</p>
                <p className="text-2xl font-semibold text-foreground">{clickedCount}</p>
              </div>
            </div>
          </Card>
          <Card className="p-4 shadow-card">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-emerald-500/10">
                <TrendingUp className="h-5 w-5 text-emerald-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Taxa Abertura</p>
                <p className="text-2xl font-semibold text-foreground">{openRate}%</p>
              </div>
            </div>
          </Card>
          <Card className="p-4 shadow-card">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-cyan-500/10">
                <TrendingUp className="h-5 w-5 text-cyan-600" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground">Taxa Clique</p>
                <p className="text-2xl font-semibold text-foreground">{clickRate}%</p>
              </div>
            </div>
          </Card>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Campaigns List */}
          <Card className="p-4 shadow-card">
            <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-primary"></span>
              Campanhas Recentes
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
              <ScrollArea className="h-[400px]">
                <div className="space-y-3">
                  {campaigns.map((campaign: any) => (
                    <div key={campaign.id} className="p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors">
                      <div className="flex items-start justify-between">
                        <div className="flex-1 min-w-0">
                          <p className="font-medium text-foreground truncate">{campaign.name}</p>
                          <p className="text-xs text-muted-foreground mt-0.5">
                            Template: {campaign.email_templates?.name || "N/A"}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            Base: {campaign.bases?.name || "N/A"}
                          </p>
                        </div>
                        {getCampaignStatusBadge(campaign.status)}
                      </div>
                      <div className="flex items-center gap-4 mt-2 text-xs text-muted-foreground">
                        <span>{campaign.total_recipients || 0} destinatários</span>
                        <span>{format(new Date(campaign.created_at), "dd/MM/yy HH:mm", { locale: ptBR })}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </Card>

          {/* Recent Sends */}
          <Card className="p-4 shadow-card">
            <h2 className="text-lg font-semibold text-foreground mb-4 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-accent"></span>
              Envios Recentes
            </h2>
            
            {isLoadingSends ? (
              <p className="text-sm text-muted-foreground text-center py-8">Carregando...</p>
            ) : recentSends.length === 0 ? (
              <div className="text-center py-8">
                <Mail className="h-10 w-10 text-muted-foreground/50 mx-auto mb-3" />
                <p className="text-sm text-muted-foreground">Nenhum email enviado ainda</p>
              </div>
            ) : (
              <ScrollArea className="h-[400px]">
                <div className="space-y-2">
                  {recentSends.map((send: any) => (
                    <div key={send.id} className="p-3 rounded-lg border border-border hover:bg-muted/50 transition-colors">
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-foreground truncate">
                            {send.recipient_name || send.recipient_email}
                          </p>
                          <p className="text-xs text-muted-foreground truncate">
                            {send.subject}
                          </p>
                        </div>
                        {getStatusBadge(send)}
                      </div>
                      
                      {/* Engagement indicators */}
                      <div className="flex items-center gap-3 mt-2">
                        {send.opened_at && (
                          <Tooltip>
                            <TooltipTrigger>
                              <div className="flex items-center gap-1 text-purple-600">
                                <Eye className="h-3 w-3" />
                                <span className="text-xs">{send.opened_count || 1}x</span>
                              </div>
                            </TooltipTrigger>
                            <TooltipContent>
                              Aberto {send.opened_count || 1}x - Primeira vez: {format(new Date(send.opened_at), "dd/MM HH:mm", { locale: ptBR })}
                            </TooltipContent>
                          </Tooltip>
                        )}
                        {send.clicked_at && (
                          <Tooltip>
                            <TooltipTrigger>
                              <div className="flex items-center gap-1 text-blue-600">
                                <MousePointerClick className="h-3 w-3" />
                                <span className="text-xs">{send.clicked_count || 1}x</span>
                              </div>
                            </TooltipTrigger>
                            <TooltipContent>
                              Clicou {send.clicked_count || 1}x em links
                            </TooltipContent>
                          </Tooltip>
                        )}
                        {send.bounced_at && (
                          <Tooltip>
                            <TooltipTrigger>
                              <div className="flex items-center gap-1 text-red-600">
                                <XCircle className="h-3 w-3" />
                                <span className="text-xs">{send.bounce_type}</span>
                              </div>
                            </TooltipTrigger>
                            <TooltipContent>
                              {send.bounce_message || "Email rejeitado"}
                            </TooltipContent>
                          </Tooltip>
                        )}
                      </div>
                      
                      <div className="flex items-center justify-between mt-2">
                        <p className="text-xs text-muted-foreground truncate">{send.recipient_email}</p>
                        <p className="text-xs text-muted-foreground">
                          {format(new Date(send.created_at), "dd/MM HH:mm", { locale: ptBR })}
                        </p>
                      </div>
                      {send.error_message && (
                        <p className="text-xs text-destructive mt-1 truncate">{send.error_message}</p>
                      )}
                    </div>
                  ))}
                </div>
              </ScrollArea>
            )}
          </Card>
        </div>
      </TooltipProvider>
    </div>
  );
};

export default CampaignsPage;
