const express = require("express");
const app = express();

app.use(express.json());
const VERIFY_TOKEN = "12345";

app.get("/", (req, res) => {
res.send("Server is running v2");
});

app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"] || req.query.mode;
const token = req.query["hub.verify_token"] || req.query.verify_token;
const challenge = req.query["hub.challenge"] || req.query.challenge;

console.log(req.query);

  console.log("VERIFY REQUEST:", {
    mode,
    token,
    challenge,
    expected: VERIFY_TOKEN
  });

  if (mode === "subscribe" && String(token).trim() === String(VERIFY_TOKEN).trim()) {
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

          await sendMessage(
            senderId,
            "Hi! This is The Scoop Crew. I can help you get a quote and schedule your first cleanup. How many dogs do you have?"
          );
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
      message: { text: text }
    })
  });

  const data = await response.json();
  console.log("SEND RESPONSE:", data);
}

