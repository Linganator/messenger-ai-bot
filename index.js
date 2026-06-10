const express = require("express");
const axios = require("axios");

const app = express();
app.use(express.json());

// =========================
// ENV
// =========================
const VERIFY_TOKEN = "12345"; // must match Meta webhook verify token
const PAGE_ACCESS_TOKEN = process.env.PAGE_ACCESS_TOKEN;

// =========================
// HEALTH CHECK (Render)
// =========================
app.get("/", (req, res) => {
  res.send("Messenger bot is live");
});

// =========================
// META WEBHOOK VERIFICATION (GET)
// =========================
app.get("/webhook", (req, res) => {
  const mode = req.query["hub.mode"];
  const token = req.query["hub.verify_token"];
  const challenge = req.query["hub.challenge"];

  if (mode && token === VERIFY_TOKEN) {
    console.log("WEBHOOK VERIFIED");
    return res.status(200).send(challenge);
  }

  return res.sendStatus(403);
});

// =========================
// RECEIVE MESSAGES (POST)
// =========================
app.post("/webhook", async (req, res) => {
  try {
    console.log("WEBHOOK HIT:", JSON.stringify(req.body, null, 2));

    const body = req.body;

    if (body.object === "page") {
      for (const entry of body.entry || []) {
        const event = entry.messaging?.[0];

        if (!event) continue;

        const senderId = event.sender.id;
        const messageText = event.message?.text;

        if (messageText) {
          console.log("MESSAGE RECEIVED:", messageText);

          await sendMessage(senderId, You said: ${messageText});
        }
      }
    }

    return res.sendStatus(200);
  } catch (err) {
    console.error("WEBHOOK ERROR:", err);
    return res.sendStatus(200); // IMPORTANT: never break Meta retries
  }
});

// =========================
// SEND MESSAGE TO FACEBOOK
// =========================
async function sendMessage(psid, text) {
  if (!PAGE_ACCESS_TOKEN) {
    console.error("Missing PAGE_ACCESS_TOKEN");
    return;
  }

  const url = https://graph.facebook.com/v19.0/me/messages?access_token=${PAGE_ACCESS_TOKEN};

  try {
    await axios.post(url, {
      recipient: { id: psid },
      message: { text }
    });
  } catch (err) {
    console.error("SEND MESSAGE ERROR:", err.response?.data || err.message);
  }
}

// =========================
// START SERVER
// =========================
const PORT = process.env.PORT || 10000;

app.listen(PORT, () => {
  console.log(Server running on port ${PORT});
});
