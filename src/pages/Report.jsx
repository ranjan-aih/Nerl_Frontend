import React, { useEffect, useState } from 'react';
import axiosInstance from '../api/axiosInstance';

import {
  Paper,
  Table,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TableRow,
  TablePagination,
  Chip,
  CircularProgress,
  Alert,
  IconButton,
  Typography,
} from '@mui/material';

import DownloadIcon from '@mui/icons-material/Download';
import jsPDF from 'jspdf';
import { FileText, Image as ImageIcon, PenTool } from 'lucide-react';

// filter options
const typeOptions = [
  { label: 'All', value: '' },
  { label: 'Photo', value: 'photo' },
  { label: 'Signature', value: 'signature' },
];

const getBase64ImageFromURL = (url) => {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.setAttribute('crossOrigin', 'anonymous'); // This handles CORS
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(img, 0, 0);
      const dataURL = canvas.toDataURL('image/png');
      resolve(dataURL);
    };
    img.onerror = (error) => reject(error);
    img.src = url;
  });
};

const formatDateTime = (isoString) => {
  if (!isoString) return '-';
  const d = new Date(isoString);
  return d.toLocaleString();
};

// helper to add wrapped text with automatic page breaks
const addWrappedText = (doc, text, x, y, maxWidth, lineHeight) => {
  const lines = doc.splitTextToSize(text, maxWidth);
  lines.forEach((line) => {
    if (y > 280) {
      doc.addPage();
      y = 20;
    }
    doc.text(line, x, y);
    y += lineHeight;
  });
  return y;
};

// helper: pretty label from key, e.g. "missing_strokes" -> "Missing Strokes"
const formatKeyLabel = (key) =>
  key.replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase());

// 🔹 status → color for PDF (RGB)
const getStatusColor = (status) => {
  const s = String(status || '').toLowerCase();

  // Matched / verified / accepted → GREEN
  if (
    s.includes('MATCH') ||
    s === 'success' ||
    s === 'verified' ||
    s === 'match' ||
    s === 'accepted'
  ) {
    return { r: 22, g: 163, b: 74 }; // green
  }

  // Rejected / mismatch / failed → RED
  if (
    s.includes('reject') ||
    s.includes('MISMATCH') ||
    s === 'failed' ||
    s === 'error' ||
    s === 'not_matched' ||
    s === 'rejected'
  ) {
    return { r: 220, g: 38, b: 38 }; // red
  }

  // Neutral / unknown → gray
  return { r: 75, g: 85, b: 99 }; // gray
};

// 🔹 Convert raw status to ACCEPTED / REJECTED / fallback
const getDecisionLabel = (status) => {
  const s = String(status || '').toLowerCase();

  if (
    s.includes('matched') ||
    s === 'success' ||
    s === 'verified' ||
    s === 'match' ||
    s === 'accepted'
  ) {
    return 'MATCH';
  }

  if (
    s.includes('reject') ||
    s.includes('mismatch') ||
    s === 'failed' ||
    s === 'error' ||
    s === 'not_matched' ||
    s === 'rejected'
  ) {
    return 'MISMATCH';
  }

  return status ? status.toString().toUpperCase() : 'UNKNOWN';
};

// 🔹 Status / confidence helpers for signatures
const getSigStatus = (sig) =>
  sig?.status ||
  sig?.match_status ||
  sig?.result ||
  sig?.verdict ||
  sig?.decision ||
  null;

const getSigConfidence = (sig) => {
  const raw =
    sig?.confidence_score ??
    sig?.confidence ??
    sig?.similarity ??
    sig?.similarity_score;

  if (raw == null) return null;

  let num = Number(raw);
  if (Number.isNaN(num)) return null;

  // If value is 0–1, assume it's a fraction and convert to %
  if (num <= 1) num *= 100;

  return num;
};

// 🔹 Status / confidence helpers for photos
const getPhotoStatus = (photo) =>
  photo?.status ||
  photo?.match_status ||
  photo?.result ||
  photo?.verdict ||
  photo?.decision ||
  null;

const getPhotoConfidence = (photo) => {
  const raw =
    photo?.confidence_score ??
    photo?.confidence ??
    photo?.similarity ??
    photo?.similarity_score;

  if (raw == null) return null;

  let num = Number(raw);
  if (Number.isNaN(num)) return null;
  if (num <= 1) num *= 100;

  return num;
};

