// Sumit payment integration: authorize (J5), charge (J4), charge with token, save token, create invoice
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

const SUMIT_BASE = "https://api.sumit.co.il";

interface CardInput {
  number?: string;
  expMonth?: number;
  expYear?: number;
  cvv?: string;
  citizenId?: string;
  token?: string; // saved token (CardMask)
  singleUseToken?: string; // payments.js
}

interface ItemInput {
  name: string;
  description?: string;
  unitPrice: number;
  quantity?: number;
}

interface CustomerInput {
  id?: string; // local customer id (we don't send to Sumit)
  name: string;
  phone?: string;
  email?: string;
  address?: string;
  city?: string;
  citizenId?: string;
}

interface RequestBody {
  action:
    | "authorize"            // J5 - hold credit (AuthoriseOnly=true)
    | "charge"               // J4 - immediate charge
    | "charge_token"         // charge using saved token
    | "save_token"           // save card token for recurring
    | "release_authorization" // release J5 hold
    | "delete_card"          // delete saved card from customer
    | "send_invoice"         // send invoice PDF by email
    | "get_pdf";             // get document PDF
  amount?: number;
  customer?: CustomerInput;
  card?: CardInput;
  items?: ItemInput[];
  description?: string;
  payments?: number;
  sendInvoiceEmail?: boolean;
  bookingId?: string;
  rentalId?: string;
  documentId?: string;
  authNumber?: string;
  email?: string;
}

function getCreds() {
  const CompanyID = Number(Deno.env.get("SUMIT_COMPANY_ID"));
  const APIKey = Deno.env.get("SUMIT_API_KEY");
  if (!CompanyID || !APIKey) throw new Error("Sumit credentials not configured");
  return { CompanyID, APIKey };
}

