import { useState, useEffect, useCallback } from 'react';
import { Alert, Button, CircularProgress, Chip } from '@mui/material';
import CompareArrowsIcon from '@mui/icons-material/CompareArrows';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import ImageIcon from '@mui/icons-material/Image';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';

import { API_BASE_URL, getRecentUploads } from '../../../api/uploadApi';
import { useLivenessSession } from './Uselivenesssession';
import LiveDetection from './LiveDetection';
import FilePickerDialog from './FilePickerDialog';

const BACKEND_BASE =
  import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000/api';
const STORAGE_KEY = 'videoComparisonState';

const normalizeUrl = (url) =>
  !url ? null : url.startsWith('http') ? url : `${API_BASE_URL}${url}`;

const mapFile = (f) => ({
  name: f.name || f.storedName || 'Unnamed',
  url: f.url,
  fullUrl: normalizeUrl(f.url),
  size: f.size,
  ext: (f.name || '').split('.').pop().toLowerCase(),
  type: f.type,
  slot: f.slot,
});

export default function VideoComparison() {
  const liveness = useLivenessSession();

  // ── File state ────────────────────────────────────────────────────────────
  const [referenceFile, setReferenceFile] = useState(null);
  const [providedFiles, setProvidedFiles] = useState([]);
  const [availableFiles, setAvailableFiles] = useState({
    reference: [],
    provided: [],
  });
  const [loadingFiles, setLoadingFiles] = useState(false);

  // ── Dialog state ──────────────────────────────────────────────────────────
  const [openDialog, setOpenDialog] = useState(false);
  const [dialogType, setDialogType] = useState('reference');
  const [tempProvidedSel, setTempProvidedSel] = useState([]);

  // ── Python comparison state ───────────────────────────────────────────────
  const [compareResult, setCompareResult] = useState(null);
  const [compareLoading, setCompareLoading] = useState(false);
  const [compareError, setCompareError] = useState('');

  // ─────────────────────────────────────────────────────────────────────────
  // Load available files
  // ─────────────────────────────────────────────────────────────────────────
  const loadAvailableFiles = useCallback(async () => {
    setLoadingFiles(true);
    try {
      const res = await getRecentUploads();
      if (res?.success) {
        const mapped = (res.files || []).map(mapFile);
        setAvailableFiles({
          reference: mapped.filter(
            (f) => f.slot === 'reference' && f.type === 'photo',
          ),
          provided: mapped.filter(
            (f) => f.slot === 'provided' && f.type === 'video',
          ),
        });
      }
    } catch (err) {
      console.error('Error loading files:', err);
    } finally {
      setLoadingFiles(false);
    }
  }, []);

  useEffect(() => {
    loadAvailableFiles();
  }, [loadAvailableFiles]);

  // ─────────────────────────────────────────────────────────────────────────
  // LocalStorage persistence
  // ─────────────────────────────────────────────────────────────────────────
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (!saved) return;
      const p = JSON.parse(saved);
      if (p.referenceFile) setReferenceFile(p.referenceFile);
      if (Array.isArray(p.providedFiles)) setProvidedFiles(p.providedFiles);
      if (p.compareResult) setCompareResult(p.compareResult);
    } catch {}
  }, []);

  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({ referenceFile, providedFiles, compareResult }),
      );
    } catch {}
  }, [referenceFile, providedFiles, compareResult]);

  // ─────────────────────────────────────────────────────────────────────────
  // Dialog handlers
  // ─────────────────────────────────────────────────────────────────────────
  const handleOpenDialog = (type) => {
    setDialogType(type);
    if (type === 'provided')
      setTempProvidedSel(providedFiles.map((f) => f.url));
    setOpenDialog(true);
  };

  const handleSelectReference = (file) => {
    setReferenceFile(file);
    setOpenDialog(false);
  };

  const handleToggleProvided = (file) =>
    setTempProvidedSel((prev) =>
      prev.includes(file.url)
        ? prev.filter((u) => u !== file.url)
        : [...prev, file.url],
    );

  const handleConfirmProvided = () => {
    setProvidedFiles(
      availableFiles.provided.filter((f) => tempProvidedSel.includes(f.url)),
    );
    setOpenDialog(false);
  };

  const handleClear = () => {
    setReferenceFile(null);
    setProvidedFiles([]);
    setCompareResult(null);
    setCompareError('');
    liveness.resetDetection();
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {}
  };

  // ─────────────────────────────────────────────────────────────────────────
  // Compare — sends recording + reference image to Python backend
  //
  // Priority:
  //   1. liveness.recordedBlob  (from the live SDK session)
  //   2. uploaded provided videos (fallback)
  // ─────────────────────────────────────────────────────────────────────────
  const handleCompare = useCallback(async () => {
    if (!referenceFile) {
      setCompareError('Please select a reference image');
      return;
    }

    const hasVideo = liveness.recordedBlob || providedFiles.length > 0;
    if (!hasVideo) {
      setCompareError(
        'Complete the liveness check (or select an uploaded video) first',
      );
      return;
    }

    try {
      setCompareLoading(true);
      setCompareError('');
      setCompareResult(null);

      // Fetch the reference image as a blob
      const refRes = await fetch(referenceFile.fullUrl);
      const refBlob = await refRes.blob();
      const refExt = referenceFile.name.split('.').pop() || 'jpg';

      const formData = new FormData();
      formData.append('reference_image', refBlob, `reference.${refExt}`);

      if (liveness.recordedBlob) {
        // Primary: live recording from the liveness session
        formData.append(
          'video',
          liveness.recordedBlob,
          'liveness_recording.webm',
        );
        console.log(
          '[Compare] Using live recording:',
          (liveness.recordedBlob.size / 1024).toFixed(0),
          'KB',
        );
      } else {
        // Fallback: fetch and append uploaded provided videos
        for (const f of providedFiles) {
          const vBlob = await (await fetch(f.fullUrl)).blob();
          formData.append('video', vBlob, f.name);
          console.log('[Compare] Using uploaded video:', f.name);
        }
      }

      const res = await fetch(`${BACKEND_BASE}/verify-video`, {
        method: 'POST',
        body: formData,
      });
      const data = await res.json();

      if (!res.ok)
        throw new Error(data.message || data.error || `HTTP ${res.status}`);

      setCompareResult(data);
    } catch (err) {
      console.error('[Compare] Error:', err);
      setCompareError(err.message || 'Failed to compare files');
    } finally {
      setCompareLoading(false);
    }
  }, [referenceFile, liveness.recordedBlob, providedFiles]);

  // ─────────────────────────────────────────────────────────────────────────
  // Derived booleans
  // ─────────────────────────────────────────────────────────────────────────
  const hasVideo = !!(liveness.recordedBlob || providedFiles.length > 0);
  const canCompare = !!referenceFile && hasVideo && !compareLoading;

  return (
    <div className='px-4 md:px-10 py-1 w-full'>
      {/* Title + Clear */}
      <div className='flex items-center justify-between mb-4'>
        <h2 className='font-semibold text-[22px] text-gray-700'>
          Video Comparison
        </h2>
        <Button
          size='small'
          variant='outlined'
          onClick={handleClear}
          sx={{ textTransform: 'none', fontSize: 12 }}
        >
          Clear
        </Button>
      </div>

      {/* SDK warning */}
      {!liveness.sdkLoaded && (
        <div className='mb-3'>
          <Alert severity='warning'>
            Azure AI Vision Face UI SDK not detected. Add to your HTML{' '}
            <code>&lt;head&gt;</code>:{' '}
            <code className='text-xs'>
              &lt;script
              src="https://unpkg.com/@azure/ai-vision-face-ui@latest/dist/azure-ai-vision-face-ui.js"&gt;&lt;/script&gt;
            </code>
          </Alert>
        </div>
      )}

      {/* ── Two-column grid ───────────────────────────────────────────────────── */}
      <div className='grid grid-cols-1 md:grid-cols-2 gap-4 bg-white rounded-2xl shadow-md p-4 md:p-6 mb-4'>
        {/* LEFT — Reference image */}
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

          {!referenceFile ? (
            <div
              onClick={() => handleOpenDialog('reference')}
              className='border-2 border-dashed border-gray-300 rounded-xl text-center text-gray-500 h-[315px] flex flex-col items-center justify-center cursor-pointer hover:bg-gray-50 transition'
            >
              <ImageIcon sx={{ fontSize: 48 }} />
              <p className='mt-2 text-sm font-semibold'>
                Click to select Reference Image
              </p>
              <p className='mt-1 text-xs'>
                Sent to Python backend for face comparison
              </p>
            </div>
          ) : (
            <div
              onClick={() => handleOpenDialog('reference')}
              className='border-2 border-green-500 bg-green-50 rounded-xl h-[260px] cursor-pointer hover:shadow-md transition flex flex-col'
            >
              {referenceFile.ext === 'pdf' ? (
                <div className='flex-1 flex flex-col items-center justify-center gap-2 px-3'>
                  <PictureAsPdfIcon
                    sx={{ fontSize: 48 }}
                    className='text-red-600'
                  />
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
          )}
        </div>

        {/* RIGHT — Live detection */}
        <div>
          <div className='flex items-center justify-between mb-2'>
            <div className='flex items-center gap-2'>
              <p className='font-semibold text-[16px]'>Live Verification</p>
              {liveness.status === 'success' && (
                <CheckCircleIcon
                  sx={{ fontSize: 18 }}
                  className='text-green-600'
                />
              )}
              {liveness.status === 'failed' && (
                <ErrorIcon sx={{ fontSize: 18 }} className='text-red-500' />
              )}
            </div>
            <Button
              size='small'
              variant='text'
              onClick={() => handleOpenDialog('provided')}
              startIcon={<FolderOpenIcon />}
              sx={{ textTransform: 'none', fontSize: 12, px: 1 }}
            >
              Use Uploaded Video
            </Button>
          </div>

          <LiveDetection
            sdkContainerRef={liveness.sdkContainerRef}
            sdkLoaded={liveness.sdkLoaded}
            status={liveness.status}
            statusMessage={liveness.statusMessage}
            statusType={liveness.statusType}
            livenessDecision={liveness.livenessDecision}
            livenessResult={liveness.livenessResult}
            rawAzureData={liveness.rawAzureData}
            isRecording={liveness.isRecording}
            recordedBlob={liveness.recordedBlob}
            recordingLabel={liveness.recordingLabel}
            startDetection={liveness.startDetection}
            stopDetection={liveness.stopDetection}
            resetDetection={liveness.resetDetection}
          />

          {/* Fallback: uploaded video chips */}
          {providedFiles.length > 0 && (
            <div className='mt-2 p-3 bg-blue-50 rounded-lg border border-blue-200'>
              <p className='text-xs text-blue-700 font-semibold mb-1'>
                {providedFiles.length} uploaded video
                {providedFiles.length > 1 ? 's' : ''} selected
                {liveness.recordedBlob
                  ? ' (ignored — live recording takes priority)'
                  : ' (used as fallback)'}
              </p>
              <div className='flex gap-2 flex-wrap'>
                {providedFiles.map((f) => (
                  <Chip
                    key={f.url}
                    label={f.name}
                    size='small'
                    onDelete={() =>
                      setProvidedFiles((p) => p.filter((x) => x.url !== f.url))
                    }
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Compare CTA ───────────────────────────────────────────────────────── */}
      <div className='mb-4 text-center'>
        <button
          type='button'
          disabled={!canCompare}
          onClick={handleCompare}
          className={`inline-flex items-center gap-2 rounded-full px-8 py-3 font-semibold text-white shadow-md transition text-[18px] ${
            !canCompare
              ? 'cursor-not-allowed bg-gray-400'
              : 'bg-blue-600 hover:bg-blue-700 cursor-pointer'
          }`}
        >
          {compareLoading ? (
            <CircularProgress size={20} sx={{ color: 'white' }} />
          ) : (
            <CompareArrowsIcon />
          )}
          {compareLoading ? 'Comparing…' : 'Compare Now'}
        </button>

        {/* Context hints */}
        {!referenceFile && (
          <p className='text-xs text-gray-400 mt-2'>
            Select a reference image to enable comparison
          </p>
        )}
        {referenceFile && !hasVideo && (
          <p className='text-xs text-gray-400 mt-2'>
            Complete the liveness check (or select an uploaded video) to compare
          </p>
        )}
        {referenceFile &&
          liveness.recordedBlob &&
          liveness.status !== 'success' && (
            <p className='text-xs text-amber-600 mt-2 font-medium'>
              ⚠️ Liveness not confirmed — recording still available for
              comparison
            </p>
          )}
        {referenceFile &&
          liveness.recordedBlob &&
          liveness.status === 'success' && (
            <p className='text-xs text-green-600 mt-2 font-medium'>
              ✅ Liveness confirmed — recording ready for Python comparison
            </p>
          )}
      </div>

      {/* Error */}
      {compareError && (
        <div className='mb-3'>
          <Alert severity='error' onClose={() => setCompareError('')}>
            {compareError}
          </Alert>
        </div>
      )}

      {/* ── Comparison results ────────────────────────────────────────────────── */}
      <div className='bg-white rounded-xl shadow-md px-4 py-4'>
        <p className='text-[18px] font-semibold mb-2'>Comparison Results</p>

        {compareLoading && (
          <div className='text-center py-6'>
            <CircularProgress />
            <p className='mt-2 text-sm text-gray-600'>
              Sending to Python service for analysis…
            </p>
          </div>
        )}

        {!compareLoading && !compareResult && (
          <p className='text-center text-sm text-gray-500 py-3'>
            Complete liveness detection, then click{' '}
            <span className='font-semibold'>"Compare Now"</span> to run Python
            analysis.
          </p>
        )}

        {!compareLoading && compareResult && (
          <CompareResultPanel result={compareResult} />
        )}
      </div>

      {/* File picker dialog */}
      <FilePickerDialog
        open={openDialog}
        dialogType={dialogType}
        fileList={
          dialogType === 'reference'
            ? availableFiles.reference
            : availableFiles.provided
        }
        selectedReferenceUrl={referenceFile?.url}
        tempSelection={tempProvidedSel}
        loadingFiles={loadingFiles}
        onClose={() => setOpenDialog(false)}
        onRefresh={loadAvailableFiles}
        onSelectReference={handleSelectReference}
        onToggleProvided={handleToggleProvided}
        onConfirmProvided={handleConfirmProvided}
      />
    </div>
  );
}

// ─── Python result panel ──────────────────────────────────────────────────────
function CompareResultPanel({ result }) {
  const { liveness_score, confidence_score, cost, image } = result;
  const isAccepted = confidence_score >= 80;

  return (
    <div className='space-y-6'>
      <div
        className={`flex flex-col md:flex-row md:items-center md:justify-between gap-4 rounded-xl border-2 p-4 ${
          isAccepted
            ? 'bg-green-50 border-green-500'
            : 'bg-red-50 border-red-500'
        }`}
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
          {liveness_score != null && (
            <p>
              Liveness:{' '}
              <span className='text-purple-700'>
                {liveness_score?.toFixed(2)}%
              </span>
            </p>
          )}
          {cost != null && (
            <p>
              Cost: <span className='text-gray-700'>${cost}</span>
            </p>
          )}
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
}
