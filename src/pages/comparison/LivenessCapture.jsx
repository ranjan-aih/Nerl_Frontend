import React, { useRef, useState, useEffect } from 'react';

const AZURE_FACE_ENDPOINT = import.meta.env.VITE_AZURE_FACE_ENDPOINT;

export default function LivenessCapture() {
  const videoRef = useRef(null);
  const [sessionId, setSessionId] = useState(null);
  const [authToken, setAuthToken] = useState(null);
  const [result, setResult] = useState('');
  const [capturing, setCapturing] = useState(false);
  const [status, setStatus] = useState('Idle');

  // STEP 1 — Start camera
  async function startCamera() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      videoRef.current.srcObject = stream;
      setStatus('🟢 Camera Ready');
    } catch (err) {
      console.error('Camera error:', err);
      setStatus('🚫 Camera Permission Denied');
    }
  }

  // STEP 1+2+3 — Backend creates Azure session, returns sessionId + authToken
  // STEP 4 — Frontend calls Azure session/start directly with authToken
  async function initSession() {
    try {
      setStatus('🔄 Creating session...');

      // Steps 1-3: Backend creates session with Azure
      const res = await fetch('http://localhost:5000/api/liveness/start', {
        method: 'POST',
      });
      const data = await res.json();

      if (!data.sessionId || !data.authToken) {
        setStatus('❌ Failed to create session');
        return;
      }

      console.log('Session created:', data.sessionId);
      setSessionId(data.sessionId);
      setAuthToken(data.authToken);

      // Step 4: Frontend calls Azure session/start directly using authToken
      setStatus('🔄 Starting Azure session...');
      const azureStartRes = await fetch(
        `${AZURE_FACE_ENDPOINT}/face/v1.2/session/start`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${data.authToken}`,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({}),
        },
      );

      if (!azureStartRes.ok) {
        const err = await azureStartRes.json();
        console.error('Azure session/start failed:', err);
        setStatus('❌ Azure Session Start Failed');
        return;
      }

      console.log('Azure session/start successful ✅');
      setStatus('📸 Session Ready — Capturing...');
      setCapturing(true);
    } catch (err) {
      console.error('initSession error:', err);
      setStatus('❌ Session Init Error');
    }
  }

  // STEP 5+6 — Frontend sends frame to backend, backend forwards to Azure
  async function sendFrame() {
    if (!videoRef.current || !sessionId || !authToken) return;

    const canvas = document.createElement('canvas');
    canvas.width = videoRef.current.videoWidth;
    canvas.height = videoRef.current.videoHeight;
    canvas.getContext('2d').drawImage(videoRef.current, 0, 0);

    const imageBase64 = canvas.toDataURL('image/jpeg');

    try {
      const res = await fetch(
        `http://localhost:5000/api/liveness/frame/${sessionId}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ image: imageBase64, authToken }),
        },
      );

      const data = await res.json();
      console.log('Frame response:', data);

      if (data?.code === '429') {
        setStatus('⏳ Rate limited, retrying...');
        return;
      }

      if (data?.data?.livenessDecision) {
        // Got a liveness decision — stop and show result
        setResult(JSON.stringify(data.data, null, 2));
        setStatus('✅ Liveness Complete');
        setCapturing(false);
      } else {
        setStatus('📤 Sending frames...');
      }
    } catch (err) {
      console.error('sendFrame error:', err);
    }
  }

  // STEP 7 — Poll result from backend
  async function checkResult() {
    try {
      setStatus('🔍 Checking result...');
      const res = await fetch(
        `http://localhost:5000/api/liveness/result/${sessionId}`,
      );
      const data = await res.json();
      console.log('Result:', data);
      setResult(JSON.stringify(data, null, 2));
      setStatus('✅ Result Received');
      setCapturing(false);
    } catch (err) {
      console.error('checkResult error:', err);
      setStatus('❌ Result Fetch Error');
    }
  }

  // Frame sending loop
  useEffect(() => {
    let interval;
    if (capturing) {
      interval = setInterval(sendFrame, 2000); // 2s to avoid 429 rate limit
    }
    return () => clearInterval(interval);
  }, [capturing, sessionId, authToken]);

  return (
    <div className='flex flex-col items-center space-y-6 p-6 bg-gray-50 min-h-screen'>
      <h2 className='text-3xl font-bold text-indigo-600'>
        Face Liveness Detection
      </h2>

      <div className='relative w-96 h-64 bg-gray-900 rounded-xl shadow-lg overflow-hidden'>
        <video
          ref={videoRef}
          autoPlay
          playsInline
          className='w-full h-full object-cover'
        />
        {!videoRef.current?.srcObject && (
          <div className='absolute inset-0 flex items-center justify-center text-white text-lg font-semibold'>
            Camera is Off
          </div>
        )}
      </div>

      <p className='text-gray-700 font-medium'>
        Status: <span className='text-indigo-500'>{status}</span>
      </p>

      <div className='flex gap-4'>
        <button
          onClick={startCamera}
          className='px-4 py-2 bg-indigo-500 text-white font-semibold rounded-lg hover:bg-indigo-600 transition'
        >
          Start Camera
        </button>
        <button
          onClick={initSession}
          disabled={!videoRef.current?.srcObject}
          className='px-4 py-2 bg-green-500 text-white font-semibold rounded-lg disabled:bg-gray-400 hover:bg-green-600 transition'
        >
          🚀 Start Liveness
        </button>
        <button
          onClick={checkResult}
          disabled={!sessionId}
          className='px-4 py-2 bg-blue-500 text-white font-semibold rounded-lg disabled:bg-gray-400 hover:bg-blue-600 transition'
        >
          Check Result
        </button>
      </div>

      {result && (
        <div className='w-full max-w-2xl p-4 bg-white border border-indigo-200 rounded-lg shadow-md overflow-auto'>
          <h3 className='text-xl font-semibold text-indigo-600 mb-2'>
            Liveness Output
          </h3>
          <pre className='text-sm text-gray-800'>{result}</pre>
        </div>
      )}
    </div>
  );
}



// import React, { useRef, useState, useEffect, useCallback } from 'react';
// import {
//   Button,
//   CircularProgress,
//   Alert,
//   Dialog,
//   DialogTitle,
//   DialogContent,
//   DialogActions,
//   Chip,
//   LinearProgress,
//   Tooltip,
// } from '@mui/material';

// import { MdOutlineSlowMotionVideo } from 'react-icons/md';

// import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
// import ChevronRightIcon from '@mui/icons-material/ChevronRight';
// import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
// import CompareArrowsIcon from '@mui/icons-material/CompareArrows';
// import CheckCircleIcon from '@mui/icons-material/CheckCircle';
// import ErrorIcon from '@mui/icons-material/Error';
// import FolderOpenIcon from '@mui/icons-material/FolderOpen';
// import ImageIcon from '@mui/icons-material/Image';
// import VideocamIcon from '@mui/icons-material/Videocam';
// import VideocamOffIcon from '@mui/icons-material/VideocamOff';
// import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord';
// import StopIcon from '@mui/icons-material/Stop';
// import MicIcon from '@mui/icons-material/Mic';
// import MicOffIcon from '@mui/icons-material/MicOff';
// import RadioButtonCheckedIcon from '@mui/icons-material/RadioButtonChecked';
// import ReplayIcon from '@mui/icons-material/Replay';
// import VerifiedUserIcon from '@mui/icons-material/VerifiedUser';
// import WarningAmberIcon from '@mui/icons-material/WarningAmber';
// import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';

// import { API_BASE_URL, getRecentUploads } from '../../api/uploadApi';
// import { verifyVideo } from '../../api/comparisonApi';

// // ─── Constants ────────────────────────────────────────────────────────────────
// const STORAGE_KEY = 'videoComparisonState';
// const VIDEO_EXTS = ['mp4', 'webm', 'mov', 'avi', 'mkv', 'ogg'];
// const AZURE_FACE_ENDPOINT = import.meta.env.VITE_AZURE_FACE_ENDPOINT;

// // 6 seconds between frames — safely above Azure free tier (1 req/5s)
// const FRAME_INTERVAL_MS = 6000;

// // ─── Helpers ──────────────────────────────────────────────────────────────────
// const normalizeUrl = (url) => {
//   if (!url) return null;
//   if (url.startsWith('http')) return url;
//   return `${API_BASE_URL}${url}`;
// };

// const extractPath = (fullUrl) => {
//   if (!fullUrl) return null;
//   if (fullUrl.startsWith('/temp/')) return fullUrl;
//   try {
//     const url = new URL(fullUrl);
//     return url.pathname;
//   } catch {
//     const match = fullUrl.match(/\/temp\/.+/);
//     return match ? match[0] : null;
//   }
// };

// const isVideoFile = (ext) => VIDEO_EXTS.includes((ext || '').toLowerCase());

// // ─── Liveness friendly error messages ────────────────────────────────────────
// const LIVENESS_ERROR_MESSAGES = {
//   FaceMouthRegionNotVisible:
//     '👄 Mouth region not visible — lower your mask or tilt your face slightly',
//   FaceNotDetected:
//     '🔍 No face detected — ensure good lighting and face the camera directly',
//   FaceTooDark: '💡 Too dark — move to a brighter area',
//   FaceTooFarAway: '📏 Too far — move closer to the camera',
//   FaceTooClose: '📏 Too close — move back slightly',
//   FaceNotFrontal: '↕️ Face not frontal — look straight at the camera',
//   EyesBlinking: '👁️ Keep your eyes open and look at the camera',
//   SessionNotStarted:
//     '⏳ Session not started — please click "Start Detection" again',
//   BLANK_FRAME:
//     '⚠️ Camera frame is blank — ensure camera is active and well-lit',
//   FRAME_TOO_LARGE: '⚠️ Frame too large — please try again',
// };

// // ─── Main Component ───────────────────────────────────────────────────────────
// export default function VideoComparison() {
//   // ── File selection ──────────────────────────────────────────────────────────
//   const [referenceFile, setReferenceFile] = useState(null);
//   const [providedFiles, setProvidedFiles] = useState([]);
//   const [currentProvidedIndex, setCurrentProvidedIndex] = useState(0);
//   const [availableFiles, setAvailableFiles] = useState({
//     reference: [],
//     provided: [],
//   });
//   const [openDialog, setOpenDialog] = useState(false);
//   const [dialogType, setDialogType] = useState('reference');
//   const [loadingFiles, setLoadingFiles] = useState(false);
//   const [tempProvidedSelection, setTempProvidedSelection] = useState([]);

//   // ── Comparison ──────────────────────────────────────────────────────────────
//   const [compareResult, setCompareResult] = useState(null);
//   const [compareLoading, setCompareLoading] = useState(false);
//   const [compareError, setCompareError] = useState('');

//   // ── Hydration ───────────────────────────────────────────────────────────────
//   const [isHydrated, setIsHydrated] = useState(false);

//   // ── Liveness state ──────────────────────────────────────────────────────────
//   const [liveMode, setLiveMode] = useState(false);
//   const [livenessSessionId, setLivenessSessionId] = useState(null);
//   const [livenessAuthToken, setLivenessAuthToken] = useState(null);
//   const [livenessCapturing, setLivenessCapturing] = useState(false);
//   const [livenessStatus, setLivenessStatus] = useState('idle'); // idle | starting | capturing | success | failed
//   const [livenessMessage, setLivenessMessage] = useState('');
//   const [livenessResult, setLivenessResult] = useState(null);
//   const [livenessAttempts, setLivenessAttempts] = useState([]);

//   // ── Rate limit countdown ────────────────────────────────────────────────────
//   const [rateLimitCountdown, setRateLimitCountdown] = useState(0); // seconds remaining

//   // ── Recording state ─────────────────────────────────────────────────────────
//   const [isRecording, setIsRecording] = useState(false);
//   const [recordedBlob, setRecordedBlob] = useState(null);
//   const [recordingDuration, setRecordingDuration] = useState(0);
//   const [audioEnabled, setAudioEnabled] = useState(true);

//   // ── Refs ────────────────────────────────────────────────────────────────────
//   const liveVideoRef = useRef(null);
//   const streamRef = useRef(null);
//   const mediaRecorderRef = useRef(null);
//   const recordedChunksRef = useRef([]);
//   const livenessIntervalRef = useRef(null);
//   const recordingTimerRef = useRef(null);
//   const countdownIntervalRef = useRef(null);
//   const isCapturingRef = useRef(false); // sync ref to avoid stale closures

//   // ─────────────────────────────────────────────────────────────────────────────
//   // File loading
//   // ─────────────────────────────────────────────────────────────────────────────
//   const loadAvailableFiles = async () => {
//     setLoadingFiles(true);
//     try {
//       const res = await getRecentUploads();
//       if (res?.success) {
//         const allFiles = res.files || [];
//         const mapFile = (f) => ({
//           name: f.name || f.storedName || 'Unnamed',
//           url: f.url,
//           path: extractPath(normalizeUrl(f.url)),
//           fullUrl: normalizeUrl(f.url),
//           size: f.size,
//           uploadedAt: f.uploadedAt
//             ? new Date(f.uploadedAt).toISOString()
//             : null,
//           ext: (f.name || '').split('.').pop().toLowerCase(),
//           type: f.type,
//           slot: f.slot,
//         });
//         const mapped = allFiles.map(mapFile);
//         setAvailableFiles({
//           reference: mapped.filter(
//             (f) => f.slot === 'reference' && f.type === 'photo',
//           ),
//           provided: mapped.filter(
//             (f) => f.slot === 'provided' && f.type === 'video',
//           ),
//         });
//       }
//     } catch (err) {
//       console.error('Error loading files:', err);
//     } finally {
//       setLoadingFiles(false);
//     }
//   };

//   useEffect(() => {
//     loadAvailableFiles();
//   }, []);

//   // ─────────────────────────────────────────────────────────────────────────────
//   // LocalStorage hydration
//   // ─────────────────────────────────────────────────────────────────────────────
//   useEffect(() => {
//     try {
//       const saved = localStorage.getItem(STORAGE_KEY);
//       if (!saved) {
//         setIsHydrated(true);
//         return;
//       }
//       const parsed = JSON.parse(saved);
//       if (parsed.referenceFile) setReferenceFile({ ...parsed.referenceFile });
//       if (Array.isArray(parsed.providedFiles))
//         setProvidedFiles(parsed.providedFiles);
//       if (typeof parsed.currentProvidedIndex === 'number')
//         setCurrentProvidedIndex(parsed.currentProvidedIndex);
//       if (parsed.compareResult) setCompareResult(parsed.compareResult);
//     } catch (err) {
//       console.error('Error hydrating:', err);
//     } finally {
//       setIsHydrated(true);
//     }
//   }, []);

