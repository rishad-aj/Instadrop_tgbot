// ==================================================
// INSTADROP TELEGRAM BOT
// VERCEL SERVERLESS FUNCTION
// MULTI-LANGUAGE VERSION
// ==================================================

// ==================================================
// CONFIGURATION
// ==================================================

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID;
const API_KEY = process.env.API_KEY;

const API_URL =
  "https://instadrop.rishu-rishad2019.workers.dev/?url=";

const WELCOME_IMAGE =
  "https://instadrop.web.app/og-image.png";

const WEBSITE_URL =
  "https://instadrop.web.app/";


// ==================================================
// TEMPORARY STORAGE
// ==================================================

const mediaStorage = new Map();
const notifiedUsers = new Set();

// User language preferences.
// chatId -> language code
const userLanguages = new Map();

const STORAGE_TTL = 30 * 60 * 1000;


// ==================================================
// SUPPORTED LANGUAGES
// ==================================================

const LANGUAGES = {
  en: {
    name: "English",
    flag: "🇬🇧"
  },

  ru: {
    name: "Русский",
    flag: "🇷🇺"
  },

  uz: {
    name: "O‘zbek",
    flag: "🇺🇿"
  },

  id: {
    name: "Bahasa Indonesia",
    flag: "🇮🇩"
  },

  ar: {
    name: "العربية",
    flag: "🇸🇦"
  },

  uk: {
    name: "Українська",
    flag: "🇺🇦"
  },

  fa: {
    name: "فارسی",
    flag: "🇮🇷"
  },

  tr: {
    name: "Türkçe",
    flag: "🇹🇷"
  },

  hi: {
    name: "हिन्दी",
    flag: "🇮🇳"
  }
};


// ==================================================
// TRANSLATIONS
// ==================================================

