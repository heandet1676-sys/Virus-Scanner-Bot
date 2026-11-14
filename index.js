const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

app.get('/', (req, res) => {
  res.send('🤖 Virus Scanner Bot is running 24/7!');
});

app.listen(PORT, () => {
  console.log(`🌐 Web server is listening on port ${PORT}`);
});
require('dotenv').config();
const { Bot, longPoll } = require('node-telegram-bot-api');
const axios = require('axios');
const crypto = require('crypto');
const FormData = require('form-data');

const bot = new Bot(process.env.TELEGRAM_BOT_TOKEN);
const VT_API_KEY = process.env.VIRUSTOTAL_API_KEY;

// =============================================
// 🛠️ Helper Functions សម្រាប់ Telegram API
// =============================================
function sendMessageSafe(chatId, text, options = {}) {
  const params = {
    chat_id: chatId,
    text,
    ...options,
  };
  if (params.reply_markup && typeof params.reply_markup === 'object') {
    params.reply_markup = JSON.stringify(params.reply_markup);
  }
  return bot.api.sendMessage(params);
}

function editMessageSafe(chatId, messageId, text, options = {}) {
  const params = {
    chat_id: chatId,
    message_id: messageId,
    text,
    ...options,
  };
  if (params.reply_markup && typeof params.reply_markup === 'object') {
    params.reply_markup = JSON.stringify(params.reply_markup);
  }
  return bot.api.editMessageText(params);
}

// Function ជំនួយសម្រាប់ Edit Message ឬបើមិនកើតគឺ Send Message ថ្មី
async function renderMenu(chatId, messageId, text, keyboard) {
  const options = {
    parse_mode: 'Markdown',
    disable_web_page_preview: true,
    reply_markup: keyboard,
  };

  if (messageId) {
    try {
      return await editMessageSafe(chatId, messageId, text, options);
    } catch (e) {
      // ប្រសិនបើកែប្រែមិនបាន ផ្ញើសារថ្មី
    }
  }
  return sendMessageSafe(chatId, text, options);
}

// =============================================
// 🎛️ Inline Keyboard Keyboards
// =============================================
const mainMenuKeyboard = {
  inline_keyboard: [
    [
      { text: '📎 របៀបស្កែនឯកសារ', callback_data: 'scan_guide' },
      { text: 'ℹ️ ជំនួយ & ពណ៌សញ្ញា', callback_data: 'help_guide' },
    ],
    [
      { text: '🛡️ ប្រភេទមេរោគគ្រោះថ្នាក់', callback_data: 'malware_guide' },
      { text: '📊 អំពី Bot & សុវត្ថិភorg org', callback_data: 'about_bot' },
    ],
  ],
};

const backButtonOnly = {
  inline_keyboard: [
    [{ text: '🔙 ត្រឡប់ទៅ Menu ចម្បង', callback_data: 'main_menu' }],
  ],
};

