import AsyncStorage from '@react-native-async-storage/async-storage';
import { proxyTranslate, proxyDetectLanguage } from './ai/aiProxyClient';

// Supported languages
export type SupportedLanguage = 'en' | 'hi' | 'ml' | 'ta' | 'te' | 'kn' | 'mr' | 'bn';

// Translation result interface
export interface TranslationResult {
  originalText: string;
  translatedText: string;
  sourceLanguage: string;
  targetLanguage: string;
  confidence?: number;
}

// Translation cache entry
interface CacheEntry {
  text: string;
  timestamp: number;
  confidence?: number;
}

// Translation cache structure
interface TranslationCache {
  [sourceText: string]: {
    [targetLang: string]: CacheEntry;
  };
}

// Translation is served by the `ai-translate` edge function (AWS Translate +
// Comprehend). There is deliberately no provider configuration here: the previous
// AZURE_CONFIG read EXPO_PUBLIC_AZURE_TRANSLATOR_KEY with a live key hardcoded as
// a fallback, so the subscription key was inlined into the JS bundle and
// recoverable from any shipped APK — and it leaked even when the env var was set.

// Cache configuration
const CACHE_CONFIG = {
  maxEntries: 2000, // Increased for more cached translations
  expiryMs: 30 * 24 * 60 * 60 * 1000, // 30 days (increased from 7)
  // Storage key retained so existing installs keep their warm cache across the
  // provider change. Translations are provider-agnostic strings.
  storageKey: 'azure_translation_cache',
};

/**
 * Static translations for common UI terms that need proper context
 * These are pre-translated to ensure correct contextual meaning
 * (e.g., "Orders" as shopping orders, not commands/instructions)
 */
