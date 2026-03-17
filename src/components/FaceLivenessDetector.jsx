// import React, { useState } from 'react';
// import FaceLivenessDetectorComponent from './face/Face';

// // Result View static assets
// const checkmarkCircleIcon = 'CheckmarkCircle.png';
// const heartPulseIcon = 'HeartPulse.png';
// const personIcon = 'Person.png';

// // const buttonStyle =
// //   'relative w-[20px] text-white bg-[#036ac4] hover:bg-[#0473ce] flex grow px-2.5 py-1.5 rounded-md text-sm md:text-[1.1rem]';

// const buttonStyle =
//   'text-white bg-[#036ac4] hover:bg-[#0473ce] px-4 py-1 rounded-md text-sm md:text-[1.1rem]';

// const imageButtonStyle =
//   'relative text-white bg-[#838383] hover:bg-[#9A9A9A] flex grow px-2.5 py-1.5 rounded-md text-sm md:text-[1.1rem] cursor-pointer';

// export default function FaceLivenessDetector() {
//   const [verifyImage, setVerifyImage] = useState(undefined);
//   const [errorMessage, setErrorMessage] = useState('');
//   const [livenessOperationMode, setLivenessOperationMode] =
//     useState('PassiveActive');
//   const [livenessDetectorState, setLivenessDetectorState] = useState('Initial');
//   const [isDetectLivenessWithVerify, setIsDetectLivenessWithVerify] =
//     useState(false);
//   const [livenessIcon, setLivenessIcon] = useState(checkmarkCircleIcon);
//   const [livenessText, setLivenessText] = useState('Real Person');
//   const [recognitionIcon, setRecognitionIcon] = useState(checkmarkCircleIcon);
//   const [recognitionText, setRecognitionText] = useState('Same Person');

//   function handleFile(e) {
//     if (e.target.files && e.target.files.length > 0) {
//       setVerifyImage(e.target.files[0]);
//     } else {
//       setVerifyImage(undefined);
//     }
//   }

//   function initFaceLivenessDetector(livenessOperation) {
//     setLivenessOperationMode(livenessOperation);
//     setLivenessDetectorState('LivenessDetector');
//   }

//   function continueFaceLivenessDetector() {
//     setLivenessDetectorState('Initial');
//     setVerifyImage(undefined);
//   }

//   function displayResult(isWithVerify) {
//     setIsDetectLivenessWithVerify(isWithVerify);
//     setLivenessDetectorState('Result');
//   }

//   function fetchFailureCallback(error) {
//     setErrorMessage(error);
//     setLivenessDetectorState('Retry');
//   }

//   return (
//     <>
//       {livenessDetectorState === 'Initial' && (
//         <InitialView
//           verifyImage={verifyImage}
//           handleFile={handleFile}
//           initFaceLivenessDetector={initFaceLivenessDetector}
//         />
//       )}
//       {livenessDetectorState === 'LivenessDetector' && (
//         <FaceLivenessDetectorComponent
//           livenessOperationMode={livenessOperationMode}
//           file={verifyImage}
//           setIsDetectLivenessWithVerify={displayResult}
//           fetchFailureCallback={fetchFailureCallback}
//           setLivenessIcon={setLivenessIcon}
//           setLivenessText={setLivenessText}
//           setRecognitionIcon={setRecognitionIcon}
//           setRecognitionText={setRecognitionText}
//         />
//       )}
//       {livenessDetectorState === 'Result' && (
//         <ResultView
//           livenessIcon={livenessIcon}
//           livenessText={livenessText}
//           recognitionIcon={recognitionIcon}
//           recognitionText={recognitionText}
//           continueFunction={continueFaceLivenessDetector}
//           isDetectLivenessWithVerify={isDetectLivenessWithVerify}
//         />
//       )}
//       {livenessDetectorState === 'Retry' && (
//         <RetryView
//           errorMessage={errorMessage}
//           retryFunction={continueFaceLivenessDetector}
//         />
//       )}
//     </>
//   );
// }