const TEXT = {

  // ------------------------------------------------
  // LANGUAGE
  // ------------------------------------------------

  languageTitle: {
    en: "🌐 <b>Choose your language.</b>",
    ru: "🌐 <b>Выберите язык.</b>",
    uz: "🌐 <b>Tilni tanlang.</b>",
    id: "🌐 <b>Pilih bahasa Anda.</b>",
    ar: "🌐 <b>اختر لغتك.</b>",
    uk: "🌐 <b>Оберіть мову.</b>",
    fa: "🌐 <b>زبان خود را انتخاب کنید.</b>",
    tr: "🌐 <b>Dilinizi seçin.</b>",
    hi: "🌐 <b>अपनी भाषा चुनें।</b>"
  },

  languageChanged: {
    en: "✅ Language changed to <b>English</b>.",
    ru: "✅ Язык изменён на <b>русский</b>.",
    uz: "✅ Til <b>O‘zbek</b> tiliga o‘zgartirildi.",
    id: "✅ Bahasa diubah ke <b>Bahasa Indonesia</b>.",
    ar: "✅ تم تغيير اللغة إلى <b>العربية</b>.",
    uk: "✅ Мову змінено на <b>українську</b>.",
    fa: "✅ زبان به <b>فارسی</b> تغییر کرد.",
    tr: "✅ Dil <b>Türkçe</b> olarak değiştirildi.",
    hi: "✅ भाषा <b>हिन्दी</b> में बदल दी गई है।"
  },


  chooseLanguage: {
    en: "🌍 Choose language",
    ru: "🌍 Выбрать язык",
    uz: "🌍 Tilni tanlash",
    id: "🌍 Pilih bahasa",
    ar: "🌍 اختر اللغة",
    uk: "🌍 Обрати мову",
    fa: "🌍 انتخاب زبان",
    tr: "🌍 Dil seçin",
    hi: "🌍 भाषा चुनें"
  },


  // ------------------------------------------------
  // WELCOME
  // ------------------------------------------------

  welcomeTitle: {
    en: "🚀 <b>Welcome to instadrop!</b>\nYour simple and fast Instagram downloader.",
    ru: "🚀 <b>Добро пожаловать в instadrop!</b>\nПростой и быстрый загрузчик из Instagram.",
    uz: "🚀 <b>instadrop'ga xush kelibsiz!</b>\nInstagram uchun oddiy va tezkor yuklagich.",
    id: "🚀 <b>Selamat datang di instadrop!</b>\nPengunduh Instagram yang sederhana dan cepat.",
    ar: "🚀 <b>مرحبًا بك في instadrop!</b>\nأداة بسيطة وسريعة لتحميل محتوى Instagram.",
    uk: "🚀 <b>Ласкаво просимо до instadrop!</b>\nПростий і швидкий завантажувач Instagram.",
    fa: "🚀 <b>به instadrop خوش آمدید!</b>\nدانلودر ساده و سریع برای Instagram.",
    tr: "🚀 <b>instadrop'a hoş geldiniz!</b>\nBasit ve hızlı Instagram indiriciniz.",
    hi: "🚀 <b>instadrop में आपका स्वागत है!</b>\nआपका सरल और तेज़ Instagram डाउनलोडर।"
  },


  whatDownload: {
    en: "📥 <b>What can I download?</b>\n• Posts  • Carousels  • Reels\n• Stories  • Highlights  • Profiles",
    ru: "📥 <b>Что можно скачать?</b>\n• Посты  • Карусели  • Reels\n• Истории  • Highlights  • Профили",
    uz: "📥 <b>Nimalarni yuklab olish mumkin?</b>\n• Postlar  • Karusellar  • Reels\n• Hikoyalar  • Highlights  • Profillar",
    id: "📥 <b>Apa yang bisa saya unduh?</b>\n• Postingan  • Carousel  • Reels\n• Story  • Highlight  • Profil",
    ar: "📥 <b>ماذا يمكنني تحميله؟</b>\n• المنشورات  • المنشورات المتعددة  • Reels\n• القصص  • Highlights  • الملفات الشخصية",
    uk: "📥 <b>Що можна завантажити?</b>\n• Дописи  • Каруселі  • Reels\n• Історії  • Highlights  • Профілі",
    fa: "📥 <b>چه چیزهایی را می‌توانم دانلود کنم؟</b>\n• پست‌ها  • کاروسل‌ها  • Reels\n• استوری‌ها  • Highlights  • پروفایل‌ها",
    tr: "📥 <b>Neleri indirebilirim?</b>\n• Gönderiler  • Carousel  • Reels\n• Hikâyeler  • Highlights  • Profiller",
    hi: "📥 <b>मैं क्या डाउनलोड कर सकता हूँ?</b>\n• पोस्ट  • कैरोसेल  • Reels\n• स्टोरीज़  • Highlights  • प्रोफ़ाइल"
  },


  profileSupport: {
    en: "👤 <b>Profile support</b>\n• Profile picture  • Account details\n• Followers &amp; following  • Post count\n• Name &amp; bio  • Verification status\n• Private account status",
    ru: "👤 <b>Поддержка профилей</b>\n• Фото профиля  • Данные аккаунта\n• Подписчики и подписки  • Количество постов\n• Имя и био  • Статус верификации\n• Статус приватного аккаунта",
    uz: "👤 <b>Profil qo‘llab-quvvatlashi</b>\n• Profil rasmi  • Hisob ma’lumotlari\n• Obunachilar va obunalar  • Postlar soni\n• Ism va bio  • Tasdiqlash holati\n• Yopiq akkaunt holati",
    id: "👤 <b>Dukungan profil</b>\n• Foto profil  • Detail akun\n• Pengikut &amp; mengikuti  • Jumlah postingan\n• Nama &amp; bio  • Status verifikasi\n• Status akun privat",
    ar: "👤 <b>دعم الملفات الشخصية</b>\n• صورة الملف الشخصي  • تفاصيل الحساب\n• المتابعون والمتابَعون  • عدد المنشورات\n• الاسم والسيرة الذاتية  • حالة التحقق\n• حالة الحساب الخاص",
    uk: "👤 <b>Підтримка профілів</b>\n• Фото профілю  • Дані акаунта\n• Підписники та підписки  • Кількість дописів\n• Ім'я та біо  • Статус верифікації\n• Статус приватного акаунта",
    fa: "👤 <b>پشتیبانی از پروفایل</b>\n• عکس پروفایل  • اطلاعات حساب\n• دنبال‌کنندگان و دنبال‌شده‌ها  • تعداد پست‌ها\n• نام و بیو  • وضعیت تأیید\n• وضعیت حساب خصوصی",
    tr: "👤 <b>Profil desteği</b>\n• Profil fotoğrafı  • Hesap bilgileri\n• Takipçiler &amp; takip edilenler  • Gönderi sayısı\n• İsim &amp; bio  • Doğrulama durumu\n• Gizli hesap durumu",
    hi: "👤 <b>प्रोफ़ाइल सपोर्ट</b>\n• प्रोफ़ाइल फोटो  • अकाउंट विवरण\n• फ़ॉलोअर्स और फ़ॉलोइंग  • पोस्ट की संख्या\n• नाम और बायो  • वेरिफिकेशन स्थिति\n• प्राइवेट अकाउंट स्थिति"
  },


  mediaDetails: {
    en: "🖼️ <b>Media details</b>\n• Username  • Caption\n• Upload date  • Likes\n• Comments  • Views\n• Plays  • Reshares",
    ru: "🖼️ <b>Данные медиа</b>\n• Имя пользователя  • Описание\n• Дата загрузки  • Лайки\n• Комментарии  • Просмотры\n• Воспроизведения  • Репосты",
    uz: "🖼️ <b>Media ma’lumotlari</b>\n• Foydalanuvchi nomi  • Izoh\n• Yuklangan sana  • Layklar\n• Izohlar  • Ko‘rishlar\n• Ko‘rishlar soni  • Ulashishlar",
    id: "🖼️ <b>Detail media</b>\n• Nama pengguna  • Caption\n• Tanggal unggah  • Suka\n• Komentar  • Tayangan\n• Pemutaran  • Bagikan ulang",
    ar: "🖼️ <b>تفاصيل الوسائط</b>\n• اسم المستخدم  • الوصف\n• تاريخ الرفع  • الإعجابات\n• التعليقات  • المشاهدات\n• مرات التشغيل  • إعادة المشاركة",
    uk: "🖼️ <b>Деталі медіа</b>\n• Ім'я користувача  • Підпис\n• Дата завантаження  • Вподобання\n• Коментарі  • Перегляди\n• Відтворення  • Репости",
    fa: "🖼️ <b>جزئیات رسانه</b>\n• نام کاربری  • کپشن\n• تاریخ انتشار  • لایک‌ها\n• نظرات  • بازدیدها\n• پخش‌ها  • بازنشرها",
    tr: "🖼️ <b>Medya detayları</b>\n• Kullanıcı adı  • Açıklama\n• Yükleme tarihi  • Beğeniler\n• Yorumlar  • Görüntülenmeler\n• Oynatmalar  • Yeniden paylaşımlar",
    hi: "🖼️ <b>मीडिया विवरण</b>\n• यूज़रनेम  • कैप्शन\n• अपलोड की तारीख  • लाइक्स\n• कमेंट्स  • व्यूज़\n• प्लेज़  • रीशेयर्स"
  },


  howToUse: {
    en: "<b>How to use:</b>\nJust copy an Instagram link and send it here.\n\nNo complicated steps. Just send the link!",
    ru: "<b>Как использовать:</b>\nПросто скопируйте ссылку Instagram и отправьте её сюда.\n\nНикаких сложных действий. Просто отправьте ссылку!",
    uz: "<b>Qanday foydalaniladi:</b>\nInstagram havolasini nusxalab, shu yerga yuboring.\n\nHech qanday murakkab qadamlar yo‘q. Havolani yuboring!",
    id: "<b>Cara menggunakan:</b>\nCukup salin tautan Instagram dan kirim ke sini.\n\nTidak ada langkah rumit. Kirim tautannya!",
    ar: "<b>طريقة الاستخدام:</b>\nانسخ رابط Instagram وأرسله هنا.\n\nلا توجد خطوات معقدة. أرسل الرابط فقط!",
    uk: "<b>Як користуватися:</b>\nПросто скопіюйте посилання Instagram і надішліть його сюди.\n\nЖодних складних дій. Просто надішліть посилання!",
    fa: "<b>نحوه استفاده:</b>\nفقط لینک Instagram را کپی کرده و اینجا ارسال کنید.\n\nهیچ مرحله پیچیده‌ای وجود ندارد. فقط لینک را ارسال کنید!",
    tr: "<b>Nasıl kullanılır:</b>\nInstagram bağlantısını kopyalayıp buraya gönderin.\n\nKarmaşık bir işlem yok. Sadece bağlantıyı gönderin!",
    hi: "<b>कैसे उपयोग करें:</b>\nबस Instagram लिंक कॉपी करके यहाँ भेजें।\n\nकोई जटिल प्रक्रिया नहीं। बस लिंक भेजें!"
  },


  // ------------------------------------------------
  // STATUS
  // ------------------------------------------------

  working: {
    en: "⏳ <b>Working on it...</b>\n\n🔎 Reading the Instagram link and preparing your media.",
    ru: "⏳ <b>Обрабатываю...</b>\n\n🔎 Читаю ссылку Instagram и подготавливаю медиа.",
    uz: "⏳ <b>Ishlayapman...</b>\n\n🔎 Instagram havolasi o‘qilmoqda va media tayyorlanmoqda.",
    id: "⏳ <b>Sedang memproses...</b>\n\n🔎 Membaca tautan Instagram dan menyiapkan media Anda.",
    ar: "⏳ <b>جارٍ المعالجة...</b>\n\n🔎 أقرأ رابط Instagram وأجهز الوسائط الخاصة بك.",
    uk: "⏳ <b>Обробляю...</b>\n\n🔎 Читаю посилання Instagram і готую медіа.",
    fa: "⏳ <b>در حال پردازش...</b>\n\n🔎 لینک Instagram در حال بررسی و رسانه شما در حال آماده‌سازی است.",
    tr: "⏳ <b>İşleniyor...</b>\n\n🔎 Instagram bağlantısı okunuyor ve medyanız hazırlanıyor.",
    hi: "⏳ <b>काम हो रहा है...</b>\n\n🔎 Instagram लिंक पढ़ा जा रहा है और आपका मीडिया तैयार किया जा रहा है।"
  },


  // ------------------------------------------------
  // GENERAL ERRORS
  // ------------------------------------------------

  serviceUnreachable: {
    en: "❌ <b>I couldn't reach the download service.</b>\n\nPlease check the Instagram link and try again in a moment.",
    ru: "❌ <b>Не удалось связаться с сервисом загрузки.</b>\n\nПроверьте ссылку Instagram и попробуйте ещё раз.",
    uz: "❌ <b>Yuklab olish xizmatiga ulanib bo‘lmadi.</b>\n\nInstagram havolasini tekshirib, birozdan keyin qayta urinib ko‘ring.",
    id: "❌ <b>Saya tidak dapat terhubung ke layanan unduhan.</b>\n\nPeriksa tautan Instagram dan coba lagi sebentar lagi.",
    ar: "❌ <b>تعذر الاتصال بخدمة التحميل.</b>\n\nتحقق من رابط Instagram وحاول مرة أخرى بعد قليل.",
    uk: "❌ <b>Не вдалося підключитися до сервісу завантаження.</b>\n\nПеревірте посилання Instagram і спробуйте ще раз.",
    fa: "❌ <b>نتوانستم به سرویس دانلود متصل شوم.</b>\n\nلینک Instagram را بررسی کنید و دوباره تلاش کنید.",
    tr: "❌ <b>İndirme hizmetine ulaşılamadı.</b>\n\nInstagram bağlantısını kontrol edip biraz sonra tekrar deneyin.",
    hi: "❌ <b>डाउनलोड सेवा से कनेक्ट नहीं हो सका।</b>\n\nInstagram लिंक जाँचें और थोड़ी देर बाद फिर कोशिश करें।"
  },


  unexpectedResponse: {
    en: "⚠️ <b>The download service returned an unexpected response.</b>\n\nPlease try the Instagram link again.",
    ru: "⚠️ <b>Сервис загрузки вернул неожиданный ответ.</b>\n\nПопробуйте отправить ссылку Instagram ещё раз.",
    uz: "⚠️ <b>Yuklab olish xizmati kutilmagan javob qaytardi.</b>\n\nInstagram havolasini qayta yuborib ko‘ring.",
    id: "⚠️ <b>Layanan unduhan memberikan respons yang tidak terduga.</b>\n\nCoba kirim kembali tautan Instagram.",
    ar: "⚠️ <b>أعادت خدمة التحميل استجابة غير متوقعة.</b>\n\nحاول إرسال رابط Instagram مرة أخرى.",
    uk: "⚠️ <b>Сервіс завантаження повернув неочікувану відповідь.</b>\n\nСпробуйте надіслати посилання Instagram ще раз.",
    fa: "⚠️ <b>سرویس دانلود پاسخ غیرمنتظره‌ای برگرداند.</b>\n\nلینک Instagram را دوباره ارسال کنید.",
    tr: "⚠️ <b>İndirme hizmeti beklenmeyen bir yanıt verdi.</b>\n\nInstagram bağlantısını tekrar deneyin.",
    hi: "⚠️ <b>डाउनलोड सेवा ने अप्रत्याशित जवाब दिया।</b>\n\nInstagram लिंक फिर से भेजें।"
  },


  mediaNotFound: {
    en: "❌ <b>I couldn't find any downloadable media in that Instagram post.</b>\n\nPlease check the link and try again.",
    ru: "❌ <b>Не удалось найти загружаемые медиа в этом посте Instagram.</b>\n\nПроверьте ссылку и попробуйте ещё раз.",
    uz: "❌ <b>Ushbu Instagram postida yuklab olinadigan media topilmadi.</b>\n\nHavolani tekshirib, qayta urinib ko‘ring.",
    id: "❌ <b>Saya tidak menemukan media yang dapat diunduh di postingan Instagram tersebut.</b>\n\nPeriksa tautannya dan coba lagi.",
    ar: "❌ <b>لم أتمكن من العثور على وسائط قابلة للتحميل في منشور Instagram.</b>\n\nتحقق من الرابط وحاول مرة أخرى.",
    uk: "❌ <b>Не вдалося знайти медіа для завантаження в цьому дописі Instagram.</b>\n\nПеревірте посилання та спробуйте ще раз.",
    fa: "❌ <b>رسانه قابل دانلودی در این پست Instagram پیدا نشد.</b>\n\nلینک را بررسی کرده و دوباره تلاش کنید.",
    tr: "❌ <b>Bu Instagram gönderisinde indirilebilir medya bulunamadı.</b>\n\nBağlantıyı kontrol edip tekrar deneyin.",
    hi: "❌ <b>इस Instagram पोस्ट में कोई डाउनलोड करने योग्य मीडिया नहीं मिला।</b>\n\nलिंक जाँचें और फिर कोशिश करें।"
  },


  noVideo: {
    en: "❌ <b>I couldn't find a downloadable video in this reel.</b>\n\nPlease try the reel link again.",
    ru: "❌ <b>Не удалось найти загружаемое видео в этом Reels.</b>\n\nПопробуйте отправить ссылку ещё раз.",
    uz: "❌ <b>Ushbu Reels'da yuklab olinadigan video topilmadi.</b>\n\nReels havolasini qayta yuboring.",
    id: "❌ <b>Saya tidak menemukan video yang dapat diunduh di reel ini.</b>\n\nCoba kirim tautan reel lagi.",
    ar: "❌ <b>لم أتمكن من العثور على فيديو قابل للتحميل في هذا الـReel.</b>\n\nحاول إرسال رابط الـReel مرة أخرى.",
    uk: "❌ <b>Не вдалося знайти відео для завантаження в цьому Reels.</b>\n\nСпробуйте надіслати посилання ще раз.",
    fa: "❌ <b>ویدیوی قابل دانلودی در این Reel پیدا نشد.</b>\n\nلینک Reel را دوباره ارسال کنید.",
    tr: "❌ <b>Bu reel'de indirilebilir video bulunamadı.</b>\n\nReel bağlantısını tekrar deneyin.",
    hi: "❌ <b>इस Reel में कोई डाउनलोड करने योग्य वीडियो नहीं मिला।</b>\n\nReel लिंक फिर से भेजें।"
  },


  unexpected: {
    en: "⚠️ <b>Something unexpected happened while processing your request.</b>\n\nPlease try the Instagram link again. If the problem continues, try again a little later.",
    ru: "⚠️ <b>При обработке запроса произошла непредвиденная ошибка.</b>\n\nПопробуйте отправить ссылку ещё раз. Если проблема останется, повторите попытку позже.",
    uz: "⚠️ <b>So‘rovingizni qayta ishlashda kutilmagan xatolik yuz berdi.</b>\n\nInstagram havolasini qayta yuboring. Muammo davom etsa, birozdan keyin urinib ko‘ring.",
    id: "⚠️ <b>Terjadi sesuatu yang tidak terduga saat memproses permintaan Anda.</b>\n\nCoba kirim tautan Instagram lagi. Jika masalah berlanjut, coba lagi nanti.",
    ar: "⚠️ <b>حدث خطأ غير متوقع أثناء معالجة طلبك.</b>\n\nحاول إرسال رابط Instagram مرة أخرى. إذا استمرت المشكلة، حاول لاحقًا.",
    uk: "⚠️ <b>Під час обробки вашого запиту сталася неочікувана помилка.</b>\n\nСпробуйте надіслати посилання Instagram ще раз. Якщо проблема не зникне, спробуйте пізніше.",
    fa: "⚠️ <b>هنگام پردازش درخواست شما خطای غیرمنتظره‌ای رخ داد.</b>\n\nلینک Instagram را دوباره ارسال کنید. اگر مشکل ادامه داشت، بعداً دوباره تلاش کنید.",
    tr: "⚠️ <b>İsteğiniz işlenirken beklenmeyen bir hata oluştu.</b>\n\nInstagram bağlantısını tekrar deneyin. Sorun devam ederse biraz sonra tekrar deneyin.",
    hi: "⚠️ <b>आपके अनुरोध को प्रोसेस करते समय कुछ अप्रत्याशित हुआ।</b>\n\nInstagram लिंक फिर से भेजें। समस्या बनी रहे तो थोड़ी देर बाद दोबारा कोशिश करें।"
  },


  needInstagram: {
    en: "📎 <b>I need an Instagram link to get started.</b>\n\nSend me the link to a:\n📸 Post\n🖼️ Carousel\n🎬 Reel\n📖 Story\n✨ Highlight\n👤 Profile\n\n💡 Just copy the Instagram URL and paste it here.",
    ru: "📎 <b>Для начала мне нужна ссылка Instagram.</b>\n\nОтправьте ссылку на:\n📸 Пост\n🖼️ Карусель\n🎬 Reels\n📖 Историю\n✨ Highlight\n👤 Профиль\n\n💡 Просто скопируйте ссылку Instagram и отправьте её сюда.",
    uz: "📎 <b>Boshlash uchun Instagram havolasi kerak.</b>\n\nQuyidagilardan birining havolasini yuboring:\n📸 Post\n🖼️ Karusel\n🎬 Reels\n📖 Hikoya\n✨ Highlight\n👤 Profil\n\n💡 Instagram URL manzilini nusxalab shu yerga yuboring.",
    id: "📎 <b>Saya membutuhkan tautan Instagram untuk memulai.</b>\n\nKirim tautan:\n📸 Postingan\n🖼️ Carousel\n🎬 Reel\n📖 Story\n✨ Highlight\n👤 Profil\n\n💡 Salin URL Instagram dan kirim ke sini.",
    ar: "📎 <b>أحتاج إلى رابط Instagram للبدء.</b>\n\nأرسل رابط:\n📸 منشور\n🖼️ منشور متعدد\n🎬 Reel\n📖 قصة\n✨ Highlight\n👤 ملف شخصي\n\n💡 انسخ رابط Instagram وأرسله هنا.",
    uk: "📎 <b>Для початку мені потрібне посилання Instagram.</b>\n\nНадішліть посилання на:\n📸 Допис\n🖼️ Карусель\n🎬 Reels\n📖 Історію\n✨ Highlight\n👤 Профіль\n\n💡 Просто скопіюйте URL Instagram і надішліть його сюди.",
    fa: "📎 <b>برای شروع به لینک Instagram نیاز دارم.</b>\n\nلینک یکی از موارد زیر را ارسال کنید:\n📸 پست\n🖼️ کاروسل\n🎬 Reel\n📖 استوری\n✨ Highlight\n👤 پروفایل\n\n💡 لینک Instagram را کپی کرده و اینجا ارسال کنید.",
    tr: "📎 <b>Başlamak için bir Instagram bağlantısına ihtiyacım var.</b>\n\nŞunlardan birinin bağlantısını gönderin:\n📸 Gönderi\n🖼️ Carousel\n🎬 Reel\n📖 Hikâye\n✨ Highlight\n👤 Profil\n\n💡 Instagram URL'sini kopyalayıp buraya gönderin.",
    hi: "📎 <b>शुरू करने के लिए मुझे Instagram लिंक चाहिए।</b>\n\nइनमें से किसी का लिंक भेजें:\n📸 पोस्ट\n🖼️ कैरोसेल\n🎬 Reel\n📖 स्टोरी\n✨ Highlight\n👤 प्रोफ़ाइल\n\n💡 Instagram URL कॉपी करके यहाँ भेजें।"
  },


  // ------------------------------------------------
  // MEDIA
  // ------------------------------------------------

  downloadReady: {
    en: "✅ <b>Download ready!</b>\n\n📥 Delivered by <b>instadrop</b>",
    ru: "✅ <b>Загрузка готова!</b>\n\n📥 Доставлено через <b>instadrop</b>",
    uz: "✅ <b>Yuklab olish tayyor!</b>\n\n📥 <b>instadrop</b> orqali yuborildi",
    id: "✅ <b>Unduhan siap!</b>\n\n📥 Dikirim oleh <b>instadrop</b>",
    ar: "✅ <b>التحميل جاهز!</b>\n\n📥 تم إرساله بواسطة <b>instadrop</b>",
    uk: "✅ <b>Завантаження готове!</b>\n\n📥 Надіслано через <b>instadrop</b>",
    fa: "✅ <b>دانلود آماده است!</b>\n\n📥 ارسال‌شده توسط <b>instadrop</b>",
    tr: "✅ <b>İndirme hazır!</b>\n\n📥 <b>instadrop</b> tarafından gönderildi",
    hi: "✅ <b>डाउनलोड तैयार है!</b>\n\n📥 <b>instadrop</b> द्वारा भेजा गया"
  },


  coverPhoto: {
    en: "🖼️ <b>Cover Photo</b>\n\n✨ Here is the cover image you requested.",
    ru: "🖼️ <b>Обложка</b>\n\n✨ Вот изображение обложки, которое вы запросили.",
    uz: "🖼️ <b>Muqova rasmi</b>\n\n✨ Siz so‘ragan muqova rasmi.",
    id: "🖼️ <b>Foto Sampul</b>\n\n✨ Berikut gambar sampul yang Anda minta.",
    ar: "🖼️ <b>صورة الغلاف</b>\n\n✨ إليك صورة الغلاف التي طلبتها.",
    uk: "🖼️ <b>Обкладинка</b>\n\n✨ Ось зображення обкладинки, яке ви запитали.",
    fa: "🖼️ <b>تصویر کاور</b>\n\n✨ تصویر کاور موردنظر شما آماده است.",
    tr: "🖼️ <b>Kapak Fotoğrafı</b>\n\n✨ İstediğiniz kapak görseli burada.",
    hi: "🖼️ <b>कवर फोटो</b>\n\n✨ यह वह कवर इमेज है जो आपने माँगी थी।"
  },


  coverExpired: {
    en: "⏰ <b>Sorry, this cover has expired.</b>\n\nPlease send the Instagram link again to generate a fresh copy.",
    ru: "⏰ <b>Извините, срок действия этой обложки истёк.</b>\n\nОтправьте ссылку Instagram ещё раз, чтобы получить новую копию.",
    uz: "⏰ <b>Kechirasiz, bu muqovaning amal qilish muddati tugagan.</b>\n\nYangi nusxa olish uchun Instagram havolasini qayta yuboring.",
    id: "⏰ <b>Maaf, sampul ini sudah kedaluwarsa.</b>\n\nKirim kembali tautan Instagram untuk membuat salinan baru.",
    ar: "⏰ <b>عذرًا، انتهت صلاحية هذه الصورة.</b>\n\nأرسل رابط Instagram مرة أخرى لإنشاء نسخة جديدة.",
    uk: "⏰ <b>На жаль, термін дії цієї обкладинки минув.</b>\n\nНадішліть посилання Instagram ще раз, щоб отримати нову копію.",
    fa: "⏰ <b>متأسفانه، این کاور منقضی شده است.</b>\n\nلینک Instagram را دوباره ارسال کنید تا نسخه جدید ایجاد شود.",
    tr: "⏰ <b>Üzgünüz, bu kapak görselinin süresi doldu.</b>\n\nYeni bir kopya oluşturmak için Instagram bağlantısını tekrar gönderin.",
    hi: "⏰ <b>माफ़ करें, इस कवर की समय सीमा समाप्त हो गई है।</b>\n\nनई कॉपी बनाने के लिए Instagram लिंक फिर से भेजें।"
  },


  detailsTitle: {
    en: "📋 <b>Media Details</b>",
    ru: "📋 <b>Данные медиа</b>",
    uz: "📋 <b>Media ma’lumotlari</b>",
    id: "📋 <b>Detail Media</b>",
    ar: "📋 <b>تفاصيل الوسائط</b>",
    uk: "📋 <b>Деталі медіа</b>",
    fa: "📋 <b>جزئیات رسانه</b>",
    tr: "📋 <b>Medya Detayları</b>",
    hi: "📋 <b>मीडिया विवरण</b>"
  },


  noDetails: {
    en: "ℹ️ No additional details are available for this media.",
    ru: "ℹ️ Дополнительные данные для этого медиа недоступны.",
    uz: "ℹ️ Bu media uchun qo‘shimcha ma’lumot mavjud emas.",
    id: "ℹ️ Tidak ada detail tambahan untuk media ini.",
    ar: "ℹ️ لا تتوفر تفاصيل إضافية لهذه الوسائط.",
    uk: "ℹ️ Додаткові відомості про це медіа недоступні.",
    fa: "ℹ️ اطلاعات بیشتری برای این رسانه موجود نیست.",
    tr: "ℹ️ Bu medya için ek bilgi bulunmuyor.",
    hi: "ℹ️ इस मीडिया के लिए कोई अतिरिक्त विवरण उपलब्ध नहीं है।"
  },


  detailsExpired: {
    en: "⏰ <b>Sorry, these details have expired.</b>\n\nPlease send the Instagram link again to get fresh information.",
    ru: "⏰ <b>Извините, срок действия этих данных истёк.</b>\n\nОтправьте ссылку Instagram ещё раз, чтобы получить свежую информацию.",
    uz: "⏰ <b>Kechirasiz, bu ma’lumotlarning amal qilish muddati tugagan.</b>\n\nYangi ma’lumot olish uchun Instagram havolasini qayta yuboring.",
    id: "⏰ <b>Maaf, detail ini sudah kedaluwarsa.</b>\n\nKirim kembali tautan Instagram untuk mendapatkan informasi terbaru.",
    ar: "⏰ <b>عذرًا، انتهت صلاحية هذه التفاصيل.</b>\n\nأرسل رابط Instagram مرة أخرى للحصول على معلومات جديدة.",
    uk: "⏰ <b>На жаль, термін дії цих даних минув.</b>\n\nНадішліть посилання Instagram ще раз, щоб отримати свіжу інформацію.",
    fa: "⏰ <b>متأسفانه، این اطلاعات منقضی شده‌اند.</b>\n\nلینک Instagram را دوباره ارسال کنید تا اطلاعات جدید دریافت کنید.",
    tr: "⏰ <b>Üzgünüz, bu detayların süresi doldu.</b>\n\nGüncel bilgi almak için Instagram bağlantısını tekrar gönderin.",
    hi: "⏰ <b>माफ़ करें, इन विवरणों की समय सीमा समाप्त हो गई है।</b>\n\nनई जानकारी पाने के लिए Instagram लिंक फिर से भेजें।"
  }

};