const STATIC_TRANSLATIONS: Record<string, Record<SupportedLanguage, string>> = {
  // Order-related (shopping/purchase context)
  'View All Orders': {
    en: 'View All Orders',
    hi: 'सभी ऑर्डर देखें',
    ml: 'എല്ലാ ഓർഡറുകളും കാണുക',
    ta: 'அனைத்து ஆர்டர்களையும் காண்க',
    te: 'అన్ని ఆర్డర్‌లు చూడండి',
    kn: 'ಎಲ್ಲಾ ಆರ್ಡರ್‌ಗಳನ್ನು ವೀಕ್ಷಿಸಿ',
    mr: 'सर्व ऑर्डर पहा',
    bn: 'সমস্ত অর্ডার দেখুন',
  },
  'Other Active Orders': {
    en: 'Other Active Orders',
    hi: 'अन्य सक्रिय ऑर्डर',
    ml: 'മറ്റ് സജീവ ഓർഡറുകൾ',
    ta: 'மற்ற செயலில் உள்ள ஆர்டர்கள்',
    te: 'ఇతర యాక్టివ్ ఆర్డర్‌లు',
    kn: 'ಇತರ ಸಕ್ರಿಯ ಆರ್ಡರ್‌ಗಳು',
    mr: 'इतर सक्रिय ऑर्डर',
    bn: 'অন্যান্য সক্রিয় অর্ডার',
  },
  // Order tracking status
  'Placed': {
    en: 'Placed',
    hi: 'प्लेस किया गया',
    ml: 'ഓർഡർ ചെയ്തു',
    ta: 'ஆர்டர் செய்யப்பட்டது',
    te: 'ఆర్డర్ చేయబడింది',
    kn: 'ಆರ್ಡರ್ ಮಾಡಲಾಗಿದೆ',
    mr: 'ऑर्डर केला',
    bn: 'অর্ডার দেওয়া হয়েছে',
  },
  'Confirmed': {
    en: 'Confirmed',
    hi: 'पुष्टि की गई',
    ml: 'സ്ഥിരീകരിച്ചു',
    ta: 'உறுதிப்படுத்தப்பட்டது',
    te: 'నిర్ధారించబడింది',
    kn: 'ದೃಢೀಕರಿಸಲಾಗಿದೆ',
    mr: 'पुष्टी झाली',
    bn: 'নিশ্চিত করা হয়েছে',
  },
  'Picked up': {
    en: 'Picked up',
    hi: 'पिक अप किया गया',
    ml: 'എടുത്തു',
    ta: 'எடுக்கப்பட்டது',
    te: 'పికప్ చేయబడింది',
    kn: 'ಪಿಕ್ ಅಪ್ ಮಾಡಲಾಗಿದೆ',
    mr: 'उचलले',
    bn: 'পিক আপ করা হয়েছে',
  },
  'In transit': {
    en: 'In transit',
    hi: 'रास्ते में',
    ml: 'വഴിയിൽ',
    ta: 'போக்குவரத்தில்',
    te: 'రవాణాలో ఉంది',
    kn: 'ಸಾಗಣೆಯಲ್ಲಿ',
    mr: 'वाटेत',
    bn: 'পথে আছে',
  },
  'Delivered': {
    en: 'Delivered',
    hi: 'डिलीवर किया गया',
    ml: 'ഡെലിവർ ചെയ്തു',
    ta: 'டெலிவரி செய்யப்பட்டது',
    te: 'డెలివరీ అయింది',
    kn: 'ವಿತರಿಸಲಾಗಿದೆ',
    mr: 'वितरित केले',
    bn: 'ডেলিভারি হয়েছে',
  },
  // Home screen sections
  'Nearby Wholesalers': {
    en: 'Nearby Wholesalers',
    hi: 'पास के थोक विक्रेता',
    ml: 'സമീപത്തുള്ള മൊത്തവ്യാപാരികൾ',
    ta: 'அருகிலுள்ள மொத்த விற்பனையாளர்கள்',
    te: 'సమీపంలోని హోల్‌సేలర్లు',
    kn: 'ಹತ್ತಿರದ ಸಗಟು ವ್ಯಾಪಾರಿಗಳು',
    mr: 'जवळचे घाऊक विक्रेते',
    bn: 'কাছের পাইকারী বিক্রেতা',
  },
  'Nearby Manufacturers': {
    en: 'Nearby Manufacturers',
    hi: 'पास के निर्माता',
    ml: 'സമീപത്തുള്ള നിർമ്മാതാക്കൾ',
    ta: 'அருகிலுள்ள உற்பத்தியாளர்கள்',
    te: 'సమీపంలోని తయారీదారులు',
    kn: 'ಹತ್ತಿರದ ತಯಾರಕರು',
    mr: 'जवळचे उत्पादक',
    bn: 'কাছের প্রস্তুতকারক',
  },
  // AI Assistant labels
  'Press & Hold for AI': {
    en: 'Press & Hold for AI',
    hi: 'AI के लिए दबाकर रखें',
    ml: 'AI-ക്ക് അമർത്തിപ്പിടിക്കുക',
    ta: 'AI-க்கு அழுத்திப் பிடிக்கவும்',
    te: 'AI కోసం నొక్కి పట్టుకోండి',
    kn: 'AI ಗಾಗಿ ಒತ್ತಿ ಹಿಡಿಯಿರಿ',
    mr: 'AI साठी दाबून धरा',
    bn: 'AI এর জন্য চেপে ধরুন',
  },
  'AI Mode': {
    en: 'AI Mode',
    hi: 'AI मोड',
    ml: 'AI മോഡ്',
    ta: 'AI முறை',
    te: 'AI మోడ్',
    kn: 'AI ಮೋಡ್',
    mr: 'AI मोड',
    bn: 'AI মোড',
  },
  // AI Chat suggestions
  'Search for rice': {
    en: 'Search for rice',
    hi: 'चावल खोजें',
    ml: 'അരി തിരയുക',
    ta: 'அரிசி தேடுங்கள்',
    te: 'బియ్యం కోసం వెతకండి',
    kn: 'ಅಕ್ಕಿ ಹುಡುಕಿ',
    mr: 'तांदूळ शोधा',
    bn: 'চাল খুঁজুন',
  },
  'Show me vegetables': {
    en: 'Show me vegetables',
    hi: 'सब्जियाँ दिखाएं',
    ml: 'പച്ചക്കറികൾ കാണിക്കുക',
    ta: 'காய்கறிகளைக் காட்டு',
    te: 'కూరగాయలు చూపించండి',
    kn: 'ತರಕಾರಿಗಳನ್ನು ತೋರಿಸಿ',
    mr: 'भाज्या दाखवा',
    bn: 'সবজি দেখান',
  },
  "What are today's deals?": {
    en: "What are today's deals?",
    hi: 'आज के ऑफर क्या हैं?',
    ml: 'ഇന്നത്തെ ഓഫറുകൾ എന്തൊക്കെയാണ്?',
    ta: 'இன்றைய சலுகைகள் என்ன?',
    te: 'ఈ రోజు డీల్స్ ఏమిటి?',
    kn: 'ಇಂದಿನ ಡೀಲ್‌ಗಳು ಯಾವುವು?',
    mr: 'आजचे ऑफर काय आहेत?',
    bn: 'আজকের অফার কি?',
  },
  'Show me more products like this': {
    en: 'Show me more products like this',
    hi: 'इस तरह के और उत्पाद दिखाएं',
    ml: 'ഇതുപോലുള്ള കൂടുതൽ ഉൽപ്പന്നങ്ങൾ കാണിക്കുക',
    ta: 'இது போன்ற மேலும் தயாரிப்புகளைக் காட்டு',
    te: 'ఇలాంటి మరిన్ని ఉత్పత్తులు చూపించండి',
    kn: 'ಇದೇ ರೀತಿಯ ಹೆಚ್ಚಿನ ಉತ್ಪನ್ನಗಳನ್ನು ತೋರಿಸಿ',
    mr: 'या सारखे आणखी उत्पादने दाखवा',
    bn: 'এই রকম আরও পণ্য দেখান',
  },
  'What are the best deals today?': {
    en: 'What are the best deals today?',
    hi: 'आज के बेस्ट ऑफर क्या हैं?',
    ml: 'ഇന്നത്തെ മികച്ച ഓഫറുകൾ എന്തൊക്കെയാണ്?',
    ta: 'இன்றைய சிறந்த சலுகைகள் என்ன?',
    te: 'ఈ రోజు ఉత్తమ డీల్స్ ఏమిటి?',
    kn: 'ಇಂದಿನ ಅತ್ಯುತ್ತಮ ಡೀಲ್‌ಗಳು ಯಾವುವು?',
    mr: 'आजचे सर्वोत्तम ऑफर काय आहेत?',
    bn: 'আজকের সেরা অফার কি?',
  },
  'Add this to cart': {
    en: 'Add this to cart',
    hi: 'कार्ट में जोड़ें',
    ml: 'കാർട്ടിലേക്ക് ചേർക്കുക',
    ta: 'கார்ட்டில் சேர்க்கவும்',
    te: 'కార్ట్‌కు జోడించండి',
    kn: 'ಕಾರ್ಟ್‌ಗೆ ಸೇರಿಸಿ',
    mr: 'कार्टमध्ये जोडा',
    bn: 'কার্টে যোগ করুন',
  },
  'Find similar products': {
    en: 'Find similar products',
    hi: 'समान उत्पाद खोजें',
    ml: 'സമാന ഉൽപ്പന്നങ്ങൾ കണ്ടെത്തുക',
    ta: 'ஒத்த தயாரிப்புகளைக் கண்டறியவும்',
    te: 'సారూప్య ఉత్పత్తులను కనుగొనండి',
    kn: 'ಒಂದೇ ರೀತಿಯ ಉತ್ಪನ್ನಗಳನ್ನು ಹುಡುಕಿ',
    mr: 'समान उत्पादने शोधा',
    bn: 'একই ধরনের পণ্য খুঁজুন',
  },
  // AI Interface header
  'Your AI Assistant': {
    en: 'Your AI Assistant',
    hi: 'आपका AI सहायक',
    ml: 'നിങ്ങളുടെ AI അസിസ്റ്റന്റ്',
    ta: 'உங்கள் AI உதவியாளர்',
    te: 'మీ AI అసిస్టెంట్',
    kn: 'ನಿಮ್ಮ AI ಸಹಾಯಕ',
    mr: 'तुमचा AI सहाय्यक',
    bn: 'আপনার AI সহকারী',
  },
  'Dai - AI Assistant': {
    en: 'Dai - AI Assistant',
    hi: 'Dai - AI सहायक',
    ml: 'Dai - AI അസിസ്റ്റന്റ്',
    ta: 'Dai - AI உதவியாளர்',
    te: 'Dai - AI అసిస్టెంట్',
    kn: 'Dai - AI ಸಹಾಯಕ',
    mr: 'Dai - AI सहाय्यक',
    bn: 'Dai - AI সহকারী',
  },
  // AI Transition/Loading texts
  'Dai is waking up...': {
    en: 'Dai is waking up...',
    hi: 'Dai जाग रहा है...',
    ml: 'Dai ഉണരുന്നു...',
    ta: 'Dai எழுந்து கொண்டிருக்கிறார்...',
    te: 'Dai మేల్కొంటోంది...',
    kn: 'Dai ಎಚ್ಚರವಾಗುತ್ತಿದೆ...',
    mr: 'Dai उठत आहे...',
    bn: 'Dai জেগে উঠছে...',
  },
  'Ready!': {
    en: 'Ready!',
    hi: 'तैयार!',
    ml: 'തയ്യാർ!',
    ta: 'தயார்!',
    te: 'సిద్ధం!',
    kn: 'ಸಿದ್ಧ!',
    mr: 'तयार!',
    bn: 'প্রস্তুত!',
  },
  'AI Powered': {
    en: 'AI Powered',
    hi: 'AI संचालित',
    ml: 'AI പവർഡ്',
    ta: 'AI இயக்கப்படுகிறது',
    te: 'AI ఆధారిత',
    kn: 'AI ಚಾಲಿತ',
    mr: 'AI संचालित',
    bn: 'AI চালিত',
  },
  'Chat with Dai': {
    en: 'Chat with Dai',
    hi: 'Dai से चैट करें',
    ml: 'Dai-യുമായി ചാറ്റ് ചെയ്യുക',
    ta: 'Dai உடன் அரட்டை அடிக்கவும்',
    te: 'Dai తో చాట్ చేయండి',
    kn: 'Dai ನೊಂದಿಗೆ ಚಾಟ್ ಮಾಡಿ',
    mr: 'Dai शी गप्पा मारा',
    bn: 'Dai এর সাথে চ্যাট করুন',
  },
  'Meet Dai - Your AI Assistant': {
    en: 'Meet Dai - Your AI Assistant',
    hi: 'Dai से मिलें - आपका AI सहायक',
    ml: 'Dai-യെ പരിചയപ്പെടുക - നിങ്ങളുടെ AI അസിസ്റ്റന്റ്',
    ta: 'Dai-ஐ சந்திக்கவும் - உங்கள் AI உதவியாளர்',
    te: 'Dai-ని కలవండి - మీ AI అసిస్టెంట్',
    kn: 'Dai ಅನ್ನು ಭೇಟಿ ಮಾಡಿ - ನಿಮ್ಮ AI ಸಹಾಯಕ',
    mr: 'Dai ला भेटा - तुमचा AI सहाय्यक',
    bn: 'Dai এর সাথে পরিচিত হন - আপনার AI সহকারী',
  },
  // AI Chat Interface - Loading and Welcome texts
  'Loading conversation...': {
    en: 'Loading conversation...',
    hi: 'बातचीत लोड हो रही है...',
    ml: 'സംഭാഷണം ലോഡ് ചെയ്യുന്നു...',
    ta: 'உரையாடல் ஏற்றப்படுகிறது...',
    te: 'సంభాషణ లోడ్ అవుతోంది...',
    kn: 'ಸಂಭಾಷಣೆ ಲೋಡ್ ಆಗುತ್ತಿದೆ...',
    mr: 'संभाषण लोड होत आहे...',
    bn: 'কথোপকথন লোড হচ্ছে...',
  },
  'Restoring your chat history': {
    en: 'Restoring your chat history',
    hi: 'आपका चैट इतिहास पुनर्स्थापित हो रहा है',
    ml: 'നിങ്ങളുടെ ചാറ്റ് ചരിത്രം പുനഃസ്ഥാപിക്കുന്നു',
    ta: 'உங்கள் அரட்டை வரலாறு மீட்டெடுக்கப்படுகிறது',
    te: 'మీ చాట్ చరిత్ర పునరుద్ధరించబడుతోంది',
    kn: 'ನಿಮ್ಮ ಚಾಟ್ ಇತಿಹಾಸವನ್ನು ಮರುಸ್ಥಾಪಿಸಲಾಗುತ್ತಿದೆ',
    mr: 'तुमचा चॅट इतिहास पुनर्संचयित होत आहे',
    bn: 'আপনার চ্যাট ইতিহাস পুনরুদ্ধার হচ্ছে',
  },
  'Your Intelligent Assistant': {
    en: 'Your Intelligent Assistant',
    hi: 'आपका बुद्धिमान सहायक',
    ml: 'നിങ്ങളുടെ ബുദ്ധിമാനായ അസിസ്റ്റന്റ്',
    ta: 'உங்கள் புத்திசாலி உதவியாளர்',
    te: 'మీ తెలివైన అసిస్టెంట్',
    kn: 'ನಿಮ್ಮ ಬುದ್ಧಿವಂತ ಸಹಾಯಕ',
    mr: 'तुमचे बुद्धिमान सहाय्यक',
    bn: 'আপনার বুদ্ধিমান সহকারী',
  },
  'Try asking me:': {
    en: 'Try asking me:',
    hi: 'मुझसे पूछें:',
    ml: 'എന്നോട് ചോദിക്കൂ:',
    ta: 'என்னிடம் கேளுங்கள்:',
    te: 'నన్ను అడగండి:',
    kn: 'ನನ್ನನ್ನು ಕೇಳಿ:',
    mr: 'मला विचारा:',
    bn: 'আমাকে জিজ্ঞাসা করুন:',
  },
  'Popular Products': {
    en: 'Popular Products',
    hi: 'लोकप्रिय उत्पाद',
    ml: 'ജനപ്രിയ ഉൽപ്പന്നങ്ങൾ',
    ta: 'பிரபலமான தயாரிப்புகள்',
    te: 'ప్రముఖ ఉత్పత్తులు',
    kn: 'ಜನಪ್ರಿಯ ಉತ್ಪನ್ನಗಳು',
    mr: 'लोकप्रिय उत्पादने',
    bn: 'জনপ্রিয় পণ্য',
  },
  'Nearby Sellers': {
    en: 'Nearby Sellers',
    hi: 'पास के विक्रेता',
    ml: 'സമീപത്തുള്ള വിൽപ്പനക്കാർ',
    ta: 'அருகிலுள்ள விற்பனையாளர்கள்',
    te: 'సమీపంలోని విక్రేతలు',
    kn: 'ಹತ್ತಿರದ ಮಾರಾಟಗಾರರು',
    mr: 'जवळचे विक्रेते',
    bn: 'কাছাকাছি বিক্রেতা',
  },
  'View Cart': {
    en: 'View Cart',
    hi: 'कार्ट देखें',
    ml: 'കാർട്ട് കാണുക',
    ta: 'கார்ட் பார்க்க',
    te: 'కార్ట్ చూడండి',
    kn: 'ಕಾರ್ಟ್ ವೀಕ್ಷಿಸಿ',
    mr: 'कार्ट पहा',
    bn: 'কার্ট দেখুন',
  },
  'Order History': {
    en: 'Order History',
    hi: 'ऑर्डर इतिहास',
    ml: 'ഓർഡർ ചരിത്രം',
    ta: 'ஆர்டர் வரலாறு',
    te: 'ఆర్డర్ చరిత్ర',
    kn: 'ಆರ್ಡರ್ ಇತಿಹಾಸ',
    mr: 'ऑर्डर इतिहास',
    bn: 'অর্ডার ইতিহাস',
  },
  "Hello! I'm Dai": {
    en: "Hello! I'm Dai",
    hi: 'नमस्ते! मैं Dai हूं',
    ml: 'ഹലോ! ഞാൻ Dai ആണ്',
    ta: 'வணக்கம்! நான் Dai',
    te: 'హలో! నేను Dai',
    kn: 'ಹಲೋ! ನಾನು Dai',
    mr: 'नमस्कार! मी Dai आहे',
    bn: 'হ্যালো! আমি Dai',
  },
  'Dai is thinking...': {
    en: 'Dai is thinking...',
    hi: 'Dai सोच रहा है...',
    ml: 'Dai ചിന്തിക്കുന്നു...',
    ta: 'Dai சிந்திக்கிறார்...',
    te: 'Dai ఆలోచిస్తోంది...',
    kn: 'Dai ಯೋಚಿಸುತ್ತಿದೆ...',
    mr: 'Dai विचार करत आहे...',
    bn: 'Dai ভাবছে...',
  },
  'Ask Dai anything about products...': {
    en: 'Ask Dai anything about products...',
    hi: 'Dai से उत्पादों के बारे में कुछ भी पूछें...',
    ml: 'ഉൽപ്പന്നങ്ങളെക്കുറിച്ച് Dai-യോട് എന്തും ചോദിക്കൂ...',
    ta: 'தயாரிப்புகளைப் பற்றி Dai-யிடம் எதையும் கேளுங்கள்...',
    te: 'ఉత్పత్తుల గురించి Dai ని ఏదైనా అడగండి...',
    kn: 'ಉತ್ಪನ್ನಗಳ ಬಗ್ಗೆ Dai ಗೆ ಏನಾದರೂ ಕೇಳಿ...',
    mr: 'उत्पादनांबद्दल Dai ला काहीही विचारा...',
    bn: 'পণ্য সম্পর্কে Dai কে কিছু জিজ্ঞাসা করুন...',
  },
  // OrderReviewCard texts
  'Review Your Order': {
    en: 'Review Your Order',
    hi: 'अपना ऑर्डर देखें',
    ml: 'നിങ്ങളുടെ ഓർഡർ അവലോകനം ചെയ്യുക',
    ta: 'உங்கள் ஆர்டரை மதிப்பாய்வு செய்யுங்கள்',
    te: 'మీ ఆర్డర్ సమీక్షించండి',
    kn: 'ನಿಮ್ಮ ಆರ್ಡರ್ ಪರಿಶೀಲಿಸಿ',
    mr: 'तुमचा ऑर्डर पहा',
    bn: 'আপনার অর্ডার পর্যালোচনা করুন',
  },
  'No items in order': {
    en: 'No items in order',
    hi: 'ऑर्डर में कोई आइटम नहीं',
    ml: 'ഓർഡറിൽ ഇനങ്ങൾ ഇല്ല',
    ta: 'ஆர்டரில் பொருட்கள் இல்லை',
    te: 'ఆర్డర్‌లో ఐటెమ్‌లు లేవు',
    kn: 'ಆರ್ಡರ್‌ನಲ್ಲಿ ಐಟಂಗಳಿಲ್ಲ',
    mr: 'ऑर्डरमध्ये कोणतेही आयटम नाहीत',
    bn: 'অর্ডারে কোনো আইটেম নেই',
  },
  'Unavailable Items': {
    en: 'Unavailable Items',
    hi: 'अनुपलब्ध आइटम',
    ml: 'ലഭ്യമല്ലാത്ത ഇനങ്ങൾ',
    ta: 'கிடைக்காத பொருட்கள்',
    te: 'అందుబాటులో లేని ఐటెమ్‌లు',
    kn: 'ಲಭ್ಯವಿಲ್ಲದ ಐಟಂಗಳು',
    mr: 'अनुपलब्ध आयटम',
    bn: 'অনুপলব্ধ আইটেম',
  },
  'Items': {
    en: 'Items',
    hi: 'आइटम',
    ml: 'ഇനങ്ങൾ',
    ta: 'பொருட்கள்',
    te: 'ఐటెమ్‌లు',
    kn: 'ಐಟಂಗಳು',
    mr: 'आयटम',
    bn: 'আইটেম',
  },
  'Subtotal': {
    en: 'Subtotal',
    hi: 'उप-योग',
    ml: 'ഉപ-ആകെ',
    ta: 'உப-மொத்தம்',
    te: 'సబ్‌టోటల్',
    kn: 'ಉಪಮೊತ್ತ',
    mr: 'उपएकूण',
    bn: 'সাব-টোটাল',
  },
  'Cancel': {
    en: 'Cancel',
    hi: 'रद्द करें',
    ml: 'റദ്ദാക്കുക',
    ta: 'ரத்து செய்',
    te: 'రద్దు చేయండి',
    kn: 'ರದ್ದುಮಾಡಿ',
    mr: 'रद्द करा',
    bn: 'বাতিল করুন',
  },
  'Confirm Order': {
    en: 'Confirm Order',
    hi: 'ऑर्डर की पुष्टि करें',
    ml: 'ഓർഡർ സ്ഥിരീകരിക്കുക',
    ta: 'ஆர்டரை உறுதிப்படுத்தவும்',
    te: 'ఆర్డర్ నిర్ధారించండి',
    kn: 'ಆರ್ಡರ್ ದೃಢೀಕರಿಸಿ',
    mr: 'ऑर्डर पुष्टी करा',
    bn: 'অর্ডার নিশ্চিত করুন',
  },
  'Min': {
    en: 'Min',
    hi: 'न्यूनतम',
    ml: 'കുറഞ്ഞത്',
    ta: 'குறைந்தபட்சம்',
    te: 'కనీసం',
    kn: 'ಕನಿಷ್ಠ',
    mr: 'किमान',
    bn: 'সর্বনিম্ন',
  },
  // Search Screen texts
  'Search Results': {
    en: 'Search Results',
    hi: 'खोज परिणाम',
    ml: 'തിരയൽ ഫലങ്ങൾ',
    ta: 'தேடல் முடிவுகள்',
    te: 'శోధన ఫలితాలు',
    kn: 'ಹುಡುಕಾಟ ಫಲಿತಾಂಶಗಳು',
    mr: 'शोध परिणाम',
    bn: 'অনুসন্ধান ফলাফল',
  },
  'Search wholesalers, products...': {
    en: 'Search wholesalers, products...',
    hi: 'थोक विक्रेता, उत्पाद खोजें...',
    ml: 'മൊത്തക്കച്ചവടക്കാർ, ഉൽപ്പന്നങ്ങൾ തിരയുക...',
    ta: 'மொத்த விற்பனையாளர்கள், தயாரிப்புகளைத் தேடுங்கள்...',
    te: 'హోల్‌సేలర్లు, ఉత్పత్తులను శోధించండి...',
    kn: 'ಸಗಟು ವ್ಯಾಪಾರಿಗಳು, ಉತ್ಪನ್ನಗಳನ್ನು ಹುಡುಕಿ...',
    mr: 'घाऊक विक्रेते, उत्पादने शोधा...',
    bn: 'পাইকার, পণ্য অনুসন্ধান করুন...',
  },
  'Sort by': {
    en: 'Sort by',
    hi: 'इसके अनुसार क्रमबद्ध करें',
    ml: 'അടുക്കുക',
    ta: 'வரிசைப்படுத்து',
    te: 'క్రమబద్ధీకరించు',
    kn: 'ವಿಂಗಡಿಸಿ',
    mr: 'क्रमवारी लावा',
    bn: 'সাজান',
  },
  'Relevance': {
    en: 'Relevance',
    hi: 'प्रासंगिकता',
    ml: 'പ്രസക്തത',
    ta: 'தொடர்பு',
    te: 'సంబంధిత',
    kn: 'ಸಂಬಂಧಿತ',
    mr: 'प्रासंगिकता',
    bn: 'প্রাসঙ্গিকতা',
  },
  'No results found for': {
    en: 'No results found for',
    hi: 'के लिए कोई परिणाम नहीं मिला',
    ml: 'ഫലങ്ങളൊന്നും കണ്ടെത്തിയില്ല',
    ta: 'முடிவுகள் எதுவும் கிடைக்கவில்லை',
    te: 'ఫలితాలు కనుగొనబడలేదు',
    kn: 'ಯಾವುದೇ ಫಲಿತಾಂಶಗಳು ಕಂಡುಬಂದಿಲ್ಲ',
    mr: 'कोणतेही परिणाम सापडले नाहीत',
    bn: 'কোন ফলাফল পাওয়া যায়নি',
  },
  'Products': {
    en: 'Products',
    hi: 'उत्पाद',
    ml: 'ഉൽപ്പന്നങ്ങൾ',
    ta: 'தயாரிப்புகள்',
    te: 'ఉత్పత్తులు',
    kn: 'ಉತ್ಪನ್ನಗಳು',
    mr: 'उत्पादने',
    bn: 'পণ্য',
  },
  'Searching...': {
    en: 'Searching...',
    hi: 'खोज रहा है...',
    ml: 'തിരയുന്നു...',
    ta: 'தேடுகிறது...',
    te: 'శోధిస్తోంది...',
    kn: 'ಹುಡುಕುತ್ತಿದೆ...',
    mr: 'शोधत आहे...',
    bn: 'অনুসন্ধান করছে...',
  },
  'results': {
    en: 'results',
    hi: 'परिणाम',
    ml: 'ഫലങ്ങൾ',
    ta: 'முடிவுகள்',
    te: 'ఫలితాలు',
    kn: 'ಫಲಿತಾಂಶಗಳು',
    mr: 'परिणाम',
    bn: 'ফলাফল',
  },
  'OCR Order': {
    en: 'OCR Order',
    hi: 'OCR ऑर्डर',
    ml: 'OCR ഓർഡർ',
    ta: 'OCR ஆர்டர்',
    te: 'OCR ఆర్డర్',
    kn: 'OCR ಆರ್ಡರ್',
    mr: 'OCR ऑर्डर',
    bn: 'OCR অর্ডার',
  },
  'Scan Search': {
    en: 'Scan Search',
    hi: 'स्कैन खोज',
    ml: 'സ്കാൻ തിരയൽ',
    ta: 'ஸ்கேன் தேடல்',
    te: 'స్కాన్ శోధన',
    kn: 'ಸ್ಕ್ಯಾನ್ ಹುಡುಕಾಟ',
    mr: 'स्कॅन शोध',
    bn: 'স্ক্যান অনুসন্ধান',
  },
  'Try searching for': {
    en: 'Try searching for',
    hi: 'खोजने का प्रयास करें',
    ml: 'തിരയാൻ ശ്രമിക്കുക',
    ta: 'தேட முயற்சிக்கவும்',
    te: 'శోధించడానికి ప్రయత్నించండి',
    kn: 'ಹುಡುಕಲು ಪ್ರಯತ್ನಿಸಿ',
    mr: 'शोधण्याचा प्रयत्न करा',
    bn: 'অনুসন্ধান করার চেষ্টা করুন',
  },
  // Location texts
  'Detecting location...': {
    en: 'Detecting location...',
    hi: 'स्थान पता लगा रहे हैं...',
    ml: 'സ്ഥാനം കണ്ടെത്തുന്നു...',
    ta: 'இருப்பிடம் கண்டறியப்படுகிறது...',
    te: 'స్థానం గుర్తిస్తోంది...',
    kn: 'ಸ್ಥಳ ಕಂಡುಹಿಡಿಯಲಾಗುತ್ತಿದೆ...',
    mr: 'स्थान शोधत आहे...',
    bn: 'অবস্থান খোঁজা হচ্ছে...',
  },
  'Location detected': {
    en: 'Location detected',
    hi: 'स्थान का पता लगा',
    ml: 'സ്ഥാനം കണ്ടെത്തി',
    ta: 'இருப்பிடம் கண்டறியப்பட்டது',
    te: 'స్థానం గుర్తించబడింది',
    kn: 'ಸ್ಥಳ ಕಂಡುಹಿಡಿಯಲಾಯಿತು',
    mr: 'स्थान शोधले',
    bn: 'অবস্থান পাওয়া গেছে',
  },
  'Search products, brands, categories...': {
    en: 'Search products, brands, categories...',
    hi: 'उत्पाद, ब्रांड, श्रेणियाँ खोजें...',
    ml: 'ഉൽപ്പന്നങ്ങൾ, ബ്രാൻഡുകൾ, വിഭാഗങ്ങൾ തിരയുക...',
    ta: 'தயாரிப்புகள், பிராண்டுகள், வகைகளைத் தேடுங்கள்...',
    te: 'ఉత్పత్తులు, బ్రాండ్లు, వర్గాలను శోధించండి...',
    kn: 'ಉತ್ಪನ್ನಗಳು, ಬ್ರ್ಯಾಂಡ್‌ಗಳು, ವರ್ಗಗಳನ್ನು ಹುಡುಕಿ...',
    mr: 'उत्पादने, ब्रँड, श्रेणी शोधा...',
    bn: 'পণ্য, ব্র্যান্ড, বিভাগ অনুসন্ধান করুন...',
  },
  'Address not available': {
    en: 'Address not available',
    hi: 'पता उपलब्ध नहीं है',
    ml: 'വിലാസം ലഭ്യമല്ല',
    ta: 'முகவரி கிடைக்கவில்லை',
    te: 'చిరునామా అందుబాటులో లేదు',
    kn: 'ವಿಳಾಸ ಲಭ್ಯವಿಲ್ಲ',
    mr: 'पत्ता उपलब्ध नाही',
    bn: 'ঠিকানা উপলব্ধ নেই',
  },
  // Product Search Results Card texts (new entries only)
  'Options': {
    en: 'Options',
    hi: 'विकल्प',
    ml: 'ഓപ്ഷനുകൾ',
    ta: 'விருப்பங்கள்',
    te: 'ఎంపికలు',
    kn: 'ಆಯ್ಕೆಗಳು',
    mr: 'पर्याय',
    bn: 'বিকল্পগুলি',
  },
  'No products found': {
    en: 'No products found',
    hi: 'कोई उत्पाद नहीं मिला',
    ml: 'ഉൽപ്പന്നങ്ങൾ കണ്ടെത്തിയില്ല',
    ta: 'தயாரிப்புகள் கிடைக்கவில்லை',
    te: 'ఉత్పత్తులు కనుగొనబడలేదు',
    kn: 'ಉತ್ಪನ್ನಗಳು ಕಂಡುಬಂದಿಲ್ಲ',
    mr: 'उत्पादने सापडली नाहीत',
    bn: 'কোন পণ্য পাওয়া যায়নি',
  },
  'No items selected': {
    en: 'No items selected',
    hi: 'कोई आइटम चयनित नहीं',
    ml: 'ഇനങ്ങൾ തിരഞ്ഞെടുത്തിട്ടില്ല',
    ta: 'எந்த பொருளும் தேர்ந்தெடுக்கப்படவில்லை',
    te: 'ఐటమ్‌లు ఎంపిక చేయబడలేదు',
    kn: 'ಐಟಂಗಳನ್ನು ಆಯ್ಕೆ ಮಾಡಿಲ್ಲ',
    mr: 'कोणतीही वस्तू निवडलेली नाही',
    bn: 'কোন আইটেম নির্বাচিত হয়নি',
  },
  'in stock': {
    en: 'in stock',
    hi: 'स्टॉक में',
    ml: 'സ്റ്റോക്കിൽ',
    ta: 'கையிருப்பில்',
    te: 'స్టాక్‌లో',
    kn: 'ಸ್ಟಾಕ್‌ನಲ್ಲಿ',
    mr: 'स्टॉकमध्ये',
    bn: 'স্টকে আছে',
  },
  'Add to Cart': {
    en: 'Add to Cart',
    hi: 'कार्ट में जोड़ें',
    ml: 'കാർട്ടിലേക്ക് ചേർക്കുക',
    ta: 'கார்ட்டில் சேர்',
    te: 'కార్ట్‌కు జోడించు',
    kn: 'ಕಾರ್ಟ್‌ಗೆ ಸೇರಿಸಿ',
    mr: 'कार्टमध्ये जोडा',
    bn: 'কার্টে যোগ করুন',
  },
  'Place Order': {
    en: 'Place Order',
    hi: 'ऑर्डर दें',
    ml: 'ഓർഡർ നൽകുക',
    ta: 'ஆர்டர் செய்',
    te: 'ఆర్డర్ చేయండి',
    kn: 'ಆರ್ಡರ್ ಮಾಡಿ',
    mr: 'ऑर्डर द्या',
    bn: 'অর্ডার দিন',
  },
  '✓ Order Placed Successfully!': {
    en: '✓ Order Placed Successfully!',
    hi: '✓ ऑर्डर सफलतापूर्वक दे दिया गया!',
    ml: '✓ ഓർഡർ വിജയകരമായി നൽകി!',
    ta: '✓ ஆர்டர் வெற்றிகரமாக வைக்கப்பட்டது!',
    te: '✓ ఆర్డర్ విజయవంతంగా ఇవ్వబడింది!',
    kn: '✓ ಆರ್ಡರ್ ಯಶಸ್ವಿಯಾಗಿ ಇರಿಸಲಾಗಿದೆ!',
    mr: '✓ ऑर्डर यशस्वीरित्या दिली!',
    bn: '✓ অর্ডার সফলভাবে দেওয়া হয়েছে!',
  },
  '✓ Added to Cart!': {
    en: '✓ Added to Cart!',
    hi: '✓ कार्ट में जोड़ा गया!',
    ml: '✓ കാർട്ടിലേക്ക് ചേർത്തു!',
    ta: '✓ கார்ட்டில் சேர்க்கப்பட்டது!',
    te: '✓ కార్ట్‌కు జోడించబడింది!',
    kn: '✓ ಕಾರ್ಟ್‌ಗೆ ಸೇರಿಸಲಾಗಿದೆ!',
    mr: '✓ कार्टमध्ये जोडले!',
    bn: '✓ কার্টে যোগ করা হয়েছে!',
  },
  'View More Options': {
    en: 'View More Options',
    hi: 'और विकल्प देखें',
    ml: 'കൂടുതൽ ഓപ്ഷനുകൾ കാണുക',
    ta: 'மேலும் விருப்பங்களைக் காண்க',
    te: 'మరిన్ని ఎంపికలు చూడండి',
    kn: 'ಹೆಚ್ಚಿನ ಆಯ್ಕೆಗಳನ್ನು ನೋಡಿ',
    mr: 'अधिक पर्याय पहा',
    bn: 'আরও বিকল্প দেখুন',
  },
  // Explore Sellers Screen texts
  'Explore Sellers': {
    en: 'Explore Sellers',
    hi: 'विक्रेता खोजें',
    ml: 'വിൽപ്പനക്കാരെ കണ്ടെത്തുക',
    ta: 'விற்பனையாளர்களை ஆராயுங்கள்',
    te: 'విక్రేతలను అన్వేషించండి',
    kn: 'ಮಾರಾಟಗಾರರನ್ನು ಅನ್ವೇಷಿಸಿ',
    mr: 'विक्रेते शोधा',
    bn: 'বিক্রেতাদের অনুসন্ধান করুন',
  },
  'Search sellers, tags...': {
    en: 'Search sellers, tags...',
    hi: 'विक्रेता, टैग खोजें...',
    ml: 'വിൽപ്പനക്കാർ, ടാഗുകൾ തിരയുക...',
    ta: 'விற்பனையாளர்கள், குறிச்சொற்களைத் தேடுங்கள்...',
    te: 'విక్రేతలు, ట్యాగ్‌లను శోధించండి...',
    kn: 'ಮಾರಾಟಗಾರರು, ಟ್ಯಾಗ್‌ಗಳನ್ನು ಹುಡುಕಿ...',
    mr: 'विक्रेते, टॅग शोधा...',
    bn: 'বিক্রেতা, ট্যাগ অনুসন্ধান করুন...',
  },
  'Loading sellers...': {
    en: 'Loading sellers...',
    hi: 'विक्रेता लोड हो रहे हैं...',
    ml: 'വിൽപ്പനക്കാരെ ലോഡ് ചെയ്യുന്നു...',
    ta: 'விற்பனையாளர்கள் ஏற்றப்படுகின்றனர்...',
    te: 'విక్రేతలను లోడ్ చేస్తోంది...',
    kn: 'ಮಾರಾಟಗಾರರನ್ನು ಲೋಡ್ ಮಾಡಲಾಗುತ್ತಿದೆ...',
    mr: 'विक्रेते लोड होत आहेत...',
    bn: 'বিক্রেতাদের লোড হচ্ছে...',
  },
  'All': {
    en: 'All',
    hi: 'सभी',
    ml: 'എല്ലാം',
    ta: 'அனைத்தும்',
    te: 'అన్నీ',
    kn: 'ಎಲ್ಲಾ',
    mr: 'सर्व',
    bn: 'সব',
  },
  'Wholesalers': {
    en: 'Wholesalers',
    hi: 'थोक विक्रेता',
    ml: 'മൊത്തവ്യാപാരികൾ',
    ta: 'மொத்த வியாபாரிகள்',
    te: 'హోల్‌సేలర్లు',
    kn: 'ಸಗಟು ವ್ಯಾಪಾರಿಗಳು',
    mr: 'घाऊक विक्रेते',
    bn: 'পাইকারি বিক্রেতা',
  },
  'Manufacturers': {
    en: 'Manufacturers',
    hi: 'निर्माता',
    ml: 'നിർമ്മാതാക്കൾ',
    ta: 'உற்பத்தியாளர்கள்',
    te: 'తయారీదారులు',
    kn: 'ತಯಾರಕರು',
    mr: 'उत्पादक',
    bn: 'প্রস্তুতকারক',
  },
  'Wholesaler': {
    en: 'Wholesaler',
    hi: 'थोक विक्रेता',
    ml: 'മൊത്തവ്യാപാരി',
    ta: 'மொத்த வியாபாரி',
    te: 'హోల్‌సేలర్',
    kn: 'ಸಗಟು ವ್ಯಾಪಾರಿ',
    mr: 'घाऊक विक्रेता',
    bn: 'পাইকারি বিক্রেতা',
  },
  'Manufacturer': {
    en: 'Manufacturer',
    hi: 'निर्माता',
    ml: 'നിർമ്മാതാവ്',
    ta: 'உற்பத்தியாளர்',
    te: 'తయారీదారు',
    kn: 'ತಯಾರಕ',
    mr: 'उत्पादक',
    bn: 'প্রস্তুতকারক',
  },
  'result': {
    en: 'result',
    hi: 'परिणाम',
    ml: 'ഫലം',
    ta: 'முடிவு',
    te: 'ఫలితం',
    kn: 'ಫಲಿತಾಂಶ',
    mr: 'परिणाम',
    bn: 'ফলাফল',
  },
  'Details': {
    en: 'Details',
    hi: 'विवरण',
    ml: 'വിശദാംശങ്ങൾ',
    ta: 'விவரங்கள்',
    te: 'వివరాలు',
    kn: 'ವಿವರಗಳು',
    mr: 'तपशील',
    bn: 'বিবরণ',
  },
  'View Products': {
    en: 'View Products',
    hi: 'उत्पाद देखें',
    ml: 'ഉൽപ്പന്നങ്ങൾ കാണുക',
    ta: 'தயாரிப்புகளைக் காண்க',
    te: 'ఉత్పత్తులు చూడండి',
    kn: 'ಉತ್ಪನ್ನಗಳನ್ನು ನೋಡಿ',
    mr: 'उत्पादने पहा',
    bn: 'পণ্য দেখুন',
  },
  'No sellers found': {
    en: 'No sellers found',
    hi: 'कोई विक्रेता नहीं मिला',
    ml: 'വിൽപ്പനക്കാർ കണ്ടെത്തിയില്ല',
    ta: 'விற்பனையாளர்கள் கிடைக்கவில்லை',
    te: 'విక్రేతలు కనుగొనబడలేదు',
    kn: 'ಮಾರಾಟಗಾರರು ಕಂಡುಬಂದಿಲ್ಲ',
    mr: 'कोणतेही विक्रेते सापडले नाहीत',
    bn: 'কোন বিক্রেতা পাওয়া যায়নি',
  },
  'Try adjusting your filters': {
    en: 'Try adjusting your filters',
    hi: 'अपने फ़िल्टर समायोजित करें',
    ml: 'നിങ്ങളുടെ ഫിൽട്ടറുകൾ ക്രമീകരിക്കുക',
    ta: 'உங்கள் வடிப்பான்களை சரிசெய்யுங்கள்',
    te: 'మీ ఫిల్టర్‌లను సర్దుబాటు చేయండి',
    kn: 'ನಿಮ್ಮ ಫಿಲ್ಟರ್‌ಗಳನ್ನು ಹೊಂದಿಸಿ',
    mr: 'तुमचे फिल्टर समायोजित करा',
    bn: 'আপনার ফিল্টার সামঞ্জস্য করুন',
  },
  'Owner': {
    en: 'Owner',
    hi: 'मालिक',
    ml: 'ഉടമ',
    ta: 'உரிமையாளர்',
    te: 'యజమాని',
    kn: 'ಮಾಲೀಕ',
    mr: 'मालक',
    bn: 'মালিক',
  },
  'Type': {
    en: 'Type',
    hi: 'प्रकार',
    ml: 'തരം',
    ta: 'வகை',
    te: 'రకం',
    kn: 'ಪ್ರಕಾರ',
    mr: 'प्रकार',
    bn: 'ধরণ',
  },
  'Distance': {
    en: 'Distance',
    hi: 'दूरी',
    ml: 'ദൂരം',
    ta: 'தூரம்',
    te: 'దూరం',
    kn: 'ದೂರ',
    mr: 'अंतर',
    bn: 'দূরত্ব',
  },
  'km away': {
    en: 'km away',
    hi: 'किमी दूर',
    ml: 'കിമീ അകലെ',
    ta: 'கி.மீ தொலைவில்',
    te: 'కి.మీ దూరంలో',
    kn: 'ಕಿ.ಮೀ ದೂರ',
    mr: 'किमी दूर',
    bn: 'কিমি দূরে',
  },
  'Description': {
    en: 'Description',
    hi: 'विवरण',
    ml: 'വിവരണം',
    ta: 'விளக்கம்',
    te: 'వివరణ',
    kn: 'ವಿವರಣೆ',
    mr: 'वर्णन',
    bn: 'বিবরণ',
  },
  'Tags': {
    en: 'Tags',
    hi: 'टैग',
    ml: 'ടാഗുകൾ',
    ta: 'குறிச்சொற்கள்',
    te: 'ట్యాగ్‌లు',
    kn: 'ಟ್ಯಾಗ್‌ಗಳು',
    mr: 'टॅग',
    bn: 'ট্যাগ',
  },
  'Address': {
    en: 'Address',
    hi: 'पता',
    ml: 'വിലാസം',
    ta: 'முகவரி',
    te: 'చిరునామా',
    kn: 'ವಿಳಾಸ',
    mr: 'पत्ता',
    bn: 'ঠিকানা',
  },
  'Close': {
    en: 'Close',
    hi: 'बंद करें',
    ml: 'അടയ്ക്കുക',
    ta: 'மூடு',
    te: 'మూసివేయండి',
    kn: 'ಮುಚ್ಚಿ',
    mr: 'बंद करा',
    bn: 'বন্ধ করুন',
  },
  // Header component texts
  'Loading...': {
    en: 'Loading...',
    hi: 'लोड हो रहा है...',
    ml: 'ലോഡ് ചെയ്യുന്നു...',
    ta: 'ஏற்றுகிறது...',
    te: 'లోడ్ అవుతోంది...',
    kn: 'ಲೋಡ್ ಆಗುತ್ತಿದೆ...',
    mr: 'लोड होत आहे...',
    bn: 'লোড হচ্ছে...',
  },
  'Shop Name': {
    en: 'Shop Name',
    hi: 'दुकान का नाम',
    ml: 'കട പേര്',
    ta: 'கடை பெயர்',
    te: 'దుకాణం పేరు',
    kn: 'ಅಂಗಡಿ ಹೆಸರು',
    mr: 'दुकानाचे नाव',
    bn: 'দোকানের নাম',
  },
  'Cart': {
    en: 'Cart',
    hi: 'कार्ट',
    ml: 'കാർട്ട്',
    ta: 'கார்ட்',
    te: 'కార్ట్',
    kn: 'ಕಾರ್ಟ್',
    mr: 'कार्ट',
    bn: 'কার্ট',
  },
};

