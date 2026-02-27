// import { CircularProgress, LinearProgress, Chip, Tooltip } from '@mui/material';
// import CheckCircleIcon from '@mui/icons-material/CheckCircle';
// import VideocamIcon from '@mui/icons-material/Videocam';
// import VideocamOffIcon from '@mui/icons-material/VideocamOff';
// import MicIcon from '@mui/icons-material/Mic';
// import MicOffIcon from '@mui/icons-material/MicOff';
// import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord';
// import RadioButtonCheckedIcon from '@mui/icons-material/RadioButtonChecked';
// import StopIcon from '@mui/icons-material/Stop';
// import ReplayIcon from '@mui/icons-material/Replay';
// import HourglassEmptyIcon from '@mui/icons-material/HourglassEmpty';
// import VerifiedUserIcon from '@mui/icons-material/VerifiedUser';
// import WarningAmberIcon from '@mui/icons-material/WarningAmber';

// /**
//  * LiveDetectionBox
//  * The entire right-panel camera + liveness UI.
//  * Receives all state and callbacks from useLivenessSession via the parent.
//  */
// export default function LiveDetection({
//   liveVideoRef,
//   liveMode,
//   audioEnabled,
//   cameraError,
//   startCamera,
//   stopCamera,
//   toggleAudio,
//   status,
//   rawAzureStatus,
//   livenessResult,
//   attempts,
//   rateLimitCountdown,
//   startDetection,
//   stopDetection,
//   resetDetection,
//   isRecording,
//   recordedBlob,
//   recordingLabel,
// }) {
//   const borderColor =
//     status === 'success'
//       ? 'border-green-500'
//       : status === 'failed'
//         ? 'border-red-500'
//         : status === 'capturing'
//           ? 'border-blue-400'
//           : 'border-gray-200';

//   const statusBarClass =
//     rawAzureStatus?.type === 'success'
//       ? 'bg-green-50 text-green-900 border-green-200'
//       : rawAzureStatus?.type === 'error'
//         ? 'bg-red-50 text-red-900 border-red-200'
//         : rawAzureStatus?.type === 'warning'
//           ? 'bg-amber-50 text-amber-900 border-amber-200'
//           : 'bg-gray-50 text-gray-700 border-gray-200';

//   return (
//     <div
//       className={`border-2 ${borderColor} rounded-xl overflow-hidden bg-white shadow-sm flex flex-col transition-colors`}
//       style={{ minHeight: 320 }}
//     >
//       {/* ── Header bar ─────────────────────────────────────────────────────── */}
//       <div className='flex items-center justify-between px-4 py-2.5 bg-gradient-to-r from-slate-700 to-slate-800'>
//         <div className='flex items-center gap-2'>
//           <div
//             className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
//               status === 'success'
//                 ? 'bg-green-400'
//                 : status === 'failed'
//                   ? 'bg-red-400'
//                   : status === 'capturing'
//                     ? 'bg-blue-400 animate-pulse'
//                     : liveMode
//                       ? 'bg-green-400'
//                       : 'bg-gray-400'
//             }`}
//           />
//           <span className='text-white text-sm font-semibold tracking-wide'>
//             Live Face Detection
//           </span>
//           {isRecording && (
//             <Chip
//               icon={
//                 <FiberManualRecordIcon
//                   sx={{ fontSize: 10, color: 'white !important' }}
//                 />
//               }
//               label={recordingLabel}
//               size='small'
//               sx={{
//                 bgcolor: '#ef4444',
//                 color: 'white',
//                 fontSize: 11,
//                 height: 20,
//                 '& .MuiChip-icon': { color: 'white' },
//               }}
//             />
//           )}
//         </div>

//         <div className='flex items-center gap-1.5'>
//           {liveMode && (
//             <Tooltip
//               title={audioEnabled ? 'Mute microphone' : 'Unmute microphone'}
//             >
//               <button
//                 onClick={toggleAudio}
//                 className={`text-white/90 hover:text-white py-0.5 px-3 rounded-full transition cursor-pointer ${audioEnabled ? 'bg-gray-500 hover:bg-gray-600' : 'bg-red-500 hover:bg-red-600'}`}
//               >
//                 {audioEnabled ? (
//                   <MicIcon sx={{ fontSize: 18 }} />
//                 ) : (
//                   <MicOffIcon sx={{ fontSize: 18 }} />
//                 )}
//               </button>
//             </Tooltip>
//           )}
//           <button
//             onClick={liveMode ? stopCamera : startCamera}
//             className={`flex items-center gap-1 text-xs font-semibold px-3 py-1.5 cursor-pointer rounded-full transition ${
//               liveMode
//                 ? 'bg-white hover:bg-gray-100 text-slate-700'
//                 : 'bg-red-500 hover:bg-red-600 text-white'
//             }`}
//           >
//             {liveMode ? (
//               <VideocamIcon sx={{ fontSize: 16 }} />
//             ) : (
//               <>
//                 <VideocamOffIcon sx={{ fontSize: 16 }} /> Camera
//               </>
//             )}
//           </button>
//         </div>
//       </div>

