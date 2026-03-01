const { OpenAI } = require("openai");
const fs = require("fs");
const path = require("path");
const openaiConfig = require("../config/openaiConfig");

const openai = new OpenAI({
  apiKey: openaiConfig.apiKey,
});

// Ensure temp directory exists
const tempDir = path.join(__dirname, "../temp");
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
}

/**
 * Convert webm to mp3 using buffer
 */
function webmToMp3Buffer(webmBuffer) {
  // For webm, we can directly use it - Whisper accepts webm
  // Just ensure it's saved with correct extension
  return webmBuffer;
}

/**
 * Transcribe audio - WORKING VERSION
 */
/**
 * Transcribe audio - ENHANCED FOR INDIAN LANGUAGES
 */
async function transcribeAudio(audioBuffer) {
  let audioPath = null;
  try {
    console.log("📝 Audio size:", audioBuffer.length, "bytes");

    // Save as mp3
    audioPath = path.join(tempDir, `audio-${Date.now()}.mp3`);

    fs.writeFileSync(audioPath, audioBuffer);
    console.log("✅ Audio saved:", audioPath);

    // Transcribe with prompt to help Whisper understand context
    const transcription = await openai.audio.transcriptions.create({
      file: fs.createReadStream(audioPath),
      model: "whisper-1",
      // Add prompt to help with Indian languages and civic issues
      prompt:
        "This is about civic issues like roads, potholes, garbage, water supply, drainage, lighting. The speech may be in English, Hindi, Telugu, Tamil, Kannada, or other Indian languages.",
    });

    console.log("✅ Raw transcription:", transcription.text);

    // Cleanup
    try {
      fs.unlinkSync(audioPath);
    } catch (e) {}

    if (!transcription.text || transcription.text.trim().length < 3) {
      return {
        success: false,
        error:
          "No clear speech detected. Please speak louder and more clearly.",
        transcription: "",
      };
    }

    return {
      success: true,
      transcription: transcription.text.trim(),
      rawText: transcription.text.trim(),
    };
  } catch (error) {
    console.error("❌ Transcription error:", error);
    try {
      if (audioPath) fs.unlinkSync(audioPath);
    } catch (e) {}
    return {
      success: false,
      error: error.message,
      transcription: "",
    };
  }
}

/**
 * Clean text
 */
async function cleanTranscription(text) {
  if (!text || text.trim().length === 0) {
    return { success: false, cleanedText: "", error: "No text" };
  }

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content:
            "Clean this text by removing filler words and fixing grammar. Return ONLY the cleaned text.",
        },
        {
          role: "user",
          content: text,
        },
      ],
      temperature: 0.3,
    });

    return {
      success: true,
      cleanedText: response.choices[0].message.content.trim(),
    };
  } catch (error) {
    return {
      success: false,
      cleanedText: text,
    };
  }
}

/**
 * Categorize
 */
async function categorizeIssue(description) {
  if (!description) {
    return { success: false, category: "Other" };
  }

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: `Classify into ONE category:
Road Damage, Waste Management, Water Supply, Street Lighting, Drainage, Parks & Gardens, Other
Return ONLY the category name.`,
        },
        {
          role: "user",
          content: description,
        },
      ],
      temperature: 0.1,
    });

    const category = response.choices[0].message.content.trim();
    const validCategories = [
      "Road Damage",
      "Waste Management",
      "Water Supply",
      "Street Lighting",
      "Drainage",
      "Parks & Gardens",
      "Other",
    ];

    return {
      success: true,
      category: validCategories.includes(category) ? category : "Other",
    };
  } catch (error) {
    return { success: false, category: "Other" };
  }
}

/**
 * Detect language
 */
async function detectLanguage(text) {
  if (!text) {
    return { success: false, languageCode: "auto" };
  }

  try {
    const response = await openai.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content:
            "Return ONLY the ISO 639-1 language code (en, hi, te, ta, etc). Nothing else.",
        },
        {
          role: "user",
          content: `Language: ${text}`,
        },
      ],
      temperature: 0,
    });

    return {
      success: true,
      languageCode: response.choices[0].message.content.trim().toLowerCase(),
    };
  } catch (error) {
    return { success: false, languageCode: "auto" };
  }
}

/**
 * MAIN PIPELINE - SIMPLIFIED
 */
async function processVoiceToIssue(audioBuffer) {
  try {
    console.log("🚀 Processing voice...");

    // Step 1: Transcribe
    const transcription = await transcribeAudio(audioBuffer);
    if (!transcription.success) {
      return {
        success: false,
        error: transcription.error || "Transcription failed",
      };
    }

    const text = transcription.transcription;
    console.log("📝 Text:", text);

    // Step 2: Clean (optional - can skip if causing issues)
    const cleanedText = text; // Use raw transcription directly

    // Step 3: Categorize
    const category = await categorizeIssue(cleanedText);
    console.log("🏷️ Category:", category.category);

    // Step 4: Detect language
    const lang = await detectLanguage(cleanedText);
    console.log("🌐 Language:", lang.languageCode);

    return {
      success: true,
      rawTranscription: text,
      cleanedDescription: cleanedText,
      suggestedCategory: category.category,
      detectedLanguage: lang.languageCode,
    };
  } catch (error) {
    console.error("❌ Pipeline error:", error);
    return {
      success: false,
      error: error.message,
    };
  }
}

module.exports = {
  transcribeAudio,
  processVoiceToIssue,
};