class TranslationService {
  private cache: TranslationCache = {};
  private isInitialized = false;
  private initPromise: Promise<void> | null = null;

  constructor() {
    // Start loading cache immediately on instantiation
    // initialize() handles its own promise management
    this.initialize().catch(console.error);
  }

  /**
   * Initialize the translation service
   * Uses a shared promise to prevent multiple simultaneous initializations
   */
  async initialize(): Promise<void> {
    if (this.isInitialized) return;

    // If already initializing, return existing promise
    if (this.initPromise) {
      return this.initPromise;
    }

    // Create and store the initialization promise
    this.initPromise = (async () => {
      try {
        await this.loadCache();
        this.isInitialized = true;
        console.log(`TranslationService initialized with ${Object.keys(this.cache).length} cached entries`);
      } catch (error) {
        console.error('Failed to initialize TranslationService:', error);
        this.isInitialized = true; // Mark as initialized anyway to prevent blocking
      }
    })();

    return this.initPromise;
  }

  /**
   * Wait for initialization to complete
   */
  async waitForInit(): Promise<void> {
    if (this.initPromise) {
      await this.initPromise;
    }
  }

  /**
   * Load translation cache from AsyncStorage
   */
  private async loadCache(): Promise<void> {
    try {
      const cacheData = await AsyncStorage.getItem(CACHE_CONFIG.storageKey);
      if (cacheData) {
        const parsedCache = JSON.parse(cacheData);
        // Clean expired entries
        this.cache = this.cleanExpiredEntries(parsedCache);
        console.log(`Loaded ${Object.keys(this.cache).length} translations from cache`);
      }
    } catch (error) {
      console.error('Error loading translation cache:', error);
      this.cache = {};
    }
  }

