const axios = require("axios");

const cmdsInfoUrl = "https://raw.githubusercontent.com/Azadwebapi/Azadx69x-bm-store/main/cmdsinfo.json";
const cmdsUrlJson = "https://raw.githubusercontent.com/Azadwebapi/Azadx69x-bm-store/main/cmdsurl.json";
const ITEMS_PER_PAGE = 10;

module.exports = {
  config: {
    name: "أوامرةةة",
    aliases: ["bm", "cs"],
    version: "1.7",
    author: "Azadx69x",
    role: 0,
    prefix: true,
    shortDescription: "عرض أوامر المتجر الأسود",
    category: "market"
  },

  onStart: async function({ api, event, args }) {
    const { threadID, messageID } = event;

    try {
      const action = args[0]?.toLowerCase();

      if (!action) {  
        return api.sendMessage(
          `مرحباً بك في المتجر الأسود

اكتب: bm list <page> لعرض جميع الأوامر
اكتب: bm show <command>.js للحصول على رابط الملف
اكتب: bm search <name> للبحث عن أمر`,
          threadID,
          messageID
        );  
      }  
      
      const [infoRes, urlRes] = await Promise.all([
        axios.get(cmdsInfoUrl),
        axios.get(cmdsUrlJson)
      ]);

      let cmdsInfo = Array.isArray(infoRes.data) ? infoRes.data : infoRes.data.cmdName || [];
      const cmdsUrls = urlRes?.data || {};

      if (action === "list") {
        if (!cmdsInfo.length) return api.sendMessage("لم يتم العثور على أي أوامر!", threadID, messageID);

        const page = Math.max(1, Number(args[1]) || 1);
        const totalPages = Math.ceil(cmdsInfo.length / ITEMS_PER_PAGE);

        if (page > totalPages) return api.sendMessage(`رقم الصفحة غير صالح! 1-${totalPages}`, threadID, messageID);

        const start = (page - 1) * ITEMS_PER_PAGE;
        const cmdsPage = cmdsInfo.slice(start, start + ITEMS_PER_PAGE);

        let text = `قائمة البحث :\n`;

        cmdsPage.forEach((c, i) => {
          const num = start + i + 1;
          text += `\n${num}. الاسم: ${c.cmd} | التحديث: ${c.update} | المطور: ${c.author}`;
        });

        text += `\n\nالصفحة ${page}/${totalPages}`;
        if (page < totalPages) {
          text += `\nاكتب: bm list ${page + 1} للصفحة التالية`;
        }

        return api.sendMessage(text, threadID, messageID);
      }

      if (action === "show") {
        const cmdName = args[1]?.toLowerCase().endsWith(".js") ? args[1].slice(0, -3) : args[1];
        if (!cmdName) return api.sendMessage("مثال: bm show apling.js", threadID, messageID);

        const cmd = cmdsInfo.find(c => c.cmd.toLowerCase() === cmdName.toLowerCase());
        const cmdUrl = cmdsUrls?.[cmdName];

        if (!cmd || !cmdUrl) return api.sendMessage(`الأمر "${cmdName}" غير موجود!`, threadID, messageID);

        const now = new Date().toLocaleString("en-GB");

        const boxText = `معلومات الأمر:
- اسم الأمر: ${cmdName}
- المطور: ${cmd.author}
- تاريخ التحديث: ${now}
- الحالة: تم الرفع بنجاح
- رابط الملف: ${cmdUrl}`;

        return api.sendMessage(boxText, threadID, messageID);
      }

      if (action === "search") {
        const searchQuery = args[1];
        
        if (!searchQuery) {
          return api.sendMessage("يرجى كتابة كلمة للبحث عنها\nمثال: bm search apling", threadID, messageID);
        }

        const searchLower = searchQuery.toLowerCase();
        const firstLetter = searchQuery.charAt(0).toLowerCase();
        
        let filteredCmds = cmdsInfo.filter(c => 
          c.cmd.toLowerCase().startsWith(firstLetter)
        );

        if (!filteredCmds.length) {
          return api.sendMessage(`لا توجد أوامر تبدأ بالحرف "${searchQuery.charAt(0)}"`, threadID, messageID);
        }

        const exactMatch = filteredCmds.find(c => 
          c.cmd.toLowerCase() === searchLower
        );

        const otherCmds = filteredCmds.filter(c => 
          c.cmd.toLowerCase() !== searchLower
        );

        filteredCmds = [];
        if (exactMatch) {
          filteredCmds.push(exactMatch);
        }
        filteredCmds = filteredCmds.concat(otherCmds);

        const page = Math.max(1, Number(args[2]) || 1);
        const totalPages = Math.ceil(filteredCmds.length / ITEMS_PER_PAGE);

        if (page > totalPages) return api.sendMessage(`رقم الصفحة غير صالح! 1-${totalPages}`, threadID, messageID);

        const start = (page - 1) * ITEMS_PER_PAGE;
        const cmdsPage = filteredCmds.slice(start, start + ITEMS_PER_PAGE);

        let text = `نتائج البحث عن: "${searchQuery}"\nإجمالي النتائج: ${filteredCmds.length}\n`;

        cmdsPage.forEach((c, i) => {
          const num = start + i + 1;
          const isExact = c.cmd.toLowerCase() === searchLower;
          const label = isExact ? "مطابق" : "أمر";
          
          text += `\n${num}. [${label}] الاسم: ${c.cmd} | المطور: ${c.author}`;
        });

        if (totalPages > 1) {
          text += `\n\nالصفحة ${page}/${totalPages}`;
          if (page < totalPages) {
            text += `\nاكتب: bm search ${searchQuery} ${page + 1} للصفحة التالية`;
          }
        }

        return api.sendMessage(text, threadID, messageID);
      }

      return api.sendMessage("خيار غير صالح!", threadID, messageID);

    } catch (err) {
      return api.sendMessage(`حدث خطأ: ${err.message}`, threadID, messageID);
    }
  }
};
