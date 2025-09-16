import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  Box,
  VStack,
  Heading,
  Text,
  Button,
  Select,
  Center,
  HStack,
  Divider,
  Icon,
  Flex,
  Menu,
  MenuButton,
  MenuList,
  MenuItem,
  // keyframes,
  useToast,
  Spinner,
  Tag,
} from "@chakra-ui/react";
import { FaMicrophone, FaStop, FaDownload, FaRedo, FaLanguage } from "react-icons/fa";
import SpeechRecognition, { useSpeechRecognition } from "react-speech-recognition";

// Keyframes for the pulsing microphone animation
// const pulse = keyframes`
//   0% { transform: scale(1); }
//   50% { transform: scale(1.05); }
//   100% { transform: scale(1); }
// `;
const pulse = "keyframes"

// Define chunk duration in seconds
const CHUNK_DURATION = 10; // 10 seconds per chunk

const DictaphoneUI = () => {
  const {
    transcript, // This is the continuously updated transcript (interim + final)
    interimTranscript, // The current non-finalized part
    finalTranscript, // The last finalized part of the transcript
    resetTranscript,
    listening,
    browserSupportsSpeechRecognition,
  } = useSpeechRecognition();

  const [recordingAudio, setRecordingAudio] = useState(false); // Controls the UI record button state
  const [recordings, setRecordings] = useState([]); // Stores full audio recordings
  const [sourceLanguage, setSourceLanguage] = useState("en-US"); // Source for speech recognition
  const [targetLanguage, setTargetLanguage] = useState("es"); // Target for translation
  const [seconds, setSeconds] = useState(0); // Total recording time in seconds
  const [chunks, setChunks] = useState([]); // Stores { startTime, endTime, originalText, translatedText, id }
  const [isTranslating, setIsTranslating] = useState(false); // For translation loading state

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]); // For the single full audio recording
  const timerRef = useRef(null); // For overall recording timer
  const lastChunkTranscriptRef = useRef(""); // To track transcript since the last chunk was finalized
  const currentChunkStartTimeRef = useRef(0); // Tracks the start time of the *current* active chunk

  const toast = useToast();

  // Effect to manage the overall recording timer
  useEffect(() => {
    if (recordingAudio) {
      timerRef.current = setInterval(() => {
        setSeconds((prev) => prev + 1);
      }, 1000);
    } else {
      clearInterval(timerRef.current);
    }
    return () => clearInterval(timerRef.current);
  }, [recordingAudio]);

  // Function to finalize the current chunk
  const finalizeCurrentChunk = useCallback((forceEndTime = null) => {
    const chunkEndTime = forceEndTime !== null ? forceEndTime : seconds;
    const currentTranscriptSinceLastChunk = transcript.substring(lastChunkTranscriptRef.current.length).trim();

    if (currentTranscriptSinceLastChunk) {
      setChunks((prevChunks) => {
        const newChunk = {
          id: Date.now() + Math.random(), // Unique ID
          startTime: currentChunkStartTimeRef.current,
          endTime: chunkEndTime,
          originalText: currentTranscriptSinceLastChunk,
          translatedText: "", // Will be filled later
        };
        return [...prevChunks, newChunk];
      });
      lastChunkTranscriptRef.current = transcript; // Update to the full transcript processed
      currentChunkStartTimeRef.current = chunkEndTime; // Next chunk starts where this one ended
    }
  }, [seconds, transcript]);

  // Effect to manage chunking logic based on time and transcript
  useEffect(() => {
    if (!recordingAudio || !listening) {
      return;
    }

    // This effect runs whenever `transcript` or `seconds` changes
    // If we've passed a CHUNK_DURATION boundary based on the current chunk's start time, finalize it.
    if (seconds >= currentChunkStartTimeRef.current + CHUNK_DURATION) {
      finalizeCurrentChunk();
    }
  }, [seconds, transcript, recordingAudio, listening, finalizeCurrentChunk]);

  // Helper to format time (HH:MM:SS.mmm for VTT, HH:MM:SS,mmm for SRT, MM:SS for display)
  const formatTime = useCallback((secs, formatType = "display") => {
    const totalMs = Math.floor(secs * 1000);
    const h = Math.floor(totalMs / 3600000);
    const m = Math.floor((totalMs % 3600000) / 60000);
    const s = Math.floor((totalMs % 60000) / 1000);
    const ms = totalMs % 1000;

    const pad = (num, len = 2) => String(num).padStart(len, "0");

    if (formatType === "srt") {
      return `${pad(h)}:${pad(m)}:${pad(s)},${pad(ms, 3)}`;
    }
    if (formatType === "vtt") {
      return `${pad(h)}:${pad(m)}:${pad(s)}.${pad(ms, 3)}`;
    }
    // Default for display (MM:SS)
    return `${pad(m)}:${pad(s)}`;
  }, []);

  // Simulate a translation API call
  const translateText = async (text, sourceLang, targetLang) => {
    // Basic validation to prevent unnecessary API calls
    if (!text || text.trim() === "") {
      return "";
    }

    // In a real app, this would be an API call to a backend that uses Google Cloud Translation, DeepL, etc.
    // Example: const response = await axios.post('/api/translate', { text, sourceLang, targetLang });
    // return response.data.translatedText;

    // --- MOCK TRANSLATION (Replace with real API call) ---
    await new Promise((resolve) => setTimeout(resolve, 300 + Math.random() * 700)); // Simulate network delay

    const mockTranslations = {
      "en": {
        "es": `[ES: ${text}]`,
        "fr": `[FR: ${text}]`,
        "hi": `[HI: ${text}]`,
        "gu": `[GU: ${text}]`,
      },
      "es": {
        "en": `[EN: ${text}]`,
        "fr": `[FR: ${text}]`,
      },
      // Add more mock translations as needed
    };

    const baseSourceLang = sourceLang.split('-')[0];
    const translated = mockTranslations[baseSourceLang]?.[targetLang] || `[Translated to ${targetLang}: ${text}]`;
    return translated;
  };

  const handleTranslateAll = async () => {
    if (chunks.length === 0) {
      toast({
        title: "No text to translate.",
        status: "info",
        duration: 2000,
        isClosable: true,
      });
      return;
    }

    setIsTranslating(true);
    toast({
      title: "Translating chunks...",
      status: "info",
      duration: 3000,
      isClosable: true,
      position: "top",
    });

    const translatedChunks = await Promise.all(
      chunks.map(async (chunk) => {
        if (!chunk.originalText || chunk.originalText.trim() === "") {
          return { ...chunk, translatedText: "" };
        }
        const translatedText = await translateText(
          chunk.originalText,
          sourceLanguage, // Pass full source language code
          targetLanguage
        );
        return { ...chunk, translatedText };
      })
    );
    setChunks(translatedChunks);
    setIsTranslating(false);
    toast({
      title: "Translation complete!",
      status: "success",
      duration: 2000,
      isClosable: true,
    });
  };

  if (!browserSupportsSpeechRecognition) {
    return (
      <Center minH="100vh" bg="gray.100" p={4}>
        <VStack
          spacing={6}
          w="full"
          maxW="lg"
          p={8}
          bg="white"
          borderRadius="2xl"
          boxShadow="2xl"
        >
          <Heading size="2xl" textAlign="center" color="red.500">
            Browser Not Supported
          </Heading>
          <Text fontSize="lg" textAlign="center" color="red.700">
            Unfortunately, your browser does not support the Web Speech API required for this Dictaphone. Please try a modern browser like Chrome or Edge.
          </Text>
        </VStack>
      </Center>
    );
  }

  const startRecording = async () => {
    // Reset all previous states
    resetTranscript();
    setChunks([]);
    setSeconds(0);
    lastChunkTranscriptRef.current = "";
    currentChunkStartTimeRef.current = 0;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunksRef.current = []; // Reset for new full audio recording

      mediaRecorderRef.current.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };

      mediaRecorderRef.current.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/wav" });
        const url = URL.createObjectURL(audioBlob);
        setRecordings((prev) => [...prev, { url, duration: seconds, timestamp: Date.now() }]);
        stream.getTracks().forEach(track => track.stop()); // Release microphone
      };

      mediaRecorderRef.current.start();
      SpeechRecognition.startListening({ continuous: true, interimResults: true, language: sourceLanguage });
      setRecordingAudio(true);
      toast({
        title: "Recording started!",
        description: `Transcribing in ${sourceLanguage} and chunking every ${CHUNK_DURATION} seconds.`,
        status: "success",
        duration: 3000,
        isClosable: true,
      });
    } catch (err) {
      console.error("Error accessing microphone:", err);
      toast({
        title: "Microphone access denied or error.",
        description: "Please ensure you allow microphone access for recording.",
        status: "error",
        duration: 5000,
        isClosable: true,
      });
      setRecordingAudio(false);
      SpeechRecognition.stopListening();
      clearInterval(timerRef.current);
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.stop();
    }
    SpeechRecognition.stopListening();
    setRecordingAudio(false);
    clearInterval(timerRef.current);

    // Finalize any remaining interim text into a chunk
    finalizeCurrentChunk(seconds); // Use current total seconds as end time
    toast({
      title: "Recording stopped.",
      status: "info",
      duration: 2000,
      isClosable: true,
    });
  };

  const downloadFile = (content, fileName, contentType) => {
    const a = document.createElement("a");
    const file = new Blob([content], { type: contentType });
    a.href = URL.createObjectURL(file);
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(a.href);
    toast({
      title: `Downloaded ${fileName}`,
      status: "success",
      duration: 1500,
      isClosable: true,
    });
  };

  const downloadTXT = (translated = false) => {
    const content = chunks.map((item) => {
      const text = translated && item.translatedText ? item.translatedText : item.originalText;
      if (!text) return "";
      return `[${formatTime(item.startTime)} - ${formatTime(item.endTime)}] ${text}`;
    }).filter(Boolean).join("\n"); // Filter out empty strings
    const filename = translated ? "translated_transcript.txt" : "original_transcript.txt";
    downloadFile(content, filename, "text/plain");
  };

  const downloadSRT = (translated = false) => {
    const srtChunks = chunks.filter(item => {
        const text = translated && item.translatedText ? item.translatedText : item.originalText;
        return text && text.trim() !== "";
    });

    const content = srtChunks.map((item, i) => {
      const text = translated && item.translatedText ? item.translatedText : item.originalText;
      return `${i + 1}\n${formatTime(item.startTime, "srt")} --> ${formatTime(item.endTime, "srt")}\n${text}\n`;
    }).join("\n");
    const filename = translated ? "translated_transcript.srt" : "original_transcript.srt";
    downloadFile(content, filename, "text/plain"); // SRT is text/plain
  };

  const downloadVTT = (translated = false) => {
    let content = "WEBVTT\n\n";
    const vttChunks = chunks.filter(item => {
        const text = translated && item.translatedText ? item.translatedText : item.originalText;
        return text && text.trim() !== "";
    });

    content += vttChunks.map((item) => {
      const text = translated && item.translatedText ? item.translatedText : item.originalText;
      return `${formatTime(item.startTime, "vtt")} --> ${formatTime(item.endTime, "vtt")}\n${text}`;
    }).join("\n\n");
    const filename = translated ? "translated_transcript.vtt" : "original_transcript.vtt";
    downloadFile(content, filename, "text/vtt");
  };

  const handleReset = () => {
    stopRecording(); // Ensure everything is stopped first
    resetTranscript();
    setChunks([]);
    setRecordings([]);
    lastChunkTranscriptRef.current = "";
    currentChunkStartTimeRef.current = 0;
    setSeconds(0);
    toast({
      title: "All data reset.",
      status: "info",
      duration: 1500,
      isClosable: true,
    });
  };

  // Determine the current interim text that hasn't been chunked yet
  const currentInterimForDisplay = transcript.substring(lastChunkTranscriptRef.current.length).trim();

  // Check if there's any translated content to enable download options
  const hasTranslatedContent = chunks.some(c => c.translatedText && c.translatedText.trim() !== "");

  return (
    <Center minH="100vh" bg="gray.50" p={4}>
      <VStack
        spacing={6}
        w="full"
        maxW="lg"
        p={8}
        bg="white"
        borderRadius="2xl"
        boxShadow="2xl"
        align="stretch"
      >
        <Heading size="2xl" textAlign="center" color="purple.600">
          🎙️ Dictaphone
        </Heading>
        <Text textAlign="center" fontSize="md" color="gray.600">
          Record, transcribe, chunk by {CHUNK_DURATION}s, and translate your audio.
        </Text>

        {/* Language Selectors */}
        <Flex w="full" justifyContent="center" py={2} wrap="wrap" gap={4}>
          <HStack>
            <Text fontWeight="medium" color="gray.700">Source:</Text>
            <Select
              w="180px"
              value={sourceLanguage}
              onChange={(e) => {
                const newSourceLang = e.target.value;
                setSourceLanguage(newSourceLang);
                if (recordingAudio || listening) {
                  stopRecording();
                  toast({
                    title: "Language changed.",
                    description: `Recording stopped. Please start a new recording with the selected source language (${newSourceLang}).`,
                    status: "warning",
                    duration: 4000,
                    isClosable: true,
                  });
                }
              }}
              borderColor="gray.300"
              _focus={{ borderColor: "purple.400", boxShadow: "0 0 0 1px purple.400" }}
              isDisabled={recordingAudio || listening || isTranslating}
            >
              <option value="en-US">English (US)</option>
              <option value="en-GB">English (UK)</option>
              <option value="gu-IN">Gujarati (India)</option>
              <option value="hi-IN">Hindi (India)</option>
              <option value="es-ES">Spanish (Spain)</option>
              <option value="fr-FR">French (France)</option>
              <option value="de-DE">German (Germany)</option>
            </Select>
          </HStack>
          <HStack>
            <Text fontWeight="medium" color="gray.700">Target:</Text>
            <Select
              w="180px"
              value={targetLanguage}
              onChange={(e) => setTargetLanguage(e.target.value)} // Use full language code for target if needed by actual API
              borderColor="gray.300"
              _focus={{ borderColor: "blue.400", boxShadow: "0 0 0 1px blue.400" }}
              isDisabled={recordingAudio || listening || isTranslating}
            >
              <option value="en">English</option>
              <option value="es">Spanish</option>
              <option value="fr">French</option>
              <option value="hi">Hindi</option>
              <option value="gu">Gujarati</option>
              {/* Add more target languages for translation */}
            </Select>
          </HStack>
        </Flex>

        {/* Microphone Button */}
        <Center py={4}>
          <Button
            onClick={recordingAudio ? stopRecording : startRecording}
            borderRadius="full"
            boxSize="120px"
            bg={recordingAudio ? "red.500" : "green.500"}
            color="white"
            boxShadow="lg"
            _hover={{ opacity: 0.9, transform: "scale(1.02)" }}
            _active={{ transform: "scale(0.98)" }}
            transition="all 0.2s ease-in-out"
            display="flex"
            flexDirection="column"
            alignItems="center"
            justifyContent="center"
            aria-label={recordingAudio ? "Stop Recording" : "Start Recording"}
            animation={recordingAudio ? `${pulse} 1.5s infinite ease-in-out` : "none"}
            isDisabled={!browserSupportsSpeechRecognition || isTranslating}
          >
            <Icon as={recordingAudio ? FaStop : FaMicrophone} w={10} h={10} mb={1} />
            <Text fontSize="lg" fontWeight="bold">
              {recordingAudio ? "STOP" : "RECORD"}
            </Text>
          </Button>
        </Center>

        {/* Status and Timer */}
        <Flex justifyContent="space-between" alignItems="center" px={2} pt={2}>
          <Text fontSize="md" color={recordingAudio ? "green.600" : "gray.500"} fontWeight="semibold">
            Status: {recordingAudio ? (listening ? "Transcribing..." : "Recording Audio...") : "Idle"}
            {recordingAudio && listening && <Spinner size="xs" ml={2} />}
          </Text>
          <Text fontSize="xl" fontWeight="bold" color="purple.700">
            {formatTime(seconds)}
          </Text>
        </Flex>

        <Divider borderColor="gray.200" my={2} />

        {/* Transcript Box */}
        <VStack
          w="full"
          maxH="350px"
          minH="150px"
          overflowY="auto"
          p={4}
          bg="gray.50"
          border="1px solid"
          borderColor="gray.200"
          borderRadius="xl"
          align="flex-start"
          spacing={1}
          sx={{
            "&::-webkit-scrollbar": {
              width: "8px",
            },
            "&::-webkit-scrollbar-thumb": {
              bg: "purple.300",
              borderRadius: "4px",
            },
            "&::-webkit-scrollbar-thumb:hover": {
              bg: "purple.400",
            },
          }}
        >
          {chunks.length === 0 && !currentInterimForDisplay && !listening && (
            <Text fontSize="md" color="gray.400">
              Transcription will appear here in {CHUNK_DURATION}s chunks...
            </Text>
          )}
          {chunks.map((chunk) => (
            <Box key={chunk.id} p={2} bg="white" borderRadius="md" w="full" boxShadow="xs">
              <HStack justifyContent="space-between">
                <Text fontSize="sm" fontWeight="medium" color="gray.600">
                  [{formatTime(chunk.startTime)} - {formatTime(chunk.endTime)}]
                </Text>
                {chunk.translatedText && (
                  <Tag size="sm" colorScheme="blue">Translated</Tag>
                )}
              </HStack>
              <Text fontSize="md" color="gray.800" mt={1}>
                {chunk.originalText}
              </Text>
              {chunk.translatedText && (
                <Text fontSize="sm" color="blue.700" mt={1} fontStyle="italic">
                  {chunk.translatedText}
                </Text>
              )}
            </Box>
          ))}
          {currentInterimForDisplay && (
            <Box p={2} bg="gray.100" borderRadius="md" w="full" boxShadow="xs">
              <Text fontSize="sm" fontWeight="medium" color="gray.500">
                [Interim ({formatTime(seconds)})]
              </Text>
              <Text fontSize="md" color="gray.600" fontStyle="italic" mt={1}>
                {currentInterimForDisplay}
                {listening && <Spinner size="xs" ml={2} />}
              </Text>
            </Box>
          )}
        </VStack>

        {/* Action Buttons */}
        <Flex w="full" justifyContent="center" spacing={4} pt={2} wrap="wrap" gap={4}>
          <Button
            onClick={handleTranslateAll}
            colorScheme="blue"
            leftIcon={isTranslating ? <Spinner size="sm" /> : <Icon as={FaLanguage} />}
            isDisabled={chunks.length === 0 || isTranslating}
          >
            {isTranslating ? "Translating..." : "Translate All Chunks"}
          </Button>

          <Menu>
            <MenuButton
              as={Button}
              colorScheme="purple"
              rightIcon={<Icon as={FaDownload} />}
              isDisabled={chunks.length === 0 || isTranslating}
            >
              Download Transcripts
            </MenuButton>
            <MenuList>
              <MenuItem onClick={() => downloadTXT(false)}>Original .txt</MenuItem>
              <MenuItem onClick={() => downloadSRT(false)}>Original .srt</MenuItem>
              <MenuItem onClick={() => downloadVTT(false)}>Original .vtt</MenuItem>
              <Divider />
              <MenuItem onClick={() => downloadTXT(true)} isDisabled={!hasTranslatedContent}>Translated .txt</MenuItem>
              <MenuItem onClick={() => downloadSRT(true)} isDisabled={!hasTranslatedContent}>Translated .srt</MenuItem>
              <MenuItem onClick={() => downloadVTT(true)} isDisabled={!hasTranslatedContent}>Translated .vtt</MenuItem>
            </MenuList>
          </Menu>

          <Button
            onClick={handleReset}
            colorScheme="gray"
            leftIcon={<Icon as={FaRedo} />}
            isDisabled={(!chunks.length && !recordings.length && !listening && !recordingAudio) || isTranslating}
          >
            Reset All
          </Button>
        </Flex>

        {/* Recordings List */}
        {recordings.length > 0 && (
          <VStack w="full" spacing={3} mt={6} align="stretch">
            <Heading size="md" color="purple.700" textAlign="center">
              Recorded Audio Files
            </Heading>
            {recordings.map((rec, idx) => (
              <Box
                key={rec.timestamp}
                w="full"
                p={4}
                bg="gray.50"
                borderRadius="xl"
                boxShadow="sm"
                border="1px solid"
                borderColor="gray.200"
              >
                <audio controls src={rec.url} style={{ width: "100%" }}></audio>
                <Flex justify="space-between" align="center" mt={3} px={1}>
                  <Text fontSize="sm" color="gray.600">
                    Duration: {formatTime(rec.duration)}
                  </Text>
                  <Button
                    as="a"
                    href={rec.url}
                    download={`recording-${new Date(rec.timestamp).toLocaleDateString()}-${new Date(rec.timestamp).toLocaleTimeString().replace(/[:\s]/g, '-')}.wav`}
                    size="sm"
                    colorScheme="blue"
                    leftIcon={<Icon as={FaDownload} />}
                  >
                    Download Audio
                  </Button>
                </Flex>
              </Box>
            ))}
          </VStack>
        )}
      </VStack>
    </Center>
  );
};

export default DictaphoneUI;