import { useRef, useState, useCallback } from 'react';

const BACKEND_BASE = 'http://localhost:5000/api';
const FRAME_INTERVAL_MS = 8000;
const MAX_FRAMES = 5;

export function useLivenessSession() {
  const liveVideoRef = useRef(null);
  const streamRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const recordedChunksRef = useRef([]);
  const frameTimerRef = useRef(null);
  const recordingTimerRef = useRef(null);
  const countdownRef = useRef(null);
  const isCapturingRef = useRef(false);
  const frameCountRef = useRef(0);

  // Store sessionId/authToken in refs
  const sessionIdRef = useRef(null);
  const authTokenRef = useRef(null);

  // ── Camera state ──────────────
  const [liveMode, setLiveMode] = useState(false);
  const [audioEnabled, setAudioEnabled] = useState(true);
  const [cameraError, setCameraError] = useState(null);

  // ── Liveness state ─────────────
  const [status, setStatus] = useState('idle'); // idle|starting|capturing|success|failed
  const [rawAzureStatus, setRawAzureStatus] = useState(null);
  const [livenessResult, setLivenessResult] = useState(null);
  const [attempts, setAttempts] = useState([]);
  const [rateLimitCountdown, setRateLimitCountdown] = useState(0);

  // ── Recording state ──────────────
  const [isRecording, setIsRecording] = useState(false);
  const [recordedBlob, setRecordedBlob] = useState(null);
  const [recordingDuration, setRecordingDuration] = useState(0);

  // Camera
  const startCamera = useCallback(async () => {
    setCameraError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          facingMode: 'user',
        },
        audio: true,
      });
      streamRef.current = stream;

      // Wire stream to video element after next render
      requestAnimationFrame(() => {
        if (liveVideoRef.current) {
          liveVideoRef.current.srcObject = stream;
          liveVideoRef.current.play().catch(() => {});
        }
      });

      setLiveMode(true);
      setStatus('idle');
      setRawAzureStatus({
        type: 'info',
        text: 'Camera ready. Click "Start" to begin liveness detection.',
      });
    } catch (err) {
      console.error('[Camera]', err);
      setCameraError(
        'Camera or microphone permission denied. Please allow access and try again.',
      );
    }
  }, []);

  const stopCamera = useCallback(() => {
    clearTimeout(frameTimerRef.current);
    clearInterval(countdownRef.current);
    isCapturingRef.current = false;
    frameCountRef.current = 0;

    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state !== 'inactive'
    ) {
      mediaRecorderRef.current.stop();
    }
    clearInterval(recordingTimerRef.current);
    setIsRecording(false);

    // Kill stream
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    if (liveVideoRef.current) {
      liveVideoRef.current.srcObject = null;
      liveVideoRef.current.load();
    }

    setLiveMode(false);
    setStatus('idle');
    setRateLimitCountdown(0);
  }, []);

  const toggleAudio = useCallback(() => {
    if (streamRef.current) {
      streamRef.current.getAudioTracks().forEach((t) => {
        t.enabled = !audioEnabled;
      });
    }
    setAudioEnabled((v) => !v);
  }, [audioEnabled]);

  const startRecording = useCallback(() => {
    if (!streamRef.current) return;
    recordedChunksRef.current = [];

    let recorder;
    try {
      recorder = new MediaRecorder(streamRef.current, {
        mimeType: 'video/webm;codecs=vp9,opus',
      });
    } catch {
      recorder = new MediaRecorder(streamRef.current);
    }

    recorder.ondataavailable = (e) => {
      if (e.data && e.data.size > 0) recordedChunksRef.current.push(e.data);
    };
    recorder.onstop = () => {
      // Set blob — this is what gets sent for comparison
      const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
      setRecordedBlob(blob);
      console.log(
        '[Recording] Saved blob:',
        (blob.size / 1024).toFixed(0),
        'KB',
      );
    };

    recorder.start(500);
    mediaRecorderRef.current = recorder;
    setIsRecording(true);
    setRecordingDuration(0);
    recordingTimerRef.current = setInterval(
      () => setRecordingDuration((d) => d + 1),
      1000,
    );
  }, []);

  const stopRecording = useCallback(() => {
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state !== 'inactive'
    ) {
      mediaRecorderRef.current.stop(); // triggers onstop → sets recordedBlob
    }
    clearInterval(recordingTimerRef.current);
    setIsRecording(false);
  }, []);

  // ─────────────────────────────────────────────────────────────────────────
  // Countdown display
  // ─────────────────────────────────────────────────────────────────────────
  const startCountdown = useCallback((seconds) => {
    clearInterval(countdownRef.current);
    setRateLimitCountdown(seconds);
    countdownRef.current = setInterval(() => {
      setRateLimitCountdown((prev) => {
        if (prev <= 1) {
          clearInterval(countdownRef.current);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  }, []);

  // ─────────────────────────────────────────────────────────────────────────
  // Capture one JPEG frame from the video element (unmirrored — CSS mirror is
  // display-only; Azure needs the real, unflipped image)
  // ─────────────────────────────────────────────────────────────────────────
  const captureFrame = useCallback(() => {
    const video = liveVideoRef.current;
    if (!video || video.readyState < 2 || video.videoWidth === 0) {
      console.warn('[Frame] Video not ready');
      return null;
    }
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0);

    const b64 = canvas.toDataURL('image/jpeg', 0.92);
    if (b64.length < 5000) {
      console.warn('[Frame] Blank frame');
      return null;
    }
    return b64;
  }, []);

  // ─────────────────────────────────────────────────────────────────────────
  // Fetch full session result → populate attempt history
  // ─────────────────────────────────────────────────────────────────────────
  const fetchSessionResult = useCallback(async (sid) => {
    try {
      const res = await fetch(`${BACKEND_BASE}/liveness/result/${sid}`);
      const data = await res.json();
      if (data?.results?.attempts?.length) {
        setAttempts(
          [...data.results.attempts].sort((a, b) => b.attemptId - a.attemptId),
        );
      }
    } catch (err) {
      console.error('[Liveness] fetchSessionResult error:', err);
    }
  }, []);

  // ─────────────────────────────────────────────────────────────────────────
  // Send ONE frame, then schedule the next one after FRAME_INTERVAL_MS.
  // Uses refs for sessionId/authToken so the closure never goes stale.
  // ─────────────────────────────────────────────────────────────────────────
  const sendFrame = useCallback(async () => {
    if (!isCapturingRef.current) return;

    const sid = sessionIdRef.current;
    const token = authTokenRef.current;
    if (!sid || !token) return;

    const frameNum = frameCountRef.current + 1;
    console.log(`[Frame] Capturing frame ${frameNum}/${MAX_FRAMES}`);
    setRawAzureStatus({
      type: 'info',
      text: `Sending frame ${frameNum}/${MAX_FRAMES} to Azure...`,
    });

    // Capture the frame
    const image = captureFrame();
    if (!image) {
      // Camera not ready — wait and retry without burning a frame slot
      setRawAzureStatus({
        type: 'warning',
        text: 'Camera not ready — make sure your face is visible',
      });
      if (isCapturingRef.current) {
        startCountdown(Math.ceil(FRAME_INTERVAL_MS / 1000));
        frameTimerRef.current = setTimeout(sendFrame, FRAME_INTERVAL_MS);
      }
      return;
    }

    try {
      const res = await fetch(`${BACKEND_BASE}/liveness/frame/${sid}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image, authToken: token }),
      });
      const frameData = await res.json();
      console.log(`[Frame] Response (frame ${frameNum}):`, frameData);

      // Sync our local counter with what backend confirmed
      if (typeof frameData.frameNumber === 'number') {
        frameCountRef.current = frameData.frameNumber;
      } else {
        frameCountRef.current = frameNum;
      }

      // ── Rate limited (shouldn't happen with 8s interval, but handle it) ─
      if (res.status === 429 && frameData.code === 'CLIENT_RATE_LIMITED') {
        const waitMs = frameData.retryAfterMs || FRAME_INTERVAL_MS;
        setRawAzureStatus({
          type: 'warning',
          text: `Rate limited — next frame in ${Math.ceil(waitMs / 1000)}s`,
        });
        startCountdown(Math.ceil(waitMs / 1000));
        if (isCapturingRef.current) {
          frameTimerRef.current = setTimeout(sendFrame, waitMs);
        }
        return;
      }

      // ── Session exhausted ───────────────────────────────────────────────
      if (res.status === 429 && frameData.code === 'MAX_FRAMES_REACHED') {
        isCapturingRef.current = false;
        setStatus('failed');
        setRawAzureStatus({
          type: 'error',
          text: 'No liveness decision after 2 frames. Click "Try Again" to start a new session.',
        });
        stopRecording();
        fetchSessionResult(sid);
        return;
      }

      // ── Update status display with raw Azure output ─────────────────────
      setRawAzureStatus(buildRawStatus(frameData));

      const decision = frameData.livenessDecision;

      // ── Final decision received ─────────────────────────────────────────
      if (decision === 'realface' || decision === 'spoofface') {
        isCapturingRef.current = false;
        clearInterval(countdownRef.current);
        setRateLimitCountdown(0);
        setStatus(decision === 'realface' ? 'success' : 'failed');
        setLivenessResult(frameData.data);
        stopRecording();
        fetchSessionResult(sid);
        return;
      }

      // ── Azure returned an error code (FaceNotDetected, FaceWithMaskDetected, etc.)
      if (frameData.errorCode) {
        // Don't stop — send the next frame (user might adjust position)
        fetchSessionResult(sid);
      }

      // ── Schedule next frame if we still have attempts left ──────────────
      if (frameCountRef.current < MAX_FRAMES && isCapturingRef.current) {
        const label = frameData.errorCode
          ? `error.code: ${frameData.errorCode} | `
          : '';
        setRawAzureStatus({
          type: 'info',
          text: `${label}Frame ${frameCountRef.current}/${MAX_FRAMES} done. Next scan in ${FRAME_INTERVAL_MS / 1000}s — keep still...`,
        });
        startCountdown(Math.ceil(FRAME_INTERVAL_MS / 1000));
        frameTimerRef.current = setTimeout(sendFrame, FRAME_INTERVAL_MS);
      } else if (frameCountRef.current >= MAX_FRAMES) {
        // All frames sent, still no decision
        isCapturingRef.current = false;
        setStatus('failed');
        setRawAzureStatus({
          type: 'warning',
          text: `All ${MAX_FRAMES} frames sent — no decision received. Click "Try Again".`,
        });
        stopRecording();
        fetchSessionResult(sid);
      }
    } catch (err) {
      console.error('[Frame] Network error:', err);
      setRawAzureStatus({
        type: 'warning',
        text: `Network error: ${err.message} — retrying...`,
      });
      // Don't count network errors as a frame — retry after interval
      if (isCapturingRef.current) {
        frameTimerRef.current = setTimeout(sendFrame, FRAME_INTERVAL_MS);
      }
    }
  }, [captureFrame, stopRecording, fetchSessionResult, startCountdown]);

  // ─────────────────────────────────────────────────────────────────────────
  // Start detection
  // ─────────────────────────────────────────────────────────────────────────
  const startDetection = useCallback(async () => {
    // Reset state
    setStatus('starting');
    setLivenessResult(null);
    setAttempts([]);
    setRateLimitCountdown(0);
    setRecordedBlob(null); // Clear previous recording
    frameCountRef.current = 0;
    isCapturingRef.current = false;
    clearTimeout(frameTimerRef.current);
    setRawAzureStatus({
      type: 'info',
      text: 'Creating Azure liveness session...',
    });

    try {
      // ── Step 1: Create session (backend → Azure detectLiveness-sessions) ─
      const startRes = await fetch(`${BACKEND_BASE}/liveness/start`, {
        method: 'POST',
      });
      const startData = await startRes.json();

      if (!startRes.ok || !startData.sessionId || !startData.authToken) {
        setStatus('failed');
        setRawAzureStatus({
          type: 'error',
          text: `Session creation failed: ${JSON.stringify(startData)}`,
        });
        return;
      }

      console.log('[Liveness] Session ready:', startData.sessionId);

      // Store in refs so sendFrame closure always reads fresh values
      sessionIdRef.current = startData.sessionId;
      authTokenRef.current = startData.authToken;

      setRawAzureStatus({
        type: 'info',
        text: `Session ${startData.sessionId} active (${startData.modelVersion}). Starting recording...`,
      });

      // ── Step 2: Start recording BEFORE first frame ────────────────────────
      startRecording();

      // ── Step 3: Begin frame capture loop ─────────────────────────────────
      setStatus('capturing');
      isCapturingRef.current = true;

      // First frame fires immediately; sendFrame schedules subsequent frames itself
      await sendFrame();
    } catch (err) {
      console.error('[Liveness] startDetection error:', err);
      setStatus('failed');
      setRawAzureStatus({
        type: 'error',
        text: `Error starting detection: ${err.message}`,
      });
    }
  }, [startRecording, sendFrame]);

  // ─────────────────────────────────────────────────────────────────────────
  // Stop detection (user pressed Stop mid-session)
  // Recording is stopped but blob is kept for Compare Now
  // ─────────────────────────────────────────────────────────────────────────
  const stopDetection = useCallback(() => {
    clearTimeout(frameTimerRef.current);
    clearInterval(countdownRef.current);
    isCapturingRef.current = false;
    frameCountRef.current = 0;
    setStatus('idle');
    setRateLimitCountdown(0);
    setRawAzureStatus({
      type: 'info',
      text: 'Stopped. Your recording is saved — click "Compare Now" or "Start" to retry.',
    });
    stopRecording(); // blob is set in recorder.onstop
  }, [stopRecording]);

  // ─────────────────────────────────────────────────────────────────────────
  // Reset (Try Again — clears everything including the recording)
  // ─────────────────────────────────────────────────────────────────────────
  const resetDetection = useCallback(() => {
    clearTimeout(frameTimerRef.current);
    clearInterval(countdownRef.current);
    isCapturingRef.current = false;
    frameCountRef.current = 0;
    sessionIdRef.current = null;
    authTokenRef.current = null;

    stopRecording();

    setStatus('idle');
    setLivenessResult(null);
    setAttempts([]);
    setRateLimitCountdown(0);
    setRecordedBlob(null); // Clear recording on explicit retry
    setRecordingDuration(0);
    setRawAzureStatus({
      type: 'info',
      text: 'Camera ready. Click "Start" to begin.',
    });
  }, [stopRecording]);

  // ─────────────────────────────────────────────────────────────────────────
  // Helpers
  // ─────────────────────────────────────────────────────────────────────────
  const formatDuration = (s) =>
    `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

  return {
    // Camera
    liveVideoRef,
    liveMode,
    audioEnabled,
    cameraError,
    startCamera,
    stopCamera,
    toggleAudio,
    // Liveness
    status,
    rawAzureStatus,
    livenessResult,
    attempts,
    rateLimitCountdown,
    startDetection,
    stopDetection,
    resetDetection,
    // Recording — blob is kept after stop so Compare Now still works
    isRecording,
    recordedBlob,
    recordingLabel: formatDuration(recordingDuration),
  };
}

// ─── Build raw status display from Azure frame response ───────────────────────
function buildRawStatus(frameData) {
  if (frameData.livenessDecision === 'realface') {
    const pct =
      frameData.livenessScore != null
        ? ` | confidence: ${(frameData.livenessScore * 100).toFixed(2)}%`
        : '';
    return { type: 'success', text: `livenessDecision: realface${pct}` };
  }
  if (frameData.livenessDecision === 'spoofface') {
    const reason = frameData.failureReason
      ? ` | reason: ${frameData.failureReason}`
      : '';
    return { type: 'error', text: `livenessDecision: spoofface${reason}` };
  }
  if (frameData.errorCode) {
    return {
      type: 'warning',
      text: `error.code: ${frameData.errorCode} | ${frameData.errorMessage || ''}`,
    };
  }
  if (frameData.code && frameData.code !== 'ok') {
    return {
      type: 'warning',
      text: `code: ${frameData.code}${frameData.error ? ` | ${frameData.error}` : ''}`,
    };
  }
  return { type: 'info', text: 'Processing...' };
}