//   useEffect(() => {
//     if (!isHydrated) return;
//     try {
//       localStorage.setItem(
//         STORAGE_KEY,
//         JSON.stringify({
//           referenceFile,
//           providedFiles,
//           currentProvidedIndex,
//           compareResult,
//         }),
//       );
//     } catch {}
//   }, [
//     referenceFile,
//     providedFiles,
//     currentProvidedIndex,
//     compareResult,
//     isHydrated,
//   ]);

//   useEffect(() => {
//     if (!providedFiles.length) {
//       setCurrentProvidedIndex(0);
//       return;
//     }
//     if (currentProvidedIndex >= providedFiles.length)
//       setCurrentProvidedIndex(0);
//   }, [providedFiles]);

//   // ─────────────────────────────────────────────────────────────────────────────
//   // Camera — video element is always in DOM; srcObject set via useEffect
//   // ─────────────────────────────────────────────────────────────────────────────

//   // Whenever streamRef changes, wire it to the video element
//   useEffect(() => {
//     if (liveVideoRef.current && streamRef.current) {
//       liveVideoRef.current.srcObject = streamRef.current;
//       liveVideoRef.current.play().catch(() => {});
//     }
//   }, [liveMode]); // re-run when liveMode flips to true (video element becomes visible)

//   const startCamera = async () => {
//     try {
//       const stream = await navigator.mediaDevices.getUserMedia({
//         video: {
//           width: { ideal: 640, max: 1280 },
//           height: { ideal: 480, max: 720 },
//           facingMode: 'user',
//         },
//         audio: true,
//       });
//       streamRef.current = stream;
//       setLiveMode(true); // video element becomes visible after this
//       setLivenessStatus('idle');
//       setLivenessMessage('Camera ready. Click "Start Detection" to begin.');
//     } catch (err) {
//       console.error('Camera error:', err);
//       setLivenessMessage(
//         '🚫 Camera or microphone permission denied. Please allow access and try again.',
//       );
//     }
//   };

//   const stopCamera = useCallback(() => {
//     clearInterval(livenessIntervalRef.current);
//     clearInterval(countdownIntervalRef.current);
//     isCapturingRef.current = false;
//     setLivenessCapturing(false);
//     setLivenessStatus('idle');
//     setRateLimitCountdown(0);

//     if (
//       mediaRecorderRef.current &&
//       mediaRecorderRef.current.state !== 'inactive'
//     ) {
//       mediaRecorderRef.current.stop();
//     }
//     clearInterval(recordingTimerRef.current);
//     setIsRecording(false);
//     setRecordingDuration(0);

//     if (streamRef.current) {
//       streamRef.current.getTracks().forEach((t) => t.stop());
//       streamRef.current = null;
//     }
//     // Clear video element srcObject so it stops showing frames
//     if (liveVideoRef.current) {
//       liveVideoRef.current.srcObject = null;
//       liveVideoRef.current.load(); // reset the element
//     }

//     setLiveMode(false);
//     setLivenessSessionId(null);
//     setLivenessAuthToken(null);
//     setLivenessMessage('');
//   }, []);

//   useEffect(() => () => stopCamera(), [stopCamera]);

//   // ─────────────────────────────────────────────────────────────────────────────
//   // Rate limit countdown display
//   // ─────────────────────────────────────────────────────────────────────────────
//   const startCountdown = (seconds) => {
//     clearInterval(countdownIntervalRef.current);
//     setRateLimitCountdown(seconds);
//     countdownIntervalRef.current = setInterval(() => {
//       setRateLimitCountdown((prev) => {
//         if (prev <= 1) {
//           clearInterval(countdownIntervalRef.current);
//           return 0;
//         }
//         return prev - 1;
//       });
//     }, 1000);
//   };

//   // ─────────────────────────────────────────────────────────────────────────────
//   // Liveness detection
//   // ─────────────────────────────────────────────────────────────────────────────
//   const startLivenessDetection = async () => {
//     try {
//       setLivenessStatus('starting');
//       setLivenessMessage('Creating liveness session...');
//       setLivenessResult(null);
//       setLivenessAttempts([]);
//       setRateLimitCountdown(0);

//       // Steps 1-3: Backend creates session
//       const res = await fetch('http://localhost:5000/api/liveness/start', {
//         method: 'POST',
//       });
//       const data = await res.json();

//       if (!data.sessionId || !data.authToken) {
//         setLivenessStatus('failed');
//         setLivenessMessage('❌ Failed to create session — please retry');
//         return;
//       }

//       setLivenessSessionId(data.sessionId);
//       setLivenessAuthToken(data.authToken);

//       // Step 4: Frontend calls Azure session/start directly
//       setLivenessMessage('Activating Azure session...');
//       const azureStart = await fetch(
//         `${AZURE_FACE_ENDPOINT}/face/v1.2/session/start`,
//         {
//           method: 'POST',
//           headers: {
//             Authorization: `Bearer ${data.authToken}`,
//             'Content-Type': 'application/json',
//           },
//           body: JSON.stringify({}),
//         },
//       );

//       if (!azureStart.ok) {
//         const err = await azureStart.json();
//         console.error('Azure session/start failed:', err);
//         setLivenessStatus('failed');
//         setLivenessMessage('❌ Azure session activation failed — please retry');
//         return;
//       }

//       setLivenessStatus('capturing');
//       setLivenessMessage(
//         '👤 Look directly at the camera with your face fully visible...',
//       );
//       isCapturingRef.current = true;
//       setLivenessCapturing(true);
//       startRecording();
//     } catch (err) {
//       console.error('startLivenessDetection error:', err);
//       setLivenessStatus('failed');
//       setLivenessMessage('❌ Error starting detection — please retry');
//     }
//   };

//   // ─── Frame capture helper ────────────────────────────────────────────────────
//   // const captureFrame = () => {
//   //   const video = liveVideoRef.current;
//   //   if (!video) {
//   //     console.warn('[Frame] No video ref');
//   //     return null;
//   //   }

//   //   // Guard: video must be playing with real dimensions
//   //   if (
//   //     video.readyState < 2 ||
//   //     video.videoWidth === 0 ||
//   //     video.videoHeight === 0
//   //   ) {
//   //     console.warn(
//   //       '[Frame] Video not ready —',
//   //       'readyState:',
//   //       video.readyState,
//   //       'size:',
//   //       video.videoWidth,
//   //       'x',
//   //       video.videoHeight,
//   //     );
//   //     return null;
//   //   }

//   //   const canvas = document.createElement('canvas');
//   //   canvas.width = video.videoWidth;
//   //   canvas.height = video.videoHeight;

//   //   const ctx = canvas.getContext('2d');
//   //   // NOTE: draw WITHOUT mirroring — the mirror is CSS-only for display.
//   //   // Azure needs the real (unmirrored) image.
//   //   ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

//   //   const imageBase64 = canvas.toDataURL('image/jpeg', 0.92);

//   //   // Guard: blank/black frame
//   //   if (imageBase64.length < 5000) {
//   //     console.warn(
//   //       '[Frame] Frame too small (likely blank):',
//   //       imageBase64.length,
//   //       'chars',
//   //     );
//   //     return null;
//   //   }

//   //   console.log(
//   //     `[Frame] Captured ${canvas.width}x${canvas.height} — ${(imageBase64.length / 1024).toFixed(1)} KB`,
//   //   );
//   //   return imageBase64;
//   // };

//   const captureFrame = () => {
//     const video = liveVideoRef.current;
//     if (!video) {
//       console.warn('[Frame] No video ref');
//       return null;
//     }

//     if (
//       video.readyState < 2 ||
//       video.videoWidth === 0 ||
//       video.videoHeight === 0
//     ) {
//       console.warn(
//         '[Frame] Video not ready —',
//         video.readyState,
//         video.videoWidth,
//         'x',
//         video.videoHeight,
//       );
//       return null;
//     }

//     // ✅ Cap resolution to 640×480 max — Azure doesn't need 1280p, keeps payload small
//     const MAX_WIDTH = 640;
//     const MAX_HEIGHT = 480;

//     let w = video.videoWidth;
//     let h = video.videoHeight;

//     if (w > MAX_WIDTH || h > MAX_HEIGHT) {
//       const ratio = Math.min(MAX_WIDTH / w, MAX_HEIGHT / h);
//       w = Math.round(w * ratio);
//       h = Math.round(h * ratio);
//     }

//     const canvas = document.createElement('canvas');
//     canvas.width = w;
//     canvas.height = h;

//     const ctx = canvas.getContext('2d');
//     ctx.drawImage(video, 0, 0, w, h); // draw at reduced size

//     // ✅ Lower JPEG quality — 0.8 gives ~80–150KB which is ideal for Azure
//     const imageBase64 = canvas.toDataURL('image/jpeg', 0.8);

//     if (imageBase64.length < 5000) {
//       console.warn(
//         '[Frame] Frame too small (likely blank):',
//         imageBase64.length,
//         'chars',
//       );
//       return null;
//     }

//     console.log(
//       `[Frame] ${w}x${h} — ${(imageBase64.length / 1024).toFixed(1)} KB`,
//     );
//     return imageBase64;
//   };

//   // ─── Frame sending loop ──────────────────────────────────────────────────────
//   useEffect(() => {
//     if (!livenessCapturing || !livenessSessionId || !livenessAuthToken) {
//       clearInterval(livenessIntervalRef.current);
//       return;
//     }

//     // Send first frame immediately, then repeat on interval
//     const sendFrame = async () => {
//       if (!isCapturingRef.current) return;

//       const imageBase64 = captureFrame();
//       if (!imageBase64) {
//         setLivenessMessage(
//           '⚠️ Camera not ready — ensure you are visible and well-lit',
//         );
//         return;
//       }

//       try {
//         const res = await fetch(
//           `http://localhost:5000/api/liveness/frame/${livenessSessionId}`,
//           {
//             method: 'POST',
//             headers: { 'Content-Type': 'application/json' },
//             body: JSON.stringify({
//               image: imageBase64,
//               authToken: livenessAuthToken,
//             }),
//           },
//         );

//         const frameData = await res.json();
//         console.log('[Frame] Response:', frameData);

//         // ── Handle rate limiting ────────────────────────────────────────────
//         if (res.status === 429) {
//           const waitSec =
//             frameData.retryAfterSeconds ||
//             Math.ceil((frameData.retryAfterMs || 6000) / 1000);
//           setLivenessMessage(`⏳ Rate limited — next attempt in ${waitSec}s`);
//           startCountdown(waitSec);
//           return;
//         }

//         // ── Handle specific error codes from backend ────────────────────────
//         if (frameData.code) {
//           const friendly =
//             LIVENESS_ERROR_MESSAGES[frameData.code] ||
//             frameData.details?.error?.message ||
//             'Adjust your position and try again';
//           setLivenessMessage(friendly);
//           if (frameData.code === 'BLANK_FRAME') return;
//         }

//         // ── Liveness decision ───────────────────────────────────────────────
//         if (frameData?.data?.livenessDecision === 'realface') {
//           clearInterval(livenessIntervalRef.current);
//           clearInterval(countdownIntervalRef.current);
//           isCapturingRef.current = false;
//           setLivenessCapturing(false);
//           setLivenessStatus('success');
//           setLivenessResult(frameData.data);
//           setLivenessMessage('✅ Liveness confirmed — real face detected!');
//           setRateLimitCountdown(0);
//           stopRecording();
//           return;
//         }

//         if (frameData?.data?.livenessDecision === 'spoofface') {
//           clearInterval(livenessIntervalRef.current);
//           clearInterval(countdownIntervalRef.current);
//           isCapturingRef.current = false;
//           setLivenessCapturing(false);
//           setLivenessStatus('failed');
//           setLivenessResult(frameData.data);
//           setLivenessMessage('⚠️ Spoof detected — please use a real face');
//           setRateLimitCountdown(0);
//           stopRecording();
//           return;
//         }

//         // Still processing — update message if attempt errors exist
//         if (frameData?.data?.error?.code) {
//           const friendly =
//             LIVENESS_ERROR_MESSAGES[frameData.data.error.code] ||
//             frameData.data.error.message;
//           setLivenessMessage(friendly);
//         } else if (!frameData.code) {
//           setLivenessMessage('👤 Keep looking at the camera...');
//           setRateLimitCountdown(Math.ceil(FRAME_INTERVAL_MS / 1000));
//           startCountdown(Math.ceil(FRAME_INTERVAL_MS / 1000));
//         }

//         // Poll attempt errors in parallel
//         checkLivenessAttempts();
//       } catch (err) {
//         console.error('[Frame] Send error:', err);
//         setLivenessMessage('⚠️ Connection error — retrying...');
//       }
//     };

//     // Fire immediately then on interval
//     sendFrame();
//     livenessIntervalRef.current = setInterval(sendFrame, FRAME_INTERVAL_MS);

//     return () => {
//       clearInterval(livenessIntervalRef.current);
//     };
//   }, [livenessCapturing, livenessSessionId, livenessAuthToken]);

//   // ─── Poll attempt errors ─────────────────────────────────────────────────────
//   const checkLivenessAttempts = async () => {
//     if (!livenessSessionId) return;
//     try {
//       const res = await fetch(
//         `http://localhost:5000/api/liveness/result/${livenessSessionId}`,
//       );
//       const data = await res.json();
//       if (data?.results?.attempts?.length) {
//         // Sort descending by attemptId to get latest first
//         const sorted = [...data.results.attempts].sort(
//           (a, b) => b.attemptId - a.attemptId,
//         );
//         setLivenessAttempts(sorted);
//         const latest = sorted[0];
//         if (latest?.error?.code) {
//           const friendly =
//             LIVENESS_ERROR_MESSAGES[latest.error.code] || latest.error.message;
//           setLivenessMessage(friendly);
//         }
//       }
//     } catch {}
//   };

//   // ─── Reset ───────────────────────────────────────────────────────────────────
//   const resetLiveness = () => {
//     clearInterval(livenessIntervalRef.current);
//     clearInterval(countdownIntervalRef.current);
//     isCapturingRef.current = false;
//     setLivenessCapturing(false);
//     setLivenessStatus('idle');
//     setLivenessResult(null);
//     setLivenessAttempts([]);
//     setLivenessSessionId(null);
//     setLivenessAuthToken(null);
//     setLivenessMessage('Camera ready. Click "Start Detection" to begin.');
//     setRecordedBlob(null);
//     setRecordingDuration(0);
//     setRateLimitCountdown(0);
//   };

