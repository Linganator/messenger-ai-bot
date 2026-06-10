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

app.post("/webhook", (req, res) => {
console.log("WEBHOOK HIT:", req.body);
res.sendStatus(200);
});

const PORT = process.env.PORT || 10000;

app.listen(PORT, () => {
console.log("Server running on port", PORT);
});

