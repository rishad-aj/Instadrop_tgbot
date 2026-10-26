// ==================================================
// INSTADROP TELEGRAM BOT
// VERCEL SERVERLESS FUNCTION
// MULTI-LANGUAGE + MEDIA PROXY + DETAILS & PFP
// ==================================================

// ==================================================
// CONFIGURATION
// ==================================================

const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN || "";
const ADMIN_CHAT_ID = process.env.ADMIN_CHAT_ID;
const API_KEY = process.env.API_KEY || "088697";

const PRIMARY_API_URL =
  process.env.API_URL ||
  "https://instadrop.rishu-rishad2019.workers.dev";

const BACKUP_API_URL = process.env.BACKUP_API_URL || "";

const WELCOME_IMAGE = "https://instadrop.web.app/og-image.png";
const WEBSITE_URL = "https://instadrop.web.app/";


// ==================================================
// PERSISTENT STORAGE (SURVIVES WARM INVOCATIONS)
// ==================================================

const mediaStorage = globalThis.__mediaStorage || (globalThis.__mediaStorage = new Map());
const notifiedUsers = globalThis.__notifiedUsers || (globalThis.__notifiedUsers = new Set());
const userLanguages = globalThis.__userLanguages || (globalThis.__userLanguages = new Map());

const STORAGE_TTL = 30 * 60 * 1000;


// ==================================================
// SUPPORTED LANGUAGES
// ==================================================

const LANGUAGES = {
  en: { name: "English", flag: "🇬🇧" },
  ru: { name: "Русский", flag: "🇷🇺" },
  uz: { name: "O‘zbek", flag: "🇺🇿" },
  id: { name: "Bahasa Indonesia", flag: "🇮🇩" },
  ar: { name: "العربية", flag: "🇸🇦" },
  uk: { name: "Українська", flag: "🇺🇦" },
  fa: { name: "فارسی", flag: "🇮🇷" },
  tr: { name: "Türkçe", flag: "🇹🇷" },
  hi: { name: "हिन्दी", flag: "🇮🇳" },
  es: { name: "Español", flag: "🇪🇸" },
  pt: { name: "Português", flag: "🇧🇷" },
  fr: { name: "Français", flag: "🇫🇷" }
};


// ==================================================
// TRANSLATIONS
// ==================================================