// // --- InitialView ---
// const InitialView = ({ verifyImage, handleFile, initFaceLivenessDetector }) => {
//   return (
//     <>
//       <iframe
//         id='splash'
//         title='splash'
//         src='splash.html'
//         role='status'
//         className='flex-[1_1_80vh] min-h-[60vh] max-h-[90vh] w-full border-none z-50 bg-white relative'
//       />
//       {/* <div className='flex-[0_1_20vh] flex gap-y-4 md:flex-row flex-col justify-center mb-[2vh] pb-[2vh] items-center min-h-fit text-2xl md:gap-y-0 md:gap-x-4 max-sm:text-base'>
//         <label className={imageButtonStyle}>
//           <input
//             onChange={handleFile}
//             type='file'
//             accept='image/*'
//             id='useVerifyImageFileInput'
//             className='hidden'
//           />
//           Select Verify Image
//         </label>
//       </div>
//       {verifyImage && (
//         <img
//           className='mx-auto mb-[2vh] pb-[2vh] w-[100px] h-[100px] object-cover'
//           src={URL.createObjectURL(verifyImage)}
//           alt='uploaded image'
//         />
//       )} */}
//       <div className='flex-[0_1_20vh] flex items-center flex-row gap-x-4 mb-[2vh] pb-[2vh] min-h-fit justify-center mt-6'>
//         <button
//           type='button'
//           onClick={() => initFaceLivenessDetector('Passive')}
//           className={buttonStyle}
//         >
//           Start Passive
//         </button>
//         <button
//           type='button'
//           onClick={() => initFaceLivenessDetector('PassiveActive')}
//           className={buttonStyle}
//         >
//           Start PassiveActive
//         </button>
//       </div>
//     </>
//   );
// };

// // --- ResultView ---
// const ResultView = ({
//   isDetectLivenessWithVerify,
//   livenessIcon,
//   livenessText,
//   recognitionIcon,
//   recognitionText,
//   continueFunction,
// }) => {
//   return (
//     <div className='flex flex-col h-screen justify-start items-center py-24 gap-y-24 text-xl md:text-3xl'>
//       <div className='flex flex-col justify-start items-center gap-y-4'>
//         <div className='flex flex-row items-center gap-x-2'>
//           <img src={heartPulseIcon} alt='Liveness Icon' />
//           <span>Liveness</span>
//         </div>
//         <div className='flex flex-row items-center gap-x-2'>
//           <img src={livenessIcon} alt='Liveness Status Icon' />
//           <span>{livenessText}</span>
//         </div>

//         {isDetectLivenessWithVerify && (
//           <>
//             <div className='w-40 h-0 border border-transparent border-t-gray-500' />
//             <div className='flex flex-row items-center gap-x-2'>
//               <img src={personIcon} alt='Verification Icon' />
//               <span>Verification</span>
//             </div>
//             <div className='flex flex-row items-center gap-x-2'>
//               <img src={recognitionIcon} alt='Recognition Status Icon' />
//               <span>{recognitionText}</span>
//             </div>
//           </>
//         )}
//       </div>
//       {continueFunction !== undefined && (
//         <div>
//           <button onClick={continueFunction} className={buttonStyle}>
//             Continue
//           </button>
//         </div>
//       )}
//     </div>
//   );
// };

// // --- RetryView ---
// const RetryView = ({ errorMessage, retryFunction }) => {
//   return (
//     <div className='flex flex-col h-screen justify-start items-center py-24 gap-y-24 text-lg md:text-2xl'>
//       <p className='text-center w-[80%] text-wrap'>{errorMessage}</p>
//       {retryFunction !== undefined && (
//         <div>
//           <button onClick={retryFunction} className={buttonStyle}>
//             Retry
//           </button>
//         </div>
//       )}
//     </div>
//   );
// };

/////////////////////////////////////////

// import React, { useState } from 'react';
// import FaceLivenessDetectorComponent from './face/Face';

// // Result View static assets
// const checkmarkCircleIcon = 'CheckmarkCircle.png';
// const heartPulseIcon = 'HeartPulse.png';
// const personIcon = 'Person.png';