// ==================================================
// LANGUAGE HELPERS
// ==================================================

function getLanguage(chatId) {
  if (!chatId) return "en";

  return userLanguages.get(String(chatId)) || "en";
}


function setLanguage(chatId, language) {
  if (!chatId) return;

  if (!LANGUAGES[language]) {
    language = "en";
  }

  userLanguages.set(
    String(chatId),
    language
  );
}


function t(key, chatId) {
  const language = getLanguage(chatId);

  return (
    TEXT[key]?.[language] ||
    TEXT[key]?.en ||
    ""
  );
}


function languageKeyboard() {
  return {
    inline_keyboard: [
      [
        {
          text: "🇬🇧 English",
          callback_data: "lang:en"
        }
      ],
      [
        {
          text: "🇷🇺 Русский",
          callback_data: "lang:ru"
        }
      ],
      [
        {
          text: "🇺🇿 O‘zbek",
          callback_data: "lang:uz"
        }
      ],
      [
        {
          text: "🇮🇩 Bahasa Indonesia",
          callback_data: "lang:id"
        }
      ],
      [
        {
          text: "🇸🇦 العربية",
          callback_data: "lang:ar"
        }
      ],
      [
        {
          text: "🇺🇦 Українська",
          callback_data: "lang:uk"
        }
      ],
      [
        {
          text: "🇮🇷 فارسی",
          callback_data: "lang:fa"
        }
      ],
      [
        {
          text: "🇹🇷 Türkçe",
          callback_data: "lang:tr"
        }
      ],
      [
        {
          text: "🇮🇳 हिन्दी",
          callback_data: "lang:hi"
        }
      ]
    ]
  };
}