const TEXT = {
  chooseLanguage: {
    en: "🌍 Choose Language",
    ru: "🌍 Выбрать язык",
    uz: "🌍 Tilni tanlash",
    id: "🌍 Pilih Bahasa",
    ar: "🌍 اختر اللغة",
    uk: "🌍 Обрати мову",
    fa: "🌍 انتخاب زبان",
    tr: "🌍 Dil Seçin",
    hi: "🌍 भाषा चुनें",
    es: "🌍 Elegir idioma",
    pt: "🌍 Escolher idioma",
    fr: "🌍 Choisir la langue"
  },

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
    en: "📥 <b>What can I download?</b>\n• Posts  • Carousels  • Reels  • Profiles",
    ru: "📥 <b>Что можно скачать?</b>\n• Посты  • Карусели  • Reels  • Профили",
    uz: "📥 <b>Nimalarni yuklab olish mumkin?</b>\n• Postlar  • Karusellar  • Reels  • Profillar",
    id: "📥 <b>Apa yang bisa saya unduh?</b>\n• Postingan  • Carousel  • Reels  • Profil",
    ar: "📥 <b>ماذا يمكنني تحميله؟</b>\n• المنشورات  • المنشورات المتعددة  • Reels  • الملفات الشخصية",
    uk: "📥 <b>Що можна завантажити?</b>\n• Дописи  • Каруселі  • Reels  • Профілі",
    fa: "📥 <b>چه چیزهایی را می‌توانم دانلود کنم؟</b>\n• پست‌ها  • کاروسل‌ها  • Reels  • پروفایل‌ها",
    tr: "📥 <b>Neleri indirebilirim?</b>\n• Gönderiler  • Carousel  • Reels  • Profiller",
    hi: "📥 <b>मैं क्या डाउनलोड कर सकता हूँ?</b>\n• पोस्ट  • कैरोसेल  • Reels  • प्रोफ़ाइल",
    es: "📥 <b>¿Qué puedo descargar?</b>\n• Publicaciones  • Carruseles  • Reels  • Perfiles",
    pt: "📥 <b>O que posso baixar?</b>\n• Publicações  • Carrosséis  • Reels  • Perfis",
    fr: "📥 <b>Que puis-je télécharger ?</b>\n• Publications  • Carrousels  • Reels  • Profils"
  },

  profileSupport: {
    en: "👤 <b>Profile support</b>\n• Profile picture  • Account details\n• Followers &amp; following  • Post count\n• Name &amp; bio  • Verification status",
    ru: "👤 <b>Поддержка профилей</b>\n• Фото профиля  • Данные аккаунта\n• Подписчики и подписки  • Количество постов\n• Имя и био  • Статус верификации",
    uz: "👤 <b>Profil qo‘llab-quvvatlashi</b>\n• Profil rasmi  • Hisob ma’lumotlari\n• Obunachilar va obunalar  • Postlar soni\n• Ism va bio  • Tasdiqlash holati",
    id: "👤 <b>Dukungan profil</b>\n• Foto profil  • Detail akun\n• Pengikut &amp; mengikuti  • Jumlah postingan\n• Nama &amp; bio  • Status verifikasi",
    ar: "👤 <b>دعم الملفات الشخصية</b>\n• صورة الملف الشخصي  • تفاصيل الحساب\n• المتابعون والمتابَعون  • عدد المنشورات\n• الاسم والسيرة الذاتية  • حالة التحقق",
    uk: "👤 <b>Підтримка профілів</b>\n• Фото профілю  • Дані акаунта\n• Підписники та підписки  • Кількість дописів\n• Ім'я та біо  • Статус верифікації",
    fa: "👤 <b>پشتیبانی از پروفایل</b>\n• عکس پروفایل  • اطلاعات حساب\n• دنبال‌کنندگان و دنبال‌شده‌ها  • تعداد پست‌ها\n• نام و بیو  • وضعیت تأیید",
    tr: "👤 <b>Profil desteği</b>\n• Profil fotoğrafı  • Hesap bilgileri\n• Takipçiler &amp; takip edilenler  • Gönderi sayısı\n• İsim &amp; bio  • Doğrulama durumu",
    hi: "👤 <b>प्रोफ़ाइल सपोर्ट</b>\n• प्रोफ़ाइल फोटो  • अकाउंट विवरण\n• फ़ॉलोअर्स और फ़ॉलोइंग  • पोस्ट की संख्या\n• नाम और बायो  • वेरिफिकेशन स्थिति",
    es: "👤 <b>Compatibilidad con perfiles</b>\n• Foto de perfil  • Datos de la cuenta\n• Seguidores y seguidos  • Número de publicaciones\n• Nombre y biografía  • Estado de verificación",
    pt: "👤 <b>Suporte a perfis</b>\n• Foto de perfil  • Detalhes da conta\n• Seguidores e seguindo  • Número de publicações\n• Nome e bio  • Status de verificação",
    fr: "👤 <b>Prise en charge des profils</b>\n• Photo de profil  • Détails du compte\n• Abonnés &amp; abonnements  • Nombre de publications\n• Nom &amp; bio  • Statut de vérification"
  },

  mediaDetails: {
    en: "🖼️ <b>Media details</b>\n• Username  • Caption\n• Upload date  • Likes\n• Comments  • Views\n• Plays",
    ru: "🖼️ <b>Данные медиа</b>\n• Имя пользователя  • Описание\n• Дата загрузки  • Лайки\n• Комментарии  • Просмотры\n• Воспроизведения",
    uz: "🖼️ <b>Media ma’lumotlari</b>\n• Foydalanuvchi nomi  • Izoh\n• Yuklangan sana  • Layklar\n• Izohlar  • Ko‘rishlar\n• Ko‘rishlar soni",
    id: "🖼️ <b>Detail media</b>\n• Nama pengguna  • Caption\n• Tanggal unggah  • Suka\n• Komentar  • Tayangan\n• Pemutaran",
    ar: "🖼️ <b>تفاصيل الوسائط</b>\n• اسم المستخدم  • الوصف\n• تاريخ الرفع  • الإعجابات\n• التعليقات  • المشاهدات\n• مرات التشغيل",
    uk: "🖼️ <b>Деталі медіа</b>\n• Ім'я користувача  • Підпис\n• Дата завантаження  • Вподобання\n• Коментарі  • Перегляди\n• Відтворення",
    fa: "🖼️ <b>جزئیات رسانه</b>\n• نام کاربری  • کپشن\n• تاریخ انتشار  • لایک‌ها\n• نظرات  • بازدیدها\n• پخش‌ها",
    tr: "🖼️ <b>Medya detayları</b>\n• Kullanıcı adı  • Açıklama\n• Yükleme tarihi  • Beğeniler\n• Yorumlar  • Görüntülenmeler\n• Oynatmalar",
    hi: "🖼️ <b>मीडिया विवरण</b>\n• यूज़रनेम  • कैप्शन\n• अपलोड की तारीख  • लाइक्स\n• कमेंट्स  • व्यूज़\n• प्लेज़",
    es: "🖼️ <b>Detalles del contenido</b>\n• Usuario  • Descripción\n• Fecha de subida  • Me gusta\n• Comentarios  • Visualizaciones\n• Reproducciones",
    pt: "🖼️ <b>Detalhes da mídia</b>\n• Usuário  • Legenda\n• Data de upload  • Curtidas\n• Comentários  • Visualizações\n• Reproduções",
    fr: "🖼️ <b>Détails du média</b>\n• Nom d'utilisateur  • Légende\n• Date de publication  • J'aime\n• Commentaires  • Vues\n• Lectures"
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
    en: "❌ <b>I couldn't find any downloadable media in that Instagram link.</b>\n\nPlease check the link and try again.",
    ru: "❌ <b>Не удалось найти загружаемые медиа в этой ссылке Instagram.</b>\n\nПроверьте ссылку и попробуйте ещё раз.",
    uz: "❌ <b>Ushbu Instagram havolasida yuklab olinadigan media topilmadi.</b>\n\nHavolani tekshirib, qayta urinib ko‘ring.",
    id: "❌ <b>Saya tidak menemukan media yang dapat diunduh di tautan Instagram tersebut.</b>\n\nPeriksa tautannya dan coba lagi.",
    ar: "❌ <b>لم أتمكن من العثور على وسائط قابلة للتحميل في هذا الرابط.</b>\n\nتحقق من الرابط وحاول مرة أخرى.",
    uk: "❌ <b>Не вдалося знайти медіа для завантаження за цим посиланням Instagram.</b>\n\nПеревірте посилання та спробуйте ще раз.",
    fa: "❌ <b>رسانه قابل دانلودی در این لینک Instagram پیدا نشد.</b>\n\nلینک را بررسی کرده و دوباره تلاش کنید.",
    tr: "❌ <b>Bu Instagram bağlantısında indirilebilir medya bulunamadı.</b>\n\nBağlantıyı kontrol edip tekrar deneyin.",
    hi: "❌ <b>इस Instagram लिंक में कोई डाउनलोड करने योग्य मीडिया नहीं मिला।</b>\n\nलिंक जाँचें और फिर कोशिश करें।",
    es: "❌ <b>No encontré contenido descargable en ese enlace de Instagram.</b>\n\nRevisa el enlace e inténtalo de nuevo.",
    pt: "❌ <b>Não encontrei nenhuma mídia para baixar nesse link do Instagram.</b>\n\nVerifique o link e tente novamente.",
    fr: "❌ <b>Je n'ai trouvé aucun média téléchargeable dans ce lien Instagram.</b>\n\nVérifiez le lien et réessayez."
  },

  noVideo: {
    en: "❌ <b>I couldn't find a downloadable video in this reel/post.</b>\n\nPlease try the link again.",
    ru: "❌ <b>Не удалось найти загружаемое видео в этом Reels/посте.</b>\n\nПопробуйте отправить ссылку ещё раз.",
    uz: "❌ <b>Ushbu Reels/postda yuklab olinadigan video topilmadi.</b>\n\nHavolani qayta yuboring.",
    id: "❌ <b>Saya tidak menemukan video yang dapat diunduh di reel/postingan ini.</b>\n\nCoba kirim tautan lagi.",
    ar: "❌ <b>لم أتمكن من العثور على فيديو قابل للتحميل في هذا المنشور.</b>\n\nحاول إرسال الرابط مرة أخرى.",
    uk: "❌ <b>Не вдалося знайти відео для завантаження в цьому Reels/дописі.</b>\n\nСпробуйте надіслати посилання ще раз.",
    fa: "❌ <b>ویدیوی قابل دانلودی در این ریل/پست پیدا نشد.</b>\n\nلینک را دوباره ارسال کنید.",
    tr: "❌ <b>Bu reel/gönderide indirilebilir video bulunamadı.</b>\n\nBağlantıyı tekrar deneyin.",
    hi: "❌ <b>इस Reel/पोस्ट में कोई डाउनलोड करने योग्य वीडियो नहीं मिला।</b>\n\nलिंक फिर से भेजें।",
    es: "❌ <b>No encontré un video descargable en este reel/publicación.</b>\n\nInténtalo de nuevo con el enlace.",
    pt: "❌ <b>Não encontrei um vídeo para baixar neste reel/publicação.</b>\n\nTente novamente com o link.",
    fr: "❌ <b>Je n'ai trouvé aucune vidéo téléchargeable dans ce reel/publication.</b>\n\nRéessayez avec le lien."
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
    en: "📎 <b>I need an Instagram link to get started.</b>\n\n<blockquote>Send me the link to a:\n📸 Post\n🖼️ Carousel\n🎬 Reel\n👤 Profile</blockquote>\n\n💡 Just copy the Instagram URL and paste it here.",
    ru: "📎 <b>Для начала мне нужна ссылка Instagram.</b>\n\n<blockquote>Отправьте ссылку на:\n📸 Пост\n🖼️ Карусель\n🎬 Reels\n👤 Профиль</blockquote>\n\n💡 Просто скопируйте ссылку Instagram и отправьте её сюда.",
    uz: "📎 <b>Boshlash uchun Instagram havolasi kerak.</b>\n\n<blockquote>Quyidagilardan birining havolasini yuboring:\n📸 Post\n🖼️ Karusel\n🎬 Reels\n👤 Profil</blockquote>\n\n💡 Instagram URL manzilini nusxalab shu yerga yuboring.",
    id: "📎 <b>Saya membutuhkan tautan Instagram untuk memulai.</b>\n\n<blockquote>Kirim tautan:\n📸 Postingan\n🖼️ Carousel\n🎬 Reel\n👤 Profil</blockquote>\n\n💡 Salin URL Instagram dan kirim ke sini.",
    ar: "📎 <b>أحتاج إلى رابط Instagram للبدء.</b>\n\n<blockquote>أرسل رابط:\n📸 منشور\n🖼️ منشور متعدد\n🎬 Reel\n👤 ملف شخصي</blockquote>\n\n💡 انسخ رابط Instagram وأرسله هنا.",
    uk: "📎 <b>Для початку мені потрібне посилання Instagram.</b>\n\n<blockquote>Надішліть посилання на:\n📸 Допис\n🖼️ Карусель\n🎬 Reels\n👤 Профіль</blockquote>\n\n💡 Просто скопіюйте URL Instagram і надішліть його сюди.",
    fa: "📎 <b>برای شروع به لینک Instagram نیاز دارم.</b>\n\n<blockquote>لینک یکی از موارد زیر را ارسال کنید:\n📸 پست\n🖼️ کاروسل\n🎬 Reel\n👤 پروفایل</blockquote>\n\n💡 لینک Instagram را کپی کرده و اینجا ارسال کنید.",
    tr: "📎 <b>Başlamak için bir Instagram bağlantısına ihtiyacım var.</b>\n\n<blockquote>Şunlardan birinin bağlantısını gönderin:\n📸 Gönderi\n🖼️ Carousel\n🎬 Reel\n👤 Profil</blockquote>\n\n💡 Instagram URL'sini kopyalayıp buraya gönderin.",
    hi: "📎 <b>शुरू करने के लिए मुझे Instagram लिंक चाहिए।</b>\n\n<blockquote>इनमें से किसी का लिंक भेजें:\n📸 पोस्ट\n🖼️ कैरोसेल\n🎬 Reel\n👤 प्रोफ़ाइल</blockquote>\n\n💡 Instagram URL कॉपी करके यहाँ भेजें।",
    es: "📎 <b>Necesito un enlace de Instagram para empezar.</b>\n\n<blockquote>Envíame el enlace de:\n📸 Publicación\n🖼️ Carrusel\n🎬 Reel\n👤 Perfil</blockquote>\n\n💡 Solo copia la URL de Instagram y pégala aquí.",
    pt: "📎 <b>Preciso de um link do Instagram para começar.</b>\n\n<blockquote>Envie-me o link de:\n📸 Publicação\n🖼️ Carrossel\n🎬 Reel\n👤 Perfil</blockquote>\n\n💡 Basta copiar a URL do Instagram e colar aqui.",
    fr: "📎 <b>J'ai besoin d'un lien Instagram pour commencer.</b>\n\n<blockquote>Envoyez-moi le lien d'une :\n📸 Publication\n🖼️ Carrousel\n🎬 Reel\n👤 Profil</blockquote>\n\n💡 Copiez simplement l'URL Instagram et collez-la ici."
  },

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
    en: "⏰ <b>Cover photo not found.</b>\n\nPlease send the Instagram link again.",
    ru: "⏰ <b>Обложка не найдена.</b>\n\nОтправьте ссылку Instagram ещё раз.",
    uz: "⏰ <b>Muqova topilmadi.</b>\n\nInstagram havolasini qayta yuboring.",
    id: "⏰ <b>Foto sampul tidak ditemukan.</b>\n\nKirim kembali tautan Instagram.",
    ar: "⏰ <b>لم يتم العثور على صورة الغلاف.</b>\n\nأرسل رابط Instagram مرة أخرى.",
    uk: "⏰ <b>Обкладинку не знайдено.</b>\n\nНадішліть посилання Instagram ще раз.",
    fa: "⏰ <b>تصویر کاور پیدا نشد.</b>\n\nلینک Instagram را دوباره ارسال کنید.",
    tr: "⏰ <b>Kapak fotoğrafı bulunamadı.</b>\n\nInstagram bağlantısını tekrar gönderin.",
    hi: "⏰ <b>कवर फोटो नहीं मिला।</b>\n\nInstagram लिंक फिर से भेजें।",
    es: "⏰ <b>No se encontró la foto de portada.</b>\n\nEnvía de nuevo el enlace de Instagram.",
    pt: "⏰ <b>Foto de capa não encontrada.</b>\n\nEnvie o link do Instagram novamente.",
    fr: "⏰ <b>Photo de couverture introuvable.</b>\n\nRenvoyez le lien Instagram."
  },

  profilePicReady: {
    en: "👤 <b>Profile Picture</b>\n\n✨ Here is the profile picture of the author.",
    ru: "👤 <b>Фото профиля</b>\n\n✨ Вот фото профиля автора.",
    uz: "👤 <b>Profil rasmi</b>\n\n✨ Muallifning profil rasmi.",
    id: "👤 <b>Foto Profil</b>\n\n✨ Berikut foto profil pembuat konten.",
    ar: "👤 <b>صورة الملف الشخصي</b>\n\n✨ إليك صورة الملف الشخصي للمؤلف.",
    uk: "👤 <b>Фото профілю</b>\n\n✨ Ось фото профілю автора.",
    fa: "👤 <b>عکس پروفایل</b>\n\n✨ این عکس پروفایل سازنده اثر است.",
    tr: "👤 <b>Profil Fotoğrafı</b>\n\n✨ İşte yazarın profil fotoğrafı.",
    hi: "👤 <b>प्रोफ़ाइल फोटो</b>\n\n✨ यह लेखक की प्रोफ़ाइल फोटो है।",
    es: "👤 <b>Foto de perfil</b>\n\n✨ Aquí está la foto de perfil del autor.",
    pt: "👤 <b>Foto de perfil</b>\n\n✨ Aqui está a foto de perfil do autor.",
    fr: "👤 <b>Photo de profil</b>\n\n✨ Voici la photo de profil de l'auteur."
  },

  profilePicExpired: {
    en: "⏰ <b>Profile picture not available.</b>\n\nPlease send the Instagram link again.",
    ru: "⏰ <b>Фото профиля недоступно.</b>\n\nОтправьте ссылку Instagram ещё раз.",
    uz: "⏰ <b>Profil rasmi mavjud emas.</b>\n\nInstagram havolasini qayta yuboring.",
    id: "⏰ <b>Foto profil tidak tersedia.</b>\n\nKirim kembali tautan Instagram.",
    ar: "⏰ <b>صورة الملف الشخصي غير متوفرة.</b>\n\nأرسل رابط Instagram مرة أخرى.",
    uk: "⏰ <b>Фото профілю недоступне.</b>\n\nНадішліть посилання Instagram ще раз.",
    fa: "⏰ <b>عکس پروفایل در دسترس نیست.</b>\n\nلینک Instagram را دوباره ارسال کنید.",
    tr: "⏰ <b>Profil fotoğrafı kullanılamıyor.</b>\n\nInstagram bağlantısını tekrar gönderin.",
    hi: "⏰ <b>प्रोफ़ाइल फोटो उपलब्ध नहीं है।</b>\n\nInstagram लिंक फिर से भेजें।",
    es: "⏰ <b>Foto de perfil no disponible.</b>\n\nEnvía de nuevo el enlace de Instagram.",
    pt: "⏰ <b>Foto de perfil indisponível.</b>\n\nEnvie o link do Instagram novamente.",
    fr: "⏰ <b>Photo de profil non disponible.</b>\n\nRenvoyez le lien Instagram."
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
    en: "⏰ <b>Sorry, these details are no longer available.</b>\n\nPlease send the Instagram link again.",
    ru: "⏰ <b>Извините, эти данные больше недоступны.</b>\n\nОтправьте ссылку Instagram ещё раз.",
    uz: "⏰ <b>Kechirasiz, bu ma’lumotlar mavjud emas.</b>\n\nInstagram havolasini qayta yuboring.",
    id: "⏰ <b>Maaf, detail ini sudah tidak tersedia.</b>\n\nKirim kembali tautan Instagram.",
    ar: "⏰ <b>عذرًا، لم تعد هذه التفاصيل متوفرة.</b>\n\nأرسل رابط Instagram مرة أخرى.",
    uk: "⏰ <b>На жаль, ці дані більше недоступні.</b>\n\nНадішліть посилання Instagram ще раз.",
    fa: "⏰ <b>متأسفانه این اطلاعات دیگر موجود نیستند.</b>\n\nلینک Instagram را دوباره ارسال کنید.",
    tr: "⏰ <b>Üzgünüz, bu detaylar artık mevcut değil.</b>\n\nInstagram bağlantısını tekrar gönderin.",
    hi: "⏰ <b>माफ़ करें, ये विवरण अब उपलब्ध नहीं हैं।</b>\n\nInstagram लिंक फिर से भेजें।",
    es: "⏰ <b>Lo sentimos, estos detalles ya no están disponibles.</b>\n\nEnvía de nuevo el enlace de Instagram.",
    pt: "⏰ <b>Desculpe, estes detalhes não estão mais disponíveis.</b>\n\nEnvie o link do Instagram novamente.",
    fr: "⏰ <b>Désolé, ces détails ne sont plus disponibles.</b>\n\nRenvoyez le lien Instagram."
  }
};