//   // ─────────────────────────────────────────────────────────────────────────────
//   // Recording
//   // ─────────────────────────────────────────────────────────────────────────────
//   const startRecording = () => {
//     if (!streamRef.current) return;
//     recordedChunksRef.current = [];

//     let recorder;
//     try {
//       recorder = new MediaRecorder(streamRef.current, {
//         mimeType: 'video/webm;codecs=vp9,opus',
//       });
//     } catch {
//       recorder = new MediaRecorder(streamRef.current);
//     }

//     recorder.ondataavailable = (e) => {
//       if (e.data && e.data.size > 0) recordedChunksRef.current.push(e.data);
//     };
//     recorder.onstop = () => {
//       const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
//       setRecordedBlob(blob);
//     };

//     recorder.start(500);
//     mediaRecorderRef.current = recorder;
//     setIsRecording(true);
//     setRecordingDuration(0);

//     recordingTimerRef.current = setInterval(
//       () => setRecordingDuration((d) => d + 1),
//       1000,
//     );
//   };

//   const stopRecording = () => {
//     if (
//       mediaRecorderRef.current &&
//       mediaRecorderRef.current.state !== 'inactive'
//     ) {
//       mediaRecorderRef.current.stop();
//     }
//     clearInterval(recordingTimerRef.current);
//     setIsRecording(false);
//   };

//   const formatDuration = (s) =>
//     `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

//   // ─────────────────────────────────────────────────────────────────────────────
//   // Send recording for audio/face analysis
//   // ─────────────────────────────────────────────────────────────────────────────
//   const sendRecordingForAnalysis = async () => {
//     if (!recordedBlob) return;
//     const formData = new FormData();
//     formData.append('video', recordedBlob, 'liveness_recording.webm');
//     if (referenceFile?.fullUrl)
//       formData.append('referenceUrl', referenceFile.fullUrl);
//     if (livenessSessionId) formData.append('sessionId', livenessSessionId);

//     try {
//       setLivenessMessage('📤 Sending recording for audio/face analysis...');
//       const res = await fetch(
//         'http://localhost:5000/api/liveness/analyze-recording',
//         {
//           method: 'POST',
//           body: formData,
//         },
//       );
//       const data = await res.json();
//       console.log('Audio analysis result:', data);
//       setLivenessMessage('✅ Recording sent successfully for analysis');
//     } catch (err) {
//       console.error('Recording upload error:', err);
//       setLivenessMessage('⚠️ Recording upload failed — please retry');
//     }
//   };

//   // ─────────────────────────────────────────────────────────────────────────────
//   // Comparison handlers
//   // ─────────────────────────────────────────────────────────────────────────────
//   const handlePrevProvided = () =>
//     setCurrentProvidedIndex((p) =>
//       p === 0 ? providedFiles.length - 1 : p - 1,
//     );
//   const handleNextProvided = () =>
//     setCurrentProvidedIndex((p) =>
//       p === providedFiles.length - 1 ? 0 : p + 1,
//     );

//   const handleClearSession = () => {
//     setReferenceFile(null);
//     setProvidedFiles([]);
//     setCurrentProvidedIndex(0);
//     setCompareResult(null);
//     setCompareError('');
//     try {
//       localStorage.removeItem(STORAGE_KEY);
//     } catch {}
//   };

//   const handleOpenDialog = (type) => {
//     setDialogType(type);
//     if (type === 'provided')
//       setTempProvidedSelection(providedFiles.map((f) => f.url));
//     setOpenDialog(true);
//   };

//   const handleSelectReference = (file) => {
//     setReferenceFile(file);
//     setOpenDialog(false);
//   };

//   const handleToggleProvidedSelection = (file) => {
//     setTempProvidedSelection((prev) =>
//       prev.includes(file.url)
//         ? prev.filter((u) => u !== file.url)
//         : [...prev, file.url],
//     );
//   };

//   const handleConfirmProvidedSelection = () => {
//     const selected = availableFiles.provided.filter((f) =>
//       tempProvidedSelection.includes(f.url),
//     );
//     setProvidedFiles(selected);
//     setCurrentProvidedIndex(0);
//     setOpenDialog(false);
//   };

//   const handleCompare = async () => {
//     if (!referenceFile) {
//       setCompareError('Please select a reference image');
//       return;
//     }
//     if (livenessStatus !== 'success' && !providedFiles.length) {
//       setCompareError(
//         'Please complete liveness detection or select a provided video',
//       );
//       return;
//     }
//     try {
//       setCompareLoading(true);
//       setCompareError('');
//       setCompareResult(null);
//       const res = await verifyVideo(
//         referenceFile.fullUrl,
//         providedFiles.map((f) => f.fullUrl),
//       );
//       console.log('Comparison response:', res);
//       setCompareResult(res.data);
//     } catch (err) {
//       console.error('Comparison error:', err);
//       let msg = 'Failed to compare files';
//       if (err.code === 'ECONNABORTED')
//         msg = 'Request timed out. Files may be too large.';
//       else if (err.response)
//         msg = err.response?.data?.message || err.response?.data?.error || msg;
//       else if (err.message) msg = err.message;
//       setCompareError(msg);
//     } finally {
//       setCompareLoading(false);
//     }
//   };

//   // ─────────────────────────────────────────────────────────────────────────────
//   // Render helpers
//   // ─────────────────────────────────────────────────────────────────────────────
//   const renderFileCard = (file, { selected = false, onClick }) => {
//     const isPdf = file.ext === 'pdf';
//     const isVid = isVideoFile(file.ext);
//     return (
//       <div
//         onClick={onClick}
//         className={`h-40 w-40 flex flex-col border rounded-lg overflow-hidden cursor-pointer transition-all shadow-sm ${
//           selected
//             ? 'border-blue-600 shadow-md scale-[1.02] ring-2 ring-blue-300'
//             : 'border-gray-200 hover:shadow-md hover:scale-[1.02]'
//         }`}
//       >
//         <div className='h-32 bg-gray-50 flex items-center justify-center overflow-hidden relative'>
//           {isPdf ? (
//             <PictureAsPdfIcon className='text-red-600' sx={{ fontSize: 32 }} />
//           ) : isVid ? (
//             <>
//               <video
//                 src={file.fullUrl}
//                 className='max-w-full max-h-full object-cover'
//                 muted
//                 preload='metadata'
//               />
//               <div className='absolute inset-0 flex items-center justify-center bg-black/25'>
//                 <MdOutlineSlowMotionVideo
//                   size={32}
//                   className='text-white drop-shadow'
//                 />
//               </div>
//             </>
//           ) : (
//             <img
//               src={file.fullUrl}
//               alt={file.name}
//               className='max-w-full max-h-full object-cover'
//             />
//           )}
//         </div>
//         <div className='px-2 py-1.5 flex-1 flex items-center justify-center'>
//           <p className='text-[0.75rem] text-center font-semibold truncate w-full'>
//             {file.name}
//           </p>
//         </div>
//       </div>
//     );
//   };

//   const renderReferenceBox = () => {
//     if (!referenceFile) {
//       return (
//         <div
//           onClick={() => handleOpenDialog('reference')}
//           className='border-2 border-dashed border-gray-300 rounded-xl text-center text-gray-500 h-[260px] flex flex-col items-center justify-center cursor-pointer hover:bg-gray-50 transition'
//         >
//           <ImageIcon sx={{ fontSize: 48 }} />
//           <p className='mt-2 text-sm font-semibold'>
//             Click to select Reference Image
//           </p>
//           <p className='mt-1 text-xs'>
//             Choose one photo from your recent uploads
//           </p>
//         </div>
//       );
//     }
//     const isPdf = referenceFile.ext === 'pdf';
//     return (
//       <div
//         onClick={() => handleOpenDialog('reference')}
//         className='border-2 border-green-500 bg-green-50 rounded-xl h-[260px] cursor-pointer hover:shadow-md transition flex flex-col'
//       >
//         {isPdf ? (
//           <div className='flex-1 flex flex-col items-center justify-center gap-2 px-3'>
//             <PictureAsPdfIcon sx={{ fontSize: 48 }} className='text-red-600' />
//             <p className='text-sm font-semibold text-center'>
//               {referenceFile.name}
//             </p>
//             <Button
//               size='small'
//               variant='outlined'
//               href={referenceFile.fullUrl}
//               target='_blank'
//               onClick={(e) => e.stopPropagation()}
//             >
//               Open PDF
//             </Button>
//           </div>
//         ) : (
//           <div className='flex-1 flex flex-col items-center justify-center px-3'>
//             <img
//               src={referenceFile.fullUrl}
//               alt={referenceFile.name}
//               className='w-full max-w-xs h-[190px] object-contain rounded-lg'
//             />
//             <p className='mt-2 text-sm font-semibold text-center truncate w-full'>
//               {referenceFile.name}
//             </p>
//           </div>
//         )}
//       </div>
//     );
//   };

//   // ─── Live Detection Box ───────────────────────────────────────────────────────
//   const renderLiveDetectionBox = () => {
//     const statusBorderColor =
//       livenessStatus === 'success'
//         ? 'border-green-500'
//         : livenessStatus === 'failed'
//           ? 'border-red-500'
//           : livenessStatus === 'capturing'
//             ? 'border-blue-400'
//             : 'border-gray-200';

//     return (
//       <div
//         className={`border-2 ${statusBorderColor} rounded-xl overflow-hidden bg-white shadow-sm flex flex-col transition-colors`}
//         style={{ minHeight: 340 }}
//       >
//         {/* ── Header ─────────────────────────────────────────────────────────── */}
//         <div className='flex items-center justify-between px-4 py-2.5 bg-gradient-to-r from-slate-700 to-slate-800'>
//           <div className='flex items-center gap-2'>
//             {/* Live status dot */}
//             <div
//               className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
//                 livenessStatus === 'success'
//                   ? 'bg-green-400'
//                   : livenessStatus === 'failed'
//                     ? 'bg-red-400'
//                     : livenessStatus === 'capturing'
//                       ? 'bg-blue-400 animate-pulse'
//                       : liveMode
//                         ? 'bg-green-400'
//                         : 'bg-gray-400'
//               }`}
//             />
//             <span className='text-white text-sm font-semibold tracking-wide'>
//               Live Face Detection
//             </span>
//             {/* Recording badge */}
//             {isRecording && (
//               <Chip
//                 icon={
//                   <FiberManualRecordIcon
//                     sx={{ fontSize: 10, color: 'white !important' }}
//                   />
//                 }
//                 label={formatDuration(recordingDuration)}
//                 size='small'
//                 sx={{
//                   bgcolor: '#ef4444',
//                   color: 'white',
//                   fontSize: 11,
//                   height: 20,
//                   '& .MuiChip-icon': { color: 'white' },
//                 }}
//               />
//             )}
//           </div>

//           <div className='flex items-center gap-1.5'>
//             {/* Mic toggle */}
//             {liveMode && (
//               <Tooltip
//                 title={audioEnabled ? 'Mute microphone' : 'Unmute microphone'}
//               >
//                 <button
//                   onClick={() => {
//                     if (streamRef.current) {
//                       streamRef.current.getAudioTracks().forEach((t) => {
//                         t.enabled = !audioEnabled;
//                       });
//                     }
//                     setAudioEnabled((v) => !v);
//                   }}
//                   className='text-white/70 hover:text-white p-1 rounded transition'
//                 >
//                   {audioEnabled ? (
//                     <MicIcon sx={{ fontSize: 18 }} />
//                   ) : (
//                     <MicOffIcon sx={{ fontSize: 18 }} />
//                   )}
//                 </button>
//               </Tooltip>
//             )}
//             {/* Camera toggle */}
//             <button
//               onClick={liveMode ? stopCamera : startCamera}
//               className={`flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-full transition ${
//                 liveMode
//                   ? 'bg-red-500 hover:bg-red-600 text-white'
//                   : 'bg-white hover:bg-gray-100 text-slate-700'
//               }`}
//             >
//               {liveMode ? (
//                 <>
//                   <VideocamOffIcon sx={{ fontSize: 16 }} /> Off
//                 </>
//               ) : (
//                 <>
//                   <VideocamIcon sx={{ fontSize: 16 }} /> Camera
//                 </>
//               )}
//             </button>
//           </div>
//         </div>

//         {/* ── Video area ─────────────────────────────────────────────────────── */}
//         <div
//           className='relative bg-black flex-1 flex items-center justify-center'
//           style={{ height: 240, minHeight: 240 }}
//         >
//           {/* Video element is ALWAYS in the DOM so ref is always valid.
//               We just hide it when camera is off. */}
//           <video
//             ref={liveVideoRef}
//             autoPlay
//             playsInline
//             muted
//             onLoadedMetadata={() => {
//               console.log(
//                 '[Video] Metadata loaded:',
//                 liveVideoRef.current?.videoWidth,
//                 'x',
//                 liveVideoRef.current?.videoHeight,
//               );
//             }}
//             onCanPlay={() => {
//               console.log('[Video] Can play');
//               liveVideoRef.current?.play().catch(() => {});
//             }}
//             style={{
//               position: 'absolute',
//               inset: 0,
//               width: '100%',
//               height: '100%',
//               objectFit: 'cover',
//               display: liveMode ? 'block' : 'none',
//               transform: 'scaleX(-1)', // mirror like a selfie camera
//             }}
//           />

//           {/* Camera off placeholder */}
//           {!liveMode && (
//             <div className='flex flex-col items-center justify-center gap-3 text-white/50'>
//               <VideocamOffIcon sx={{ fontSize: 56 }} />
//               <p className='text-sm font-medium'>Camera is off</p>
//               <button
//                 onClick={startCamera}
//                 className='mt-1 bg-white/10 hover:bg-white/20 text-white text-xs font-semibold px-5 py-2.5 rounded-full transition border border-white/20'
//               >
//                 Turn On Camera
//               </button>
//             </div>
//           )}

//           {/* Face guide oval — only during capturing */}
//           {liveMode && livenessStatus === 'capturing' && (
//             <div className='absolute inset-0 flex flex-col items-center justify-center pointer-events-none gap-2'>
//               <div
//                 className='border-4 border-white/80 rounded-full'
//                 style={{
//                   width: 150,
//                   height: 195,
//                   borderStyle: 'dashed',
//                   boxShadow: '0 0 0 9999px rgba(0,0,0,0.35)',
//                   animation: 'pulse 2s cubic-bezier(0.4,0,0.6,1) infinite',
//                 }}
//               />
//               <p className='absolute bottom-3 text-white/90 text-[11px] font-semibold bg-black/50 px-3 py-1 rounded-full'>
//                 Align face within the oval
//               </p>
//             </div>
//           )}