  /**
   * Save translation cache to AsyncStorage
   */
  private async saveCache(): Promise<void> {
    try {
      await AsyncStorage.setItem(CACHE_CONFIG.storageKey, JSON.stringify(this.cache));
    } catch (error) {
      console.error('Error saving translation cache:', error);
    }
  }

  /**
   * Clean expired cache entries
   */
  private cleanExpiredEntries(cache: TranslationCache): TranslationCache {
    const now = Date.now();
    const cleanedCache: TranslationCache = {};

    for (const [sourceText, translations] of Object.entries(cache)) {
      const validTranslations: { [key: string]: CacheEntry } = {};

      for (const [lang, entry] of Object.entries(translations)) {
        if (now - entry.timestamp < CACHE_CONFIG.expiryMs) {
          validTranslations[lang] = entry;
        }
      }

      if (Object.keys(validTranslations).length > 0) {
        cleanedCache[sourceText] = validTranslations;
      }
    }

    return cleanedCache;
  }

  /**
   * Get cached translation synchronously (for immediate UI display)
   * Returns null if not cached - does NOT trigger API call
   * Checks static translations first for contextually accurate UI strings
   */
  getCachedTranslationSync(text: string, targetLanguage: SupportedLanguage): string | null {
    if (targetLanguage === 'en' || !text.trim()) {
      return text;
    }

    // First check static translations for contextual accuracy
    const staticTranslation = STATIC_TRANSLATIONS[text]?.[targetLanguage];
    if (staticTranslation) {
      return staticTranslation;
    }

    // Then check dynamic cache
    const cacheKey = text.toLowerCase().trim();
    const cached = this.cache[cacheKey]?.[targetLanguage];

    if (cached && Date.now() - cached.timestamp < CACHE_CONFIG.expiryMs) {
      return cached.text;
    }

    return null;
  }