// ==================================================
// DETAIL / HEADER LABELS
// ==================================================

const LABELS = {
  profile: {
    en: "👤 Profile", ru: "👤 Профиль", uz: "👤 Profil", id: "👤 Profil",
    ar: "👤 ملف شخصي", uk: "👤 Профіль", fa: "👤 پروفایل", tr: "👤 Profil",
    hi: "👤 प्रोफ़ाइल", es: "👤 Perfil", pt: "👤 Perfil", fr: "👤 Profil"
  },
  username: {
    en: "👤 Username", ru: "👤 Имя пользователя", uz: "👤 Foydalanuvchi", id: "👤 Nama pengguna",
    ar: "👤 اسم المستخدم", uk: "👤 Ім'я користувача", fa: "👤 نام کاربری", tr: "👤 Kullanıcı adı",
    hi: "👤 यूज़रनेम", es: "👤 Usuario", pt: "👤 Usuário", fr: "👤 Nom d'utilisateur"
  },
  name: {
    en: "📛 Name", ru: "📛 Имя", uz: "📛 Ism", id: "📛 Nama",
    ar: "📛 الاسم", uk: "📛 Ім'я", fa: "📛 نام", tr: "📛 İsim",
    hi: "📛 नाम", es: "📛 Nombre", pt: "📛 Nome", fr: "📛 Nom"
  },
  bio: {
    en: "📝 Bio", ru: "📝 Био", uz: "📝 Bio", id: "📝 Bio",
    ar: "📝 السيرة الذاتية", uk: "📝 Біо", fa: "📝 بیو", tr: "📝 Bio",
    hi: "📝 बायो", es: "📝 Biografía", pt: "📝 Bio", fr: "📝 Bio"
  },
  followers: {
    en: "👥 Followers", ru: "👥 Подписчики", uz: "👥 Obunachilar", id: "👥 Pengikut",
    ar: "👥 المتابعون", uk: "👥 Підписники", fa: "👥 دنبال‌کنندگان", tr: "👥 Takipçiler",
    hi: "👥 फ़ॉलोअर्स", es: "👥 Seguidores", pt: "👥 Seguidores", fr: "👥 Abonnés"
  },
  following: {
    en: "👤 Following", ru: "👤 Подписки", uz: "👤 Obunalar", id: "👤 Mengikuti",
    ar: "👤 المتابَعون", uk: "👤 Підписки", fa: "👤 دنبال‌شده‌ها", tr: "👤 Takip edilen",
    hi: "👤 फ़ॉलोइंग", es: "👤 Seguidos", pt: "👤 Seguindo", fr: "👤 Abonnements"
  },
  posts: {
    en: "📦 Posts", ru: "📦 Посты", uz: "📦 Postlar", id: "📦 Postingan",
    ar: "📦 المنشورات", uk: "📦 Дописи", fa: "📦 پست‌ها", tr: "📦 Gönderiler",
    hi: "📦 पोस्ट", es: "📦 Publicaciones", pt: "📦 Publicações", fr: "📦 Publications"
  },
  verified: {
    en: "✅ Verified", ru: "✅ Верифицирован", uz: "✅ Tasdiqlangan", id: "✅ Terverifikasi",
    ar: "✅ تم التحقق", uk: "✅ Верифіковано", fa: "✅ تأیید شده", tr: "✅ Doğrulanmış",
    hi: "✅ वेरिफाइड", es: "✅ Verificado", pt: "✅ Verificado", fr: "✅ Vérifié"
  },
  private: {
    en: "🔒 Private Account", ru: "🔒 Приватный аккаунт", uz: "🔒 Yopiq akkaunt", id: "🔒 Akun Privat",
    ar: "🔒 حساب خاص", uk: "🔒 Приватний акаунт", fa: "🔒 حساب خصوصی", tr: "🔒 Gizli Hesap",
    hi: "🔒 प्राइवेट अकाउंट", es: "🔒 Cuenta privada", pt: "🔒 Conta privada", fr: "🔒 Compte privé"
  },
  caption: {
    en: "📝 Caption", ru: "📝 Описание", uz: "📝 Izoh", id: "📝 Caption",
    ar: "📝 الوصف", uk: "📝 Підпис", fa: "📝 کپشن", tr: "📝 Açıklama",
    hi: "📝 कैप्शन", es: "📝 Descripción", pt: "📝 Legenda", fr: "📝 Légende"
  },
  taken: {
    en: "📅 Taken", ru: "📅 Дата", uz: "📅 Sana", id: "📅 Diambil",
    ar: "📅 التاريخ", uk: "📅 Дата", fa: "📅 تاریخ", tr: "📅 Tarih",
    hi: "📅 तारीख", es: "📅 Fecha", pt: "📅 Data", fr: "📅 Date"
  },
  likes: {
    en: "❤️ Likes", ru: "❤️ Лайки", uz: "❤️ Layklar", id: "❤️ Suka",
    ar: "❤️ الإعجابات", uk: "❤️ Вподобання", fa: "❤️ لایک‌ها", tr: "❤️ Beğeniler",
    hi: "❤️ लाइक्स", es: "❤️ Me gusta", pt: "❤️ Curtidas", fr: "❤️ J'aime"
  },
  comments: {
    en: "💬 Comments", ru: "💬 Комментарии", uz: "💬 Izohlar", id: "💬 Komentar",
    ar: "💬 التعليقات", uk: "💬 Коментарі", fa: "💬 نظرات", tr: "💬 Yorumlar",
    hi: "💬 कमेंट्स", es: "💬 Comentarios", pt: "💬 Comentários", fr: "💬 Commentaires"
  },
  views: {
    en: "👀 Views", ru: "👀 Просмотры", uz: "👀 Ko‘rishlar", id: "👀 Tayangan",
    ar: "👀 المشاهدات", uk: "👀 Перегляди", fa: "👀 بازدیدها", tr: "👀 Görüntülenmeler",
    hi: "👀 व्यूज़", es: "👀 Visualizaciones", pt: "👀 Visualizações", fr: "👀 Vues"
  },
  plays: {
    en: "▶️ Plays", ru: "▶️ Воспроизведения", uz: "▶️ Ko‘rishlar", id: "▶️ Pemutaran",
    ar: "▶️ مرات التشغيل", uk: "▶️ Відтворення", fa: "▶️ پخش‌ها", tr: "▶️ Oynatmalar",
    hi: "▶️ प्लेज़", es: "▶️ Reproducciones", pt: "▶️ Reproduções", fr: "▶️ Lectures"
  },
  items: {
    en: "📦 Items", ru: "📦 Элементов", uz: "📦 Elementlar", id: "📦 Item",
    ar: "📦 العناصر", uk: "📦 Елементів", fa: "📦 موارد", tr: "📦 Öğeler",
    hi: "📦 आइटम", es: "📦 Elementos", pt: "📦 Itens", fr: "📦 Éléments"
  }
};