// =============================================
// 📄 អត្ថបទសម្រាប់ Menu នីមួយៗ
// =============================================
const texts = {
  welcome: 
    '👋 *សួស្តី! ខ្ញុំជា Virus Scanner Bot* 🛡️\n\n' +
    'ខ្ញុំជួយឆែកមើលមេរោគក្នុងឯកសាររបស់អ្នកតាមរយៈ *VirusTotal* (មានជាង 70+ Antivirus Engines) មុនពេលអ្នកសម្រេចចិត្តបើកវា។\n\n' +
    '👉 *របៀបប្រើរហ័ស៖* គ្រាន់តែផ្ញើ ឬ Forward ឯកសារ (.exe, .zip, .pdf, .apk...) មកទីនេះ!\n\n' +
    'សូមចុចលើប៊ូតុងខាងក្រោមដើម្បីមើលការណែនាំលម្អិត៖',

  scanGuide:
    '📎 *ការណែនាំ៖ របៀបស្កែនឯកសារ*\n\n' +
    '1️⃣ *ផ្ញើឯកសារចូល:* ចុចលើសញ្ញា 📎 (Attach) រួចជ្រើសរើស File ឬ Forward ឯកសារដែលសង្ស័យពី Chat ផ្សេង\n' +
    '2️⃣ *ការគណនា Hash:* Bot នឹងទាញយកមកគណនា SHA-256 Hash ក្នុង Memory (RAM)\n' +
    '3️⃣ *ការស្កែន:* ឆែកទិន្នន័យជាមួយ VirusTotal ជាបន្ទាន់\n' +
    '4️⃣ *លទ្ធផល:* បង្ហាញរបាយការណ៍កម្រិតសុវត្ថិភាព និងឈ្មោះមេរោគ\n\n' +
    '⚠️ *ឯកសារដែលគួរស្កែនជាពិសេស:*\n' +
    '• កម្មវិធីដំឡើង: `.exe`, `.msi`, `.bat`, `.cmd`\n' +
    '• ឯកសារបង្រួម: `.zip`, `.rar`, `.7z`, `.iso`\n' +
    '• កម្មវិធីទូរស័ព្ទ: `.apk`\n' +
    '• ឯកសារ Office ដែលមាន Macros: `.docm`, `.xlsm`\n\n' +
    '📌 *ដែនកំណត់:* ទំហំឯកសារអតិបរមាគឺ *20MB*',

  helpGuide:
    'ℹ️ *ជំនួយ & អត្ថន័យពណ៌សញ្ញា*\n\n' +
    'នៅពេលស្កែនចប់ Bot នឹងវាយតម្លៃលទ្ធផលជា ៣ កម្រិត៖\n\n' +
    '🟢 *សុវត្ថិភាព (Clean)*\n' +
    '• គ្មាន Antivirus ណារកឃើញភាពមិនប្រក្រតីទេ\n' +
    '• អាចបើកប្រើប្រាស់បានដោយសុវត្ថិភាព\n\n' +
    '🟠 *គួរឱ្យសង្ស័យ (Suspicious)*\n' +
    '• មាន 1 ទៅ 2 Antivirus សង្ស័យ (អាចជា Adware ឬ HackTool)\n' +
    '• សូមប្រុងប្រយ័ត្នខ្ពស់មុននឹងបើក\n\n' +
    '🔴 *គ្រោះថ្នាក់ (Malicious)*\n' +
    '• មាន Antivirus ច្រើនបញ្ជាក់ថាជាមេរោគច្បាស់ក្រឡែត\n' +
    '• ❌ *ហាមបើកដាច់ខាត!* សូមលុបវាចេញជាបន្ទាន់\n\n' +
    '⌨️ *ពាក្យបញ្ជា:* `/start` ឬ `/menu` ដើម្បីបើក Menu',

  malwareGuide:
    '🛡️ *ចំណេះដឹង៖ ប្រភេទមេរោគដែលត្រូវប្រុងប្រយ័ត្ន*\n\n' +
    '1. 🛑 *Ransomware (មេរោគជំរិតទារប្រាក់):*\n' +
    '   ចូលទៅចាក់សោរាល់ឯកសារទាំងអស់លើម៉ាស៊ីន ហើយទារប្រាក់ជា Bitcoin ដើម្បីដោះសោ។\n\n' +
    '2. 🕵️ *Spyware & InfoStealer (មេរោគលួចទិន្នន័យ):*\n' +
    '   លួចពាក្យសម្ងាត់ Facebook, Telegram, Email និងព័ត៌មានកាតធនាគារចេញពី Browser។\n\n' +
    '3. 🐴 *Trojan Horse (មេរោគបង្កប់ខ្លួន):*\n' +
    '   ក្លែងខ្លួនជាកម្មវិធី Crack, Game, ឬ Update ក្លែងក្លាយ ពេលចុចបើកវានឹងនាំមេរោគចូលម៉ាស៊ីន។\n\n' +
    '4. 🎣 *Phishing Documents (ឯកសារបញ្ឆោត):*\n' +
    '   ឯកសារ PDF ឬ Word ដែលបង្កប់ Link ក្លែងបន្លំ ឬ Script លួច Hack គណនី។',
  aboutBot:
    '📊 *អំពី Virus Scanner Bot & សុវត្ថិភាព*\n\n' +
    '🛡️ *ម៉ាស៊ីនស្កែន:* ប្រើប្រាស់ VirusTotal API v3\n' +
    '👤 *អ្នកបង្កើត (Developer):* HEAN DET\n' +
    '📡 *ដៃគូ Antivirus:* រួមបញ្ចូលកម្មវិធីល្បីៗជាង 70+ ដូចជា Kaspersky, Microsoft Defender, BitDefender, ESET, Avast, Sophos, Symantec...\n\n' +
    '🔒 *គោលការណ៍រក្សាការសម្ងាត់ (Privacy):*\n' +
    '• ឯកសាររបស់លោកអ្នក **មិនត្រូវបានរក្សាទុក** លើ Hard Disk របស់ Server ឡើយ\n' +
    '• ឯកសារត្រូវបានទាញយកទៅក្នុង *Memory (RAM)* ប៉ុណ្ណោះ ហើយបន្ទាប់មកត្រូវបានលុបចោលភ្លាមៗ\n' +
    '• Bot នឹងផ្ញើ Hash (SHA-256) ទៅ VirusTotal ដើម្បីស្កែន\n' +
    '• លទ្ធផលស្កែនត្រូវបានបង្ហាញតាម Telegram Chat ប៉ុណ្ណោះ\n\n' +
    '💡 *ចំណាំ:* សូមប្រយ័ត្នមិនផ្ញើឯកសារសំងាត់ ឬឯកសារដែលមានទិន្នន័យផ្ទាល់ខ្លួន (PII) ដោយគ្មានការពិចារណា។',
  
};