  /**
   * Get cached translation (internal use)
   */
  private getCachedTranslation(text: string, targetLanguage: SupportedLanguage): string | null {
    return this.getCachedTranslationSync(text, targetLanguage);
  }

  /**
   * Cache translation result
   */
  private setCachedTranslation(
    text: string,
    targetLanguage: SupportedLanguage,
    translatedText: string,
    confidence?: number
  ): void {
    const cacheKey = text.toLowerCase().trim();

    if (!this.cache[cacheKey]) {
      this.cache[cacheKey] = {};
    }

    this.cache[cacheKey][targetLanguage] = {
      text: translatedText,
      timestamp: Date.now(),
      confidence,
    };

    // Limit cache size
    this.limitCacheSize();

    // Save to storage (async, don't wait)
    this.saveCache().catch(console.error);
  }

  /**
   * Limit cache size to prevent memory issues
   */
  private limitCacheSize(): void {
    const entries = Object.entries(this.cache);
    if (entries.length > CACHE_CONFIG.maxEntries) {
      // Remove oldest entries
      const sortedEntries = entries.sort((a, b) => {
        const aTime = Math.min(...Object.values(a[1]).map(entry => entry.timestamp));
        const bTime = Math.min(...Object.values(b[1]).map(entry => entry.timestamp));
        return aTime - bTime;
      });

      const entriesToKeep = sortedEntries.slice(-CACHE_CONFIG.maxEntries);
      this.cache = Object.fromEntries(entriesToKeep);
    }
  }