const AUTO_LANGUAGE_MAP = {
  ru: "ru", uk: "uk", uz: "uz", id: "id", ar: "ar", fa: "fa", tr: "tr",
  hi: "hi", en: "en", es: "es", pt: "pt", "pt-br": "pt", fr: "fr"
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
  if (!LANGUAGES[language]) language = "en";
  userLanguages.set(String(chatId), language);
}

function ensureLanguage(chatId, from) {
  if (!chatId || userLanguages.has(String(chatId))) return;
  const code = String(from?.language_code || "").toLowerCase();
  setLanguage(
    chatId,
    AUTO_LANGUAGE_MAP[code] || AUTO_LANGUAGE_MAP[code.split("-")[0]] || "en"
  );
}

function t(key, chatId) {
  const language = getLanguage(chatId);
  return TEXT[key]?.[language] || TEXT[key]?.en || "";
}

function label(key, language) {
  return LABELS[key]?.[language] || LABELS[key]?.en || "";
}

function languageKeyboard() {
  return {
    inline_keyboard: [
      [
        { text: "🇬🇧 English", callback_data: "lang:en" },
        { text: "🇷🇺 Русский", callback_data: "lang:ru" }
      ],
      [
        { text: "🇺🇿 O‘zbek", callback_data: "lang:uz" },
        { text: "🇮🇩 Bahasa Indonesia", callback_data: "lang:id" }
      ],
      [
        { text: "\u200E🇸🇦 العربية", callback_data: "lang:ar" },
        { text: "🇺🇦 Українська", callback_data: "lang:uk" }
      ],
      [
        { text: "\u200E🇮🇷 فارسی", callback_data: "lang:fa" },
        { text: "🇹🇷 Türkçe", callback_data: "lang:tr" }
      ],
      [
        { text: "🇮🇳 हिन्दी", callback_data: "lang:hi" },
        { text: "🇪🇸 Español", callback_data: "lang:es" }
      ],
      [
        { text: "🇧🇷 Português", callback_data: "lang:pt" },
        { text: "🇫🇷 Français", callback_data: "lang:fr" }
      ]
    ]
  };
}


// ==================================================
// TELEGRAM API
// ==================================================