const Report = () => {
  const [logs, setLogs] = useState([]);
  const [total, setTotal] = useState(0);

  const [page, setPage] = useState(0); // MUI page is 0-based
  const [rowsPerPage, setRowsPerPage] = useState(10);

  const [typeFilter, setTypeFilter] = useState(''); // default "All"

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // For expanding reference / provided file names (like CostAnalysis)
  const [expandedRef, setExpandedRef] = useState(null);
  const [expandedProvided, setExpandedProvided] = useState(null);

  // Sort option: same UX pattern as CostAnalysis
  const [sortOption, setSortOption] = useState('latest'); // latest | oldest | mostProvided | leastProvided

  const ellipsisStyle = {
    maxWidth: '70%',
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    display: 'inline-block',
  };

  const fetchLogs = async () => {
    try {
      setLoading(true);
      setError('');

      const res = await axiosInstance.get('/verifications', {
        params: {
          page: page + 1, // backend expects 1-based
          limit: rowsPerPage,
          type: typeFilter || undefined,
        },
      });

      if (res.data?.success) {
        setLogs(res.data.items || []);
        setTotal(res.data.total || 0);

        // reset expanded rows when data changes
        setExpandedRef(null);
        setExpandedProvided(null);
      } else {
        setError(res.data?.message || 'Failed to load reports');
      }
    } catch (err) {
      console.error('Error fetching verification reports:', err);
      setError('Failed to load reports');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLogs();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, rowsPerPage, typeFilter]);

  const handleChangePage = (event, newPage) => {
    setPage(newPage);
  };

  const handleChangeRowsPerPage = (event) => {
    setRowsPerPage(parseInt(event.target.value, 10));
    setPage(0);
  };

  const downloadReportPdf = (log) => {
    if (!log) return;

    const doc = new jsPDF('p', 'mm', 'a4');
    const marginLeft = 12;
    const maxWidth = 185; // 210 - margins
    const lineHeight = 6;

    const py = log.pythonResponse || {};
    const request = log.request || {};
    const providedNames = request.providedFileNames || [];
    const createdAtFormatted = formatDateTime(log.createdAt);

    // ---------- HEADER BAND ----------
    doc.setFillColor(15, 23, 42); // dark slate
    doc.rect(0, 0, 210, 22, 'F');

    doc.setTextColor(255, 255, 255);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(16);
    doc.text('Verification Report', marginLeft, 11);

    const headerDecision = getDecisionLabel(log.status || '');
    const headerColor = getStatusColor(log.status || '');

    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(`ID: ${log._id}`, marginLeft, 17);
    doc.text(`Type: ${log.type || '-'}`, marginLeft + 70, 17);

    if (createdAtFormatted && createdAtFormatted !== '-') {
      doc.text(`Date: ${createdAtFormatted}`, marginLeft + 120, 17);
    }

    if (headerDecision !== 'UNKNOWN') {
      doc.setTextColor(headerColor.r, headerColor.g, headerColor.b);
      doc.text(`Status: ${headerDecision}`, 210 - marginLeft - 40, 11);
    }
    doc.setTextColor(255, 255, 255);

    let y = 28; // start below header
    doc.setTextColor(0, 0, 0);

    // ---------- 1. REQUEST DETAILS ----------
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(37, 99, 235); // blue
    doc.text('1. Verification Overview', marginLeft, y);
    y += 3;
    doc.setDrawColor(209, 213, 219); // light gray line
    doc.line(marginLeft, y, marginLeft + 70, y);
    y += 6;

    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(0, 0, 0);

    y = addWrappedText(
      doc,
      `Comparison ID: ${log._id}`,
      marginLeft,
      y,
      maxWidth,
      lineHeight,
    );
    y = addWrappedText(
      doc,
      `Comaprison Type: ${log.type || '-'} - kyc`,
      marginLeft,
      y,
      maxWidth,
      lineHeight,
    );
    // y = addWrappedText(
    //   doc,
    //   `Overall Status: ${headerDecision}`,
    //   marginLeft,
    //   y,
    //   maxWidth,
    //   lineHeight,
    // );
    y = addWrappedText(
      doc,
      `Created At: ${createdAtFormatted}`,
      marginLeft,
      y,
      maxWidth,
      lineHeight,
    );
    // y = addWrappedText(
    //   doc,
    //   `Reference File: ${request.referenceFileName || '-'}`,
    //   marginLeft,
    //   y,
    //   maxWidth,
    //   lineHeight,
    // );

    // if (providedNames.length === 0) {
    //   y = addWrappedText(
    //     doc,
    //     'Provided Files: -',
    //     marginLeft,
    //     y,
    //     maxWidth,
    //     lineHeight,
    //   );
    // } else {
    //   y = addWrappedText(
    //     doc,
    //     `Provided Files (${providedNames.length}):`,
    //     marginLeft,
    //     y,
    //     maxWidth,
    //     lineHeight,
    //   );
    //   providedNames.forEach((name, idx) => {
    //     y = addWrappedText(
    //       doc,
    //       `• ${idx + 1}. ${name}`,
    //       marginLeft + 4,
    //       y,
    //       maxWidth - 4,
    //       lineHeight,
    //     );
    //   });
    // }

    y += 4;

    // ---------- 2. ANALYSIS SUMMARY ----------
    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(37, 99, 235);
    doc.text('2. Analysis Summary', marginLeft, y);
    y += 3;
    doc.setDrawColor(209, 213, 219);
    doc.line(marginLeft, y, marginLeft + 70, y);
    y += 6;

    doc.setFontSize(11);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(0, 0, 0);

    const writePixelDiffs = (parsed, level = 1) => {
      if (!parsed || !parsed.pixel_difference) return y;

      const diffs = Array.isArray(parsed.pixel_difference)
        ? parsed.pixel_difference
        : [parsed.pixel_difference];

      const baseIndentMm = 4;
      const xBase = marginLeft + level * baseIndentMm;
      const innerWidth = maxWidth - (xBase - marginLeft);

      diffs.forEach((d, i) => {
        if (typeof d === 'string') {
          y = addWrappedText(
            doc,
            `• Pixel difference ${i + 1}: ${d}`,
            xBase,
            y,
            innerWidth,
            lineHeight,
          );
        } else if (d && typeof d === 'object') {
          y = addWrappedText(
            doc,
            `• Pixel difference ${i + 1}:`,
            xBase,
            y,
            innerWidth,
            lineHeight,
          );

          const xChild = xBase + baseIndentMm;
          const childWidth = innerWidth - baseIndentMm;

          const region = typeof d.region === 'string' ? d.region : undefined;
          const description =
            typeof d.description === 'string' ? d.description : undefined;

          if (region) {
            y = addWrappedText(
              doc,
              `Region: ${region}`,
              xChild,
              y,
              childWidth,
              lineHeight,
            );
          }
          if (description) {
            y = addWrappedText(
              doc,
              `Details: ${description}`,
              xChild,
              y,
              childWidth,
              lineHeight,
            );
          }

          Object.entries(d).forEach(([key, value]) => {
            if (key === 'region' || key === 'description') return;
            if (value == null) return;
            const label = formatKeyLabel(key);
            y = addWrappedText(
              doc,
              `${label}: ${String(value)}`,
              xChild,
              y,
              childWidth,
              lineHeight,
            );
          });
        } else {
          y = addWrappedText(
            doc,
            `• Pixel difference ${i + 1}: ${String(d)}`,
            xBase,
            y,
            innerWidth,
            lineHeight,
          );
        }
      });

      y += 2;
      return y;
    };

    const writeStrokeDiffs = (parsedStrokePoints, level = 1) => {
      if (
        !parsedStrokePoints ||
        typeof parsedStrokePoints !== 'object' ||
        !parsedStrokePoints.differences
      )
        return y;

      const diffs = Array.isArray(parsedStrokePoints.differences)
        ? parsedStrokePoints.differences
        : [parsedStrokePoints.differences];

      const baseIndentMm = 4;
      const xBase = marginLeft + level * baseIndentMm;
      const innerWidth = maxWidth - (xBase - marginLeft);

      diffs.forEach((d, i) => {
        if (typeof d === 'string') {
          y = addWrappedText(
            doc,
            `• Stroke difference ${i + 1}: ${d}`,
            xBase,
            y,
            innerWidth,
            lineHeight,
          );
        } else if (d && typeof d === 'object') {
          y = addWrappedText(
            doc,
            `• Stroke difference ${i + 1}:`,
            xBase,
            y,
            innerWidth,
            lineHeight,
          );

          const xChild = xBase + baseIndentMm;
          const childWidth = innerWidth - baseIndentMm;

          if (typeof d.description === 'string') {
            y = addWrappedText(
              doc,
              `Details: ${d.description}`,
              xChild,
              y,
              childWidth,
              lineHeight,
            );
          }

          Object.entries(d).forEach(([key, value]) => {
            if (key === 'description') return;
            if (value == null) return;
            const label = formatKeyLabel(key);
            y = addWrappedText(
              doc,
              `${label}: ${String(value)}`,
              xChild,
              y,
              childWidth,
              lineHeight,
            );
          });
        } else {
          y = addWrappedText(
            doc,
            `• Stroke difference ${i + 1}: ${String(d)}`,
            xBase,
            y,
            innerWidth,
            lineHeight,
          );
        }
      });

      y += 2;
      return y;
    };

    // ---------- CONTENT BY TYPE ----------
    if (!py || Object.keys(py).length === 0) {
      y = addWrappedText(
        doc,
        'No structured analysis was stored for this comparison.',
        marginLeft,
        y,
        maxWidth,
        lineHeight,
      );
    } else if (log.type === 'signature' && Array.isArray(py.files)) {
      py.files.forEach((file, fileIdx) => {
        if (y > 275) {
          doc.addPage();
          y = 20;
        }

        const fileLabel =
          file.filename || `File #${file.file_index ?? fileIdx}`;
        const sigCount = Array.isArray(file.signatures)
          ? file.signatures.length
          : 0;

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(12);
        doc.setTextColor(15, 23, 42);
        y = addWrappedText(
          doc,
          `File: ${fileLabel} (Signatures: ${sigCount})`,
          marginLeft,
          y,
          maxWidth,
          lineHeight,
        );
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(11);
        doc.setTextColor(0, 0, 0);
        y += 1;

        (file.signatures || []).forEach((sig, idxSig) => {
          const rawSigStatus = getSigStatus(sig);
          const statusSource = rawSigStatus || log.status || '';
          const decisionLabel = getDecisionLabel(statusSource);
          const hasDecision = decisionLabel !== 'UNKNOWN';

          const confNum = getSigConfidence(sig);
          const confLabel = confNum != null ? `${confNum.toFixed(2)}%` : null;

          let lineText = `• Signature #${sig.signature_index ?? idxSig}`;
          if (hasDecision) {
            lineText += `: Status = ${decisionLabel}`;
          }
          if (confLabel) {
            lineText += hasDecision
              ? `, Confidence = ${confLabel}`
              : `: Confidence = ${confLabel}`;
          }

          if (hasDecision) {
            const sigColor = getStatusColor(statusSource);
            doc.setTextColor(sigColor.r, sigColor.g, sigColor.b);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(12);
          }

          y = addWrappedText(
            doc,
            lineText,
            marginLeft + 4,
            y,
            maxWidth - 4,
            lineHeight,
          );

          doc.setTextColor(0, 0, 0);
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(11);

          let parsed = null;
          const rep = sig.report;
          if (rep) {
            if (typeof rep === 'object') parsed = rep;
            else {
              try {
                parsed = JSON.parse(rep);
              } catch {
                parsed = null;
              }
            }
          }

          if (parsed) {
            y = writePixelDiffs(parsed, 2);
            if (parsed.stroke_points) {
              y = writeStrokeDiffs(parsed.stroke_points, 2);
            }
          }

          y += 1;
        });

        y += 3;
      });
    } else if (log.type === 'photo' && Array.isArray(py.photos)) {
      py.photos.forEach((file, fileIdx) => {
        if (y > 275) {
          doc.addPage();
          y = 20;
        }

        const fileLabel =
          file.filename || `File #${file.file_index ?? fileIdx}`;
        const innerPhotos = Array.isArray(file.photos)
          ? file.photos
          : Array.isArray(py.photos[0]?.photos)
            ? py.photos[0].photos
            : [];

        doc.setFont('helvetica', 'bold');
        doc.setFontSize(12);
        doc.setTextColor(15, 23, 42);
        y = addWrappedText(
          doc,
          `File: ${fileLabel} (Results: ${innerPhotos.length})`,
          marginLeft,
          y,
          maxWidth,
          lineHeight,
        );
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(11);
        doc.setTextColor(0, 0, 0);
        y += 1;

        innerPhotos.forEach((photo, idxPhoto) => {
          const rawPhotoStatus = getPhotoStatus(photo);
          const statusSource = rawPhotoStatus || log.status || '';
          const decisionLabel = getDecisionLabel(statusSource);
          const hasDecision = decisionLabel !== 'UNKNOWN';

          const confNum = getPhotoConfidence(photo);
          const confLabel = confNum != null ? `${confNum.toFixed(2)}%` : null;

          let lineText = `• Result #${photo.photo_index ?? idxPhoto}`;
          if (hasDecision) {
            lineText += `: Status = ${decisionLabel}`;
          }
          if (confLabel) {
            lineText += hasDecision
              ? `, Confidence = ${confLabel}`
              : `: Confidence = ${confLabel}`;
          }

          if (hasDecision) {
            const photoColor = getStatusColor(statusSource);
            doc.setTextColor(photoColor.r, photoColor.g, photoColor.b);
            doc.setFont('helvetica', 'bold');
            doc.setFontSize(12);
          }

          y = addWrappedText(
            doc,
            lineText,
            marginLeft + 4,
            y,
            maxWidth - 4,
            lineHeight,
          );

          doc.setTextColor(0, 0, 0);
          doc.setFont('helvetica', 'normal');
          doc.setFontSize(11);

          let parsed = null;
          const rep = photo.report;
          if (rep) {
            if (typeof rep === 'object') parsed = rep;
            else {
              try {
                parsed = JSON.parse(rep);
              } catch {
                parsed = null;
              }
            }
          }

          if (parsed) {
            y = writePixelDiffs(parsed, 2);
            if (parsed.stroke_points) {
              y = writeStrokeDiffs(parsed.stroke_points, 2);
            }
          }

          y += 1;
        });

        y += 3;
      });
    } else if (log.type === 'video') {
      const videoData = py || {};
      const statusSource = videoData.status || log.status || '';
      const decisionLabel = getDecisionLabel(statusSource);
      const decisionColor = getStatusColor(statusSource);

      const face = videoData.face_verification || {};
      const docDetails = videoData.document_details || {};
      const videoDetails = videoData.video_details || {};
      const verification = videoData.verification || {};

      const faceConfidence =
        face.confidence_score != null ? Number(face.confidence_score) : null;
      const cost = videoData.cost ?? log.totalCost ?? null;

      // // --- 1. CLEAN HEADER ---
      // doc.setFont('helvetica', 'bold');
      // doc.setFontSize(16); // Large
      // doc.setTextColor(30, 41, 59); // Dark Slate
      // doc.text('Video Verification Summary', marginLeft, y);
      // y += 10;

      // --- 2. LINE-BY-LINE SUMMARY (No Box) ---
      doc.setFontSize(10);

      // Status Line
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(0, 0, 0);
      doc.text('Status: ', marginLeft, y);
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(decisionColor.r, decisionColor.g, decisionColor.b);
      doc.text(`${decisionLabel}`, marginLeft + 15, y);
      y += 7;

      // Face Match Line (RAW VALUE, NO %)
      doc.setFont('helvetica', 'bold');
      doc.setTextColor(0, 0, 0);
      doc.text('Confidence: ', marginLeft, y);

      doc.setFont('helvetica', 'bold');
      doc.text(
        faceConfidence != null ? faceConfidence.toString() : '0',
        marginLeft + 25,
        y,
      );
      y += 7;

      // Cost Line (4 decimal places)
      doc.setFont('helvetica', 'bold');
      doc.text('Processing Cost: ', marginLeft, y);

      doc.setFont('helvetica', 'bold');
      doc.text(
        cost != null ? Number(cost).toFixed(4) : '0.0000',
        marginLeft + 32,
        y,
      );
      y += 12;

      // --- 3. DATA COMPARISON (SIDE BY SIDE) ---
      const colWidth = (maxWidth - 10) / 2;

      doc.setFontSize(12);
      doc.setFont('helvetica', 'medium');
      doc.setTextColor(37, 99, 235); // Blue for headers
      doc.text('Document Evidence', marginLeft, y);
      doc.text('Video/Speech Evidence', marginLeft + colWidth + 5, y);
      y += 3;

      doc.setDrawColor(226, 232, 240);
      doc.setLineWidth(0.5);
      doc.line(marginLeft, y, marginLeft + maxWidth, y); // Separator Line
      y += 8;

      const details = [
        {
          label: 'Type/Name',
          doc: docDetails.name || '-',
          vid: videoDetails.name || '-',
        },
        {
          label: 'Card Number',
          doc: docDetails.card_number || '-',
          vid: videoDetails.card_number || '-',
        },
        { label: 'Card Type', doc: docDetails.card_type || '-', vid: 'N/A' },
      ];

      doc.setFontSize(10); // Medium
      details.forEach((item) => {
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(15, 23, 42);
        doc.text(`${item.label}:`, marginLeft, y);

        doc.setFont('helvetica', 'normal');
        doc.setTextColor(0, 0, 0);
        // Document Column
        doc.text(`${item.doc}`, marginLeft + 30, y);
        // Video Column
        doc.text(`${item.vid}`, marginLeft + colWidth + 40, y);

        y += 8;
      });

      y += 5;

      // --- 4. AI ANALYSIS REASONING ---
      if (verification.reason) {
        if (y > 250) {
          doc.addPage();
          y = 20;
        }

        doc.setFontSize(11);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(30, 41, 59);
        doc.text('AI Verification Remark:', marginLeft, y);
        y += 6;

        doc.setFont('helvetica', 'normal');
        doc.setFontSize(10);
        y = addWrappedText(
          doc,
          verification.reason,
          marginLeft,
          y,
          maxWidth,
          5,
        );
        y += 10;
      }

      // --- 5. IMAGE VERIFICATION SECTION ---
      if (face.reference_photo && face.photo_frame) {
        if (y > 180) {
          doc.addPage();
          y = 20;
        }

        doc.setFontSize(12);
        doc.setFont('helvetica', 'bold');
        doc.setTextColor(37, 99, 235);
        doc.text('Visual Comparison', marginLeft, y);
        y += 8;

        try {
          doc.addImage(face.reference_photo, 'PNG', marginLeft, y, 50, 60);
          doc.addImage(face.photo_frame, marginLeft + 70, y, 50, 60);

          doc.setFontSize(9);
          doc.setTextColor(100, 100, 100);
          doc.text('Reference ID Photo', marginLeft + 10, y + 65);
          doc.text('Extracted Video Frame', marginLeft + 78, y + 65);
          y += 75;
        } catch (err) {
          console.error('Image Render Error:', err);
        }
      }
    } else {
      y = addWrappedText(
        doc,
        'Structured analysis is available but not in a known format.',
        marginLeft,
        y,
        maxWidth,
        lineHeight,
      );
    }

    // ---- Save PDF ----
    doc.save(`verification-report-${log._id}.pdf`);
  };

  // ---- SORTED LOGS for current page (client-side sort of current page) ----
  const sortedLogs = [...logs].sort((a, b) => {
    const aDate = new Date(a.createdAt).getTime();
    const bDate = new Date(b.createdAt).getTime();
    const aProvided = a.request?.providedFileNames?.length || 0;
    const bProvided = b.request?.providedFileNames?.length || 0;

    switch (sortOption) {
      case 'latest':
        return bDate - aDate; // newest first
      case 'oldest':
        return aDate - bDate; // oldest first
      case 'mostProvided':
        return bProvided - aProvided;
      case 'leastProvided':
        return aProvided - bProvided;
      default:
        return 0;
    }
  });

  // Stats based on log.type (from current logs)
  const totalComparisons = logs.length;
  const photoComparisonCount = logs.filter((l) => l.type === 'photo').length;
  const signatureComparisonCount = logs.filter(
    (l) => l.type === 'signature',
  ).length;

  return (
    <div className='px-4 md:px-8 py-4 w-full'>
      <div className='flex items-center justify-center mb-8 gap-3 flex-wrap'>
        <div className='flex justify-center items-center'>
          <h2 className='text-xl md:text-2xl font-semibold text-gray-800'>
            Comparison Reports
          </h2>
        </div>
      </div>

      {/* Stats cards (derived from logs) */}
      <div className='grid grid-cols-1 md:grid-cols-3 gap-6 mb-6'>
        {/* Total comparisons */}
        <div className='flex items-center gap-4 p-5 rounded-2xl border border-gray-200 bg-white/80 shadow-md hover:shadow-lg transition-all'>
          <div className='p-3 rounded-xl bg-indigo-50'>
            <FileText className='w-6 h-6 text-indigo-600' />
          </div>
          <div>
            <p className='text-xs font-medium text-gray-500 uppercase tracking-wide'>
              Total Comparisons
            </p>
            <p className='mt-1 text-2xl font-semibold text-gray-900'>
              {totalComparisons}
            </p>
          </div>
        </div>

        {/* Total photo comparisons */}
        <div className='flex items-center gap-4 p-5 rounded-2xl border border-gray-200 bg-white/80 shadow-md hover:shadow-lg transition-all'>
          <div className='p-3 rounded-xl bg-emerald-50'>
            <ImageIcon className='w-6 h-6 text-emerald-600' />
          </div>
          <div>
            <p className='text-xs font-medium text-gray-500 uppercase tracking-wide'>
              Photo Comparisons
            </p>
            <p className='mt-1 text-2xl font-semibold text-gray-900'>
              {photoComparisonCount}
            </p>
          </div>
        </div>

        {/* Total signature comparisons */}
        <div className='flex items-center gap-4 p-5 rounded-2xl border border-gray-200 bg-white/80 shadow-md hover:shadow-lg transition-all'>
          <div className='p-3 rounded-xl bg-amber-50'>
            <PenTool className='w-6 h-6 text-amber-600' />
          </div>
          <div>
            <p className='text-xs font-medium text-gray-500 uppercase tracking-wide'>
              Signature Comparisons
            </p>
            <p className='mt-1 text-2xl font-semibold text-gray-900'>
              {signatureComparisonCount}
            </p>
          </div>
        </div>
      </div>

      <Paper className='overflow-hidden rounded-xl shadow-md'>
        {/* Header bar with FILTERS + SORT */}
        <div className='px-4 py-3 border-b flex flex-wrap gap-3 items-center justify-between bg-gray-50'>
          <Typography variant='subtitle1' fontWeight={600}>
            Comparison History
          </Typography>

          <div className='flex flex-wrap items-center gap-3'>
            {/* Type filter */}
            <div className='flex items-center gap-2'>
              <span className='text-xs md:text-sm text-gray-600'>Type:</span>
              <select
                value={typeFilter}
                onChange={(e) => {
                  setPage(0);
                  setTypeFilter(e.target.value);
                }}
                className='border border-gray-300 rounded-lg text-xs md:text-sm px-2 py-1 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500'
              >
                {typeOptions.map((opt) => (
                  <option
                    key={opt.value === '' ? 'all' : opt.value}
                    value={opt.value}
                  >
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Sort by selector */}
            <div className='flex items-center gap-2'>
              <span className='text-xs md:text-sm text-gray-600'>Sort by:</span>
              <select
                value={sortOption}
                onChange={(e) => setSortOption(e.target.value)}
                className='border border-gray-300 rounded-lg text-xs md:text-sm px-2 py-1 bg-white focus:outline-none focus:ring-2 focus:ring-blue-500'
              >
                <option value='latest'>Latest</option>
                <option value='oldest'>Oldest</option>
                <option value='mostProvided'>Most Provided</option>
                <option value='leastProvided'>Least Provided</option>
              </select>
            </div>
          </div>
        </div>

        {loading && (
          <div className='flex items-center justify-center py-10'>
            <CircularProgress />
          </div>
        )}

        {!loading && error && (
          <div className='p-4'>
            <Alert severity='error' onClose={() => setError('')}>
              {error}
            </Alert>
          </div>
        )}

        {!loading && !error && (
          <>
            {sortedLogs.length === 0 ? (
              <div className='p-4'>
                <Typography variant='body2' color='text.secondary'>
                  No reports found.
                </Typography>
              </div>
            ) : (
              <>
                <TableContainer
                  sx={{
                    maxWidth: '100%',
                    overflowX: 'hidden',
                  }}
                >
                  <Table
                    size='small'
                    sx={{
                      tableLayout: 'fixed',
                      width: '100%',
                    }}
                  >
                    <TableHead>
                      <TableRow sx={{ backgroundColor: '#f9fafb' }}>
                        <TableCell>
                          <b>Date</b>
                        </TableCell>
                        <TableCell>
                          <b>Type of comparison</b>
                        </TableCell>
                        <TableCell sx={{ width: '26%' }}>
                          <b>Reference</b>
                        </TableCell>
                        <TableCell sx={{ width: '26%' }}>
                          <b>Provided</b>
                        </TableCell>
                        <TableCell align='right' sx={{ width: '12%' }}>
                          <b>Actions</b>
                        </TableCell>
                      </TableRow>
                    </TableHead>
                    <TableBody>
                      {sortedLogs.map((log) => {
                        const providedNames =
                          log.request?.providedFileNames || [];

                        return (
                          <TableRow
                            key={log._id}
                            hover
                            sx={{
                              '&:hover': { backgroundColor: '#f5f7fa' },
                              transition: 'all 0.2s',
                            }}
                          >
                            {/* Date */}
                            <TableCell>
                              {formatDateTime(log.createdAt)}
                            </TableCell>

                            {/* Type */}
                            <TableCell>
                              <Chip
                                size='small'
                                label={log.type}
                                color={
                                  log.type === 'photo'
                                    ? 'primary'
                                    : log.type === 'signature'
                                      ? 'secondary'
                                      : 'default'
                                }
                                variant='outlined'
                              />
                            </TableCell>

                            {/* Reference */}
                            <TableCell
                              onClick={() =>
                                setExpandedRef(
                                  expandedRef === log._id ? null : log._id,
                                )
                              }
                              style={{ cursor: 'pointer' }}
                              sx={{ wordBreak: 'break-all' }}
                            >
                              {expandedRef === log._id ? (
                                <Typography className='break-all text-sm'>
                                  {log.request?.referenceFileName || '-'}
                                </Typography>
                              ) : (
                                <Typography style={ellipsisStyle}>
                                  {log.request?.referenceFileName || '-'}
                                </Typography>
                              )}

                              <Typography className='text-xs text-blue-600 underline'>
                                {expandedRef === log._id ? 'Hide' : 'Show'}{' '}
                                details
                              </Typography>
                            </TableCell>

                            {/* Provided */}
                            <TableCell
                              onClick={() =>
                                setExpandedProvided(
                                  expandedProvided === log._id ? null : log._id,
                                )
                              }
                              style={{ cursor: 'pointer' }}
                              sx={{ wordBreak: 'break-all' }}
                            >
                              {expandedProvided === log._id ? (
                                <div className='break-all text-sm'>
                                  {providedNames.length === 0
                                    ? '-'
                                    : providedNames.map((file, i) => (
                                        <div key={i}>{file}</div>
                                      ))}
                                </div>
                              ) : (
                                <Typography style={ellipsisStyle}>
                                  {providedNames.length === 0
                                    ? '-'
                                    : `${providedNames[0]}${
                                        providedNames.length > 1
                                          ? ` + ${
                                              providedNames.length - 1
                                            } more`
                                          : ''
                                      }`}
                                </Typography>
                              )}

                              <Typography className='text-xs text-blue-600 underline'>
                                {expandedProvided === log._id ? 'Hide' : 'Show'}{' '}
                                details
                              </Typography>
                            </TableCell>

                            {/* Actions: ONLY download PDF */}
                            <TableCell align='right'>
                              <IconButton
                                size='small'
                                onClick={() => downloadReportPdf(log)}
                              >
                                <DownloadIcon fontSize='small' /> Download
                              </IconButton>
                            </TableCell>
                          </TableRow>
                        );
                      })}
                    </TableBody>
                  </Table>
                </TableContainer>

                <TablePagination
                  component='div'
                  count={total}
                  page={page}
                  onPageChange={handleChangePage}
                  rowsPerPage={rowsPerPage}
                  onRowsPerPageChange={handleChangeRowsPerPage}
                  rowsPerPageOptions={[5, 10, 20, 50]}
                />
              </>
            )}
          </>
        )}
      </Paper>
    </div>
  );
};

export default Report;
