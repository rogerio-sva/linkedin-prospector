import { useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { 
  Mail, CheckCircle, XCircle, Eye, MousePointerClick, 
  AlertTriangle, TrendingUp, Clock, Send, Users
} from "lucide-react";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { 
  ChartContainer, 
  ChartTooltip, 
  ChartTooltipContent 
} from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, ResponsiveContainer, Cell, PieChart, Pie } from "recharts";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";

interface CampaignSend {
  id: string;
  recipient_email: string;
  recipient_name: string | null;
  subject: string;
  status: string;
  sent_at: string | null;
  delivered_at: string | null;
  opened_at: string | null;
  opened_count: number | null;
  clicked_at: string | null;
  clicked_count: number | null;
  bounced_at: string | null;
  bounce_type: string | null;
  bounce_message: string | null;
  complained_at: string | null;
  error_message: string | null;
}

interface Campaign {
  id: string;
  name: string;
  status: string;
  total_recipients: number | null;
  created_at: string;
  sent_at: string | null;
  email_templates?: { name: string } | null;
  bases?: { name: string } | null;
}

interface CampaignMetricsPanelProps {
  campaign: Campaign;
  sends: CampaignSend[];
  isLoading: boolean;
}

export const CampaignMetricsPanel = ({ campaign, sends, isLoading }: CampaignMetricsPanelProps) => {
  const [statusFilter, setStatusFilter] = useState<string>("all");

  // Calculate metrics
  const totalSent = sends.length;
  const delivered = sends.filter(s => s.delivered_at || s.status === "delivered").length;
  const opened = sends.filter(s => s.opened_at).length;
  const clicked = sends.filter(s => s.clicked_at).length;
  const bounced = sends.filter(s => s.bounced_at).length;
  const complained = sends.filter(s => s.complained_at).length;
  const failed = sends.filter(s => s.status === "failed").length;
  const pending = sends.filter(s => s.status === "pending").length;

  const deliveryRate = totalSent > 0 ? ((delivered / totalSent) * 100).toFixed(1) : "0";
  const openRate = delivered > 0 ? ((opened / delivered) * 100).toFixed(1) : "0";
  const clickRate = opened > 0 ? ((clicked / opened) * 100).toFixed(1) : "0";
  const bounceRate = totalSent > 0 ? ((bounced / totalSent) * 100).toFixed(1) : "0";

  // Chart data
  const funnelData = [
    { name: "Enviados", value: totalSent, color: "hsl(var(--primary))" },
    { name: "Entregues", value: delivered, color: "hsl(142, 76%, 36%)" },
    { name: "Abertos", value: opened, color: "hsl(280, 87%, 65%)" },
    { name: "Clicados", value: clicked, color: "hsl(217, 91%, 60%)" },
  ];

  const statusData = [
    { name: "Entregues", value: delivered, color: "hsl(142, 76%, 36%)" },
    { name: "Bounced", value: bounced, color: "hsl(0, 84%, 60%)" },
    { name: "Spam", value: complained, color: "hsl(38, 92%, 50%)" },
    { name: "Falhos", value: failed, color: "hsl(0, 72%, 51%)" },
  ].filter(d => d.value > 0);

  const chartConfig = {
    enviados: { label: "Enviados", color: "hsl(var(--primary))" },
    entregues: { label: "Entregues", color: "hsl(142, 76%, 36%)" },
    abertos: { label: "Abertos", color: "hsl(280, 87%, 65%)" },
    clicados: { label: "Clicados", color: "hsl(217, 91%, 60%)" },
  };

  // Filter sends
  const filteredSends = sends.filter(send => {
    if (statusFilter === "all") return true;
    if (statusFilter === "delivered") return send.delivered_at && !send.bounced_at;
    if (statusFilter === "opened") return send.opened_at;
    if (statusFilter === "clicked") return send.clicked_at;
    if (statusFilter === "bounced") return send.bounced_at;
    if (statusFilter === "complained") return send.complained_at;
    if (statusFilter === "failed") return send.status === "failed";
    return true;
  });

  const getStatusBadge = (send: CampaignSend) => {
    if (send.complained_at) {
      return <Badge variant="destructive" className="text-xs"><AlertTriangle className="h-3 w-3 mr-1" />Spam</Badge>;
    }
    if (send.bounced_at) {
      return <Badge variant="destructive" className="text-xs"><XCircle className="h-3 w-3 mr-1" />Bounce</Badge>;
    }
    if (send.status === "failed") {
      return <Badge variant="destructive" className="text-xs"><XCircle className="h-3 w-3 mr-1" />Falhou</Badge>;
    }
    if (send.delivered_at || send.status === "delivered") {
      return <Badge className="bg-green-500/10 text-green-600 border-green-500/20 text-xs"><CheckCircle className="h-3 w-3 mr-1" />Entregue</Badge>;
    }
    if (send.status === "sent") {
      return <Badge className="bg-blue-500/10 text-blue-600 border-blue-500/20 text-xs"><Send className="h-3 w-3 mr-1" />Enviado</Badge>;
    }
    return <Badge variant="secondary" className="text-xs"><Clock className="h-3 w-3 mr-1" />Pendente</Badge>;
  };

  if (isLoading) {
    return (
      <Card className="p-6 shadow-card">
        <div className="flex items-center justify-center h-64">
          <p className="text-muted-foreground">Carregando métricas...</p>
        </div>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {/* Campaign Header */}
      <Card className="p-4 shadow-card">
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-xl font-semibold text-foreground">{campaign.name}</h2>
            <div className="flex items-center gap-3 mt-1 text-sm text-muted-foreground">
              <span>Template: {campaign.email_templates?.name || "N/A"}</span>
              <span>•</span>
              <span>Base: {campaign.bases?.name || "N/A"}</span>
              <span>•</span>
              <span>{format(new Date(campaign.created_at), "dd/MM/yyyy HH:mm", { locale: ptBR })}</span>
            </div>
          </div>
          <Badge variant={campaign.status === "sent" || campaign.status === "completed" ? "default" : "secondary"}>
            {campaign.status === "sent" || campaign.status === "completed" ? "Enviada" : campaign.status}
          </Badge>
        </div>
      </Card>

      {/* Metrics Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-8 gap-3">
        <Card className="p-3 shadow-card">
          <div className="flex items-center gap-2">
            <Users className="h-4 w-4 text-muted-foreground" />
            <div>
              <p className="text-xs text-muted-foreground">Total</p>
              <p className="text-lg font-semibold">{totalSent}</p>
            </div>
          </div>
        </Card>
        <Card className="p-3 shadow-card">
          <div className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-green-600" />
            <div>
              <p className="text-xs text-muted-foreground">Entregues</p>
              <p className="text-lg font-semibold">{delivered}</p>
            </div>
          </div>
        </Card>
        <Card className="p-3 shadow-card">
          <div className="flex items-center gap-2">
            <Eye className="h-4 w-4 text-purple-600" />
            <div>
              <p className="text-xs text-muted-foreground">Abertos</p>
              <p className="text-lg font-semibold">{opened}</p>
            </div>
          </div>
        </Card>
        <Card className="p-3 shadow-card">
          <div className="flex items-center gap-2">
            <MousePointerClick className="h-4 w-4 text-blue-600" />
            <div>
              <p className="text-xs text-muted-foreground">Cliques</p>
              <p className="text-lg font-semibold">{clicked}</p>
            </div>
          </div>
        </Card>
        <Card className="p-3 shadow-card">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-emerald-600" />
            <div>
              <p className="text-xs text-muted-foreground">Taxa Abertura</p>
              <p className="text-lg font-semibold">{openRate}%</p>
            </div>
          </div>
        </Card>
        <Card className="p-3 shadow-card">
          <div className="flex items-center gap-2">
            <TrendingUp className="h-4 w-4 text-cyan-600" />
            <div>
              <p className="text-xs text-muted-foreground">Taxa Clique</p>
              <p className="text-lg font-semibold">{clickRate}%</p>
            </div>
          </div>
        </Card>
        <Card className="p-3 shadow-card">
          <div className="flex items-center gap-2">
            <XCircle className="h-4 w-4 text-red-600" />
            <div>
              <p className="text-xs text-muted-foreground">Bounced</p>
              <p className="text-lg font-semibold">{bounced}</p>
            </div>
          </div>
        </Card>
        <Card className="p-3 shadow-card">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-amber-600" />
            <div>
              <p className="text-xs text-muted-foreground">Spam</p>
              <p className="text-lg font-semibold">{complained}</p>
            </div>
          </div>
        </Card>
      </div>

      {/* Charts and Table */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Funnel Chart */}
        <Card className="p-4 shadow-card">
          <h3 className="text-sm font-medium text-foreground mb-3">Funil de Engajamento</h3>
          <ChartContainer config={chartConfig} className="h-[200px]">
            <BarChart data={funnelData} layout="vertical">
              <XAxis type="number" hide />
              <YAxis 
                type="category" 
                dataKey="name" 
                axisLine={false} 
                tickLine={false}
                width={80}
                tick={{ fontSize: 12 }}
              />
              <ChartTooltip content={<ChartTooltipContent />} />
              <Bar dataKey="value" radius={[0, 4, 4, 0]}>
                {funnelData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ChartContainer>
        </Card>

        {/* Status Distribution */}
        <Card className="p-4 shadow-card">
          <h3 className="text-sm font-medium text-foreground mb-3">Distribuição de Status</h3>
          {statusData.length > 0 ? (
            <ChartContainer config={chartConfig} className="h-[200px]">
              <PieChart>
                <Pie
                  data={statusData}
                  cx="50%"
                  cy="50%"
                  innerRadius={50}
                  outerRadius={80}
                  paddingAngle={2}
                  dataKey="value"
                >
                  {statusData.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <ChartTooltip content={<ChartTooltipContent />} />
              </PieChart>
            </ChartContainer>
          ) : (
            <div className="flex items-center justify-center h-[200px] text-muted-foreground text-sm">
              Sem dados suficientes
            </div>
          )}
          <div className="flex flex-wrap gap-2 mt-2 justify-center">
            {statusData.map((item, i) => (
              <div key={i} className="flex items-center gap-1 text-xs">
                <span className="w-2 h-2 rounded-full" style={{ backgroundColor: item.color }}></span>
                {item.name}: {item.value}
              </div>
            ))}
          </div>
        </Card>

        {/* Rates */}
        <Card className="p-4 shadow-card">
          <h3 className="text-sm font-medium text-foreground mb-3">Taxas de Performance</h3>
          <div className="space-y-4">
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-muted-foreground">Entrega</span>
                <span className="font-medium">{deliveryRate}%</span>
              </div>
              <div className="w-full bg-muted rounded-full h-2">
                <div 
                  className="bg-green-500 h-2 rounded-full transition-all" 
                  style={{ width: `${deliveryRate}%` }}
                ></div>
              </div>
            </div>
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-muted-foreground">Abertura</span>
                <span className="font-medium">{openRate}%</span>
              </div>
              <div className="w-full bg-muted rounded-full h-2">
                <div 
                  className="bg-purple-500 h-2 rounded-full transition-all" 
                  style={{ width: `${openRate}%` }}
                ></div>
              </div>
            </div>
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-muted-foreground">Clique</span>
                <span className="font-medium">{clickRate}%</span>
              </div>
              <div className="w-full bg-muted rounded-full h-2">
                <div 
                  className="bg-blue-500 h-2 rounded-full transition-all" 
                  style={{ width: `${clickRate}%` }}
                ></div>
              </div>
            </div>
            <div>
              <div className="flex justify-between text-sm mb-1">
                <span className="text-muted-foreground">Bounce</span>
                <span className="font-medium">{bounceRate}%</span>
              </div>
              <div className="w-full bg-muted rounded-full h-2">
                <div 
                  className="bg-red-500 h-2 rounded-full transition-all" 
                  style={{ width: `${bounceRate}%` }}
                ></div>
              </div>
            </div>
          </div>
        </Card>
      </div>

      {/* Recipients Table */}
      <Card className="p-4 shadow-card">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-medium text-foreground">Destinatários ({filteredSends.length})</h3>
          <Tabs value={statusFilter} onValueChange={setStatusFilter}>
            <TabsList className="h-8">
              <TabsTrigger value="all" className="text-xs px-2 h-7">Todos</TabsTrigger>
              <TabsTrigger value="delivered" className="text-xs px-2 h-7">Entregues</TabsTrigger>
              <TabsTrigger value="opened" className="text-xs px-2 h-7">Abertos</TabsTrigger>
              <TabsTrigger value="clicked" className="text-xs px-2 h-7">Clicados</TabsTrigger>
              <TabsTrigger value="bounced" className="text-xs px-2 h-7">Bounced</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        <ScrollArea className="h-[300px]">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[200px]">Nome</TableHead>
                <TableHead className="w-[250px]">Email</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Entregue</TableHead>
                <TableHead>Aberto</TableHead>
                <TableHead>Clicou</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredSends.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground py-8">
                    Nenhum destinatário encontrado
                  </TableCell>
                </TableRow>
              ) : (
                filteredSends.map((send) => (
                  <TableRow key={send.id}>
                    <TableCell className="font-medium truncate max-w-[200px]">
                      {send.recipient_name || "-"}
                    </TableCell>
                    <TableCell className="text-muted-foreground truncate max-w-[250px]">
                      {send.recipient_email}
                    </TableCell>
                    <TableCell>{getStatusBadge(send)}</TableCell>
                    <TableCell className="text-xs text-muted-foreground">
                      {send.delivered_at 
                        ? format(new Date(send.delivered_at), "dd/MM HH:mm", { locale: ptBR })
                        : "-"}
                    </TableCell>
                    <TableCell>
                      {send.opened_at ? (
                        <div className="flex items-center gap-1 text-purple-600">
                          <Eye className="h-3 w-3" />
                          <span className="text-xs">{send.opened_count || 1}x</span>
                        </div>
                      ) : "-"}
                    </TableCell>
                    <TableCell>
                      {send.clicked_at ? (
                        <div className="flex items-center gap-1 text-blue-600">
                          <MousePointerClick className="h-3 w-3" />
                          <span className="text-xs">{send.clicked_count || 1}x</span>
                        </div>
                      ) : "-"}
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </ScrollArea>
      </Card>
    </div>
  );
};