// const buttonStyle =
//   'relative text-white bg-[#036ac4] hover:bg-[#0473ce] flex grow px-2.5 py-1.5 rounded-md text-sm md:text-[1.1rem]';

// const imageButtonStyle =
//   'relative text-white bg-[#838383] hover:bg-[#9A9A9A] flex grow px-2.5 py-1.5 rounded-md text-sm md:text-[1.1rem] cursor-pointer';

// export default function FaceLivenessDetector({
//   onComplete = null,
//   onError = null,
//   mode = 'PassiveActive',
//   verifyImage: externalVerifyImage = undefined,
// }) {
//   const isEmbedded = typeof onComplete === 'function';

//   const [verifyImage, setVerifyImage] = useState(externalVerifyImage);
//   const [errorMessage, setErrorMessage] = useState('');

//   // Embedded → skip Initial, go straight to LivenessDetector
//   const [livenessDetectorState, setLivenessDetectorState] = useState(
//     isEmbedded ? 'LivenessDetector' : 'Initial',
//   );

//   const [livenessOperationMode, setLivenessOperationMode] = useState(
//     isEmbedded ? mode : 'PassiveActive',
//   );

//   const [isDetectLivenessWithVerify, setIsDetectLivenessWithVerify] =
//     useState(false);
//   const [livenessIcon, setLivenessIcon] = useState(checkmarkCircleIcon);
//   const [livenessText, setLivenessText] = useState('Real Person');
//   const [recognitionIcon, setRecognitionIcon] = useState(checkmarkCircleIcon);
//   const [recognitionText, setRecognitionText] = useState('Same Person');

//   // ── Standalone only ────────────────────────────────────────────────────────
//   function handleFile(e) {
//     if (e.target.files && e.target.files.length > 0) {
//       setVerifyImage(e.target.files[0]);
//     } else {
//       setVerifyImage(undefined);
//     }
//   }

//   function initFaceLivenessDetector(livenessOperation) {
//     setLivenessOperationMode(livenessOperation);
//     setLivenessDetectorState('LivenessDetector');
//   }

//   function continueFaceLivenessDetector() {
//     setLivenessDetectorState('Initial');
//     setVerifyImage(undefined);
//   }

//   // ── Shared ─────────────────────────────────────────────────────────────────

//   // Called by FaceLivenessDetectorComponent when SDK finishes
//   function displayResult(isWithVerify) {
//     setIsDetectLivenessWithVerify(isWithVerify);
//     setLivenessDetectorState('Result');

//     // Embedded mode → fire onComplete with result
//     // setTimeout(0) lets React flush setLivenessText/setLivenessIcon first
//     if (isEmbedded) {
//       setTimeout(() => {
//         const decision =
//           livenessText === 'Real Person' ? 'realface' : 'spoofface';
//         onComplete({
//           decision,
//           status: decision === 'realface' ? 'passed' : 'failed',
//           livenessText,
//           livenessIcon,
//           recognitionText,
//           recognitionIcon,
//           isWithVerify,
//         });
//       }, 0);
//     }
//   }

//   // Called by FaceLivenessDetectorComponent on token/session failure
//   function fetchFailureCallback(error) {
//     setErrorMessage(error);
//     setLivenessDetectorState('Retry');
//     if (isEmbedded && onError) {
//       onError(error);
//     }
//   }

//   // Retry in embedded mode
//   function handleEmbeddedRetry() {
//     setLivenessDetectorState('LivenessDetector');
//     setErrorMessage('');
//   }

//   // ── Render ─────────────────────────────────────────────────────────────────
//   return (
//     <>
//       {/* INITIAL — standalone only */}
//       {livenessDetectorState === 'Initial' && !isEmbedded && (
//         <InitialView
//           verifyImage={verifyImage}
//           handleFile={handleFile}
//           initFaceLivenessDetector={initFaceLivenessDetector}
//         />
//       )}