  /**
   * Translate text via the ai-translate edge function
   * NON-BLOCKING: If service isn't initialized, returns cached/original text immediately
   */
  async translateText(
    text: string,
    targetLanguage: SupportedLanguage,
    sourceLanguage: SupportedLanguage = 'en'
  ): Promise<TranslationResult> {
    // Return original text if target is same as source or text is empty
    if (targetLanguage === sourceLanguage || !text.trim()) {
      return {
        originalText: text,
        translatedText: text,
        sourceLanguage,
        targetLanguage,
        confidence: 1.0,
      };
    }

    // If not initialized, start initialization but don't block
    if (!this.isInitialized) {
      // Start initialization in background (don't await)
      this.initialize().catch(console.error);

      // Try to get from cache anyway (cache may have been loaded sync)
      const cached = this.getCachedTranslation(text, targetLanguage);
      return {
        originalText: text,
        translatedText: cached || text,
        sourceLanguage,
        targetLanguage,
        confidence: cached ? 1.0 : 0.0,
      };
    }

    // Check cache first
    const cachedResult = this.getCachedTranslation(text, targetLanguage);
    if (cachedResult) {
      return {
        originalText: text,
        translatedText: cachedResult,
        sourceLanguage,
        targetLanguage,
        confidence: 1.0, // Cached results are considered reliable
      };
    }

    try {
      // Call the translation proxy
      const translatedText = await this.callTranslateProxy(text, targetLanguage, sourceLanguage);

      // Cache the result
      this.setCachedTranslation(text, targetLanguage, translatedText);

      return {
        originalText: text,
        translatedText,
        sourceLanguage,
        targetLanguage,
        confidence: 0.9, // Machine-translation confidence (provider returns none)
      };
    } catch (error) {
      console.error('Translation failed:', error);

      // Return original text on error
      return {
        originalText: text,
        translatedText: text,
        sourceLanguage,
        targetLanguage,
        confidence: 0.0,
      };
    }
  }

