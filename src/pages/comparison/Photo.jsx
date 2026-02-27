import React, { useEffect, useState } from 'react';
import {
  Button,
  CircularProgress,
  Alert,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';

import { IoChevronUpOutline } from 'react-icons/io5';
import { IoChevronDownOutline } from 'react-icons/io5';

import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';

import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import CompareArrowsIcon from '@mui/icons-material/CompareArrows';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import ErrorIcon from '@mui/icons-material/Error';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import ImageIcon from '@mui/icons-material/Image';

import { API_BASE_URL, getRecentUploads } from '../../api/uploadApi';
import { verifyPhoto } from '../../api/comparisonApi';

// 🔹 LocalStorage key
const STORAGE_KEY = 'photoComparisonState';

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

export default function Photo() {
  // Selected files
  const [referenceFile, setReferenceFile] = useState(null);
  const [providedFiles, setProvidedFiles] = useState([]);

  // we keep this even if UI no longer uses it heavily (for future-proofing)
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

  // 🔹 Hydration status
  const [isHydrated, setIsHydrated] = useState(false);

  // 🔹 NEW: expansion state for files and photos
  const [expandedFiles, setExpandedFiles] = useState({});
  const [expandedPhotos, setExpandedPhotos] = useState({});

  const toggleFileExpanded = (fileKey) => {
    setExpandedFiles((prev) => ({
      ...prev,
      [fileKey]: !prev[fileKey],
    }));
  };

  const togglePhotoExpanded = (photoKey) => {
    setExpandedPhotos((prev) => ({
      ...prev,
      [photoKey]: !prev[photoKey],
    }));
  };

  // 🔹 Load available files from backend
  const loadAvailableFiles = async () => {
    setLoadingFiles(true);
    try {
      const res = await getRecentUploads();

      console.log('res ---> ', res);

      if (res?.success) {
        const { referenceFiles = [], providedFiles = [] } = res;

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
        });

        setAvailableFiles({
          reference: referenceFiles.map(mapFile),
          provided: providedFiles.map(mapFile),
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
        'Error loading photo comparison state from localStorage:',
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

  // 🔹 Re-validate providedFiles URLs after availableFiles loads (in case of expiration)
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
        'Error saving photo comparison state to localStorage:',
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

  // 🔹 Keep index in range
  useEffect(() => {
    if (!providedFiles.length) {
      setCurrentProvidedIndex(0);
      return;
    }
    if (currentProvidedIndex >= providedFiles.length) {
      setCurrentProvidedIndex(0);
    }
  }, [providedFiles]); // eslint-disable-line react-hooks/exhaustive-deps

  // 🔹 Navigation handlers for provided images
  const handlePrevProvided = () => {
    setCurrentProvidedIndex((prev) =>
      prev === 0 ? providedFiles.length - 1 : prev - 1,
    );
  };

  const handleNextProvided = () => {
    setCurrentProvidedIndex((prev) =>
      prev === providedFiles.length - 1 ? 0 : prev + 1,
    );
  };

  // 🔹 Clear handler (also clears localStorage)
  const handleClearSession = () => {
    setReferenceFile(null);
    setProvidedFiles([]);
    setCurrentProvidedIndex(0);
    setCompareResult(null);
    setCompareError('');

    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch (err) {
      console.error(
        'Error clearing photo comparison state from localStorage:',
        err,
      );
    }
  };

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
      if (prev.includes(file.url)) {
        return prev.filter((u) => u !== file.url);
      }
      return [...prev, file.url];
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

  // Compare reference vs provided
  const handleCompare = async () => {
    if (!referenceFile) {
      setCompareError('Please select a reference image');
      return;
    }

    if (!providedFiles.length) {
      setCompareError('Please select at least one provided image');
      return;
    }

    try {
      setCompareLoading(true);
      setCompareError('');
      setCompareResult(null);

      const providedUrls = providedFiles.map((f) => f.fullUrl);
      const res = await verifyPhoto(referenceFile.fullUrl, providedUrls);

      setCompareResult(res.data);
    } catch (err) {
      console.error('Error comparing photos:', err);

      let errorMsg = 'Failed to compare photos';

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
            <PictureAsPdfIcon className='text-red-600' sx={{ fontSize: 32 }} />
          ) : (
            <img
              src={file.fullUrl}
              alt={file.name}
              className='max-w-full max-h-full object-cover'
            />
          )}
        </div>
        <div className='px-2 py-1.5 flex-1 items-center'>
          <p className='text-[0.8rem] text-center font-semibold truncate'>
            {file.name}
          </p>
        </div>
      </div>
    );
  };

  // Reference box (left side)
  const renderReferenceBox = () => {
    if (!referenceFile) {
      return (
        <div
          onClick={() => handleOpenDialog('reference')}
          className='border-2 border-dashed border-gray-300 rounded-xl text-center text-gray-500 h-[260px] flex flex-col items-center justify-center cursor-pointer hover:bg-gray-50 transition'
        >
          <FolderOpenIcon sx={{ fontSize: 48 }} />
          <p className='mt-2 text-sm font-semibold'>
            Click here to select Reference Photo
          </p>
          <p className='mt-1 text-xs'>
            Choose one photo from your recent uploads
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

  // Provided box (right side)
  const renderProvidedBox = () => {
    if (!isHydrated && providedFiles.length === 0) {
      return (
        <div className='border-2 border-dashed border-gray-300 rounded-xl text-center text-gray-500 h-[260px] flex flex-col items-center justify-center'>
          <CircularProgress size={24} />
          <p className='mt-2 text-sm'>Loading selections...</p>
        </div>
      );
    }

    if (!providedFiles.length) {
      return (
        <div
          onClick={() => handleOpenDialog('provided')}
          className='border-2 border-dashed border-gray-300 rounded-xl text-center text-gray-500 h-[260px] flex flex-col items-center justify-center cursor-pointer hover:bg-gray-50 transition'
        >
          <FolderOpenIcon sx={{ fontSize: 48 }} />
          <p className='mt-2 text-sm font-semibold'>
            Click here to select Provided Photos
          </p>
          <p className='mt-1 text-xs'>
            You can select multiple images from your uploads
          </p>
        </div>
      );
    }

    const currentFile = providedFiles[currentProvidedIndex];
    const total = providedFiles.length;
    const isPdf = currentFile.ext === 'pdf';

    return (
      <div className='relative border-2 border-blue-500 bg-blue-50 rounded-xl h-[260px] cursor-pointer hover:shadow-md transition flex flex-col overflow-hidden'>
        {total > 1 && (
          <>
            <Button
              onClick={(e) => {
                e.stopPropagation();
                handlePrevProvided();
              }}
              sx={{
                position: 'absolute',
                left: 8,
                top: '50%',
                transform: 'translateY(-50%)',
                bgcolor: 'rgba(255,255,255,0.8)',
                '&:hover': { bgcolor: 'white' },
                borderRadius: '50%',
                p: 0.5,
                minWidth: 'auto',
                width: 32,
                height: 32,
                zIndex: 10,
              }}
              size='small'
            >
              <ChevronLeftIcon fontSize='small' />
            </Button>
            <Button
              onClick={(e) => {
                e.stopPropagation();
                handleNextProvided();
              }}
              sx={{
                position: 'absolute',
                right: 8,
                top: '50%',
                transform: 'translateY(-50%)',
                bgcolor: 'rgba(255,255,255,0.8)',
                '&:hover': { bgcolor: 'white' },
                borderRadius: '50%',
                p: 0.5,
                minWidth: 'auto',
                width: 32,
                height: 32,
                zIndex: 10,
              }}
              size='small'
            >
              <ChevronRightIcon fontSize='small' />
            </Button>
          </>
        )}

        <div
          onClick={() => handleOpenDialog('provided')}
          className='flex-1 flex flex-col items-center justify-center px-3 relative z-0'
        >
          {isPdf ? (
            <div className='flex flex-col items-center justify-center gap-2'>
              <PictureAsPdfIcon
                sx={{ fontSize: 48 }}
                className='text-red-600'
              />
              <p className='text-sm font-semibold text-center'>
                {currentFile.name}
              </p>
              <Button
                size='small'
                variant='outlined'
                href={currentFile.fullUrl}
                target='_blank'
                onClick={(e) => e.stopPropagation()}
              >
                Open PDF
              </Button>
            </div>
          ) : (
            <div className='flex flex-col items-center justify-center'>
              <img
                src={currentFile.fullUrl}
                alt={currentFile.name}
                className='w-full max-w-xs h-[190px] object-contain rounded-lg'
              />
              <p className='mt-2 text-sm font-semibold text-center truncate w-full'>
                {currentFile.name}
              </p>
            </div>
          )}
        </div>

        <div className='px-3 pb-2 pt-1 bg-blue-100'>
          <div className='flex items-center justify-between'>
            <p className='text-[11px] text-blue-900 font-semibold'>
              {total} image{total > 1 ? 's' : ''} selected
            </p>
            {total > 1 && (
              <p className='text-[11px] text-blue-700'>
                {currentProvidedIndex + 1} of {total}
              </p>
            )}
          </div>
        </div>
      </div>
    );
  };

  // 🔹 Tailwind-only UI for comparison results
  const renderComparisonResults = () => {
    if (!compareResult) return null;

    const raw = compareResult.raw_response || compareResult;
    const files = raw.files || [];
    const totalCost = compareResult.totalCost ?? raw.total_cost ?? null;

    if (!files.length) {
      return (
        <p className='text-center text-sm text-gray-500 py-3'>
          No results returned from comparison service.
        </p>
      );
    }

    // Helper: safely get report object
    const getReport = (photo) => {
      if (!photo || photo.report == null) return null;
      if (typeof photo.report === 'object') return photo.report;
      try {
        return JSON.parse(photo.report);
      } catch {
        return null;
      }
    };

    // Best overall match (highest confidence)
    let bestMatch = null;
    files.forEach((file) => {
      (file.photos || []).forEach((photo) => {
        if (photo.confidence_score == null) return;
        if (!bestMatch || photo.confidence_score > bestMatch.confidence_score) {
          bestMatch = {
            filename: file.filename,
            ...photo,
          };
        }
      });
    });

    const isBestAccepted =
      bestMatch && bestMatch.status?.toLowerCase() === 'accepted';

    return (
      <div className='space-y-6'>
        {/* 🌟 Overall best match banner */}
        {bestMatch && (
          <div
            className={`flex flex-col md:flex-row md:items-center md:justify-between gap-4 rounded-xl border-2 p-4 ${
              isBestAccepted
                ? 'bg-green-50 border-green-500'
                : 'bg-red-50 border-red-500'
            }`}
          >
            <div className='flex items-center gap-3'>
              {isBestAccepted ? (
                <CheckCircleIcon
                  className='text-green-600'
                  sx={{ fontSize: 40 }}
                />
              ) : (
                <ErrorIcon className='text-red-600' sx={{ fontSize: 40 }} />
              )}

              <div>
                <p className='text-lg font-bold'>
                  {isBestAccepted ? 'Best match accepted' : 'No accepted match'}
                </p>
                <p className='text-sm text-gray-700'>
                  File:{' '}
                  <span className='font-semibold break-all'>
                    {bestMatch.filename}
                  </span>
                </p>
              </div>
            </div>

            <div className='flex flex-col items-start md:items-end text-base font-albert '>
              <p>
                Confidence:{' '}
                <span className='font-semibold'>
                  {bestMatch.confidence_score != null
                    ? `${bestMatch.confidence_score.toFixed(2)}%`
                    : 'N/A'}
                </span>
              </p>
              <p>
                Status:{' '}
                <span
                  className={`font-semibold ${
                    isBestAccepted ? 'text-green-700' : 'text-red-700'
                  }`}
                >
                  {bestMatch.status || 'unknown'}
                </span>
              </p>
            </div>
          </div>
        )}

        {/* 📂 Per-file details */}
        <div className='space-y-4'>
          {files.map((file, fileIdx) => {
            // Best confidence per file
            const bestForFile = (file.photos || []).reduce((acc, p) => {
              if (p.confidence_score == null) return acc;
              if (!acc || p.confidence_score > acc.confidence_score) return p;
              return acc;
            }, null);

            const bestAccepted =
              bestForFile && bestForFile.status?.toLowerCase() === 'accepted';

            const fileKey =
              file.file_index != null
                ? file.file_index
                : file.filename || fileIdx;
            const isFileExpanded =
              expandedFiles[fileKey] !== undefined
                ? expandedFiles[fileKey]
                : true;

            return (
              <div
                key={fileKey}
                className='border border-gray-400 rounded-xl p-4 bg-gray-50'
              >
                <div className='flex flex-col sm:flex-row sm:items-center gap-2 mb-3'>
                  <p className='font-semibold text-sm sm:text-base truncate'>
                    {file.filename}
                  </p>

                  <div className='flex flex-wrap items-center gap-2 sm:ml-auto text-base'>
                    <span className='text-gray-500'>
                      Photos: {file.photos?.length || 0}
                    </span>

                    {bestForFile && (
                      <span
                        className={`px-2 py-0.5 rounded-full border text-[16px] ${
                          bestAccepted
                            ? 'border-green-500 text-green-700 bg-green-50'
                            : 'border-red-500 text-red-700 bg-red-50'
                        }`}
                      >
                        Best Confidence:{' '}
                        {bestForFile.confidence_score?.toFixed(1) ?? 'N/A'}% (
                        {bestForFile.status || 'unknown'})
                      </span>
                    )}

                    {/* 🔽 File-level dropdown toggle (right side) */}
                    <button
                      type='button'
                      onClick={() => toggleFileExpanded(fileKey)}
                      className='ml-2 w-8 h-8 flex justify-center items-center bg-gray-50 hover:bg-gray-100 cursor-pointer'
                    >
                      {isFileExpanded ? (
                        <IoChevronUpOutline />
                      ) : (
                        <IoChevronDownOutline />
                      )}
                    </button>
                  </div>
                </div>

                {(!file.photos || !file.photos.length) && (
                  <p className='text-xs text-gray-500'>
                    No photo results for this file.
                  </p>
                )}

                {/* 🧩 Grid of photo results (inside file dropdown) */}
                {isFileExpanded && (
                  <div className='grid grid-cols-1 gap-4'>
                    {/* Reference image on right side (one time per file) */}

                    {(file.photos || []).map((photo, photoIdx) => {
                      const report = getReport(photo);
                      const accepted =
                        photo.status?.toLowerCase() === 'accepted';

                      const photoKey = `${fileKey}-${
                        photo.photo_index != null ? photo.photo_index : photoIdx
                      }`;
                      const isPhotoExpanded =
                        expandedPhotos[photoKey] !== undefined
                          ? expandedPhotos[photoKey]
                          : true;

                      return (
                        <div
                          key={photo.photo_index}
                          className='border border-gray-300  w-full rounded-lg bg-white p-3 flex flex-col gap-2 '
                        >
                          {/* Header row */}
                          <div className='flex items-start gap-x-16 '>
                            {referenceFile && referenceFile.ext !== 'pdf' && (
                              <div className='mb-1 flex flex-col justify-center items-center gap-y-1.5'>
                                <div className='w-32 h-32 rounded-lg overflow-hidden bg-gray-100 border border-gray-300 flex items-center justify-center'>
                                  <img
                                    src={referenceFile.fullUrl}
                                    alt={referenceFile.name}
                                    className='w-full h-full object-cover'
                                  />
                                </div>

                                <p className='text-sm font-albert'>
                                  Reference Image
                                </p>
                              </div>
                            )}

                            {/* Image preview */}
                            {photo.image ? (
                              <div>
                                <div className='w-32 h-32 rounded-lg overflow-hidden bg-gray-100 border border-gray-500 flex items-center justify-center'>
                                  <img
                                    src={`data:image/jpeg;base64,${photo.image}`}
                                    alt={`Photo ${photo.photo_index}`}
                                    className='w-full h-full object-cover'
                                  />
                                </div>
                                <p className='text-sm mt-1.5 font-albert'>
                                  Extracted Image
                                </p>
                              </div>
                            ) : (
                              <div className='w-24 h-24 rounded-lg bg-gray-200 flex items-center justify-center text-[11px] text-gray-500'>
                                No preview
                              </div>
                            )}

                            <div className='flex-1 space-y-1 '>
                              <div className='flex items-center gap-2'>
                                <p className='text-lg font-semibold'>
                                  Result #{photo.photo_index}
                                </p>
                                <span
                                  className={`text-[16px] px-2 py-0.5 rounded-full border ${
                                    accepted
                                      ? 'bg-green-50 text-green-700 border-green-500'
                                      : 'bg-red-50 text-red-700 border-red-500'
                                  }`}
                                >
                                  {photo.status || 'unknown'}
                                </span>

                                {/* 🔽 Comparison-level dropdown (right side of header)
                                 */}
                                <button
                                  type='button'
                                  onClick={() => togglePhotoExpanded(photoKey)}
                                  className='ml-auto cursor-pointer w-8 h-8 rounded-full bg-gray-50 hover:bg-gray-100 flex justify-center items-center'
                                >
                                  {isPhotoExpanded ? (
                                    <IoChevronUpOutline size={20} />
                                  ) : (
                                    <IoChevronDownOutline size={20} />
                                  )}
                                </button>
                              </div>

                              <p className='text-base font-medium text-gray-600'>
                                Confidence:{' '}
                                <span className='font-semibold'>
                                  {photo.confidence_score != null
                                    ? `${photo.confidence_score.toFixed(2)}%`
                                    : 'N/A'}
                                </span>
                              </p>
                            </div>
                          </div>

                          {/* Analysis sections (inside comparison dropdown) */}
                          {report && isPhotoExpanded && (
                            <div className='mt-2 space-y-3 flex w-full justify-between gap-x-5 '>
                              {/* Pixel differences */}
                              {Array.isArray(report.pixel_difference) &&
                                report.pixel_difference.length > 0 && (
                                  <div className='border border-gray-300 rounded-md bg-gray-50 p-2'>
                                    <p className='text-lg font-semibold font-albert text-black mb-1'>
                                      Pixel Differences (
                                      {report.pixel_difference.length})
                                    </p>
                                    <ul className='list-disc list-inside space-y-2'>
                                      {report.pixel_difference.map(
                                        (diff, idx) => (
                                          <li
                                            key={idx}
                                            className='text-base text-gray-800 font-albert'
                                          >
                                            {diff}
                                          </li>
                                        ),
                                      )}
                                    </ul>
                                  </div>
                                )}

                              {/* Facial features */}
                              {(report.jawline_shape ||
                                report.forehead_proportion ||
                                report.lip_shape_thickness ||
                                report.nose_bridge_width) && (
                                <div className='border border-gray-300 rounded-md bg-gray-50 p-2 space-y-1.5'>
                                  <p className='text-lg font-semibold text-black font-albert '>
                                    Facial Feature Analysis
                                  </p>

                                  {report.jawline_shape && (
                                    <div>
                                      <p className='text-base font-albert font-semibold text-blue-600'>
                                        Jawline Shape
                                      </p>
                                      <p className='text-base font-albert text-[#474747] '>
                                        {report.jawline_shape}
                                      </p>
                                    </div>
                                  )}

                                  {report.forehead_proportion && (
                                    <div>
                                      <p className='text-base font-semibold font-albert text-blue-600'>
                                        Forehead Proportion
                                      </p>
                                      <p className='text-base font-albert text-[#474747] '>
                                        {report.forehead_proportion}
                                      </p>
                                    </div>
                                  )}

                                  {report.lip_shape_thickness && (
                                    <div>
                                      <p className='text-base font-semibold text-blue-600'>
                                        Lip Shape &amp; Thickness
                                      </p>
                                      <p className='text-base font-albert text-[#474747] '>
                                        {report.lip_shape_thickness}
                                      </p>
                                    </div>
                                  )}

                                  {report.nose_bridge_width && (
                                    <div>
                                      <p className='text-base font-semibold text-blue-600'>
                                        Nose Bridge Width
                                      </p>
                                      <p className='text-base font-albert text-[#474747] '>
                                        {report.nose_bridge_width}
                                      </p>
                                    </div>
                                  )}
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const fileList =
    dialogType === 'reference'
      ? availableFiles.reference
      : availableFiles.provided;

  return (
    <div className='px-4 md:px-10 py-1 w-full'>
      {/* Title + Clear button */}
      <div className='flex items-center justify-between mb-4'>
        <h2 className='text-center md:text-left font-semibold text-[22px] text-gray-700'>
          Photo Comparison
        </h2>

        <Button
          size='small'
          variant='outlined'
          onClick={handleClearSession}
          sx={{ textTransform: 'none', fontSize: 12 }}
        >
          Clear selection &amp; result
        </Button>
      </div>

      {/* File Selection Section */}
      <div className='grid grid-cols-1 md:grid-cols-2 gap-4 bg-white rounded-2xl shadow-md p-4 md:p-6 mb-4'>
        {/* Reference */}
        <div>
          <div className='flex items-center justify-between mb-2'>
            <div className='flex items-center gap-2'>
              <p className='font-semibold text-[16px]'>Reference Photo</p>
              {referenceFile && (
                <CheckCircleIcon
                  sx={{ fontSize: 18 }}
                  className='text-green-600'
                />
              )}
            </div>
          </div>
          {renderReferenceBox()}
        </div>

        {/* Provided */}
        <div>
          <div className='flex items-center justify-between mb-2'>
            <div className='flex items-center gap-2'>
              <p className='font-semibold text-[16px]'>Provided Photos</p>
              {providedFiles.length > 0 && (
                <CheckCircleIcon
                  sx={{ fontSize: 18 }}
                  className='text-green-600'
                />
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

      {/* Compare Button */}
      <div className='text-center mb-4'>
        <Button
          variant='contained'
          size='large'
          disabled={!referenceFile || !providedFiles.length || compareLoading}
          onClick={handleCompare}
          startIcon={
            compareLoading ? (
              <CircularProgress size={20} />
            ) : (
              <CompareArrowsIcon />
            )
          }
          sx={{ textTransform: 'none', paddingInline: 2, paddingBlock: 2 }}
        >
          {compareLoading ? 'Comparing...' : 'Compare Now'}
        </Button>
      </div>

      {compareError && (
        <div className='mb-3'>
          <Alert severity='error' onClose={() => setCompareError('')}>
            {compareError}
          </Alert>
        </div>
      )}

      {/* Result Section */}
      <div className='bg-white rounded-xl shadow-md px-4 py-4'>
        <p className='text-[18px] font-semibold mb-2'>Comparison Results</p>

        {compareLoading && (
          <div className='text-center py-6'>
            <CircularProgress />
            <p className='mt-2 text-sm text-gray-600'>Analyzing images...</p>
          </div>
        )}

        {!compareLoading && compareResult ? (
          renderComparisonResults()
        ) : !compareLoading && !compareResult ? (
          <p className='text-center text-sm text-gray-500 py-3'>
            Select a reference photo and one or more provided photos, then click{' '}
            <span className='font-semibold'>"Compare Now"</span>.
          </p>
        ) : null}
      </div>

      {/* File Selection Dialog */}
      <Dialog
        open={openDialog}
        onClose={() => setOpenDialog(false)}
        maxWidth='md'
        fullWidth
      >
        <DialogTitle>
          Select {dialogType === 'reference' ? 'Reference' : 'Provided'} Image
          {dialogType === 'provided' &&
            ` (Selected: ${tempProvidedSelection.length})`}
        </DialogTitle>
        <DialogContent>
          {loadingFiles ? (
            <div className='text-center py-6'>
              <CircularProgress />
              <p className='mt-2 text-sm'>Loading files...</p>
            </div>
          ) : fileList.length === 0 ? (
            <div className='text-center py-6 text-gray-500'>
              <ImageIcon sx={{ fontSize: 60 }} className='mb-2' />
              <p>No {dialogType} images uploaded yet</p>
              <p className='text-xs mt-1'>Go to Upload page to upload files</p>
            </div>
          ) : (
            <div className='grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 mt-2'>
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
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setOpenDialog(false)}>Close</Button>
          <Button onClick={loadAvailableFiles} startIcon={<FolderOpenIcon />}>
            Refresh Files
          </Button>
          {dialogType === 'provided' && (
            <Button
              variant='contained'
              disabled={!tempProvidedSelection.length}
              onClick={handleConfirmProvidedSelection}
            >
              Confirm Selection ({tempProvidedSelection.length})
            </Button>
          )}
        </DialogActions>
      </Dialog>
    </div>
  );
}
