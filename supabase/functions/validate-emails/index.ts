import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface EmailableResponse {
  email: string;
  state: string; // 'deliverable', 'undeliverable', 'risky', 'unknown'
  reason: string;
  score: number;
  free: boolean;
  disposable: boolean;
  accept_all: boolean;
  role: boolean;
}

interface ValidationRequest {
  emails: string[];
  baseId?: string;
}

interface ValidationResult {
  email: string;
  status: string;
  score: number;
  reason: string;
  state: string;
  free: boolean;
  disposable: boolean;
  accept_all: boolean;
  role: boolean;
}

const handler = async (req: Request): Promise<Response> => {
  // Handle CORS preflight requests
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const EMAILABLE_API_KEY = Deno.env.get("EMAILABLE_API_KEY");
    if (!EMAILABLE_API_KEY) {
      throw new Error("EMAILABLE_API_KEY não configurada");
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const { emails, baseId }: ValidationRequest = await req.json();

    if (!emails || !Array.isArray(emails) || emails.length === 0) {
      return new Response(
        JSON.stringify({ error: "Lista de emails é obrigatória" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`Iniciando validação de ${emails.length} emails...`);

    // Check which emails are already validated (within last 30 days)
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const { data: existingValidations } = await supabase
      .from("email_validations")
      .select("email, status, score, reason, state, free, disposable, accept_all, role, validated_at")
      .in("email", emails.map(e => e.toLowerCase()))
      .gte("validated_at", thirtyDaysAgo.toISOString());

    const alreadyValidated = new Map<string, ValidationResult>();
    if (existingValidations) {
      for (const v of existingValidations) {
        alreadyValidated.set(v.email.toLowerCase(), {
          email: v.email,
          status: v.status,
          score: v.score || 0,
          reason: v.reason || "",
          state: v.state || v.status,
          free: v.free || false,
          disposable: v.disposable || false,
          accept_all: v.accept_all || false,
          role: v.role || false,
        });
      }
    }

    // Filter out emails that don't need validation
    const emailsToValidate = emails
      .map(e => e.toLowerCase().trim())
      .filter(e => e && !alreadyValidated.has(e));

    console.log(`${alreadyValidated.size} emails já validados, ${emailsToValidate.length} novos para validar`);

    const results: ValidationResult[] = [];

    // Add already validated emails to results
    for (const [email, validation] of alreadyValidated) {
      results.push(validation);
    }

    // Validate new emails in batches of 50 (Emailable limit per request for single API)
    const BATCH_SIZE = 50;
    let validated = 0;
    let errors = 0;

    for (let i = 0; i < emailsToValidate.length; i += BATCH_SIZE) {
      const batch = emailsToValidate.slice(i, i + BATCH_SIZE);
      
      // Validate each email individually (Emailable single verification endpoint)
      for (const email of batch) {
        try {
          const response = await fetch(
            `https://api.emailable.com/v1/verify?email=${encodeURIComponent(email)}&api_key=${EMAILABLE_API_KEY}`
          );

          if (!response.ok) {
            const errorText = await response.text();
            console.error(`Erro ao validar ${email}:`, errorText);
            errors++;
            
            // Mark as unknown on API error
            results.push({
              email,
              status: "unknown",
              score: 0,
              reason: "api_error",
              state: "unknown",
              free: false,
              disposable: false,
              accept_all: false,
              role: false,
            });
            continue;
          }

          const data: EmailableResponse = await response.json();
          
          // Map Emailable state to our status
          let status = data.state;
          if (data.state === "deliverable") {
            status = "deliverable";
          } else if (data.state === "undeliverable") {
            status = "undeliverable";
          } else if (data.state === "risky") {
            status = "risky";
          } else {
            status = "unknown";
          }

          const result: ValidationResult = {
            email: data.email || email,
            status,
            score: data.score || 0,
            reason: data.reason || "",
            state: data.state || "unknown",
            free: data.free || false,
            disposable: data.disposable || false,
            accept_all: data.accept_all || false,
            role: data.role || false,
          };

          results.push(result);
          validated++;

          // Save to database
          await supabase
            .from("email_validations")
            .upsert({
              email: result.email.toLowerCase(),
              status: result.status,
              score: result.score,
              reason: result.reason,
              state: result.state,
              free: result.free,
              disposable: result.disposable,
              accept_all: result.accept_all,
              role: result.role,
              validated_at: new Date().toISOString(),
            }, {
              onConflict: "email",
            });

          // Small delay to respect rate limits (30k/minute = 500/second)
          await new Promise(resolve => setTimeout(resolve, 10));
          
        } catch (error) {
          console.error(`Erro ao validar ${email}:`, error);
          errors++;
          
          results.push({
            email,
            status: "unknown",
            score: 0,
            reason: "validation_error",
            state: "unknown",
            free: false,
            disposable: false,
            accept_all: false,
            role: false,
          });
        }
      }

      console.log(`Progresso: ${Math.min(i + BATCH_SIZE, emailsToValidate.length)}/${emailsToValidate.length} emails processados`);
    }

    // Calculate summary
    const summary = {
      total: emails.length,
      validated: validated,
      cached: alreadyValidated.size,
      errors: errors,
      deliverable: results.filter(r => r.status === "deliverable").length,
      undeliverable: results.filter(r => r.status === "undeliverable").length,
      risky: results.filter(r => r.status === "risky").length,
      unknown: results.filter(r => r.status === "unknown").length,
    };

    console.log("Validação concluída:", summary);

    return new Response(
      JSON.stringify({
        success: true,
        summary,
        results,
      }),
      {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );

  } catch (error: any) {
    console.error("Erro na validação de emails:", error);
    return new Response(
      JSON.stringify({ error: error.message }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      }
    );
  }
};

serve(handler);
