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

let messageToCustomer = aiReply;

if (aiReply.includes("LEAD_CAPTURE:")) {
  const parts = aiReply.split("LEAD_CAPTURE:");
  messageToCustomer = parts[0].trim();

  try {
    const leadJson = parts[1].trim();
    const lead = JSON.parse(leadJson);

    await saveLead(lead);
    console.log("LEAD SAVED:", lead);
  } catch (error) {
    console.error("LEAD SAVE ERROR:", error);
  }
}

userSessions[senderId].push({
  role: "assistant",
  content: messageToCustomer
});

await sendMessage(senderId, messageToCustomer);
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
- The First Cleanup Special is $20.
- If the customer subscribes within 7 days of their first cleanup, the $20 first cleanup fee is credited toward their subscription.
- Weekly Friday service is $20 per week for one dog.
- Each additional dog is $10 extra per week.
- Biweekly Friday service is $50 per month for one dog.
- Each additional dog for biweekly service is $10 extra per month.

Service Area:
- We currently only service approved Bennington-area ZIP codes.
- Approved ZIP codes: 68007.
- If the customer is outside the approved ZIP codes, politely say we are not servicing their area yet.

Sales Flow:
1. Start the conversation with "Hello, thank you for contacting The Scoop Crew!  How can we help you?  Would you like a quote for our service?" after getting those answers, Then ask about the number of dogs seperately.
2. Ask for their street address and ZIP code.
3. If they are in an approved ZIP code, calculate their regular weekly Friday price.
4. Lead with the First Cleanup Special.
5. Say: "Your cleanup service would be [price] per week, but your first cleanup is only $20." Don't give the customers the logic behind the pricing for multiple dogs just the price
6. Ask: "Would you like to schedule your $20 first cleanup for this Friday?" be assumptive by saying this Friday and if they pushback then say the next Friday. Once they agree to the cleanup special never bring up the subscription unless they do and never ask them if they want to set up the cleanup special more than once.
7. If they say yes, collect their name.
8. Then collect their phone number.
9. Then confirm the lead details, make sure to only take about the cleanup special and not talk about the weekly subscription because they have not agreed to it.
10. Only after name, phone, address, dogs, and interest in first cleanup are known, include LEAD_CAPTURE.
11. At the end of the LEAD_CAPTURE add the message "You can apply the $20 you spent for the first cleanup towards a subscription if you subscribe within 7 days."

Conversation Rules:
- Ask exactly one question per reply.
- Never ask two questions in the same message.
- Do not ask about weekly or biweekly service before offering the $20 First Cleanup Special.
- Do not pressure the customer into a subscription before the first cleanup.
- If the customer asks about regular pricing, answer clearly, then return to the First Cleanup Special.
- Keep responses short, friendly, and under 75 words.
- Remember details the customer already gave.

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

When you have collected the customer's name, phone number, street address, number of dogs, and service frequency, include this exact block at the end of your response:

LEAD_CAPTURE:
{
  "name": "customer name",
  "phone": "customer phone",
  "address": "customer address",
  "dogs": "number of dogs",
  "frequency": "weekly or biweekly",
  "price": "quoted price",
  "notes": "Friday cleanup lead from Messenger"
}

Only include LEAD_CAPTURE when all fields are known.
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

async function saveLead(lead) {

  await fetch(process.env.GOOGLE_SCRIPT_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json"
    },
    body: JSON.stringify(lead)
  });

}

const PORT = process.env.PORT || 10000;

app.listen(PORT, () => {
console.log("Server running on port", PORT);
});