//           {/* Rate limit countdown badge */}
//           {liveMode &&
//             rateLimitCountdown > 0 &&
//             livenessStatus === 'capturing' && (
//               <div className='absolute top-3 right-3 bg-black/70 text-white text-xs font-bold px-3 py-1.5 rounded-full flex items-center gap-1.5'>
//                 <HourglassEmptyIcon sx={{ fontSize: 13 }} />
//                 Next scan in {rateLimitCountdown}s
//               </div>
//             )}

//           {/* Success overlay */}
//           {liveMode && livenessStatus === 'success' && (
//             <div className='absolute inset-0 bg-green-900/80 flex flex-col items-center justify-center gap-3'>
//               <VerifiedUserIcon sx={{ fontSize: 64, color: '#4ade80' }} />
//               <p className='text-white font-bold text-xl tracking-wide'>
//                 Liveness Confirmed
//               </p>
//               <p className='text-green-300 text-sm'>Real person detected ✓</p>
//             </div>
//           )}

//           {/* Spoof overlay */}
//           {liveMode &&
//             livenessStatus === 'failed' &&
//             livenessResult?.livenessDecision === 'spoofface' && (
//               <div className='absolute inset-0 bg-red-900/75 flex flex-col items-center justify-center gap-3'>
//                 <WarningAmberIcon sx={{ fontSize: 56, color: '#fbbf24' }} />
//                 <p className='text-white font-bold text-xl'>Spoof Detected</p>
//                 <p className='text-red-300 text-sm'>Please use a real face</p>
//               </div>
//             )}
//         </div>

//         {/* ── Status message bar ──────────────────────────────────────────────── */}
//         {liveMode && livenessMessage && (
//           <div
//             className={`px-4 py-2.5 text-xs font-medium border-t flex items-start gap-2 ${
//               livenessStatus === 'success'
//                 ? 'bg-green-50 text-green-800 border-green-200'
//                 : livenessStatus === 'failed'
//                   ? 'bg-red-50 text-red-800 border-red-200'
//                   : livenessStatus === 'capturing'
//                     ? 'bg-blue-50 text-blue-800 border-blue-200'
//                     : 'bg-gray-50 text-gray-700 border-gray-200'
//             }`}
//           >
//             <div className='flex-1'>
//               {livenessStatus === 'capturing' && (
//                 <LinearProgress
//                   variant='indeterminate'
//                   sx={{
//                     mb: 1,
//                     height: 2,
//                     borderRadius: 1,
//                     bgcolor: 'rgba(59,130,246,0.2)',
//                     '& .MuiLinearProgress-bar': { bgcolor: '#3b82f6' },
//                   }}
//                 />
//               )}
//               {livenessMessage}
//             </div>
//           </div>
//         )}

//         {/* ── Attempt error log ───────────────────────────────────────────────── */}
//         {livenessAttempts.length > 0 && livenessStatus === 'capturing' && (
//           <div className='px-4 py-2 border-t border-amber-200 bg-amber-50 max-h-24 overflow-y-auto'>
//             <p className='text-[11px] font-bold text-amber-800 mb-1.5'>
//               Attempt History:
//             </p>
//             {livenessAttempts.slice(0, 4).map((a) => (
//               <div
//                 key={a.attemptId}
//                 className='flex items-start gap-1.5 mb-0.5'
//               >
//                 <span
//                   className={`text-[10px] font-bold mt-0.5 flex-shrink-0 ${a.attemptStatus === 'Succeeded' ? 'text-green-600' : 'text-red-500'}`}
//                 >
//                   #{a.attemptId}
//                 </span>
//                 <span className='text-[11px] text-amber-700'>
//                   {a.error
//                     ? LIVENESS_ERROR_MESSAGES[a.error.code] || a.error.message
//                     : a.attemptStatus}
//                 </span>
//               </div>
//             ))}
//           </div>
//         )}

//         {/* ── Action buttons ──────────────────────────────────────────────────── */}
//         {liveMode && (
//           <div className='px-4 py-3 border-t border-gray-100 bg-gray-50 flex flex-wrap gap-2 items-center justify-between'>
//             {/* Left: detection controls */}
//             <div className='flex gap-2 flex-wrap'>
//               {livenessStatus === 'idle' && (
//                 <button
//                   onClick={startLivenessDetection}
//                   className='flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-4 py-2 rounded-lg transition shadow-sm'
//                 >
//                   <RadioButtonCheckedIcon sx={{ fontSize: 15 }} />
//                   Start Detection
//                 </button>
//               )}

//               {livenessStatus === 'starting' && (
//                 <div className='flex items-center gap-2 text-xs text-gray-600 px-2'>
//                   <CircularProgress size={14} />
//                   <span>Initializing...</span>
//                 </div>
//               )}

//               {livenessStatus === 'capturing' && (
//                 <button
//                   onClick={() => {
//                     clearInterval(livenessIntervalRef.current);
//                     clearInterval(countdownIntervalRef.current);
//                     isCapturingRef.current = false;
//                     setLivenessCapturing(false);
//                     setLivenessStatus('idle');
//                     setRateLimitCountdown(0);
//                     stopRecording();
//                     setLivenessMessage(
//                       'Stopped. Click "Start Detection" to retry.',
//                     );
//                   }}
//                   className='flex items-center gap-1.5 bg-red-500 hover:bg-red-600 text-white text-xs font-semibold px-4 py-2 rounded-lg transition'
//                 >
//                   <StopIcon sx={{ fontSize: 15 }} />
//                   Stop
//                 </button>
//               )}

//               {(livenessStatus === 'success' ||
//                 livenessStatus === 'failed') && (
//                 <button
//                   onClick={resetLiveness}
//                   className='flex items-center gap-1.5 bg-slate-600 hover:bg-slate-700 text-white text-xs font-semibold px-4 py-2 rounded-lg transition'
//                 >
//                   <ReplayIcon sx={{ fontSize: 15 }} />
//                   Try Again
//                 </button>
//               )}
//             </div>

//             {/* Right: recording controls */}
//             <div className='flex items-center gap-2'>
//               {!isRecording &&
//                 livenessStatus !== 'capturing' &&
//                 livenessStatus !== 'starting' && (
//                   <Tooltip title='Manually record video with audio for analysis'>
//                     <button
//                       onClick={startRecording}
//                       className='flex items-center gap-1 text-xs text-gray-600 hover:text-red-600 px-2.5 py-1.5 rounded border border-gray-300 hover:border-red-400 transition'
//                     >
//                       <FiberManualRecordIcon
//                         sx={{ fontSize: 14, color: '#ef4444' }}
//                       />
//                       Record
//                     </button>
//                   </Tooltip>
//                 )}

//               {isRecording && livenessStatus !== 'capturing' && (
//                 <button
//                   onClick={stopRecording}
//                   className='flex items-center gap-1 text-xs text-red-600 font-semibold px-2.5 py-1.5 rounded border border-red-400 transition animate-pulse'
//                 >
//                   <StopIcon sx={{ fontSize: 14 }} />
//                   Stop {formatDuration(recordingDuration)}
//                 </button>
//               )}

//               {recordedBlob && !isRecording && (
//                 <button
//                   onClick={sendRecordingForAnalysis}
//                   className='flex items-center gap-1.5 text-xs bg-purple-600 hover:bg-purple-700 text-white font-semibold px-3 py-1.5 rounded-lg transition'
//                 >
//                   📤 Analyze
//                 </button>
//               )}
//             </div>
//           </div>
//         )}

//         {/* ── Success footer with analyze recording button ─────────────────────── */}
//         {livenessStatus === 'success' && (
//           <div className='px-4 py-2.5 bg-green-600 text-white text-xs font-semibold flex items-center gap-2'>
//             <CheckCircleIcon sx={{ fontSize: 16 }} />
//             <span>Liveness verified — ready for comparison</span>
//             {recordedBlob && (
//               <button
//                 onClick={sendRecordingForAnalysis}
//                 className='ml-auto bg-white text-green-700 px-3 py-1 rounded text-xs font-bold hover:bg-green-50 transition flex-shrink-0'
//               >
//                 📤 Analyze Recording
//               </button>
//             )}
//           </div>
//         )}
//       </div>
//     );
//   };

//   const renderComparisonResults = () => {
//     if (!compareResult) return null;
//     const { liveness_score, confidence_score, cost, image } = compareResult;
//     const isAccepted = confidence_score >= 80;
//     return (
//       <div className='space-y-6'>
//         <div
//           className={`flex flex-col md:flex-row md:items-center md:justify-between gap-4 rounded-xl border-2 p-4 ${isAccepted ? 'bg-green-50 border-green-500' : 'bg-red-50 border-red-500'}`}
//         >
//           <div>
//             <p className='text-xl font-bold'>
//               {isAccepted ? '✅ Match Accepted' : '❌ Match Not Strong'}
//             </p>
//             <p className='text-sm text-gray-600'>Confidence threshold: 80%</p>
//           </div>
//           <div className='text-lg font-semibold space-y-1'>
//             <p>
//               Confidence:{' '}
//               <span className='text-blue-700'>
//                 {confidence_score?.toFixed(2)}%
//               </span>
//             </p>
//             <p>
//               Liveness:{' '}
//               <span className='text-purple-700'>
//                 {liveness_score?.toFixed(2)}%
//               </span>
//             </p>
//             <p>
//               Cost: <span className='text-gray-700'>${cost}</span>
//             </p>
//           </div>
//         </div>
//         {image && (
//           <div className='bg-white border rounded-xl p-4 shadow-sm'>
//             <p className='text-lg font-semibold mb-3'>
//               Extracted Frame / Result Image
//             </p>
//             <div className='flex justify-center'>
//               <img
//                 src={`data:image/jpeg;base64,${image}`}
//                 alt='Result'
//                 className='max-w-sm rounded-lg border shadow-md'
//               />
//             </div>
//           </div>
//         )}
//       </div>
//     );
//   };

//   const fileList =
//     dialogType === 'reference'
//       ? availableFiles.reference
//       : availableFiles.provided;

//   // ─────────────────────────────────────────────────────────────────────────────
//   // Render
//   // ─────────────────────────────────────────────────────────────────────────────
//   return (
//     <div className='px-4 md:px-10 py-1 w-full'>
//       {/* Title + Clear */}
//       <div className='flex items-center justify-between mb-4'>
//         <h2 className='font-semibold text-[22px] text-gray-700'>
//           Video Comparison
//         </h2>
//         <Button
//           size='small'
//           variant='outlined'
//           onClick={handleClearSession}
//           sx={{ textTransform: 'none', fontSize: 12 }}
//         >
//           Clear selection &amp; result
//         </Button>
//       </div>

//       {/* Selection grid */}
//       <div className='grid grid-cols-1 md:grid-cols-2 gap-4 bg-white rounded-2xl shadow-md p-4 md:p-6 mb-4'>
//         {/* LEFT — Reference image */}
//         <div>
//           <div className='flex items-center gap-2 mb-2'>
//             <p className='font-semibold text-[16px]'>Reference Image</p>
//             {referenceFile && (
//               <CheckCircleIcon
//                 sx={{ fontSize: 18 }}
//                 className='text-green-600'
//               />
//             )}
//           </div>
//           {renderReferenceBox()}
//         </div>

//         {/* RIGHT — Live detection */}
//         <div>
//           <div className='flex items-center justify-between mb-2'>
//             <div className='flex items-center gap-2'>
//               <p className='font-semibold text-[16px]'>Live Verification</p>
//               {livenessStatus === 'success' && (
//                 <CheckCircleIcon
//                   sx={{ fontSize: 18 }}
//                   className='text-green-600'
//                 />
//               )}
//               {livenessStatus === 'failed' && (
//                 <ErrorIcon sx={{ fontSize: 18 }} className='text-red-500' />
//               )}
//             </div>
//             <Button
//               size='small'
//               variant='text'
//               onClick={() => handleOpenDialog('provided')}
//               startIcon={<FolderOpenIcon />}
//               sx={{ textTransform: 'none', fontSize: 12, px: 1 }}
//             >
//               Use Uploaded Video
//             </Button>
//           </div>

//           {renderLiveDetectionBox()}

//           {/* Uploaded video chips */}
//           {providedFiles.length > 0 && (
//             <div className='mt-2 p-3 bg-blue-50 rounded-lg border border-blue-200'>
//               <p className='text-xs text-blue-700 font-semibold mb-1'>
//                 {providedFiles.length} uploaded video
//                 {providedFiles.length > 1 ? 's' : ''} also selected
//               </p>
//               <div className='flex gap-2 flex-wrap'>
//                 {providedFiles.map((f) => (
//                   <Chip
//                     key={f.url}
//                     label={f.name}
//                     size='small'
//                     onDelete={() =>
//                       setProvidedFiles((prev) =>
//                         prev.filter((p) => p.url !== f.url),
//                       )
//                     }
//                   />
//                 ))}
//               </div>
//             </div>
//           )}
//         </div>
//       </div>

//       {/* Compare button */}
//       <div className='mb-4 text-center'>
//         <button
//           type='button'
//           disabled={
//             !referenceFile ||
//             (livenessStatus !== 'success' && !providedFiles.length) ||
//             compareLoading
//           }
//           onClick={handleCompare}
//           className={`inline-flex items-center gap-2 rounded-full px-8 py-3 font-semibold text-white shadow-md transition text-[18px] ${
//             !referenceFile ||
//             (livenessStatus !== 'success' && !providedFiles.length) ||
//             compareLoading
//               ? 'cursor-not-allowed bg-gray-400'
//               : 'bg-blue-600 hover:bg-blue-700 cursor-pointer'
//           }`}
//         >
//           {compareLoading ? (
//             <CircularProgress size={20} sx={{ color: 'white' }} />
//           ) : (
//             <CompareArrowsIcon />
//           )}
//           {compareLoading ? 'Comparing...' : 'Compare Now'}
//         </button>
//         {!referenceFile && (
//           <p className='text-xs text-gray-400 mt-2'>
//             Select a reference image to enable comparison
//           </p>
//         )}
//         {referenceFile &&
//           livenessStatus !== 'success' &&
//           !providedFiles.length && (
//             <p className='text-xs text-gray-400 mt-2'>
//               Complete live detection or upload a video to compare
//             </p>
//           )}
//       </div>

//       {/* Error */}
//       {compareError && (
//         <div className='mb-3'>
//           <Alert severity='error' onClose={() => setCompareError('')}>
//             {compareError}
//           </Alert>
//         </div>
//       )}