//       {/* LIVENESS DETECTOR — both modes */}
//       {livenessDetectorState === 'LivenessDetector' && (
//         <FaceLivenessDetectorComponent
//           livenessOperationMode={livenessOperationMode}
//           file={verifyImage}
//           setIsDetectLivenessWithVerify={displayResult}
//           fetchFailureCallback={fetchFailureCallback}
//           setLivenessIcon={setLivenessIcon}
//           setLivenessText={setLivenessText}
//           setRecognitionIcon={setRecognitionIcon}
//           setRecognitionText={setRecognitionText}
//         />
//       )}

//       {/* RESULT — standalone only (embedded fires onComplete instead) */}
//       {livenessDetectorState === 'Result' && !isEmbedded && (
//         <ResultView
//           livenessIcon={livenessIcon}
//           livenessText={livenessText}
//           recognitionIcon={recognitionIcon}
//           recognitionText={recognitionText}
//           continueFunction={continueFaceLivenessDetector}
//           isDetectLivenessWithVerify={isDetectLivenessWithVerify}
//         />
//       )}

//       {/* RETRY — standalone full screen */}
//       {livenessDetectorState === 'Retry' && !isEmbedded && (
//         <RetryView
//           errorMessage={errorMessage}
//           retryFunction={continueFaceLivenessDetector}
//         />
//       )}

//       {/* RETRY — embedded minimal */}
//       {livenessDetectorState === 'Retry' && isEmbedded && (
//         <div className='flex flex-col items-center justify-center py-10 gap-4 text-center px-4'>
//           <p className='text-sm text-red-600 font-medium'>{errorMessage}</p>
//           <button onClick={handleEmbeddedRetry} className={buttonStyle}>
//             Retry
//           </button>
//         </div>
//       )}
//     </>
//   );
// }

// // ── InitialView (standalone only) ─────────────────────────────────────────────
// const InitialView = ({ verifyImage, handleFile, initFaceLivenessDetector }) => {
//   return (
//     <>
//       <iframe
//         id='splash'
//         title='splash'
//         src='splash.html'
//         role='status'
//         className='flex-[1_1_80vh] min-h-[50vh] max-h-[70vh] w-full border-none z-50 bg-white relative'
//       />
//       <div className='flex-[0_1_20vh] flex gap-y-4 md:flex-row flex-col justify-center mb-[2vh] pb-[2vh] items-center min-h-fit text-2xl md:gap-y-0 md:gap-x-4 max-sm:text-base'>
//         <label className={imageButtonStyle}>
//           <input
//             onChange={handleFile}
//             type='file'
//             accept='image/*'
//             id='useVerifyImageFileInput'
//             className='hidden'
//           />
//           Select Verify Image
//         </label>
//       </div>
//       {verifyImage && (
//         <img
//           className='mx-auto mb-[2vh] pb-[2vh] w-[100px] h-[100px] object-cover'
//           src={URL.createObjectURL(verifyImage)}
//           alt='uploaded image'
//         />
//       )}
//       <div className='flex-[0_1_20vh] flex items-center flex-row gap-x-4 mb-[2vh] pb-[2vh] min-h-fit justify-center'>
//         <button
//           type='button'
//           onClick={() => initFaceLivenessDetector('Passive')}
//           className={buttonStyle}
//         >
//           Start Passive
//         </button>
//         <button
//           type='button'
//           onClick={() => initFaceLivenessDetector('PassiveActive')}
//           className={buttonStyle}
//         >
//           Start PassiveActive
//         </button>
//       </div>
//     </>
//   );
// };