async function telegram(method, payload) {
  if (!TELEGRAM_BOT_TOKEN) {
    throw new Error("TELEGRAM_BOT_TOKEN environment variable is not defined");
  }

  const response = await fetch(
    `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/${method}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(30000)
    }
  );

  let result;
  try {
    result = await response.json();
  } catch {
    throw new Error(`Telegram returned invalid JSON (${response.status})`);
  }

  if (!response.ok || !result.ok) {
    throw new Error(result?.description || `Telegram API error (${response.status})`);
  }

  return result;
}

// Fallback: Upload image buffer directly if Telegram URL fetch fails
async function sendPhotoOrBuffer(chatId, photoUrl, caption = "") {
  try {
    return await telegram("sendPhoto", {
      chat_id: chatId,
      photo: photoUrl,
      caption,
      parse_mode: "HTML"
    });
  } catch (urlError) {
    console.error("sendPhoto by URL failed, attempting buffer upload:", urlError.message);
  }

  const res = await fetch(photoUrl, { signal: AbortSignal.timeout(20000) });
  if (!res.ok) throw new Error(`HTTP ${res.status} from media host`);
  const arrayBuffer = await res.arrayBuffer();
  const blob = new Blob([arrayBuffer], {
    type: res.headers.get("content-type") || "image/jpeg"
  });

  const form = new FormData();
  form.append("chat_id", String(chatId));
  form.append("photo", blob, "image.jpg");
  if (caption) {
    form.append("caption", caption);
    form.append("parse_mode", "HTML");
  }

  const tgRes = await fetch(
    `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendPhoto`,
    { method: "POST", body: form, signal: AbortSignal.timeout(30000) }
  );

  const data = await tgRes.json();
  if (!tgRes.ok || !data.ok) {
    throw new Error(data?.description || `Telegram error (${tgRes.status})`);
  }

  return data;
}


// ==================================================
// BASIC HELPERS
// ==================================================

function isValidUrl(value) {
  return typeof value === "string" && /^https?:\/\//i.test(value);
}

function cleanInstagramUrl(url) {
  if (!url) return null;
  return url.trim().replace(/[)\]}>.,!?]+$/g, "");
}

function findInstagramUrl(text) {
  if (!text) return null;
  const match = text.match(
    /https?:\/\/(?:(?:www|m)\.)?(?:instagram\.com|instagr\.am)\/[^\s<>"']+/i
  );
  if (!match) return null;
  return cleanInstagramUrl(match[0]);
}

function findAnyUrl(text) {
  if (!text) return null;
  const match = text.match(/https?:\/\/[^\s<>"']+/i);
  if (!match) return null;
  return match[0].trim().replace(/[)\]}>.,!?]+$/g, "");
}

function escapeHtml(text) {
  return String(text)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function truncate(text, maxLength = 3900) {
  if (!text) return "";
  const value = String(text);
  if (value.length <= maxLength) return value;
  return value.slice(0, maxLength - 3) + "...";
}

function normalizeUsername(username) {
  if (!username) return null;
  const value = String(username).trim();
  if (!value) return null;
  return value.startsWith("@") ? value : `@${value}`;
}

function formatNumber(num) {
  if (num === undefined || num === null) return null;
  const n = Number(num);
  if (Number.isNaN(n)) return String(num);
  return n.toLocaleString("en-US");
}

function createStorageId() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 8);
}

function hasValue(v) {
  return v !== undefined && v !== null;
}

function parseCommand(text) {
  const m = String(text || "").match(/^\/([a-z0-9_]+)(?:@\w+)?(?:\s+([\s\S]*))?$/i);
  if (!m) return null;
  return { cmd: m[1].toLowerCase(), arg: (m[2] || "").trim().toLowerCase() };
}

async function reactToLink(chatId, messageId) {
  if (!chatId || !messageId) return;
  try {
    await telegram("setMessageReaction", {
      chat_id: chatId,
      message_id: messageId,
      reaction: [{ type: "emoji", emoji: "❤" }],
      is_big: false
    });
  } catch (error) {
    console.error("Heart reaction failed:", error.message);
  }
}

function cleanupStorage() {
  const now = Date.now();
  for (const [id, item] of mediaStorage.entries()) {
    if (!item || !item.createdAt || now - item.createdAt > STORAGE_TTL) {
      mediaStorage.delete(id);
    }
  }
}


// ==================================================
// DYNAMIC PROXY EXTRACTION & REWRITING
// ==================================================

function getProxyBase(data) {
  const candidates = [
    data?.video?.[0]?.video,
    data?.video?.[0]?.cover,
    data?.data?.media?.[0]?.proxy_url,
    data?.data?.media?.[0]?.url,
    Array.isArray(data?.image) ? data.image[0] : null
  ];

  for (const candidate of candidates) {
    if (typeof candidate === "string" && candidate.includes("/proxy?url=")) {
      try {
        const u = new URL(candidate);
        return `${u.protocol}//${u.host}`;
      } catch (e) {}
    }
  }

  for (const base of [PRIMARY_API_URL, BACKUP_API_URL]) {
    if (base && isValidUrl(base)) {
      try {
        const u = new URL(base);
        return `${u.protocol}//${u.host}`;
      } catch (e) {}
    }
  }

  return "https://instadrop.rishu-rishad2019.workers.dev";
}

function ensureProxied(url, data) {
  if (!isValidUrl(url)) return null;
  if (url.includes("/proxy?url=")) return url;

  const isMetaCdn = /cdninstagram\.com|fbcdn\.net|instagram\.com/i.test(url);
  if (!isMetaCdn && !url.includes("instagram")) return url;

  const base = getProxyBase(data);
  const cleanBase = base.trim().replace(/[?&]url=.*$/i, "").replace(/\/+$/, "");
  const keyParam = API_KEY ? `&key=${encodeURIComponent(API_KEY)}` : "";
  return `${cleanBase}/proxy?url=${encodeURIComponent(url)}${keyParam}`;
}


// ==================================================
// RESPONSE TYPE
// ==================================================

function getTypeString(data) {
  return String(data?.type || data?.media_type || data?.mediaType || "").toLowerCase();
}

function getResponseType(data) {
  if (!data || typeof data !== "object") return "post";

  const type = getTypeString(data);
  if (type === "dp" || type === "profile") return "dp";
  if (type === "reel" || type === "reels") return "reel";
  if (type === "carousel" || Array.isArray(data.items)) return "carousel";

  return "post";
}

function isReelResponse(data) {
  if (!data || typeof data !== "object") return false;

  const type = getTypeString(data);
  if (type === "reel" || type === "reels" || type === "video") return true;

  if (
    Array.isArray(data.video) &&
    data.video.length === 1 &&
    (!Array.isArray(data.image) || data.image.length === 0)
  ) {
    return true;
  }

  return false;
}


// ==================================================
// VIDEO, COVER & PROFILE PIC HELPERS
// ==================================================

function getVideoUrlFromObject(item) {
  if (!item || typeof item !== "object") return null;

  const url =
    item.video ||
    item.url ||
    item.proxy_url ||
    item.download_url ||
    item.downloadUrl ||
    item.media_url ||
    item.mediaUrl;

  return isValidUrl(url) ? url : null;
}

function getCoverFromObject(item) {
  if (!item || typeof item !== "object") return null;

  const cover =
    item.cover ||
    item.cover_url ||
    item.coverUrl ||
    item.thumbnail ||
    item.thumbnail_url ||
    item.thumbnailUrl ||
    item.thumb ||
    item.display_url;

  return isValidUrl(cover) ? cover : null;
}

function getReelVideo(data) {
  if (!data) return null;

  if (Array.isArray(data.video)) {
    for (const item of data.video) {
      if (typeof item === "string" && isValidUrl(item)) {
        return ensureProxied(item, data);
      }
      if (item && typeof item === "object") {
        const url = getVideoUrlFromObject(item);
        if (url) return ensureProxied(url, data);
      }
    }
  }

  if (data.video && typeof data.video === "object" && !Array.isArray(data.video)) {
    const url = getVideoUrlFromObject(data.video);
    if (url) return ensureProxied(url, data);
  }

  if (typeof data.video === "string" && isValidUrl(data.video)) {
    return ensureProxied(data.video, data);
  }

  return null;
}

function getCoverUrl(data) {
  if (!data) return null;

  // 1. Check video array objects (frequently contains pre-proxied cover)
  if (Array.isArray(data.video)) {
    for (const item of data.video) {
      if (item && typeof item === "object") {
        const cover = getCoverFromObject(item);
        if (cover) return ensureProxied(cover, data);
      }
    }
  }

  // 2. Search inside data.data.media (worker structured items)
  if (Array.isArray(data.data?.media)) {
    for (const item of data.data.media) {
      const thumb = item.thumbnail_url || item.cover;
      if (isValidUrl(thumb)) return ensureProxied(thumb, data);
    }
  }

  // 3. Direct cover fields
  if (isValidUrl(data.cover)) return ensureProxied(data.cover, data);
  if (isValidUrl(data.cover_url)) return ensureProxied(data.cover_url, data);
  if (isValidUrl(data.thumbnail_url)) return ensureProxied(data.thumbnail_url, data);
  if (isValidUrl(data.display_url)) return ensureProxied(data.display_url, data);

  // 4. Object video
  if (data.video && typeof data.video === "object" && !Array.isArray(data.video)) {
    const cover = getCoverFromObject(data.video);
    if (cover) return ensureProxied(cover, data);
  }

  // 5. Fallback to first image
  if (Array.isArray(data.image) && data.image.length > 0 && isValidUrl(data.image[0])) {
    return ensureProxied(data.image[0], data);
  }

  return null;
}

function getProfilePicUrl(data) {
  if (!data || typeof data !== "object") return null;

  const pic =
    data.profile_pic_url_hd ||
    data.profile_pic_url ||
    data.raw_profile_pic_url_hd ||
    data.data?.owner?.profile_pic_url ||
    data.owner?.profile_pic_url ||
    data.data?.user?.profile_pic_url ||
    data.user?.profile_pic_url;

  if (typeof pic === "string" && isValidUrl(pic)) {
    return ensureProxied(pic, data);
  }

  if (data.type === "dp" && Array.isArray(data.image) && isValidUrl(data.image[0])) {
    return ensureProxied(data.image[0], data);
  }

  return null;
}