//       {/* Results */}
//       <div className='bg-white rounded-xl shadow-md px-4 py-4'>
//         <p className='text-[18px] font-semibold mb-2'>Comparison Results</p>
//         {compareLoading && (
//           <div className='text-center py-6'>
//             <CircularProgress />
//             <p className='mt-2 text-sm text-gray-600'>Analyzing files...</p>
//           </div>
//         )}
//         {!compareLoading && compareResult ? (
//           renderComparisonResults()
//         ) : !compareLoading && !compareResult ? (
//           <p className='text-center text-sm text-gray-500 py-3'>
//             Complete live detection, then click{' '}
//             <span className='font-semibold'>"Compare Now"</span>.
//           </p>
//         ) : null}
//       </div>

//       {/* File dialog */}
//       <Dialog
//         open={openDialog}
//         onClose={() => setOpenDialog(false)}
//         maxWidth='md'
//         fullWidth
//       >
//         <DialogTitle>
//           {dialogType === 'reference'
//             ? 'Select Reference Image'
//             : `Select Provided Videos (${tempProvidedSelection.length} selected)`}
//         </DialogTitle>
//         <DialogContent>
//           {loadingFiles ? (
//             <div className='text-center py-6'>
//               <CircularProgress />
//               <p className='mt-2 text-sm'>Loading files...</p>
//             </div>
//           ) : fileList.length === 0 ? (
//             <div className='text-center py-6 text-gray-500'>
//               {dialogType === 'reference' ? (
//                 <ImageIcon sx={{ fontSize: 60 }} className='mb-2' />
//               ) : (
//                 <MdOutlineSlowMotionVideo size={60} className='mb-2 mx-auto' />
//               )}
//               <p>
//                 No{' '}
//                 {dialogType === 'reference'
//                   ? 'reference images'
//                   : 'provided videos'}{' '}
//                 uploaded yet
//               </p>
//               <p className='text-xs mt-1'>Go to the Upload page to add files</p>
//             </div>
//           ) : (
//             <div className='grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 mt-2'>
//               {fileList.map((file) => {
//                 if (dialogType === 'reference') {
//                   return (
//                     <div key={file.url}>
//                       {renderFileCard(file, {
//                         selected: referenceFile?.url === file.url,
//                         onClick: () => handleSelectReference(file),
//                       })}
//                     </div>
//                   );
//                 }
//                 return (
//                   <div key={file.url}>
//                     {renderFileCard(file, {
//                       selected: tempProvidedSelection.includes(file.url),
//                       onClick: () => handleToggleProvidedSelection(file),
//                     })}
//                   </div>
//                 );
//               })}
//             </div>
//           )}
//         </DialogContent>
//         <DialogActions>
//           <Button onClick={() => setOpenDialog(false)}>Close</Button>
//           <Button onClick={loadAvailableFiles} startIcon={<FolderOpenIcon />}>
//             Refresh
//           </Button>
//           {dialogType === 'provided' && (
//             <Button
//               variant='contained'
//               disabled={!tempProvidedSelection.length}
//               onClick={handleConfirmProvidedSelection}
//             >
//               Confirm ({tempProvidedSelection.length})
//             </Button>
//           )}
//         </DialogActions>
//       </Dialog>
//     </div>
//   );
// }



// import React, { useRef, useState, useEffect, useCallback } from 'react';
// import {
//   Button,
//   CircularProgress,
//   Alert,
//   Dialog,
//   DialogTitle,
//   DialogContent,
//   DialogActions,
//   Chip,
//   LinearProgress,
//   Tooltip,
// } from '@mui/material';

// import { MdOutlineSlowMotionVideo } from 'react-icons/md';

// import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
// import ChevronRightIcon from '@mui/icons-material/ChevronRight';
// import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
// import CompareArrowsIcon from '@mui/icons-material/CompareArrows';
// import CheckCircleIcon from '@mui/icons-material/CheckCircle';
// import ErrorIcon from '@mui/icons-material/Error';
// import FolderOpenIcon from '@mui/icons-material/FolderOpen';
// import ImageIcon from '@mui/icons-material/Image';
// import VideocamIcon from '@mui/icons-material/Videocam';
// import VideocamOffIcon from '@mui/icons-material/VideocamOff';
// import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord';
// import StopIcon from '@mui/icons-material/Stop';
// import MicIcon from '@mui/icons-material/Mic';
// import MicOffIcon from '@mui/icons-material/MicOff';
// import RadioButtonCheckedIcon from '@mui/icons-material/RadioButtonChecked';
// import ReplayIcon from '@mui/icons-material/Replay';
// import VerifiedUserIcon from '@mui/icons-material/VerifiedUser';
// import WarningAmberIcon from '@mui/icons-material/WarningAmber';
// import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';

// import { API_BASE_URL, getRecentUploads } from '../../api/uploadApi';
// import { verifyVideo } from '../../api/comparisonApi';

// // ─── Constants ────────────────────────────────────────────────────────────────
// const STORAGE_KEY = 'videoComparisonState';
// const VIDEO_EXTS = ['mp4', 'webm', 'mov', 'avi', 'mkv', 'ogg'];
// const AZURE_FACE_ENDPOINT = import.meta.env.VITE_AZURE_FACE_ENDPOINT;

// // 6 seconds between frames — safely above Azure free tier (1 req/5s)
// const FRAME_INTERVAL_MS = 6000;

// // ─── Helpers ──────────────────────────────────────────────────────────────────
// const normalizeUrl = (url) => {
//   if (!url) return null;
//   if (url.startsWith('http')) return url;
//   return `${API_BASE_URL}${url}`;
// };

// const extractPath = (fullUrl) => {
//   if (!fullUrl) return null;
//   if (fullUrl.startsWith('/temp/')) return fullUrl;
//   try {
//     const url = new URL(fullUrl);
//     return url.pathname;
//   } catch {
//     const match = fullUrl.match(/\/temp\/.+/);
//     return match ? match[0] : null;
//   }
// };

// const isVideoFile = (ext) => VIDEO_EXTS.includes((ext || '').toLowerCase());

// // ─── Liveness friendly error messages ────────────────────────────────────────
// const LIVENESS_ERROR_MESSAGES = {
//   FaceMouthRegionNotVisible:
//     '👄 Mouth region not visible — lower your mask or tilt your face slightly',
//   FaceNotDetected:
//     '🔍 No face detected — ensure good lighting and face the camera directly',
//   FaceTooDark: '💡 Too dark — move to a brighter area',
//   FaceTooFarAway: '📏 Too far — move closer to the camera',
//   FaceTooClose: '📏 Too close — move back slightly',
//   FaceNotFrontal: '↕️ Face not frontal — look straight at the camera',
//   EyesBlinking: '👁️ Keep your eyes open and look at the camera',
//   SessionNotStarted:
//     '⏳ Session not started — please click "Start Detection" again',
//   BLANK_FRAME:
//     '⚠️ Camera frame is blank — ensure camera is active and well-lit',
//   FRAME_TOO_LARGE: '⚠️ Frame too large — please try again',
// };

// // ─── Main Component ───────────────────────────────────────────────────────────
// export default function VideoComparison() {
//   // ── File selection ──────────────────────────────────────────────────────────
//   const [referenceFile, setReferenceFile] = useState(null);
//   const [providedFiles, setProvidedFiles] = useState([]);
//   const [currentProvidedIndex, setCurrentProvidedIndex] = useState(0);
//   const [availableFiles, setAvailableFiles] = useState({
//     reference: [],
//     provided: [],
//   });
//   const [openDialog, setOpenDialog] = useState(false);
//   const [dialogType, setDialogType] = useState('reference');
//   const [loadingFiles, setLoadingFiles] = useState(false);
//   const [tempProvidedSelection, setTempProvidedSelection] = useState([]);

//   // ── Comparison ──────────────────────────────────────────────────────────────
//   const [compareResult, setCompareResult] = useState(null);
//   const [compareLoading, setCompareLoading] = useState(false);
//   const [compareError, setCompareError] = useState('');

//   // ── Hydration ───────────────────────────────────────────────────────────────
//   const [isHydrated, setIsHydrated] = useState(false);

//   // ── Liveness state ──────────────────────────────────────────────────────────
//   const [liveMode, setLiveMode] = useState(false);
//   const [livenessSessionId, setLivenessSessionId] = useState(null);
//   const [livenessAuthToken, setLivenessAuthToken] = useState(null);
//   const [livenessCapturing, setLivenessCapturing] = useState(false);
//   const [livenessStatus, setLivenessStatus] = useState('idle'); // idle | starting | capturing | success | failed
//   const [livenessMessage, setLivenessMessage] = useState('');
//   const [livenessResult, setLivenessResult] = useState(null);
//   const [livenessAttempts, setLivenessAttempts] = useState([]);

//   // ── Rate limit countdown ────────────────────────────────────────────────────
//   const [rateLimitCountdown, setRateLimitCountdown] = useState(0); // seconds remaining

//   // ── Recording state ─────────────────────────────────────────────────────────
//   const [isRecording, setIsRecording] = useState(false);
//   const [recordedBlob, setRecordedBlob] = useState(null);
//   const [recordingDuration, setRecordingDuration] = useState(0);
//   const [audioEnabled, setAudioEnabled] = useState(true);

//   // ── Refs ────────────────────────────────────────────────────────────────────
//   const liveVideoRef = useRef(null);
//   const streamRef = useRef(null);
//   const mediaRecorderRef = useRef(null);
//   const recordedChunksRef = useRef([]);
//   const livenessIntervalRef = useRef(null);
//   const recordingTimerRef = useRef(null);
//   const countdownIntervalRef = useRef(null);
//   const isCapturingRef = useRef(false); // sync ref to avoid stale closures

//   // ─────────────────────────────────────────────────────────────────────────────
//   // File loading
//   // ─────────────────────────────────────────────────────────────────────────────
//   const loadAvailableFiles = async () => {
//     setLoadingFiles(true);
//     try {
//       const res = await getRecentUploads();
//       if (res?.success) {
//         const allFiles = res.files || [];
//         const mapFile = (f) => ({
//           name: f.name || f.storedName || 'Unnamed',
//           url: f.url,
//           path: extractPath(normalizeUrl(f.url)),
//           fullUrl: normalizeUrl(f.url),
//           size: f.size,
//           uploadedAt: f.uploadedAt
//             ? new Date(f.uploadedAt).toISOString()
//             : null,
//           ext: (f.name || '').split('.').pop().toLowerCase(),
//           type: f.type,
//           slot: f.slot,
//         });
//         const mapped = allFiles.map(mapFile);
//         setAvailableFiles({
//           reference: mapped.filter(
//             (f) => f.slot === 'reference' && f.type === 'photo',
//           ),
//           provided: mapped.filter(
//             (f) => f.slot === 'provided' && f.type === 'video',
//           ),
//         });
//       }
//     } catch (err) {
//       console.error('Error loading files:', err);
//     } finally {
//       setLoadingFiles(false);
//     }
//   };

//   useEffect(() => {
//     loadAvailableFiles();
//   }, []);

//   // ─────────────────────────────────────────────────────────────────────────────
//   // LocalStorage hydration
//   // ─────────────────────────────────────────────────────────────────────────────
//   useEffect(() => {
//     try {
//       const saved = localStorage.getItem(STORAGE_KEY);
//       if (!saved) {
//         setIsHydrated(true);
//         return;
//       }
//       const parsed = JSON.parse(saved);
//       if (parsed.referenceFile) setReferenceFile({ ...parsed.referenceFile });
//       if (Array.isArray(parsed.providedFiles))
//         setProvidedFiles(parsed.providedFiles);
//       if (typeof parsed.currentProvidedIndex === 'number')
//         setCurrentProvidedIndex(parsed.currentProvidedIndex);
//       if (parsed.compareResult) setCompareResult(parsed.compareResult);
//     } catch (err) {
//       console.error('Error hydrating:', err);
//     } finally {
//       setIsHydrated(true);
//     }
//   }, []);

//   useEffect(() => {
//     if (!isHydrated) return;
//     try {
//       localStorage.setItem(
//         STORAGE_KEY,
//         JSON.stringify({
//           referenceFile,
//           providedFiles,
//           currentProvidedIndex,
//           compareResult,
//         }),
//       );
//     } catch {}
//   }, [
//     referenceFile,
//     providedFiles,
//     currentProvidedIndex,
//     compareResult,
//     isHydrated,
//   ]);

//   useEffect(() => {
//     if (!providedFiles.length) {
//       setCurrentProvidedIndex(0);
//       return;
//     }
//     if (currentProvidedIndex >= providedFiles.length)
//       setCurrentProvidedIndex(0);
//   }, [providedFiles]);

//   // ─────────────────────────────────────────────────────────────────────────────
//   // Camera — video element is always in DOM; srcObject set via useEffect
//   // ─────────────────────────────────────────────────────────────────────────────

//   // Whenever streamRef changes, wire it to the video element
//   useEffect(() => {
//     if (liveVideoRef.current && streamRef.current) {
//       liveVideoRef.current.srcObject = streamRef.current;
//       liveVideoRef.current.play().catch(() => {});
//     }
//   }, [liveMode]); // re-run when liveMode flips to true (video element becomes visible)

//   const startCamera = async () => {
//     try {
//       const stream = await navigator.mediaDevices.getUserMedia({
//         video: {
//           width: { ideal: 640, max: 1280 },
//           height: { ideal: 480, max: 720 },
//           facingMode: 'user',
//         },
//         audio: true,
//       });
//       streamRef.current = stream;
//       setLiveMode(true); // video element becomes visible after this
//       setLivenessStatus('idle');
//       setLivenessMessage('Camera ready. Click "Start Detection" to begin.');
//     } catch (err) {
//       console.error('Camera error:', err);
//       setLivenessMessage(
//         '🚫 Camera or microphone permission denied. Please allow access and try again.',
//       );
//     }
//   };

//   const stopCamera = useCallback(() => {
//     clearInterval(livenessIntervalRef.current);
//     clearInterval(countdownIntervalRef.current);
//     isCapturingRef.current = false;
//     setLivenessCapturing(false);
//     setLivenessStatus('idle');
//     setRateLimitCountdown(0);

//     if (
//       mediaRecorderRef.current &&
//       mediaRecorderRef.current.state !== 'inactive'
//     ) {
//       mediaRecorderRef.current.stop();
//     }
//     clearInterval(recordingTimerRef.current);
//     setIsRecording(false);
//     setRecordingDuration(0);

//     if (streamRef.current) {
//       streamRef.current.getTracks().forEach((t) => t.stop());
//       streamRef.current = null;
//     }
//     // Clear video element srcObject so it stops showing frames
//     if (liveVideoRef.current) {
//       liveVideoRef.current.srcObject = null;
//       liveVideoRef.current.load(); // reset the element
//     }

//     setLiveMode(false);
//     setLivenessSessionId(null);
//     setLivenessAuthToken(null);
//     setLivenessMessage('');
//   }, []);

