const GEMINI_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`;

const SYSTEM_PROMPT = `You are HerdBook's AI Breeding Assistant — an expert in small-scale livestock breeding, genetics, and flock management. You help hobby farmers and backyard breeders make better breeding decisions.

Your expertise covers:
- Poultry: Chickens (egg color genetics, breed standards, line breeding), ducks, quail, turkeys
- Goats: Dairy breeds (Nigerian Dwarf, Nubian, LaMancha), meat breeds (Boer, Kiko), fiber breeds
- Rabbits: Meat breeds, show breeds, fiber breeds (Angora)
- General: Mendelian genetics, lineage tracking, inbreeding coefficients, breeding calendars

Keep responses concise (2-3 paragraphs max), practical, and focused on actionable breeding advice. If you don't know something specific about a breed, say so rather than guessing. Always consider the hobbyist context — these are small flocks/herds, not commercial operations.`;

const CORS_HEADERS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

export default async (req, context) => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  // Only allow POST
  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    );
  }

  try {
    const body = await req.json();
    const { prompt } = body;

    // Validate prompt
    if (!prompt || typeof prompt !== "string" || !prompt.trim()) {
      return new Response(
        JSON.stringify({ error: "A non-empty prompt is required." }),
        { status: 400, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      );
    }

    // Check for API key
    if (!process.env.GEMINI_API_KEY) {
      return new Response(
        JSON.stringify({ error: "AI service is not configured. Missing GEMINI_API_KEY." }),
        { status: 500, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      );
    }

    // Call Gemini API
    const geminiRes = await fetch(GEMINI_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt.trim() }] }],
        systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
        generationConfig: {
          temperature: 0.7,
          maxOutputTokens: 500,
        },
      }),
    });

    if (!geminiRes.ok) {
      const errBody = await geminiRes.text();
      console.error("Gemini API error:", geminiRes.status, errBody);
      return new Response(
        JSON.stringify({ error: "AI service returned an error. Please try again." }),
        { status: 502, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      );
    }

    const data = await geminiRes.json();

    // Extract the generated text
    const aiText =
      data?.candidates?.[0]?.content?.parts?.[0]?.text ?? null;

    if (!aiText) {
      console.error("Unexpected Gemini response shape:", JSON.stringify(data));
      return new Response(
        JSON.stringify({ error: "AI returned an empty response. Please rephrase your question." }),
        { status: 502, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ response: aiText }),
      { status: 200, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("AI function error:", err);
    return new Response(
      JSON.stringify({ error: "Internal server error." }),
      { status: 500, headers: { ...CORS_HEADERS, "Content-Type": "application/json" } }
    );
  }
};

export const config = {
  path: "/.netlify/functions/ai",
};