// ==================================================
// TELEGRAM API
// ==================================================

async function telegram(method, payload) {

  const response = await fetch(
    `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/${method}`,
    {
      method: "POST",

      headers: {
        "Content-Type": "application/json"
      },

      body: JSON.stringify(payload)
    }
  );

  let result;

  try {

    result = await response.json();

  } catch {

    throw new Error(
      `Telegram returned invalid JSON (${response.status})`
    );

  }

  if (!response.ok || !result.ok) {

    throw new Error(
      result?.description ||
      `Telegram API error (${response.status})`
    );

  }

  return result;
}


// ==================================================
// BASIC HELPERS
// ==================================================

function isValidUrl(value) {

  return (
    typeof value === "string" &&
    /^https?:\/\//i.test(value)
  );

}


function cleanInstagramUrl(url) {

  if (!url) return null;

  return url
    .trim()
    .replace(/[)\]}>.,!?]+$/g, "");

}


function findInstagramUrl(text) {

  if (!text) return null;

  const match = text.match(
    /https?:\/\/(?:www\.)?instagram\.com\/[^\s]+/i
  );

  if (!match) return null;

  return cleanInstagramUrl(
    match[0]
  );

}


// ==================================================
// GENERIC LINK DETECTION
// ==================================================

function findAnyUrl(text) {

  if (!text) return null;

  const match = text.match(
    /https?:\/\/[^\s<>"']+/i
  );

  if (!match) return null;

  return match[0]
    .trim()
    .replace(/[)\]}>.,!?]+$/g, "");

}


// ==================================================
// HEART REACTION
// ==================================================

async function reactToLink(
  chatId,
  messageId
) {

  if (!chatId || !messageId) {
    return;
  }

  try {

    await telegram(
      "setMessageReaction",
      {
        chat_id: chatId,

        message_id: messageId,

        reaction: [
          {
            type: "emoji",
            emoji: "❤"
          }
        ],

        is_big: false
      }
    );

  } catch (error) {

    console.error(
      "Heart reaction failed:",
      error.message
    );

  }

}


function normalizeUsername(username) {

  if (!username) return null;

  const value =
    String(username).trim();

  if (!value) return null;

  return value.startsWith("@")
    ? value
    : `@${value}`;

}


function createStorageId() {

  return (
    Date.now().toString(36) +
    Math.random()
      .toString(36)
      .slice(2, 8)
  );

}


function truncate(
  text,
  maxLength = 3900
) {

  if (!text) return "";

  const value =
    String(text);

  if (
    value.length <= maxLength
  ) {

    return value;

  }

  return (
    value.slice(
      0,
      maxLength - 3
    ) +
    "..."
  );

}


function cleanupStorage() {

  const now = Date.now();

  for (
    const [id, item]
    of mediaStorage.entries()
  ) {

    if (
      !item ||
      !item.createdAt ||
      now - item.createdAt >
        STORAGE_TTL
    ) {

      mediaStorage.delete(id);

    }

  }

}


// ==================================================
// RESPONSE TYPE
// ==================================================

function getResponseType(data) {

  if (
    !data ||
    typeof data !== "object"
  ) {

    return "post";

  }

  const type =
    String(
      data.type ||
      data.media_type ||
      data.mediaType ||
      ""
    ).toLowerCase();

  if (
    type === "highlight" ||
    type === "highlights"
  ) {

    return "highlight";

  }

  if (
    type === "story" ||
    type === "stories"
  ) {

    return "story";

  }

  if (
    type === "reel" ||
    type === "reels"
  ) {

    return "reel";

  }

  if (
    Array.isArray(data.items)
  ) {

    return "collection";

  }

  return "post";

}


// ==================================================
// REEL DETECTION
// ==================================================

function isReelResponse(data) {

  if (
    !data ||
    typeof data !== "object"
  ) {

    return false;

  }

  const type =
    String(
      data.type ||
      data.media_type ||
      data.mediaType ||
      ""
    ).toLowerCase();

  if (
    type === "highlight" ||
    type === "highlights" ||
    type === "story" ||
    type === "stories"
  ) {

    return false;

  }

  if (
    Array.isArray(data.items)
  ) {

    return false;

  }

  if (
    type === "reel" ||
    type === "reels"
  ) {

    return true;

  }

  if (
    Array.isArray(data.video) &&
    data.video.some(
      item =>
        item &&
        typeof item === "object" &&
        (
          typeof item.video === "string" ||
          typeof item.url === "string"
        )
    )
  ) {

    return true;

  }

  if (
    typeof data.video === "string" &&
    typeof data.cover === "string"
  ) {

    return true;

  }

  return false;

}


// ==================================================
// VIDEO HELPERS
// ==================================================

function getVideoUrlFromObject(item) {

  if (
    !item ||
    typeof item !== "object"
  ) {

    return null;

  }

  const url =
    item.video ||
    item.url ||
    item.download_url ||
    item.downloadUrl ||
    item.media_url ||
    item.mediaUrl ||
    item.video_url ||
    item.videoUrl ||
    item.src;

  return isValidUrl(url)
    ? url
    : null;

}


function getCoverFromObject(item) {

  if (
    !item ||
    typeof item !== "object"
  ) {

    return null;

  }

  const cover =
    item.cover ||
    item.cover_url ||
    item.coverUrl ||
    item.thumbnail ||
    item.thumbnail_url ||
    item.thumbnailUrl ||
    item.thumb ||
    item.poster ||
    item.poster_url ||
    item.posterUrl;

  return isValidUrl(cover)
    ? cover
    : null;

}


function getReelVideo(data) {

  if (!data) return null;

  if (
    Array.isArray(data.video)
  ) {

    for (
      const item
      of data.video
    ) {

      if (
        typeof item === "string"
      ) {

        if (
          isValidUrl(item)
        ) {

          return item;

        }

      }

      if (
        item &&
        typeof item === "object"
      ) {

        const url =
          getVideoUrlFromObject(
            item
          );

        if (url) {
          return url;
        }

      }

    }

  }

  if (
    data.video &&
    typeof data.video === "object"
  ) {

    const url =
      getVideoUrlFromObject(
        data.video
      );

    if (url) {
      return url;
    }

  }

  if (
    typeof data.video === "string" &&
    isValidUrl(data.video)
  ) {

    return data.video;

  }

  return null;

}


function getCoverUrl(data) {

  if (!data) return null;

  if (
    isValidUrl(data.cover)
  ) {

    return data.cover;

  }

  if (
    isValidUrl(data.cover_url)
  ) {

    return data.cover_url;

  }

  if (
    isValidUrl(data.coverUrl)
  ) {

    return data.coverUrl;

  }

  if (
    Array.isArray(data.video)
  ) {

    for (
      const item
      of data.video
    ) {

      const cover =
        getCoverFromObject(
          item
        );

      if (cover) {
        return cover;
      }

    }

  }

  if (
    data.video &&
    typeof data.video === "object"
  ) {

    const cover =
      getCoverFromObject(
        data.video
      );

    if (cover) {
      return cover;
    }

  }

  return null;

}


// ==================================================
// COLLECTION COVER
// ==================================================

function getCollectionCover(
  data,
  responseType
) {

  if (!data) return null;

  if (
    responseType === "highlight"
  ) {

    const cover =
      data.highlight_cover ||
      data.highlightCover;

    return isValidUrl(cover)
      ? cover
      : null;

  }

  if (
    responseType === "story"
  ) {

    const cover =
      data.story_cover ||
      data.storyCover ||
      data.cover;

    return isValidUrl(cover)
      ? cover
      : null;

  }

  return null;

}


// ==================================================
// MEDIA EXTRACTION
// ==================================================