// ==================================================
// MEDIA EXTRACTION
// ==================================================

function extractMediaItems(data) {
  const results = [];
  if (!data || typeof data !== "object") return results;

  // 1. Worker Structured Data
  if (Array.isArray(data.data?.media) && data.data.media.length > 0) {
    for (let i = 0; i < data.data.media.length; i++) {
      const m = data.data.media[i];
      const url = m.proxy_url || m.url;
      if (!isValidUrl(url)) continue;

      if (m.type === "video") {
        const cover =
          m.thumbnail_url ||
          m.cover ||
          (Array.isArray(data.video) ? getCoverFromObject(data.video[i]) : null) ||
          getCoverUrl(data);

        results.push({
          url: ensureProxied(url, data),
          type: "video",
          cover: cover ? ensureProxied(cover, data) : null
        });
      } else {
        results.push({
          url: ensureProxied(url, data),
          type: "photo",
          cover: null
        });
      }
    }
    if (results.length > 0) return results;
  }

  // 2. Videos Array
  if (Array.isArray(data.video)) {
    for (const video of data.video) {
      if (typeof video === "string" && isValidUrl(video)) {
        results.push({
          url: ensureProxied(video, data),
          type: "video",
          cover: getCoverUrl(data)
        });
      } else if (video && typeof video === "object") {
        const videoUrl = getVideoUrlFromObject(video);
        if (videoUrl) {
          const cover = getCoverFromObject(video) || getCoverUrl(data);
          results.push({
            url: ensureProxied(videoUrl, data),
            type: "video",
            cover: cover ? ensureProxied(cover, data) : null
          });
        }
      }
    }
  }

  // 3. Images Array
  if (Array.isArray(data.image)) {
    for (const image of data.image) {
      if (typeof image === "string" && isValidUrl(image)) {
        results.push({ url: ensureProxied(image, data), type: "photo", cover: null });
      } else if (image && typeof image === "object") {
        const imageUrl = image.image || image.url || image.proxy_url;
        if (isValidUrl(imageUrl)) {
          results.push({
            url: ensureProxied(imageUrl, data),
            type: "photo",
            cover: null
          });
        }
      }
    }
  }

  // 4. Fallback Single Image / Video strings
  if (results.length === 0) {
    if (typeof data.video === "string" && isValidUrl(data.video)) {
      results.push({
        url: ensureProxied(data.video, data),
        type: "video",
        cover: getCoverUrl(data)
      });
    } else if (typeof data.image === "string" && isValidUrl(data.image)) {
      results.push({
        url: ensureProxied(data.image, data),
        type: "photo",
        cover: null
      });
    }
  }

  return results;
}


// ==================================================
// STORAGE
// ==================================================

function storeMedia({ cover = null, profilePic = null, data = null, parent = null, kind = "media" }) {
  cleanupStorage();

  const id = createStorageId();
  mediaStorage.set(id, {
    cover: isValidUrl(cover) ? cover : null,
    profilePic: isValidUrl(profilePic) ? profilePic : null,
    data,
    parent,
    kind,
    createdAt: Date.now()
  });

  return id;
}


// ==================================================
// BUTTONS (COVER, PROFILE PIC, DETAILS)
// ==================================================

function buildMediaKeyboard(storageId, hasCover, hasProfilePic, shortcode = "") {
  const keyboard = [];
  const actionRow = [];

  const sc = shortcode ? `:${shortcode}` : "";

  if (hasCover) {
    actionRow.push({ text: "🖼️ Cover Photo", callback_data: `cov:${storageId}${sc}` });
  }

  if (hasProfilePic) {
    actionRow.push({ text: "👤 Profile Pic", callback_data: `pfp:${storageId}${sc}` });
  }

  if (actionRow.length > 0) {
    keyboard.push(actionRow);
  }

  keyboard.push([
    { text: "📋 Get Details", callback_data: `det:${storageId}${sc}` }
  ]);

  return { inline_keyboard: keyboard };
}


// ==================================================
// DETAILS FORMATTER (CAPTION & ALL COUNTS)
// ==================================================

function formatDetails(data, parent = null, chatId = null) {
  if (!data || typeof data !== "object") return t("noDetails", chatId);

  const lines = [];
  const language = getLanguage(chatId);
  const currentType = getResponseType(data);

  if (currentType === "dp") {
    lines.push(`<b>${label("profile", language)}</b>`);
  }

  const username = normalizeUsername(
    data.username || data.user || data.author || data.data?.owner?.username
  );
  if (username) lines.push(`${label("username", language)}: ${escapeHtml(username)}`);

  const fullName = data.full_name || data.data?.owner?.full_name;
  if (fullName) {
    lines.push(`${label("name", language)}: ${escapeHtml(fullName)}`);
  }

  if (data.bio) {
    lines.push("");
    lines.push(`${label("bio", language)}:`);
    lines.push(
      "<blockquote>" + escapeHtml(truncate(data.bio, 1000)) + "</blockquote>"
    );
  }

  // User engagement metrics
  const likes = hasValue(data.like_count) ? data.like_count : data.data?.metrics?.likes;
  if (hasValue(likes)) {
    lines.push(`${label("likes", language)}: <b>${formatNumber(likes)}</b>`);
  }

  const comments = hasValue(data.comment_count) ? data.comment_count : data.data?.metrics?.comments;
  if (hasValue(comments)) {
    lines.push(`${label("comments", language)}: <b>${formatNumber(comments)}</b>`);
  }

  const views = hasValue(data.view_count) ? data.view_count : data.data?.metrics?.views;
  if (hasValue(views) && Number(views) > 0) {
    lines.push(`${label("views", language)}: <b>${formatNumber(views)}</b>`);
  }

  const plays = hasValue(data.play_count) ? data.play_count : data.data?.metrics?.views;
  if (hasValue(plays) && Number(plays) > 0) {
    lines.push(`${label("plays", language)}: <b>${formatNumber(plays)}</b>`);
  }

  // Profile counts
  if (hasValue(data.follower_count)) {
    lines.push(`${label("followers", language)}: <b>${formatNumber(data.follower_count)}</b>`);
  }

  if (hasValue(data.following_count)) {
    lines.push(`${label("following", language)}: <b>${formatNumber(data.following_count)}</b>`);
  }

  if (hasValue(data.post_count)) {
    lines.push(`${label("posts", language)}: <b>${formatNumber(data.post_count)}</b>`);
  }

  const isVerified = data.is_verified ?? data.data?.owner?.is_verified;
  if (isVerified) lines.push(label("verified", language));
  if (data.is_private) lines.push(label("private", language));

  // Date taken
  const takenAt = data.taken_at || data.data?.created_at;
  if (takenAt) {
    let takenStr = takenAt;
    if (typeof takenAt === "number" || /^\d{10}$/.test(String(takenAt))) {
      try {
        takenStr = new Date(Number(takenAt) * 1000).toUTCString();
      } catch (e) {}
    }
    lines.push(`${label("taken", language)}: ${escapeHtml(takenStr)}`);
  }

  // Items count in carousels
  const mediaCount =
    data.data?.media_count ??
    data.data?.media?.length ??
    (Array.isArray(data.items) ? data.items.length : null);

  if (hasValue(mediaCount) && Number(mediaCount) > 1) {
    lines.push(`${label("items", language)}: <b>${mediaCount}</b>`);
  }

  // Caption Display
  const captionText = data.caption || data.data?.caption;
  if (captionText) {
    lines.push("");
    lines.push(`${label("caption", language)}:`);
    lines.push(
      "<blockquote>" + escapeHtml(truncate(captionText, 2500)) + "</blockquote>"
    );
  }

  if (!lines.length) return t("noDetails", chatId);

  return truncate(lines.join("\n"), 3900);
}


// ==================================================
// SEND MEDIA
// ==================================================