// // ── ResultView (standalone only) ──────────────────────────────────────────────
// const ResultView = ({
//   isDetectLivenessWithVerify,
//   livenessIcon,
//   livenessText,
//   recognitionIcon,
//   recognitionText,
//   continueFunction,
// }) => {
//   return (
//     <div className='flex flex-col h-screen justify-start items-center py-24 gap-y-24 text-xl md:text-3xl'>
//       <div className='flex flex-col justify-start items-center gap-y-4'>
//         <div className='flex flex-row items-center gap-x-2'>
//           <img src={heartPulseIcon} alt='Liveness Icon' />
//           <span>Liveness</span>
//         </div>
//         <div className='flex flex-row items-center gap-x-2'>
//           <img src={livenessIcon} alt='Liveness Status Icon' />
//           <span>{livenessText}</span>
//         </div>
//         {isDetectLivenessWithVerify && (
//           <>
//             <div className='w-40 h-0 border border-transparent border-t-gray-500' />
//             <div className='flex flex-row items-center gap-x-2'>
//               <img src={personIcon} alt='Verification Icon' />
//               <span>Verification</span>
//             </div>
//             <div className='flex flex-row items-center gap-x-2'>
//               <img src={recognitionIcon} alt='Recognition Status Icon' />
//               <span>{recognitionText}</span>
//             </div>
//           </>
//         )}
//       </div>
//       {continueFunction !== undefined && (
//         <div>
//           <button onClick={continueFunction} className={buttonStyle}>
//             Continue
//           </button>
//         </div>
//       )}
//     </div>
//   );
// };

// // ── RetryView (standalone only) ───────────────────────────────────────────────
// const RetryView = ({ errorMessage, retryFunction }) => {
//   return (
//     <div className='flex flex-col h-screen justify-start items-center py-24 gap-y-24 text-lg md:text-2xl'>
//       <p className='text-center w-[80%] text-wrap'>{errorMessage}</p>
//       {retryFunction !== undefined && (
//         <div>
//           <button onClick={retryFunction} className={buttonStyle}>
//             Retry
//           </button>
//         </div>
//       )}
//     </div>
//   );
// };

import React, { useState } from 'react';
import FaceLivenessDetectorComponent from './face/Face';

const checkmarkCircleIcon = 'CheckmarkCircle.png';
const heartPulseIcon = 'HeartPulse.png';
const personIcon = 'Person.png';

const buttonStyle =
  'text-white bg-[#036ac4] hover:bg-[#0473ce] px-4 py-1 rounded-md text-sm md:text-[1.1rem]';

export default function FaceLivenessDetector({ onComplete, onError }) {
  const [verifyImage, setVerifyImage] = useState(undefined);
  const [errorMessage, setErrorMessage] = useState('');
  const [livenessOperationMode, setLivenessOperationMode] =
    useState('PassiveActive');
  const [livenessDetectorState, setLivenessDetectorState] = useState('Initial');
  const [isDetectLivenessWithVerify, setIsDetectLivenessWithVerify] =
    useState(false);
  const [livenessIcon, setLivenessIcon] = useState(checkmarkCircleIcon);
  const [livenessText, setLivenessText] = useState('Real Person');
  const [recognitionIcon, setRecognitionIcon] = useState(checkmarkCircleIcon);
  const [recognitionText, setRecognitionText] = useState('Same Person');

  function initFaceLivenessDetector(livenessOperation) {
    setLivenessOperationMode(livenessOperation);
    setLivenessDetectorState('LivenessDetector');
  }

  function continueFaceLivenessDetector() {
    // Used only for Retry — resets back to Initial
    setLivenessDetectorState('Initial');
    setVerifyImage(undefined);
  }

  function displayResult(isWithVerify) {
    setIsDetectLivenessWithVerify(isWithVerify);
    setLivenessDetectorState('Result');
  }

  // Called when user clicks "Continue" on result screen
  function handleContinue() {
    if (onComplete) {
      onComplete({
        decision: 'realface',
        livenessText: livenessText,
      });
    }
  }

  function fetchFailureCallback(error) {
    setErrorMessage(error);
    setLivenessDetectorState('Retry');
    if (onError) onError(error);
  }

  return (
    <>
      {livenessDetectorState === 'Initial' && (
        <InitialView
          verifyImage={verifyImage}
          initFaceLivenessDetector={initFaceLivenessDetector}
        />
      )}
      {livenessDetectorState === 'LivenessDetector' && (
        <FaceLivenessDetectorComponent
          livenessOperationMode={livenessOperationMode}
          file={verifyImage}
          setIsDetectLivenessWithVerify={displayResult}
          fetchFailureCallback={fetchFailureCallback}
          setLivenessIcon={setLivenessIcon}
          setLivenessText={setLivenessText}
          setRecognitionIcon={setRecognitionIcon}
          setRecognitionText={setRecognitionText}
        />
      )}
      {livenessDetectorState === 'Result' && (
        <ResultView
          livenessIcon={livenessIcon}
          livenessText={livenessText}
          recognitionIcon={recognitionIcon}
          recognitionText={recognitionText}
          continueFunction={handleContinue}
          isDetectLivenessWithVerify={isDetectLivenessWithVerify}
        />
      )}
      {livenessDetectorState === 'Retry' && (
        <RetryView
          errorMessage={errorMessage}
          retryFunction={continueFaceLivenessDetector}
        />
      )}
    </>
  );
}

