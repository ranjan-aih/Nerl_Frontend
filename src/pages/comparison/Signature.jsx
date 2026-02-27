// src/pages/Signature.jsx
import React, { useEffect, useState } from 'react';
import { API_BASE_URL, getRecentUploads } from '../../api/uploadApi';
import { verifySignature } from '../../api/comparisonApi';

import { LiaFileSignatureSolid } from 'react-icons/lia';

import {
  Button,
  CircularProgress,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';

import FolderOpenIcon from '@mui/icons-material/FolderOpen';

// 🔹 LocalStorage key
const STORAGE_KEY = 'signatureComparisonState';

const normalizeUrl = (url) => {
  if (!url) return null;
  if (url.startsWith('http')) return url;
  return `${API_BASE_URL}${url}`;
};

const extractPath = (fullUrl) => {
  if (!fullUrl) return null;
  if (fullUrl.startsWith('/temp/')) return fullUrl;

  try {
    const url = new URL(fullUrl);
    return url.pathname;
  } catch {
    const match = fullUrl.match(/\/temp\/.+/);
    return match ? match[0] : null;
  }
};

export default function Signature() {
  // Selected files
  const [referenceFile, setReferenceFile] = useState(null);
  const [providedFiles, setProvidedFiles] = useState([]);

  const [currentProvidedIndex, setCurrentProvidedIndex] = useState(0);

  // Available files from backend
  const [availableFiles, setAvailableFiles] = useState({
    reference: [],
    provided: [],
  });

  // Dialog state
  const [openDialog, setOpenDialog] = useState(false);
  const [dialogType, setDialogType] = useState('reference'); // 'reference' | 'provided'
  const [loadingFiles, setLoadingFiles] = useState(false);

  // For multi-select in provided dialog
  const [tempProvidedSelection, setTempProvidedSelection] = useState([]); // array of urls

  // Comparison state
  const [compareResult, setCompareResult] = useState(null);
  const [compareLoading, setCompareLoading] = useState(false);
  const [compareError, setCompareError] = useState('');

  // Hydration status
  const [isHydrated, setIsHydrated] = useState(false);

  // 🔹 Load available signature files from backend
  const loadAvailableFiles = async () => {
    setLoadingFiles(true);
    try {
      const res = await getRecentUploads();

      if (res?.success) {
        let { referenceFiles = [], providedFiles = [], files = [] } = res;

        if (
          !referenceFiles.length &&
          !providedFiles.length &&
          Array.isArray(files)
        ) {
          // Fallback: split by kind field
          referenceFiles = files.filter(
            (f) =>
              f.kind === 'reference' ||
              f.kind === 'refrence' || // typo-safe
              f.kind === 'signature_reference',
          );
          providedFiles = files.filter(
            (f) => f.kind === 'provided' || f.kind === 'signature_provided',
          );
        }

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
          kind: f.kind,
        });

        setAvailableFiles({
          reference: referenceFiles.map(mapFile),
          provided: providedFiles.map(mapFile),
        });
      }
    } catch (err) {
      console.error('Error loading signature files:', err);
    } finally {
      setLoadingFiles(false);
    }
  };

  useEffect(() => {
    loadAvailableFiles();
  }, []);

  // 🔹 HYDRATE from localStorage on mount
  useEffect(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (!saved) {
        setIsHydrated(true);
        return;
      }

      const parsed = JSON.parse(saved);

      if (parsed.referenceFile) {
        const hydratedRef = {
          ...parsed.referenceFile,
          uploadedAt: parsed.referenceFile.uploadedAt
            ? new Date(parsed.referenceFile.uploadedAt).toISOString()
            : null,
        };
        setReferenceFile(hydratedRef);
      }

      if (Array.isArray(parsed.providedFiles)) {
        const hydratedProvided = parsed.providedFiles.map((f) => ({
          ...f,
          uploadedAt: f.uploadedAt
            ? new Date(f.uploadedAt).toISOString()
            : null,
        }));
        setProvidedFiles(hydratedProvided);
      }

      if (typeof parsed.currentProvidedIndex === 'number') {
        setCurrentProvidedIndex(parsed.currentProvidedIndex);
      }

      if (parsed.compareResult) {
        setCompareResult(parsed.compareResult);
      }

      setIsHydrated(true);
    } catch (err) {
      console.error(
        'Error loading signature comparison state from localStorage:',
        err,
      );
      setIsHydrated(true);
    }
  }, []);

  // 🔹 Reconstruct providedFiles from compareResult if empty but results exist
  useEffect(() => {
    if (
      isHydrated &&
      providedFiles.length === 0 &&
      compareResult &&
      compareResult.raw_response &&
      compareResult.raw_response.files
    ) {
      const filenamesFromResult = compareResult.raw_response.files.map(
        (f) => f.filename,
      );

      const reconstructed = availableFiles.provided.filter((f) =>
        filenamesFromResult.some(
          (fn) => f.name === fn || f.name.includes(fn.split('-')[0]),
        ),
      );

      if (reconstructed.length > 0) {
        setProvidedFiles(reconstructed);
      }
    }
  }, [
    availableFiles.provided,
    providedFiles.length,
    compareResult,
    isHydrated,
  ]);

  // 🔹 Re-validate providedFiles URLs after availableFiles loads
  useEffect(() => {
    if (
      providedFiles.length > 0 &&
      availableFiles.provided.length > 0 &&
      isHydrated
    ) {
      const updatedProvided = providedFiles.map((oldFile) => {
        const freshFile = availableFiles.provided.find(
          (f) => f.url === oldFile.url,
        );
        if (freshFile) {
          return {
            ...oldFile,
            fullUrl: freshFile.fullUrl,
            path: freshFile.path,
          };
        }
        return oldFile;
      });
      if (JSON.stringify(updatedProvided) !== JSON.stringify(providedFiles)) {
        setProvidedFiles(updatedProvided);
      }
    }
  }, [availableFiles.provided, providedFiles.length, isHydrated]);

  // 🔹 PERSIST to localStorage whenever key state changes
  useEffect(() => {
    if (!isHydrated) return;

    try {
      const stateToPersist = {
        referenceFile: referenceFile
          ? {
              ...referenceFile,
              uploadedAt: referenceFile.uploadedAt,
            }
          : null,
        providedFiles: providedFiles.map((f) => ({
          ...f,
          uploadedAt: f.uploadedAt,
        })),
        currentProvidedIndex,
        compareResult,
      };

      localStorage.setItem(STORAGE_KEY, JSON.stringify(stateToPersist));
    } catch (err) {
      console.error(
        'Error saving signature comparison state to localStorage:',
        err,
      );
    }
  }, [
    referenceFile,
    providedFiles,
    currentProvidedIndex,
    compareResult,
    isHydrated,
  ]);

  // Open dialog
  const handleOpenDialog = (type) => {
    setDialogType(type);

    if (type === 'provided') {
      const currentUrls = Array.isArray(providedFiles)
        ? providedFiles.map((f) => f.url)
        : [];
      setTempProvidedSelection(currentUrls);
    }

    setOpenDialog(true);
  };

  // Reference selection (single)
  const handleSelectReference = (file) => {
    setReferenceFile(file);
    setOpenDialog(false);
  };

  // Toggle provided selection (multi)
  const handleToggleProvidedSelection = (file) => {
    setTempProvidedSelection((prev) => {
      const newSelection = prev.includes(file.url)
        ? prev.filter((u) => u !== file.url)
        : [...prev, file.url];
      return newSelection;
    });
  };

  // Confirm provided selected files
  const handleConfirmProvidedSelection = () => {
    const selectedFiles = availableFiles.provided.filter((f) =>
      tempProvidedSelection.includes(f.url),
    );
    setProvidedFiles(selectedFiles);
    setCurrentProvidedIndex(0);
    setOpenDialog(false);
  };

  // Reset carousel index if provided list changes
  useEffect(() => {
    if (!providedFiles.length) {
      setCurrentProvidedIndex(0);
      return;
    }
    if (currentProvidedIndex >= providedFiles.length) {
      setCurrentProvidedIndex(0);
    }
  }, [providedFiles]);

  const handleCompare = async () => {
    if (!referenceFile) {
      setCompareError('Please select a reference signature');
      return;
    }

    if (!providedFiles.length) {
      setCompareError('Please select at least one provided signature');
      return;
    }

    try {
      setCompareLoading(true);
      setCompareError('');
      setCompareResult(null);

      const providedUrls = providedFiles.map((f) => f.fullUrl);

      const res = await verifySignature(referenceFile.fullUrl, providedUrls);

      setCompareResult(res.data);
    } catch (err) {
      console.error('❌ Error comparing signatures:', err);
      let errorMsg = 'Failed to compare signatures';

      if (err.code === 'ECONNABORTED') {
        errorMsg =
          'Request timed out. The images may be too large or the server is taking too long to process.';
      } else if (err.response) {
        errorMsg =
          err.response?.data?.message || err.response?.data?.error || errorMsg;
      } else if (err.message) {
        errorMsg = err.message;
      }

      setCompareError(errorMsg);
    } finally {
      setCompareLoading(false);
    }
  };

  // ---------- UI HELPERS ----------

  const Spinner = ({ size = 20 }) => (
    <div
      className='border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin'
      style={{ width: size, height: size }}
    />
  );

  const renderFileCard = (file, { selected = false, onClick }) => {
    const isPdf = file.ext === 'pdf';

    return (
      <div
        onClick={onClick}
        className={`h-40 w-40 flex flex-col border rounded-lg overflow-hidden cursor-pointer transition-transform shadow-sm ${
          selected
            ? 'border-blue-600 shadow-md scale-[1.02]'
            : 'border-gray-200 hover:shadow-md hover:scale-[1.02]'
        }`}
      >
        <div className='h-32 bg-gray-50 flex items-center justify-center overflow-hidden'>
          {isPdf ? (
            <span className='text-[32px] text-red-600'>📄</span>
          ) : (
            <img
              src={file.fullUrl}
              alt={file.name}
              className='max-w-full max-h-full object-cover'
            />
          )}
        </div>
        <div className='px-2 py-1.5 flex-1 flex items-center'>
          <p className='w-full text-center font-semibold truncate text-[16px]'>
            {file.name}
          </p>
        </div>
      </div>
    );
  };

  // Reference box (left)
  const renderReferenceBox = () => {
    if (!referenceFile) {
      return (
        <div
          onClick={() => handleOpenDialog('reference')}
          className='border-2 border-dashed border-gray-300 rounded-xl text-center text-gray-500 h-[260px] flex flex-col items-center justify-center cursor-pointer hover:bg-gray-50 transition'
        >
          {/* <span className='text-[32px] mb-2'> </span>  */}
          <LiaFileSignatureSolid size={40} />
          <p className='mt-1 font-semibold text-[18px]'>
            Click here to select Reference Signature
          </p>
          <p className='mt-1 text-gray-500 text-[16px]'>
            Choose one signature from your recent uploads
          </p>
        </div>
      );
    }

    const isPdf = referenceFile.ext === 'pdf';

    return (
      <div
        onClick={() => handleOpenDialog('reference')}
        className='border-2 border-green-500 bg-green-50 rounded-xl h-[260px] cursor-pointer hover:shadow-md transition flex flex-col'
      >
        {isPdf ? (
          <div className='flex-1 flex flex-col items-center justify-center gap-2 px-3'>
            <span className='text-[32px] text-red-600'>📄</span>
            <p className='font-semibold text-center text-[18px]'>
              {referenceFile.name}
            </p>
            <a
              href={referenceFile.fullUrl}
              target='_blank'
              rel='noreferrer'
              className='mt-1 inline-flex items-center rounded-md border border-green-600 px-3 py-1 font-medium text-green-700 hover:bg-green-100 text-[16px]'
              onClick={(e) => e.stopPropagation()}
            >
              Open PDF
            </a>
          </div>
        ) : (
          <div className='flex-1 flex flex-col items-center justify-center px-3'>
            <img
              src={referenceFile.fullUrl}
              alt={referenceFile.name}
              className='w-full max-w-xs h-[190px] object-contain rounded-lg'
            />
            <p className='mt-2 font-semibold text-center truncate w-full text-[18px]'>
              {referenceFile.name}
            </p>
          </div>
        )}
      </div>
    );
  };

  // Provided box (right, multi + carousel)
  const renderProvidedBox = () => {
    if (!isHydrated && providedFiles.length === 0) {
      return (
        <div className='border-2 border-dashed border-gray-300 rounded-xl text-center text-gray-500 h-[260px] flex flex-col items-center justify-center'>
          <Spinner size={24} />
          <p className='mt-2 text-[16px]'>Loading selections...</p>
        </div>
      );
    }

    if (!providedFiles.length) {
      return (
        <div
          onClick={() => handleOpenDialog('provided')}
          className='border-2 border-dashed border-gray-300 rounded-xl text-center text-gray-500 h-[260px] flex flex-col items-center justify-center cursor-pointer hover:bg-gray-50 transition'
        >
          {/* <span className='text-[32px] mb-2'>📁</span> */}
          <LiaFileSignatureSolid size={40} />
          <p className='mt-1 font-semibold text-[18px]'>
            Click here to select Provided Signatures
          </p>
          <p className='mt-1 text-gray-500 text-[16px]'>
            You can select multiple signatures from your uploads
          </p>
        </div>
      );
    }

    const total = providedFiles.length;
    const current = providedFiles[currentProvidedIndex];
    const isPdf = current.ext === 'pdf';

    const goPrev = (e) => {
      e.stopPropagation();
      setCurrentProvidedIndex((idx) => (idx - 1 + total) % total);
    };

    const goNext = (e) => {
      e.stopPropagation();
      setCurrentProvidedIndex((idx) => (idx + 1) % total);
    };

    return (
      <div
        onClick={() => handleOpenDialog('provided')}
        className='border-2 border-blue-500 bg-blue-50 rounded-xl h-[260px] cursor-pointer hover:shadow-md transition flex flex-col relative overflow-hidden'
      >
        <div className='flex-1 flex flex-col items-center justify-center px-3 pt-2'>
          {isPdf ? (
            <>
              <span className='text-[32px] text-red-600 mb-1'>📄</span>
              <p className='font-semibold text-center px-2 truncate w-full text-[18px]'>
                {current.name}
              </p>
            </>
          ) : (
            <>
              <img
                src={current.fullUrl}
                alt={current.name}
                className='w-full max-w-xs h-[180px] object-contain rounded-lg'
              />
              <p className='mt-2 font-semibold text-center px-2 truncate w-full text-[18px]'>
                {current.name}
              </p>
            </>
          )}
        </div>

        <div className='flex items-center justify-center pb-1'>
          <p className='font-semibold text-blue-900 text-[16px]'>
            {currentProvidedIndex + 1} / {total} signature
            {total > 1 ? 's' : ''}
          </p>
        </div>

        {total > 1 && (
          <>
            <button
              onClick={goPrev}
              className='absolute left-2 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white rounded-full w-8 h-8 flex items-center justify-center shadow text-[18px]'
            >
              ‹
            </button>

            <button
              onClick={goNext}
              className='absolute right-2 top-1/2 -translate-y-1/2 bg-white/80 hover:bg-white rounded-full w-8 h-8 flex items-center justify-center shadow text-[18px]'
            >
              ›
            </button>
          </>
        )}
      </div>
    );
  };

  // 🔍 Comparison result renderer (uses structured compareResult.signatures)
  const renderComparisonResults = () => {
    if (!compareResult) return null;

    const signatures = compareResult.signatures || [];
    const raw = compareResult.raw_response || {};
    const totalCost = compareResult.totalCost ?? raw.total_cost ?? null;

    if (!signatures.length) {
      return (
        <div className='text-center py-8'>
          <p className='text-[16px] text-gray-500'>
            No signatures were analyzed in this comparison.
          </p>
        </div>
      );
    }

    // Group by fileIndex + filename
    const fileGroupsMap = {};
    signatures.forEach((sig) => {
      const fileIndex = sig.fileIndex ?? 0;
      const filename = sig.filename || `Document ${fileIndex + 1}`;
      const key = `${fileIndex}-${filename}`;
      if (!fileGroupsMap[key]) {
        fileGroupsMap[key] = {
          fileIndex,
          filename,
          signatures: [],
        };
      }
      fileGroupsMap[key].signatures.push(sig);
    });

    const fileGroups = Object.values(fileGroupsMap).sort(
      (a, b) => (a.fileIndex ?? 0) - (b.fileIndex ?? 0),
    );

    // Best match across all
    const bestMatch = signatures.reduce((best, sig) => {
      if (sig.confidence == null) return best;
      if (!best || sig.confidence > best.confidence) return sig;
      return best;
    }, null);

    const isBestAccepted = !!(
      bestMatch &&
      (bestMatch.match || bestMatch.status?.toLowerCase() === 'accepted')
    );

    const renderBulletList = (items) => {
      if (!Array.isArray(items) || items.length === 0) return null;
      return (
        <ul className='space-y-2 list-disc pl-5 text-[16px] text-gray-700'>
          {items.map((item, idx) => (
            <li key={idx}>
              {typeof item === 'string' ? (
                item
              ) : (
                <div>
                  {item.region && (
                    <p className='font-semibold text-gray-800 text-[16px]'>
                      {item.region}
                    </p>
                  )}
                  {item.description && (
                    <p className='text-gray-600 text-[16px]'>
                      {item.description}
                    </p>
                  )}
                </div>
              )}
            </li>
          ))}
        </ul>
      );
    };

    const renderDifferences = (diffs) => {
      if (!Array.isArray(diffs) || diffs.length === 0) return null;
      return (
        <div className='bg-white rounded-lg p-3 border border-red-200'>
          <p className='font-semibold text-red-700 mb-2 text-[18px]'>
            Key Differences:
          </p>
          <ul className='space-y-2 list-disc pl-5 text-[16px] text-gray-700'>
            {diffs.map((diff, idx) => {
              if (typeof diff !== 'object' || diff === null) {
                return <li key={idx}>{String(diff)}</li>;
              }
              const description = diff.description || '';
              const mainKey = Object.keys(diff).find(
                (k) => k !== 'description',
              );
              const mainValue = mainKey ? diff[mainKey] : '';
              return (
                <li key={idx}>
                  {mainKey && mainValue && (
                    <p className='font-medium text-red-800 text-[16px]'>
                      {mainKey.replace(/_/g, ' ').toUpperCase()}: {mainValue}
                    </p>
                  )}
                  {description && (
                    <p className='text-gray-600 text-[16px]'>{description}</p>
                  )}
                </li>
              );
            })}
          </ul>
        </div>
      );
    };

    const renderStrokes = (strokes, title) => {
      if (!Array.isArray(strokes)) return null;
      return (
        <div className='rounded-lg p-3 border bg-white'>
          <p className='font-semibold text-gray-800 mb-2 text-[18px]'>
            {title}
          </p>
          <ul className='space-y-2 text-gray-700 text-[16px]'>
            {strokes.map((stroke, idx) => (
              <li key={idx}>
                <p className='font-semibold'>
                  {stroke.stroke
                    ? `Stroke ${stroke.stroke}:`
                    : `Stroke ${idx + 1}:`}
                </p>
                <p className='text-gray-700'>
                  {stroke.description || 'No description available'}
                </p>
                {(stroke.start_point || stroke.start) && (
                  <p className='text-gray-600'>
                    Start:{' '}
                    {Array.isArray(stroke.start_point)
                      ? stroke.start_point.join(', ')
                      : stroke.start?.join(', ')}
                    {stroke.end_point || stroke.end
                      ? ` → End: ${
                          Array.isArray(stroke.end_point)
                            ? stroke.end_point.join(', ')
                            : stroke.end?.join(', ')
                        }`
                      : ''}
                  </p>
                )}
                {stroke.missing && (
                  <p className='font-semibold text-red-600 mt-1'>
                    ⚠️ Missing in document
                  </p>
                )}
              </li>
            ))}
          </ul>
        </div>
      );
    };

    return (
      <div className='space-y-6'>
        {/* Overall best match banner */}
        {bestMatch && (
          <div className='rounded-2xl border-2 p-5 shadow-sm border-gray-200 bg-gray-50'>
            <div className='flex flex-col gap-4 md:flex-row md:items-start'>
              <div className='flex items-center justify-center md:mt-1'>
                <div
                  className={`flex h-12 w-12 items-center justify-center rounded-full text-[24px] ${
                    isBestAccepted
                      ? 'bg-green-100 text-green-700'
                      : 'bg-red-100 text-red-700'
                  }`}
                >
                  {isBestAccepted ? '✔' : '✖'}
                </div>
              </div>

              <div className='flex-1 space-y-2'>
                <p className='font-semibold text-gray-800 text-[20px]'>
                  {isBestAccepted
                    ? 'Signature Verified'
                    : 'Signature Mismatch Detected'}
                </p>
                <div className='flex flex-wrap items-center gap-2 text-gray-600 text-[16px]'>
                  <span className='font-semibold'>Document :</span>
                  <span className='inline-flex items-center rounded-full bg-white px-3 py-1 font-semibold text-gray-700 shadow-sm border border-gray-200 text-[16px]'>
                    {bestMatch.filename}
                  </span>
                </div>
              </div>

              <div className='flex flex-col gap-2 min-w-[150px]'>
                <div className='flex items-center gap-2 text-gray-600 text-[16px]'>
                  <span className='font-semibold'>Status:</span>
                  <span
                    className={`inline-flex items-center rounded-full px-3 py-1 font-semibold text-[16px] ${
                      isBestAccepted
                        ? 'bg-green-100 text-green-700'
                        : 'bg-red-100 text-red-700'
                    }`}
                  >
                    {(bestMatch.status || 'UNKNOWN').toUpperCase()}
                  </span>
                </div>
                <div className='flex items-center gap-2 text-gray-600 text-[16px]'>
                  <span className='font-semibold'>Confidence:</span>
                  <span
                    className={`font-bold text-[20px] ${
                      isBestAccepted ? 'text-green-700' : 'text-red-700'
                    }`}
                  >
                    {bestMatch.confidence != null
                      ? `${bestMatch.confidence.toFixed(2)}%`
                      : 'N/A'}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Per-file details */}
        <div>
          <p className='font-semibold text-gray-800 mb-3 text-[20px]'>
            Detailed Analysis ({fileGroups.length} document
            {fileGroups.length !== 1 ? 's' : ''})
          </p>

          {fileGroups.map((file) => {
            const hasSignatures = file.signatures.length > 0;
            const bestForFile = file.signatures.reduce((acc, sig) => {
              if (sig.confidence == null) return acc;
              if (!acc || sig.confidence > acc.confidence) return sig;
              return acc;
            }, null);

            return (
              <details
                key={`${file.fileIndex}-${file.filename}`}
                className='mb-3 rounded-xl border border-gray-200 bg-white shadow-sm'
                open={hasSignatures}
              >
                <summary className='flex cursor-pointer flex-col gap-2 px-4 py-3 sm:flex-row sm:items-center sm:justify-between'>
                  <div className='flex items-center gap-2'>
                    <span className='text-[22px]'>🧾</span>
                    <p className='font-semibold text-gray-800 text-[18px]'>
                      {file.filename}
                    </p>
                  </div>
                  <div className='flex flex-wrap items-center gap-2 text-[16px]'>
                    <span className='inline-flex items-center rounded-full border border-gray-300 px-3 py-1 font-semibold text-gray-700 bg-gray-50'>
                      {file.signatures.length} signature
                      {file.signatures.length !== 1 ? 's' : ''} found
                    </span>
                    {bestForFile && (
                      <span
                        className={`inline-flex items-center rounded-full px-3 py-1 font-semibold text-[16px] ${
                          bestForFile.match ||
                          bestForFile.status?.toLowerCase() === 'accepted'
                            ? 'bg-green-100 text-green-700'
                            : 'bg-red-100 text-red-700'
                        }`}
                      >
                        Confidence:{' '}
                        {bestForFile.confidence?.toFixed(1) ?? 'N/A'}%
                      </span>
                    )}
                  </div>
                </summary>

                <div className='border-t border-gray-200 px-4 py-3'>
                  {!hasSignatures ? (
                    <div className='py-6 text-center text-[16px] text-gray-500'>
                      <div className='text-[28px] mb-2'>✒️</div>
                      <p>No signatures detected in this document</p>
                    </div>
                  ) : (
                    <div className='space-y-4'>
                      {file.signatures.map((sig, idx) => {
                        const report = sig.report || {};
                        const strokePoints = report.strokePoints || {};
                        const accepted =
                          sig.match || sig.status?.toLowerCase() === 'accepted';
                        const isRefPdf = referenceFile?.ext === 'pdf';

                        return (
                          <div
                            key={sig.signatureIndex ?? idx}
                            className={`w-full rounded-xl p-4 ${
                              accepted
                                ? 'bg-green-50 border border-green-200'
                                : 'bg-red-50 border border-red-200'
                            }`}
                          >
                            {/* Signature header */}
                            <div className='flex items-center justify-between border-b border-gray-300 pb-2 mb-3'>
                              <p className='font-semibold text-gray-800 text-[18px]'>
                                Signature #{(sig.signatureIndex ?? idx) + 1}
                              </p>
                              <span
                                className={`inline-flex items-center rounded-full px-3 py-1 font-semibold text-[16px] ${
                                  accepted
                                    ? 'bg-green-100 text-green-700'
                                    : 'bg-red-100 text-red-700'
                                }`}
                              >
                                {(sig.status || 'UNKNOWN').toUpperCase()}
                              </span>
                            </div>

                            {/* Images (Reference + Document) and Confidence */}
                            <div className='flex flex-col gap-10 lg:flex-row lg:items-start'>
                              <div className='flex flex-col items-center gap-1'>
                                <p className='font-semibold text-gray-800 text-[16px]'>
                                  Reference
                                </p>
                                {referenceFile ? (
                                  isRefPdf ? (
                                    <div className='w-32 h-32 rounded-lg bg-white border border-gray-300 flex items-center justify-center shadow-sm'>
                                      <span className='text-[32px] text-red-600'>
                                        📄
                                      </span>
                                    </div>
                                  ) : (
                                    <div className='w-[200px] h-32 rounded-lg overflow-hidden bg-white border border-gray-300 flex items-center justify-center shadow-sm'>
                                      <img
                                        src={referenceFile.fullUrl}
                                        alt='Reference Signature'
                                        className='w-full h-full object-contain p-1'
                                      />
                                    </div>
                                  )
                                ) : (
                                  <div className='w-32 h-32 rounded-lg bg-gray-200 flex items-center justify-center text-[16px] text-gray-500'>
                                    No reference
                                  </div>
                                )}
                              </div>

                              {/* Document / Provided Signature */}
                              <div className='flex flex-col items-center gap-1'>
                                <p className='font-semibold text-gray-800 text-[16px]'>
                                  Extracted Signature
                                </p>
                                {sig.analysisImage ? (
                                  <div className='w-[200px] h-32 rounded-lg overflow-hidden bg-white border border-gray-300 flex items-center justify-center shadow-sm'>
                                    <img
                                      src={sig.analysisImage}
                                      alt={`Signature ${
                                        (sig.signatureIndex ?? idx) + 1
                                      }`}
                                      className='w-full h-full object-contain p-1'
                                    />
                                  </div>
                                ) : (
                                  <div className='w-32 h-32 rounded-lg bg-gray-200 flex items-center justify-center text-[16px] text-gray-500'>
                                    No preview
                                  </div>
                                )}
                              </div>

                              {/* Confidence card */}
                              <div className='flex flex-col justify-center items-center'>
                                <p className='font-semibold text-gray-800 text-[16px]'>
                                  Results
                                </p>
                                <div className='w-[200px] h-32 rounded-lg bg-white p-3 shadow-sm'>
                                  <p className='mb-1 text-gray-600 text-[16px] font-semibold'>
                                    Confidence Score
                                  </p>
                                  <p
                                    className={`font-bold text-[24px] ${
                                      accepted
                                        ? 'text-green-700'
                                        : 'text-red-700'
                                    }`}
                                  >
                                    {sig.confidence != null
                                      ? `${sig.confidence.toFixed(2)}%`
                                      : 'N/A'}
                                  </p>
                                </div>
                              </div>
                            </div>

                            {/* Analysis report */}
                            {(report.pixelDifferences ||
                              strokePoints.differences ||
                              strokePoints.reference_signature ||
                              strokePoints.document_signature) && (
                              <div className='mt-4 space-y-3'>
                                {/* Pixel Differences */}
                                {Array.isArray(report.pixelDifferences) &&
                                  report.pixelDifferences.length > 0 && (
                                    <details className='rounded-lg border border-gray-200 bg-white'>
                                      <summary className='cursor-pointer px-3 py-2 font-semibold text-gray-800 text-[18px]'>
                                        Pixel Differences (
                                        {report.pixelDifferences.length})
                                      </summary>
                                      <div className='border-t border-gray-200 px-3 py-2'>
                                        {renderBulletList(
                                          report.pixelDifferences,
                                        )}
                                      </div>
                                    </details>
                                  )}

                                {/* Stroke Points Analysis */}
                                {Object.keys(strokePoints).length > 0 && (
                                  <details className='rounded-lg border border-gray-200 bg-white'>
                                    <summary className='cursor-pointer px-3 py-2 font-semibold text-gray-800 text-[18px]'>
                                      Stroke Analysis
                                    </summary>
                                    <div className='border-t border-gray-200 px-3 py-3 space-y-3'>
                                      {strokePoints.differences &&
                                        renderDifferences(
                                          strokePoints.differences,
                                        )}

                                      {strokePoints.reference_signature &&
                                        renderStrokes(
                                          strokePoints.reference_signature,
                                          'Reference Signature Strokes',
                                        )}

                                      {strokePoints.document_signature &&
                                        renderStrokes(
                                          strokePoints.document_signature,
                                          'Document Signature Strokes',
                                        )}
                                    </div>
                                  </details>
                                )}
                              </div>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </details>
            );
          })}
        </div>

        {/* totalCost is available but intentionally not shown in UI */}
        {totalCost != null && false && (
          <p className='text-right text-gray-400 text-[16px]'>
            Total analysis cost: {totalCost.toFixed(4)}
          </p>
        )}
      </div>
    );
  };

  const fileList =
    dialogType === 'reference'
      ? availableFiles.reference
      : availableFiles.provided;

  return (
    <div className='w-full px-4 py-2 md:px-10'>
      {/* Title */}
      <h2 className='mb-4 text-center font-semibold text-gray-700 text-[24px]'>
        Signature Comparison
      </h2>

      {/* Selection section */}
      <div className='mb-4 grid grid-cols-1 gap-4 rounded-2xl bg-white p-4 shadow-md md:grid-cols-2 md:p-6'>
        {/* Reference */}
        <div>
          <div className='mb-2 flex items-center justify-between'>
            <div className='flex items-center gap-2'>
              <p className='font-semibold text-[18px]'>Reference Signature</p>
              {referenceFile && (
                <span className='text-green-600 text-[18px]'>✔</span>
              )}
            </div>
          </div>
          {renderReferenceBox()}
        </div>

        {/* Provided */}
        <div>
          <div className='mb-2 flex items-center justify-between'>
            <div className='flex items-center gap-2'>
              <p className='font-semibold text-[18px]'>Provided Signatures</p>
              {providedFiles.length > 0 && (
                <span className='text-green-600 text-[18px]'>✔</span>
              )}
            </div>

            {providedFiles.length > 0 && (
              <Button
                size='small'
                variant='text'
                onClick={() => handleOpenDialog('provided')}
                startIcon={<FolderOpenIcon />}
                sx={{ textTransform: 'none', fontSize: 12, px: 1 }}
              >
                Add
              </Button>
            )}
          </div>
          {renderProvidedBox()}
        </div>
      </div>

      {/* Compare button */}
      <div className='mb-4 text-center'>
        <button
          type='button'
          disabled={!referenceFile || !providedFiles.length || compareLoading}
          onClick={handleCompare}
          className={`inline-flex items-center gap-2 rounded-full px-8 py-3 font-semibold text-white shadow-md transition text-[18px] ${
            !referenceFile || !providedFiles.length || compareLoading
              ? 'cursor-not-allowed bg-gray-400'
              : 'bg-blue-600 hover:bg-blue-700 cursor-pointer'
          }`}
        >
          {compareLoading ? <Spinner size={20} /> : <span>⇄</span>}
          {compareLoading ? 'Comparing...' : 'Compare Now'}
        </button>
      </div>

      {/* Error */}
      {compareError && (
        <div className='mb-3 flex items-center justify-between rounded-md border border-red-200 bg-red-50 px-3 py-2 text-red-700 text-[16px]'>
          <span>{compareError}</span>
          <button
            type='button'
            onClick={() => setCompareError('')}
            className='ml-2 font-semibold text-[16px]'
          >
            ✕
          </button>
        </div>
      )}

      {/* Result section */}
      <div className='rounded-xl bg-white px-4 py-4 shadow-md'>
        <p className='mb-2 font-semibold text-gray-800 text-[20px]'>
          Comparison Results
        </p>

        {compareLoading && (
          <div className='py-6 text-center'>
            {/* <Spinner size={28} /> */}
            <p className='mt-2 text-gray-600 text-[16px]'>
              Analyzing signatures...
            </p>
          </div>
        )}

        {!compareLoading && compareResult ? (
          renderComparisonResults()
        ) : !compareLoading && !compareResult ? (
          <p className='py-3 text-center text-gray-500 text-[16px]'>
            Select a reference signature and one or more provided signatures,
            then click{' '}
            <span className='font-semibold'>&quot;Compare Now&quot;</span>.
          </p>
        ) : null}
      </div>

      {/* File selection dialog (custom modal) */}
      {openDialog && (
        <div className='fixed inset-0 z-50 flex items-center justify-center bg-black/40'>
          <div className='flex max-h-[80vh] w-full max-w-4xl flex-col rounded-xl bg-white shadow-lg'>
            <div className='flex items-center justify-between border-b px-4 py-3'>
              <h3 className='font-semibold text-gray-800 text-[18px]'>
                Select {dialogType === 'reference' ? 'Reference' : 'Provided'}{' '}
                Signature
                {dialogType === 'provided'
                  ? ` (Selected: ${tempProvidedSelection.length})`
                  : ''}
              </h3>
              <button
                type='button'
                onClick={() => setOpenDialog(false)}
                className='text-[20px] leading-none text-gray-500 hover:text-gray-800'
              >
                ×
              </button>
            </div>

            <div className='flex-1 overflow-y-auto px-4 py-3'>
              {loadingFiles ? (
                <div className='py-6 text-center text-gray-600 text-[16px]'>
                  <div className='flex justify-center mb-2'>
                    <Spinner size={24} />
                  </div>
                  <p>Loading files...</p>
                </div>
              ) : fileList.length === 0 ? (
                <div className='py-6 text-center text-gray-500 text-[16px]'>
                  <div className='text-[32px] mb-2'>📄</div>
                  <p>No {dialogType} signatures uploaded yet</p>
                  <p className='mt-1 text-gray-400 text-[16px]'>
                    Go to Upload page to upload files
                  </p>
                </div>
              ) : (
                <div className='mt-2 grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4'>
                  {fileList.map((file) => {
                    if (dialogType === 'reference') {
                      return (
                        <div key={file.url}>
                          {renderFileCard(file, {
                            selected: referenceFile?.url === file.url,
                            onClick: () => handleSelectReference(file),
                          })}
                        </div>
                      );
                    }

                    const isSelected = tempProvidedSelection.includes(file.url);
                    return (
                      <div key={file.url}>
                        {renderFileCard(file, {
                          selected: isSelected,
                          onClick: () => handleToggleProvidedSelection(file),
                        })}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className='flex items-center justify-end gap-2 border-t px-4 py-3'>
              <button
                type='button'
                className='rounded-md px-3 py-1.5 font-medium text-gray-700 hover:bg-gray-100 text-[16px]'
                onClick={() => setOpenDialog(false)}
              >
                Close
              </button>
              <button
                type='button'
                className='rounded-md px-3 py-1.5 font-medium text-blue-700 hover:bg-blue-50 text-[16px]'
                onClick={loadAvailableFiles}
              >
                Refresh Files
              </button>
              {dialogType === 'provided' && (
                <button
                  type='button'
                  disabled={!tempProvidedSelection.length}
                  onClick={handleConfirmProvidedSelection}
                  className={`rounded-md px-3 py-1.5 font-semibold text-white text-[16px] ${
                    !tempProvidedSelection.length
                      ? 'cursor-not-allowed bg-gray-400'
                      : 'bg-blue-600 hover:bg-blue-700'
                  }`}
                >
                  Confirm Selection ({tempProvidedSelection.length})
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