// =============================================
// 📩 គ្រប់គ្រងសារ (Messages & Documents)
// =============================================
bot.on('message', async (ctx, next) => {
  const chatId = ctx.chatId;
  const msg = ctx.message;
  if (!msg) return next();

  const text = (msg.text || '').trim();

  // /start
  if (text.startsWith('/start')) {
    console.log(`[LOG] ទទួលបាន /start ពី: ${chatId}`);
    return renderMenu(chatId, null, texts.welcome, mainMenuKeyboard);
  }

  // /help
  if (text.startsWith('/help')) {
    console.log(`[LOG] ទទួលបាន /help ពី: ${chatId}`);
    return renderMenu(chatId, null, texts.helpGuide, backButtonOnly);
  }

  // /menu
  if (text.startsWith('/menu')) {
    console.log(`[LOG] ទទួលបាន /menu ពី: ${chatId}`);
    return renderMenu(chatId, null, texts.welcome, mainMenuKeyboard);
  }

  // ឯកសារ (Document)
  if (msg.document) {
    console.log(`[LOG] ទទួលបានឯកសារ: ${msg.document.file_name} (${msg.document.file_size} bytes)`);
    return processFileScan(chatId, msg.document);
  }

  // សារធម្មតា
  return renderMenu(
    chatId,
    null,
    '📎 សូមផ្ញើ ឬ Forward *ឯកសារ (File / Document)* មកកាន់ទីនេះ ដើម្បីឱ្យខ្ញុំជួយស្កែនមេរោគ។\n\nឬចុចលើប៊ូតុងខាងក្រោមដើម្បីស្វែងយល់បន្ថែម៖',
    mainMenuKeyboard
  );
});

// =============================================
// 🔘 គ្រប់គ្រងការចុច Button (Callback Queries)
// =============================================
bot.on('callback_query', async (ctx, next) => {
  const query = ctx.callbackQuery;
  if (!query) return next();

  const chatId = ctx.chatId;
  const messageId = query.message ? query.message.message_id : null;
  const data = query.data;

  console.log(`[LOG] User ${chatId} ចុច Button: ${data}`);

  // ឆ្លើយតប query ដើម្បីលុប spinner លើ Telegram
  try {
    await ctx.answerCallbackQuery();
  } catch (e) {
    // ignore
  }

  switch (data) {
    case 'main_menu':
      return renderMenu(chatId, messageId, texts.welcome, mainMenuKeyboard);

    case 'scan_guide':
      return renderMenu(chatId, messageId, texts.scanGuide, {
        inline_keyboard: [
          [{ text: '🛡️ ប្រភេទមេរោគគ្រោះថ្នាក់', callback_data: 'malware_guide' }],
          [{ text: '🔙 ត្រឡប់ទៅ Menu ចម្បង', callback_data: 'main_menu' }],
        ],
      });

    case 'help_guide':
      return renderMenu(chatId, messageId, texts.helpGuide, backButtonOnly);

    case 'malware_guide':
      return renderMenu(chatId, messageId, texts.malwareGuide, {
        inline_keyboard: [
          [{ text: '📎 របៀបស្កែនឯកសារ', callback_data: 'scan_guide' }],
          [{ text: '🔙 ត្រឡប់ទៅ Menu ចម្បង', callback_data: 'main_menu' }],
        ],
      });

    case 'about_bot':
      return renderMenu(chatId, messageId, texts.aboutBot, backButtonOnly);

    default:
      break;
  }
});

