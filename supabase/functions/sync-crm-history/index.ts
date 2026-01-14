import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    console.log("Iniciando sincronização do histórico de CRM...");

    // Usar o nome do estágio diretamente (não UUID)
    const emailEnviadoStageName = "Email Enviado";
    console.log(`Usando estágio: ${emailEnviadoStageName}`);

    // Buscar todos os email_sends com paginação (limite de 1000 por query)
    const allEmailSends: Array<{
      id: string;
      contact_id: string;
      campaign_id: string | null;
      status: string;
      sent_at: string | null;
      delivered_at: string | null;
      opened_at: string | null;
      clicked_at: string | null;
      bounced_at: string | null;
      bounce_type: string | null;
      complained_at: string | null;
      subject: string;
      email_campaigns: { name: string } | { name: string }[] | null;
    }> = [];
    
    let page = 0;
    const pageSize = 1000;
    let hasMore = true;

    while (hasMore) {
      console.log(`Buscando página ${page + 1} de email_sends...`);
      
      const { data: emailSends, error: emailSendsError } = await supabase
        .from("email_sends")
        .select(`
          id,
          contact_id,
          campaign_id,
          status,
          sent_at,
          delivered_at,
          opened_at,
          clicked_at,
          bounced_at,
          bounce_type,
          complained_at,
          subject,
          email_campaigns (
            name
          )
        `)
        .order("sent_at", { ascending: true })
        .range(page * pageSize, (page + 1) * pageSize - 1);

      if (emailSendsError) {
        console.error("Erro ao buscar email_sends:", emailSendsError);
        throw emailSendsError;
      }

      if (emailSends && emailSends.length > 0) {
        allEmailSends.push(...emailSends);
        console.log(`Página ${page + 1}: ${emailSends.length} emails (total: ${allEmailSends.length})`);
        hasMore = emailSends.length === pageSize;
      } else {
        hasMore = false;
      }
      
      page++;
    }

    console.log(`Total de emails encontrados: ${allEmailSends.length}`);

    if (allEmailSends.length === 0) {
      return new Response(
        JSON.stringify({ success: true, message: "Nenhum email para sincronizar" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const emailSends = allEmailSends;

    // Agrupar emails por contact_id para processar
    const contactEmailsMap = new Map<string, typeof emailSends>();
    for (const send of emailSends) {
      if (!contactEmailsMap.has(send.contact_id)) {
        contactEmailsMap.set(send.contact_id, []);
      }
      contactEmailsMap.get(send.contact_id)!.push(send);
    }

    console.log(`Contatos únicos com emails: ${contactEmailsMap.size}`);

    let updatedContacts = 0;
    let createdActivities = 0;
    let errors = 0;

    // Processar em lotes de 100 contatos
    const contactIds = Array.from(contactEmailsMap.keys());
    const batchSize = 100;

    for (let i = 0; i < contactIds.length; i += batchSize) {
      const batchContactIds = contactIds.slice(i, i + batchSize);
      console.log(`Processando lote ${Math.floor(i / batchSize) + 1}/${Math.ceil(contactIds.length / batchSize)}`);

      // Buscar contatos atuais
      const { data: contacts, error: contactsError } = await supabase
        .from("contacts")
        .select("id, crm_stage, last_activity_at")
        .in("id", batchContactIds);

      if (contactsError) {
        console.error("Erro ao buscar contatos:", contactsError);
        errors++;
        continue;
      }

      // Preparar atividades para inserir
      const activitiesToInsert: Array<{
        contact_id: string;
        activity_type: string;
        description: string;
        metadata: Record<string, unknown>;
        created_at: string;
      }> = [];

      // Preparar atualizações de contatos
      const contactsToUpdate: Array<{
        id: string;
        crm_stage: string;
        last_activity_at: string;
      }> = [];

      for (const contact of contacts || []) {
        const emailsForContact = contactEmailsMap.get(contact.id) || [];
        
        // Encontrar a data do último email
        let lastEmailDate: string | null = null;
        
        for (const email of emailsForContact) {
          const emailCampaign = email.email_campaigns as { name: string } | { name: string }[] | null;
          const campaignName = Array.isArray(emailCampaign) 
            ? (emailCampaign[0]?.name || "Campanha")
            : (emailCampaign?.name || "Campanha");
          const sentDate = email.sent_at ? new Date(email.sent_at).toLocaleDateString("pt-BR") : "Data desconhecida";
          
          // Determinar tipo de atividade baseado no status
          let activityType = "email_sent";
          let description = `Email enviado via campanha: ${campaignName} (${sentDate})`;
          
          if (email.bounced_at) {
            activityType = "email_bounced";
            description = `Email retornou (${email.bounce_type || "desconhecido"}): ${campaignName}`;
          } else if (email.opened_at) {
            activityType = "email_opened";
            description = `Email aberto: ${campaignName}`;
          } else if (email.delivered_at) {
            activityType = "email_delivered";
            description = `Email entregue: ${campaignName}`;
          }

          activitiesToInsert.push({
            contact_id: contact.id,
            activity_type: activityType,
            description: description,
            metadata: {
              campaign_id: email.campaign_id,
              email_send_id: email.id,
              subject: email.subject,
              status: email.status,
              sent_at: email.sent_at,
              delivered_at: email.delivered_at,
              opened_at: email.opened_at,
              clicked_at: email.clicked_at,
              bounced_at: email.bounced_at,
              bounce_type: email.bounce_type,
            },
            created_at: email.sent_at || new Date().toISOString(),
          });

          // Atualizar última data de email
          if (email.sent_at && (!lastEmailDate || email.sent_at > lastEmailDate)) {
            lastEmailDate = email.sent_at;
          }
        }

        // Atualizar contato se estiver em "Novo Lead" ou não tiver estágio
        if (!contact.crm_stage || contact.crm_stage === "Novo Lead") {
          contactsToUpdate.push({
            id: contact.id,
            crm_stage: emailEnviadoStageName,
            last_activity_at: lastEmailDate || new Date().toISOString(),
          });
        }
      }

      // Inserir atividades em lote
      if (activitiesToInsert.length > 0) {
        const { error: insertError } = await supabase
          .from("contact_activities")
          .insert(activitiesToInsert);

        if (insertError) {
          console.error("Erro ao inserir atividades:", insertError);
          errors++;
        } else {
          createdActivities += activitiesToInsert.length;
        }
      }

      // Atualizar contatos individualmente (upsert não funciona bem aqui)
      for (const contactUpdate of contactsToUpdate) {
        const { error: updateError } = await supabase
          .from("contacts")
          .update({
            crm_stage: contactUpdate.crm_stage,
            last_activity_at: contactUpdate.last_activity_at,
          })
          .eq("id", contactUpdate.id);

        if (updateError) {
          console.error("Erro ao atualizar contato:", updateError);
          errors++;
        } else {
          updatedContacts++;
        }
      }
    }

    const result = {
      success: true,
      message: "Sincronização concluída",
      stats: {
        totalEmails: emailSends.length,
        uniqueContacts: contactEmailsMap.size,
        updatedContacts,
        createdActivities,
        errors,
      },
    };

    console.log("Sincronização concluída:", result);

    return new Response(JSON.stringify(result), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("Erro na sincronização:", error);
    return new Response(
      JSON.stringify({ success: false, error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
