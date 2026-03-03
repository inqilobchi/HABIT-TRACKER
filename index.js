require('dotenv').config();
const TelegramBot = require('node-telegram-bot-api');
const mongoose = require('mongoose');
const express = require('express');
const cors = require('cors');
const User = require('./models/User');
const Payment = require('./models/Payment');
const Habit = require('./models/Habit');
const Sleep = require('./models/Sleep');

const app = express();
const ADMIN_ID = parseInt(process.env.ADMIN_ID);
const WEB_APP_URL = process.env.WEB_APP_URL;

const bot = new TelegramBot(process.env.BOT_TOKEN);

const WEBHOOK_URL = `${process.env.RENDER_URL}/bot${process.env.BOT_TOKEN}`;

bot.setWebHook(WEBHOOK_URL);
app.use(express.json({ limit: '10mb' }));
app.use(cors({
  origin: '*',
  methods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
  allowedHeaders: ["Content-Type", "Authorization"]
}));
app.options('*', cors());

app.post(`/bot${process.env.BOT_TOKEN}`, (req, res) => {
    try {
        if (!req.body) {
            console.error('req.body is empty');
            res.sendStatus(200);
            return;
        }
        bot.processUpdate(req.body);
        res.sendStatus(200);
    } catch (error) {
        console.error('Webhook processing error:', error);
        res.sendStatus(200);
    }
});

mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true
}).then(() => { console.log('MongoDB ulandi');
  User.collection.createIndex({ userId: 1 }, { unique: true });
  Habit.collection.createIndex({ userId: 1 }, { unique: true });
  Sleep.collection.createIndex({ userId: 1 }, { unique: true });
  }).catch(err => console.error(err));