//   useEffect(() => () => stopCamera(), [stopCamera]);

//   // ─────────────────────────────────────────────────────────────────────────────
//   // Rate limit countdown display
//   // ─────────────────────────────────────────────────────────────────────────────
//   const startCountdown = (seconds) => {
//     clearInterval(countdownIntervalRef.current);
//     setRateLimitCountdown(seconds);
//     countdownIntervalRef.current = setInterval(() => {
//       setRateLimitCountdown((prev) => {
//         if (prev <= 1) {
//           clearInterval(countdownIntervalRef.current);
//           return 0;
//         }
//         return prev - 1;
//       });
//     }, 1000);
//   };

//   // ─────────────────────────────────────────────────────────────────────────────
//   // Liveness detection
//   // ─────────────────────────────────────────────────────────────────────────────
//   const startLivenessDetection = async () => {
//     try {
//       setLivenessStatus('starting');
//       setLivenessMessage('Creating liveness session...');
//       setLivenessResult(null);
//       setLivenessAttempts([]);
//       setRateLimitCountdown(0);

//       // Steps 1-3: Backend creates session
//       const res = await fetch('http://localhost:5000/api/liveness/start', {
//         method: 'POST',
//       });
//       const data = await res.json();

//       if (!data.sessionId || !data.authToken) {
//         setLivenessStatus('failed');
//         setLivenessMessage('❌ Failed to create session — please retry');
//         return;
//       }

//       setLivenessSessionId(data.sessionId);
//       setLivenessAuthToken(data.authToken);

//       // Step 4: Frontend calls Azure session/start directly
//       setLivenessMessage('Activating Azure session...');
//       const azureStart = await fetch(
//         `${AZURE_FACE_ENDPOINT}/face/v1.2/session/start`,
//         {
//           method: 'POST',
//           headers: {
//             Authorization: `Bearer ${data.authToken}`,
//             'Content-Type': 'application/json',
//           },
//           body: JSON.stringify({}),
//         },
//       );

//       if (!azureStart.ok) {
//         const err = await azureStart.json();
//         console.error('Azure session/start failed:', err);
//         setLivenessStatus('failed');
//         setLivenessMessage('❌ Azure session activation failed — please retry');
//         return;
//       }

//       setLivenessStatus('capturing');
//       setLivenessMessage(
//         '👤 Look directly at the camera with your face fully visible...',
//       );
//       isCapturingRef.current = true;
//       setLivenessCapturing(true);
//       startRecording();
//     } catch (err) {
//       console.error('startLivenessDetection error:', err);
//       setLivenessStatus('failed');
//       setLivenessMessage('❌ Error starting detection — please retry');
//     }
//   };

//   // ─── Frame capture helper ────────────────────────────────────────────────────
//   // const captureFrame = () => {
//   //   const video = liveVideoRef.current;
//   //   if (!video) {
//   //     console.warn('[Frame] No video ref');
//   //     return null;
//   //   }

//   //   // Guard: video must be playing with real dimensions
//   //   if (
//   //     video.readyState < 2 ||
//   //     video.videoWidth === 0 ||
//   //     video.videoHeight === 0
//   //   ) {
//   //     console.warn(
//   //       '[Frame] Video not ready —',
//   //       'readyState:',
//   //       video.readyState,
//   //       'size:',
//   //       video.videoWidth,
//   //       'x',
//   //       video.videoHeight,
//   //     );
//   //     return null;
//   //   }

//   //   const canvas = document.createElement('canvas');
//   //   canvas.width = video.videoWidth;
//   //   canvas.height = video.videoHeight;

//   //   const ctx = canvas.getContext('2d');
//   //   // NOTE: draw WITHOUT mirroring — the mirror is CSS-only for display.
//   //   // Azure needs the real (unmirrored) image.
//   //   ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

//   //   const imageBase64 = canvas.toDataURL('image/jpeg', 0.92);

//   //   // Guard: blank/black frame
//   //   if (imageBase64.length < 5000) {
//   //     console.warn(
//   //       '[Frame] Frame too small (likely blank):',
//   //       imageBase64.length,
//   //       'chars',
//   //     );
//   //     return null;
//   //   }

//   //   console.log(
//   //     `[Frame] Captured ${canvas.width}x${canvas.height} — ${(imageBase64.length / 1024).toFixed(1)} KB`,
//   //   );
//   //   return imageBase64;
//   // };

//   const captureFrame = () => {
//     const video = liveVideoRef.current;
//     if (!video) {
//       console.warn('[Frame] No video ref');
//       return null;
//     }

//     if (
//       video.readyState < 2 ||
//       video.videoWidth === 0 ||
//       video.videoHeight === 0
//     ) {
//       console.warn(
//         '[Frame] Video not ready —',
//         video.readyState,
//         video.videoWidth,
//         'x',
//         video.videoHeight,
//       );
//       return null;
//     }

//     // ✅ Cap resolution to 640×480 max — Azure doesn't need 1280p, keeps payload small
//     const MAX_WIDTH = 640;
//     const MAX_HEIGHT = 480;

//     let w = video.videoWidth;
//     let h = video.videoHeight;

//     if (w > MAX_WIDTH || h > MAX_HEIGHT) {
//       const ratio = Math.min(MAX_WIDTH / w, MAX_HEIGHT / h);
//       w = Math.round(w * ratio);
//       h = Math.round(h * ratio);
//     }

//     const canvas = document.createElement('canvas');
//     canvas.width = w;
//     canvas.height = h;

//     const ctx = canvas.getContext('2d');
//     ctx.drawImage(video, 0, 0, w, h); // draw at reduced size

//     // ✅ Lower JPEG quality — 0.8 gives ~80–150KB which is ideal for Azure
//     const imageBase64 = canvas.toDataURL('image/jpeg', 0.8);

//     if (imageBase64.length < 5000) {
//       console.warn(
//         '[Frame] Frame too small (likely blank):',
//         imageBase64.length,
//         'chars',
//       );
//       return null;
//     }

//     console.log(
//       `[Frame] ${w}x${h} — ${(imageBase64.length / 1024).toFixed(1)} KB`,
//     );
//     return imageBase64;
//   };

//   // ─── Frame sending loop ──────────────────────────────────────────────────────
//   useEffect(() => {
//     if (!livenessCapturing || !livenessSessionId || !livenessAuthToken) {
//       clearInterval(livenessIntervalRef.current);
//       return;
//     }

//     // Send first frame immediately, then repeat on interval
//     const sendFrame = async () => {
//       if (!isCapturingRef.current) return;

//       const imageBase64 = captureFrame();
//       if (!imageBase64) {
//         setLivenessMessage(
//           '⚠️ Camera not ready — ensure you are visible and well-lit',
//         );
//         return;
//       }

//       try {
//         const res = await fetch(
//           `http://localhost:5000/api/liveness/frame/${livenessSessionId}`,
//           {
//             method: 'POST',
//             headers: { 'Content-Type': 'application/json' },
//             body: JSON.stringify({
//               image: imageBase64,
//               authToken: livenessAuthToken,
//             }),
//           },
//         );

//         const frameData = await res.json();
//         console.log('[Frame] Response:', frameData);

//         // ── Handle rate limiting ────────────────────────────────────────────
//         if (res.status === 429) {
//           const waitSec =
//             frameData.retryAfterSeconds ||
//             Math.ceil((frameData.retryAfterMs || 6000) / 1000);
//           setLivenessMessage(`⏳ Rate limited — next attempt in ${waitSec}s`);
//           startCountdown(waitSec);
//           return;
//         }

//         // ── Handle specific error codes from backend ────────────────────────
//         if (frameData.code) {
//           const friendly =
//             LIVENESS_ERROR_MESSAGES[frameData.code] ||
//             frameData.details?.error?.message ||
//             'Adjust your position and try again';
//           setLivenessMessage(friendly);
//           if (frameData.code === 'BLANK_FRAME') return;
//         }

//         // ── Liveness decision ───────────────────────────────────────────────
//         if (frameData?.data?.livenessDecision === 'realface') {
//           clearInterval(livenessIntervalRef.current);
//           clearInterval(countdownIntervalRef.current);
//           isCapturingRef.current = false;
//           setLivenessCapturing(false);
//           setLivenessStatus('success');
//           setLivenessResult(frameData.data);
//           setLivenessMessage('✅ Liveness confirmed — real face detected!');
//           setRateLimitCountdown(0);
//           stopRecording();
//           return;
//         }

//         if (frameData?.data?.livenessDecision === 'spoofface') {
//           clearInterval(livenessIntervalRef.current);
//           clearInterval(countdownIntervalRef.current);
//           isCapturingRef.current = false;
//           setLivenessCapturing(false);
//           setLivenessStatus('failed');
//           setLivenessResult(frameData.data);
//           setLivenessMessage('⚠️ Spoof detected — please use a real face');
//           setRateLimitCountdown(0);
//           stopRecording();
//           return;
//         }

//         // Still processing — update message if attempt errors exist
//         if (frameData?.data?.error?.code) {
//           const friendly =
//             LIVENESS_ERROR_MESSAGES[frameData.data.error.code] ||
//             frameData.data.error.message;
//           setLivenessMessage(friendly);
//         } else if (!frameData.code) {
//           setLivenessMessage('👤 Keep looking at the camera...');
//           setRateLimitCountdown(Math.ceil(FRAME_INTERVAL_MS / 1000));
//           startCountdown(Math.ceil(FRAME_INTERVAL_MS / 1000));
//         }

//         // Poll attempt errors in parallel
//         checkLivenessAttempts();
//       } catch (err) {
//         console.error('[Frame] Send error:', err);
//         setLivenessMessage('⚠️ Connection error — retrying...');
//       }
//     };

//     // Fire immediately then on interval
//     sendFrame();
//     livenessIntervalRef.current = setInterval(sendFrame, FRAME_INTERVAL_MS);

//     return () => {
//       clearInterval(livenessIntervalRef.current);
//     };
//   }, [livenessCapturing, livenessSessionId, livenessAuthToken]);

//   // ─── Poll attempt errors ─────────────────────────────────────────────────────
//   const checkLivenessAttempts = async () => {
//     if (!livenessSessionId) return;
//     try {
//       const res = await fetch(
//         `http://localhost:5000/api/liveness/result/${livenessSessionId}`,
//       );
//       const data = await res.json();
//       if (data?.results?.attempts?.length) {
//         // Sort descending by attemptId to get latest first
//         const sorted = [...data.results.attempts].sort(
//           (a, b) => b.attemptId - a.attemptId,
//         );
//         setLivenessAttempts(sorted);
//         const latest = sorted[0];
//         if (latest?.error?.code) {
//           const friendly =
//             LIVENESS_ERROR_MESSAGES[latest.error.code] || latest.error.message;
//           setLivenessMessage(friendly);
//         }
//       }
//     } catch {}
//   };

//   // ─── Reset ───────────────────────────────────────────────────────────────────
//   const resetLiveness = () => {
//     clearInterval(livenessIntervalRef.current);
//     clearInterval(countdownIntervalRef.current);
//     isCapturingRef.current = false;
//     setLivenessCapturing(false);
//     setLivenessStatus('idle');
//     setLivenessResult(null);
//     setLivenessAttempts([]);
//     setLivenessSessionId(null);
//     setLivenessAuthToken(null);
//     setLivenessMessage('Camera ready. Click "Start Detection" to begin.');
//     setRecordedBlob(null);
//     setRecordingDuration(0);
//     setRateLimitCountdown(0);
//   };

//   // ─────────────────────────────────────────────────────────────────────────────
//   // Recording
//   // ─────────────────────────────────────────────────────────────────────────────
//   const startRecording = () => {
//     if (!streamRef.current) return;
//     recordedChunksRef.current = [];

//     let recorder;
//     try {
//       recorder = new MediaRecorder(streamRef.current, {
//         mimeType: 'video/webm;codecs=vp9,opus',
//       });
//     } catch {
//       recorder = new MediaRecorder(streamRef.current);
//     }

//     recorder.ondataavailable = (e) => {
//       if (e.data && e.data.size > 0) recordedChunksRef.current.push(e.data);
//     };
//     recorder.onstop = () => {
//       const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
//       setRecordedBlob(blob);
//     };

//     recorder.start(500);
//     mediaRecorderRef.current = recorder;
//     setIsRecording(true);
//     setRecordingDuration(0);

//     recordingTimerRef.current = setInterval(
//       () => setRecordingDuration((d) => d + 1),
//       1000,
//     );
//   };

//   const stopRecording = () => {
//     if (
//       mediaRecorderRef.current &&
//       mediaRecorderRef.current.state !== 'inactive'
//     ) {
//       mediaRecorderRef.current.stop();
//     }
//     clearInterval(recordingTimerRef.current);
//     setIsRecording(false);
//   };

//   const formatDuration = (s) =>
//     `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

//   // ─────────────────────────────────────────────────────────────────────────────
//   // Send recording for audio/face analysis
//   // ─────────────────────────────────────────────────────────────────────────────
//   const sendRecordingForAnalysis = async () => {
//     if (!recordedBlob) return;
//     const formData = new FormData();
//     formData.append('video', recordedBlob, 'liveness_recording.webm');
//     if (referenceFile?.fullUrl)
//       formData.append('referenceUrl', referenceFile.fullUrl);
//     if (livenessSessionId) formData.append('sessionId', livenessSessionId);

//     try {
//       setLivenessMessage('📤 Sending recording for audio/face analysis...');
//       const res = await fetch(
//         'http://localhost:5000/api/liveness/analyze-recording',
//         {
//           method: 'POST',
//           body: formData,
//         },
//       );
//       const data = await res.json();
//       console.log('Audio analysis result:', data);
//       setLivenessMessage('✅ Recording sent successfully for analysis');
//     } catch (err) {
//       console.error('Recording upload error:', err);
//       setLivenessMessage('⚠️ Recording upload failed — please retry');
//     }
//   };

//   // ─────────────────────────────────────────────────────────────────────────────
//   // Comparison handlers
//   // ─────────────────────────────────────────────────────────────────────────────
//   const handlePrevProvided = () =>
//     setCurrentProvidedIndex((p) =>
//       p === 0 ? providedFiles.length - 1 : p - 1,
//     );
//   const handleNextProvided = () =>
//     setCurrentProvidedIndex((p) =>
//       p === providedFiles.length - 1 ? 0 : p + 1,
//     );

//   const handleClearSession = () => {
//     setReferenceFile(null);
//     setProvidedFiles([]);
//     setCurrentProvidedIndex(0);
//     setCompareResult(null);
//     setCompareError('');
//     try {
//       localStorage.removeItem(STORAGE_KEY);
//     } catch {}
//   };

