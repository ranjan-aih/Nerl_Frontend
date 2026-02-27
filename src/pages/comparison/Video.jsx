import React, { useRef, useState, useEffect, useCallback } from 'react';
import {
  Button,
  CircularProgress,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Chip,
  LinearProgress,
  Tooltip,
} from '@mui/material';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import CompareArrowsIcon from '@mui/icons-material/CompareArrows';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import ImageIcon from '@mui/icons-material/Image';
import VideocamIcon from '@mui/icons-material/Videocam';
import VideocamOffIcon from '@mui/icons-material/VideocamOff';
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord';
import StopIcon from '@mui/icons-material/Stop';
import MicIcon from '@mui/icons-material/Mic';
import MicOffIcon from '@mui/icons-material/MicOff';
import RadioButtonCheckedIcon from '@mui/icons-material/RadioButtonChecked';
import ReplayIcon from '@mui/icons-material/Replay';
import VerifiedUserIcon from '@mui/icons-material/VerifiedUser';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import SaveIcon from '@mui/icons-material/Save';

import { API_BASE_URL, getRecentUploads } from '../../api/uploadApi';

// ─── Constants ────────────────────────────────────────────────────────────────
const STORAGE_KEY = 'videoComparisonState';
const FRAME_INTERVAL_MS = 8500; // slightly over Azure's 8s rate limit
const API = 'http://localhost:5000/api';
const IDB_DB = 'LivenessVideoDB';
const IDB_STORE = 'recordings';

// ─── Helpers ──────────────────────────────────────────────────────────────────
const normalizeUrl = (url) => {
  if (!url) return null;
  if (url.startsWith('http')) return url;
  return `${API_BASE_URL}${url}`;
};

const extractPath = (fullUrl) => {
  if (!fullUrl) return null;
  if (fullUrl.startsWith('/temp/')) return fullUrl;
  try {
    return new URL(fullUrl).pathname;
  } catch {
    return fullUrl.match(/\/temp\/.+/)?.[0] || null;
  }
};