function extractMediaItems(data) {

  const results = [];

  if (
    !data ||
    typeof data !== "object"
  ) {

    return results;

  }

  if (
    Array.isArray(data.items)
  ) {

    for (
      const item
      of data.items
    ) {

      if (
        !item ||
        typeof item !== "object"
      ) {

        continue;

      }

      const nested =
        extractMediaItems(
          item
        );

      for (
        const media
        of nested
      ) {

        results.push(media);

      }

    }

  }


  // IMAGE ARRAY

  if (
    Array.isArray(data.image)
  ) {

    for (
      const image
      of data.image
    ) {

      if (
        typeof image === "string"
      ) {

        if (
          isValidUrl(image)
        ) {

          results.push({
            url: image,
            type: "photo",
            cover: null
          });

        }

        continue;

      }

      if (
        image &&
        typeof image === "object"
      ) {

        const imageUrl =
          image.image ||
          image.url ||
          image.media_url ||
          image.mediaUrl ||
          image.src;

        if (
          isValidUrl(imageUrl)
        ) {

          results.push({
            url: imageUrl,
            type: "photo",
            cover:
              getCoverFromObject(
                image
              )
          });

        }

      }

    }

  }


  // SINGLE IMAGE

  if (
    typeof data.image === "string" &&
    isValidUrl(data.image)
  ) {

    results.push({
      url: data.image,
      type: "photo",
      cover: getCoverUrl(data)
    });

  }


  // IMAGE OBJECT

  if (
    data.image &&
    typeof data.image === "object" &&
    !Array.isArray(data.image)
  ) {

    const imageUrl =
      data.image.image ||
      data.image.url ||
      data.image.media_url ||
      data.image.mediaUrl ||
      data.image.src;

    if (
      isValidUrl(imageUrl)
    ) {

      results.push({
        url: imageUrl,
        type: "photo",
        cover:
          getCoverFromObject(
            data.image
          )
      });

    }

  }


  // VIDEO ARRAY

  if (
    Array.isArray(data.video)
  ) {

    for (
      const video
      of data.video
    ) {

      if (
        typeof video === "string"
      ) {

        if (
          isValidUrl(video)
        ) {

          results.push({
            url: video,
            type: "video",
            cover: null
          });

        }

        continue;

      }

      if (
        video &&
        typeof video === "object"
      ) {

        const videoUrl =
          getVideoUrlFromObject(
            video
          );

        if (
          videoUrl
        ) {

          results.push({
            url: videoUrl,
            type: "video",
            cover:
              getCoverFromObject(
                video
              )
          });

        }

      }

    }

  }


  // VIDEO OBJECT

  if (
    data.video &&
    typeof data.video === "object" &&
    !Array.isArray(data.video)
  ) {

    const videoUrl =
      getVideoUrlFromObject(
        data.video
      );

    if (
      videoUrl
    ) {

      results.push({
        url: videoUrl,
        type: "video",
        cover:
          getCoverFromObject(
            data.video
          )
      });

    }

  }


  // VIDEO STRING

  if (
    typeof data.video === "string" &&
    isValidUrl(data.video)
  ) {

    results.push({
      url: data.video,
      type: "video",
      cover: getCoverUrl(data)
    });

  }


  return results;

}


// ==================================================
// STORAGE
// ==================================================

function storeMedia({
  cover = null,
  data = null,
  parent = null,
  kind = "media"
}) {

  cleanupStorage();

  const id =
    createStorageId();

  mediaStorage.set(
    id,
    {
      cover:
        isValidUrl(cover)
          ? cover
          : null,

      data,

      parent,

      kind,

      createdAt:
        Date.now()
    }
  );

  return id;

}


// ==================================================
// BUTTONS
// ==================================================

function buildMediaKeyboard(
  storageId,
  hasCover
) {

  const buttons = [];

  if (
    hasCover
  ) {

    buttons.push([
      {
        text:
          "🖼️ Get Cover Photo",

        callback_data:
          `get_cover:${storageId}`
      }
    ]);

  }

  buttons.push([
    {
      text:
        "📋 Get Details",

      callback_data:
        `get_details:${storageId}`
    }
  ]);

  return {
    inline_keyboard:
      buttons
  };

}


// ==================================================
// DETAILS
// ==================================================

function formatDetails(
  data,
  parent = null,
  chatId = null
) {

  if (
    !data ||
    typeof data !== "object"
  ) {

    return t(
      "noDetails",
      chatId
    );

  }

  const lines = [];

  const language =
    getLanguage(chatId);


  if (
    parent &&
    getResponseType(parent) ===
      "highlight"
  ) {

    const title =
      parent.highlight_title ||
      "Untitled";

    const titles = {
      en: "✨ Highlight",
      ru: "✨ Highlight",
      uz: "✨ Highlight",
      id: "✨ Highlight",
      ar: "✨ Highlight",
      uk: "✨ Highlight",
      fa: "✨ Highlight",
      tr: "✨ Highlight",
      hi: "✨ Highlight"
    };

    lines.push(
      `${titles[language]}: ${title}`
    );

  }


  if (
    parent &&
    getResponseType(parent) ===
      "story"
  ) {

    const storyNames = {
      en: "📖 Story",
      ru: "📖 История",
      uz: "📖 Hikoya",
      id: "📖 Story",
      ar: "📖 قصة",
      uk: "📖 Історія",
      fa: "📖 استوری",
      tr: "📖 Hikâye",
      hi: "📖 स्टोरी"
    };

    lines.push(
      storyNames[language]
    );

  }


  const username =
    normalizeUsername(
      data.username ||
      data.user ||
      data.author
    );

  if (username) {

    const labels = {
      en: "👤 Username",
      ru: "👤 Имя пользователя",
      uz: "👤 Foydalanuvchi",
      id: "👤 Nama pengguna",
      ar: "👤 اسم المستخدم",
      uk: "👤 Ім'я користувача",
      fa: "👤 نام کاربری",
      tr: "👤 Kullanıcı adı",
      hi: "👤 यूज़रनेम"
    };

    lines.push(
      `${labels[language]}: ${username}`
    );

  }


  if (data.full_name) {

    const labels = {
      en: "📛 Name",
      ru: "📛 Имя",
      uz: "📛 Ism",
      id: "📛 Nama",
      ar: "📛 الاسم",
      uk: "📛 Ім'я",
      fa: "📛 نام",
      tr: "📛 İsim",
      hi: "📛 नाम"
    };

    lines.push(
      `${labels[language]}: ${data.full_name}`
    );

  }


  if (data.bio) {

    const labels = {
      en: "📝 Bio",
      ru: "📝 Био",
      uz: "📝 Bio",
      id: "📝 Bio",
      ar: "📝 السيرة الذاتية",
      uk: "📝 Біо",
      fa: "📝 بیو",
      tr: "📝 Bio",
      hi: "📝 बायो"
    };

    lines.push("");

    lines.push(
      `${labels[language]}:`
    );

    lines.push(
      truncate(
        data.bio,
        1000
      )
    );

  }


  if (
    data.follower_count !==
      undefined &&
    data.follower_count !== null
  ) {

    const labels = {
      en: "👥 Followers",
      ru: "👥 Подписчики",
      uz: "👥 Obunachilar",
      id: "👥 Pengikut",
      ar: "👥 المتابعون",
      uk: "👥 Підписники",
      fa: "👥 دنبال‌کنندگان",
      tr: "👥 Takipçiler",
      hi: "👥 फ़ॉलोअर्स"
    };

    lines.push(
      `${labels[language]}: ${data.follower_count}`
    );

  }


  if (
    data.following_count !==
      undefined &&
    data.following_count !== null
  ) {

    const labels = {
      en: "👤 Following",
      ru: "👤 Подписки",
      uz: "👤 Obunalar",
      id: "👤 Mengikuti",
      ar: "👤 المتابَعون",
      uk: "👤 Підписки",
      fa: "👤 دنبال‌شده‌ها",
      tr: "👤 Takip edilen",
      hi: "👤 फ़ॉलोइंग"
    };

    lines.push(
      `${labels[language]}: ${data.following_count}`
    );

  }


  if (
    data.post_count !==
      undefined &&
    data.post_count !== null
  ) {

    const labels = {
      en: "📦 Posts",
      ru: "📦 Посты",
      uz: "📦 Postlar",
      id: "📦 Postingan",
      ar: "📦 المنشورات",
      uk: "📦 Дописи",
      fa: "📦 پست‌ها",
      tr: "📦 Gönderiler",
      hi: "📦 पोस्ट"
    };

    lines.push(
      `${labels[language]}: ${data.post_count}`
    );

  }


  if (data.is_verified) {

    const verified = {
      en: "✅ Verified",
      ru: "✅ Верифицирован",
      uz: "✅ Tasdiqlangan",
      id: "✅ Terverifikasi",
      ar: "✅ تم التحقق",
      uk: "✅ Верифіковано",
      fa: "✅ تأیید شده",
      tr: "✅ Doğrulanmış",
      hi: "✅ वेरिफाइड"
    };

    lines.push(
      verified[language]
    );

  }


  if (data.is_private) {

    const privateText = {
      en: "🔒 Private Account",
      ru: "🔒 Приватный аккаунт",
      uz: "🔒 Yopiq akkaunt",
      id: "🔒 Akun Privat",
      ar: "🔒 حساب خاص",
      uk: "🔒 Приватний акаунт",
      fa: "🔒 حساب خصوصی",
      tr: "🔒 Gizli Hesap",
      hi: "🔒 प्राइवेट अकाउंट"
    };

    lines.push(
      privateText[language]
    );

  }


  if (data.caption) {

    const labels = {
      en: "📝 Caption",
      ru: "📝 Описание",
      uz: "📝 Izoh",
      id: "📝 Caption",
      ar: "📝 الوصف",
      uk: "📝 Підпис",
      fa: "📝 کپشن",
      tr: "📝 Açıklama",
      hi: "📝 कैप्शन"
    };

    lines.push("");

    lines.push(
      `${labels[language]}:`
    );

    lines.push(
      truncate(
        data.caption,
        2500
      )
    );

  }


  if (data.taken_at) {

    const labels = {
      en: "📅 Taken",
      ru: "📅 Дата",
      uz: "📅 Sana",
      id: "📅 Diambil",
      ar: "📅 التاريخ",
      uk: "📅 Дата",
      fa: "📅 تاریخ",
      tr: "📅 Tarih",
      hi: "📅 तारीख"
    };

    lines.push("");

    lines.push(
      `${labels[language]}: ${data.taken_at}`
    );

  }


  if (
    data.like_count !==
      undefined &&
    data.like_count !== null
  ) {

    const labels = {
      en: "❤️ Likes",
      ru: "❤️ Лайки",
      uz: "❤️ Layklar",
      id: "❤️ Suka",
      ar: "❤️ الإعجابات",
      uk: "❤️ Вподобання",
      fa: "❤️ لایک‌ها",
      tr: "❤️ Beğeniler",
      hi: "❤️ लाइक्स"
    };

    lines.push(
      `${labels[language]}: ${data.like_count}`
    );

  }


  if (
    data.comment_count !==
      undefined &&
    data.comment_count !== null
  ) {

    const labels = {
      en: "💬 Comments",
      ru: "💬 Комментарии",
      uz: "💬 Izohlar",
      id: "💬 Komentar",
      ar: "💬 التعليقات",
      uk: "💬 Коментарі",
      fa: "💬 نظرات",
      tr: "💬 Yorumlar",
      hi: "💬 कमेंट्स"
    };

    lines.push(
      `${labels[language]}: ${data.comment_count}`
    );

  }


  if (
    data.view_count !==
      undefined &&
    data.view_count !== null &&
    Number(data.view_count) > 0
  ) {

    const labels = {
      en: "👀 Views",
      ru: "👀 Просмотры",
      uz: "👀 Ko‘rishlar",
      id: "👀 Tayangan",
      ar: "👀 المشاهدات",
      uk: "👀 Перегляди",
      fa: "👀 بازدیدها",
      tr: "👀 Görüntülenmeler",
      hi: "👀 व्यूज़"
    };

    lines.push(
      `${labels[language]}: ${data.view_count}`
    );

  }


  if (
    data.play_count !==
      undefined &&
    data.play_count !== null &&
    Number(data.play_count) > 0
  ) {

    const labels = {
      en: "▶️ Plays",
      ru: "▶️ Воспроизведения",
      uz: "▶️ Ko‘rishlar",
      id: "▶️ Pemutaran",
      ar: "▶️ مرات التشغيل",
      uk: "▶️ Відтворення",
      fa: "▶️ پخش‌ها",
      tr: "▶️ Oynatmalar",
      hi: "▶️ प्लेज़"
    };

    lines.push(
      `${labels[language]}: ${data.play_count}`
    );

  }


  if (
    data.reshare_count !==
      undefined &&
    data.reshare_count !== null &&
    Number(data.reshare_count) > 0
  ) {

    const labels = {
      en: "🔁 Reshares",
      ru: "🔁 Репосты",
      uz: "🔁 Ulashishlar",
      id: "🔁 Bagikan ulang",
      ar: "🔁 إعادة المشاركة",
      uk: "🔁 Репости",
      fa: "🔁 بازنشرها",
      tr: "🔁 Yeniden paylaşımlar",
      hi: "🔁 रीशेयर्स"
    };

    lines.push(
      `${labels[language]}: ${data.reshare_count}`
    );

  }


  if (
    parent &&
    getResponseType(parent) ===
      "highlight" &&
    parent.count !== undefined
  ) {

    const labels = {
      en: "📦 Highlight Items",
      ru: "📦 Элементов в Highlight",
      uz: "📦 Highlight elementlari",
      id: "📦 Item Highlight",
      ar: "📦 عناصر Highlight",
      uk: "📦 Елементів у Highlight",
      fa: "📦 موارد Highlight",
      tr: "📦 Highlight öğeleri",
      hi: "📦 Highlight आइटम"
    };

    lines.push(
      `${labels[language]}: ${parent.count}`
    );

  }


  if (
    Array.isArray(data.items)
  ) {

    const labels = {
      en: "📦 Items",
      ru: "📦 Элементов",
      uz: "📦 Elementlar",
      id: "📦 Item",
      ar: "📦 العناصر",
      uk: "📦 Елементів",
      fa: "📦 موارد",
      tr: "📦 Öğeler",
      hi: "📦 आइटम"
    };

    lines.push(
      `${labels[language]}: ${data.items.length}`
    );

  }


  if (data.made_by) {

    lines.push("");

    lines.push(
      `⚙️ ${data.made_by}`
    );

  }


  return truncate(
    lines.join("\n"),
    3900
  );

}