async function sendMedia(chatId, media, data, parent = null) {
  if (!media || !isValidUrl(media.url)) return;

  const coverUrl = media.cover || getCoverUrl(data);
  const profilePicUrl = getProfilePicUrl(data);
  const shortcode = data?.shortcode || data?.data?.shortcode || "";

  const storageId = storeMedia({
    cover: coverUrl,
    profilePic: profilePicUrl,
    data,
    parent,
    kind: "media"
  });

  const keyboard = buildMediaKeyboard(
    storageId,
    Boolean(coverUrl),
    Boolean(profilePicUrl),
    shortcode
  );

  const caption = t("downloadReady", chatId);

  if (media.type === "video") {
    try {
      await telegram("sendVideo", {
        chat_id: chatId,
        video: media.url,
        caption,
        parse_mode: "HTML",
        supports_streaming: true,
        reply_markup: keyboard
      });
      return;
    } catch (error) {
      console.error("sendVideo failed:", error.message);

      try {
        await telegram("sendDocument", {
          chat_id: chatId,
          document: media.url,
          caption,
          parse_mode: "HTML",
          reply_markup: keyboard
        });
        return;
      } catch (fallbackError) {
        console.error("Video document fallback failed:", fallbackError.message);
      }
    }

    try {
      await telegram("sendMessage", {
        chat_id: chatId,
        text: t("mediaNotFound", chatId),
        parse_mode: "HTML"
      });
    } catch (e) {
      console.error("Failed to send media error:", e.message);
    }
    return;
  }

  try {
    await telegram("sendPhoto", {
      chat_id: chatId,
      photo: media.url,
      caption,
      parse_mode: "HTML",
      reply_markup: keyboard
    });
  } catch (error) {
    console.error("sendPhoto failed:", error.message);

    try {
      await telegram("sendDocument", {
        chat_id: chatId,
        document: media.url,
        caption,
        parse_mode: "HTML",
        reply_markup: keyboard
      });
    } catch (fallbackError) {
      console.error("Photo document fallback failed:", fallbackError.message);

      try {
        await telegram("sendMessage", {
          chat_id: chatId,
          text: t("mediaNotFound", chatId),
          parse_mode: "HTML"
        });
      } catch (e) {
        console.error("Failed to send media error:", e.message);
      }
    }
  }
}


// ==================================================
// ADMIN NOTIFICATION
// ==================================================

async function notifyAdmin(chatId, user) {
  if (!ADMIN_CHAT_ID) return;

  const key = String(chatId);
  if (notifiedUsers.has(key)) return;
  notifiedUsers.add(key);

  const firstName = user?.first_name || "Unknown";
  const username = normalizeUsername(user?.username);

  const lines = [
    "👤 <b>New instadrop user</b>",
    "",
    `Chat ID: <code>${escapeHtml(chatId)}</code>`,
    `Name: ${escapeHtml(firstName)}`
  ];

  if (username) lines.push(`Username: ${escapeHtml(username)}`);

  try {
    await telegram("sendMessage", {
      chat_id: ADMIN_CHAT_ID,
      text: lines.join("\n"),
      parse_mode: "HTML"
    });
  } catch (error) {
    console.error("Admin notification failed:", error.message);
  }
}


// ==================================================
// WELCOME / LANGUAGE / HELP / PRIVACY
// ==================================================

async function sendWelcome(chatId) {
  const welcomeCaption =
    t("welcomeTitle", chatId) + "\n\n" +
    "<blockquote>" + t("whatDownload", chatId) + "</blockquote>\n" +
    "<blockquote>" + t("profileSupport", chatId) + "</blockquote>\n" +
    "<blockquote>" + t("mediaDetails", chatId) + "</blockquote>\n\n" +
    t("howToUse", chatId);

  const welcomeKeyboard = {
    inline_keyboard: [
      [{ text: t("chooseLanguage", chatId), callback_data: "open_language" }],
      [{ text: "🌐 Open instadrop", url: WEBSITE_URL }]
    ]
  };

  if (welcomeCaption.length <= 1024) {
    try {
      await telegram("sendPhoto", {
        chat_id: chatId,
        photo: WELCOME_IMAGE,
        caption: welcomeCaption,
        parse_mode: "HTML",
        reply_markup: welcomeKeyboard
      });
      return;
    } catch (error) {
      console.error("Welcome photo failed:", error.message);
    }
  }

  try {
    await telegram("sendPhoto", {
      chat_id: chatId,
      photo: WELCOME_IMAGE,
      reply_markup: welcomeKeyboard
    });
  } catch (error) {
    console.error("Welcome image-only failed:", error.message);
  }

  await telegram("sendMessage", {
    chat_id: chatId,
    text: welcomeCaption,
    parse_mode: "HTML",
    reply_markup: welcomeKeyboard
  });
}

async function sendLanguageMenu(chatId) {
  await telegram("sendMessage", {
    chat_id: chatId,
    text: t("languageTitle", chatId),
    parse_mode: "HTML",
    reply_markup: languageKeyboard()
  });
}

async function sendPrivacyPolicy(chatId) {
  await telegram("sendMessage", {
    chat_id: chatId,
    text: t("privacyPolicy", chatId),
    parse_mode: "HTML"
  });
}


// ==================================================
// CALLBACK HANDLER
// ==================================================

async function answerCallback(callbackId, extra = {}) {
  try {
    await telegram("answerCallbackQuery", { callback_query_id: callbackId, ...extra });
  } catch (error) {
    console.error("answerCallbackQuery failed:", error.message);
  }
}

async function handleCallback(callback) {
  const callbackId = callback.id;
  const chatId = callback.message?.chat?.id;
  const callbackData = callback.data || "";

  ensureLanguage(chatId, callback.from);

  // OPEN LANGUAGE MENU
  if (callbackData === "open_language") {
    await answerCallback(callbackId);
    if (chatId) await sendLanguageMenu(chatId);
    return;
  }

  // LANGUAGE SELECTION
  if (callbackData.startsWith("lang:")) {
    const language = callbackData.slice("lang:".length);

    if (!LANGUAGES[language]) {
      await answerCallback(callbackId, { text: "Invalid language.", show_alert: false });
      return;
    }

    setLanguage(chatId, language);
    await answerCallback(callbackId, { text: LANGUAGES[language].name, show_alert: false });

    if (!chatId) return;

    try {
      await telegram("editMessageText", {
        chat_id: chatId,
        message_id: callback.message?.message_id,
        text: t("languageChanged", chatId),
        parse_mode: "HTML"
      });
    } catch (error) {
      console.error("Language message edit failed:", error.message);

      await telegram("sendMessage", {
        chat_id: chatId,
        text: t("languageChanged", chatId),
        parse_mode: "HTML"
      });
    }

    return;
  }

  await answerCallback(callbackId);
  if (!chatId) return;

  // GET COVER PHOTO
  if (callbackData.startsWith("get_cover:") || callbackData.startsWith("cov:")) {
    const raw = callbackData.replace(/^(get_cover:|cov:)/, "");
    const [storageId, shortcode] = raw.split(":");

    cleanupStorage();
    let stored = mediaStorage.get(storageId);

    // Auto-recover on Vercel cold starts
    if (!stored?.cover && shortcode) {
      try {
        const fallbackUrl = `https://www.instagram.com/p/${shortcode}/`;
        const res = await fetchApiWithFallback(fallbackUrl);
        const refetched = await res.json();
        if (refetched?.success !== false) {
          const freshCover = getCoverUrl(refetched);
          if (freshCover) {
            stored = { ...(stored || {}), cover: freshCover, data: refetched };
            mediaStorage.set(storageId, stored);
          }
        }
      } catch (e) {
        console.error("Cover cold-start recovery failed:", e.message);
      }
    }

    if (!stored || !stored.cover) {
      await telegram("sendMessage", {
        chat_id: chatId,
        text: t("coverExpired", chatId),
        parse_mode: "HTML"
      });
      return;
    }

    try {
      await sendPhotoOrBuffer(chatId, stored.cover, t("coverPhoto", chatId));
    } catch (error) {
      console.error("Cover photo send failed:", error.message);
      await telegram("sendMessage", {
        chat_id: chatId,
        text: t("coverExpired", chatId),
        parse_mode: "HTML"
      });
    }

    return;
  }

  // GET PROFILE PICTURE
  if (callbackData.startsWith("get_pfp:") || callbackData.startsWith("pfp:")) {
    const raw = callbackData.replace(/^(get_pfp:|pfp:)/, "");
    const [storageId, shortcode] = raw.split(":");

    cleanupStorage();
    let stored = mediaStorage.get(storageId);

    // Auto-recover on Vercel cold starts
    if (!stored?.profilePic && shortcode) {
      try {
        const fallbackUrl = `https://www.instagram.com/p/${shortcode}/`;
        const res = await fetchApiWithFallback(fallbackUrl);
        const refetched = await res.json();
        if (refetched?.success !== false) {
          const freshPic = getProfilePicUrl(refetched);
          if (freshPic) {
            stored = { ...(stored || {}), profilePic: freshPic, data: refetched };
            mediaStorage.set(storageId, stored);
          }
        }
      } catch (e) {
        console.error("Profile picture cold-start recovery failed:", e.message);
      }
    }

    if (!stored || !stored.profilePic) {
      await telegram("sendMessage", {
        chat_id: chatId,
        text: t("profilePicExpired", chatId),
        parse_mode: "HTML"
      });
      return;
    }

    try {
      await sendPhotoOrBuffer(chatId, stored.profilePic, t("profilePicReady", chatId));
    } catch (error) {
      console.error("Profile picture send failed:", error.message);
      await telegram("sendMessage", {
        chat_id: chatId,
        text: t("profilePicExpired", chatId),
        parse_mode: "HTML"
      });
    }

    return;
  }

  // GET DETAILS
  if (callbackData.startsWith("get_details:") || callbackData.startsWith("det:")) {
    const raw = callbackData.replace(/^(get_details:|det:)/, "");
    const [storageId, shortcode] = raw.split(":");

    cleanupStorage();
    let stored = mediaStorage.get(storageId);

    // Auto-recover on Vercel cold starts
    if (!stored?.data && shortcode) {
      try {
        const fallbackUrl = `https://www.instagram.com/p/${shortcode}/`;
        const res = await fetchApiWithFallback(fallbackUrl);
        const refetched = await res.json();
        if (refetched?.success !== false) {
          stored = { ...(stored || {}), data: refetched };
          mediaStorage.set(storageId, stored);
        }
      } catch (e) {
        console.error("Details cold-start recovery failed:", e.message);
      }
    }

    if (!stored || !stored.data) {
      await telegram("sendMessage", {
        chat_id: chatId,
        text: t("detailsExpired", chatId),
        parse_mode: "HTML"
      });
      return;
    }

    const details = formatDetails(stored.data, stored.parent, chatId);

    await telegram("sendMessage", {
      chat_id: chatId,
      text: `${t("detailsTitle", chatId)}\n\n${details}`,
      parse_mode: "HTML"
    });

    return;
  }
}


