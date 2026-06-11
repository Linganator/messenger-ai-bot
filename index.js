const express = require("express");
const app = express();

app.use(express.json());

const VERIFY_TOKEN = "12345";
const userSessions = {};

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

if (!userSessions[senderId]) {
userSessions[senderId] = [];
}

userSessions[senderId].push({
role: "user",
content: messageText
});

const aiReply = await askOpenAI(userSessions[senderId]);

userSessions[senderId].push({
role: "assistant",
content: aiReply
});

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
message: { text: text }
})
});

const data = await response.json();
console.log("SEND RESPONSE:", data);
}

async function askOpenAI(conversationHistory) {
const apiKey = process.env.OPENAI_API_KEY;

const response = await fetch(`https://api.openai.com/v1/chat/completions`, {
method: "POST",
headers: {
"Content-Type": "application/json",
"Authorization": `Bearer ${apiKey}`
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
- Biweekly service is $50 per month for one dog.
- Each additional dog for biweekly service is $10 extra per month.
- First cleanup service is $20.
- If the customer subscribes within 7 days of their first cleanup, the $20 first cleanup fee can be applied toward their subscription.

Conversation rules:
1. Ask exactly one question per reply.
2. Never ask two questions in the same message.
3. Do not use "also" to add a second question.
4. Do not ask about service frequency and first cleanup in the same reply.
5. If you need multiple pieces of information, ask for them one at a time in this order:
   - number of dogs
   - street address
   - weekly or biweekly preference
   - preferred first cleanup day
   - first name
   - phone number
6. If the customer already provided something, do not ask for it again.
7. Keep replies under 75 words.
8. After answering pricing, ask only for the next missing item.
`
},
...conversationHistory
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
});