  /**
   * Translate a single string via the ai-translate edge function.
   *
   * Sent as a one-element batch because the proxy exposes a single batching
   * action; there is no per-call overhead difference.
   */
  private async callTranslateProxy(
    text: string,
    targetLanguage: SupportedLanguage,
    sourceLanguage: SupportedLanguage = 'en'
  ): Promise<string> {
    const [translated] = await proxyTranslate([text], targetLanguage, sourceLanguage);

    if (typeof translated !== 'string') {
      throw new Error('Invalid response from translation service');
    }

    return translated;
  }

  /**
   * Translate multiple texts in a SINGLE batch API call (optimized)
   * This is much faster than calling translateText individually
   * Uses a single proxy request for all uncached texts
   */
  async translateBatch(
    texts: string[],
    targetLanguage: SupportedLanguage,
    sourceLanguage: SupportedLanguage = 'en'
  ): Promise<TranslationResult[]> {
    // Return original texts if target is same as source
    if (targetLanguage === sourceLanguage) {
      return texts.map(text => ({
        originalText: text,
        translatedText: text,
        sourceLanguage,
        targetLanguage,
        confidence: 1.0,
      }));
    }

    // Wait for initialization (uses shared promise, so multiple calls don't re-initialize)
    if (!this.isInitialized) {
      await this.initialize();
    }

    // Step 1: Check cache for all texts and separate cached from uncached
    const results: TranslationResult[] = new Array(texts.length);
    const uncachedItems: { index: number; text: string }[] = [];

    for (let i = 0; i < texts.length; i++) {
      const text = texts[i];
      if (!text.trim()) {
        results[i] = {
          originalText: text,
          translatedText: text,
          sourceLanguage,
          targetLanguage,
          confidence: 1.0,
        };
        continue;
      }

      const cached = this.getCachedTranslation(text, targetLanguage);
      if (cached) {
        results[i] = {
          originalText: text,
          translatedText: cached,
          sourceLanguage,
          targetLanguage,
          confidence: 1.0,
        };
      } else {
        uncachedItems.push({ index: i, text });
      }
    }

    // Step 2: If all texts were cached, return immediately
    if (uncachedItems.length === 0) {
      console.log(`[TranslationService] Batch translation: All ${texts.length} texts from cache`);
      return results;
    }

    console.log(`[TranslationService] Batch translation: ${texts.length - uncachedItems.length} cached, ${uncachedItems.length} to translate`);

    // Step 3: Translate uncached texts in a single batch API call
    try {
      const batchTranslations = await this.callTranslateProxyBatch(
        uncachedItems.map(item => item.text),
        targetLanguage,
        sourceLanguage
      );

      // Step 4: Cache results and merge into results array
      for (let i = 0; i < uncachedItems.length; i++) {
        const { index, text } = uncachedItems[i];
        const translatedText = batchTranslations[i] || text;

        // Cache the result
        this.setCachedTranslation(text, targetLanguage, translatedText);

        results[index] = {
          originalText: text,
          translatedText,
          sourceLanguage,
          targetLanguage,
          confidence: 0.9,
        };
      }
    } catch (error) {
      console.error('[TranslationService] Batch translation failed:', error);
      // On error, return original texts for uncached items
      for (const { index, text } of uncachedItems) {
        results[index] = {
          originalText: text,
          translatedText: text,
          sourceLanguage,
          targetLanguage,
          confidence: 0.0,
        };
      }
    }

    return results;
  }

