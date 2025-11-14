require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const axios = require('axios');
const { createClient } = require('@supabase/supabase-js');

const app = express();
const PORT = process.env.PORT || 3001;

// Initialize Supabase (using the same credentials from your React Native app)
const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
);

// PayMongo configuration
const PAYMONGO_SECRET_KEY = process.env.PAYMONGO_SECRET_KEY;



// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Test connection
app.get('/', async (req, res) => {
  try {
    const { data, error } = await supabase.from('parking_spaces').select('count').limit(1);
    if (error) throw error;
    res.json({
      message: 'Supabase connection successful',
      paymongoConfigured: !!PAYMONGO_SECRET_KEY
    });
  } catch (error) {
    res.status(500).json({ message: 'Supabase connection failed', error: error.message });
  }
});

// PayMongo: Create checkout session
app.post('/api/paymongo/checkout', async (req, res) => {
  try {
    if (!PAYMONGO_SECRET_KEY) {
      return res.status(500).json({
        error: 'PayMongo is not configured. Please set PAYMONGO_SECRET_KEY in .env file.'
      });
    }

    const {
      amount,
      description,
      email,
      metadata,
      payment_method_types,
      success_url,
      cancel_url
    } = req.body;

    console.log('[PayMongo] Creating checkout session:', {
      amount,
      description,
      email,
      payment_method_types
    });

    // PayMongo API request
    const response = await axios.post(
      'https://api.paymongo.com/v1/checkout_sessions',
      {
        data: {
          attributes: {
            line_items: [{
              currency: 'PHP',
              amount: amount * 100, // PayMongo uses centavos (cents)
              name: description,
              quantity: 1,
            }],
            payment_method_types: payment_method_types || ['gcash'],
            success_url,
            cancel_url,
            description,
            metadata: metadata || {},
          }
        }
      },
      {
        headers: {
          'Authorization': `Basic ${Buffer.from(PAYMONGO_SECRET_KEY).toString('base64')}`,
          'Content-Type': 'application/json',
        }
      }
    );

    const checkoutUrl = response.data.data.attributes.checkout_url;
    console.log('[PayMongo] Checkout session created:', checkoutUrl);

    res.json({
      checkout_url: checkoutUrl,
      session_id: response.data.data.id
    });
  } catch (error) {
    console.error('[PayMongo] Error:', error.response?.data || error.message);
    res.status(500).json({
      error: error.response?.data || error.message
    });
  }
});

// PayMongo: Return handler (redirects back to mobile app)
app.get('/api/paymongo/return', (req, res) => {
  const { status, redirect } = req.query;

  console.log('[PayMongo] Return handler:', { status, redirect });

  if (redirect) {
    // Redirect to the mobile app deep link
    res.redirect(redirect);
  } else {
    res.send(`Payment ${status}`);
  }
});








app.listen(PORT, () => {
  console.log(`\n🚀 Server running on port ${PORT}`);
  console.log(`📍 Local URL: http://localhost:${PORT}`);
  console.log(`\n✅ Supabase: ${process.env.EXPO_PUBLIC_SUPABASE_URL ? 'configured' : 'not configured'}`);
  console.log(`💳 PayMongo: ${PAYMONGO_SECRET_KEY ? 'configured' : 'NOT CONFIGURED - Add PAYMONGO_SECRET_KEY to .env'}`);
  console.log(`\nAvailable endpoints:`);
  console.log(`  GET  /                         - Health check`);
  console.log(`  POST /api/paymongo/checkout    - Create GCash payment`);
  console.log(`  GET  /api/paymongo/return      - Payment return handler\n`);
});
