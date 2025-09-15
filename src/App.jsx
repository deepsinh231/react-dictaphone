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
} from "@chakra-ui/react";
import { FaMicrophone, FaStop, FaDownload, FaRedo } from "react-icons/fa";
import SpeechRecognition, { useSpeechRecognition } from "react-speech-recognition";

// Keyframes for the pulsing microphone animation
// const pulse = "keyframes`
//   0% { transform: scale(1); }
//   50% { transform: scale(1.05); }
//   100% { transform: scale(1); }
// `;"
const pulse = "transform: scale(1);"
const DictaphoneUI = () => {
  const {
    transcript, // This is the combined transcript (interim + final)
    interimTranscript,
    finalTranscript,
    resetTranscript,
    listening,
    browserSupportsSpeechRecognition,
  } = useSpeechRecognition();

  const [recordingAudio, setRecordingAudio] = useState(false); // Separated from speech recognition 'listening'
  const [recordings, setRecordings] = useState([]);
  const [language, setLanguage] = useState("en-US"); // Default to English for broader use
  const [seconds, setSeconds] = useState(0);
  const [transcribedSegments, setTranscribedSegments] = useState([]); // Stores final segments with timestamps
  const [currentInterim, setCurrentInterim] = useState(""); // To display current interim text

  const mediaRecorderRef = useRef(null);
  const audioChunksRef = useRef([]);
  const timerRef = useRef(null);
  const lastFinalTranscriptRef = useRef(""); // To track only newly finalized parts
  const toast = useToast(); // For user feedback

  // Effect to update currentInterim when interimTranscript changes
  useEffect(() => {
    if (listening) {
      setCurrentInterim(interimTranscript);
    } else {
      setCurrentInterim("");
    }
  }, [interimTranscript, listening]);

  // Effect to process final transcripts into segments
  useEffect(() => {
    if (finalTranscript && finalTranscript !== lastFinalTranscriptRef.current) {
      const newFinalPart = finalTranscript.substring(lastFinalTranscriptRef.current.length).trim();
      if (newFinalPart) {
        setTranscribedSegments((prev) => [
          ...prev,
          { text: newFinalPart, timestamp: seconds },
        ]);
      }
      lastFinalTranscriptRef.current = finalTranscript;
      setCurrentInterim(""); // Clear interim once a final part is added
    }
  }, [finalTranscript, seconds]);

  // Timer effect
  useEffect(() => {
    if (!recordingAudio) {
      clearInterval(timerRef.current);
      return;
    }
    timerRef.current = setInterval(() => setSeconds((prev) => prev + 1), 1000);
    return () => clearInterval(timerRef.current);
  }, [recordingAudio]);

  // Formats time for display, SRT, and VTT
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
    setTranscribedSegments([]);
    lastFinalTranscriptRef.current = "";
    setSeconds(0);
    setCurrentInterim("");

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorderRef.current = new MediaRecorder(stream);
      audioChunksRef.current = [];

      mediaRecorderRef.current.ondataavailable = (event) => {
        audioChunksRef.current.push(event.data);
      };

      mediaRecorderRef.current.onstop = () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: "audio/wav" });
        const url = URL.createObjectURL(audioBlob);
        setRecordings((prev) => [...prev, { url, duration: seconds, timestamp: Date.now() }]);
        // Stop all tracks on the stream after recording to release microphone
        stream.getTracks().forEach(track => track.stop());
      };

      mediaRecorderRef.current.start();
      SpeechRecognition.startListening({ continuous: true, language });
      setRecordingAudio(true);
      toast({
        title: "Recording started!",
        status: "success",
        duration: 2000,
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
      setRecordingAudio(false); // Ensure button state is consistent
      SpeechRecognition.stopListening(); // Stop listening if mic access failed
    }
  };

  const stopRecording = () => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === "recording") {
      mediaRecorderRef.current.stop();
    }
    SpeechRecognition.stopListening();
    setRecordingAudio(false);
    clearInterval(timerRef.current);

    // If there's any remaining interim transcript when stopping, add it as a segment
    if (currentInterim.trim() && !finalTranscript.includes(currentInterim.trim())) {
      setTranscribedSegments((prev) => [
        ...prev,
        { text: currentInterim.trim(), timestamp: seconds },
      ]);
    }
    setCurrentInterim(""); // Clear any remaining interim
    lastFinalTranscriptRef.current = transcript; // Ensure full transcript is considered 'finalized'
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

  const downloadTXT = () => {
    const content = transcribedSegments.map((item) => `[${formatTime(item.timestamp)}] ${item.text}`).join("\n");
    downloadFile(content, "transcript.txt", "text/plain");
  };

  const downloadSRT = () => {
    const content = transcribedSegments.map((item, i) => {
      const startTime = item.timestamp;
      const endTime = i + 1 < transcribedSegments.length ? transcribedSegments[i + 1].timestamp : seconds;
      return `${i + 1}\n${formatTime(startTime, "srt")} --> ${formatTime(endTime, "srt")}\n${item.text}\n`;
    }).join("\n");
    downloadFile(content, "transcript.srt", "text/plain");
  };

  const downloadVTT = () => {
    let content = "WEBVTT\n\n";
    content += transcribedSegments.map((item, i) => {
      const startTime = item.timestamp;
      const endTime = i + 1 < transcribedSegments.length ? transcribedSegments[i + 1].timestamp : seconds;
      return `${formatTime(startTime, "vtt")} --> ${formatTime(endTime, "vtt")}\n${item.text}`;
    }).join("\n\n");
    downloadFile(content, "transcript.vtt", "text/vtt");
  };

  const handleReset = () => {
    stopRecording(); // Ensure everything is stopped first
    resetTranscript();
    setTranscribedSegments([]);
    setRecordings([]);
    lastFinalTranscriptRef.current = "";
    setSeconds(0);
    setCurrentInterim("");
    toast({
      title: "All data reset.",
      status: "info",
      duration: 1500,
      isClosable: true,
    });
  };

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
          Record your voice, transcribe it in multiple languages, and download the results.
        </Text>

        {/* Language Selector */}
        <HStack w="full" justifyContent="center" py={2}>
          <Text fontWeight="medium" color="gray.700">Language:</Text>
          <Select
            w="180px"
            value={language}
            onChange={(e) => {
              setLanguage(e.target.value);
              if (recordingAudio || listening) {
                // If recording, stop and restart with new language
                stopRecording();
                toast({
                  title: "Language changed.",
                  description: "Recording stopped. Please start a new recording with the selected language.",
                  status: "warning",
                  duration: 4000,
                  isClosable: true,
                });
              } else {
                toast({
                  title: `Language set to ${e.target.options[e.target.selectedIndex].text}.`,
                  status: "info",
                  duration: 2000,
                  isClosable: true,
                });
              }
            }}
            borderColor="gray.300"
            _focus={{ borderColor: "purple.400", boxShadow: "0 0 0 1px purple.400" }}
          >
            <option value="en-US">English (US)</option>
            <option value="en-GB">English (UK)</option>
            <option value="gu-IN">Gujarati (India)</option>
            <option value="hi-IN">Hindi (India)</option>
            <option value="es-ES">Spanish (Spain)</option>
            <option value="fr-FR">French (France)</option>
            <option value="de-DE">German (Germany)</option>
            {/* Add more languages as needed */}
          </Select>
        </HStack>

        {/* Microphone Button */}
        <Center py={4}>
          <Button
            onClick={recordingAudio ? stopRecording : startRecording}
            borderRadius="full"
            boxSize="120px" // Make it a large circular button
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
            isDisabled={!browserSupportsSpeechRecognition}
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
          align="flex-start" // Align text to the start
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
          {transcribedSegments.length > 0 ? (
            transcribedSegments.map((item, idx) => (
              <Text key={`segment-${idx}`} fontSize="md" my={0.5} color="gray.800">
                <Text as="span" fontWeight="medium" color="gray.600">[{formatTime(item.timestamp)}]</Text> {item.text}
              </Text>
            ))
          ) : (
            <Text fontSize="md" color="gray.400">
              {listening && interimTranscript ? "" : "Your transcription will appear here..."}
            </Text>
          )}
          {currentInterim && (
            <Text fontSize="md" color="gray.500" fontStyle="italic">
              {currentInterim}
            </Text>
          )}
        </VStack>

        {/* Download and Reset Buttons */}
        <HStack w="full" justifyContent="center" spacing={4} pt={2}>
          <Menu>
            <MenuButton
              as={Button}
              colorScheme="purple"
              rightIcon={<Icon as={FaDownload} />}
              isDisabled={transcribedSegments.length === 0}
            >
              Download Transcript
            </MenuButton>
            <MenuList>
              <MenuItem onClick={downloadTXT}>.txt (Plain Text)</MenuItem>
              <MenuItem onClick={downloadSRT}>.srt (SubRip Subtitle)</MenuItem>
              <MenuItem onClick={downloadVTT}>.vtt (WebVTT Subtitle)</MenuItem>
            </MenuList>
          </Menu>
          <Button
            onClick={handleReset}
            colorScheme="gray"
            leftIcon={<Icon as={FaRedo} />}
            isDisabled={!transcribedSegments.length && !recordings.length && !listening && !recordingAudio}
          >
            Reset All
          </Button>
        </HStack>

        {/* Recordings List */}
        {recordings.length > 0 && (
          <VStack w="full" spacing={3} mt={6} align="stretch">
            <Heading size="md" color="purple.700" textAlign="center">
              Recorded Audio Files
            </Heading>
            {recordings.map((rec, idx) => (
              <Box
                key={rec.timestamp} // Use timestamp for unique key
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