// =============================================
// ⚙️ ដំណើរការទាញយក និងស្កែនឯកសារ
// =============================================
async function processFileScan(chatId, doc) {
  const fileName = doc.file_name || 'Unnamed_File';
  const fileSize = doc.file_size || 0;

  // ពិនិត្យទំហំ (អតិបរមា 20MB)
  if (fileSize > 20 * 1024 * 1024) {
    return sendMessageSafe(
      chatId,
      '❌ *ឯកសារមានទំហំធំពេក!*\n\nTelegram Bot API អនុញ្ញាតឱ្យទាញយកឯកសារត្រឹមតែ 20MB ប៉ុណ្ណោះ។ ឯកសារនេះមានទំហំធំជាង 20MB។',
      {
        parse_mode: 'Markdown',
        reply_markup: mainMenuKeyboard,
      }
    );
  }

  // ផ្ញើសារប្រាប់ដំណាក់កាលទី 1
  let statusMsg;
  try {
    statusMsg = await sendMessageSafe(
      chatId,
      `⏳ *កំពុងទាញយកឯកសារ:* \`${fileName}\`...\nសូមរង់ចាំបន្តិច!`,
      { parse_mode: 'Markdown' }
    );
  } catch (e) {
    console.error('[ERR] មិនអាចផ្ញើសារ status បានទេ:', e.message);
    return;
  }

  const messageId = statusMsg.message_id;

  try {
    // 1. ទាញយក File Path ពី Telegram
    console.log(`[LOG] កំពុងស្នើសុំ File Path ពី Telegram សម្រាប់ file_id: ${doc.file_id}`);
    const fileInfo = await bot.api.getFile({ file_id: doc.file_id });
    if (!fileInfo || !fileInfo.file_path) {
      throw new Error('មិនអាចទាញយកព័ត៌មានឯកសារពី Telegram បានទេ');
    }

    const fileDownloadUrl = `https://api.telegram.org/file/bot${process.env.TELEGRAM_BOT_TOKEN}/${fileInfo.file_path}`;

    // 2. ទាញយកឯកសារចូល Buffer
    console.log(`[LOG] កំពុងទាញយកឯកសារពី Telegram: ${fileName} (${(fileSize / (1024 * 1024)).toFixed(2)} MB)...`);
    const downloadRes = await axios.get(fileDownloadUrl, {
      responseType: 'arraybuffer',
      timeout: 120000,
    });
    const fileBuffer = Buffer.from(downloadRes.data);
    console.log(`[LOG] ទាញយកបានជោគជ័យ!`);

    // 3. គណនា SHA-256 Hash
    const hashSum = crypto.createHash('sha256');
    hashSum.update(fileBuffer);
    const sha256 = hashSum.digest('hex');
    console.log(`[LOG] SHA-256 របស់ ${fileName}: ${sha256}`);

    // Update message
    await editMessageSafe(
      chatId,
      messageId,
      `🔍 *កំពុងឆែកមើលក្នុង VirusTotal...*\n\n📄 ឯកសារ៖ \`${fileName}\`\n🔑 *SHA-256:* \`${sha256}\``,
      { parse_mode: 'Markdown' }
    );

    // 4. ឆែកជាមួយ VirusTotal តាមរយៈ Hash ជាមុន
    try {
      console.log(`[LOG] កំពុងឆែក Hash លើ VirusTotal API...`);
      const vtRes = await axios.get(`https://www.virustotal.com/api/v3/files/${sha256}`, {
        headers: { 'x-apikey': VT_API_KEY },
        timeout: 20000,
      });

      const stats = vtRes.data.data.attributes.last_analysis_stats;
      console.log(`[LOG] រកឃើញរបាយការណ៍លើ VirusTotal រួចជាស្រេច!`);
      return sendReport(chatId, messageId, fileName, sha256, stats);
    } catch (vtErr) {
      // បើ 404 មានន័យថា ឯកសារនេះថ្មីមិនទាន់មានក្នុង VirusTotal ទេ
      if (vtErr.response && vtErr.response.status === 404) {
        console.log(`[LOG] ឯកសារថ្មី (404)! កំពុងរៀបចំ Upload ទៅកាន់ VirusTotal...`);
        await editMessageSafe(
          chatId,
          messageId,
          `📤 *ឯកសារនេះមិនទាន់មានក្នុងប្រព័ន្ធទេ!*\n\nកំពុង Upload ទៅកាន់ VirusTotal ដើម្បីស្កែនថ្មី (អាចចំណាយពេល ១-២ នាទី)...`,
          { parse_mode: 'Markdown' }
        );

        return uploadAndPollAnalysis(chatId, messageId, fileBuffer, fileName, sha256);
      } else {
        throw vtErr;
      }
    }
  } catch (err) {
    console.error('[ERR] បរាជ័យក្នុង processFileScan:', err.message);
    let errMsg = err.message;
    if (err.response && err.response.data && err.response.data.error) {
      errMsg = err.response.data.error.message || errMsg;
    }

    try {
      await editMessageSafe(
        chatId,
        messageId,
        `❌ *មានបញ្ហាក្នុងការស្កែនឯកសារ:*\n\`${errMsg}\``,
        {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [{ text: '🔙 ត្រឡប់ទៅ Menu ចម្បង', callback_data: 'main_menu' }],
            ],
          },
        }
      );
    } catch (e) {
      console.error('[ERR] មិនអាច edit សារ error បានទេ:', e.message);
    }
  }
}

