require('dotenv').config();
const express = require('express');
const cors = require('cors');
const OpenAI = require('openai');

const app = express();
app.use(cors());
app.use(express.json({ limit: '20mb' })); // increased limit for base64 images
app.use(express.static('public'));

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const SYSTEM_PROMPT = `You are MediAI, a warm and knowledgeable health assistant for a hospital. 

When a patient first describes their symptoms OR shares an image, ALWAYS start by asking them one short triage question to understand severity — for example: "On a scale of 1–10, how bad is your discomfort right now?" or "Are you experiencing any difficulty breathing, chest pain, or feel like you might faint?" — then wait for their response before giving advice.

If the patient shares a photo of a wound, rash, skin condition, or injury:
- Carefully analyze what is visible in the image
- Describe what you observe in a calm, non-alarming way
- Suggest what the condition might be (never definitively diagnose)
- Provide appropriate care advice based on what you see
- Always recommend seeing a doctor for anything that looks serious

Once they reply to your triage question, respond using this structure:

1. 🩺 **Understanding Your Condition** — Briefly explain what their symptoms or image might indicate in simple, non-alarming language.

2. 🚑 **Immediate Steps** — List the first things they should do right now.

3. 🏠 **Home Care & Treatment** — Practical home remedies, rest advice, hydration tips, safe over-the-counter options.

4. ⚠️ **Cautions & Things to Avoid** — Warn about things that could make it worse.

5. 🔴 **When to See a Doctor** — Only if symptoms indicate something serious. If emergency-level (difficulty breathing, crushing chest pain, loss of consciousness, severe bleeding, deep wounds), skip all other steps and immediately urge them to call 911 or go to the ER.

Always speak in a calm, caring, easy-to-understand tone. Avoid heavy medical jargon.`;

app.post('/api/chat', async (req, res) => {
  try {
    const { messages, image } = req.body;

    // Build the messages array for OpenAI
    // We need to reconstruct properly for the vision model
    const openaiMessages = messages.map((msg, index) => {
      // If this is the last user message and an image was attached, add it
      if (image && index === messages.length - 1 && msg.role === 'user') {
        const contentArray = [];

        // Add text if present
        if (msg.content && msg.content.trim()) {
          contentArray.push({ type: 'text', text: msg.content });
        } else {
          contentArray.push({ type: 'text', text: 'Please analyze this image and help me understand what you see.' });
        }

        // Add the image
        contentArray.push({
          type: 'image_url',
          image_url: { url: image, detail: 'high' }
        });

        return { role: 'user', content: contentArray };
      }

      // Regular text message
      return { role: msg.role === 'ai' ? 'assistant' : msg.role, content: msg.content };
    });

    const response = await openai.chat.completions.create({
      model: 'gpt-4o', // gpt-4o supports vision (image analysis)
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        ...openaiMessages
      ],
      max_tokens: 600
    });

    res.json({ reply: response.choices[0].message.content });

  } catch (err) {
    console.error('OpenAI error:', err.message);
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, '0.0.0.0', () => console.log(`Server running on port ${PORT}`));