async function sumitFetch(path: string, body: any) {
  const res = await fetch(`${SUMIT_BASE}${path}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  });
  const text = await res.text();
  let json: any;
  try { json = JSON.parse(text); } catch { json = { raw: text }; }
  // Sumit returns Status: 0 on success even with HTTP 200 on errors
  const sumitStatus = typeof json?.Status === "number" ? json.Status : null;
  const ok = res.ok && (sumitStatus === null || sumitStatus === 0);
  return { ok, status: res.status, data: json };
}

function buildPaymentMethod(card?: CardInput) {
  if (!card) return null;
  if (card.token) {
    return {
      CreditCard_Token: card.token,
      CreditCard_ExpirationMonth: card.expMonth,
      CreditCard_ExpirationYear: card.expYear,
      Type: 1,
    };
  }
  return {
    CreditCard_Number: card.number,
    CreditCard_ExpirationMonth: card.expMonth,
    CreditCard_ExpirationYear: card.expYear,
    CreditCard_CVV: card.cvv,
    CreditCard_CitizenID: card.citizenId,
    Type: 1,
  };
}

function buildCustomer(c?: CustomerInput) {
  if (!c) return null;
  return {
    SearchMode: 0,
    Name: c.name,
    Phone: c.phone || null,
    EmailAddress: c.email || null,
    City: c.city || null,
    Address: c.address || null,
  };
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body: RequestBody = await req.json();
    const creds = getCreds();
    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // --- Get PDF / download URL ---
    if (body.action === "get_pdf") {
      // Try multiple endpoints — Sumit returns the download URL on document details
      let url: string | null = null;
      let raw: any = null;
      const endpoints = [
        "/accounting/documents/get/",
        "/accounting/documents/getdetails/",
        "/accounting/documents/getpdf/",
      ];
      for (const ep of endpoints) {
        const r = await sumitFetch(ep, { DocumentID: body.documentId, Credentials: creds });
        raw = r.data;
        url = r.data?.Data?.DocumentDownloadURL
          || r.data?.Data?.Document?.DownloadURL
          || r.data?.Data?.PDFUrl
          || r.data?.Data?.URL
          || r.data?.PDFUrl
          || null;
        if (url) break;
      }
      if (url && body.documentId) {
        await supabaseAdmin.from("sumit_invoices").update({ pdf_url: url }).eq("document_id", String(body.documentId));
      }
      return new Response(JSON.stringify({ pdfUrl: url, raw }), {
        status: url ? 200 : 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // --- Send invoice by email ---
    if (body.action === "send_invoice") {
      if (!body.documentId) {
        return new Response(JSON.stringify({ error: "Missing documentId" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const r = await sumitFetch("/accounting/documents/send/", {
        DocumentID: body.documentId,
        EmailAddress: body.email || body.customer?.email,
        SendBy: 1,
        Credentials: creds,
      });
      await supabaseAdmin.from("payment_transactions").insert({
        transaction_type: "send_invoice",
        status: r.ok ? "success" : "failed",
        customer_id: body.customer?.id || null,
        customer_name: body.customer?.name || null,
        error_message: r.ok ? null : JSON.stringify(r.data),
        raw_response: r.data,
        created_by: user.id,
      });
      return new Response(JSON.stringify({ success: r.ok, raw: r.data }), {
        status: r.ok ? 200 : 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // --- Release J5 authorization ---
    if (body.action === "release_authorization") {
      // Try to find auth number from booking/rental if not provided
      let authNumber = body.authNumber || null;
      let amount = body.amount || null;
      if (!authNumber && body.bookingId) {
        const { data } = await supabaseAdmin.from("bookings").select("sumit_auth_number, sumit_authorized_amount").eq("id", body.bookingId).maybeSingle();
        authNumber = data?.sumit_auth_number || null;
        amount = amount ?? data?.sumit_authorized_amount ?? null;
      }
      if (!authNumber && body.rentalId) {
        const { data } = await supabaseAdmin.from("rentals").select("sumit_auth_number, sumit_authorized_amount").eq("id", body.rentalId).maybeSingle();
        authNumber = data?.sumit_auth_number || null;
        amount = amount ?? data?.sumit_authorized_amount ?? null;
      }
      if (!authNumber) {
        return new Response(JSON.stringify({ error: "Missing auth number" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const r = await sumitFetch("/billing/payments/cancelauthorization/", {
        AuthorizationNumber: authNumber,
        Amount: amount,
        Credentials: creds,
      });
      if (r.ok) {
        const update: any = { sumit_auth_number: null, sumit_authorized_amount: null, sumit_authorized_at: null };
        if (body.bookingId) await supabaseAdmin.from("bookings").update(update).eq("id", body.bookingId);
        if (body.rentalId) await supabaseAdmin.from("rentals").update(update).eq("id", body.rentalId);
      }
      await supabaseAdmin.from("payment_transactions").insert({
        transaction_type: "release_authorization",
        status: r.ok ? "success" : "failed",
        amount,
        auth_number: authNumber,
        customer_id: body.customer?.id || null,
        customer_name: body.customer?.name || null,
        booking_id: body.bookingId || null,
        rental_id: body.rentalId || null,
        error_message: r.ok ? null : JSON.stringify(r.data),
        raw_response: r.data,
        created_by: user.id,
      });
      return new Response(JSON.stringify({ success: r.ok, raw: r.data }), {
        status: r.ok ? 200 : 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // --- Delete saved card from customer ---
    if (body.action === "delete_card") {
      if (!body.customer?.id) {
        return new Response(JSON.stringify({ error: "Missing customer id" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      await supabaseAdmin.from("customers").update({
        payment_token: null,
        card_last4: null,
        card_expiry: null,
        payment_provider: null,
      }).eq("id", body.customer.id);

      await supabaseAdmin.from("payment_transactions").insert({
        transaction_type: "delete_card",
        status: "success",
        customer_id: body.customer.id,
        customer_name: body.customer?.name || null,
        created_by: user.id,
      });
      return new Response(JSON.stringify({ success: true }), {
        status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // --- Save token only (no charge) ---
    if (body.action === "save_token") {
      const payload = {
        Customer: buildCustomer(body.customer),
        PaymentMethod: buildPaymentMethod(body.card),
        Credentials: creds,
      };
      const r = await sumitFetch("/billing/paymentmethods/setforcustomer/", payload);
      const pm = r.data?.Data?.PaymentMethod || r.data?.Data || {};
      const token = pm?.CreditCard_Token || null;
      const cardMask = pm?.CreditCard_CardMask || null;
      const last4 = pm?.CreditCard_LastDigits || null;

      if (r.ok && token && body.customer?.id) {
        await supabaseAdmin.from("customers").update({
          payment_token: token,
          card_last4: last4,
          card_expiry: body.card?.expMonth && body.card?.expYear ? `${body.card.expMonth}/${body.card.expYear}` : null,
          payment_provider: "sumit",
        }).eq("id", body.customer.id);
      }
      await supabaseAdmin.from("payment_transactions").insert({
        transaction_type: "save_token",
        status: r.ok ? "success" : "failed",
        customer_id: body.customer?.id || null,
        customer_name: body.customer?.name || null,
        booking_id: body.bookingId || null,
        rental_id: body.rentalId || null,
        card_mask: cardMask || null,
        card_last4: last4 || null,
        error_message: r.ok ? null : JSON.stringify(r.data),
        raw_response: r.data,
        created_by: user.id,
      });
      return new Response(JSON.stringify(r.data), {
        status: r.ok ? 200 : 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // --- Authorize (J5) / Charge (J4) / Charge with token ---
    const isAuthorize = body.action === "authorize";
    const items = (body.items && body.items.length > 0)
      ? body.items
      : [{ name: body.description || "השכרת רכב", unitPrice: body.amount || 0, quantity: 1 }];

    const payload: any = {
      Customer: buildCustomer(body.customer),
      PaymentMethod: buildPaymentMethod(body.card),
      Items: items.map((it) => ({
        Item: { Name: it.name, Description: it.description || null },
        Quantity: it.quantity ?? 1,
        UnitPrice: it.unitPrice,
      })),
      Payments_Count: body.payments || null,
      SendDocumentByEmail: isAuthorize ? false : (body.sendInvoiceEmail ?? true),
      VATIncluded: true,
      Credentials: creds,
    };
    // Sumit J5: official API uses the regular charge endpoint with AuthoriseOnly=true.
    // The undocumented /billing/payments/authorize/ endpoint can return ValidPayment without a real hold.
    if (isAuthorize) {
      payload.AuthoriseOnly = true;
      payload.PreventDocumentCreation = true;
      payload.SendDocumentByEmail = false;
      payload.Payments_Count = null;
    }

    const endpoint = "/billing/payments/charge/";
    const r = await sumitFetch(endpoint, payload);
    const data = r.data?.Data || {};
    const payment = data?.Payment || {};
    const authNumber = payment?.AuthNumber || data?.CreditCardAuthNumber || data?.AuthorizationNumber || r.data?.AuthNumber || null;
    const validPayment = payment?.ValidPayment === true;
    const providerStatus = String(payment?.Status || r.data?.ResultCode || "");
    // For J5 (authorize), require an actual auth number from the bank
    const sumitOk = isAuthorize ? (r.ok && !!authNumber && validPayment && providerStatus === "000") : r.ok;
    if (isAuthorize && r.ok && !authNumber) {
      console.warn("Sumit returned success without AuthNumber:", JSON.stringify(r.data));
    }
    const docId = data?.DocumentID || data?.Document?.ID || null;
    const docNumber = data?.DocumentNumber || data?.Document?.Number || null;
    const docType = data?.DocumentType || data?.Document?.Type || null;
    const token = payment?.PaymentMethod?.CreditCard_Token || data?.PaymentMethod?.CreditCard_Token || data?.CreditCard_Token || null;
    const cardMask = payment?.PaymentMethod?.CreditCard_CardMask || data?.PaymentMethod?.CreditCard_CardMask || data?.CreditCard_CardMask || null;
    const last4 = payment?.PaymentMethod?.CreditCard_LastDigits || data?.PaymentMethod?.CreditCard_LastDigits || data?.CreditCard_LastDigits || null;

    // Save card token if returned
    if (sumitOk && token && body.customer?.id) {
      await supabaseAdmin.from("customers").update({
        payment_token: token,
        card_last4: last4,
        payment_provider: "sumit",
      }).eq("id", body.customer.id);
    }

    // Save invoice
    let invoiceId: string | null = null;
    if (sumitOk && docId && !isAuthorize) {
      const pdfUrl = data?.DocumentDownloadURL || data?.Document?.DownloadURL || null;
      const { data: inv } = await supabaseAdmin.from("sumit_invoices").insert({
        document_id: String(docId),
        document_number: docNumber ? String(docNumber) : null,
        document_type: docType,
        amount: body.amount || 0,
        customer_id: body.customer?.id || null,
        customer_name: body.customer?.name || null,
        booking_id: body.bookingId || null,
        rental_id: body.rentalId || null,
        pdf_url: pdfUrl,
        raw_response: r.data,
        created_by: user.id,
      }).select().single();
      invoiceId = inv?.id || null;
    }

    // Save transaction
    const errorMsg = !sumitOk
      ? (isAuthorize && r.ok && !authNumber
          ? "סומיט החזירה הצלחה אך ללא מספר אישור — תפיסת המסגרת לא בוצעה בפועל"
          : JSON.stringify(r.data))
      : null;
    await supabaseAdmin.from("payment_transactions").insert({
      transaction_type: isAuthorize ? "authorize" : (body.card?.token ? "charge_token" : "charge"),
      status: sumitOk ? "success" : "failed",
      amount: body.amount,
      auth_number: authNumber,
      card_last4: last4,
      card_mask: cardMask,
      customer_id: body.customer?.id || null,
      customer_name: body.customer?.name || null,
      booking_id: body.bookingId || null,
      rental_id: body.rentalId || null,
      invoice_id: invoiceId,
      error_message: errorMsg,
      raw_response: r.data,
      created_by: user.id,
    });

    // Update booking/rental with J5 details
    if (sumitOk && isAuthorize && authNumber) {
      const update = {
        sumit_auth_number: String(authNumber),
        sumit_authorized_amount: body.amount,
        sumit_authorized_at: new Date().toISOString(),
      };
      if (body.bookingId) await supabaseAdmin.from("bookings").update(update).eq("id", body.bookingId);
      if (body.rentalId) await supabaseAdmin.from("rentals").update(update).eq("id", body.rentalId);
    }

    return new Response(JSON.stringify({
      success: sumitOk,
      authNumber,
      documentId: docId,
      documentNumber: docNumber,
      invoiceId,
      cardLast4: last4,
      raw: r.data,
    }), {
      status: sumitOk ? 200 : 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: any) {
    console.error("sumit-payment error:", err);
    return new Response(JSON.stringify({ error: err.message || String(err) }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