//   const handleOpenDialog = (type) => {
//     setDialogType(type);
//     if (type === 'provided')
//       setTempProvidedSelection(providedFiles.map((f) => f.url));
//     setOpenDialog(true);
//   };

//   const handleSelectReference = (file) => {
//     setReferenceFile(file);
//     setOpenDialog(false);
//   };

//   const handleToggleProvidedSelection = (file) => {
//     setTempProvidedSelection((prev) =>
//       prev.includes(file.url)
//         ? prev.filter((u) => u !== file.url)
//         : [...prev, file.url],
//     );
//   };

//   const handleConfirmProvidedSelection = () => {
//     const selected = availableFiles.provided.filter((f) =>
//       tempProvidedSelection.includes(f.url),
//     );
//     setProvidedFiles(selected);
//     setCurrentProvidedIndex(0);
//     setOpenDialog(false);
//   };

//   const handleCompare = async () => {
//     if (!referenceFile) {
//       setCompareError('Please select a reference image');
//       return;
//     }
//     if (livenessStatus !== 'success' && !providedFiles.length) {
//       setCompareError(
//         'Please complete liveness detection or select a provided video',
//       );
//       return;
//     }
//     try {
//       setCompareLoading(true);
//       setCompareError('');
//       setCompareResult(null);
//       const res = await verifyVideo(
//         referenceFile.fullUrl,
//         providedFiles.map((f) => f.fullUrl),
//       );
//       console.log('Comparison response:', res);
//       setCompareResult(res.data);
//     } catch (err) {
//       console.error('Comparison error:', err);
//       let msg = 'Failed to compare files';
//       if (err.code === 'ECONNABORTED')
//         msg = 'Request timed out. Files may be too large.';
//       else if (err.response)
//         msg = err.response?.data?.message || err.response?.data?.error || msg;
//       else if (err.message) msg = err.message;
//       setCompareError(msg);
//     } finally {
//       setCompareLoading(false);
//     }
//   };

//   // ─────────────────────────────────────────────────────────────────────────────
//   // Render helpers
//   // ─────────────────────────────────────────────────────────────────────────────
//   const renderFileCard = (file, { selected = false, onClick }) => {
//     const isPdf = file.ext === 'pdf';
//     const isVid = isVideoFile(file.ext);
//     return (
//       <div
//         onClick={onClick}
//         className={`h-40 w-40 flex flex-col border rounded-lg overflow-hidden cursor-pointer transition-all shadow-sm ${
//           selected
//             ? 'border-blue-600 shadow-md scale-[1.02] ring-2 ring-blue-300'
//             : 'border-gray-200 hover:shadow-md hover:scale-[1.02]'
//         }`}
//       >
//         <div className='h-32 bg-gray-50 flex items-center justify-center overflow-hidden relative'>
//           {isPdf ? (
//             <PictureAsPdfIcon className='text-red-600' sx={{ fontSize: 32 }} />
//           ) : isVid ? (
//             <>
//               <video
//                 src={file.fullUrl}
//                 className='max-w-full max-h-full object-cover'
//                 muted
//                 preload='metadata'
//               />
//               <div className='absolute inset-0 flex items-center justify-center bg-black/25'>
//                 <MdOutlineSlowMotionVideo
//                   size={32}
//                   className='text-white drop-shadow'
//                 />
//               </div>
//             </>
//           ) : (
//             <img
//               src={file.fullUrl}
//               alt={file.name}
//               className='max-w-full max-h-full object-cover'
//             />
//           )}
//         </div>
//         <div className='px-2 py-1.5 flex-1 flex items-center justify-center'>
//           <p className='text-[0.75rem] text-center font-semibold truncate w-full'>
//             {file.name}
//           </p>
//         </div>
//       </div>
//     );
//   };

//   const renderReferenceBox = () => {
//     if (!referenceFile) {
//       return (
//         <div
//           onClick={() => handleOpenDialog('reference')}
//           className='border-2 border-dashed border-gray-300 rounded-xl text-center text-gray-500 h-[260px] flex flex-col items-center justify-center cursor-pointer hover:bg-gray-50 transition'
//         >
//           <ImageIcon sx={{ fontSize: 48 }} />
//           <p className='mt-2 text-sm font-semibold'>
//             Click to select Reference Image
//           </p>
//           <p className='mt-1 text-xs'>
//             Choose one photo from your recent uploads
//           </p>
//         </div>
//       );
//     }
//     const isPdf = referenceFile.ext === 'pdf';
//     return (
//       <div
//         onClick={() => handleOpenDialog('reference')}
//         className='border-2 border-green-500 bg-green-50 rounded-xl h-[260px] cursor-pointer hover:shadow-md transition flex flex-col'
//       >
//         {isPdf ? (
//           <div className='flex-1 flex flex-col items-center justify-center gap-2 px-3'>
//             <PictureAsPdfIcon sx={{ fontSize: 48 }} className='text-red-600' />
//             <p className='text-sm font-semibold text-center'>
//               {referenceFile.name}
//             </p>
//             <Button
//               size='small'
//               variant='outlined'
//               href={referenceFile.fullUrl}
//               target='_blank'
//               onClick={(e) => e.stopPropagation()}
//             >
//               Open PDF
//             </Button>
//           </div>
//         ) : (
//           <div className='flex-1 flex flex-col items-center justify-center px-3'>
//             <img
//               src={referenceFile.fullUrl}
//               alt={referenceFile.name}
//               className='w-full max-w-xs h-[190px] object-contain rounded-lg'
//             />
//             <p className='mt-2 text-sm font-semibold text-center truncate w-full'>
//               {referenceFile.name}
//             </p>
//           </div>
//         )}
//       </div>
//     );
//   };

//   // ─── Live Detection Box ───────────────────────────────────────────────────────
//   const renderLiveDetectionBox = () => {
//     const statusBorderColor =
//       livenessStatus === 'success'
//         ? 'border-green-500'
//         : livenessStatus === 'failed'
//           ? 'border-red-500'
//           : livenessStatus === 'capturing'
//             ? 'border-blue-400'
//             : 'border-gray-200';

//     return (
//       <div
//         className={`border-2 ${statusBorderColor} rounded-xl overflow-hidden bg-white shadow-sm flex flex-col transition-colors`}
//         style={{ minHeight: 340 }}
//       >
//         {/* ── Header ─────────────────────────────────────────────────────────── */}
//         <div className='flex items-center justify-between px-4 py-2.5 bg-gradient-to-r from-slate-700 to-slate-800'>
//           <div className='flex items-center gap-2'>
//             {/* Live status dot */}
//             <div
//               className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
//                 livenessStatus === 'success'
//                   ? 'bg-green-400'
//                   : livenessStatus === 'failed'
//                     ? 'bg-red-400'
//                     : livenessStatus === 'capturing'
//                       ? 'bg-blue-400 animate-pulse'
//                       : liveMode
//                         ? 'bg-green-400'
//                         : 'bg-gray-400'
//               }`}
//             />
//             <span className='text-white text-sm font-semibold tracking-wide'>
//               Live Face Detection
//             </span>
//             {/* Recording badge */}
//             {isRecording && (
//               <Chip
//                 icon={
//                   <FiberManualRecordIcon
//                     sx={{ fontSize: 10, color: 'white !important' }}
//                   />
//                 }
//                 label={formatDuration(recordingDuration)}
//                 size='small'
//                 sx={{
//                   bgcolor: '#ef4444',
//                   color: 'white',
//                   fontSize: 11,
//                   height: 20,
//                   '& .MuiChip-icon': { color: 'white' },
//                 }}
//               />
//             )}
//           </div>

//           <div className='flex items-center gap-1.5'>
//             {/* Mic toggle */}
//             {liveMode && (
//               <Tooltip
//                 title={audioEnabled ? 'Mute microphone' : 'Unmute microphone'}
//               >
//                 <button
//                   onClick={() => {
//                     if (streamRef.current) {
//                       streamRef.current.getAudioTracks().forEach((t) => {
//                         t.enabled = !audioEnabled;
//                       });
//                     }
//                     setAudioEnabled((v) => !v);
//                   }}
//                   className='text-white/70 hover:text-white p-1 rounded transition'
//                 >
//                   {audioEnabled ? (
//                     <MicIcon sx={{ fontSize: 18 }} />
//                   ) : (
//                     <MicOffIcon sx={{ fontSize: 18 }} />
//                   )}
//                 </button>
//               </Tooltip>
//             )}
//             {/* Camera toggle */}
//             <button
//               onClick={liveMode ? stopCamera : startCamera}
//               className={`flex items-center gap-1 text-xs font-semibold px-3 py-1.5 rounded-full transition ${
//                 liveMode
//                   ? 'bg-red-500 hover:bg-red-600 text-white'
//                   : 'bg-white hover:bg-gray-100 text-slate-700'
//               }`}
//             >
//               {liveMode ? (
//                 <>
//                   <VideocamOffIcon sx={{ fontSize: 16 }} /> Off
//                 </>
//               ) : (
//                 <>
//                   <VideocamIcon sx={{ fontSize: 16 }} /> Camera
//                 </>
//               )}
//             </button>
//           </div>
//         </div>

//         {/* ── Video area ─────────────────────────────────────────────────────── */}
//         <div
//           className='relative bg-black flex-1 flex items-center justify-center'
//           style={{ height: 240, minHeight: 240 }}
//         >
//           {/* Video element is ALWAYS in the DOM so ref is always valid.
//               We just hide it when camera is off. */}
//           <video
//             ref={liveVideoRef}
//             autoPlay
//             playsInline
//             muted
//             onLoadedMetadata={() => {
//               console.log(
//                 '[Video] Metadata loaded:',
//                 liveVideoRef.current?.videoWidth,
//                 'x',
//                 liveVideoRef.current?.videoHeight,
//               );
//             }}
//             onCanPlay={() => {
//               console.log('[Video] Can play');
//               liveVideoRef.current?.play().catch(() => {});
//             }}
//             style={{
//               position: 'absolute',
//               inset: 0,
//               width: '100%',
//               height: '100%',
//               objectFit: 'cover',
//               display: liveMode ? 'block' : 'none',
//               transform: 'scaleX(-1)', // mirror like a selfie camera
//             }}
//           />

//           {/* Camera off placeholder */}
//           {!liveMode && (
//             <div className='flex flex-col items-center justify-center gap-3 text-white/50'>
//               <VideocamOffIcon sx={{ fontSize: 56 }} />
//               <p className='text-sm font-medium'>Camera is off</p>
//               <button
//                 onClick={startCamera}
//                 className='mt-1 bg-white/10 hover:bg-white/20 text-white text-xs font-semibold px-5 py-2.5 rounded-full transition border border-white/20'
//               >
//                 Turn On Camera
//               </button>
//             </div>
//           )}

//           {/* Face guide oval — only during capturing */}
//           {liveMode && livenessStatus === 'capturing' && (
//             <div className='absolute inset-0 flex flex-col items-center justify-center pointer-events-none gap-2'>
//               <div
//                 className='border-4 border-white/80 rounded-full'
//                 style={{
//                   width: 150,
//                   height: 195,
//                   borderStyle: 'dashed',
//                   boxShadow: '0 0 0 9999px rgba(0,0,0,0.35)',
//                   animation: 'pulse 2s cubic-bezier(0.4,0,0.6,1) infinite',
//                 }}
//               />
//               <p className='absolute bottom-3 text-white/90 text-[11px] font-semibold bg-black/50 px-3 py-1 rounded-full'>
//                 Align face within the oval
//               </p>
//             </div>
//           )}

//           {/* Rate limit countdown badge */}
//           {liveMode &&
//             rateLimitCountdown > 0 &&
//             livenessStatus === 'capturing' && (
//               <div className='absolute top-3 right-3 bg-black/70 text-white text-xs font-bold px-3 py-1.5 rounded-full flex items-center gap-1.5'>
//                 <HourglassEmptyIcon sx={{ fontSize: 13 }} />
//                 Next scan in {rateLimitCountdown}s
//               </div>
//             )}

//           {/* Success overlay */}
//           {liveMode && livenessStatus === 'success' && (
//             <div className='absolute inset-0 bg-green-900/80 flex flex-col items-center justify-center gap-3'>
//               <VerifiedUserIcon sx={{ fontSize: 64, color: '#4ade80' }} />
//               <p className='text-white font-bold text-xl tracking-wide'>
//                 Liveness Confirmed
//               </p>
//               <p className='text-green-300 text-sm'>Real person detected ✓</p>
//             </div>
//           )}

//           {/* Spoof overlay */}
//           {liveMode &&
//             livenessStatus === 'failed' &&
//             livenessResult?.livenessDecision === 'spoofface' && (
//               <div className='absolute inset-0 bg-red-900/75 flex flex-col items-center justify-center gap-3'>
//                 <WarningAmberIcon sx={{ fontSize: 56, color: '#fbbf24' }} />
//                 <p className='text-white font-bold text-xl'>Spoof Detected</p>
//                 <p className='text-red-300 text-sm'>Please use a real face</p>
//               </div>
//             )}
//         </div>

//         {/* ── Status message bar ──────────────────────────────────────────────── */}
//         {liveMode && livenessMessage && (
//           <div
//             className={`px-4 py-2.5 text-xs font-medium border-t flex items-start gap-2 ${
//               livenessStatus === 'success'
//                 ? 'bg-green-50 text-green-800 border-green-200'
//                 : livenessStatus === 'failed'
//                   ? 'bg-red-50 text-red-800 border-red-200'
//                   : livenessStatus === 'capturing'
//                     ? 'bg-blue-50 text-blue-800 border-blue-200'
//                     : 'bg-gray-50 text-gray-700 border-gray-200'
//             }`}
//           >
//             <div className='flex-1'>
//               {livenessStatus === 'capturing' && (
//                 <LinearProgress
//                   variant='indeterminate'
//                   sx={{
//                     mb: 1,
//                     height: 2,
//                     borderRadius: 1,
//                     bgcolor: 'rgba(59,130,246,0.2)',
//                     '& .MuiLinearProgress-bar': { bgcolor: '#3b82f6' },
//                   }}
//                 />
//               )}
//               {livenessMessage}
//             </div>
//           </div>
//         )}