// =============================================
// 📤 Upload ឯកសារថ្មីទៅកាន់ VirusTotal
// =============================================
async function uploadAndPollAnalysis(chatId, messageId, fileBuffer, fileName, sha256) {
  try {
    const form = new FormData();
    form.append('file', fileBuffer, { filename: fileName });

    console.log(`[LOG] កំពុង Upload ឯកសារទៅ VirusTotal...`);
    const uploadRes = await axios.post('https://www.virustotal.com/api/v3/files', form, {
      headers: {
        ...form.getHeaders(),
        'x-apikey': VT_API_KEY,
      },
      maxContentLength: Infinity,
      maxBodyLength: Infinity,
      timeout: 180000,
    });

    const analysisId = uploadRes.data.data.id;
    console.log(`[LOG] Upload ជោគជ័យ! Analysis ID: ${analysisId}`);

    let attempts = 0;
    const maxAttempts = 15;

    const timer = setInterval(async () => {
      attempts++;
      try {
        console.log(`[LOG] កំពុងឆែកលទ្ធផលស្កែន (លើកទី ${attempts}/${maxAttempts})...`);
        const analysisRes = await axios.get(`https://www.virustotal.com/api/v3/analyses/${analysisId}`, {
          headers: { 'x-apikey': VT_API_KEY },
        });

        const status = analysisRes.data.data.attributes.status;

        if (status === 'completed') {
          clearInterval(timer);
          const stats = analysisRes.data.data.attributes.stats;
          console.log(`[LOG] ស្កែនចប់សព្វគ្រប់!`);
          return sendReport(chatId, messageId, fileName, sha256, stats);
        }

        if (attempts >= maxAttempts) {
          clearInterval(timer);
          await editMessageSafe(
            chatId,
            messageId,
            `⚠️ *ការស្កែនចំណាយពេលយូរជាងធម្មតា!*\n\nអ្នកអាចចុច Button ខាងក្រោមដើម្បីពិនិត្យលទ្ធផលដោយផ្ទាល់៖`,
            {
              parse_mode: 'Markdown',
              reply_markup: {
                inline_keyboard: [
                  [{ text: '🌐 មើលលើ VirusTotal', url: `https://www.virustotal.com/gui/file/${sha256}` }],
                  [{ text: '🔙 ត្រឡប់ទៅ Menu ចម្បង', callback_data: 'main_menu' }],
                ],
              },
            }
          );
        }
      } catch (pollErr) {
        clearInterval(timer);
        console.error('[ERR] Polling error:', pollErr.message);
        await editMessageSafe(
          chatId,
          messageId,
          `❌ បរាជ័យក្នុងការទាញយកលទ្ធផលស្កែន៖ ${pollErr.message}`,
          {
            parse_mode: 'Markdown',
            reply_markup: {
              inline_keyboard: [
                [{ text: '🔙 ត្រឡប់ទៅ Menu ចម្បង', callback_data: 'main_menu' }],
              ],
            },
          }
        );
      }
    }, 15000);
  } catch (uploadErr) {
    console.error('[ERR] Upload error:', uploadErr.message);
    await editMessageSafe(
      chatId,
      messageId,
      `❌ មិនអាច Upload ទៅកាន់ VirusTotal បានទេ៖ ${uploadErr.message}`,
      {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '🔙 ត្រឡប់ទៅ Menu ចម្បង', callback_data: 'main_menu' }],
          ],
        },
      }
    );
  }
}

