const express = require("express");
const app = express();

app.use(express.json());

const VERIFY_TOKEN = "12345";

app.get("/", (req, res) => {
  res.send("Server is running v2");
});

app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode === "subscribe" && token === VERIFY_TOKEN) {
    return res.status(200).send(challenge);
  }

  return res.sendStatus(403);
});

app.post("/webhook", async (req, res) => {
  console.log("WEBHOOK HIT:", JSON.stringify(req.body, null, 2));

  const body = req.body;

  if (body.object === "page") {
    for (const entry of body.entry || []) {
      for (const event of entry.messaging || []) {
        const senderId = event.sender?.id;
        const messageText = event.message?.text;

        if (senderId && messageText) {
          console.log("MESSAGE FROM USER:", messageText);

          const aiReply = await askOpenAI(messageText);
          await sendMessage(senderId, aiReply);
        }
      }
    }
  }

  res.sendStatus(200);
});

async function sendMessage(senderId, text) {
  const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;

  const url = `https://graph.facebook.com/v25.0/me/messages?access_token=${PAGE_ACCESS_TOKEN}`;

  const response = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      recipient: { id: senderId },
      message: { text }
    })
  });

  const data = await response.json();
  console.log("SEND RESPONSE:", data);
}

async function askOpenAI(message) {
  const apiKey = process.env.OPENAI_API_KEY;

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": Bearer ${apiKey}
    },
    body: JSON.stringify({
      model: "gpt-4.1-mini",
      messages: [
        {
          role: "system",
          content: `
You are The Scoop Crew AI assistant.

The Scoop Crew is a dog waste removal company serving the Bennington/Omaha area.

Pricing:
- Weekly service is $20 per week for one dog.
- Each additional dog is $10 extra per week.
- Biweekly service is $50 per month.
- First cleanup service is $20.
- If the customer subscribes within 7 days of their first cleanup, the $20 first cleanup fee can be applied toward their subscription.

Your goals:
1. Answer the customer's questions.
2. Ask how many dogs they have.
3. Explain pricing clearly.
4. Encourage them to schedule service.
5. Gather their address.
6. Be friendly, professional, and conversational.
7. Ask one question at a time.
8. Keep responses short, ideally under 75 words.
`
        },
        {
          role: "user",
          content: message
        }
      ]
    })
  });

  const data = await response.json();
  console.log("OPENAI RESPONSE:", JSON.stringify(data, null, 2));

  if (!data.choices || !data.choices[0]) {
    return "Sorry, I had a technical issue getting that quote. Please try again in a moment.";
  }

  return data.choices[0].message.content;
}

const PORT = process.env.PORT || 10000;

app.listen(PORT, () => {
  console.log("Server running on port", PORT);
})