//       {/* ── Video feed ─────────────────────────────────────────────────────── */}
//       <div
//         className='relative bg-black flex-1 flex items-center justify-center'
//         style={{ height: 240, minHeight: 240 }}
//       >
//         {/* Always in DOM so ref stays valid; hidden via display when camera off */}
//         <video
//           ref={liveVideoRef}
//           autoPlay
//           playsInline
//           muted
//           onLoadedMetadata={() =>
//             console.log(
//               '[Video]',
//               liveVideoRef.current?.videoWidth,
//               'x',
//               liveVideoRef.current?.videoHeight,
//             )
//           }
//           onCanPlay={() => liveVideoRef.current?.play().catch(() => {})}
//           style={{
//             position: 'absolute',
//             inset: 0,
//             width: '100%',
//             height: '100%',
//             objectFit: 'cover',
//             display: liveMode ? 'block' : 'none',
//             transform: 'scaleX(-1)', // CSS-only mirror for display; frame capture draws unmirrored
//           }}
//         />

//         {/* Camera off placeholder */}
//         {!liveMode && (
//           <div className='flex flex-col items-center justify-center gap-3 text-white/50'>
//             <VideocamOffIcon sx={{ fontSize: 56 }} />
//             <p className='text-sm font-medium'>Camera is off</p>
//             {cameraError ? (
//               <p className='text-xs text-red-400 text-center px-4'>
//                 {cameraError}
//               </p>
//             ) : (
//               <button
//                 onClick={startCamera}
//                 className='mt-1 cursor-pointer bg-white/10 hover:bg-white/20 text-white text-xs font-semibold px-5 py-2.5 rounded-full transition border border-white/20'
//               >
//                 Turn On Camera
//               </button>
//             )}
//           </div>
//         )}

//         {/* Face guide oval — only while capturing */}
//         {liveMode && status === 'capturing' && (
//           <div className='absolute inset-0 flex flex-col items-center justify-center pointer-events-none'>
//             <div
//               className='border-4 border-white/80 rounded-full'
//               style={{
//                 width: 150,
//                 height: 195,
//                 borderStyle: 'dashed',
//                 boxShadow: '0 0 0 9999px rgba(0,0,0,0.35)',
//                 animation: 'pulse 2s cubic-bezier(0.4,0,0.6,1) infinite',
//               }}
//             />
//             <p className='absolute bottom-3 text-white/90 text-[11px] font-semibold bg-black/50 px-3 py-1 rounded-full'>
//               Align face within the oval
//             </p>
//           </div>
//         )}

//         {/* Rate limit countdown badge */}
//         {liveMode && rateLimitCountdown > 0 && status === 'capturing' && (
//           <div className='absolute top-3 right-3 bg-black/70 text-white text-xs font-bold px-3 py-1.5 rounded-full flex items-center gap-1.5'>
//             <HourglassEmptyIcon sx={{ fontSize: 13 }} />
//             Next scan in {rateLimitCountdown}s
//           </div>
//         )}

//         {/* Success overlay */}
//         {liveMode && status === 'success' && (
//           <div className='absolute inset-0 bg-green-900/80 flex flex-col items-center justify-center gap-3'>
//             <VerifiedUserIcon sx={{ fontSize: 64, color: '#4ade80' }} />
//             <p className='text-white font-bold text-xl tracking-wide'>
//               Liveness Confirmed
//             </p>
//             <p className='text-green-300 text-sm font-mono'>
//               livenessDecision: realface
//             </p>
//           </div>
//         )}

//         {/* Spoof overlay */}
//         {liveMode &&
//           status === 'failed' &&
//           livenessResult?.livenessDecision === 'spoofface' && (
//             <div className='absolute inset-0 bg-red-900/75 flex flex-col items-center justify-center gap-3'>
//               <WarningAmberIcon sx={{ fontSize: 56, color: '#fbbf24' }} />
//               <p className='text-white font-bold text-xl font-mono'>
//                 livenessDecision: spoofface
//               </p>
//             </div>
//           )}
//       </div>

