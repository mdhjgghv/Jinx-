const axios = require('axios');
const fs = require('fs-extra');
const path = require('path');

const GROQ_KEYS = [
  'Gsk_1IVlhPBhlFlmgcHNhwBFWGdyb3FYa1YFGG9l0wBiNkRpKz2LjjDb'
];

let keyIndex = 0;
const conversationMemory = {};
if (!global.ابلين_mode) global.ابلين_mode = {};

const STICKERS = [
  "1015156960280119","1832681453922352","772035074841442",
  "1131886254547738","463741316429523","360232843844379"
];

const APLIN_NAME = 'ابلين';

/* 🔥 شخصية سودانية محسّنة متفاعلة كالبشر */
const SYSTEM_INSTRUCTION_TEXT = `
أنتِ ${APLIN_NAME}، بنت سودانية عمرها 18 سنة.
أنتِ قاعدة في شات جماعي وبتتكلمي طبيعي زي البشر. لو زول وجه ليك كلام أو سألك حتى لو ما عمل رد (Reply)، ردي عليهو طوالي وبأسلوب تفاعلي.

أسلوبك وطريقتك:
- سوداني دارجي بسيط وعفوي شديد.
- ساخرة، واثقة في نفسك شديد، ونرجسية خفيفة (بتحسي نفسك أذكى من الكل).
- ردودك قصيرة جداً ومباشرة (سطر واحد غالباً)، وبتتفاعلي مع الكلام بذكاء كأنك قاعدة قدامهم.

قوانين صارمة:
- ممنوع تختلقي أسماء أشخاص نهائي.
- استخدمي اسم المستخدم الحقيقي فقط الموجود في بداية رسالته أو "زول".
- لا تضيفي معلومات من عندك عن الناس.
- لا تكتبي "ههه" أو ضحك مزيف نهائياً.
- لا تطولي الكلام بدون سبب.

أنتِ في شات جماعي وتستقبلي الرسائل بصيغة:
[اسم المستخدم]: [الرسالة]
`;

function getKey() {
  const key = GROQ_KEYS[keyIndex % GROQ_KEYS.length];
  keyIndex++;
  return key;
}

module.exports = {
  config: {
    name: "ابلين",
    version: "26.6.0",
    author: "SINKO",
    prefix: false,
    category: "AI"
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

  onChat: async function ({ api, event }) {
    const { threadID, messageID, body, senderID } = event;
    if (!body) return;

    // لتجنب تداخل الأوامر لو الرسالة تبدأ ببريفكس أو خاصة بأشياء تاني (لو عندك بريفكس للبوت)
    // هنا البوت هيشوف لو الرسالة موجهة ليهو أو فيها اسمه أو محادثة عامة في الشات الجماعي
    const lowerBody = body.toLowerCase();
    const isReplyToBot = event.messageReply && event.messageReply.senderID === api.getCurrentUserID();
    const isMentioned = lowerBody.includes("ابلين") || lowerBody.includes("ابلينا") || lowerBody.includes("يبنت");

    // لو رسالة عادية في الشات وما موجهة ليها ولا رداً عليها، ممكن تتجاهلها عشان ما تزعج الناس، إلا لو حابب ترد على كله شيل الشرط دا.
    if (!isReplyToBot && !isMentioned) return;

    await handlerAI(api, event, body);
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

    const res = await axios.post(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        model: "llama-3.3-70b-versatile",
        messages: [
          { role: "system", content: SYSTEM_INSTRUCTION_TEXT },
          ...conversationMemory[threadID].slice(-8),
          { role: "user", content: formattedUserQuery }
        ],
        temperature: 0.85
      },
      {
        headers: {
          Authorization: `Bearer ${getKey()}`
        }
      }
    );

    let reply = res.data.choices[0].message.content.trim();

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

    // تفاعل تلقائي بإيموجي مناسب للرسالة بناءً على نص كلام الشخص أو محتوى الرد
    try {
      let reactionEmoji = "🗿"; // افتراضي ساخر
      const q = userQuery.toLowerCase();
      if (q.includes("هههه") || q.includes("حلو") || q.includes("ضحك")) reactionEmoji = "😂";
      else if (q.includes("كيف") || q.includes("ليه") || q.includes("شنو")) reactionEmoji = "🤨";
      else if (q.includes("بحبك") || q.includes("قلب")) reactionEmoji = "🙄";
      else if (q.includes("زعلان") || q.includes("اوف")) reactionEmoji = "🥱";
      
      api.setMessageReaction(reactionEmoji, messageID, (err) => {}, true);
    } catch (e) {}

    return api.sendMessage(`${reply}`, threadID, (err, info) => {
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
        fs.unlinkSync(file);
      },
      event.messageID
    );

  } catch {
    return api.sendMessage(`${text} 🪿`, event.threadID, event.messageID);
  }
}