const InitialView = ({ initFaceLivenessDetector }) => (
  <>
    <iframe
      id='splash'
      title='splash'
      src='splash.html'
      role='status'
      className='flex-[1_1_80vh] min-h-[60vh] max-h-[90vh] w-full border-none z-50 bg-white relative'
    />
    <div className='flex-[0_1_20vh] flex items-center flex-row gap-x-4 mb-[2vh] pb-[4vh] min-h-fit justify-center mt-6'>
      <button
        type='button'
        onClick={() => initFaceLivenessDetector('Passive')}
        className='text-white bg-[#036ac4] hover:bg-[#0473ce] px-4 py-1 cursor-pointer rounded-md text-sm md:text-[1.1rem]'
      >
        Start Passive
      </button>
      <button
        type='button'
        onClick={() => initFaceLivenessDetector('PassiveActive')}
        className='text-white bg-[#036ac4] hover:bg-[#0473ce] px-4 py-1 cursor-pointer rounded-md text-sm md:text-[1.1rem]'
      >
        Start PassiveActive
      </button>
    </div>
  </>
);

const ResultView = ({
  isDetectLivenessWithVerify,
  livenessIcon,
  livenessText,
  recognitionIcon,
  recognitionText,
  continueFunction,
}) => (
  <div className='flex flex-col h-screen justify-start items-center py-24 gap-y-24 text-xl md:text-3xl'>
    <div className='flex flex-col justify-start items-center gap-y-4'>
      <div className='flex flex-row items-center gap-x-2'>
        <img src='HeartPulse.png' alt='Liveness Icon' />
        <span>Liveness</span>
      </div>
      <div className='flex flex-row items-center gap-x-2'>
        <img src={livenessIcon} alt='Liveness Status Icon' />
        <span>{livenessText}</span>
      </div>
      {isDetectLivenessWithVerify && (
        <>
          <div className='w-40 h-0 border border-transparent border-t-gray-500' />
          <div className='flex flex-row items-center gap-x-2'>
            <img src='Person.png' alt='Verification Icon' />
            <span>Verification</span>
          </div>
          <div className='flex flex-row items-center gap-x-2'>
            <img src={recognitionIcon} alt='Recognition Status Icon' />
            <span>{recognitionText}</span>
          </div>
        </>
      )}
    </div>
    {continueFunction && (
      <button
        onClick={continueFunction}
        className='text-white bg-[#036ac4] hover:bg-[#0473ce] cursor-pointer px-4 py-1 rounded-md text-sm md:text-[1.1rem]'
      >
        Continue →
      </button>
    )}
  </div>
);

const RetryView = ({ errorMessage, retryFunction }) => (
  <div className='flex flex-col h-screen justify-start items-center py-24 gap-y-24 text-lg md:text-2xl'>
    <p className='text-center w-[80%] text-wrap'>{errorMessage}</p>
    {retryFunction && (
      <button
        onClick={retryFunction}
        className='text-white bg-[#036ac4] hover:bg-[#0473ce] px-4 py-1 rounded-md text-sm md:text-[1.1rem]'
      >
        Retry
      </button>
    )}
  </div>
);