//       {/* ── Raw Azure status bar — no sugar coating ─────────────────────────── */}
//       {liveMode && rawAzureStatus && (
//         <div
//           className={`px-4 py-2.5 text-xs font-mono border-t flex items-start gap-2 ${statusBarClass}`}
//         >
//           <div className='flex-1'>
//             {status === 'capturing' && (
//               <LinearProgress
//                 variant='indeterminate'
//                 sx={{
//                   mb: 1,
//                   height: 2,
//                   borderRadius: 1,
//                   bgcolor: 'rgba(59,130,246,0.2)',
//                   '& .MuiLinearProgress-bar': { bgcolor: '#3b82f6' },
//                 }}
//               />
//             )}
//             <span className='font-semibold'>Azure: </span>
//             {rawAzureStatus.text}
//           </div>
//         </div>
//       )}

//       {/* ── Raw Azure JSON — shown after final decision ──────────────────────── */}
//       {livenessResult && (status === 'success' || status === 'failed') && (
//         <div
//           className={`px-4 py-3 border-t ${status === 'success' ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}
//         >
//           <p className='text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-2'>
//             Raw Azure Response
//           </p>
//           <pre className='text-[11px] font-mono text-gray-800 bg-white border border-gray-200 rounded p-2 overflow-x-auto max-h-48 overflow-y-auto whitespace-pre-wrap break-all'>
//             {JSON.stringify(livenessResult, null, 2)}
//           </pre>
//         </div>
//       )}

//       {/* ── Session attempt history ───────────────────────────────────────────── */}
//       {attempts.length > 0 && (
//         <div className='px-4 py-3 border-t border-gray-100 bg-gray-50'>
//           <p className='text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-2'>
//             Session Attempts
//           </p>
//           {attempts.map((a) => {
//             const isOk = a.attemptStatus === 'Succeeded';
//             return (
//               <div
//                 key={a.attemptId}
//                 className={`text-[11px] font-mono px-3 py-1.5 rounded border mb-1 ${isOk ? 'bg-green-50 border-green-300 text-green-800' : 'bg-red-50 border-red-300 text-red-800'}`}
//               >
//                 <span className='font-bold'>#{a.attemptId}</span>{' '}
//                 {a.attemptStatus}
//                 {a.result?.livenessDecision && (
//                   <span>
//                     {' '}
//                     → livenessDecision:{' '}
//                     <strong>{a.result.livenessDecision}</strong>
//                   </span>
//                 )}
//                 {a.error?.code && (
//                   <span>
//                     {' '}
//                     → error.code: <strong>{a.error.code}</strong> |{' '}
//                     {a.error.message}
//                   </span>
//                 )}
//               </div>
//             );
//           })}
//         </div>
//       )}

//       {/* ── Action buttons ────────────────────────────────────────────────────── */}
//       {liveMode && (
//         <div className='px-4 py-3 border-t border-gray-100 bg-gray-50 flex flex-wrap gap-2 items-center justify-between'>
//           <div className='flex gap-2 flex-wrap'>
//             {status === 'idle' && (
//               <button
//                 onClick={startDetection}
//                 className='flex items-center gap-1.5 bg-blue-600 hover:bg-blue-700 text-white text-xs font-semibold px-4 py-2 rounded-lg transition shadow-sm cursor-pointer'
//               >
//                 <RadioButtonCheckedIcon sx={{ fontSize: 15 }} /> Start
//               </button>
//             )}
//             {status === 'starting' && (
//               <div className='flex items-center gap-2 text-xs text-gray-600 px-2'>
//                 <CircularProgress size={14} />
//                 <span>Initializing...</span>
//               </div>
//             )}
//             {status === 'capturing' && (
//               <button
//                 onClick={stopDetection}
//                 className='flex items-center gap-1.5 bg-red-500 hover:bg-red-600 text-white text-xs font-semibold px-4 py-2 rounded-lg transition cursor-pointer'
//               >
//                 <StopIcon sx={{ fontSize: 15 }} /> Stop
//               </button>
//             )}
//             {(status === 'success' || status === 'failed') && (
//               <button
//                 onClick={resetDetection}
//                 className='flex items-center gap-1.5 bg-slate-600 hover:bg-slate-700 text-white text-xs font-semibold px-4 py-2 rounded-lg transition cursor-pointer'
//               >
//                 <ReplayIcon sx={{ fontSize: 15 }} /> Try Again
//               </button>
//             )}
//           </div>