//         {/* ── Attempt error log ───────────────────────────────────────────────── */}
//         {livenessAttempts.length > 0 && livenessStatus === 'capturing' && (
//           <div className='px-4 py-2 border-t border-amber-200 bg-amber-50 max-h-24 overflow-y-auto'>
//             <p className='text-[11px] font-bold text-amber-800 mb-1.5'>
//               Attempt History:
//             </p>
//             {livenessAttempts.slice(0, 4).map((a) => (
//               <div
//                 key={a.attemptId}
//                 className='flex items-start gap-1.5 mb-0.5'
//               >
//                 <span
//                   className={`text-[10px] font-bold mt-0.5 flex-shrink-0 ${a.attemptStatus === 'Succeeded' ? 'text-green-600' : 'text-red-500'}`}
//                 >
//                   #{a.attemptId}
//                 </span>
//                 <span className='text-[11px] text-amber-700'>
//                   {a.error
//                     ? LIVENESS_ERROR_MESSAGES[a.error.code] || a.error.message
//                     : a.attemptStatus}
//                 </span>
//               </div>
//             ))}
//           </div>
//         )}

//         {/* ── Action buttons ──────────────────────────────────────────────────── */}
//         {liveMode && (
//           <div className='px-4 py-3 border-t border-gray-100 bg-gray-50 flex flex-wrap gap-2 items-center justify-between'>
//             {/* Left: detection controls */}
//             <div className='flex gap-2 flex-wrap'>
//               {livenessStatus === 'idle' && (
//                 <button
//                   onClick={startLivenessDetection}
//                   className='flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-4 py-2 rounded-lg transition shadow-sm'
//                 >
//                   <RadioButtonCheckedIcon sx={{ fontSize: 15 }} />
//                   Start Detection
//                 </button>
//               )}

//               {livenessStatus === 'starting' && (
//                 <div className='flex items-center gap-2 text-xs text-gray-600 px-2'>
//                   <CircularProgress size={14} />
//                   <span>Initializing...</span>
//                 </div>
//               )}

//               {livenessStatus === 'capturing' && (
//                 <button
//                   onClick={() => {
//                     clearInterval(livenessIntervalRef.current);
//                     clearInterval(countdownIntervalRef.current);
//                     isCapturingRef.current = false;
//                     setLivenessCapturing(false);
//                     setLivenessStatus('idle');
//                     setRateLimitCountdown(0);
//                     stopRecording();
//                     setLivenessMessage(
//                       'Stopped. Click "Start Detection" to retry.',
//                     );
//                   }}
//                   className='flex items-center gap-1.5 bg-red-500 hover:bg-red-600 text-white text-xs font-semibold px-4 py-2 rounded-lg transition'
//                 >
//                   <StopIcon sx={{ fontSize: 15 }} />
//                   Stop
//                 </button>
//               )}

//               {(livenessStatus === 'success' ||
//                 livenessStatus === 'failed') && (
//                 <button
//                   onClick={resetLiveness}
//                   className='flex items-center gap-1.5 bg-slate-600 hover:bg-slate-700 text-white text-xs font-semibold px-4 py-2 rounded-lg transition'
//                 >
//                   <ReplayIcon sx={{ fontSize: 15 }} />
//                   Try Again
//                 </button>
//               )}
//             </div>

//             {/* Right: recording controls */}
//             <div className='flex items-center gap-2'>
//               {!isRecording &&
//                 livenessStatus !== 'capturing' &&
//                 livenessStatus !== 'starting' && (
//                   <Tooltip title='Manually record video with audio for analysis'>
//                     <button
//                       onClick={startRecording}
//                       className='flex items-center gap-1 text-xs text-gray-600 hover:text-red-600 px-2.5 py-1.5 rounded border border-gray-300 hover:border-red-400 transition'
//                     >
//                       <FiberManualRecordIcon
//                         sx={{ fontSize: 14, color: '#ef4444' }}
//                       />
//                       Record
//                     </button>
//                   </Tooltip>
//                 )}

//               {isRecording && livenessStatus !== 'capturing' && (
//                 <button
//                   onClick={stopRecording}
//                   className='flex items-center gap-1 text-xs text-red-600 font-semibold px-2.5 py-1.5 rounded border border-red-400 transition animate-pulse'
//                 >
//                   <StopIcon sx={{ fontSize: 14 }} />
//                   Stop {formatDuration(recordingDuration)}
//                 </button>
//               )}

//               {recordedBlob && !isRecording && (
//                 <button
//                   onClick={sendRecordingForAnalysis}
//                   className='flex items-center gap-1.5 text-xs bg-purple-600 hover:bg-purple-700 text-white font-semibold px-3 py-1.5 rounded-lg transition'
//                 >
//                   📤 Analyze
//                 </button>
//               )}
//             </div>
//           </div>
//         )}

//         {/* ── Success footer with analyze recording button ─────────────────────── */}
//         {livenessStatus === 'success' && (
//           <div className='px-4 py-2.5 bg-green-600 text-white text-xs font-semibold flex items-center gap-2'>
//             <CheckCircleIcon sx={{ fontSize: 16 }} />
//             <span>Liveness verified — ready for comparison</span>
//             {recordedBlob && (
//               <button
//                 onClick={sendRecordingForAnalysis}
//                 className='ml-auto bg-white text-green-700 px-3 py-1 rounded text-xs font-bold hover:bg-green-50 transition flex-shrink-0'
//               >
//                 📤 Analyze Recording
//               </button>
//             )}
//           </div>
//         )}
//       </div>
//     );
//   };

//   const renderComparisonResults = () => {
//     if (!compareResult) return null;
//     const { liveness_score, confidence_score, cost, image } = compareResult;
//     const isAccepted = confidence_score >= 80;
//     return (
//       <div className='space-y-6'>
//         <div
//           className={`flex flex-col md:flex-row md:items-center md:justify-between gap-4 rounded-xl border-2 p-4 ${isAccepted ? 'bg-green-50 border-green-500' : 'bg-red-50 border-red-500'}`}
//         >
//           <div>
//             <p className='text-xl font-bold'>
//               {isAccepted ? '✅ Match Accepted' : '❌ Match Not Strong'}
//             </p>
//             <p className='text-sm text-gray-600'>Confidence threshold: 80%</p>
//           </div>
//           <div className='text-lg font-semibold space-y-1'>
//             <p>
//               Confidence:{' '}
//               <span className='text-blue-700'>
//                 {confidence_score?.toFixed(2)}%
//               </span>
//             </p>
//             <p>
//               Liveness:{' '}
//               <span className='text-purple-700'>
//                 {liveness_score?.toFixed(2)}%
//               </span>
//             </p>
//             <p>
//               Cost: <span className='text-gray-700'>${cost}</span>
//             </p>
//           </div>
//         </div>
//         {image && (
//           <div className='bg-white border rounded-xl p-4 shadow-sm'>
//             <p className='text-lg font-semibold mb-3'>
//               Extracted Frame / Result Image
//             </p>
//             <div className='flex justify-center'>
//               <img
//                 src={`data:image/jpeg;base64,${image}`}
//                 alt='Result'
//                 className='max-w-sm rounded-lg border shadow-md'
//               />
//             </div>
//           </div>
//         )}
//       </div>
//     );
//   };

//   const fileList =
//     dialogType === 'reference'
//       ? availableFiles.reference
//       : availableFiles.provided;

//   // ─────────────────────────────────────────────────────────────────────────────
//   // Render
//   // ─────────────────────────────────────────────────────────────────────────────
//   return (
//     <div className='px-4 md:px-10 py-1 w-full'>
//       {/* Title + Clear */}
//       <div className='flex items-center justify-between mb-4'>
//         <h2 className='font-semibold text-[22px] text-gray-700'>
//           Video Comparison
//         </h2>
//         <Button
//           size='small'
//           variant='outlined'
//           onClick={handleClearSession}
//           sx={{ textTransform: 'none', fontSize: 12 }}
//         >
//           Clear selection &amp; result
//         </Button>
//       </div>

//       {/* Selection grid */}
//       <div className='grid grid-cols-1 md:grid-cols-2 gap-4 bg-white rounded-2xl shadow-md p-4 md:p-6 mb-4'>
//         {/* LEFT — Reference image */}
//         <div>
//           <div className='flex items-center gap-2 mb-2'>
//             <p className='font-semibold text-[16px]'>Reference Image</p>
//             {referenceFile && (
//               <CheckCircleIcon
//                 sx={{ fontSize: 18 }}
//                 className='text-green-600'
//               />
//             )}
//           </div>
//           {renderReferenceBox()}
//         </div>

//         {/* RIGHT — Live detection */}
//         <div>
//           <div className='flex items-center justify-between mb-2'>
//             <div className='flex items-center gap-2'>
//               <p className='font-semibold text-[16px]'>Live Verification</p>
//               {livenessStatus === 'success' && (
//                 <CheckCircleIcon
//                   sx={{ fontSize: 18 }}
//                   className='text-green-600'
//                 />
//               )}
//               {livenessStatus === 'failed' && (
//                 <ErrorIcon sx={{ fontSize: 18 }} className='text-red-500' />
//               )}
//             </div>
//             <Button
//               size='small'
//               variant='text'
//               onClick={() => handleOpenDialog('provided')}
//               startIcon={<FolderOpenIcon />}
//               sx={{ textTransform: 'none', fontSize: 12, px: 1 }}
//             >
//               Use Uploaded Video
//             </Button>
//           </div>

//           {renderLiveDetectionBox()}

//           {/* Uploaded video chips */}
//           {providedFiles.length > 0 && (
//             <div className='mt-2 p-3 bg-blue-50 rounded-lg border border-blue-200'>
//               <p className='text-xs text-blue-700 font-semibold mb-1'>
//                 {providedFiles.length} uploaded video
//                 {providedFiles.length > 1 ? 's' : ''} also selected
//               </p>
//               <div className='flex gap-2 flex-wrap'>
//                 {providedFiles.map((f) => (
//                   <Chip
//                     key={f.url}
//                     label={f.name}
//                     size='small'
//                     onDelete={() =>
//                       setProvidedFiles((prev) =>
//                         prev.filter((p) => p.url !== f.url),
//                       )
//                     }
//                   />
//                 ))}
//               </div>
//             </div>
//           )}
//         </div>
//       </div>

//       {/* Compare button */}
//       <div className='mb-4 text-center'>
//         <button
//           type='button'
//           disabled={
//             !referenceFile ||
//             (livenessStatus !== 'success' && !providedFiles.length) ||
//             compareLoading
//           }
//           onClick={handleCompare}
//           className={`inline-flex items-center gap-2 rounded-full px-8 py-3 font-semibold text-white shadow-md transition text-[18px] ${
//             !referenceFile ||
//             (livenessStatus !== 'success' && !providedFiles.length) ||
//             compareLoading
//               ? 'cursor-not-allowed bg-gray-400'
//               : 'bg-blue-600 hover:bg-blue-700 cursor-pointer'
//           }`}
//         >
//           {compareLoading ? (
//             <CircularProgress size={20} sx={{ color: 'white' }} />
//           ) : (
//             <CompareArrowsIcon />
//           )}
//           {compareLoading ? 'Comparing...' : 'Compare Now'}
//         </button>
//         {!referenceFile && (
//           <p className='text-xs text-gray-400 mt-2'>
//             Select a reference image to enable comparison
//           </p>
//         )}
//         {referenceFile &&
//           livenessStatus !== 'success' &&
//           !providedFiles.length && (
//             <p className='text-xs text-gray-400 mt-2'>
//               Complete live detection or upload a video to compare
//             </p>
//           )}
//       </div>

//       {/* Error */}
//       {compareError && (
//         <div className='mb-3'>
//           <Alert severity='error' onClose={() => setCompareError('')}>
//             {compareError}
//           </Alert>
//         </div>
//       )}

//       {/* Results */}
//       <div className='bg-white rounded-xl shadow-md px-4 py-4'>
//         <p className='text-[18px] font-semibold mb-2'>Comparison Results</p>
//         {compareLoading && (
//           <div className='text-center py-6'>
//             <CircularProgress />
//             <p className='mt-2 text-sm text-gray-600'>Analyzing files...</p>
//           </div>
//         )}
//         {!compareLoading && compareResult ? (
//           renderComparisonResults()
//         ) : !compareLoading && !compareResult ? (
//           <p className='text-center text-sm text-gray-500 py-3'>
//             Complete live detection, then click{' '}
//             <span className='font-semibold'>"Compare Now"</span>.
//           </p>
//         ) : null}
//       </div>

//       {/* File dialog */}
//       <Dialog
//         open={openDialog}
//         onClose={() => setOpenDialog(false)}
//         maxWidth='md'
//         fullWidth
//       >
//         <DialogTitle>
//           {dialogType === 'reference'
//             ? 'Select Reference Image'
//             : `Select Provided Videos (${tempProvidedSelection.length} selected)`}
//         </DialogTitle>
//         <DialogContent>
//           {loadingFiles ? (
//             <div className='text-center py-6'>
//               <CircularProgress />
//               <p className='mt-2 text-sm'>Loading files...</p>
//             </div>
//           ) : fileList.length === 0 ? (
//             <div className='text-center py-6 text-gray-500'>
//               {dialogType === 'reference' ? (
//                 <ImageIcon sx={{ fontSize: 60 }} className='mb-2' />
//               ) : (
//                 <MdOutlineSlowMotionVideo size={60} className='mb-2 mx-auto' />
//               )}
//               <p>
//                 No{' '}
//                 {dialogType === 'reference'
//                   ? 'reference images'
//                   : 'provided videos'}{' '}
//                 uploaded yet
//               </p>
//               <p className='text-xs mt-1'>Go to the Upload page to add files</p>
//             </div>
//           ) : (
//             <div className='grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 mt-2'>
//               {fileList.map((file) => {
//                 if (dialogType === 'reference') {
//                   return (
//                     <div key={file.url}>
//                       {renderFileCard(file, {
//                         selected: referenceFile?.url === file.url,
//                         onClick: () => handleSelectReference(file),
//                       })}
//                     </div>
//                   );
//                 }
//                 return (
//                   <div key={file.url}>
//                     {renderFileCard(file, {
//                       selected: tempProvidedSelection.includes(file.url),
//                       onClick: () => handleToggleProvidedSelection(file),
//                     })}
//                   </div>
//                 );
//               })}
//             </div>
//           )}
//         </DialogContent>
//         <DialogActions>
//           <Button onClick={() => setOpenDialog(false)}>Close</Button>
//           <Button onClick={loadAvailableFiles} startIcon={<FolderOpenIcon />}>
//             Refresh
//           </Button>
//           {dialogType === 'provided' && (
//             <Button
//               variant='contained'
//               disabled={!tempProvidedSelection.length}
//               onClick={handleConfirmProvidedSelection}
//             >
//               Confirm ({tempProvidedSelection.length})
//             </Button>
//           )}
//         </DialogActions>
//       </Dialog>
//     </div>
//   );
// }