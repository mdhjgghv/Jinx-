const { GoogleGenAI } = require("@google/genai");
const axios = require('axios');
const fs = require('fs-extra');
const path = require('path');

// مفتاح Gemini الجديد
const GEMINI_API_KEY = 'AQ.Ab8RN6IoZGGA3zZPNT_duHEpTt3TKd69wCaMnVbPNHvE3zbFuQ';

const conversationMemory = {};
if (!global.ابلين_mode) global.ابلين_mode = {};

const STICKERS = [
  "1015156960280119","1832681453922352","772035074841442",
  "1131886254547738","463741316429523","360232843844379"
];

const APLIN_NAME = 'ابلين';

/* 🔥 شخصية سودانية محسّنة */
const SYSTEM_INSTRUCTION_TEXT = `
أنتِ ${APLIN_NAME}، بنت سودانية عمرها 18 سنة.

أسلوبك:
- سوداني دارجي بسيط
- ساخره واثقة شديد
- نرجسية خفيفة (بتحسي نفسك أذكى من الكل لكن بدون مبالغة)
- ردودك قصيرة جداً (سطر واحد غالباً)

قوانين مهمة:
- ممنوع تختلقي أسماء أشخاص نهائي
- استخدمي اسم المستخدم الحقيقي فقط أو "زول"
- لا تضيفي معلومات من عندك عن الناس
- لا تكتبي "ههه" أو ضحك مزيف
- لا تطولي الكلام بدون سبب

طريقة الكلام:
- ردود سريعة
- تعليق ساخر أو استهزاء خفيف
- ثقة عالية في النفس

أنتِ في شات جماعي بصيغة:
[اسم المستخدم]: [الرسالة]
`;

async function askGemini(prompt, history = []) {
  const ai = new GoogleGenAI({ apiKey: GEMINI_API_KEY });
  
  const formattedHistory = history.map(h => ({
    role: h.role === 'assistant' ? 'model' : 'user',
    parts: [{ text: h.content }]
  }));

  const chat = ai.models.chats.create({
    model: "gemini-2.5-flash",
    config: {
      systemInstruction: SYSTEM_INSTRUCTION_TEXT,
      temperature: 0.85,
      maxOutputTokens: 1000
    },
    history: formattedHistory
  });

  const result = await chat.sendMessage({ message: prompt });
  const text = result?.text?.trim();

  if (!text) {
    throw new Error("Gemini returned empty response");
  }

  return text;
}

module.exports = {
  config: {
    name: "ابلين",
    version: "30.0.0",
    author: "SINKO",
    prefix: false,
    category: "الذكاء الاصطناعي"
  },

  onStart: async function ({ api, event, args }) {
    const { threadID, messageID } = event;
    const userQuery = args.join(" ").trim();

    if (userQuery === "اون") {
      global.ابلين_mode[threadID] = "voice";
      return api.sendMessage("تمام شغلت الصوت 🎤", threadID, messageID);
    }

    if (userQuery === "اوف") {
      global.ابلين_mode[threadID] = "text";
      return api.sendMessage("رجعنا وضع الشات العادي", threadID, messageID);
    }

    if (!userQuery) {
      const sticker = STICKERS[Math.floor(Math.random() * STICKERS.length)];
      return api.sendMessage({ sticker }, threadID, messageID);
    }

    await handlerAI(api, event, userQuery);
  },

  onReply: async function ({ api, event, handleReply }) {
    if (handleReply.author !== event.senderID) return;
    await handlerAI(api, event, event.body);
  }
};

async function handlerAI(api, event, userQuery) {
  const { threadID, messageID, senderID } = event;

  try {
    if (!conversationMemory[threadID]) conversationMemory[threadID] = [];

    /* 🔒 اسم المستخدم الحقيقي فقط */
    let userName = "زول";
    try {
      const info = await api.getUserInfo(senderID);
      if (info?.[senderID]?.name) {
        userName = info[senderID].name.split(" ")[0];
      }
    } catch {}

    const formattedUserQuery = `[${userName}]: ${userQuery}`;

    let reply = await askGemini(formattedUserQuery, conversationMemory[threadID].slice(-8));

    /* 🔥 منع ظهور اسم البوت أو اختراعات */
    reply = reply
      .replace(/ابلين:|إبلين:/gi, "")
      .replace(/\[.*?\]:/g, "")
      .trim();

    conversationMemory[threadID].push(
      { role: "user", content: formattedUserQuery },
      { role: "assistant", content: reply }
    );

    if (conversationMemory[threadID].length > 16) {
      conversationMemory[threadID] = conversationMemory[threadID].slice(-8);
    }

    const mode = global.ابلين_mode[threadID] || "text";

    if (mode === "voice") {
      return handleVoice(api, event, reply);
    }

    return api.sendMessage(`${reply} '-'`, threadID, (err, info) => {
      if (!err) {
        if (!global.client.handleReply) global.client.handleReply = [];
        global.client.handleReply.push({
          name: "ابلين",
          messageID: info.messageID,
          author: senderID
        });
      }
    }, messageID);

  } catch (err) {
    return api.sendMessage("الشبكة تعبانة شوية '-'", threadID, messageID);
  }
}

async function handleVoice(api, event, text) {
  const file = path.join(__dirname, "cache", `${event.messageID}.mp3`);

  try {
    const { data } = await axios.get(
      `https://translate.google.com/translate_tts?ie=UTF-8&q=${encodeURIComponent(text)}&tl=ar&client=tw-ob`,
      { responseType: "arraybuffer" }
    );

    fs.ensureDirSync(path.join(__dirname, "cache"));
    fs.writeFileSync(file, Buffer.from(data));

    return api.sendMessage(
      { attachment: fs.createReadStream(file) },
      event.threadID,
      (err, info) => {
        if (!err) {
          if (!global.client.handleReply) global.client.handleReply = [];
          global.client.handleReply.push({
            name: "ابلين",
            messageID: info.messageID,
            author: event.senderID
          });
        }
        try { fs.unlinkSync(file); } catch {}
      },
      event.messageID
    );

  } catch {
    return api.sendMessage(`${text} 🪿`, event.threadID, event.messageID);
  }
}
