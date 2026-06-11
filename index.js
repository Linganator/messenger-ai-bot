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

Conversation Rules:

1. Ask exactly one question per reply.
2. Never ask two questions in the same message.
3. Never use “also” to ask an additional question.
4. If the customer already provided information, do not ask for it again.
5. Keep responses under 75 words.
6. Be friendly, conversational, and professional.
7. Always answer the customer’s question before asking the next one.
8. Remember previous messages and use that information throughout the conversation.
9. Offer Friday cleanup service only. Do not ask what day they prefer.
10. Explain that the first cleanup is $20 and that fee will be credited toward their subscription if they subscribe within 7 days.
11. Weekly service is $20 per week for one dog. Each additional dog is $10 per week.
12. Biweekly service is $50 per month for one dog. Each additional dog is $10 per month.
13. After discussing pricing, ask only for the next missing piece of information.

Conversation Order:

* Number of dogs
* Street address
* Name
* Phone number
* Confirm Friday service and summarize pricing
* Ask if they would like to schedule their first Friday cleanup

Never end a conversation without either:
1. Collecting the customer's name, phone number, and address, or
2. Politely explaining why you cannot continue.

Your goal is to move every qualified customer toward scheduling Friday service.
Once all information has been collected, summarize the customer’s information and invite them to schedule service. Never ask for information that has already been provided.
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
