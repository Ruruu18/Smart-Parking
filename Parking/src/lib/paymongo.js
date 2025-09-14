// Simple client helper to request a PayMongo Checkout session from our server
export async function createCheckout({ amount, description, email, metadata, payment_method_types, success_url, cancel_url, serverUrl }) {
  const base = serverUrl || import.meta.env.VITE_API_BASE || 'http://localhost:3001';
  const res = await fetch(`${base}/api/paymongo/checkout`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ amount, description, email, metadata, payment_method_types, success_url, cancel_url })
  });

  // Safely parse response based on content-type
  const contentType = res.headers.get('content-type') || '';
  let body;
  try {
    if (contentType.includes('application/json')) {
      body = await res.json();
    } else {
      body = await res.text();
    }
  } catch (e) {
    // Fallback when body is empty (e.g., 404/500 with no content)
    body = null;
  }

  if (!res.ok) {
    const msg = typeof body === 'string' && body
      ? body
      : (body && body.error ? JSON.stringify(body.error) : `HTTP ${res.status} ${res.statusText}`);
    throw new Error(msg);
  }

  const url = typeof body === 'object' && body ? body.checkout_url : null;
  if (!url) throw new Error('Checkout URL not returned by server');
  return url;
}

export async function redirectToCheckout(opts) {
  const url = await createCheckout(opts);
  window.location.href = url;
}
