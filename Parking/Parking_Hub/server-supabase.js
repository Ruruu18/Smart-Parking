require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const cors = require('cors');
const { createClient } = require('@supabase/supabase-js');



const app = express();
const PORT = process.env.PORT || 3000;

// Initialize Supabase (using the same credentials from your React Native app)
const supabase = createClient(
  process.env.EXPO_PUBLIC_SUPABASE_URL,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY
);



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

    });
  } catch (error) {
    res.status(500).json({ message: 'Supabase connection failed', error: error.message });
  }
});











app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);

  console.log(`Supabase URL: ${process.env.EXPO_PUBLIC_SUPABASE_URL ? 'configured' : 'not configured'}`);
});