// ==================================================
// SEND MEDIA
// ==================================================

async function sendMedia(
  chatId,
  media,
  data,
  parent = null
) {

  if (
    !media ||
    !isValidUrl(media.url)
  ) {

    return;

  }


  const storageId =
    storeMedia({
      cover: media.cover,
      data,
      parent,
      kind: "media"
    });


  const keyboard =
    buildMediaKeyboard(
      storageId,
      Boolean(media.cover)
    );


  const caption =
    t(
      "downloadReady",
      chatId
    );


  if (
    media.type === "video"
  ) {

    try {

      await telegram(
        "sendVideo",
        {
          chat_id: chatId,

          video: media.url,

          caption,

          parse_mode: "HTML",

          supports_streaming:
            true,

          reply_markup:
            keyboard
        }
      );

      return;

    } catch (error) {

      console.error(
        "sendVideo failed:",
        error.message
      );

      try {

        await telegram(
          "sendDocument",
          {
            chat_id: chatId,

            document:
              media.url,

            caption,

            parse_mode:
              "HTML",

            reply_markup:
              keyboard
          }
        );

        return;

      } catch (
        fallbackError
      ) {

        console.error(
          "Video document fallback failed:",
          fallbackError.message
        );

      }

    }

  }


  try {

    await telegram(
      "sendPhoto",
      {
        chat_id: chatId,

        photo: media.url,

        caption,

        parse_mode: "HTML",

        reply_markup:
          keyboard
      }
    );

  } catch (error) {

    console.error(
      "sendPhoto failed:",
      error.message
    );

    try {

      await telegram(
        "sendDocument",
        {
          chat_id: chatId,

          document:
            media.url,

          caption,

          parse_mode:
            "HTML",

          reply_markup:
            keyboard
        }
      );

    } catch (
      fallbackError
    ) {

      console.error(
        "Photo document fallback failed:",
        fallbackError.message
      );

      await telegram(
        "sendMessage",
        {
          chat_id: chatId,

          text:
            t(
              "mediaNotFound",
              chatId
            ),

          parse_mode:
            "HTML"
        }
      );

    }

  }

}


// ==================================================
// COLLECTION HEADER
// ==================================================

async function sendCollectionHeader(
  chatId,
  data,
  responseType
) {

  const lines = [];

  const language =
    getLanguage(chatId);


  if (
    responseType === "highlight"
  ) {

    const names = {
      en: "✨ <b>Highlight:</b>",
      ru: "✨ <b>Highlight:</b>",
      uz: "✨ <b>Highlight:</b>",
      id: "✨ <b>Highlight:</b>",
      ar: "✨ <b>Highlight:</b>",
      uk: "✨ <b>Highlight:</b>",
      fa: "✨ <b>Highlight:</b>",
      tr: "✨ <b>Highlight:</b>",
      hi: "✨ <b>Highlight:</b>"
    };

    lines.push(
      `${names[language]} ${
        data.highlight_title ||
        "Untitled"
      }`
    );

  }


  if (
    responseType === "story"
  ) {

    const names = {
      en: "📖 <b>Story</b>",
      ru: "📖 <b>История</b>",
      uz: "📖 <b>Hikoya</b>",
      id: "📖 <b>Story</b>",
      ar: "📖 <b>قصة</b>",
      uk: "📖 <b>Історія</b>",
      fa: "📖 <b>استوری</b>",
      tr: "📖 <b>Hikâye</b>",
      hi: "📖 <b>स्टोरी</b>"
    };

    lines.push(
      names[language]
    );

  }


  const username =
    normalizeUsername(
      data.username
    );

  if (username) {

    lines.push(
      `👤 ${username}`
    );

  }


  if (
    data.count !==
      undefined &&
    data.count !== null
  ) {

    const labels = {
      en: "📦 <b>Items:</b>",
      ru: "📦 <b>Элементов:</b>",
      uz: "📦 <b>Elementlar:</b>",
      id: "📦 <b>Item:</b>",
      ar: "📦 <b>العناصر:</b>",
      uk: "📦 <b>Елементів:</b>",
      fa: "📦 <b>موارد:</b>",
      tr: "📦 <b>Öğeler:</b>",
      hi: "📦 <b>आइटम:</b>"
    };

    lines.push(
      `${labels[language]} ${data.count}`
    );

  } else if (
    Array.isArray(data.items)
  ) {

    const labels = {
      en: "📦 <b>Items:</b>",
      ru: "📦 <b>Элементов:</b>",
      uz: "📦 <b>Elementlar:</b>",
      id: "📦 <b>Item:</b>",
      ar: "📦 <b>العناصر:</b>",
      uk: "📦 <b>Елементів:</b>",
      fa: "📦 <b>موارد:</b>",
      tr: "📦 <b>Öğeler:</b>",
      hi: "📦 <b>आइटम:</b>"
    };

    lines.push(
      `${labels[language]} ${data.items.length}`
    );

  }


  const collectionCover =
    getCollectionCover(
      data,
      responseType
    );


  let replyMarkup = null;


  if (collectionCover) {

    const storageId =
      storeMedia({
        cover:
          collectionCover,

        data,

        parent: null,

        kind:
          "collection_cover"
      });

    replyMarkup =
      buildMediaKeyboard(
        storageId,
        true
      );

  } else {

    const storageId =
      storeMedia({
        cover: null,

        data,

        parent: null,

        kind:
          "collection"
      });

    replyMarkup =
      buildMediaKeyboard(
        storageId,
        false
      );

  }


  await telegram(
    "sendMessage",
    {
      chat_id: chatId,

      text:
        lines.join("\n"),

      parse_mode: "HTML",

      reply_markup:
        replyMarkup
    }
  );

}


// ==================================================
// ADMIN NOTIFICATION
// ==================================================

async function notifyAdmin(
  chatId,
  user
) {

  const key =
    String(chatId);

  if (
    notifiedUsers.has(key)
  ) {

    return;

  }

  notifiedUsers.add(key);


  const firstName =
    user?.first_name ||
    "Unknown";


  const username =
    normalizeUsername(
      user?.username
    );


  const lines = [
    "👤 *New instadrop user*",
    "",
    `Chat ID: ${chatId}`,
    `Name: ${firstName}`
  ];


  if (username) {

    lines.push(
      `Username: ${username}`
    );

  }


  try {

    await telegram(
      "sendMessage",
      {
        chat_id:
          ADMIN_CHAT_ID,

        text:
          lines.join("\n"),

        parse_mode:
          "Markdown"
      }
    );

  } catch (error) {

    console.error(
      "Admin notification failed:",
      error.message
    );

  }

}


// ==================================================
// WELCOME
// ==================================================

async function sendWelcome(
  chatId
) {

  const welcomeCaption =
    t(
      "welcomeTitle",
      chatId
    ) +
    "\n\n" +

    "<blockquote>" +
    t(
      "whatDownload",
      chatId
    ) +
    "</blockquote>\n" +

    "<blockquote>" +
    t(
      "profileSupport",
      chatId
    ) +
    "</blockquote>\n" +

    "<blockquote>" +
    t(
      "mediaDetails",
      chatId
    ) +
    "</blockquote>\n\n" +

    t(
      "howToUse",
      chatId
    );


  const welcomeKeyboard = {
    inline_keyboard: [
      [
        {
          text:
            t(
              "chooseLanguage",
              chatId
            ),

          callback_data:
            "open_language"
        }
      ],
      [
        {
          text:
            "🌐 Open instadrop",

          url:
            WEBSITE_URL
        }
      ]
    ]
  };


  try {

    await telegram(
      "sendPhoto",
      {
        chat_id:
          chatId,

        photo:
          WELCOME_IMAGE,

        caption:
          welcomeCaption,

        parse_mode:
          "HTML",

        reply_markup:
          welcomeKeyboard
      }
    );

  } catch (error) {

    console.error(
      "Welcome photo failed:",
      error.message
    );


    await telegram(
      "sendMessage",
      {
        chat_id:
          chatId,

        text:
          welcomeCaption,

        parse_mode:
          "HTML",

        reply_markup:
          welcomeKeyboard
      }
    );

  }

}


// ==================================================
// LANGUAGE COMMAND
// ==================================================

async function sendLanguageMenu(
  chatId
) {

  await telegram(
    "sendMessage",
    {
      chat_id:
        chatId,

      text:
        t(
          "languageTitle",
          chatId
        ),

      parse_mode:
        "HTML",

      reply_markup:
        languageKeyboard()
    }
  );

}


// ==================================================
// HELP
// ==================================================

