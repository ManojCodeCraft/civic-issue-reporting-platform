module.exports = {
  apiKey: process.env.OPENAI_API_KEY,
  timeout: 60000,
  maxRetries: 3,

  whisper: {
    model: "whisper-1",
    language: "en", // Can be changed dynamically
    responseFormat: "text",
    temperature: 0,
  },

  gpt: {
    model: "gpt-3.5-turbo",
    maxTokens: 500,
    temperature: 0.3,
  },

  tts: {
    model: "tts-1",
    voice: "alloy", // Options: alloy, echo, fable, onyx, nova, shimmer
  },

  prompts: {
    cleanTranscription: `You are a text cleaning assistant. Your task is to:
1. Remove filler words (um, uh, like, you know, etc.)
2. Fix grammar and punctuation
3. Maintain the original meaning
4. Keep it concise and clear
5. Return ONLY the cleaned text, nothing else.`,

    categorizeIssue: `You are an issue classification expert. Based on the description, classify the civic issue into one of these categories:
- Road Damage
- Waste Management
- Water Supply
- Street Lighting
- Drainage
- Parks & Gardens
- Other

Return ONLY the category name, nothing else.`,

    detectLanguage: `Detect the language of this text and return ONLY the ISO 639-1 language code (e.g., 'en', 'hi', 'te', 'ta', 'es', 'fr'). Return nothing else.`,
  },

  supportedLanguages: [
    { code: "auto", name: "Auto-Detect (Recommended)", flag: "🌐" },
    { code: "en", name: "English", flag: "🇬🇧", whisperSupported: true },
    { code: "hi", name: "हिंदी (Hindi)", flag: "🇮🇳", whisperSupported: true },
    {
      code: "te",
      name: "తెలుగు (Telugu)",
      flag: "🇮🇳",
      whisperSupported: false,
    },
    { code: "ta", name: "தமிழ் (Tamil)", flag: "🇮🇳", whisperSupported: false },
    {
      code: "kn",
      name: "ಕನ್ನಡ (Kannada)",
      flag: "🇮🇳",
      whisperSupported: false,
    },
    {
      code: "ml",
      name: "മലയാളം (Malayalam)",
      flag: "🇮🇳",
      whisperSupported: false,
    },
    {
      code: "mr",
      name: "मराठी (Marathi)",
      flag: "🇮🇳",
      whisperSupported: false,
    },
    {
      code: "bn",
      name: "বাংলা (Bengali)",
      flag: "🇮🇳",
      whisperSupported: false,
    },
    {
      code: "gu",
      name: "ગુજરાતી (Gujarati)",
      flag: "🇮🇳",
      whisperSupported: false,
    },
    {
      code: "pa",
      name: "ਪੰਜਾਬੀ (Punjabi)",
      flag: "🇮🇳",
      whisperSupported: false,
    },
    {
      code: "es",
      name: "Español (Spanish)",
      flag: "🇪🇸",
      whisperSupported: true,
    },
    {
      code: "fr",
      name: "Français (French)",
      flag: "🇫🇷",
      whisperSupported: true,
    },
  ],
};
