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
          await sendMessage(senderId, "Hi! This is The Scoop Crew. How many dogs do you have?");
        }
      }
    }
  }

  res.sendStatus(200);
});

async function sendMessage(senderId, text) {
  const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;

  const url = https://graph.facebook.com/v25.0/me/messages?access_token=${PAGE_ACCESS_TOKEN};

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

const PORT = process.env.PORT || 10000;

app.listen(PORT, () => {
  console.log("Server running on port", PORT);
});