//           {recordedBlob && (
//             <span className='text-[11px] text-gray-500 font-mono'>
//               🎥 {(recordedBlob.size / 1024).toFixed(0)} KB recorded
//             </span>
//           )}
//         </div>
//       )}

//       {/* ── Success footer ────────────────────────────────────────────────────── */}
//       {status === 'success' && (
//         <div className='px-4 py-2.5 bg-green-600 text-white text-xs font-semibold flex items-center gap-2'>
//           <CheckCircleIcon sx={{ fontSize: 16 }} />
//           <span>Liveness verified — ready to compare</span>
//           {recordedBlob && (
//             <span className='ml-auto text-green-200 font-mono text-[11px]'>
//               Recording ready ({(recordedBlob.size / 1024).toFixed(0)} KB)
//             </span>
//           )}
//         </div>
//       )}
//     </div>
//   );
// }

/////////--------------------------

import { CircularProgress, Chip } from '@mui/material';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import RadioButtonCheckedIcon from '@mui/icons-material/RadioButtonChecked';
import StopIcon from '@mui/icons-material/Stop';
import ReplayIcon from '@mui/icons-material/Replay';
import FiberManualRecordIcon from '@mui/icons-material/FiberManualRecord';
import VerifiedUserIcon from '@mui/icons-material/VerifiedUser';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';

