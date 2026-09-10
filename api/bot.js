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
  },

  es: {
    name: "Español",
    flag: "🇪🇸"
  },

  pt: {
    name: "Português",
    flag: "🇧🇷"
  },

  fr: {
    name: "Français",
    flag: "🇫🇷"
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
    en: "🌍 <b>Choose your language.</b>",
    ru: "🌍 <b>Выберите язык.</b>",
    uz: "🌍 <b>Tilni tanlang.</b>",
    id: "🌍 <b>Pilih bahasa Anda.</b>",
    ar: "🌍 <b>اختر لغتك.</b>",
    uk: "🌍 <b>Оберіть мову.</b>",
    fa: "🌍 <b>زبان خود را انتخاب کنید.</b>",
    tr: "🌍 <b>Dilinizi seçin.</b>",
    hi: "🌍 <b>अपनी भाषा चुनें।</b>",
    es: "🌍 <b>Elige tu idioma.</b>",
    pt: "🌍 <b>Escolha seu idioma.</b>",
    fr: "🌍 <b>Choisissez votre langue.</b>"
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
    hi: "✅ भाषा <b>हिन्दी</b> में बदल दी गई है।",
    es: "✅ Idioma cambiado a <b>español</b>.",
    pt: "✅ Idioma alterado para <b>português</b>.",
    fr: "✅ Langue changée en <b>français</b>."
  },


  privacyPolicy: {
    en: "🔒 <b>Privacy Policy</b>\n\nYour privacy matters to us. This bot only processes the Instagram links you send, and only to download the media you request.\n\n<b>🙅 What we don't collect</b>\n• Your phone number\n• Your email address\n• Your IP address\n• Your name, contacts, or any other personal data\n\n<b>🗂️ Your links</b>\nWe don't store the links you share. They are used only to fetch the media you requested and are not kept afterwards.\n\n<b>💸 Selling your info</b>\nWe don't sell or share your information — because there is nothing to sell or share.\n\n<b>🔗 Third-party services</b>\nMedia is fetched through our download service. Instagram's own terms apply to the content you download.\n\nℹ️ By using this bot, you agree to this privacy policy.",
    ru: "🔒 <b>Политика конфиденциальности</b>\n\nМы заботимся о вашей конфиденциальности. Этот бот обрабатывает только ссылки Instagram, которые вы отправляете, и только для скачивания запрошенных медиа.\n\n<b>🙅 Что мы не собираем</b>\n• Ваш номер телефона\n• Ваш адрес электронной почты\n• Ваш IP-адрес\n• Ваше имя, контакты и любые другие личные данные\n\n<b>🗂️ Ваши ссылки</b>\nМы не храним ссылки, которыми вы делитесь. Они используются только для загрузки запрошенных медиа и после этого не сохраняются.\n\n<b>💸 Продажа ваших данных</b>\nМы не продаём и не передаём вашу информацию — её просто нет, нечего продавать или передавать.\n\n<b>🔗 Сторонние сервисы</b>\nМедиа загружается через наш сервис загрузки. На скачиваемый контент распространяются условия самого Instagram.\n\nℹ️ Используя этого бота, вы соглашаетесь с данной политикой конфиденциальности.",
    uz: "🔒 <b>Maxfiylik siyosati</b>\n\nBiz sizning maxfiyligingizga g‘amxo‘rmiz. Bu bot faqat siz yuborgan Instagram havolalarini qayta ishlaydi va faqat so‘ralgan mediani yuklab olish uchun.\n\n<b>🙅 Biz nimani yig‘maymiz</b>\n• Telefon raqamingizni\n• Elektron pochta manzilingizni\n• IP manzilingizni\n• Ismingiz, kontaktlaringiz va boshqa shaxsiy ma’lumotlaringizni\n\n<b>🗂️ Havolalaringiz</b>\nSiz ulashgan havolalarni saqlamaymiz. Ular faqat so‘ralgan mediani olish uchun ishlatiladi va keyin saqlanmaydi.\n\n<b>💸 Ma’lumotlaringizni sotish</b>\nMa’lumotlaringizni sotmaymiz yoki ulashmaymiz — chunki sotadigan yoki ulashadigan hech narsa yo‘q.\n\n<b>🔗 Uchinchi tomon xizmatlari</b>\nMedia bizning yuklab olish xizmatimiz orqali olinadi. Yuklab olingan kontentga Instagram shartlari tatbiq etiladi.\n\nℹ️ Bu botdan foydalanib, siz ushbu maxfiylik siyosatiga rozilik bildirasiz.",
    id: "🔒 <b>Kebijakan Privasi</b>\n\nPrivasi Anda penting bagi kami. Bot ini hanya memproses tautan Instagram yang Anda kirim, dan hanya untuk mengunduh media yang Anda minta.\n\n<b>🙅 Yang tidak kami kumpulkan</b>\n• Nomor telepon Anda\n• Alamat email Anda\n• Alamat IP Anda\n• Nama, kontak, atau data pribadi lainnya\n\n<b>🗂️ Tautan Anda</b>\nKami tidak menyimpan tautan yang Anda bagikan. Tautan hanya digunakan untuk mengambil media yang Anda minta dan tidak disimpan setelahnya.\n\n<b>💸 Menjual informasi Anda</b>\nKami tidak menjual atau membagikan informasi Anda — karena tidak ada yang bisa dijual atau dibagikan.\n\n<b>🔗 Layanan pihak ketiga</b>\nMedia diambil melalui layanan unduhan kami. Ketentuan Instagram berlaku untuk konten yang Anda unduh.\n\nℹ️ Dengan menggunakan bot ini, Anda menyetujui kebijakan privasi ini.",
    ar: "🔒 <b>سياسة الخصوصية</b>\n\nنحن نهتم بخصوصيتك. يعالج هذا البوت فقط روابط Instagram التي ترسلها، وذلك فقط لتحميل الوسائط التي تطلبها.\n\n<b>🙅 ما لا نجمعه</b>\n• رقم هاتفك\n• بريدك الإلكتروني\n• عنوان IP الخاص بك\n• اسمك أو جهات اتصالك أو أي بيانات شخصية أخرى\n\n<b>🗂️ روابطك</b>\nلا نحتفظ بالروابط التي تشاركها. تُستخدم فقط لجلب الوسائط التي طلبتها ولا يتم حفظها بعد ذلك.\n\n<b>💸 بيع معلوماتك</b>\nلا نبيع معلوماتك أو نشاركها — لأنه لا يوجد شيء لنبيعه أو نشاركه.\n\n<b>🔗 خدمات الطرف الثالث</b>\nيتم جلب الوسائط عبر خدمة التحميل الخاصة بنا. تنطبق شروط Instagram على المحتوى الذي تحمّله.\n\nℹ️ باستخدام هذا البوت، فإنك توافق على سياسة الخصوصية هذه.",
    uk: "🔒 <b>Політика конфіденційності</b>\n\nВаша конфіденційність важлива для нас. Цей бот обробляє лише надіслані вами посилання Instagram і лише для завантаження запитаних медіа.\n\n<b>🙅 Що ми не збираємо</b>\n• Ваш номер телефону\n• Вашу електронну адресу\n• Вашу IP-адресу\n• Ваше ім'я, контакти чи будь-які інші особисті дані\n\n<b>🗂️ Ваші посилання</b>\nМи не зберігаємо посилання, якими ви ділитеся. Вони використовуються лише для отримання запитаних медіа й після цього не зберігаються.\n\n<b>💸 Продаж вашої інформації</b>\nМи не продаємо та не передаємо вашу інформацію — бо немає чого продавати чи передавати.\n\n<b>🔗 Сторонні сервіси</b>\nМедіа завантажується через наш сервіс завантаження. На контент, який ви завантажуєте, поширюються умови Instagram.\n\nℹ️ Користуючись цим ботом, ви погоджуєтесь із цією політикою конфіденційності.",
    fa: "🔒 <b>سیاست حفظ حریم خصوصی</b>\n\nحفظ حریم خصوصی شما برای ما مهم است. این ربات فقط لینک‌های Instagram را که ارسال می‌کنید پردازش می‌کند، و تنها برای دانلود رسانه‌ای که درخواست کرده‌اید.\n\n<b>🙅 چه اطلاعاتی را جمع نمی‌کنیم</b>\n• شماره تلفن شما\n• ایمیل شما\n• نشانی IP شما\n• نام، مخاطبین یا هر اطلاعات شخصی دیگر شما\n\n<b>🗂️ لینک‌های شما</b>\nما لینک‌هایی که ارسال می‌کنید را ذخیره نمی‌کنیم. آن‌ها فقط برای دریافت رسانه درخواستی استفاده می‌شوند و پس از آن نگه‌داری نمی‌شوند.\n\n<b>💸 فروش اطلاعات شما</b>\nما اطلاعات شما را نمی‌فروشیم یا به اشتراک نمی‌گذاریم — چون چیزی برای فروش یا به اشتراک گذاشتن وجود ندارد.\n\n<b>🔗 خدمات طرف سوم</b>\nرسانه از طریق سرویس دانلود ما دریافت می‌شود. شرایط خود Instagram بر محتوایی که دانلود می‌کنید اعمال می‌شود.\n\nℹ️ با استفاده از این ربات، شما با این سیاست حفظ حریم خصوصی موافقت می‌کنید.",
    tr: "🔒 <b>Gizlilik Politikası</b>\n\nGizliliğiniz bizim için önemli. Bu bot yalnızca gönderdiğiniz Instagram bağlantılarını ve yalnızca istediğiniz medyayı indirmek için işler.\n\n<b>🙅 Neleri toplamıyoruz</b>\n• Telefon numaranızı\n• E-posta adresinizi\n• IP adresinizi\n• Adınızı, kişilerinizi veya başka herhangi bir kişisel verinizi\n\n<b>🗂️ Bağlantılarınız</b>\nPaylaştığınız bağlantıları saklamıyoruz. Bunlar yalnızca istediğiniz medyayı almak için kullanılır ve sonrasında tutulmaz.\n\n<b>💸 Bilgilerinizi satmak</b>\nBilgilerinizi satmıyor veya paylaşmıyoruz — çünkü satacak ya da paylaşacak bir şey yok.\n\n<b>🔗 Üçüncü taraf hizmetleri</b>\nMedya, indirme hizmetimiz aracılığıyla alınır. İndirdiğiniz içerik için Instagram'ın kendi koşulları geçerlidir.\n\nℹ️ Bu botu kullanarak bu gizlilik politikasını kabul etmiş olursunuz.",
    hi: "🔒 <b>गोपनीयता नीति</b>\n\nआपकी निजता हमारे लिए महत्वपूर्ण है। यह बॉट केवल आपके द्वारा भेजे गए Instagram लिंक को प्रोसेस करता है, और वह भी केवल आपके माँगे गए मीडिया को डाउनलोड करने के लिए।\n\n<b>🙅 हम क्या नहीं जमा करते</b>\n• आपका फ़ोन नंबर\n• आपका ईमेल पता\n• आपका IP पता\n• आपका नाम, संपर्क या कोई अन्य व्यक्तिगत जानकारी\n\n<b>🗂️ आपके लिंक</b>\nआपके द्वारा साझा किए गए लिंक हम जमा नहीं करते। वे केवल आपके माँगे गए मीडिया को लाने के लिए उपयोग होते हैं और उसके बाद नहीं रखे जाते।\n\n<b>💸 आपकी जानकारी बेचना</b>\nहम आपकी जानकारी न बेचते हैं न साझा करते हैं — क्योंकि बेचने या साझा करने के लिए कुछ है ही नहीं।\n\n<b>🔗 तीसरे पक्ष की सेवाएँ</b>\nमीडिया हमारी डाउनलोड सेवा के ज़रिए लाया जाता है। आपके डाउनलोड किए गए कंटेंट पर Instagram की अपनी शर्तें लागू होती हैं।\n\nℹ️ इस बॉट का उपयोग करके, आप इस गोपनीयता नीति से सहमत होते हैं।",
    es: "🔒 <b>Política de Privacidad</b>\n\nTu privacidad nos importa. Este bot solo procesa los enlaces de Instagram que envías, y solo para descargar el contenido que solicitas.\n\n<b>🙅 Lo que no recopilamos</b>\n• Tu número de teléfono\n• Tu correo electrónico\n• Tu dirección IP\n• Tu nombre, contactos o cualquier otro dato personal\n\n<b>🗂️ Tus enlaces</b>\nNo guardamos los enlaces que compartes. Solo se usan para obtener el contenido que solicitaste y no se conservan después.\n\n<b>💸 Venta de tu información</b>\nNo vendemos ni compartimos tu información — porque no hay nada que vender ni compartir.\n\n<b>🔗 Servicios de terceros</b>\nEl contenido se obtiene a través de nuestro servicio de descarga. Se aplican los términos de Instagram al contenido que descargas.\n\nℹ️ Al usar este bot, aceptas esta política de privacidad.",
    pt: "🔒 <b>Política de Privacidade</b>\n\nSua privacidade é importante para nós. Este bot processa apenas os links do Instagram que você envia, e somente para baixar o conteúdo que você solicita.\n\n<b>🙅 O que não coletamos</b>\n• Seu número de telefone\n• Seu e-mail\n• Seu endereço IP\n• Seu nome, contatos ou qualquer outro dado pessoal\n\n<b>🗂️ Seus links</b>\nNão armazenamos os links que você compartilha. Eles são usados apenas para buscar o conteúdo solicitado e não são mantidos depois.\n\n<b>💸 Venda das suas informações</b>\nNão vendemos nem compartilhamos suas informações — porque não há nada para vender ou compartilhar.\n\n<b>🔗 Serviços de terceiros</b>\nO conteúdo é obtido por meio do nosso serviço de download. Os termos do Instagram se aplicam ao conteúdo que você baixa.\n\nℹ️ Ao usar este bot, você concorda com esta política de privacidade.",
    fr: "🔒 <b>Politique de Confidentialité</b>\n\nVotre vie privée nous tient à cœur. Ce bot traite uniquement les liens Instagram que vous envoyez, et seulement pour télécharger le contenu que vous demandez.\n\n<b>🙅 Ce que nous ne collectons pas</b>\n• Votre numéro de téléphone\n• Votre adresse e-mail\n• Votre adresse IP\n• Votre nom, vos contacts ou toute autre donnée personnelle\n\n<b>🗂️ Vos liens</b>\nNous ne conservons pas les liens que vous partagez. Ils servent uniquement à récupérer le contenu demandé et ne sont pas gardés ensuite.\n\n<b>💸 Vente de vos informations</b>\nNous ne vendons ni ne partageons vos informations — car il n'y a rien à vendre ou à partager.\n\n<b>🔗 Services tiers</b>\nLe contenu est récupéré via notre service de téléchargement. Les conditions d'Instagram s'appliquent au contenu que vous téléchargez.\n\nℹ️ En utilisant ce bot, vous acceptez cette politique de confidentialité."
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
    hi: "🌍 भाषा चुनें",
    es: "🌍 Elegir idioma",
    pt: "🌍 Escolher idioma",
    fr: "🌍 Choisir la langue"
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
    hi: "🚀 <b>instadrop में आपका स्वागत है!</b>\nआपका सरल और तेज़ Instagram डाउनलोडर।",
    es: "🚀 <b>¡Bienvenido a instadrop!</b>\nTu descargador de Instagram simple y rápido.",
    pt: "🚀 <b>Bem-vindo ao instadrop!</b>\nSeu baixador de Instagram simples e rápido.",
    fr: "🚀 <b>Bienvenue sur instadrop !</b>\nVotre téléchargeur Instagram simple et rapide."
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
    hi: "📥 <b>मैं क्या डाउनलोड कर सकता हूँ?</b>\n• पोस्ट  • कैरोसेल  • Reels\n• स्टोरीज़  • Highlights  • प्रोफ़ाइल",
    es: "📥 <b>¿Qué puedo descargar?</b>\n• Publicaciones  • Carruseles  • Reels\n• Historias  • Destacados  • Perfiles",
    pt: "📥 <b>O que posso baixar?</b>\n• Publicações  • Carrosséis  • Reels\n• Stories  • Destaques  • Perfis",
    fr: "📥 <b>Que puis-je télécharger ?</b>\n• Publications  • Carrousels  • Reels\n• Stories  • À la une  • Profils"
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
    hi: "👤 <b>प्रोफ़ाइल सपोर्ट</b>\n• प्रोफ़ाइल फोटो  • अकाउंट विवरण\n• फ़ॉलोअर्स और फ़ॉलोइंग  • पोस्ट की संख्या\n• नाम और बायो  • वेरिफिकेशन स्थिति\n• प्राइवेट अकाउंट स्थिति",
    es: "👤 <b>Compatibilidad con perfiles</b>\n• Foto de perfil  • Datos de la cuenta\n• Seguidores y seguidos  • Número de publicaciones\n• Nombre y biografía  • Estado de verificación\n• Estado de cuenta privada",
    pt: "👤 <b>Suporte a perfis</b>\n• Foto de perfil  • Detalhes da conta\n• Seguidores e seguindo  • Número de publicações\n• Nome e bio  • Status de verificação\n• Status de conta privada",
    fr: "👤 <b>Prise en charge des profils</b>\n• Photo de profil  • Détails du compte\n• Abonnés &amp; abonnements  • Nombre de publications\n• Nom &amp; bio  • Statut de vérification\n• Statut de compte privé"
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
    hi: "🖼️ <b>मीडिया विवरण</b>\n• यूज़रनेम  • कैप्शन\n• अपलोड की तारीख  • लाइक्स\n• कमेंट्स  • व्यूज़\n• प्लेज़  • रीशेयर्स",
    es: "🖼️ <b>Detalles del contenido</b>\n• Usuario  • Descripción\n• Fecha de subida  • Me gusta\n• Comentarios  • Visualizaciones\n• Reproducciones  • Recompartidos",
    pt: "🖼️ <b>Detalhes da mídia</b>\n• Usuário  • Legenda\n• Data de upload  • Curtidas\n• Comentários  • Visualizações\n• Reproduções  • Compartilhamentos",
    fr: "🖼️ <b>Détails du média</b>\n• Nom d'utilisateur  • Légende\n• Date de publication  • J'aime\n• Commentaires  • Vues\n• Lectures  • Repartages"
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
    hi: "<b>कैसे उपयोग करें:</b>\nबस Instagram लिंक कॉपी करके यहाँ भेजें।\n\nकोई जटिल प्रक्रिया नहीं। बस लिंक भेजें!",
    es: "<b>Cómo usar:</b>\nSolo copia un enlace de Instagram y envíalo aquí.\n\nSin pasos complicados. ¡Solo envía el enlace!",
    pt: "<b>Como usar:</b>\nBasta copiar um link do Instagram e enviá-lo aqui.\n\nSem etapas complicadas. Basta enviar o link!",
    fr: "<b>Comment utiliser :</b>\nCopiez simplement un lien Instagram et envoyez-le ici.\n\nAucune étape compliquée. Envoyez simplement le lien !"
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
    hi: "⏳ <b>काम हो रहा है...</b>\n\n🔎 Instagram लिंक पढ़ा जा रहा है और आपका मीडिया तैयार किया जा रहा है।",
    es: "⏳ <b>Trabajando en ello...</b>\n\n🔎 Leyendo el enlace de Instagram y preparando tu contenido.",
    pt: "⏳ <b>Trabalhando nisso...</b>\n\n🔎 Lendo o link do Instagram e preparando sua mídia.",
    fr: "⏳ <b>En cours de traitement...</b>\n\n🔎 Lecture du lien Instagram et préparation de votre média."
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
    hi: "❌ <b>डाउनलोड सेवा से कनेक्ट नहीं हो सका।</b>\n\nInstagram लिंक जाँचें और थोड़ी देर बाद फिर कोशिश करें।",
    es: "❌ <b>No pude conectarme al servicio de descarga.</b>\n\nRevisa el enlace de Instagram e inténtalo de nuevo en un momento.",
    pt: "❌ <b>Não consegui acessar o serviço de download.</b>\n\nVerifique o link do Instagram e tente novamente em instantes.",
    fr: "❌ <b>Je n'ai pas pu joindre le service de téléchargement.</b>\n\nVérifiez le lien Instagram et réessayez dans un instant."
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
    hi: "⚠️ <b>डाउनलोड सेवा ने अप्रत्याशित जवाब दिया।</b>\n\nInstagram लिंक फिर से भेजें।",
    es: "⚠️ <b>El servicio de descarga devolvió una respuesta inesperada.</b>\n\nInténtalo de nuevo con el enlace de Instagram.",
    pt: "⚠️ <b>O serviço de download retornou uma resposta inesperada.</b>\n\nTente novamente com o link do Instagram.",
    fr: "⚠️ <b>Le service de téléchargement a renvoyé une réponse inattendue.</b>\n\nRéessayez avec le lien Instagram."
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
    hi: "❌ <b>इस Instagram पोस्ट में कोई डाउनलोड करने योग्य मीडिया नहीं मिला।</b>\n\nलिंक जाँचें और फिर कोशिश करें।",
    es: "❌ <b>No encontré contenido descargable en esa publicación de Instagram.</b>\n\nRevisa el enlace e inténtalo de nuevo.",
    pt: "❌ <b>Não encontrei nenhuma mídia para baixar nessa publicação do Instagram.</b>\n\nVerifique o link e tente novamente.",
    fr: "❌ <b>Je n'ai trouvé aucun média téléchargeable dans cette publication Instagram.</b>\n\nVérifiez le lien et réessayez."
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
    hi: "❌ <b>इस Reel में कोई डाउनलोड करने योग्य वीडियो नहीं मिला।</b>\n\nReel लिंक फिर से भेजें।",
    es: "❌ <b>No encontré un video descargable en este reel.</b>\n\nInténtalo de nuevo con el enlace del reel.",
    pt: "❌ <b>Não encontrei um vídeo para baixar neste reel.</b>\n\nTente novamente com o link do reel.",
    fr: "❌ <b>Je n'ai trouvé aucune vidéo téléchargeable dans ce reel.</b>\n\nRéessayez avec le lien du reel."
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
    hi: "⚠️ <b>आपके अनुरोध को प्रोसेस करते समय कुछ अप्रत्याशित हुआ।</b>\n\nInstagram लिंक फिर से भेजें। समस्या बनी रहे तो थोड़ी देर बाद दोबारा कोशिश करें।",
    es: "⚠️ <b>Ocurrió algo inesperado al procesar tu solicitud.</b>\n\nInténtalo de nuevo con el enlace de Instagram. Si el problema continúa, prueba un poco más tarde.",
    pt: "⚠️ <b>Algo inesperado aconteceu ao processar sua solicitação.</b>\n\nTente novamente com o link do Instagram. Se o problema continuar, tente de novo mais tarde.",
    fr: "⚠️ <b>Quelque chose d'inattendu s'est produit lors du traitement de votre demande.</b>\n\nRéessayez avec le lien Instagram. Si le problème persiste, réessayez un peu plus tard."
  },


  needInstagram: {
    en: "📎 <b>I need an Instagram link to get started.</b>\n\n<blockquote>Send me the link to a:\n📸 Post\n🖼️ Carousel\n🎬 Reel\n📖 Story\n✨ Highlight\n👤 Profile</blockquote>\n\n💡 Just copy the Instagram URL and paste it here.",
    ru: "📎 <b>Для начала мне нужна ссылка Instagram.</b>\n\n<blockquote>Отправьте ссылку на:\n📸 Пост\n🖼️ Карусель\n🎬 Reels\n📖 Историю\n✨ Highlight\n👤 Профиль</blockquote>\n\n💡 Просто скопируйте ссылку Instagram и отправьте её сюда.",
    uz: "📎 <b>Boshlash uchun Instagram havolasi kerak.</b>\n\n<blockquote>Quyidagilardan birining havolasini yuboring:\n📸 Post\n🖼️ Karusel\n🎬 Reels\n📖 Hikoya\n✨ Highlight\n👤 Profil</blockquote>\n\n💡 Instagram URL manzilini nusxalab shu yerga yuboring.",
    id: "📎 <b>Saya membutuhkan tautan Instagram untuk memulai.</b>\n\n<blockquote>Kirim tautan:\n📸 Postingan\n🖼️ Carousel\n🎬 Reel\n📖 Story\n✨ Highlight\n👤 Profil</blockquote>\n\n💡 Salin URL Instagram dan kirim ke sini.",
    ar: "📎 <b>أحتاج إلى رابط Instagram للبدء.</b>\n\n<blockquote>أرسل رابط:\n📸 منشور\n🖼️ منشور متعدد\n🎬 Reel\n📖 قصة\n✨ Highlight\n👤 ملف شخصي</blockquote>\n\n💡 انسخ رابط Instagram وأرسله هنا.",
    uk: "📎 <b>Для початку мені потрібне посилання Instagram.</b>\n\n<blockquote>Надішліть посилання на:\n📸 Допис\n🖼️ Карусель\n🎬 Reels\n📖 Історію\n✨ Highlight\n👤 Профіль</blockquote>\n\n💡 Просто скопіюйте URL Instagram і надішліть його сюди.",
    fa: "📎 <b>برای شروع به لینک Instagram نیاز دارم.</b>\n\n<blockquote>لینک یکی از موارد زیر را ارسال کنید:\n📸 پست\n🖼️ کاروسل\n🎬 Reel\n📖 استوری\n✨ Highlight\n👤 پروفایل</blockquote>\n\n💡 لینک Instagram را کپی کرده و اینجا ارسال کنید.",
    tr: "📎 <b>Başlamak için bir Instagram bağlantısına ihtiyacım var.</b>\n\n<blockquote>Şunlardan birinin bağlantısını gönderin:\n📸 Gönderi\n🖼️ Carousel\n🎬 Reel\n📖 Hikâye\n✨ Highlight\n👤 Profil</blockquote>\n\n💡 Instagram URL'sini kopyalayıp buraya gönderin.",
    hi: "📎 <b>शुरू करने के लिए मुझे Instagram लिंक चाहिए।</b>\n\n<blockquote>इनमें से किसी का लिंक भेजें:\n📸 पोस्ट\n🖼️ कैरोसेल\n🎬 Reel\n📖 स्टोरी\n✨ Highlight\n👤 प्रोफ़ाइल</blockquote>\n\n💡 Instagram URL कॉपी करके यहाँ भेजें।",
    es: "📎 <b>Necesito un enlace de Instagram para empezar.</b>\n\n<blockquote>Envíame el enlace de:\n📸 Publicación\n🖼️ Carrusel\n🎬 Reel\n📖 Historia\n✨ Destacado\n👤 Perfil</blockquote>\n\n💡 Solo copia la URL de Instagram y pégala aquí.",
    pt: "📎 <b>Preciso de um link do Instagram para começar.</b>\n\n<blockquote>Envie-me o link de:\n📸 Publicação\n🖼️ Carrossel\n🎬 Reel\n📖 Story\n✨ Destaque\n👤 Perfil</blockquote>\n\n💡 Basta copiar a URL do Instagram e colar aqui.",
    fr: "📎 <b>J'ai besoin d'un lien Instagram pour commencer.</b>\n\n<blockquote>Envoyez-moi le lien d'une :\n📸 Publication\n🖼️ Carrousel\n🎬 Reel\n📖 Story\n✨ À la une\n👤 Profil</blockquote>\n\n💡 Copiez simplement l'URL Instagram et collez-la ici."
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
    hi: "✅ <b>डाउनलोड तैयार है!</b>\n\n📥 <b>instadrop</b> द्वारा भेजा गया",
    es: "✅ <b>¡Descarga lista!</b>\n\n📥 Entregado por <b>instadrop</b>",
    pt: "✅ <b>Download pronto!</b>\n\n📥 Entregue por <b>instadrop</b>",
    fr: "✅ <b>Téléchargement prêt !</b>\n\n📥 Livré par <b>instadrop</b>"
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
    hi: "🖼️ <b>कवर फोटो</b>\n\n✨ यह वह कवर इमेज है जो आपने माँगी थी।",
    es: "🖼️ <b>Foto de portada</b>\n\n✨ Aquí está la imagen de portada que solicitaste.",
    pt: "🖼️ <b>Foto de capa</b>\n\n✨ Aqui está a imagem de capa que você solicitou.",
    fr: "🖼️ <b>Photo de couverture</b>\n\n✨ Voici l'image de couverture que vous avez demandée."
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
    hi: "⏰ <b>माफ़ करें, इस कवर की समय सीमा समाप्त हो गई है।</b>\n\nनई कॉपी बनाने के लिए Instagram लिंक फिर से भेजें।",
    es: "⏰ <b>Lo sentimos, esta portada ha caducado.</b>\n\nEnvía de nuevo el enlace de Instagram para generar una copia nueva.",
    pt: "⏰ <b>Desculpe, esta capa expirou.</b>\n\nEnvie o link do Instagram novamente para gerar uma nova cópia.",
    fr: "⏰ <b>Désolé, cette couverture a expiré.</b>\n\nRenvoyez le lien Instagram pour en générer une nouvelle copie."
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
    hi: "📋 <b>मीडिया विवरण</b>",
    es: "📋 <b>Detalles del contenido</b>",
    pt: "📋 <b>Detalhes da mídia</b>",
    fr: "📋 <b>Détails du média</b>"
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
    hi: "ℹ️ इस मीडिया के लिए कोई अतिरिक्त विवरण उपलब्ध नहीं है।",
    es: "ℹ️ No hay detalles adicionales disponibles para este contenido.",
    pt: "ℹ️ Não há detalhes adicionais disponíveis para esta mídia.",
    fr: "ℹ️ Aucun détail supplémentaire n'est disponible pour ce média."
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
    hi: "⏰ <b>माफ़ करें, इन विवरणों की समय सीमा समाप्त हो गई है।</b>\n\nनई जानकारी पाने के लिए Instagram लिंक फिर से भेजें।",
    es: "⏰ <b>Lo sentimos, estos detalles han caducado.</b>\n\nEnvía de nuevo el enlace de Instagram para obtener información actualizada.",
    pt: "⏰ <b>Desculpe, estes detalhes expiraram.</b>\n\nEnvie o link do Instagram novamente para obter informações atualizadas.",
    fr: "⏰ <b>Désolé, ces détails ont expiré.</b>\n\nRenvoyez le lien Instagram pour obtenir des informations à jour."
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
        },
        {
          text: "🇷🇺 Русский",
          callback_data: "lang:ru"
        }
      ],
      [
        {
          text: "🇺🇿 O‘zbek",
          callback_data: "lang:uz"
        },
        {
          text: "🇮🇩 Bahasa Indonesia",
          callback_data: "lang:id"
        }
      ],
      [
        {
          text: "\u200E🇸🇦 العربية",
          callback_data: "lang:ar"
        },
        {
          text: "🇺🇦 Українська",
          callback_data: "lang:uk"
        }
      ],
      [
        {
          text: "\u200E🇮🇷 فارسی",
          callback_data: "lang:fa"
        },
        {
          text: "🇹🇷 Türkçe",
          callback_data: "lang:tr"
        }
      ],
      [
        {
          text: "🇮🇳 हिन्दी",
          callback_data: "lang:hi"
        },
        {
          text: "🇪🇸 Español",
          callback_data: "lang:es"
        }
      ],
      [
        {
          text: "🇧🇷 Português",
          callback_data: "lang:pt"
        },
        {
          text: "🇫🇷 Français",
          callback_data: "lang:fr"
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


function escapeHtml(text) {

  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");

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
      hi: "✨ Highlight",
      es: "✨ Destacado",
      pt: "✨ Destaque",
      fr: "✨ À la une"
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
      hi: "📖 स्टोरी",
      es: "📖 Historia",
      pt: "📖 Story",
      fr: "📖 Story"
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
      hi: "👤 यूज़रनेम",
      es: "👤 Usuario",
      pt: "👤 Usuário",
      fr: "👤 Nom d'utilisateur"
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
      hi: "📛 नाम",
      es: "📛 Nombre",
      pt: "📛 Nome",
      fr: "📛 Nom"
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
      hi: "📝 बायो",
      es: "📝 Biografía",
      pt: "📝 Bio",
      fr: "📝 Bio"
    };

    lines.push("");

    lines.push(
      `${labels[language]}:`
    );

    lines.push(
      "<blockquote><code>" +
        escapeHtml(
          truncate(
            data.bio,
            1000
          )
        ) +
        "</code></blockquote>"
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
      hi: "👥 फ़ॉलोअर्स",
      es: "👥 Seguidores",
      pt: "👥 Seguidores",
      fr: "👥 Abonnés"
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
      hi: "👤 फ़ॉलोइंग",
      es: "👤 Seguidos",
      pt: "👤 Seguindo",
      fr: "👤 Abonnements"
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
      hi: "📦 पोस्ट",
      es: "📦 Publicaciones",
      pt: "📦 Publicações",
      fr: "📦 Publications"
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
      hi: "✅ वेरिफाइड",
      es: "✅ Verificado",
      pt: "✅ Verificado",
      fr: "✅ Vérifié"
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
      hi: "🔒 प्राइवेट अकाउंट",
      es: "🔒 Cuenta privada",
      pt: "🔒 Conta privada",
      fr: "🔒 Compte privé"
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
      hi: "📝 कैप्शन",
      es: "📝 Descripción",
      pt: "📝 Legenda",
      fr: "📝 Légende"
    };

    lines.push("");

    lines.push(
      `${labels[language]}:`
    );

    lines.push(
      "<blockquote><code>" +
        escapeHtml(
          truncate(
            data.caption,
            2500
          )
        ) +
        "</code></blockquote>"
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
      hi: "📅 तारीख",
      es: "📅 Fecha",
      pt: "📅 Data",
      fr: "📅 Date"
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
      hi: "❤️ लाइक्स",
      es: "❤️ Me gusta",
      pt: "❤️ Curtidas",
      fr: "❤️ J'aime"
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
      hi: "💬 कमेंट्स",
      es: "💬 Comentarios",
      pt: "💬 Comentários",
      fr: "💬 Commentaires"
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
      hi: "👀 व्यूज़",
      es: "👀 Visualizaciones",
      pt: "👀 Visualizações",
      fr: "👀 Vues"
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
      hi: "▶️ प्लेज़",
      es: "▶️ Reproducciones",
      pt: "▶️ Reproduções",
      fr: "▶️ Lectures"
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
      hi: "🔁 रीशेयर्स",
      es: "🔁 Recompartidos",
      pt: "🔁 Compartilhamentos",
      fr: "🔁 Repartages"
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
      hi: "📦 Highlight आइटम",
      es: "📦 Elementos del destacado",
      pt: "📦 Itens do destaque",
      fr: "📦 Éléments du highlight"
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
      hi: "📦 आइटम",
      es: "📦 Elementos",
      pt: "📦 Itens",
      fr: "📦 Éléments"
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
      hi: "✨ <b>Highlight:</b>",
      es: "✨ <b>Destacado:</b>",
      pt: "✨ <b>Destaque:</b>",
      fr: "✨ <b>À la une :</b>"
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
      hi: "📖 <b>स्टोरी</b>",
      es: "📖 <b>Historia</b>",
      pt: "📖 <b>Story</b>",
      fr: "📖 <b>Story</b>"
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
      hi: "📦 <b>आइटम:</b>",
      es: "📦 <b>Elementos:</b>",
      pt: "📦 <b>Itens:</b>",
      fr: "📦 <b>Éléments :</b>"
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
      hi: "📦 <b>आइटम:</b>",
      es: "📦 <b>Elementos:</b>",
      pt: "📦 <b>Itens:</b>",
      fr: "📦 <b>Éléments :</b>"
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
      "📖 <b>instadrop Help</b>\n\nJust send me an Instagram link and I'll handle the rest. 🚀\n\n<b>📥 Supported content</b>\n📸 Posts\n🖼️ Carousels\n🎬 Reels\n📖 Stories\n✨ Highlights\n👤 Profiles\n\n<b>💡 Tip:</b> Copy the Instagram URL and paste it directly into this chat.\n\nNo extra commands are required. ✅",

    ru:
      "📖 <b>Помощь instadrop</b>\n\nПросто отправьте ссылку Instagram, и я всё сделаю сам. 🚀\n\n<b>📥 Поддерживаемый контент</b>\n📸 Посты\n🖼️ Карусели\n🎬 Reels\n📖 Истории\n✨ Highlights\n👤 Профили\n\n<b>💡 Совет:</b> Скопируйте URL Instagram и отправьте его прямо в этот чат.\n\nДополнительные команды не требуются. ✅",

    uz:
      "📖 <b>instadrop Yordam</b>\n\nInstagram havolasini yuboring va qolganini men bajaraman. 🚀\n\n<b>📥 Qo‘llab-quvvatlanadigan kontent</b>\n📸 Postlar\n🖼️ Karusellar\n🎬 Reels\n📖 Hikoyalar\n✨ Highlights\n👤 Profillar\n\n<b>💡 Maslahat:</b> Instagram URL manzilini nusxalab shu chatga yuboring.\n\nQo‘shimcha buyruqlar kerak emas. ✅",

    id:
      "📖 <b>Bantuan instadrop</b>\n\nCukup kirim tautan Instagram dan saya akan mengurus sisanya. 🚀\n\n<b>📥 Konten yang didukung</b>\n📸 Postingan\n🖼️ Carousel\n🎬 Reels\n📖 Story\n✨ Highlight\n👤 Profil\n\n<b>💡 Tips:</b> Salin URL Instagram dan kirim langsung ke chat ini.\n\nTidak diperlukan perintah tambahan. ✅",

    ar:
      "📖 <b>مساعدة instadrop</b>\n\nأرسل رابط Instagram وسأتولى الباقي. 🚀\n\n<b>📥 المحتوى المدعوم</b>\n📸 المنشورات\n🖼️ المنشورات المتعددة\n🎬 Reels\n📖 القصص\n✨ Highlights\n👤 الملفات الشخصية\n\n<b>💡 نصيحة:</b> انسخ رابط Instagram وأرسله مباشرة إلى هذه المحادثة.\n\nلا تحتاج إلى أوامر إضافية. ✅",

    uk:
      "📖 <b>Допомога instadrop</b>\n\nПросто надішліть посилання Instagram, а я зроблю все інше. 🚀\n\n<b>📥 Підтримуваний контент</b>\n📸 Дописи\n🖼️ Каруселі\n🎬 Reels\n📖 Історії\n✨ Highlights\n👤 Профілі\n\n<b>💡 Порада:</b> Скопіюйте URL Instagram і надішліть його прямо в цей чат.\n\nДодаткові команди не потрібні. ✅",

    fa:
      "📖 <b>راهنمای instadrop</b>\n\nفقط لینک Instagram را ارسال کنید و بقیه کارها را من انجام می‌دهم. 🚀\n\n<b>📥 محتوای پشتیبانی‌شده</b>\n📸 پست‌ها\n🖼️ کاروسل‌ها\n🎬 Reels\n📖 استوری‌ها\n✨ Highlights\n👤 پروفایل‌ها\n\n<b>💡 نکته:</b> لینک Instagram را کپی کرده و مستقیماً در این چت ارسال کنید.\n\nبه دستور دیگری نیاز نیست. ✅",

    tr:
      "📖 <b>instadrop Yardım</b>\n\nInstagram bağlantısını gönderin, gerisini ben hallederim. 🚀\n\n<b>📥 Desteklenen içerikler</b>\n📸 Gönderiler\n🖼️ Carousel\n🎬 Reels\n📖 Hikâyeler\n✨ Highlights\n👤 Profiller\n\n<b>💡 İpucu:</b> Instagram URL'sini kopyalayıp doğrudan bu sohbete gönderin.\n\nEkstra komut gerekmez. ✅",

    hi:
      "📖 <b>instadrop सहायता</b>\n\nबस Instagram लिंक भेजें और बाकी काम मैं कर दूँगा। 🚀\n\n<b>📥 सपोर्टेड कंटेंट</b>\n📸 पोस्ट\n🖼️ कैरोसेल\n🎬 Reels\n📖 स्टोरीज़\n✨ Highlights\n👤 प्रोफ़ाइल\n\n<b>💡 टिप:</b> Instagram URL कॉपी करके सीधे इस चैट में भेजें।\n\nकिसी अतिरिक्त कमांड की ज़रूरत नहीं है। ✅",

    es:
      "📖 <b>Ayuda de instadrop</b>\n\nSolo envíame un enlace de Instagram y yo me encargo del resto. 🚀\n\n<b>📥 Contenido compatible</b>\n📸 Publicaciones\n🖼️ Carruseles\n🎬 Reels\n📖 Historias\n✨ Destacados\n👤 Perfiles\n\n<b>💡 Consejo:</b> Copia la URL de Instagram y pégala directamente en este chat.\n\nNo se necesitan comandos adicionales. ✅",

    pt:
      "📖 <b>Ajuda do instadrop</b>\n\nBasta me enviar um link do Instagram e eu cuido do resto. 🚀\n\n<b>📥 Conteúdo suportado</b>\n📸 Publicações\n🖼️ Carrosséis\n🎬 Reels\n📖 Stories\n✨ Destaques\n👤 Perfis\n\n<b>💡 Dica:</b> Copie a URL do Instagram e cole diretamente neste chat.\n\nNenhum comando extra é necessário. ✅",

    fr:
      "📖 <b>Aide instadrop</b>\n\nEnvoyez-moi simplement un lien Instagram et je m'occupe du reste. 🚀\n\n<b>📥 Contenu pris en charge</b>\n📸 Publications\n🖼️ Carrousels\n🎬 Reels\n📖 Stories\n✨ À la une\n👤 Profils\n\n<b>💡 Astuce :</b> Copiez l'URL Instagram et collez-la directement dans ce chat.\n\nAucune commande supplémentaire n'est nécessaire. ✅"
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
// PRIVACY POLICY
// ==================================================

async function sendPrivacyPolicy(
  chatId
) {

  await telegram(
    "sendMessage",
    {
      chat_id:
        chatId,

      text:
        t(
          "privacyPolicy",
          chatId
        ),

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
        en: "en",
        es: "es",
        pt: "pt",
        "pt-br": "pt",
        fr: "fr"
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


      const startPayload =
        text
          .slice(
            "/start".length
          )
          .trim()
          .toLowerCase();


      if (
        startPayload === "privecy"
      ) {

        await sendPrivacyPolicy(
          chatId
        );


        return res
          .status(200)
          .json({
            ok: true
          });

      }


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
    // /PRIVECYPOLICY
    // ==================================================

    if (
      text === "/privecypolicy" ||
      text.startsWith(
        "/privecypolicy "
      )
    ) {

      await sendPrivacyPolicy(
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