  /**
   * Translate multiple texts via the ai-translate edge function.
   *
   * The 100-per-request chunking is retained because it is now the proxy's own
   * documented limit (it was previously Azure's). AWS Translate has no
   * synchronous batch action, so the proxy fans out server-side with bounded
   * concurrency — which is why this still costs one round trip per 100 texts
   * rather than one per text.
   */
  private async callTranslateProxyBatch(
    texts: string[],
    targetLanguage: SupportedLanguage,
    sourceLanguage: SupportedLanguage = 'en'
  ): Promise<string[]> {
    const MAX_BATCH_SIZE = 100;
    const allTranslations: string[] = [];

    for (let i = 0; i < texts.length; i += MAX_BATCH_SIZE) {
      const batch = texts.slice(i, i + MAX_BATCH_SIZE);
      const translations = await proxyTranslate(batch, targetLanguage, sourceLanguage);
      allTranslations.push(...translations);
    }

    return allTranslations;
  }

  /**
   * Detect language of text
   */
  async detectLanguage(text: string): Promise<{ language: string; confidence: number }> {
    try {
      return await proxyDetectLanguage(text);
    } catch (error) {
      // Preserved behaviour: detection failures degrade to English rather than
      // propagating, because callers treat this as a hint, not a decision.
      console.error('Language detection error:', error);
      return {
        language: 'en',
        confidence: 0.0,
      };
    }
  }

  /**
   * Clear translation cache
   */
  async clearCache(): Promise<void> {
    try {
      this.cache = {};
      await AsyncStorage.removeItem(CACHE_CONFIG.storageKey);
      console.log('Translation cache cleared');
    } catch (error) {
      console.error('Error clearing translation cache:', error);
    }
  }

  /**
   * Get cache statistics
   */
  getCacheStats(): { totalEntries: number; totalTranslations: number; cacheSize: string } {
    const totalEntries = Object.keys(this.cache).length;
    let totalTranslations = 0;

    for (const translations of Object.values(this.cache)) {
      totalTranslations += Object.keys(translations).length;
    }

    const cacheSize = JSON.stringify(this.cache).length;
    const cacheSizeKB = (cacheSize / 1024).toFixed(2);

    return {
      totalEntries,
      totalTranslations,
      cacheSize: `${cacheSizeKB} KB`,
    };
  }
}

// Export singleton instance
export const translationService = new TranslationService();

// Export class for testing
export { TranslationService };

// Export default
export default translationService;