export default function LiveDetection({
  sdkContainerRef,
  status,
  statusMessage,
  statusType,
  sdkLoaded,
  livenessDecision,
  isIdentical,
  matchConfidence,
  fullResult,
  isRecording,
  recordedBlob,
  recordingLabel,
  startDetection,
  stopDetection,
  resetDetection,
  // referenceImageBlob is passed by the parent so we can forward it to startDetection
  // referenceImageBlob,
}) {
  const borderColor =
    status === 'success'
      ? 'border-green-500'
      : status === 'failed'
        ? 'border-red-500'
        : status === 'sdk_running'
          ? 'border-blue-400'
          : 'border-gray-200';

  const statusBarClass =
    statusType === 'success'
      ? 'bg-green-50 text-green-900 border-green-200'
      : statusType === 'error'
        ? 'bg-red-50 text-red-900 border-red-200'
        : statusType === 'warning'
          ? 'bg-amber-50 text-amber-900 border-amber-200'
          : 'bg-gray-50 text-gray-700 border-gray-200';

  return (
    <div
      className={`border-2 ${borderColor} rounded-xl overflow-hidden bg-white shadow-sm flex flex-col transition-colors`}
    >
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className='flex items-center justify-between px-4 py-2.5 bg-gradient-to-r from-slate-700 to-slate-800'>
        <div className='flex items-center gap-2'>
          <div
            className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${
              status === 'success'
                ? 'bg-green-400'
                : status === 'failed'
                  ? 'bg-red-400'
                  : status === 'sdk_running'
                    ? 'bg-blue-400 animate-pulse'
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
              label={recordingLabel}
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

        {!sdkLoaded && (
          <span className='text-amber-300 text-xs font-mono'>
            SDK loading...
          </span>
        )}
      </div>

      {/* ── SDK container ──────────────────────────────────────────────────── */}
      {/* The Azure SDK mounts <azure-ai-vision-face-ui> here.
          It manages its own camera and shows the face oval overlay. */}
      <div
        ref={sdkContainerRef}
        className='relative bg-black flex items-center justify-center'
        style={{ minHeight: 300 }}
      >
        {/* Placeholder when SDK is not running */}
        {(status === 'idle' || status === 'starting') && (
          <div className='flex flex-col items-center gap-3 text-white/50 py-8'>
            {status === 'starting' ? (
              <>
                <CircularProgress size={40} sx={{ color: 'white' }} />
                <p className='text-sm'>Initializing...</p>
              </>
            ) : (
              <p className='text-sm'>
                Camera will start when you click "Start"
              </p>
            )}
          </div>
        )}

        {/* Success overlay */}
        {status === 'success' && (
          <div className='absolute inset-0 bg-green-900/85 flex flex-col items-center justify-center gap-3 z-10'>
            <VerifiedUserIcon sx={{ fontSize: 64, color: '#4ade80' }} />
            <p className='text-white font-bold text-xl'>Liveness Confirmed</p>
            {isIdentical !== null && (
              <p
                className={`font-semibold text-lg ${isIdentical ? 'text-green-300' : 'text-amber-300'}`}
              >
                {isIdentical ? '✅ Identity Match' : '⚠️ Identity Mismatch'}
              </p>
            )}
            {matchConfidence !== null && (
              <p className='text-white/80 text-sm font-mono'>
                Confidence: {(matchConfidence * 100).toFixed(1)}%
              </p>
            )}
          </div>
        )}

        {/* Failed overlay */}
        {status === 'failed' && (
          <div className='absolute inset-0 bg-red-900/80 flex flex-col items-center justify-center gap-3 z-10'>
            <WarningAmberIcon sx={{ fontSize: 56, color: '#fbbf24' }} />
            <p className='text-white font-bold text-xl'>
              {livenessDecision === 'spoofface'
                ? 'Spoof Detected'
                : 'Check Failed'}
            </p>
            <p className='text-red-300 text-sm text-center px-4'>
              {statusMessage}
            </p>
          </div>
        )}
      </div>

      {/* ── Status bar ─────────────────────────────────────────────────────── */}
      <div className={`px-4 py-2 text-xs border-t font-mono ${statusBarClass}`}>
        {status === 'sdk_running' && (
          <div className='h-1 bg-blue-200 rounded mb-1 overflow-hidden'>
            <div className='h-full bg-blue-500 animate-pulse w-2/3 rounded' />
          </div>
        )}
        {statusMessage}
      </div>

      {/* ── Full Azure JSON result ──────────────────────────────────────────── */}
      {fullResult && (status === 'success' || status === 'failed') && (
        <div
          className={`px-4 py-3 border-t ${status === 'success' ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'}`}
        >
          <p className='text-[11px] font-bold text-gray-500 uppercase tracking-wider mb-2'>
            Raw Azure Response
          </p>
          <pre className='text-[11px] font-mono text-gray-800 bg-white border border-gray-200 rounded p-2 overflow-x-auto max-h-48 overflow-y-auto whitespace-pre-wrap break-all'>
            {JSON.stringify(fullResult, null, 2)}
          </pre>
        </div>
      )}

      {/* ── Action buttons ─────────────────────────────────────────────────── */}
      <div className='px-4 py-3 border-t border-gray-100 bg-gray-50 flex flex-wrap gap-2 items-center justify-between'>
        <div className='flex gap-2 flex-wrap'>
          {status === 'idle' && (
            <button
              onClick={() => startDetection()}
              disabled={!sdkLoaded}
              className={`flex items-center gap-1.5 text-white text-xs font-semibold px-4 py-2 rounded-lg transition shadow-sm cursor-pointer ${
                sdkLoaded
                  ? 'bg-blue-600 hover:bg-blue-700'
                  : 'bg-gray-400 cursor-not-allowed'
              }`}
            >
              <RadioButtonCheckedIcon sx={{ fontSize: 15 }} />
              {sdkLoaded ? 'Start' : 'SDK Loading...'}
            </button>
          )}

          {(status === 'starting' || status === 'sdk_running') && (
            <button
              onClick={stopDetection}
              className='flex items-center gap-1.5 bg-red-500 hover:bg-red-600 text-white text-xs font-semibold px-4 py-2 rounded-lg transition cursor-pointer'
            >
              <StopIcon sx={{ fontSize: 15 }} /> Stop
            </button>
          )}

          {(status === 'success' || status === 'failed') && (
            <button
              onClick={resetDetection}
              className='flex items-center gap-1.5 bg-slate-600 hover:bg-slate-700 text-white text-xs font-semibold px-4 py-2 rounded-lg transition cursor-pointer'
            >
              <ReplayIcon sx={{ fontSize: 15 }} /> Try Again
            </button>
          )}
        </div>

        {recordedBlob && (
          <span className='text-[11px] text-gray-500 font-mono'>
            🎥 {(recordedBlob.size / 1024).toFixed(0)} KB recorded
          </span>
        )}
      </div>

      {/* ── Success footer ──────────────────────────────────────────────────── */}
      {status === 'success' && (
        <div className='px-4 py-2.5 bg-green-600 text-white text-xs font-semibold flex items-center gap-2'>
          <CheckCircleIcon sx={{ fontSize: 16 }} />
          <span>Liveness verified — ready to compare</span>
          {recordedBlob && (
            <span className='ml-auto text-green-200 font-mono text-[11px]'>
              Recording ready ({(recordedBlob.size / 1024).toFixed(0)} KB)
            </span>
          )}
        </div>
      )}
    </div>
  );
}
