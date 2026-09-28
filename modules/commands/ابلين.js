const axios = require('axios');
const fs = require('fs-extra');
const path = require('path');

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

module.exports = {
  config: {
    name: "",
    version: "26.5.0",
    author: "SINKO",
    prefix: false,
    category: ""
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
    if (!conversationMemory[senderID]) conversationMemory[senderID] = [{ role: "system", content: SYSTEM_INSTRUCTION_TEXT }];

    /* 🔒 اسم المستخدم الحقيقي فقط */
    let userName = ".";
    try {
      const info = await api.getUserInfo(senderID);
      if (info?.[senderID]?.name) {
        userName = info[senderID].name.split(" ")[0];
      }
    } catch {}

    const formattedUserQuery = `[${userName}]: ${userQuery}`;
    const history = conversationMemory[senderID];

    history.push({
      role: "user",
      content: formattedUserQuery
    });

    if (history.length > 20) {
      history.splice(1, history.length - 20);
    }

    const boundary = "----WebKitFormBoundary" + Math.random().toString(36).substring(2);

    let formData = "";
    formData += `--${boundary}\r\n`;
    formData += `Content-Disposition: form-data; name="chat_style"\r\n\r\nchat\r\n`;
    formData += `--${boundary}\r\n`;
    formData += `Content-Disposition: form-data; name="chatHistory"\r\n\r\n${JSON.stringify(history)}\r\n`;
    formData += `--${boundary}\r\n`;
    formData += `Content-Disposition: form-data; name="model"\r\n\r\nstandard\r\n`;
    formData += `--${boundary}\r\n`;
    formData += `Content-Disposition: form-data; name="hacker_is_stinky"\r\n\r\nvery_stinky\r\n`;
    formData += `--${boundary}\r\n`;
    formData += `Content-Disposition: form-data; name="enabled_tools"\r\n\r\n[]\r\n`;
    formData += `--${boundary}--\r\n`;

    const response = await axios({
      method: "POST",
      url: "https://api.deepai.org/hacking_is_a_serious_crime",
      headers: {
        "content-type": `multipart/form-data; boundary=${boundary}`,
        origin: "https://deepai.org",
        "user-agent": "Mozilla/5.0"
      },
      data: formData
    });

    let reply = "";
    if (response.data) {
      if (typeof response.data === "string") reply = response.data;
      else if (response.data.output) reply = response.data.output;
      else if (response.data.text) reply = response.data.text;
    }

    reply = reply
      .replace(/\\n/g, "\n")
      .replace(/\\"/g, '"')
      .replace(/ابلين:|إبلين:/gi, "")
      .replace(/\[.*?\]:/g, "")
      .trim();

    if (!reply) reply = "دا أقصى فهمي للسؤال دا '-'";

    history.push({
      role: "assistant",
      content: reply
    });

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
        fs.unlinkSync(file);
      },
      event.messageID
    );

  } catch {
    return api.sendMessage(`${text} 🪿`, event.threadID, event.messageID);
  }
}
