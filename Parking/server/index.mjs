import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';
import crypto from 'crypto';
import { createClient } from '@supabase/supabase-js';

// Ensure we load .env from the project root (one level up from /server)
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const app = express();
const PORT = process.env.PORT || 3001;
const PAYMONGO_SECRET = process.env.PAYMONGO_SECRET;
const PAYMONGO_WEBHOOK_SECRET = process.env.PAYMONGO_WEBHOOK_SECRET; // optional verification
const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!PAYMONGO_SECRET) {
  console.warn('[PayMongo] Missing PAYMONGO_SECRET in environment. Set it in a .env file.');
}
if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  console.warn('[Supabase] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment. Webhook will not be able to write.');
}

// Minimal diagnostics (non-sensitive)
console.log('[Env] SUPABASE_URL:', SUPABASE_URL ? 'set' : 'missing', '| SERVICE_ROLE_KEY:', SUPABASE_SERVICE_ROLE_KEY ? 'set' : 'missing');

// Supabase admin client (for server-side writes)
const supabaseAdmin = (SUPABASE_URL && SUPABASE_SERVICE_ROLE_KEY)
  ? createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
  : null;

app.use(cors({ origin: true }));

// Webhook needs raw body for signature verification
app.post('/api/paymongo/webhook', express.raw({ type: 'application/json' }), async (req, res) => {
  try {
    const raw = req.body; // Buffer
    const sig = req.header('Paymongo-Signature') || '';

    // Optional signature verification (recommended in production)
    if (PAYMONGO_WEBHOOK_SECRET) {
      try {
        // Header format: t=timestamp, v1=signature
        const parts = Object.fromEntries(sig.split(',').map(kv => kv.split('=')));
        const v1 = parts['v1'];
        if (!v1) throw new Error('Missing v1 signature');
        const hmac = crypto.createHmac('sha256', PAYMONGO_WEBHOOK_SECRET);
        hmac.update(raw);
        const digest = hmac.digest('hex');
        if (digest !== v1) {
          console.warn('[Webhook] Invalid signature');
          return res.status(400).json({ error: 'invalid signature' });
        }
      } catch (e) {
        console.warn('[Webhook] Signature verification failed:', e?.message);
        return res.status(400).json({ error: 'signature verification failed' });
      }
    } else {
      console.warn('[Webhook] PAYMONGO_WEBHOOK_SECRET not set. Skipping signature verification.');
    }

    // Parse JSON body from raw buffer
    let payload;
    try {
      payload = JSON.parse(raw.toString('utf8'));
    } catch (e) {
      return res.status(400).json({ error: 'invalid JSON' });
    }

    const type = payload?.data?.attributes?.type || payload?.data?.type || '';
    const checkout = payload?.data?.attributes?.data?.attributes || {};
    const meta = checkout?.metadata || {};
    const sessionId = meta.session_id || meta.sessionId || null;
    const userId = meta.user_id || meta.userId || null;
    const lineItems = Array.isArray(checkout?.line_items) ? checkout.line_items : [];
    const cents = lineItems[0]?.amount || 0;
    const amount = Math.round(Number(cents || 0) / 100);
    const pmTypes = checkout?.payment_method_types || [];
    const payment_method = Array.isArray(pmTypes) && pmTypes.includes('gcash') ? 'gcash' : (pmTypes[0] || 'gcash');

    // Only handle successful events
    const isPaid = type === 'checkout_session.payment.paid' || type === 'payment.paid' || type === 'payment.paid_event';
    if (!isPaid) {
      return res.status(200).json({ received: true, ignored: type });
    }

    if (!supabaseAdmin) {
      console.warn('[Webhook] Supabase admin not configured; cannot write payment');
      return res.status(500).json({ error: 'supabase admin not configured' });
    }

    if (!sessionId || !userId) {
      console.warn('[Webhook] Missing session_id or user_id in metadata; skipping insert');
      return res.status(200).json({ received: true, skipped: 'missing metadata' });
    }

    // Idempotent insert: if a completed payment already exists for this session, skip
    const { data: existing, error: existErr } = await supabaseAdmin
      .from('payments')
      .select('id, status')
      .eq('session_id', sessionId)
      .eq('user_id', userId)
      .eq('status', 'completed')
      .limit(1);

    if (existErr) {
      console.warn('[Webhook] Existing check failed:', existErr);
    }
    if (existing && existing.length > 0) {
      return res.status(200).json({ received: true, duplicate: true });
    }

    const { error: insertErr } = await supabaseAdmin
      .from('payments')
      .insert([
        {
          session_id: sessionId,
          user_id: userId,
          amount: amount || null,
          payment_method,
          status: 'completed',
        },
      ]);

    if (insertErr) {
      console.error('[Webhook] Insert failed:', insertErr);
      return res.status(500).json({ error: 'insert failed' });
    }

    return res.status(200).json({ received: true });
  } catch (e) {
    console.error('[Webhook] Unexpected error:', e);
    return res.status(500).json({ error: 'unexpected' });
  }
});