async function sendHelp(
  chatId
) {

  const help = {
    en:
      "<b>instadrop Help</b>\n\nJust send me an Instagram link and I'll handle the rest.\n\n<b>Supported content</b>\n• Posts\n• Carousels\n• Reels\n• Stories\n• Highlights\n• Profiles\n\n<b>Tip:</b> Copy the Instagram URL and paste it directly into this chat.\n\nNo extra commands are required.",

    ru:
      "<b>Помощь instadrop</b>\n\nПросто отправьте ссылку Instagram, и я всё сделаю сам.\n\n<b>Поддерживаемый контент</b>\n• Посты\n• Карусели\n• Reels\n• Истории\n• Highlights\n• Профили\n\n<b>Совет:</b> Скопируйте URL Instagram и отправьте его прямо в этот чат.\n\nДополнительные команды не требуются.",

    uz:
      "<b>instadrop Yordam</b>\n\nInstagram havolasini yuboring va qolganini men bajaraman.\n\n<b>Qo‘llab-quvvatlanadigan kontent</b>\n• Postlar\n• Karusellar\n• Reels\n• Hikoyalar\n• Highlights\n• Profillar\n\n<b>Maslahat:</b> Instagram URL manzilini nusxalab shu chatga yuboring.\n\nQo‘shimcha buyruqlar kerak emas.",

    id:
      "<b>Bantuan instadrop</b>\n\nCukup kirim tautan Instagram dan saya akan mengurus sisanya.\n\n<b>Konten yang didukung</b>\n• Postingan\n• Carousel\n• Reels\n• Story\n• Highlight\n• Profil\n\n<b>Tips:</b> Salin URL Instagram dan kirim langsung ke chat ini.\n\nTidak diperlukan perintah tambahan.",

    ar:
      "<b>مساعدة instadrop</b>\n\nأرسل رابط Instagram وسأتولى الباقي.\n\n<b>المحتوى المدعوم</b>\n• المنشورات\n• المنشورات المتعددة\n• Reels\n• القصص\n• Highlights\n• الملفات الشخصية\n\n<b>نصيحة:</b> انسخ رابط Instagram وأرسله مباشرة إلى هذه المحادثة.\n\nلا تحتاج إلى أوامر إضافية.",

    uk:
      "<b>Допомога instadrop</b>\n\nПросто надішліть посилання Instagram, а я зроблю все інше.\n\n<b>Підтримуваний контент</b>\n• Дописи\n• Каруселі\n• Reels\n• Історії\n• Highlights\n• Профілі\n\n<b>Порада:</b> Скопіюйте URL Instagram і надішліть його прямо в цей чат.\n\nДодаткові команди не потрібні.",

    fa:
      "<b>راهنمای instadrop</b>\n\nفقط لینک Instagram را ارسال کنید و بقیه کارها را من انجام می‌دهم.\n\n<b>محتوای پشتیبانی‌شده</b>\n• پست‌ها\n• کاروسل‌ها\n• Reels\n• استوری‌ها\n• Highlights\n• پروفایل‌ها\n\n<b>نکته:</b> لینک Instagram را کپی کرده و مستقیماً در این چت ارسال کنید.\n\nبه دستور دیگری نیاز نیست.",

    tr:
      "<b>instadrop Yardım</b>\n\nInstagram bağlantısını gönderin, gerisini ben hallederim.\n\n<b>Desteklenen içerikler</b>\n• Gönderiler\n• Carousel\n• Reels\n• Hikâyeler\n• Highlights\n• Profiller\n\n<b>İpucu:</b> Instagram URL'sini kopyalayıp doğrudan bu sohbete gönderin.\n\nEkstra komut gerekmez.",

    hi:
      "<b>instadrop सहायता</b>\n\nबस Instagram लिंक भेजें और बाकी काम मैं कर दूँगा।\n\n<b>सपोर्टेड कंटेंट</b>\n• पोस्ट\n• कैरोसेल\n• Reels\n• स्टोरीज़\n• Highlights\n• प्रोफ़ाइल\n\n<b>टिप:</b> Instagram URL कॉपी करके सीधे इस चैट में भेजें।\n\nकिसी अतिरिक्त कमांड की ज़रूरत नहीं है।"
  };


  const language =
    getLanguage(chatId);


  await telegram(
    "sendMessage",
    {
      chat_id:
        chatId,

      text:
        help[language] ||
        help.en,

      parse_mode:
        "HTML"
    }
  );

}


// ==================================================
// CALLBACK HANDLER
// ==================================================

async function handleCallback(
  callback
) {

  const callbackId =
    callback.id;

  const chatId =
    callback.message?.chat?.id;

  const callbackData =
    callback.data || "";


  // ==================================================
  // OPEN LANGUAGE MENU
  // ==================================================

  if (
    callbackData ===
    "open_language"
  ) {

    try {

      await telegram(
        "answerCallbackQuery",
        {
          callback_query_id:
            callbackId
        }
      );

    } catch {}


    await sendLanguageMenu(
      chatId
    );

    return;
  }


  // ==================================================
  // LANGUAGE SELECTION
  // ==================================================

  if (
    callbackData.startsWith(
      "lang:"
    )
  ) {

    const language =
      callbackData.slice(
        "lang:".length
      );


    if (
      !LANGUAGES[language]
    ) {

      try {

        await telegram(
          "answerCallbackQuery",
          {
            callback_query_id:
              callbackId,

            text:
              "Invalid language.",

            show_alert:
              false
          }
        );

      } catch {}

      return;

    }


    setLanguage(
      chatId,
      language
    );


    try {

      await telegram(
        "answerCallbackQuery",
        {
          callback_query_id:
            callbackId,

          text:
            LANGUAGES[language].name,

          show_alert:
            false
        }
      );

    } catch {}


    try {

      await telegram(
        "editMessageText",
        {
          chat_id:
            chatId,

          message_id:
            callback.message
              ?.message_id,

          text:
            t(
              "languageChanged",
              chatId
            ),

          parse_mode:
            "HTML"
        }
      );

    } catch (error) {

      console.error(
        "Language message edit failed:",
        error.message
      );

      await telegram(
        "sendMessage",
        {
          chat_id:
            chatId,

          text:
            t(
              "languageChanged",
              chatId
            ),

          parse_mode:
            "HTML"
        }
      );

    }

    return;
  }


  // ==================================================
  // NORMAL CALLBACK ACK
  // ==================================================

  try {

    await telegram(
      "answerCallbackQuery",
      {
        callback_query_id:
          callbackId
      }
    );

  } catch (error) {

    console.error(
      "answerCallbackQuery failed:",
      error.message
    );

  }


  if (!chatId) {
    return;
  }


  // ==================================================
  // GET COVER
  // ==================================================

  if (
    callbackData.startsWith(
      "get_cover:"
    )
  ) {

    const storageId =
      callbackData.slice(
        "get_cover:".length
      );


    cleanupStorage();


    const stored =
      mediaStorage.get(
        storageId
      );


    if (
      !stored ||
      !stored.cover
    ) {

      await telegram(
        "sendMessage",
        {
          chat_id:
            chatId,

          text:
            t(
              "coverExpired",
              chatId
            ),

          parse_mode:
            "HTML"
        }
      );

      return;
    }


    try {

      await telegram(
        "sendPhoto",
        {
          chat_id:
            chatId,

          photo:
            stored.cover,

          caption:
            t(
              "coverPhoto",
              chatId
            ),

          parse_mode:
            "HTML"
        }
      );

    } catch (error) {

      console.error(
        "Cover sendPhoto failed:",
        error.message
      );


      try {

        await telegram(
          "sendDocument",
          {
            chat_id:
              chatId,

            document:
              stored.cover,

            caption:
              t(
                "coverPhoto",
                chatId
              ),

            parse_mode:
              "HTML"
          }
        );

      } catch (
        fallbackError
      ) {

        console.error(
          "Cover fallback failed:",
          fallbackError.message
        );


        await telegram(
          "sendMessage",
          {
            chat_id:
              chatId,

            text:
              t(
                "coverPhoto",
                chatId
              ),

            parse_mode:
              "HTML"
          }
        );

      }

    }

    return;
  }


  // ==================================================
  // GET DETAILS
  // ==================================================

  if (
    callbackData.startsWith(
      "get_details:"
    )
  ) {

    const storageId =
      callbackData.slice(
        "get_details:".length
      );


    cleanupStorage();


    const stored =
      mediaStorage.get(
        storageId
      );


    if (!stored) {

      await telegram(
        "sendMessage",
        {
          chat_id:
            chatId,

          text:
            t(
              "detailsExpired",
              chatId
            ),

          parse_mode:
            "HTML"
        }
      );

      return;
    }


    const details =
      formatDetails(
        stored.data,
        stored.parent,
        chatId
      );


    await telegram(
      "sendMessage",
      {
        chat_id:
          chatId,

        text:
          `${t(
            "detailsTitle",
            chatId
          )}\n\n${details}`,

        parse_mode:
          "HTML"
      }
    );

    return;
  }

}


// ==================================================
// DELETE TEMPORARY STATUS MESSAGE
// ==================================================

async function deleteStatusMessage(
  chatId,
  messageId
) {

  if (
    !chatId ||
    !messageId
  ) {

    return;

  }


  try {

    await telegram(
      "deleteMessage",
      {
        chat_id:
          chatId,

        message_id:
          messageId
      }
    );

  } catch (error) {

    console.error(
      "Temporary status deletion failed:",
      error.message
    );

  }

}


// ==================================================
// PROCESS INSTAGRAM URL
// ==================================================

