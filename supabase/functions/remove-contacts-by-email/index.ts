import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type RemoveContactsByEmailRequest = {
  targetBaseId: string;
  emails: string[];
  dryRun?: boolean;
  alsoMatchPersonalEmail?: boolean;
};

const isNonEmptyString = (v: unknown): v is string => typeof v === "string" && v.trim().length > 0;

const normalizeEmail = (email: string): string | null => {
  const cleaned = email.trim().toLowerCase();
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(cleaned) ? cleaned : null;
};

const chunk = <T,>(arr: T[], size: number): T[][] => {
  const out: T[][] = [];
  for (let i = 0; i < arr.length; i += size) out.push(arr.slice(i, i + size));
  return out;
};

Deno.serve(async (req: Request): Promise<Response> => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const body = (await req.json()) as Partial<RemoveContactsByEmailRequest>;
    if (!isNonEmptyString(body.targetBaseId)) {
      return new Response(JSON.stringify({ success: false, error: "targetBaseId é obrigatório" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const incomingEmails = Array.isArray(body.emails) ? body.emails : [];
    const alsoMatchPersonalEmail = body.alsoMatchPersonalEmail !== false;
    const dryRun = body.dryRun !== false;

    const normalized = incomingEmails
      .filter(isNonEmptyString)
      .map((e) => normalizeEmail(e))
      .filter((e): e is string => Boolean(e));

    const uniqueEmails = [...new Set(normalized)];
    const emailSet = new Set(uniqueEmails);

    if (uniqueEmails.length === 0) {
      return new Response(
        JSON.stringify({
          success: true,
          dryRun,
          emailsReceived: incomingEmails.length,
          validEmails: 0,
          uniqueEmails: 0,
          matchedContacts: 0,
          deletedContacts: 0,
          notFoundEmails: 0,
          sampleNotFoundEmails: [],
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(
      `remove-contacts-by-email: base=${body.targetBaseId} emailsReceived=${incomingEmails.length} uniqueValid=${uniqueEmails.length} dryRun=${dryRun}`
    );

    const EMAIL_BATCH_SIZE = 200;
    const ID_BATCH_SIZE = 50;

    const contactIdSet = new Set<string>();
    const matchedEmailSet = new Set<string>();

    for (const batch of chunk(uniqueEmails, EMAIL_BATCH_SIZE)) {
      const emailList = batch.map((e) => `"${e}"`).join(",");
      const orClause = alsoMatchPersonalEmail
        ? `email.in.(${emailList}),personal_email.in.(${emailList})`
        : `email.in.(${emailList})`;

      const { data: contacts, error } = await supabase
        .from("contacts")
        .select("id,email,personal_email")
        .eq("base_id", body.targetBaseId)
        .or(orClause);

      if (error) {
        console.error("remove-contacts-by-email: query error", error);
        throw new Error(error.message);
      }

      for (const c of contacts || []) {
        contactIdSet.add(c.id);

        if (c.email && emailSet.has(String(c.email).toLowerCase())) matchedEmailSet.add(String(c.email).toLowerCase());
        if (
          alsoMatchPersonalEmail &&
          c.personal_email &&
          emailSet.has(String(c.personal_email).toLowerCase())
        ) {
          matchedEmailSet.add(String(c.personal_email).toLowerCase());
        }
      }
    }

    const matchedContactIds = [...contactIdSet];
    const notFound = uniqueEmails.filter((e) => !matchedEmailSet.has(e));

    if (dryRun) {
      return new Response(
        JSON.stringify({
          success: true,
          dryRun: true,
          emailsReceived: incomingEmails.length,
          validEmails: normalized.length,
          uniqueEmails: uniqueEmails.length,
          matchedContacts: matchedContactIds.length,
          deletedContacts: 0,
          notFoundEmails: notFound.length,
          sampleNotFoundEmails: notFound.slice(0, 25),
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    let deletedContacts = 0;

    for (const idBatch of chunk(matchedContactIds, ID_BATCH_SIZE)) {
      // Clean junction table first
      const { error: tagsError } = await supabase.from("contact_tags").delete().in("contact_id", idBatch);
      if (tagsError) {
        console.error("remove-contacts-by-email: contact_tags delete error", tagsError);
        throw new Error(tagsError.message);
      }

      const { error: contactsError } = await supabase
        .from("contacts")
        .delete()
        .eq("base_id", body.targetBaseId)
        .in("id", idBatch);

      if (contactsError) {
        console.error("remove-contacts-by-email: contacts delete error", contactsError);
        throw new Error(contactsError.message);
      }

      deletedContacts += idBatch.length;
    }

    console.log(
      `remove-contacts-by-email: done base=${body.targetBaseId} matched=${matchedContactIds.length} deleted=${deletedContacts} notFound=${notFound.length}`
    );

    return new Response(
      JSON.stringify({
        success: true,
        dryRun: false,
        emailsReceived: incomingEmails.length,
        validEmails: normalized.length,
        uniqueEmails: uniqueEmails.length,
        matchedContacts: matchedContactIds.length,
        deletedContacts,
        notFoundEmails: notFound.length,
        sampleNotFoundEmails: notFound.slice(0, 25),
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error("remove-contacts-by-email error:", errorMessage);
    return new Response(JSON.stringify({ success: false, error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