// JSON parser for the rest of the routes
app.use(express.json());

app.get('/api/health', (_req, res) => {
  res.json({ ok: true, service: 'paymongo-proxy', time: new Date().toISOString() });
});

// Helper to render an HTML page that attempts to open the app via deep link
function renderDeepLinkHtml(targetUrl) {
  return `<!DOCTYPE html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>Returning to app...</title>
    <style>body{background:#0b0b0b;color:#fff;font-family:system-ui,-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;display:flex;align-items:center;justify-content:center;height:100vh;padding:24px;text-align:center}a{color:#4ea1ff}</style>
    <meta http-equiv="refresh" content="0;url='${targetUrl}'" />
    <script>
      (function(){
        var url = '${targetUrl.replace(/'/g, "&#39;")}';
        try { window.location.href = url; } catch (e) {}
        setTimeout(function(){ window.location.href = url; }, 200);
      })();
    </script>
  </head>
  <body>
    <div>
      <h2>Returning to the app…</h2>
      <p>If you are not redirected automatically, <a href="${targetUrl}">tap here</a>.</p>
    </div>
  </body>
</html>`;
}

// PayMongo return endpoints that deep link back into the app
app.get('/paymongo/return', (req, res) => {
  const status = (req.query.status || '').toString();
  const redirect = (req.query.redirect || '').toString();
  // Prefer a provided redirect (e.g., exp://... for Expo Go). Otherwise fallback to custom scheme.
  const deepLink = redirect || `parkinghub://payments/result?status=${encodeURIComponent(status || 'unknown')}`;
  res.setHeader('Content-Type', 'text/html');
  res.send(renderDeepLinkHtml(deepLink));
});

// Create a PayMongo Checkout Session and return the checkout_url
app.post('/api/paymongo/checkout', async (req, res) => {
  try {
    const { amount, description, email, metadata, payment_method_types, success_url, cancel_url } = req.body || {};

    if (!PAYMONGO_SECRET) {
      return res.status(500).json({ error: 'Server missing PAYMONGO_SECRET configuration' });
    }

    if (!amount || Number.isNaN(Number(amount))) {
      return res.status(400).json({ error: 'amount is required (in PHP), e.g., 100 for ₱100' });
    }

    const phpAmount = Number(amount);
    const centavos = Math.round(phpAmount * 100);

    // Compute base origin for fallbacks
    const origin = req.headers.origin || `http://localhost:${PORT}`;
    // Use provided URLs or fall back to server-hosted return pages that deep link into the app
    const okUrl = success_url || `${origin}/paymongo/return?status=success`;
    const koUrl = cancel_url || `${origin}/paymongo/return?status=cancelled`;

    const payload = {
      data: {
        attributes: {
          description: description || 'Parking Payment',
          line_items: [
            {
              name: 'Parking Fee',
              amount: centavos,
              currency: 'PHP',
              quantity: 1,
            },
          ],
          payment_method_types: payment_method_types || ['gcash', 'card', 'paymaya'],
          send_email_receipt: Boolean(email),
          billing: email ? { email } : undefined,
          success_url: okUrl,
          cancel_url: koUrl,
          metadata: metadata || {},
        },
      },
    };

    const resp = await fetch('https://api.paymongo.com/v1/checkout_sessions', {
      method: 'POST',
      headers: {
        'Authorization': 'Basic ' + Buffer.from(`${PAYMONGO_SECRET}:`).toString('base64'),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
    });

    const data = await resp.json();

    if (!resp.ok) {
      return res.status(resp.status).json({ error: data?.errors || data });
    }

    const checkoutUrl = data?.data?.attributes?.checkout_url;
    if (!checkoutUrl) {
      return res.status(500).json({ error: 'Missing checkout_url in PayMongo response', raw: data });
    }

    return res.json({ checkout_url: checkoutUrl, raw: data });
  } catch (err) {
    console.error('Checkout error:', err);
    return res.status(500).json({ error: 'Unexpected server error' });
  }
});

app.listen(PORT, () => {
  const mode = PAYMONGO_SECRET?.includes('_test_') ? 'TEST' : (PAYMONGO_SECRET ? 'LIVE' : 'UNKNOWN');
  console.log(`[PayMongo] Proxy server running on http://localhost:${PORT} | Mode: ${mode}`);
});
