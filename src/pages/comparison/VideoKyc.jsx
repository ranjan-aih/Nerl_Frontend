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
import StopCircleIcon from '@mui/icons-material/StopCircle';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';

import FaceLivenessDetector from '../../components/FaceLivenessDetector';
import RenderResults from './RenderResults';
import { API_BASE_URL, getRecentUploads } from '../../api/uploadApi';
import { verifyVideo } from '../../api/comparisonApi';

// ─── Constants ────────────────────────────────────────────────────────────────
const STORAGE_KEY = 'videoKycState';
const IDB_DB = 'LivenessVideoDB';
const IDB_STORE = 'recordings';

const fmt = (s) =>
  `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;

const normalizeUrl = (url) => {
  if (!url) return null;
  return url.startsWith('http') ? url : `${API_BASE_URL}${url}`;
};
const extractPath = (u) => {
  if (!u) return null;
  if (u.startsWith('/temp/')) return u;
  try {
    return new URL(u).pathname;
  } catch {
    return u.match(/\/temp\/.+/)?.[0] || null;
  }
};

// ─── IndexedDB ────────────────────────────────────────────────────────────────
const idbOpen = () =>
  new Promise((res, rej) => {
    const r = indexedDB.open(IDB_DB, 1);
    r.onupgradeneeded = (e) => e.target.result.createObjectStore(IDB_STORE);
    r.onsuccess = (e) => res(e.target.result);
    r.onerror = rej;
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

// ─── Steps ────────────────────────────────────────────────────────────────────
// step: 'liveness' | 'video' | 'comparing' | 'done'
const STEPS = [
  { key: 'liveness', label: 'Liveness Check' },
  { key: 'video', label: 'Record & Compare' },
  { key: 'done', label: 'Results' },
];
const STEP_IDX = { liveness: 0, video: 1, comparing: 1, done: 2 };

// ─────────────────────────────────────────────────────────────────────────────
export default function VideoKyc() {
  // ── page step ──────────────────────────────────────────────────────────────
  const [step, setStep] = useState('liveness');

  // ── liveness ───────────────────────────────────────────────────────────────
  const [livenessResult, setLivenessResult] = useState(null); // null | result obj
  const [livenessKey, setLivenessKey] = useState(0); // increment to remount

  // ── recording ──────────────────────────────────────────────────────────────
  const [recordingDuration, setRecordingDuration] = useState(0);
  const [savedVideoUrl, setSavedVideoUrl] = useState(null);
  const [savedVideoKey, setSavedVideoKey] = useState(null);

  // ── files ──────────────────────────────────────────────────────────────────
  const [referenceFile, setReferenceFile] = useState(null);
  const [availableFiles, setAvailableFiles] = useState({ reference: [] });
  const [openDialog, setOpenDialog] = useState(false);
  const [loadingFiles, setLoadingFiles] = useState(false);

  // ── comparison ─────────────────────────────────────────────────────────────
  const [compareResult, setCompareResult] = useState(null);

  const [compareLoading, setCompareLoading] = useState(false);
  const [compareError, setCompareError] = useState('');

  // ── hydration ──────────────────────────────────────────────────────────────
  const [isHydrated, setIsHydrated] = useState(false);

  // ── refs ───────────────────────────────────────────────────────────────────
  const streamRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const recordedChunksRef = useRef([]);
  const recordingTimerRef = useRef(null);
  const videoPreviewRef = useRef(null);
  const resultSectionRef = useRef(null); // scroll target for results

  // ── init ───────────────────────────────────────────────────────────────────
  useEffect(() => {
    loadAvailableFiles();
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const p = JSON.parse(saved);
        if (p.referenceFile) setReferenceFile(p.referenceFile);
        if (p.savedVideoKey) {
          setSavedVideoKey(p.savedVideoKey);
          idbLoad(p.savedVideoKey)
            .then((b) => {
              if (b) setSavedVideoUrl(URL.createObjectURL(b));
            })
            .catch(console.error);
        }
      }
    } catch {
    } finally {
      setIsHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!isHydrated) return;
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ referenceFile, savedVideoKey }),
      );
    } catch {}
  }, [referenceFile, savedVideoKey, isHydrated]);

  useEffect(() => () => stopStream(), []);

  // ── files ──────────────────────────────────────────────────────────────────
  const loadAvailableFiles = async () => {
    setLoadingFiles(true);
    try {
      const res = await getRecentUploads();
      if (res?.success) {
        const mapFile = (f) => ({
          name: f.name || f.storedName || 'Unnamed',
          url: f.url,
          fullUrl: normalizeUrl(f.url),
          path: extractPath(normalizeUrl(f.url)),
          size: f.size,
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
    } catch (e) {
      console.error(e);
    } finally {
      setLoadingFiles(false);
    }
  };

  // ── liveness ───────────────────────────────────────────────────────────────
  const handleLivenessComplete = (result) => {
    setLivenessResult(result);
    if (result.decision === 'realface') {
      setStep('video'); // go straight to Record & Compare
    }
  };

  const handleLivenessError = (error) => {
    setLivenessResult({
      decision: 'error',
      status: 'failed',
      livenessText: error,
    });
  };
  //   const handleLivenessRetry = () => {
  //     setLivenessResult(null);
  //     setLivenessKey((k) => k + 1); // remount SDK
  //   };
  //   const handleNextToVideo = () => {
  //     setStep('video');
  //   };

  // ── recording ──────────────────────────────────────────────────────────────
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
    } catch {
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
      } catch (e) {
        console.error(e);
      }
      await runCompare(blob);
    };
    mediaRecorderRef.current.stop();
  };

  // ── compare ────────────────────────────────────────────────────────────────
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

      setCompareResult(result?.data?.data);

      console.log('data in CompareResult state', result?.data?.data);
    } catch (err) {
      setCompareError(
        err?.response?.data?.message || err.message || 'Comparison failed',
      );
    } finally {
      setCompareLoading(false);
      setStep('done');
      // scroll to results
      setTimeout(
        () => resultSectionRef.current?.scrollIntoView({ behavior: 'smooth' }),
        100,
      );
    }
  };

  // ── reset ──────────────────────────────────────────────────────────────────
  const handleReset = () => {
    stopStream();
    setStep('liveness');
    setLivenessResult(null);
    setLivenessKey((k) => k + 1);
    setRecordingDuration(0);
    setCompareResult(null);
    setCompareError('');
    setSavedVideoUrl(null);
    setSavedVideoKey(null);
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {}
  };

  // ── step indicator ─────────────────────────────────────────────────────────
  const renderStepIndicator = () => {
    const current = STEP_IDX[step];
    return (
      <div className='flex items-center gap-1.5'>
        {STEPS.map((s, i) => {
          const isDone = i < current,
            isActive = i === current;
          return (
            <React.Fragment key={s.key}>
              <div className='flex items-center gap-1.5'>
                <div
                  className={`w-6 h-6 rounded-full flex items-center justify-center text-[16px] font-bold transition-all ${
                    isDone
                      ? 'bg-green-500 text-white'
                      : isActive
                        ? 'bg-blue-600 text-white'
                        : 'bg-gray-200 text-gray-400'
                  }`}
                >
                  {isDone ? '✓' : i + 1}
                </div>
                <span
                  className={`text-md font-semibold hidden sm:inline ${
                    isActive
                      ? 'text-blue-600'
                      : isDone
                        ? 'text-green-600'
                        : 'text-gray-400'
                  }`}
                >
                  {s.label}
                </span>
              </div>
              {i < STEPS.length - 1 && (
                <div
                  className={`h-px w-5 sm:w-8 ${i < current ? 'bg-green-400' : 'bg-gray-200'}`}
                />
              )}
            </React.Fragment>
          );
        })}
      </div>
    );
  };

  // ── file card ──────────────────────────────────────────────────────────────
  const renderFileCard = (file, { selected, onClick }) => (
    <div
      key={file.url}
      onClick={onClick}
      className={`border-2 rounded-lg p-3 cursor-pointer transition hover:shadow-md ${selected ? 'border-blue-500 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}`}
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

  // ──────────────────────────────────────────────────────────────────────────
  // RENDER
  // ──────────────────────────────────────────────────────────────────────────
  return (
    <div className='min-h-full  mx-6 rounded-2xl bg-white'>
      <div className='max-w-full h-full px-4 py-6 space-y-6'>
        {/* ── HEADER — always visible ──────────────────────────────────────── */}
        <div className='flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3'>
          <div>
            <h1 className='text-2xl font-bold text-gray-800'>Video KYC</h1>
            <p className='text-xs text-gray-400 mt-0.5'>
              Complete liveness check, then record and compare your video
            </p>
          </div>
          <div className='flex items-center gap-12'>
            {renderStepIndicator()}
            <button
              onClick={handleReset}
              className='text-sm text-red-500 hover:text-red-700 border-2 border-red-200 bg-white px-3 py-0.5 rounded-md cursor-pointer whitespace-nowrap'
            >
              Reset
            </button>
          </div>
        </div>

        <div className='border-t border-gray-200' />

        {/* ══════════════════════════════════════════════════════════════════ */}
        {/* STEP 1 — LIVENESS                                                 */}
        {/* ══════════════════════════════════════════════════════════════════ */}
        {step === 'liveness' && (
          <div className='space-y-4 h-full'>
            <div className='bg-white rounded-2xl border-gray-100 shadow-sm overflow-hidden'>
              <FaceLivenessDetector
                key={livenessKey}
                onComplete={handleLivenessComplete}
                onError={handleLivenessError}
                mode='PassiveActive'
              />
            </div>

            {/* Result card — appears BELOW the component after SDK finishes */}
            {/* {livenessResult && (
              <div
                className={`rounded-2xl border-2 p-6 ${
                  livenessResult.decision === 'realface'
                    ? 'border-green-400 bg-green-50'
                    : 'border-red-400 bg-red-50'
                }`}
              >
                <div className='flex items-center gap-3 mb-4'>
                  {livenessResult.decision === 'realface' ? (
                    <CheckCircleIcon
                      style={{ fontSize: 40, color: '#22c55e' }}
                    />
                  ) : (
                    <ErrorIcon style={{ fontSize: 40, color: '#ef4444' }} />
                  )}
                  <div>
                    <p
                      className={`text-lg font-bold ${livenessResult.decision === 'realface' ? 'text-green-700' : 'text-red-700'}`}
                    >
                      {livenessResult.decision === 'realface'
                        ? 'Liveness Verified!'
                        : 'Liveness Failed'}
                    </p>
                    <p
                      className={`text-sm ${livenessResult.decision === 'realface' ? 'text-green-600' : 'text-red-600'}`}
                    >
                      {livenessResult.livenessText ||
                        (livenessResult.decision === 'realface'
                          ? 'Real person detected'
                          : 'Could not verify liveness')}
                    </p>
                  </div>
                </div>

                <div className='flex gap-3'>
                  <button
                    onClick={handleLivenessRetry}
                    className='flex items-center gap-1.5 border border-gray-300 hover:border-gray-400 bg-white text-gray-700 text-sm font-semibold px-4 py-2 rounded-xl transition cursor-pointer'
                  >
                    <ReplayIcon fontSize='small' /> Retry
                  </button>
                  {livenessResult.decision === 'realface' && (
                    <button
                      onClick={handleNextToVideo}
                      className='flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold px-5 py-2 rounded-xl transition cursor-pointer shadow'
                    >
                      Next: Record Video <ArrowForwardIcon fontSize='small' />
                    </button>
                  )}
                </div>
              </div>
            )} */}
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════ */}
        {/* STEP 2 — RECORD + REFERENCE IMAGE                                 */}
        {/* ══════════════════════════════════════════════════════════════════ */}
        {(step === 'video' || step === 'comparing' || step === 'done') && (
          <div className='space-y-5'>
            {/* Liveness passed banner */}
            <div className='flex items-center gap-2 bg-green-50 border border-green-200 rounded-xl px-4 py-2.5 text-sm text-green-700 font-medium'>
              <VerifiedUserIcon fontSize='small' />
              Liveness verified ✓ — now select a reference image and record your
              video
            </div>

            {/* Two column: reference image | camera */}
            <div className='grid grid-cols-1 md:grid-cols-2 gap-5'>
              {/* ── Reference image ─────────────────────────────────────── */}
              <div className='bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-2'>
                <div className='flex items-center justify-between'>
                  <h3 className='text-sm font-semibold text-gray-700'>
                    Reference Image
                  </h3>
                  {referenceFile && (
                    <Chip
                      icon={<CheckCircleIcon />}
                      label={referenceFile.name}
                      size='small'
                      color='success'
                      onDelete={() => setReferenceFile(null)}
                    />
                  )}
                </div>

                {!referenceFile ? (
                  <div
                    onClick={() => setOpenDialog(true)}
                    className='border-2 border-dashed border-gray-300 rounded-xl h-56 flex flex-col items-center justify-center cursor-pointer hover:bg-gray-50 transition text-gray-500 text-center'
                  >
                    <FolderOpenIcon
                      style={{ fontSize: 40 }}
                      className='text-gray-300 mb-2'
                    />
                    <p className='text-sm font-medium'>
                      Click to select Reference Image
                    </p>
                    <p className='text-xs text-gray-400 mt-1'>
                      Choose from your recent uploads
                    </p>
                  </div>
                ) : (
                  <div
                    onClick={() => setOpenDialog(true)}
                    className='border-2 border-green-400 rounded-xl h-56 cursor-pointer hover:shadow-md transition overflow-hidden bg-green-50'
                  >
                    {referenceFile.ext === 'pdf' ? (
                      <div className='flex flex-col items-center justify-center h-full gap-2'>
                        <PictureAsPdfIcon
                          className='text-red-500'
                          style={{ fontSize: 48 }}
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
                )}
              </div>

              {/* ── Camera ──────────────────────────────────────────────── */}
              <div className='bg-white rounded-2xl border border-gray-100 shadow-sm p-4 space-y-2'>
                <h3 className='text-sm font-semibold text-gray-700'>
                  Record Video
                </h3>

                <div className='rounded-xl overflow-hidden border border-gray-200'>
                  {/* Preview */}
                  <div className='relative bg-gray-900' style={{ height: 310 }}>
                    <video
                      ref={videoPreviewRef}
                      autoPlay
                      muted
                      playsInline
                      className='w-full h-full object-cover'
                    />
                    {/* REC badge */}
                    {recordingDuration > 0 && (
                      <div className='absolute top-3 left-3 flex items-center gap-1.5 bg-black/60 text-white text-xs px-2.5 py-1 rounded-full'>
                        <span className='w-2 h-2 rounded-full bg-red-500 animate-pulse' />
                        REC {fmt(recordingDuration)}
                      </div>
                    )}
                    {/* Idle hint */}
                    {!streamRef.current && (
                      <div className='absolute inset-0 flex flex-col items-center justify-center text-gray-400'>
                        <FiberManualRecordIcon style={{ fontSize: 36 }} />
                        <p className='text-xs mt-2'>
                          Click Start Recording below
                        </p>
                      </div>
                    )}
                    {/* Comparing overlay */}
                    {step === 'comparing' && (
                      <div className='absolute inset-0 flex flex-col items-center justify-center bg-white/80 gap-3'>
                        <CircularProgress size={36} />
                        <p className='text-sm font-medium text-gray-600'>
                          Comparing…
                        </p>
                      </div>
                    )}
                  </div>

                  {/* Controls bar */}
                  <div className='px-4 py-3 bg-gray-50 border-t border-gray-100 flex items-center justify-between'>
                    {!streamRef.current ? (
                      <button
                        onClick={startRecording}
                        disabled={step === 'comparing' || step === 'done'}
                        className='flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white text-xs font-semibold px-4 py-2 rounded-lg transition cursor-pointer'
                      >
                        <FiberManualRecordIcon fontSize='small' />
                        Start Recording
                      </button>
                    ) : (
                      <>
                        <span className='text-xs text-gray-500 flex items-center gap-1.5'>
                          <span className='w-2 h-2 rounded-full bg-red-500 animate-pulse' />
                          Recording… {fmt(recordingDuration)}
                        </span>
                        <button
                          onClick={stopAndCompare}
                          className='flex items-center gap-1.5 bg-red-600 hover:bg-red-700 text-white text-xs font-semibold px-4 py-2 rounded-lg transition cursor-pointer'
                        >
                          <StopCircleIcon fontSize='small' />
                          Stop & Compare
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* ══════════════════════════════════════════════════════════════ */}
            {/* RESULTS — appear below on the same page after compare         */}
            {/* ══════════════════════════════════════════════════════════════ */}
            {(step === 'comparing' || step === 'done') && (
              <div ref={resultSectionRef} className='space-y-4 min-h-60'>
                <div className='border-t border-gray-200 pt-4'>
                  <h3 className='text-base font-bold text-gray-800 mb-3'>
                    Results
                  </h3>
                </div>

                {/* Status badges */}
                <div className='flex flex-wrap gap-3'>
                  <div
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border ${
                      livenessResult?.decision === 'realface'
                        ? 'bg-green-50 border-green-300 text-green-700'
                        : 'bg-red-50 border-red-300 text-red-700'
                    }`}
                  >
                    {livenessResult?.decision === 'realface' ? (
                      <>
                        <CheckCircleIcon fontSize='small' /> Liveness: Passed
                      </>
                    ) : (
                      <>
                        <ErrorIcon fontSize='small' /> Liveness: Failed
                      </>
                    )}
                  </div>
                  <div
                    className={`flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium border ${
                      step === 'comparing'
                        ? 'bg-blue-50 border-blue-200 text-blue-600'
                        : compareResult
                          ? 'bg-green-50 border-green-300 text-green-700'
                          : 'bg-gray-50 border-gray-200 text-gray-500'
                    }`}
                  >
                    {step === 'comparing' ? (
                      <>
                        <CircularProgress size={14} sx={{ mr: 0.5 }} />{' '}
                        Comparing…
                      </>
                    ) : compareResult ? (
                      <>
                        <CheckCircleIcon fontSize='small' /> Comparison:
                        Complete
                      </>
                    ) : (
                      <>
                        <ErrorIcon fontSize='small' /> Comparison: No result
                      </>
                    )}
                  </div>
                </div>

                {/* Comparing spinner */}
                {step === 'comparing' && <LinearProgress />}

                {/* Error */}
                {compareError && (
                  <Alert severity='error' onClose={() => setCompareError('')}>
                    {compareError}
                  </Alert>
                )}

                {/* Video + results side by side */}
                {step === 'done' && (
                  <div className='grid grid-cols-1'>
                    {/* {savedVideoUrl && (
                      <div className='bg-white rounded-2xl border border-gray-100 shadow-sm p-4'>
                        <p className='text-sm font-semibold text-gray-700 mb-2'>
                          Recorded Video
                        </p>
                        <video
                          src={savedVideoUrl}
                          controls
                          className='w-full rounded-xl border border-gray-100'
                          style={{ maxHeight: 200 }}
                        />
                        <a
                          href={savedVideoUrl}
                          download='kyc_recording.webm'
                          className='text-xs text-blue-500 hover:underline mt-2 block'
                        >
                          Download recording
                        </a>
                      </div>
                    )} */}
                    {compareResult && (
                      <div className='bg-white rounded-2xl border border-gray-100 shadow-sm p-4'>
                        <p className='text-sm font-semibold text-gray-700 mb-2'>
                          Comparison Results
                        </p>

                        {console.log(
                          'respose of pass to child ---> ',
                          compareResult,
                        )}
                        <RenderResults data={compareResult} />
                      </div>
                    )}
                  </div>
                )}

                {/* Start over */}
                {step === 'done' && (
                  <button
                    onClick={handleReset}
                    className='flex items-center gap-2 border border-gray-300 hover:border-gray-400 bg-white text-gray-700 text-sm font-semibold px-5 py-2.5 rounded-xl transition cursor-pointer'
                  >
                    <ReplayIcon fontSize='small' /> Start Over
                  </button>
                )}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── File picker dialog ───────────────────────────────────────────── */}
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
              <span className='ml-2 text-sm text-gray-500'>Loading…</span>
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
                    onClick: () => {
                      setReferenceFile(file);
                      setOpenDialog(false);
                    },
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