async function processInstagramUrl(
  chatId,
  instagramUrl
) {

  let statusMessageId =
    null;


  // ==================================================
  // TEMPORARY STATUS
  // ==================================================

  try {

    const statusResponse =
      await telegram(
        "sendMessage",
        {
          chat_id:
            chatId,

          text:
            t(
              "working",
              chatId
            ),

          parse_mode:
            "HTML"
        }
      );


    statusMessageId =
      statusResponse
        ?.result
        ?.message_id ||
      null;

  } catch (error) {

    console.error(
      "Status message failed:",
      error.message
    );

  }


  let response;


  // ==================================================
  // API REQUEST
  // ==================================================

  try {

    response =
      await fetch(
        API_URL +
          encodeURIComponent(
            instagramUrl
          ),
        {
          method:
            "GET",

          headers: {
            Accept:
              "application/json",

            "X-API-Key":
              API_KEY
          },

          signal:
            AbortSignal.timeout(
              60000
            )
        }
      );

  } catch (error) {

    console.error(
      "API request failed:",
      error.message
    );


    await deleteStatusMessage(
      chatId,
      statusMessageId
    );


    await telegram(
      "sendMessage",
      {
        chat_id:
          chatId,

        text:
          t(
            "serviceUnreachable",
            chatId
          ),

        parse_mode:
          "HTML"
      }
    );

    return;

  }


  // ==================================================
  // JSON
  // ==================================================

  let data;


  try {

    data =
      await response.json();

  } catch {

    await deleteStatusMessage(
      chatId,
      statusMessageId
    );


    await telegram(
      "sendMessage",
      {
        chat_id:
          chatId,

        text:
          t(
            "unexpectedResponse",
            chatId
          ),

        parse_mode:
          "HTML"
      }
    );

    return;

  }


  console.log(
    "instadrop API response:",
    JSON.stringify(
      data,
      null,
      2
    ).slice(
      0,
      2000
    )
  );


  if (
    !response.ok
  ) {

    const errorMsg =
      data?.error ||
      data?.message ||
      "The download could not be completed.";


    await deleteStatusMessage(
      chatId,
      statusMessageId
    );


    await telegram(
      "sendMessage",
      {
        chat_id:
          chatId,

        text:
          `❌ <b>${errorMsg}</b>\n\n` +
          t(
            "needInstagram",
            chatId
          ),

        parse_mode:
          "HTML"
      }
    );

    return;

  }


  if (
    data &&
    data.p === false
  ) {

    const message =
      data.message ||
      data.error ||
      "Unable to download this Instagram content.";


    await deleteStatusMessage(
      chatId,
      statusMessageId
    );


    await telegram(
      "sendMessage",
      {
        chat_id:
          chatId,

        text:
          `❌ <b>${message}</b>\n\n` +
          t(
            "needInstagram",
            chatId
          ),

        parse_mode:
          "HTML"
      }
    );

    return;

  }


  if (
    data &&
    data.error &&
    !data.p
  ) {

    await deleteStatusMessage(
      chatId,
      statusMessageId
    );


    await telegram(
      "sendMessage",
      {
        chat_id:
          chatId,

        text:
          `❌ <b>${data.error}</b>\n\n` +
          t(
            "needInstagram",
            chatId
          ),

        parse_mode:
          "HTML"
      }
    );

    return;

  }


  const responseType =
    getResponseType(
      data
    );


  // ==================================================
  // REEL
  // ==================================================

  if (
    responseType === "reel" ||
    isReelResponse(data)
  ) {

    const videoUrl =
      getReelVideo(
        data
      );


    if (!videoUrl) {

      await deleteStatusMessage(
        chatId,
        statusMessageId
      );


      await telegram(
        "sendMessage",
        {
          chat_id:
            chatId,

          text:
            t(
              "noVideo",
              chatId
            ),

          parse_mode:
            "HTML"
        }
      );

      return;

    }


    const cover =
      getCoverUrl(
        data
      );


    await sendMedia(
      chatId,

      {
        url:
          videoUrl,

        type:
          "video",

        cover
      },

      data,

      null
    );


    await deleteStatusMessage(
      chatId,
      statusMessageId
    );

    return;
  }


  // ==================================================
  // HIGHLIGHT
  // ==================================================

  if (
    responseType === "highlight"
  ) {

    await sendCollectionHeader(
      chatId,
      data,
      "highlight"
    );


    const mediaItems =
      extractMediaItems(
        data
      );


    if (
      !mediaItems.length
    ) {

      await deleteStatusMessage(
        chatId,
        statusMessageId
      );


      await telegram(
        "sendMessage",
        {
          chat_id:
            chatId,

          text:
            t(
              "mediaNotFound",
              chatId
            ),

          parse_mode:
            "HTML"
        }
      );

      return;

    }


    if (
      Array.isArray(
        data.items
      ) &&
      data.items.length > 0
    ) {

      for (
        const item
        of data.items
      ) {

        const itemMedia =
          extractMediaItems(
            item
          );


        for (
          const media
          of itemMedia
        ) {

          await sendMedia(
            chatId,
            media,
            item,
            data
          );

        }

      }

    } else {

      for (
        const media
        of mediaItems
      ) {

        await sendMedia(
          chatId,
          media,
          data,
          data
        );

      }

    }


    await deleteStatusMessage(
      chatId,
      statusMessageId
    );

    return;
  }


  // ==================================================
  // STORY
  // ==================================================

  if (
    responseType === "story"
  ) {

    await sendCollectionHeader(
      chatId,
      data,
      "story"
    );


    const mediaItems =
      extractMediaItems(
        data
      );


    if (
      !mediaItems.length
    ) {

      await deleteStatusMessage(
        chatId,
        statusMessageId
      );


      await telegram(
        "sendMessage",
        {
          chat_id:
            chatId,

          text:
            t(
              "mediaNotFound",
              chatId
            ),

          parse_mode:
            "HTML"
        }
      );

      return;

    }


    if (
      Array.isArray(
        data.items
      ) &&
      data.items.length > 0
    ) {

      for (
        const item
        of data.items
      ) {

        const itemMedia =
          extractMediaItems(
            item
          );


        for (
          const media
          of itemMedia
        ) {

          await sendMedia(
            chatId,
            media,
            item,
            data
          );

        }

      }

    } else {

      for (
        const media
        of mediaItems
      ) {

        await sendMedia(
          chatId,
          media,
          data,
          data
        );

      }

    }


    await deleteStatusMessage(
      chatId,
      statusMessageId
    );

    return;
  }


  // ==================================================
  // COLLECTION
  // ==================================================

  if (
    responseType === "collection"
  ) {

    await sendCollectionHeader(
      chatId,
      data,
      "collection"
    );


    const mediaItems =
      extractMediaItems(
        data
      );


    if (
      !mediaItems.length
    ) {

      await deleteStatusMessage(
        chatId,
        statusMessageId
      );


      await telegram(
        "sendMessage",
        {
          chat_id:
            chatId,

          text:
            t(
              "mediaNotFound",
              chatId
            ),

          parse_mode:
            "HTML"
        }
      );

      return;

    }


    if (
      Array.isArray(
        data.items
      ) &&
      data.items.length > 0
    ) {

      for (
        const item
        of data.items
      ) {

        const itemMedia =
          extractMediaItems(
            item
          );


        for (
          const media
          of itemMedia
        ) {

          await sendMedia(
            chatId,
            media,
            item,
            data
          );

        }

      }

    } else {

      for (
        const media
        of mediaItems
      ) {

        await sendMedia(
          chatId,
          media,
          data,
          null
        );

      }

    }


    await deleteStatusMessage(
      chatId,
      statusMessageId
    );

    return;
  }


  // ==================================================
  // NORMAL POST / CAROUSEL
  // ==================================================

  const mediaItems =
    extractMediaItems(
      data
    );


  if (
    !mediaItems.length
  ) {

    await deleteStatusMessage(
      chatId,
      statusMessageId
    );


    await telegram(
      "sendMessage",
      {
        chat_id:
          chatId,

        text:
          t(
            "mediaNotFound",
            chatId
          ),

        parse_mode:
          "HTML"
      }
    );

    return;

  }


  for (
    const media
    of mediaItems
  ) {

    await sendMedia(
      chatId,
      media,
      data,
      null
    );

  }


  await deleteStatusMessage(
    chatId,
    statusMessageId
  );

}


// ==================================================
// VERCEL WEBHOOK
// ==================================================

export default async function handler(
  req,
  res
) {

  if (
    req.method !== "POST"
  ) {

    return res
      .status(200)
      .json({
        ok: true,

        message:
          "instadrop Telegram bot is running."
      });

  }


  try {

    const update =
      req.body || {};


    // ==================================================
    // CALLBACK
    // ==================================================

    if (
      update.callback_query
    ) {

      await handleCallback(
        update.callback_query
      );


      return res
        .status(200)
        .json({
          ok: true
        });

    }


    // ==================================================
    // MESSAGE
    // ==================================================

    if (
      !update.message
    ) {

      return res
        .status(200)
        .json({
          ok: true
        });

    }


    const message =
      update.message;


    const chatId =
      message.chat?.id;


    if (!chatId) {

      return res
        .status(200)
        .json({
          ok: true
        });

    }


    const text =
      message.text ||
      message.caption ||
      "";


    // ==================================================
    // INITIAL LANGUAGE DETECTION
    // ==================================================

    if (
      !userLanguages.has(
        String(chatId)
      )
    ) {

      const telegramLanguage =
        String(
          message.from?.language_code ||
          ""
        ).toLowerCase();


      const automaticLanguageMap = {
        ru: "ru",
        uk: "uk",
        uz: "uz",
        id: "id",
        ar: "ar",
        fa: "fa",
        tr: "tr",
        hi: "hi",
        en: "en"
      };


      setLanguage(
        chatId,

        automaticLanguageMap[
          telegramLanguage
        ] || "en"
      );

    }


    // ==================================================
    // ❤️ REACT TO ANY LINK
    // ==================================================

    const anyUrl =
      findAnyUrl(
        text
      );


    if (anyUrl) {

      await reactToLink(
        chatId,
        message.message_id
      );

    }


    // ==================================================
    // /START
    // ==================================================

    if (
      text === "/start" ||
      text.startsWith(
        "/start "
      )
    ) {

      await notifyAdmin(
        chatId,
        message.from
      );


      await sendWelcome(
        chatId
      );


      return res
        .status(200)
        .json({
          ok: true
        });

    }


    // ==================================================
    // /LANGUAGE
    // ==================================================

    if (
      text === "/language" ||
      text.startsWith(
        "/language "
      )
    ) {

      await sendLanguageMenu(
        chatId
      );


      return res
        .status(200)
        .json({
          ok: true
        });

    }


    // ==================================================
    // /HELP
    // ==================================================

    if (
      text === "/help" ||
      text.startsWith(
        "/help "
      )
    ) {

      await sendHelp(
        chatId
      );


      return res
        .status(200)
        .json({
          ok: true
        });

    }


    // ==================================================
    // INSTAGRAM URL
    // ==================================================

    const instagramUrl =
      findInstagramUrl(
        text
      );


    if (!instagramUrl) {

      await telegram(
        "sendMessage",
        {
          chat_id:
            chatId,

          text:
            t(
              "needInstagram",
              chatId
            ),

          parse_mode:
            "HTML"
        }
      );


      return res
        .status(200)
        .json({
          ok: true
        });

    }


    // ==================================================
    // DOWNLOAD
    // ==================================================

    await processInstagramUrl(
      chatId,
      instagramUrl
    );


    return res
      .status(200)
      .json({
        ok: true
      });

  } catch (error) {

    console.error(
      "Webhook error:",
      error
    );


    try {

      const chatId =
        req.body
          ?.message
          ?.chat
          ?.id;


      if (chatId) {

        await telegram(
          "sendMessage",
          {
            chat_id:
              chatId,

            text:
              t(
                "unexpected",
                chatId
              ),

            parse_mode:
              "HTML"
          }
        );

      }

    } catch (
      telegramError
    ) {

      console.error(
        "Failed to send error message:",
        telegramError.message
      );

    }


    return res
      .status(200)
      .json({
        ok: true
      });

  }

}