// ==================================================
// DELETE TEMPORARY STATUS MESSAGE
// ==================================================

async function deleteStatusMessage(chatId, messageId) {
  if (!chatId || !messageId) return;

  try {
    await telegram("deleteMessage", { chat_id: chatId, message_id: messageId });
  } catch (error) {
    console.error("Temporary status deletion failed:", error.message);
  }
}


// ==================================================
// API FETCH (WORKER PROXY & DIRECT JSON)
// ==================================================

function buildWorkerUrl(baseUrl, instagramUrl, key) {
  const cleanBase = baseUrl.trim().replace(/[?&]url=.*$/i, "");
  const u = new URL(cleanBase);
  u.searchParams.set("url", instagramUrl);
  if (key) {
    u.searchParams.set("key", key);
  }
  return u.toString();
}

async function fetchApiWithFallback(instagramUrl) {
  const bases = [PRIMARY_API_URL, BACKUP_API_URL].filter(Boolean);
  const headers = { Accept: "application/json" };

  if (API_KEY) {
    headers["x-api-key"] = API_KEY;
  }

  let lastError = null;
  let lastResponse = null;

  for (const base of bases) {
    try {
      const targetEndpoint = buildWorkerUrl(base, instagramUrl, API_KEY);
      const r = await fetch(targetEndpoint, {
        method: "GET",
        headers,
        signal: AbortSignal.timeout(60000)
      });

      if (r.status >= 500) {
        lastResponse = r;
        lastError = new Error(`API ${r.status} from ${base}`);
        continue;
      }

      return r;
    } catch (e) {
      lastError = e;
    }
  }

  if (lastResponse) return lastResponse;
  throw lastError || new Error("All APIs failed");
}


// ==================================================
// PROCESS INSTAGRAM URL
// ==================================================

async function sendApiError(chatId, statusMessageId, message) {
  await deleteStatusMessage(chatId, statusMessageId);

  await telegram("sendMessage", {
    chat_id: chatId,
    text: `❌ <b>${escapeHtml(truncate(message, 500))}</b>\n\n` + t("needInstagram", chatId),
    parse_mode: "HTML"
  });
}

async function sendPlain(chatId, statusMessageId, key) {
  await deleteStatusMessage(chatId, statusMessageId);

  await telegram("sendMessage", {
    chat_id: chatId,
    text: t(key, chatId),
    parse_mode: "HTML"
  });
}

function errorToText(value, fallback) {
  if (!value) return fallback;
  if (typeof value === "string") return value;
  try {
    return JSON.stringify(value);
  } catch {
    return fallback;
  }
}

async function processInstagramUrl(chatId, instagramUrl) {
  let statusMessageId = null;

  try {
    const statusResponse = await telegram("sendMessage", {
      chat_id: chatId,
      text: t("working", chatId),
      parse_mode: "HTML"
    });

    statusMessageId = statusResponse?.result?.message_id || null;
  } catch (error) {
    console.error("Status message failed:", error.message);
  }

  let response;
  try {
    response = await fetchApiWithFallback(instagramUrl);
  } catch (error) {
    console.error("API request failed:", error.message);
    await sendPlain(chatId, statusMessageId, "serviceUnreachable");
    return;
  }

  let data;
  try {
    data = await response.json();
  } catch {
    await sendPlain(chatId, statusMessageId, "unexpectedResponse");
    return;
  }

  if (!response.ok || (data && data.success === false) || (data && data.p === false)) {
    const errMsg = errorToText(
      data?.error || data?.message,
      "The download could not be completed. The post might be private, deleted, or rate-limited."
    );
    await sendApiError(chatId, statusMessageId, errMsg);
    return;
  }

  if (!data || typeof data !== "object") {
    await sendPlain(chatId, statusMessageId, "unexpectedResponse");
    return;
  }

  const responseType = getResponseType(data);

  // Single Reel or Single Video Post
  if (responseType === "reel" || isReelResponse(data)) {
    const videoUrl = getReelVideo(data);

    if (!videoUrl) {
      await sendPlain(chatId, statusMessageId, "noVideo");
      return;
    }

    const reelCover = getCoverUrl(data);
    await sendMedia(
      chatId,
      { url: videoUrl, type: "video", cover: reelCover },
      data,
      null
    );

    await deleteStatusMessage(chatId, statusMessageId);
    return;
  }

  // Profile Picture (DP) or Carousel or Image Post
  const mediaItems = extractMediaItems(data);

  if (!mediaItems.length) {
    await sendPlain(chatId, statusMessageId, "mediaNotFound");
    return;
  }

  for (const media of mediaItems) {
    await sendMedia(chatId, media, data, null);
  }

  await deleteStatusMessage(chatId, statusMessageId);
}


// ==================================================
// VERCEL WEBHOOK HANDLER
// ==================================================

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(200).json({
      ok: true,
      message: "instadrop Telegram bot is running."
    });
  }

  let errorChatId = null;

  try {
    const update = req.body || {};

    // CALLBACK QUERY
    if (update.callback_query) {
      errorChatId = update.callback_query.message?.chat?.id;
      await handleCallback(update.callback_query);
      return res.status(200).json({ ok: true });
    }

    // MESSAGE
    if (!update.message) {
      return res.status(200).json({ ok: true });
    }

    const message = update.message;
    const chatId = message.chat?.id;
    errorChatId = chatId;

    if (!chatId) {
      return res.status(200).json({ ok: true });
    }

    const text = message.text || message.caption || "";

    ensureLanguage(chatId, message.from);

    // REACT TO ANY LINK
    if (findAnyUrl(text)) {
      await reactToLink(chatId, message.message_id);
    }

    // COMMANDS
    const command = parseCommand(text);

    if (command) {
      const { cmd, arg } = command;

      if (cmd === "start") {
        await notifyAdmin(chatId, message.from);

        if (arg === "privecy" || arg === "privacy") {
          await sendPrivacyPolicy(chatId);
        } else {
          await sendWelcome(chatId);
        }
        return res.status(200).json({ ok: true });
      }

      if (cmd === "language") {
        await sendLanguageMenu(chatId);
        return res.status(200).json({ ok: true });
      }

      if (
        cmd === "privecypolicy" ||
        cmd === "privacypolicy" ||
        cmd === "privacy"
      ) {
        await sendPrivacyPolicy(chatId);
        return res.status(200).json({ ok: true });
      }
    }

    // INSTAGRAM URL
    const instagramUrl = findInstagramUrl(text);

    if (!instagramUrl) {
      await telegram("sendMessage", {
        chat_id: chatId,
        text: t("needInstagram", chatId),
        parse_mode: "HTML"
      });
      return res.status(200).json({ ok: true });
    }

    // PROCESS DOWNLOAD
    await processInstagramUrl(chatId, instagramUrl);
    return res.status(200).json({ ok: true });

  } catch (error) {
    console.error("Webhook error:", error);

    try {
      if (errorChatId) {
        await telegram("sendMessage", {
          chat_id: errorChatId,
          text: t("unexpected", errorChatId),
          parse_mode: "HTML"
        });
      }
    } catch (telegramError) {
      console.error("Failed to send error message:", telegramError.message);
    }

    return res.status(200).json({ ok: true });
  }
}