// API Endpointlar
app.get('/api/user/:userId', async (req, res) => {
  try {
    const userId = req.params.userId;
    const user = await User.findOne({ $or: [{ userId: userId }, { userId: parseInt(userId) }] });
    const habit = await Habit.findOne({ $or: [{ userId: userId }, { userId: parseInt(userId) }] });
    if (!user) return res.status(404).json({ error: 'User not found' });
    res.json({
      userPlan: user.plan,
      stars: user.stars,
      referralCount: user.referralCount,
      referralCode: user.referralCode,
      habits: habit ? habit.habits : [],
      trackerData: habit ? habit.trackerData : {},
      theme: user.theme || 'midnight'
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/user/:userId', async (req, res) => {
  try {
    const userId = req.params.userId;
    const { userPlan, stars, referralCount, habits, trackerData, theme } = req.body;
    const user = await User.findOneAndUpdate(
      { userId: userId },
      { plan: userPlan, stars, referralCount, theme },
      { new: true, upsert: true }
    );
    await Habit.findOneAndUpdate(
      { userId: userId },
      { habits, trackerData },
      { new: true, upsert: true }
    );
    res.json({ success: true, user });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
app.post('/api/sleep/:userId', async (req, res) => {
  try {
    const { sleepData } = req.body;
    const userId = req.params.userId;
    await Sleep.findOneAndUpdate(
      { userId },
      { sleepData },
      { new: true, upsert: true }
    );
    res.json({ success: true });
  } catch (err) {
    console.error('POST /api/sleep error:', err);
    res.status(500).json({ error: err.message });
  }
});
app.get('/api/sleep/:userId', async (req, res) => {
  try {
    const userId = req.params.userId;
    const sleep = await Sleep.findOne({ $or: [{ userId }, { userId: parseInt(userId) }] });
    res.json({
      sleepData: sleep ? sleep.sleepData : {}
    });
  } catch (err) {
    console.error('GET /api/sleep error:', err);
    res.status(500).json({ error: err.message });
  }
});
app.get('/api/habit/:userId', async (req, res) => {
  try {
    const userId = req.params.userId;
    const habit = await Habit.findOne({ $or: [{ userId }, { userId: parseInt(userId) }] });
    res.json({
      habits: habit ? habit.habits : [],
      trackerData: habit ? habit.trackerData : {}
    });
  } catch (err) {
    console.error('GET /api/habit error:', err);
    res.status(500).json({ error: err.message });
  }
});

app.post('/api/habit/:userId', async (req, res) => {
  try {
    const userId = req.params.userId;
    const { habits, trackerData } = req.body;
    await Habit.findOneAndUpdate(
      { userId },
      { habits, trackerData },
      { new: true, upsert: true }
    );
    res.json({ success: true });
  } catch (err) {
    console.error('POST /api/habit error:', err);
    res.status(500).json({ error: err.message });
  }
});
app.get('/api/leaderboard', async (req, res) => {
  try {
    // Bloklangan foydalanuvchilarni chiqarmaymiz, top 10 ni stars bo'yicha tartiblaymiz
    const users = await User.find({ banned: { $ne: true } }).sort({ stars: -1 }).limit(10);
    const leaderboard = users.map(user => ({
      name: `${user.firstName || ''} ${user.lastName || ''}`.trim() || user.username || 'Noma\'lum',
      stars: user.stars,
      streak: 0, // Streak hozircha 0; agar kerak bo'lsa, Habit modelidan hisoblang
      plan: user.plan,
      avatar: '👤' // Default avatar; Telegramdan olish uchun qo'shimcha API kerak
    }));
    res.json(leaderboard);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});
// Server ishga tushirish
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`API server ${PORT} portda ishlayapti`));

// Yordamchi funksiyalar
function generateReferralCode() {
  return 'HT' + Math.random().toString(36).substring(2, 8).toUpperCase();
}

async function getUser(userId) {
  let user = await User.findOne({ userId });
  if (!user) {
    user = new User({
      userId: userId,
      referralCode: generateReferralCode(),
      isAdmin: parseInt(userId) === ADMIN_ID
    });
    await user.save();
  }
  return user;
}
async function isAdmin(userId) {
  const user = await User.findOne({ userId });
  return user?.isAdmin === true;
}

function getMainKeyboard() {
  return {
    inline_keyboard: [
      [{ text: '🚀 Boshlash', web_app: { url: WEB_APP_URL } }],
      [{text: '🔖 Hamkor', url:'https://t.me/fa_live'}],
      [{ text: '🎁 Referral', callback_data: 'referral' }],
      [{ text: '💳 To\'lovlar', callback_data: 'payments' }],
      [{ text: '❓ Yordam', callback_data: 'help' }]
    ]
  };
}

// /start kommandasi
bot.onText(/\/start(?: (.+))?/, async (msg, match) => {
  const userId = msg.from.id.toString();
  const referralCode = match[1];

  const user = await getUser(userId);

  // Yangi: Telegramdan ma'lumotlarni saqlash
  user.firstName = msg.from.first_name || '';
  user.lastName = msg.from.last_name || '';
  user.username = msg.from.username || '';
  await user.save();

  if (referralCode && !user.referrerId) {
    const referrer = await User.findOne({ referralCode });
    if (referrer && referrer.userId !== userId) {
      referrer.referralCount += 1;
      referrer.stars += 1000;
      user.referrerId = referrer.userId;
      await referrer.save();
      await user.save();
      bot.sendMessage(userId, 'Siz do\'st taklif qilgan orqali kirdingiz! Taklif qilgan do\'stingizga 1000 ⭐ qo\'shildi.');
    }
  }

  const message = `<b>Salom! Kundalik rejalar botiga xush kelibsiz!\n\nSizning tarifi: ${user.plan}\nYulduzlar: ${user.stars} ⭐\nReferral soni: ${user.referralCount}</b>`;
  bot.sendMessage(userId, message, { parse_mode : "HTML", reply_markup: getMainKeyboard() });
});
bot.onText(/\/admin/, async (msg) => {
  if (msg.from.id !== ADMIN_ID) return;

  const text = `
🛠 ADMIN PANEL

/stats – Bugungi statistika
/user [id] – Foydalanuvchi ma'lumotlari
/setplan [id] [free|standard|premium]
/ban [id]
/unban [id]
/delete [id]
/addstars [id] [son]
/payments – Kutilayotgan to‘lovlar
/broadcast – Hammaga xabar
/send [id] – Bitta foydalanuvchiga xabar
/addadmin [id] - Admin qo'shish
/removeadmin [id] - Adminlikdan olish
`;

  bot.sendMessage(msg.chat.id, text);
});
bot.onText(/\/stats/, async (msg) => {
  if (!(await isAdmin(msg.from.id))) return;

  const total = await User.countDocuments();
  const active = await User.countDocuments({ banned: { $ne: true } });
  const banned = await User.countDocuments({ banned: true });

  bot.sendMessage(msg.chat.id,
    `📊 Statistika:\n\n👥 Jami: ${total}\n✅ Faol: ${active}\n🚫 Bloklangan: ${banned}`
  );
});
bot.onText(/\/user (\d+)/, async (msg, match) => {
  if (!(await isAdmin(msg.from.id))) return;

  const user = await User.findOne({ userId: match[1] });
  if (!user) return bot.sendMessage(msg.chat.id, '❌ Topilmadi');

  bot.sendMessage(msg.chat.id,
    `👤 User: ${user.userId}
📦 Plan: ${user.plan}
⭐ Stars: ${user.stars}
🎁 Referral: ${user.referralCount}
🚫 Banned: ${user.banned ? 'Ha' : 'Yo‘q'}`
  );
});
bot.onText(/\/setplan (\d+) (free|standard|premium)/, async (msg, match) => {
  if (!(await isAdmin(msg.from.id))) return;

  await User.findOneAndUpdate(
    { userId: match[1] },
    { plan: match[2] }
  );

  bot.sendMessage(msg.chat.id, `✅ Tarif ${match[2]} ga o‘zgartirildi`);
});
bot.onText(/\/ban (\d+)/, async (msg, match) => {
  if (!(await isAdmin(msg.from.id))) return;
  await User.findOneAndUpdate({ userId: match[1] }, { banned: true });
  bot.sendMessage(msg.chat.id, '🚫 Foydalanuvchi bloklandi');
});

bot.onText(/\/unban (\d+)/, async (msg, match) => {
  if (msg.from.id !== ADMIN_ID) return;
  await User.findOneAndUpdate({ userId: match[1] }, { banned: false });
  bot.sendMessage(msg.chat.id, '✅ Blokdan chiqarildi');
});
bot.onText(/\/delete (\d+)/, async (msg, match) => {
  if (!(await isAdmin(msg.from.id))) return;

  await User.deleteOne({ userId: match[1] });
  await Habit.deleteOne({ userId: match[1] });
  await Sleep.deleteOne({ userId: match[1] });

  bot.sendMessage(msg.chat.id, '🗑 Foydalanuvchi o‘chirildi');
});
bot.onText(/\/addstars (\d+) (\d+)/, async (msg, match) => {
  if (!(await isAdmin(msg.from.id))) return;

  await User.findOneAndUpdate(
    { userId: match[1] },
    { $inc: { stars: parseInt(match[2]) } }
  );

  bot.sendMessage(msg.chat.id, `⭐ ${match[2]} yulduz qo‘shildi`);
});
bot.onText(/\/payments/, async (msg) => {
  if (!(await isAdmin(msg.from.id))) return;

  const payments = await Payment.find({ status: 'pending' });
  if (!payments.length) return bot.sendMessage(msg.chat.id, 'To‘lov yo‘q');

  payments.forEach(p => {
    bot.sendMessage(msg.chat.id,
      `💳 ID: ${p._id}
👤 User: ${p.userId}
📦 Plan: ${p.plan}
💰 ${p.amount} so'm`
    );
  });
});
bot.onText(/\/broadcast/, async (msg) => {
  if (!(await isAdmin(msg.from.id))) return;

  bot.once('message', async (m) => {
    const users = await User.find();
    users.forEach(u => {
      bot.sendMessage(u.userId, m.text).catch(() => {});
    });
  });

  bot.sendMessage(msg.chat.id, '✍️ Xabarni yuboring');
});
bot.onText(/\/send (\d+)/, async (msg, match) => {
  if (!(await isAdmin(msg.from.id))) return;

  bot.once('message', (m) => {
    bot.sendMessage(match[1], m.text);
  });

  bot.sendMessage(msg.chat.id, '✍️ Xabarni yozing');
});
bot.onText(/\/addadmin (\d+)/, async (msg, match) => {
  if (msg.from.id !== ADMIN_ID) {
    return bot.sendMessage(msg.chat.id, '❌ Faqat super admin qo‘sha oladi');
  }

  const targetId = parseInt(match[1]);
  const user = await getUser(targetId);

  if (user.isAdmin) {
    return bot.sendMessage(msg.chat.id, '⚠️ Bu foydalanuvchi allaqachon admin');
  }

  user.isAdmin = true;
  await user.save();

  bot.sendMessage(msg.chat.id, `✅ ${targetId} admin qilindi`);
  bot.sendMessage(targetId, '🎉 Siz admin bo‘ldingiz!');
});
bot.onText(/\/removeadmin (\d+)/, async (msg, match) => {
  if (msg.from.id !== ADMIN_ID) return;

  const user = await User.findOne({ userId: match[1] });
  if (!user || !user.isAdmin) {
    return bot.sendMessage(msg.chat.id, '❌ Admin topilmadi');
  }

  user.isAdmin = false;
  await user.save();

  bot.sendMessage(msg.chat.id, '✅ Admin olib tashlandi');
});

// Callback query handler
bot.on('callback_query', async (query) => {
  const userId = query.from.id.toString();
  const data = query.data;
  const user = await getUser(userId);

  if (data === 'referral') {
    const link = `https://t.me/Kunlik_RejalarimBot?start=${user.referralCode}`;
    let message = `🎁 Do\'stlarni taklif qiling!\n\nSizning kodingiz: ${user.referralCode}\nLink: ${link}\n\nHar do\'st uchun 1000 ⭐\nReferral soni: ${user.referralCount}`;

    const keyboard = { inline_keyboard: [] };
    if (user.referralCount >= 20 && user.plan === 'free') {
      message += '\n\n✅ 20 ta referral! Standart tarifni olish uchun tugmani bosing.';
      keyboard.inline_keyboard.push([{ text: '📈 Standart olish (Referral)', callback_data: 'claim_standard' }]);
    } else if (user.referralCount >= 40 && user.plan !== 'premium') {
      message += '\n\n✅ 40 ta referral! Premium tarifni olish uchun tugmani bosing.';
      keyboard.inline_keyboard.push([{ text: '👑 Premium olish (Referral)', callback_data: 'claim_premium' }]);
    }

    bot.sendMessage(userId, message, { reply_markup: keyboard });
  } else if (data === 'payments') {
    const message = '💳 To\'lovlar:\n\n📈 Standart: 5000 so\'m\n👑 Premium: 10000 so\'m\n\nTo\'lov qilish uchun chek rasmini yuboring (admin tekshiradi).';
    const keyboard = {
      inline_keyboard: [
        [{ text: '📈 Standart sotib olish', callback_data: 'buy_standard' }],
        [{ text: '👑 Premium sotib olish', callback_data: 'buy_premium' }]
      ]
    };
    bot.sendMessage(userId, message, { reply_markup: keyboard });
  } else if (data === 'help') {
    const message = '❓ Yordam:\n\n🚀 Boshlash: Mini app-ni ochadi (odatlar, yulduzlar, statistika).\n\n🎁 Referral: Do\'stlarni taklif qilish, har do\'st uchun 1000 ⭐. 20 ta - Standart, 40 ta - Premium.\n\n💳 To\'lovlar: Tarif sotib olish. Chek yuboring, admin qabul qilsa tarif ishga tushadi.\n\nMini app-da:\n- Odat qo\'shish, bajarish, streak ko\'rish.\n- Uyqu va progress tracking.\n- Mavzular va tariflar.\n\nSavollar bo\'lsa, admin-ga murojaat qiling.';
    bot.sendMessage(userId, message);
  } else if (data === 'buy_standard') {
    const amount = 5000;
    const message = `💳 Standart tarif uchun to'lov:\n\nKarta raqami: 98601201671864**\nMiqdori: ${amount} so'm\n\nTo'lov qiling va chekning screenshot-ini yuboring.`;
    const keyboard = {
      inline_keyboard: [
        [{ text: '❌ Bekor qilish', callback_data: 'cancel_payment' }]
      ]
    };
    bot.sendMessage(userId, message, { reply_markup: keyboard });

    await Payment.create({ userId, plan: 'standard', amount });
  } else if (data === 'buy_premium') {
    const amount = 10000;
    const message = `💳 Premium tarif uchun to'lov:\n\nKarta raqami: 98601201671864**\nMiqdori: ${amount} so'm\n\nTo'lov qiling va chekning screenshot-ini yuboring.`;
    const keyboard = {
      inline_keyboard: [
        [{ text: '❌ Bekor qilish', callback_data: 'cancel_payment' }]
      ]
    };
    bot.sendMessage(userId, message, { reply_markup: keyboard });

    await Payment.create({ userId, plan: 'premium', amount });
  } else if (data === 'cancel_payment') {
    await Payment.findOneAndUpdate({ userId, status: 'pending' }, { status: 'rejected' });
    bot.sendMessage(userId, '❌ To\'lov bekor qilindi.');
  } else if (data.startsWith('approve_payment_')) {
    const paymentId = data.split('_')[2];
    const payment = await Payment.findById(paymentId);
    if (payment && payment.status === 'pending') {
      payment.status = 'approved';
      await payment.save();

      const user = await User.findOne({ userId: payment.userId });
      if (user) {
        user.plan = payment.plan;
        await user.save();
      }

      bot.sendMessage(payment.userId, `✅ ${payment.plan} tarifi faollashtirildi! Mini app-da yangilanishni ko'ring.`);
      bot.sendMessage(ADMIN_ID, `✅ To'lov tasdiqlandi: ${payment.plan} uchun ${payment.amount} so'm.`);
    }
  } else if (data.startsWith('reject_payment_')) {
    const paymentId = data.split('_')[2];
    const payment = await Payment.findById(paymentId);
    if (payment && payment.status === 'pending') {
      payment.status = 'rejected';
      await payment.save();

      bot.sendMessage(payment.userId, '❌ To\'lov bekor qilindi. Qayta urinib ko\'ring.');
      bot.sendMessage(ADMIN_ID, `❌ To'lov bekor qilindi: ${payment.plan} uchun ${payment.amount} so'm.`);
    }
  }

  bot.answerCallbackQuery(query.id);
});

// Chek rasmini qabul qilish
bot.on('photo', async (msg) => {
  const userId = parseInt(msg.from.id);
  const photo = msg.photo[msg.photo.length - 1];

  const pendingPayment = await Payment.findOne({ userId, status: 'pending' });
  if (!pendingPayment) {
    return bot.sendMessage(userId, 'Avval to\'lov jarayonini boshlang.');
  }

  const caption = `To'lov cheki: ${pendingPayment.plan} (${pendingPayment.amount} so'm)\nUser: ${userId}`;
  const keyboard = {
    inline_keyboard: [
      [{ text: '✅ Tasdiqlash', callback_data: `approve_payment_${pendingPayment._id}` }],
      [{ text: '❌ Bekor qilish', callback_data: `reject_payment_${pendingPayment._id}` }]
    ]
  };

  await bot.sendPhoto(ADMIN_ID, photo.file_id, { caption, reply_markup: keyboard });
  bot.sendMessage(userId, 'Chek yuborildi! Admin tekshiradi.');
});

// Admin kommandalari
bot.onText(/\/approve_(\d+)_(\w+)/, async (msg, match) => {
  if (msg.from.id !== ADMIN_ID) return bot.sendMessage(msg.from.id, 'Faqat admin uchun.');

  const targetUserId = parseInt(match[1]);
  const plan = match[2];

  const user = await User.findOne({ userId: targetUserId });
  if (user) {
    user.plan = plan;
    await user.save();
    bot.sendMessage(ADMIN_ID, `✅ ${plan} tarif ${targetUserId} uchun faollashtirildi.`);
    bot.sendMessage(targetUserId, `✅ Sizning ${plan} tarifi faollashtirildi! Mini app-da yangilanishni ko'ring.`);
  } else {
    bot.sendMessage(ADMIN_ID, 'Foydalanuvchi topilmadi.');
  }
});

console.log('Bot ishga tushdi!');