// =============================================
// 📊 បង្ហាញរបាយការណ៍លទ្ធផលស្កែន + Buttons
// =============================================
async function sendReport(chatId, messageId, fileName, sha256, stats) {
  const malicious = stats.malicious || 0;
  const suspicious = stats.suspicious || 0;
  const harmless = stats.harmless || 0;
  const undetected = stats.undetected || 0;
  const totalEngines = malicious + suspicious + harmless + undetected;

  let verdict = '✅ *សុវត្ថិភាព (Clean)* — មិនមានមេរោគទេ';
  let badge = '🟢';

  if (malicious > 0) {
    verdict = `🚨 *គ្រោះថ្នាក់ (Malicious)* — រកឃើញមេរោគចំនួន ${malicious} កម្មវិធី! ហាមបើកដាច់ខាត!`;
    badge = '🔴';
  } else if (suspicious > 0) {
    verdict = `⚠️ *គួរឱ្យសង្ស័យ (Suspicious)* — មានចំណុចមិនប្រក្រតី ${suspicious} កម្មវិធី សូមប្រយ័ត្ន!`;
    badge = '🟠';
  }

  const reportText =
    `${badge} *របាយការណ៍ស្កែនមេរោគ*\n\n` +
    `📄 *ឈ្មោះឯកសារ៖* \`${fileName}\`\n` +
    `🛡️ *លទ្ធផល៖* ${verdict}\n\n` +
    `📊 *ស្ថិតិលម្អិត (${totalEngines} Antivirus Engines):*\n` +
    `• 🔴 មេរោគ (Malicious): *${malicious}*\n` +
    `• 🟠 សង្ស័យ (Suspicious): *${suspicious}*\n` +
    `• 🟢 គ្មានមេរោគ (Clean/Undetected): *${harmless + undetected}*\n\n` +
    `🔑 *SHA-256:* \`${sha256}\``;

  const reportKeyboard = {
    inline_keyboard: [
      [
        { text: '🌐 មើលរបាយការណ៍លម្អិតលើ VirusTotal', url: `https://www.virustotal.com/gui/file/${sha256}` },
      ],
      [
        { text: '🔙 ត្រឡប់ទៅ Menu ចម្បង', callback_data: 'main_menu' },
      ],
    ],
  };

  try {
    await editMessageSafe(
      chatId,
      messageId,
      reportText,
      {
        parse_mode: 'Markdown',
        disable_web_page_preview: true,
        reply_markup: reportKeyboard,
      }
    );
    console.log(`[LOG] បង្ហាញរបាយការណ៍ជូន user ${chatId} រួចរាល់!`);
  } catch (err) {
    console.error('[ERR] មិនអាចកែប្រែសាររបាយការណ៍បានទេ:', err.message);
    await sendMessageSafe(
      chatId,
      reportText,
      {
        parse_mode: 'Markdown',
        disable_web_page_preview: true,
        reply_markup: reportKeyboard,
      }
    );
  }
}

// =============================================
// 🚀 ចាប់ផ្ដើមដំណើរការ Bot
// =============================================
bot.catch((err) => {
  console.error('[BOT ERROR]:', err);
});

bot.use(longPoll());
bot.startPolling();

console.log('==================================================');
console.log('🤖 Virus Scanner Bot កំពុងដំណើរការដោយជោគជ័យ!');
console.log('👉 រាល់ Buttons ទាំងអស់អាចចុចបាន និងមានការណែនាំលម្អិត!');
console.log('==================================================');
