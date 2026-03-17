import React, { useRef, useState, useEffect } from 'react';
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
} from '@mui/material';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import ImageIcon from '@mui/icons-material/Image';
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord';
import ReplayIcon from '@mui/icons-material/Replay';
import VerifiedUserIcon from '@mui/icons-material/VerifiedUser';
import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
import StopCircleIcon from '@mui/icons-material/StopCircle';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import ShieldIcon from '@mui/icons-material/Shield';

import FaceLivenessDetector from '../../components/FaceLivenessDetector';

import RenderResults from './RenderResults';
import { API_BASE_URL, getRecentUploads } from '../../api/uploadApi';
import { verifyVideo } from '../../api/comparisonApi';

// ─── Constants ────────────────────────────────────────────────────────────────
const STORAGE_KEY = 'videoComparisonState';
const IDB_DB = 'LivenessVideoDB';
const IDB_STORE = 'recordings';

const fmt = (s) =>
  `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

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

// ─── IndexedDB helpers ────────────────────────────────────────────────────────
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

// ─── Step config ──────────────────────────────────────────────────────────────
const STEPS = [
  { key: 'liveness', label: '1. Liveness' },
  { key: 'recording', label: '2. Record' },
  { key: 'comparing', label: '3. Compare' },
  { key: 'done', label: '4. Done' },
];

// ─── LivenessWrapper ──────────────────────────────────────────────────────────
// Wraps your original FaceLivenessDetectorComponent.
// - On mount: shows splash.html + single "Start Liveness Check" button
// - On click: mounts FaceLivenessDetectorComponent (PassiveActive mode only)
// - On result: calls onComplete(result) upward
function LivenessWrapper({ onComplete, onError }) {
  const checkmarkCircleIcon = 'CheckmarkCircle.png';

  const [state, setState] = useState('Initial'); // Initial | Detecting | Done
  const [livenessIcon, setLivenessIcon] = useState(checkmarkCircleIcon);
  const [livenessText, setLivenessText] = useState('Real Person');
  const [recognitionIcon, setRecognitionIcon] = useState(checkmarkCircleIcon);
  const [recognitionText, setRecognitionText] = useState('Same Person');
  const [withVerify, setWithVerify] = useState(false);

  const handleDisplayResult = (isWithVerify) => {
    setWithVerify(isWithVerify);
    setState('Done');
  };

  const handleFetchFailure = (err) => {
    setState('Done');
    onError?.(err);
  };

  // Fire onComplete when we reach Done
  useEffect(() => {
    if (state === 'Done') {
      const passed = livenessText === 'Real Person';
      onComplete?.({
        decision: passed ? 'realface' : 'spoof',
        status: passed ? 'passed' : 'failed',
        livenessText,
        recognitionText,
        withVerify,
      });
    }
  }, [state]); // eslint-disable-line

  const btnCls =
    'text-white bg-[#036ac4] hover:bg-[#0473ce] px-6 py-2 rounded-md text-sm font-semibold cursor-pointer transition';

  // Initial: splash + start button
  if (state === 'Initial') {
    return (
      <div className='flex flex-col'>
        <iframe
          id='splash'
          title='splash'
          src='splash.html'
          role='status'
          className='w-full border-none bg-white'
          style={{ height: '300px' }}
        />
        <div className='flex justify-center py-5'>
          <button
            type='button'
            onClick={() => setState('Detecting')}
            className={btnCls}
          >
            Start Liveness Check
          </button>
        </div>
      </div>
    );
  }

  // Detecting: mount original component; it takes over the UI fully
  if (state === 'Detecting') {
    return (
      <FaceLivenessDetector
        livenessOperationMode='PassiveActive'
        file={undefined}
        setIsDetectLivenessWithVerify={handleDisplayResult}
        fetchFailureCallback={handleFetchFailure}
        setLivenessIcon={setLivenessIcon}
        setLivenessText={setLivenessText}
        setRecognitionIcon={setRecognitionIcon}
        setRecognitionText={setRecognitionText}
      />
    );
  }

  // Done: Video.jsx takes over the UI — render nothing
  return null;
}

// ─── Main Component ───────────────────────────────────────────────────────────
export default function Video() {
  /**
   * step flow:
   *   liveness → liveness_done → recording → comparing → done
   */
  const [step, setStep] = useState('liveness'); // render liveness immediately on page open

  // ── Liveness ──────────────────────────────────────────────────────────────
  const [livenessResult, setLivenessResult] = useState(null);

  // ── Recording ─────────────────────────────────────────────────────────────
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [savedVideoUrl, setSavedVideoUrl] = useState(null);
  const [savedVideoKey, setSavedVideoKey] = useState(null);

  // ── Files ─────────────────────────────────────────────────────────────────
  const [referenceFile, setReferenceFile] = useState(null);
  const [availableFiles, setAvailableFiles] = useState({ reference: [] });
  const [openDialog, setOpenDialog] = useState(false);
  const [loadingFiles, setLoadingFiles] = useState(false);

  // ── Comparison ────────────────────────────────────────────────────────────
  const [compareResult, setCompareResult] = useState(null);
  const [compareLoading, setCompareLoading] = useState(false);
  const [compareError, setCompareError] = useState('');

  // ── Hydration ─────────────────────────────────────────────────────────────
  const [isHydrated, setIsHydrated] = useState(false);

  // ── Refs ──────────────────────────────────────────────────────────────────
  const streamRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const recordedChunksRef = useRef([]);
  const recordingTimerRef = useRef(null);
  const videoPreviewRef = useRef(null);

  // ─────────────────────────────────────────────────────────────────────────
  // File loading
  // ─────────────────────────────────────────────────────────────────────────
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

  // ─────────────────────────────────────────────────────────────────────────
  // LocalStorage hydration
  // ─────────────────────────────────────────────────────────────────────────
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
        JSON.stringify({ referenceFile, compareResult, savedVideoKey }),
      );
    } catch {}
  }, [referenceFile, compareResult, savedVideoKey, isHydrated]);

  useEffect(() => () => stopStream(), []);

  // ─────────────────────────────────────────────────────────────────────────
  // Liveness callbacks
  // ─────────────────────────────────────────────────────────────────────────
  const handleLivenessComplete = (result) => {
    setLivenessResult(result);
    setStep('liveness_done');
  };

  const handleLivenessError = (error) => {
    console.error('[Liveness] Error:', error);
    setStep('liveness_done'); // show result screen even on error
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Recording
  // ─────────────────────────────────────────────────────────────────────────
  const startRecording = async () => {
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
      recordedChunksRef.current = [];

      if (videoPreviewRef.current) {
        videoPreviewRef.current.srcObject = stream;
        videoPreviewRef.current.play().catch(() => {});
      }

      let recorder;
      try {
        recorder = new MediaRecorder(stream, {
          mimeType: 'video/webm;codecs=vp9,opus',
        });
      } catch {
        recorder = new MediaRecorder(stream);
      }

      recorder.ondataavailable = (e) => {
        if (e.data?.size > 0) recordedChunksRef.current.push(e.data);
      };

      recorder.start(500);
      mediaRecorderRef.current = recorder;
      setRecordingDuration(0);
      recordingTimerRef.current = setInterval(
        () => setRecordingDuration((d) => d + 1),
        1000,
      );
    } catch (err) {
      console.error('[Recording] Error:', err);
      setCompareError(
        'Could not access camera/microphone. Please allow permissions.',
      );
    }
  };

  const stopStream = () => {
    clearInterval(recordingTimerRef.current);
    if (videoPreviewRef.current) videoPreviewRef.current.srcObject = null;
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
  };

  const enterRecordingStep = () => {
    setStep('recording');
    startRecording();
  };

  const stopAndCompare = () => {
    if (
      !mediaRecorderRef.current ||
      mediaRecorderRef.current.state === 'inactive'
    ) {
      stopStream();
      return;
    }
    setStep('comparing');
    mediaRecorderRef.current.onstop = async () => {
      stopStream();
      const blob = new Blob(recordedChunksRef.current, { type: 'video/webm' });
      const key = `liveness_${Date.now()}`;
      try {
        await idbSave(key, blob);
        setSavedVideoKey(key);
        setSavedVideoUrl(URL.createObjectURL(blob));
      } catch (err) {
        console.error('[Recording] IDB save error:', err);
      }
      await runCompare(blob);
    };
    mediaRecorderRef.current.stop();
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Compare API
  // ─────────────────────────────────────────────────────────────────────────
  const runCompare = async (blob) => {
    if (!referenceFile?.fullUrl) {
      setCompareError(
        'No reference image selected — please select one and retry',
      );
      setStep('done');
      return;
    }
    try {
      setCompareLoading(true);
      setCompareError('');
      setCompareResult(null);
      const result = await verifyVideo(referenceFile.fullUrl, blob);
      setCompareResult(result?.data?.raw);
    } catch (err) {
      console.error('[Compare] Error:', err);
      setCompareError(
        err?.response?.data?.message || err.message || 'Comparison failed',
      );
    } finally {
      setCompareLoading(false);
      setStep('done');
    }
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Reset
  // ─────────────────────────────────────────────────────────────────────────
  const handleReset = () => {
    stopStream();
    setStep('liveness');
    setLivenessResult(null);
    setRecordingDuration(0);
    setCompareResult(null);
    setCompareError('');
    setSavedVideoUrl(null);
    setSavedVideoKey(null);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {}
  };

  const handleSelectReference = (file) => {
    setReferenceFile(file);
    setOpenDialog(false);
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Step indicator helpers
  // ─────────────────────────────────────────────────────────────────────────
  const activeStepKey = step === 'liveness_done' ? 'liveness' : step;
  const activeIdx = STEPS.findIndex((s) => s.key === activeStepKey);

  // ─────────────────────────────────────────────────────────────────────────
  // File card
  // ─────────────────────────────────────────────────────────────────────────
  const renderFileCard = (file, { selected = false, onClick }) => (
    <div
      key={file.url}
      onClick={onClick}
      className={`border-2 rounded-lg p-3 cursor-pointer transition hover:shadow-md ${
        selected
          ? 'border-blue-500 bg-blue-50'
          : 'border-gray-200 hover:border-gray-300'
      }`}
    >
      <div className='flex items-center gap-2 mb-1'>
        {file.ext === 'pdf' ? (
          <PictureAsPdfIcon className='text-red-500' fontSize='small' />
        ) : (
          <ImageIcon className='text-blue-500' fontSize='small' />
        )}
        <span className='text-xs font-medium text-gray-700 truncate'>
          {file.name}
        </span>
      </div>
      {file.ext !== 'pdf' && file.fullUrl && (
        <img
          src={file.fullUrl}
          alt={file.name}
          className='w-full h-20 object-contain rounded mt-1'
        />
      )}
    </div>
  );

  // ─────────────────────────────────────────────────────────────────────────
  // Reference picker box
  // ─────────────────────────────────────────────────────────────────────────
  const renderReferenceBox = () => {
    if (!referenceFile) {
      return (
        <div
          onClick={() => setOpenDialog(true)}
          className='border-2 border-dashed border-gray-300 rounded-xl text-center text-gray-500 h-[200px] flex flex-col items-center justify-center cursor-pointer hover:bg-gray-50 transition'
        >
          <FolderOpenIcon
            className='text-gray-400 mb-2'
            style={{ fontSize: 36 }}
          />
          <p className='font-medium text-sm'>Click to select Reference Image</p>
          <p className='text-xs mt-1'>
            Choose a photo from your recent uploads
          </p>
        </div>
      );
    }
    return (
      <div
        onClick={() => setOpenDialog(true)}
        className='border-2 border-green-500 bg-green-50 rounded-xl h-[200px] cursor-pointer hover:shadow-md transition flex flex-col overflow-hidden'
      >
        {referenceFile.ext === 'pdf' ? (
          <div className='flex flex-col items-center justify-center h-full gap-2 p-4'>
            <PictureAsPdfIcon
              className='text-red-500'
              style={{ fontSize: 40 }}
            />
            <p className='text-sm font-medium text-gray-700'>
              {referenceFile.name}
            </p>
          </div>
        ) : (
          <img
            src={referenceFile.fullUrl}
            alt={referenceFile.name}
            className='w-full h-full object-contain'
          />
        )}
      </div>
    );
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Step content
  // ─────────────────────────────────────────────────────────────────────────
  const renderContent = () => {
    // ── LIVENESS: splash + start button → detector ───────────────────────
    if (step === 'liveness') {
      return (
        <div className='border-2 border-blue-400 rounded-xl overflow-hidden'>
          <div className='bg-blue-50 px-4 py-3 border-b border-blue-100 flex items-center gap-2'>
            <ShieldIcon className='text-blue-600' fontSize='small' />
            <span className='text-sm font-semibold text-blue-700'>
              Step 1 of 3 — Liveness Check
            </span>
          </div>
          {/* Renders splash.html + single "Start Liveness Check" button,
              then swaps in FaceLivenessDetectorComponent (PassiveActive). */}
          <LivenessWrapper
            onComplete={handleLivenessComplete}
            onError={handleLivenessError}
          />
        </div>
      );
    }

    // ── LIVENESS DONE: result card + proceed/retry ───────────────────────
    if (step === 'liveness_done') {
      const passed = livenessResult?.decision === 'realface';
      return (
        <div
          className={`border-2 rounded-xl overflow-hidden ${passed ? 'border-green-400' : 'border-red-400'}`}
        >
          <div
            className={`px-4 py-3 border-b flex items-center gap-2 ${passed ? 'bg-green-50 border-green-100' : 'bg-red-50 border-red-100'}`}
          >
            {passed ? (
              <CheckCircleIcon className='text-green-600' fontSize='small' />
            ) : (
              <ErrorIcon className='text-red-500' fontSize='small' />
            )}
            <span
              className={`text-sm font-semibold ${passed ? 'text-green-700' : 'text-red-700'}`}
            >
              Liveness Check — {passed ? 'Passed ✓' : 'Failed ✗'}
            </span>
          </div>

          <div className='p-6 flex flex-col items-center gap-5'>
            {/* Result card */}
            <div
              className={`w-full max-w-sm rounded-xl px-5 py-4 flex items-center gap-4 ${passed ? 'bg-green-50 border border-green-200' : 'bg-red-50 border border-red-200'}`}
            >
              <div
                className={`w-12 h-12 rounded-full flex items-center justify-center flex-shrink-0 ${passed ? 'bg-green-100' : 'bg-red-100'}`}
              >
                {passed ? (
                  <CheckCircleIcon
                    className='text-green-600'
                    style={{ fontSize: 28 }}
                  />
                ) : (
                  <ErrorIcon
                    className='text-red-500'
                    style={{ fontSize: 28 }}
                  />
                )}
              </div>
              <div>
                <p
                  className={`font-bold text-base ${passed ? 'text-green-800' : 'text-red-800'}`}
                >
                  {passed ? 'Real Face Confirmed' : 'Liveness Check Failed'}
                </p>
                <p
                  className={`text-xs mt-0.5 ${passed ? 'text-green-600' : 'text-red-500'}`}
                >
                  {passed
                    ? 'Identity verified as a live person'
                    : 'Could not confirm liveness. Please try again.'}
                </p>
              </div>
            </div>

            {/* Detail row */}
            {livenessResult && (
              <div className='w-full max-w-sm bg-gray-50 border border-gray-200 rounded-lg px-4 py-3 text-xs text-gray-600 font-mono space-y-1'>
                <p className='font-semibold text-gray-500 text-[11px] uppercase tracking-wide mb-1'>
                  Result Details
                </p>
                <p>
                  Liveness:{' '}
                  <span className='text-gray-800'>
                    {livenessResult.livenessText ||
                      livenessResult.decision ||
                      '—'}
                  </span>
                </p>
                {livenessResult.withVerify && (
                  <p>
                    Recognition:{' '}
                    <span className='text-gray-800'>
                      {livenessResult.recognitionText || '—'}
                    </span>
                  </p>
                )}
              </div>
            )}

            {/* CTA */}
            <div className='flex gap-3 mt-1'>
              {passed ? (
                <button
                  onClick={enterRecordingStep}
                  className='flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white font-semibold px-6 py-2.5 rounded-lg transition cursor-pointer text-sm shadow'
                >
                  Next: Select Reference & Record
                  <ArrowForwardIcon fontSize='small' />
                </button>
              ) : (
                <button
                  onClick={handleReset}
                  className='flex items-center gap-2 bg-gray-700 hover:bg-gray-800 text-white font-semibold px-6 py-2.5 rounded-lg transition cursor-pointer text-sm'
                >
                  <ReplayIcon fontSize='small' />
                  Retry Liveness Check
                </button>
              )}
            </div>
          </div>
        </div>
      );
    }

    // ── RECORDING: reference picker + live camera side by side ───────────
    if (step === 'recording') {
      return (
        <div className='border-2 border-green-500 rounded-xl overflow-hidden'>
          <div className='bg-green-50 px-4 py-3 border-b border-green-100 flex items-center justify-between'>
            <div className='flex items-center gap-2'>
              <VerifiedUserIcon className='text-green-600' fontSize='small' />
              <span className='text-sm font-semibold text-green-700'>
                Step 2 of 3 — Select Reference & Record Video
              </span>
            </div>
            <Chip
              icon={<FiberManualRecordIcon />}
              label={fmt(recordingDuration)}
              size='small'
              sx={{
                bgcolor: '#ef4444',
                color: 'white',
                fontSize: 11,
                height: 22,
                '& .MuiChip-icon': { color: 'white' },
              }}
            />
          </div>

          <div className='p-4 grid grid-cols-1 md:grid-cols-2 gap-4'>
            {/* Left: reference */}
            <div>
              <p className='text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2'>
                Reference Image
              </p>
              {referenceFile && (
                <div className='mb-2'>
                  <Chip
                    icon={<CheckCircleIcon />}
                    label={referenceFile.name}
                    size='small'
                    color='success'
                    onDelete={() => setReferenceFile(null)}
                  />
                </div>
              )}
              {renderReferenceBox()}
            </div>

            {/* Right: live camera */}
            <div>
              <p className='text-xs font-semibold text-gray-500 uppercase tracking-wide mb-2'>
                Live Camera
              </p>
              <div
                className='relative bg-black rounded-xl overflow-hidden'
                style={{ height: 200 }}
              >
                <video
                  ref={videoPreviewRef}
                  autoPlay
                  muted
                  playsInline
                  className='w-full h-full object-cover'
                />
                <div className='absolute top-3 left-3 flex items-center gap-1.5 bg-black/60 text-white text-xs px-2 py-1 rounded-full'>
                  <span className='w-2 h-2 rounded-full bg-red-500 animate-pulse' />
                  REC {fmt(recordingDuration)}
                </div>
              </div>
            </div>
          </div>

          <div className='px-4 py-3 bg-gray-50 border-t border-gray-100 flex items-center justify-between'>
            <p className='text-xs text-gray-500'>
              ✅ Liveness verified — recording with audio
            </p>
            <button
              onClick={stopAndCompare}
              className='flex items-center gap-1.5 bg-red-600 hover:bg-red-700 text-white text-sm font-semibold px-5 py-2 rounded-lg transition cursor-pointer'
            >
              <StopCircleIcon fontSize='small' />
              Stop & Compare
            </button>
          </div>
        </div>
      );
    }

    // ── COMPARING ────────────────────────────────────────────────────────
    if (step === 'comparing') {
      return (
        <div className='border-2 border-blue-300 rounded-xl overflow-hidden'>
          <div className='bg-blue-50 px-4 py-3 border-b border-blue-100'>
            <span className='text-sm font-semibold text-blue-700'>
              Step 3 of 3 — Comparing…
            </span>
          </div>
          <div className='flex flex-col items-center justify-center gap-4 py-16'>
            <CircularProgress size={40} />
            <p className='text-sm font-medium text-gray-500'>
              Sending video to comparison API…
            </p>
            <LinearProgress sx={{ width: '60%' }} />
          </div>
        </div>
      );
    }

    // ── DONE ─────────────────────────────────────────────────────────────
    if (step === 'done') {
      const passed = livenessResult?.decision === 'realface';
      return (
        <div className='space-y-4'>
          {/* Summary card */}
          <div className='border-2 border-gray-200 rounded-xl overflow-hidden'>
            <div className='bg-gray-50 px-4 py-3 border-b border-gray-100 flex items-center justify-between'>
              <span className='text-sm font-semibold text-gray-700'>
                Verification Complete
              </span>
              <button
                onClick={handleReset}
                className='flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 cursor-pointer'
              >
                <ReplayIcon fontSize='inherit' /> Start Over
              </button>
            </div>
            <div className='p-4 space-y-3'>
              {/* Liveness badge */}
              <div
                className={`flex items-center gap-2 text-sm font-medium px-3 py-2 rounded-lg ${passed ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'}`}
              >
                {passed ? (
                  <>
                    <CheckCircleIcon fontSize='small' /> Liveness: Real Face
                    Confirmed
                  </>
                ) : (
                  <>
                    <ErrorIcon fontSize='small' /> Liveness: Failed
                  </>
                )}
              </div>

              {/* Recorded video */}
              {savedVideoUrl && (
                <div>
                  <p className='text-xs text-gray-500 mb-1 font-medium'>
                    Recorded Video
                  </p>
                  <video
                    src={savedVideoUrl}
                    controls
                    className='w-full rounded-lg'
                    style={{ maxHeight: 200 }}
                  />
                  <a
                    href={savedVideoUrl}
                    download='kyc_recording.webm'
                    className='text-xs text-blue-500 hover:underline mt-1 block'
                  >
                    Download recording
                  </a>
                </div>
              )}

              {compareError && (
                <Alert severity='error' onClose={() => setCompareError('')}>
                  {compareError}
                </Alert>
              )}
            </div>
          </div>

          {/* Comparison results — shown below on the same page */}
          <div>
            <h3 className='text-sm font-semibold text-gray-600 mb-2'>
              Comparison Results
            </h3>
            {compareLoading ? (
              <div className='flex flex-col items-center gap-3 py-8 text-gray-500'>
                <HourglassEmptyIcon style={{ fontSize: 40 }} />
                <p className='text-sm'>Analyzing video…</p>
                <LinearProgress sx={{ width: '60%' }} />
              </div>
            ) : compareResult ? (
              <RenderResults data={compareResult} />
            ) : !compareError ? (
              <div className='text-sm text-gray-400 text-center py-6 border-2 border-dashed border-gray-200 rounded-xl'>
                Waiting for result…
              </div>
            ) : null}
          </div>
        </div>
      );
    }

    return null;
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Render
  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div className='p-4 space-y-6'>
      {/* ── Header + step indicator (unchanged) ── */}
      <div className='flex items-center justify-between'>
        <div>
          <h2 className='text-xl font-bold text-gray-800'>Video KYC</h2>
          <div className='flex items-center gap-1 mt-1'>
            {STEPS.map((s, i) => {
              const isActive = s.key === activeStepKey;
              const isComplete = i < activeIdx;
              return (
                <React.Fragment key={s.key}>
                  <span
                    className={`text-xs px-2 py-0.5 rounded-full font-medium ${
                      isActive
                        ? 'bg-blue-600 text-white'
                        : isComplete
                          ? 'bg-green-100 text-green-700'
                          : 'bg-gray-100 text-gray-400'
                    }`}
                  >
                    {s.label}
                  </span>
                  {i < STEPS.length - 1 && (
                    <span className='text-gray-300 text-xs'>→</span>
                  )}
                </React.Fragment>
              );
            })}
          </div>
        </div>
        <button
          onClick={handleReset}
          className='text-xs text-red-500 hover:text-red-700 border border-red-200 px-3 py-1 rounded-lg cursor-pointer'
        >
          Reset
        </button>
      </div>

      {/* ── Main content ── */}
      {renderContent()}

      {/* ── File picker dialog ── */}
      <Dialog
        onClose={() => setOpenDialog(false)}
        maxWidth='md'
        fullWidth
        open={openDialog}
      >
        <DialogTitle>Select Reference Image</DialogTitle>
        <DialogContent>
          {loadingFiles ? (
            <div className='flex justify-center py-8'>
              <CircularProgress />
              <span className='ml-2 text-sm text-gray-500'>Loading files…</span>
            </div>
          ) : availableFiles.reference.length === 0 ? (
            <div className='text-center py-8 text-gray-500'>
              <ImageIcon
                style={{ fontSize: 48 }}
                className='text-gray-300 mb-2'
              />
              <p className='font-medium'>No reference images uploaded yet</p>
              <p className='text-sm'>Go to the Upload page to add files</p>
            </div>
          ) : (
            <div className='grid grid-cols-2 sm:grid-cols-3 gap-3 mt-2'>
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