const fmt = (s) =>
  `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

const FRIENDLY_ERRORS = {
  FaceMouthRegionNotVisible: 'Lower your mask or tilt your face slightly',
  FaceNotDetected:
    'No face detected — ensure good lighting and face the camera',
  FaceTooDark: 'Too dark — move to a brighter area',
  FaceTooFarAway: 'Too far away — move closer to the camera',
  FaceTooClose: 'Too close — move back slightly',
  FaceNotFrontal: 'Look straight at the camera',
  EyesBlinking: 'Keep your eyes open and look at the camera',
  SessionNotStarted: 'Session error — please retry',
  BLANK_FRAME: 'Camera frame is blank — ensure camera is active',
  FRAME_TOO_LARGE: 'Frame too large — try again',
};

// ─── IndexedDB helpers ────────────────────────────────────────────────────────
// localStorage cannot store binary blobs, so we use IndexedDB for video files.
const idbOpen = () =>
  new Promise((res, rej) => {
    const req = indexedDB.open(IDB_DB, 1);
    req.onupgradeneeded = (e) => e.target.result.createObjectStore(IDB_STORE);
    req.onsuccess = (e) => res(e.target.result);
    req.onerror = rej;
  });

const idbSave = async (key, blob) => {
  const db = await idbOpen();
  return new Promise((res, rej) => {
    const tx = db.transaction(IDB_STORE, 'readwrite');
    tx.objectStore(IDB_STORE).put(blob, key);
    tx.oncomplete = res;
    tx.onerror = rej;
  });
};

const idbLoad = async (key) => {
  const db = await idbOpen();
  return new Promise((res, rej) => {
    const tx = db.transaction(IDB_STORE, 'readonly');
    const r = tx.objectStore(IDB_STORE).get(key);
    r.onsuccess = () => res(r.result || null);
    r.onerror = rej;
  });
};

// ─── Main Component ───────────────────────────────────────────────────────────
export default function Video() {
  // ── File state ───────────────────────────────────────────────────────────────
  const [referenceFile, setReferenceFile] = useState(null);
  const [availableFiles, setAvailableFiles] = useState({ reference: [] });
  const [openDialog, setOpenDialog] = useState(false);
  const [loadingFiles, setLoadingFiles] = useState(false);

  // ── Comparison ───────────────────────────────────────────────────────────────
  const [compareResult, setCompareResult] = useState(null);
  const [compareLoading, setCompareLoading] = useState(false);
  const [compareError, setCompareError] = useState('');

  // ── Hydration ────────────────────────────────────────────────────────────────
  const [isHydrated, setIsHydrated] = useState(false);

  // ── Camera ───────────────────────────────────────────────────────────────────
  const [liveMode, setLiveMode] = useState(false);
  const [audioEnabled, setAudioEnabled] = useState(true);

  // ── Liveness ─────────────────────────────────────────────────────────────────
  // Status flow: idle → creating → activating → capturing → success | failed
  const [livenessStatus, setLivenessStatus] = useState('idle');
  const [livenessMessage, setLivenessMessage] = useState('');
  const [livenessResult, setLivenessResult] = useState(null);
  const [rateLimitCountdown, setRateLimitCountdown] = useState(0);

  // Use refs for session data so the frame-send closure always sees the latest values
  const sessionIdRef = useRef(null);
  const authTokenRef = useRef(null);
  const isCapturingRef = useRef(false);

  // ── Recording ────────────────────────────────────────────────────────────────
  const [isRecording, setIsRecording] = useState(false);
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [savedVideoKey, setSavedVideoKey] = useState(null);
  const [savedVideoUrl, setSavedVideoUrl] = useState(null);

  // ── Refs ─────────────────────────────────────────────────────────────────────
  const liveVideoRef = useRef(null);
  const streamRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const recordedChunksRef = useRef([]);
  const frameTimerRef = useRef(null);
  const recordingTimerRef = useRef(null);
  const countdownRef = useRef(null);

  // ─────────────────────────────────────────────────────────────────────────────
  // File loading
  // ─────────────────────────────────────────────────────────────────────────────
  const loadAvailableFiles = async () => {
    setLoadingFiles(true);
    try {
      const res = await getRecentUploads();
      if (res?.success) {
        const mapFile = (f) => ({
          name: f.name || f.storedName || 'Unnamed',
          url: f.url,
          path: extractPath(normalizeUrl(f.url)),
          fullUrl: normalizeUrl(f.url),
          size: f.size,
          uploadedAt: f.uploadedAt
            ? new Date(f.uploadedAt).toISOString()
            : null,
          ext: (f.name || '').split('.').pop().toLowerCase(),
          type: f.type,
          slot: f.slot,
        });
        const mapped = (res.files || []).map(mapFile);
        setAvailableFiles({
          reference: mapped.filter(
            (f) => f.slot === 'reference' && f.type === 'photo',
          ),
        });
      }
    } catch (err) {
      console.error('Error loading files:', err);
    } finally {
      setLoadingFiles(false);
    }
  };

  useEffect(() => {
    loadAvailableFiles();
  }, []);

  // ─────────────────────────────────────────────────────────────────────────────
  // LocalStorage hydration (metadata only — video blobs → IndexedDB)
  // ─────────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const p = JSON.parse(saved);
        if (p.referenceFile) setReferenceFile(p.referenceFile);
        if (p.compareResult) setCompareResult(p.compareResult);
        if (p.savedVideoKey) {
          setSavedVideoKey(p.savedVideoKey);
          idbLoad(p.savedVideoKey)
            .then((blob) => {
              if (blob) setSavedVideoUrl(URL.createObjectURL(blob));
            })
            .catch(console.error);
        }
      }
    } catch (err) {
      console.error('Hydration error:', err);
    } finally {
      setIsHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!isHydrated) return;
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          referenceFile,
          compareResult,
          savedVideoKey,
        }),
      );
    } catch {}
  }, [referenceFile, compareResult, savedVideoKey, isHydrated]);

  // (no provided files index to track)

  // ─────────────────────────────────────────────────────────────────────────────
  // Wire stream to video element when liveMode flips on
  // ─────────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    if (liveMode && liveVideoRef.current && streamRef.current) {
      liveVideoRef.current.srcObject = streamRef.current;
      liveVideoRef.current.play().catch(() => {});
    }
  }, [liveMode]);

  // ─────────────────────────────────────────────────────────────────────────────
  // Camera
  // ─────────────────────────────────────────────────────────────────────────────
  const startCamera = async () => {
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
      setLiveMode(true);
      setLivenessStatus('idle');
      setLivenessMessage('Camera ready. Click "Start Detection" to begin.');
    } catch (err) {
      console.error('Camera error:', err);
      setLivenessMessage(
        'Camera permission denied. Please allow access and try again.',
      );
    }
  };

  const stopCamera = useCallback(() => {
    clearTimeout(frameTimerRef.current);
    clearInterval(countdownRef.current);
    clearInterval(recordingTimerRef.current);
    isCapturingRef.current = false;

    if (mediaRecorderRef.current?.state !== 'inactive')
      mediaRecorderRef.current?.stop();
    setIsRecording(false);
    setRecordingDuration(0);

    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;

    if (liveVideoRef.current) {
      liveVideoRef.current.srcObject = null;
      liveVideoRef.current.load();
    }

    setLiveMode(false);
    setLivenessStatus('idle');
    setLivenessMessage('');
    setRateLimitCountdown(0);
    sessionIdRef.current = null;
    authTokenRef.current = null;
  }, []);

  useEffect(() => () => stopCamera(), [stopCamera]);

  // ─────────────────────────────────────────────────────────────────────────────
  // Countdown helper
  // ─────────────────────────────────────────────────────────────────────────────
  const startCountdown = (seconds) => {
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
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // Frame capture — draws video to canvas WITHOUT CSS mirror
  // ─────────────────────────────────────────────────────────────────────────────
  const captureFrame = () => {
    const video = liveVideoRef.current;
    if (!video || video.readyState < 2 || video.videoWidth === 0) return null;
    const canvas = document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    canvas.getContext('2d').drawImage(video, 0, 0, canvas.width, canvas.height);
    const b64 = canvas.toDataURL('image/jpeg', 0.85);
    return b64.length < 5000 ? null : b64;
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // Schedule next frame (setTimeout so we don't hammer Azure)
  // ─────────────────────────────────────────────────────────────────────────────
  const scheduleNextFrame = useCallback((delayMs = FRAME_INTERVAL_MS) => {
    clearTimeout(frameTimerRef.current);
    frameTimerRef.current = setTimeout(() => {
      if (isCapturingRef.current) sendFrame();
    }, delayMs);
  }, []);

  // ─────────────────────────────────────────────────────────────────────────────
  // Send a frame to backend → Azure
  // ─────────────────────────────────────────────────────────────────────────────
  const sendFrame = useCallback(async () => {
    if (!isCapturingRef.current) return;
    const sessionId = sessionIdRef.current;
    const authToken = authTokenRef.current;
    if (!sessionId || !authToken) return;

    const image = captureFrame();
    if (!image) {
      setLivenessMessage(
        'Camera not ready — ensure you are visible and well-lit',
      );
      scheduleNextFrame();
      return;
    }

    try {
      const res = await fetch(`${API}/liveness/frame/${sessionId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ image, authToken }),
      });
      const data = await res.json();
      console.log('[Frame] Response:', data);

      // Rate limited
      if (res.status === 429) {
        const wait =
          data.retryAfterSeconds ||
          Math.ceil((data.retryAfterMs || 8000) / 1000);
        setLivenessMessage(`Rate limited — next scan in ${wait}s`);
        startCountdown(wait);
        scheduleNextFrame(wait * 1000 + 300);
        return;
      }

      // Frame-level errors from backend
      if (data.code && data.code !== 'ok') {
        setLivenessMessage(
          FRIENDLY_ERRORS[data.code] ||
            data.errorMessage ||
            'Adjust your position',
        );
        scheduleNextFrame();
        return;
      }

      // Azure-level errors (face not visible, too dark, etc.)
      if (data.errorCode) {
        setLivenessMessage(
          FRIENDLY_ERRORS[data.errorCode] ||
            data.errorMessage ||
            'Adjust your position',
        );
        startCountdown(Math.ceil(FRAME_INTERVAL_MS / 1000));
        scheduleNextFrame();
        return;
      }

      const decision = data.livenessDecision;

      if (decision === 'realface') {
        isCapturingRef.current = false;
        clearTimeout(frameTimerRef.current);
        clearInterval(countdownRef.current);
        setLivenessStatus('success');
        setLivenessResult(data.data);
        const score = data.livenessScore;
        setLivenessMessage(
          `Real face confirmed${score ? ` (${(score * 100).toFixed(1)}% confidence)` : ''}`,
        );
        setRateLimitCountdown(0);
        stopRecordingFn();
        return;
      }

      if (decision === 'spoofface') {
        isCapturingRef.current = false;
        clearTimeout(frameTimerRef.current);
        clearInterval(countdownRef.current);
        setLivenessStatus('failed');
        setLivenessResult(data.data);
        setLivenessMessage('Spoof detected — please use a real face');
        setRateLimitCountdown(0);
        stopRecordingFn();
        return;
      }

      // Still scanning
      setLivenessMessage('Scanning... keep still and look at the camera');
      startCountdown(Math.ceil(FRAME_INTERVAL_MS / 1000));
      scheduleNextFrame();
    } catch (err) {
      console.error('[Frame] Send error:', err);
      setLivenessMessage('Connection error — retrying...');
      scheduleNextFrame();
    }
  }, [scheduleNextFrame]);

  // ─────────────────────────────────────────────────────────────────────────────
  // START LIVENESS — Correct 3-step Azure flow:

const startLivenessDetection = async () => {
  try {
    // Step 1: Create session
    setLivenessStatus('creating');
    setLivenessMessage('Creating liveness session...');
    setLivenessResult(null);
    setRateLimitCountdown(0);

    const createRes = await fetch(`${API}/liveness/start`, { method: 'POST' });
    if (!createRes.ok) throw new Error('Session creation failed');
    const createData = await createRes.json();

    if (!createData.sessionId || !createData.authToken) {
      setLivenessStatus('failed');
      setLivenessMessage('Failed to create session — please retry');
      return;
    }

    sessionIdRef.current = createData.sessionId;
    authTokenRef.current = createData.authToken;

    // Step 2: Start sending frames immediately — NO activation needed
    setLivenessStatus('capturing');
    setLivenessMessage('Look directly at the camera with your face fully visible...');
    isCapturingRef.current = true;
    startRecordingFn();
    sendFrame(); // first frame immediately
  } catch (err) {
    console.error('startLivenessDetection error:', err);
    setLivenessStatus('failed');
    setLivenessMessage('Error starting detection — please retry');
  }
};

  const resetLiveness = () => {
    clearTimeout(frameTimerRef.current);
    clearInterval(countdownRef.current);
    isCapturingRef.current = false;
    sessionIdRef.current = null;
    authTokenRef.current = null;
    setLivenessStatus('idle');
    setLivenessResult(null);
    setLivenessMessage('Camera ready. Click "Start Detection" to begin.');
    setRateLimitCountdown(0);
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // Recording — video saved to IndexedDB for later verification
  // ─────────────────────────────────────────────────────────────────────────────
  const startRecordingFn = () => {
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
      if (e.data?.size > 0) recordedChunksRef.current.push(e.data);
    };
    recorder.onstop = async () => {
      const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
      const key = `liveness_${Date.now()}`;
      try {
        await idbSave(key, blob);
        setSavedVideoKey(key);
        setSavedVideoUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return URL.createObjectURL(blob);
        });
        console.log(
          `[Recording] Saved to IndexedDB: ${key} (${(blob.size / 1024).toFixed(0)} KB)`,
        );
      } catch (err) {
        console.error('[Recording] IDB save failed:', err);
      }
    };

    recorder.start(500);
    mediaRecorderRef.current = recorder;
    setIsRecording(true);
    setRecordingDuration(0);
    recordingTimerRef.current = setInterval(
      () => setRecordingDuration((d) => d + 1),
      1000,
    );
  };

  const stopRecordingFn = () => {
    if (mediaRecorderRef.current?.state !== 'inactive')
      mediaRecorderRef.current?.stop();
    clearInterval(recordingTimerRef.current);
    setIsRecording(false);
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // Comparison
  // ─────────────────────────────────────────────────────────────────────────────
  const handleCompare = async () => {
    if (!referenceFile) {
      setCompareError('Please select a reference image');
      return;
    }
    if (livenessStatus !== 'success') {
      setCompareError('Complete liveness detection first');
      return;
    }
    if (!savedVideoKey) {
      setCompareError(
        'No recorded liveness video found — please complete detection first',
      );
      return;
    }
    try {
      setCompareLoading(true);
      setCompareError('');
      setCompareResult(null);

      // Load the recorded blob from IndexedDB and send as multipart
      const blob = await idbLoad(savedVideoKey);
      if (!blob) throw new Error('Recorded video not found in local storage');

      const formData = new FormData();
      formData.append('referenceUrl', referenceFile.fullUrl);
      formData.append('video', blob, 'liveness_recording.webm');

      const res = await fetch(`${API}/liveness/compare`, {
        method: 'POST',
        body: formData,
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.message || err.error || 'Comparison failed');
      }
      const data = await res.json();
      setCompareResult(data);
    } catch (err) {
      setCompareError(err.message || 'Failed to compare files');
    } finally {
      setCompareLoading(false);
    }
  };

  const handleClearSession = () => {
    setReferenceFile(null);
    setCompareResult(null);
    setCompareError('');
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {}
  };

  const handleSelectReference = (file) => {
    setReferenceFile(file);
    setOpenDialog(false);
  };

  // ─────────────────────────────────────────────────────────────────────────────
  // Render helpers
  // ─────────────────────────────────────────────────────────────────────────────
  const isDetecting = ['creating', 'activating', 'capturing'].includes(
    livenessStatus,
  );

  const STATUS_LABEL = {
    idle: 'Ready',
    creating: 'Creating session...',
    activating: 'Activating...',
    capturing: 'Scanning',
    success: 'Verified',
    failed: 'Failed',
  };

  const renderFileCard = (file, { selected = false, onClick }) => {
    const isPdf = file.ext === 'pdf';
    return (
      <div
        onClick={onClick}
        className={`h-40 w-40 flex flex-col border rounded-lg overflow-hidden cursor-pointer transition-all shadow-sm ${
          selected
            ? 'border-blue-600 shadow-md scale-[1.02] ring-2 ring-blue-300'
            : 'border-gray-200 hover:shadow-md hover:scale-[1.02]'
        }`}
      >
        <div className='h-32 bg-gray-50 flex items-center justify-center overflow-hidden relative'>
          {isPdf ? (
            <PictureAsPdfIcon className='text-red-600' sx={{ fontSize: 32 }} />
          ) : (
            <img
              src={file.fullUrl}
              alt={file.name}
              className='max-w-full max-h-full object-cover'
            />
          )}
        </div>
        <div className='px-2 py-1.5 flex-1 flex items-center justify-center'>
          <p className='text-[0.75rem] text-center font-semibold truncate w-full'>
            {file.name}
          </p>
        </div>
      </div>
    );
  };

  const renderReferenceBox = () => {
    if (!referenceFile) {
      return (
        <div
          onClick={() => setOpenDialog(true)}
          className='border-2 border-dashed border-gray-300 rounded-xl text-center text-gray-500 h-[315px] flex flex-col items-center justify-center cursor-pointer hover:bg-gray-50 transition'
        >
          <ImageIcon sx={{ fontSize: 48 }} />
          <p className='mt-2 text-sm font-semibold'>
            Click to select Reference Image
          </p>
          <p className='mt-1 text-xs'>
            Choose one photo from your recent uploads
          </p>
        </div>
      );
    }
    return (
      <div
        onClick={() => setOpenDialog(true)}
        className='border-2 border-green-500 bg-green-50 rounded-xl h-[260px] cursor-pointer hover:shadow-md transition flex flex-col'
      >
        {referenceFile.ext === 'pdf' ? (
          <div className='flex-1 flex flex-col items-center justify-center gap-2 px-3'>
            <PictureAsPdfIcon sx={{ fontSize: 48 }} className='text-red-600' />
            <p className='text-sm font-semibold text-center'>
              {referenceFile.name}
            </p>
            <Button
              size='small'
              variant='outlined'
              href={referenceFile.fullUrl}
              target='_blank'
              onClick={(e) => e.stopPropagation()}
            >
              Open PDF
            </Button>
          </div>
        ) : (
          <div className='flex-1 flex flex-col items-center justify-center px-3'>
            <img
              src={referenceFile.fullUrl}
              alt={referenceFile.name}
              className='w-full max-w-xs h-[190px] object-contain rounded-lg'
            />
            <p className='mt-2 text-sm font-semibold text-center truncate w-full'>
              {referenceFile.name}
            </p>
          </div>
        )}
      </div>
    );
  };

  const renderLiveDetectionBox = () => {
    const borderColor =
      livenessStatus === 'success'
        ? 'border-green-500'
        : livenessStatus === 'failed'
          ? 'border-red-500'
          : isDetecting
            ? 'border-blue-400'
            : 'border-gray-200';

    return (
      <div
        className={`border-2 ${borderColor} rounded-xl overflow-hidden bg-white shadow-sm flex flex-col transition-colors`}
        style={{ minHeight: 320 }}
      >
        {/* Header */}
        <div className='flex items-center justify-between px-4 py-2.5 bg-gradient-to-r from-slate-700 to-slate-800'>
          <div className='flex items-center gap-2'>
            <div
              className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
                livenessStatus === 'success'
                  ? 'bg-green-400'
                  : livenessStatus === 'failed'
                    ? 'bg-red-400'
                    : isDetecting
                      ? 'bg-blue-400 animate-pulse'
                      : liveMode
                        ? 'bg-green-400'
                        : 'bg-gray-400'
              }`}
            />
            <span className='text-white text-sm font-semibold tracking-wide'>
              Live Face Detection
            </span>
            {isRecording && (
              <Chip
                icon={
                  <FiberManualRecordIcon
                    sx={{ fontSize: 10, color: 'white !important' }}
                  />
                }
                label={fmt(recordingDuration)}
                size='small'
                sx={{
                  bgcolor: '#ef4444',
                  color: 'white',
                  fontSize: 11,
                  height: 20,
                  '& .MuiChip-icon': { color: 'white' },
                }}
              />
            )}
          </div>

          <div className='flex items-center gap-1.5'>
            {liveMode && (
              <Tooltip
                title={audioEnabled ? 'Mute microphone' : 'Unmute microphone'}
              >
                <button
                  onClick={() => {
                    streamRef.current?.getAudioTracks().forEach((t) => {
                      t.enabled = !audioEnabled;
                    });
                    setAudioEnabled((v) => !v);
                  }}
                  className={`text-white/90 hover:text-white py-0.5 px-3 rounded-full transition cursor-pointer ${audioEnabled ? 'bg-gray-500 hover:bg-gray-600' : 'bg-red-500 hover:bg-red-600'}`}
                >
                  {audioEnabled ? (
                    <MicIcon sx={{ fontSize: 18 }} />
                  ) : (
                    <MicOffIcon sx={{ fontSize: 18 }} />
                  )}
                </button>
              </Tooltip>
            )}
            <button
              onClick={liveMode ? stopCamera : startCamera}
              className={`flex items-center gap-1 text-xs font-semibold px-3 py-1.5 cursor-pointer rounded-full transition ${
                liveMode
                  ? 'bg-white hover:bg-gray-100 text-slate-700'
                  : 'bg-red-500 hover:bg-red-600 text-white'
              }`}
            >
              {liveMode ? (
                <VideocamIcon sx={{ fontSize: 16 }} />
              ) : (
                <>
                  <VideocamOffIcon sx={{ fontSize: 16 }} /> Camera
                </>
              )}
            </button>
          </div>
        </div>

        {/* Video area */}
        <div
          className='relative bg-black flex-1 flex items-center justify-center'
          style={{ height: 240, minHeight: 240 }}
        >
          <video
            ref={liveVideoRef}
            autoPlay
            playsInline
            muted
            onCanPlay={() => liveVideoRef.current?.play().catch(() => {})}
            style={{
              position: 'absolute',
              inset: 0,
              width: '100%',
              height: '100%',
              objectFit: 'cover',
              display: liveMode ? 'block' : 'none',
              transform: 'scaleX(-1)',
            }}
          />

          {!liveMode && (
            <div className='flex flex-col items-center justify-center gap-3 text-white/50'>
              <VideocamOffIcon sx={{ fontSize: 56 }} />
              <p className='text-sm font-medium'>Camera is off</p>
              <button
                onClick={startCamera}
                className='mt-1 cursor-pointer bg-white/10 hover:bg-white/20 text-white text-xs font-semibold px-5 py-2.5 rounded-full transition border border-white/20'
              >
                Turn On Camera
              </button>
            </div>
          )}

          {/* Face oval */}
          {liveMode && livenessStatus === 'capturing' && (
            <div className='absolute inset-0 flex flex-col items-center justify-center pointer-events-none'>
              <div
                className='border-4 border-white/80 rounded-full'
                style={{
                  width: 150,
                  height: 195,
                  borderStyle: 'dashed',
                  boxShadow: '0 0 0 9999px rgba(0,0,0,0.35)',
                  animation: 'pulse 2s cubic-bezier(0.4,0,0.6,1) infinite',
                }}
              />
              <p className='absolute bottom-3 text-white/90 text-[11px] font-semibold bg-black/50 px-3 py-1 rounded-full'>
                Align face within the oval
              </p>
            </div>
          )}

          {/* Creating/activating spinner overlay */}
          {liveMode &&
            (livenessStatus === 'creating' ||
              livenessStatus === 'activating') && (
              <div className='absolute inset-0 bg-black/60 flex flex-col items-center justify-center gap-3'>
                <CircularProgress size={40} sx={{ color: 'white' }} />
                <p className='text-white text-sm font-semibold'>
                  {STATUS_LABEL[livenessStatus]}
                </p>
              </div>
            )}

          {/* Countdown badge */}
          {liveMode &&
            rateLimitCountdown > 0 &&
            livenessStatus === 'capturing' && (
              <div className='absolute top-3 right-3 bg-black/70 text-white text-xs font-bold px-3 py-1.5 rounded-full flex items-center gap-1.5'>
                <HourglassEmptyIcon sx={{ fontSize: 13 }} />
                Next scan in {rateLimitCountdown}s
              </div>
            )}

          {/* Success overlay */}
          {liveMode && livenessStatus === 'success' && (
            <div className='absolute inset-0 bg-green-900/80 flex flex-col items-center justify-center gap-3'>
              <VerifiedUserIcon sx={{ fontSize: 64, color: '#4ade80' }} />
              <p className='text-white font-bold text-xl tracking-wide'>
                Liveness Confirmed
              </p>
              <p className='text-green-300 text-sm'>Real person detected ✓</p>
            </div>
          )}

          {/* Failed overlay */}
          {liveMode && livenessStatus === 'failed' && (
            <div className='absolute inset-0 bg-red-900/75 flex flex-col items-center justify-center gap-3'>
              <WarningAmberIcon sx={{ fontSize: 56, color: '#fbbf24' }} />
              <p className='text-white font-bold text-xl'>Detection Failed</p>
              <p className='text-red-300 text-sm'>Please try again</p>
            </div>
          )}
        </div>

        {/* Status message bar */}
        {liveMode && livenessMessage && (
          <div
            className={`px-4 py-2.5 text-xs font-medium border-t ${
              livenessStatus === 'success'
                ? 'bg-green-50 text-green-800 border-green-200'
                : livenessStatus === 'failed'
                  ? 'bg-red-50 text-red-800 border-red-200'
                  : isDetecting
                    ? 'bg-blue-50 text-blue-800 border-blue-200'
                    : 'bg-gray-50 text-gray-700 border-gray-200'
            }`}
          >
            {livenessStatus === 'capturing' && (
              <LinearProgress
                variant='indeterminate'
                sx={{
                  mb: 1,
                  height: 2,
                  borderRadius: 1,
                  bgcolor: 'rgba(59,130,246,0.2)',
                  '& .MuiLinearProgress-bar': { bgcolor: '#3b82f6' },
                }}
              />
            )}
            {livenessMessage}
          </div>
        )}

        {/* Azure result card */}
        {livenessResult &&
          (livenessStatus === 'success' || livenessStatus === 'failed') && (
            <div
              className={`px-4 py-3 border-t ${livenessStatus === 'success' ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}
            >
              <p className='text-[11px] font-bold text-gray-600 uppercase tracking-wider mb-2'>
                Azure Detection Result
              </p>
              <div className='flex flex-wrap gap-2'>
                <div
                  className={`px-3 py-1.5 rounded-full text-xs font-bold ${
                    livenessResult?.livenessDecision === 'realface'
                      ? 'bg-green-100 text-green-800 border border-green-300'
                      : 'bg-red-100 text-red-800 border border-red-300'
                  }`}
                >
                  {livenessResult?.livenessDecision === 'realface'
                    ? '✅ Real Face Confirmed'
                    : '🚫 Spoof Detected'}
                </div>
                {livenessResult?.livenessClassification?.confidence != null && (
                  <div className='px-3 py-1.5 rounded-full text-xs font-bold bg-blue-100 text-blue-800 border border-blue-300'>
                    📊{' '}
                    {(
                      livenessResult.livenessClassification.confidence * 100
                    ).toFixed(1)}
                    % confidence
                  </div>
                )}
                {livenessResult?.modelVersionUsed && (
                  <div className='px-3 py-1.5 rounded-full text-xs font-semibold bg-gray-100 text-gray-700 border border-gray-300'>
                    🤖 {livenessResult.modelVersionUsed}
                  </div>
                )}
              </div>
            </div>
          )}

        {/* Saved video indicator */}
        {savedVideoKey && (
          <div className='px-4 py-2 border-t border-purple-200 bg-purple-50 flex items-center gap-2 text-xs text-purple-800 font-semibold'>
            <SaveIcon sx={{ fontSize: 14 }} />
            <span>Liveness video saved locally</span>
            {savedVideoUrl && (
              <a
                href={savedVideoUrl}
                download='liveness_recording.webm'
                className='ml-auto text-purple-600 underline hover:text-purple-800'
              >
                Download
              </a>
            )}
          </div>
        )}

        {/* Action buttons */}
        {liveMode && (
          <div className='px-4 py-2 border-t border-gray-100 bg-gray-50 flex gap-2 items-center'>
            {livenessStatus === 'idle' && (
              <button
                onClick={startLivenessDetection}
                className='flex items-center gap-1.5 cursor-pointer bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-4 py-2 rounded-lg transition shadow-sm'
              >
                <RadioButtonCheckedIcon sx={{ fontSize: 15 }} />
                Start Detection
              </button>
            )}

            {(livenessStatus === 'creating' ||
              livenessStatus === 'activating') && (
              <div className='flex items-center gap-2 text-xs text-gray-600 px-2'>
                <CircularProgress size={14} />
                <span>{STATUS_LABEL[livenessStatus]}</span>
              </div>
            )}

            {livenessStatus === 'capturing' && (
              <button
                onClick={() => {
                  isCapturingRef.current = false;
                  clearTimeout(frameTimerRef.current);
                  clearInterval(countdownRef.current);
                  stopRecordingFn();
                  setLivenessStatus('idle');
                  setRateLimitCountdown(0);
                  setLivenessMessage(
                    'Stopped. Click "Start Detection" to retry.',
                  );
                }}
                className='flex items-center gap-1.5 cursor-pointer bg-red-500 hover:bg-red-600 text-white text-xs font-semibold px-4 py-2 rounded-lg transition'
              >
                <StopIcon sx={{ fontSize: 15 }} /> Stop
              </button>
            )}

            {(livenessStatus === 'success' || livenessStatus === 'failed') && (
              <button
                onClick={resetLiveness}
                className='flex items-center gap-1.5 bg-slate-600 hover:bg-slate-700 text-white text-xs font-semibold px-4 py-2 rounded-lg transition'
              >
                <ReplayIcon sx={{ fontSize: 15 }} /> Try Again
              </button>
            )}
          </div>
        )}

        {/* Success footer */}
        {livenessStatus === 'success' && (
          <div className='px-4 py-2.5 bg-green-600 text-white text-xs font-semibold flex items-center gap-2'>
            <CheckCircleIcon sx={{ fontSize: 16 }} />
            <span>Liveness verified — ready for comparison</span>
          </div>
        )}
      </div>
    );
  };

  const renderComparisonResults = () => {
    if (!compareResult) return null;
    const { liveness_score, confidence_score, cost, image } = compareResult;
    const isAccepted = confidence_score >= 80;
    return (
      <div className='space-y-6'>
        <div
          className={`flex flex-col md:flex-row md:items-center md:justify-between gap-4 rounded-xl border-2 p-4 ${isAccepted ? 'bg-green-50 border-green-500' : 'bg-red-50 border-red-500'}`}
        >
          <div>
            <p className='text-xl font-bold'>
              {isAccepted ? '✅ Match Accepted' : '❌ Match Not Strong'}
            </p>
            <p className='text-sm text-gray-600'>Confidence threshold: 80%</p>
          </div>
          <div className='text-lg font-semibold space-y-1'>
            <p>
              Confidence:{' '}
              <span className='text-blue-700'>
                {confidence_score?.toFixed(2)}%
              </span>
            </p>
            <p>
              Liveness:{' '}
              <span className='text-purple-700'>
                {liveness_score?.toFixed(2)}%
              </span>
            </p>
            <p>
              Cost: <span className='text-gray-700'>${cost}</span>
            </p>
          </div>
        </div>
        {image && (
          <div className='bg-white border rounded-xl p-4 shadow-sm'>
            <p className='text-lg font-semibold mb-3'>
              Extracted Frame / Result Image
            </p>
            <div className='flex justify-center'>
              <img
                src={`data:image/jpeg;base64,${image}`}
                alt='Result'
                className='max-w-sm rounded-lg border shadow-md'
              />
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className='px-4 md:px-10 py-1 w-full'>
      <div className='flex items-center justify-between mb-4'>
        <h2 className='font-semibold text-[22px] text-gray-700'>
          Video Comparison
        </h2>
        <Button
          size='small'
          variant='outlined'
          onClick={handleClearSession}
          sx={{ textTransform: 'none', fontSize: 12 }}
        >
          Clear
        </Button>
      </div>

      <div className='grid grid-cols-1 md:grid-cols-2 gap-4 bg-white rounded-2xl shadow-md p-4 md:p-6 mb-4'>
        <div>
          <div className='flex items-center gap-2 mb-4'>
            <p className='font-semibold text-[16px]'>Reference Image</p>
            {referenceFile && (
              <CheckCircleIcon
                sx={{ fontSize: 18 }}
                className='text-green-600'
              />
            )}
          </div>
          {renderReferenceBox()}
        </div>

        <div>
          <div className='flex items-center justify-between mb-2'>
            <div className='flex items-center gap-2'>
              <p className='font-semibold text-[16px]'>Live Verification</p>
              {livenessStatus === 'success' && (
                <CheckCircleIcon
                  sx={{ fontSize: 18 }}
                  className='text-green-600'
                />
              )}
              {livenessStatus === 'failed' && (
                <ErrorIcon sx={{ fontSize: 18 }} className='text-red-500' />
              )}
            </div>
          </div>

          {renderLiveDetectionBox()}
        </div>
      </div>

      <div className='mb-4 text-center'>
        <button
          type='button'
          disabled={
            !referenceFile || livenessStatus !== 'success' || compareLoading
          }
          onClick={handleCompare}
          className={`inline-flex items-center gap-2 rounded-full px-8 py-3 font-semibold text-white shadow-md transition text-[18px] ${
            !referenceFile || livenessStatus !== 'success' || compareLoading
              ? 'cursor-not-allowed bg-gray-400'
              : 'bg-blue-600 hover:bg-blue-700 cursor-pointer'
          }`}
        >
          {compareLoading ? (
            <CircularProgress size={20} sx={{ color: 'white' }} />
          ) : (
            <CompareArrowsIcon />
          )}
          {compareLoading ? 'Comparing...' : 'Compare Now'}
        </button>
        {!referenceFile && (
          <p className='text-xs text-gray-400 mt-2'>
            Select a reference image to enable comparison
          </p>
        )}
        {referenceFile && livenessStatus !== 'success' && (
          <p className='text-xs text-gray-400 mt-2'>
            Complete live detection to compare
          </p>
        )}
      </div>

      {compareError && (
        <div className='mb-3'>
          <Alert severity='error' onClose={() => setCompareError('')}>
            {compareError}
          </Alert>
        </div>
      )}

      <div className='bg-white rounded-xl shadow-md px-4 py-4'>
        <p className='text-[18px] font-semibold mb-2'>Comparison Results</p>
        {compareLoading ? (
          <div className='text-center py-6'>
            <CircularProgress />
            <p className='mt-2 text-sm text-gray-600'>Analyzing files...</p>
          </div>
        ) : compareResult ? (
          renderComparisonResults()
        ) : (
          <p className='text-center text-sm text-gray-500 py-3'>
            Complete live detection, then click{' '}
            <span className='font-semibold'>"Compare Now"</span>.
          </p>
        )}
      </div>

      <Dialog
        open={openDialog}
        onClose={() => setOpenDialog(false)}
        maxWidth='md'
        fullWidth
      >
        <DialogTitle>Select Reference Image</DialogTitle>
        <DialogContent>
          {loadingFiles ? (
            <div className='text-center py-6'>
              <CircularProgress />
              <p className='mt-2 text-sm'>Loading files...</p>
            </div>
          ) : availableFiles.reference.length === 0 ? (
            <div className='text-center py-6 text-gray-500'>
              <ImageIcon sx={{ fontSize: 60 }} />
              <p className='mt-2'>No reference images uploaded yet</p>
              <p className='text-xs mt-1'>Go to the Upload page to add files</p>
            </div>
          ) : (
            <div className='grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 mt-2'>
              {availableFiles.reference.map((file) => (
                <div key={file.url}>
                  {renderFileCard(file, {
                    selected: referenceFile?.url === file.url,
                    onClick: () => handleSelectReference(file),
                  })}
                </div>
              ))}
            </div>
          )}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDialog(false)}>Close</Button>
          <Button onClick={loadAvailableFiles} startIcon={<FolderOpenIcon />}>
            Refresh
          </Button>
        </DialogActions>
      </Dialog>
    </div>
  );
}
