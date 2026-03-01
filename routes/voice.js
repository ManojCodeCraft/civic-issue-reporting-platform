const express = require("express");
const router = express.Router();
const voiceProcessor = require("../utils/voiceProcessor");
const openaiConfig = require("../config/openaiConfig");

// @desc    Text-to-Speech
// @route   POST /api/voice/tts
router.post("/tts", async (req, res) => {
  try {
    const { text, voice } = req.body;

    if (!text) {
      return res.status(400).json({
        success: false,
        error: "No text provided",
      });
    }

    const result = await voiceProcessor.textToSpeech(text, voice || "alloy");

    if (!result.success) {
      return res.status(500).json({
        success: false,
        error: result.error,
      });
    }

    res.set("Content-Type", "audio/mpeg");
    res.send(result.audio);
  } catch (error) {
    console.error("TTS error:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// @desc    Speech-to-Text (Transcription only)
// @route   POST /api/voice/transcribe
router.post("/transcribe", async (req, res) => {
  try {
    const { audio, language } = req.body;

    if (!audio) {
      return res.status(400).json({
        success: false,
        error: "No audio data provided",
      });
    }

    const audioBuffer = Buffer.from(audio, "base64");
    const result = await voiceProcessor.transcribeAudio(
      audioBuffer,
      language || "en",
    );

    res.json(result);
  } catch (error) {
    console.error("Transcription error:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// @desc    Process voice to issue (Full pipeline)
// @route   POST /api/voice/process-issue
router.post("/process-issue", async (req, res) => {
  try {
    const { audio, language } = req.body;

    if (!audio) {
      return res.status(400).json({
        success: false,
        error: "No audio data provided",
      });
    }

    const audioBuffer = Buffer.from(audio, "base64");
    const result = await voiceProcessor.processVoiceToIssue(
      audioBuffer,
      language || "en",
    );

    res.json(result);
  } catch (error) {
    console.error("Voice processing error:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// @desc    Get supported languages
// @route   GET /api/voice/languages
router.get("/languages", (req, res) => {
  res.json({
    success: true,
    languages: openaiConfig.supportedLanguages,
  });
});

module.exports = router;
