const { createClient } = require('@libsql/client');

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

function getTursoClient() {
  return createClient({
    url: process.env.TURSO_DB_URL,
    authToken: process.env.TURSO_DB_TOKEN
  });
}

function isValidEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

async function sendWelcomeEmail(email) {
  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: 'HerdBook <hello@majorsolutions.biz>',
      to: [email],
      subject: "You're on the HerdBook waitlist!",
      html: `<h2>Welcome to HerdBook!</h2><p>You're on the list. We'll let you know when HerdBook is ready to help you track your flock, manage breeding records, and make smarter pairing decisions.</p><p>In the meantime, keep those lineage records handy — you'll be importing them soon.</p><p>— The HerdBook Team</p>`
    })
  });
  return res.ok;
}

exports.handler = async (event) => {
  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 204, headers: CORS_HEADERS, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }

  try {
    const { email, source } = JSON.parse(event.body || '{}');

    if (!email || !isValidEmail(email)) {
      return {
        statusCode: 400,
        headers: CORS_HEADERS,
        body: JSON.stringify({ error: 'Valid email is required' })
      };
    }

    const validSources = ['hero', 'footer', 'pricing'];
    const safeSource = validSources.includes(source) ? source : 'hero';

    const db = getTursoClient();

    await db.execute({
      sql: `INSERT INTO subscribers (email, idea_slug, source, created_at)
            VALUES (?, 'herdbook', ?, datetime('now'))
            ON CONFLICT (email, idea_slug) DO NOTHING`,
      args: [email, safeSource]
    });

    await sendWelcomeEmail(email);

    return {
      statusCode: 200,
      headers: CORS_HEADERS,
      body: JSON.stringify({ success: true })
    };
  } catch (err) {
    console.error('Subscribe error:', err);
    return {
      statusCode: 500,
      headers: CORS_HEADERS,
      body: JSON.stringify({ error: 'Something went wrong. Please try again.' })
    };
  }
};
