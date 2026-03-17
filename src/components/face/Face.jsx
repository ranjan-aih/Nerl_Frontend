import '@azure/ai-vision-face-ui';
import React, { useEffect, useRef, useState } from 'react';
import { fetchTokenFromAPI, fetchSessionResultFromAPI } from './utils';

// Result page static assets
const checkmarkCircleIcon = 'CheckmarkCircle.png';
const dismissCircleIcon = 'DismissCircle.png';

const Face = ({
  livenessOperationMode,
  file,
  setIsDetectLivenessWithVerify,
  fetchFailureCallback,
  setLivenessIcon,
  setRecognitionIcon,
  setLivenessText,
  setRecognitionText,
}) => {
  const [sessionData, setSessionData] = useState(null);
  const [loadingToken, setLoadingToken] = useState(true);
  const [errorMessage, setErrorMessage] = useState('');
  const containerRef = useRef(null);

  // Step 2: Obtain session-authorization-token.
  useEffect(() => {
    fetchTokenFromAPI(
      livenessOperationMode,
      file,
      setSessionData,
      setLoadingToken,
      setErrorMessage,
    );
  }, []);

  useEffect(() => {
    if (!sessionData && !loadingToken && fetchFailureCallback) {
      fetchFailureCallback(errorMessage);
    }
  }, [sessionData, loadingToken]);

  useEffect(() => {
    if (!sessionData) return;

    let action =
      file !== undefined ? 'detectLivenessWithVerify' : 'detectLiveness';

    // Step 3: Query the azure-ai-vision-face-ui element to process face liveness.
    var faceLivenessDetector = document.querySelector(
      'azure-ai-vision-face-ui',
    );

    // Step 4: Create the FaceLivenessDetector element and attach it to DOM.
    if (faceLivenessDetector == null) {
      faceLivenessDetector = document.createElement('azure-ai-vision-face-ui');
      containerRef.current.appendChild(faceLivenessDetector);
    }

    // Step 5: Start the face liveness check session and handle the promise.
    faceLivenessDetector
      .start(sessionData?.authToken)
      .then(async (resultData) => {
        console.log(resultData);
        setIsDetectLivenessWithVerify(action === 'detectLivenessWithVerify');

        var sessionResult = await fetchSessionResultFromAPI(
          action,
          sessionData?.sessionId,
        );

        // Set Liveness Status Results
        const livenessStatus =
          sessionResult.results.attempts[0].result.livenessDecision;
        const livenessStatusCondition = livenessStatus === 'realface';
        const livenessIconResult = livenessStatusCondition
          ? checkmarkCircleIcon
          : dismissCircleIcon;

        let livenessText = livenessStatusCondition ? 'Real Person' : 'Spoof';

        setLivenessIcon && setLivenessIcon(livenessIconResult);
        setLivenessText && setLivenessText(livenessText);

        // Set Recognition Status Results (if applicable)
        if (action === 'detectLivenessWithVerify') {
          const recognitionStatusCondition =
            sessionResult.results.attempts[0].result.verifyResult.isIdentical;
          const recognitionIconResult = recognitionStatusCondition
            ? checkmarkCircleIcon
            : dismissCircleIcon;
          let recognitionText = recognitionStatusCondition
            ? 'Same Person'
            : 'Not the same person';

          setRecognitionIcon && setRecognitionIcon(recognitionIconResult);
          setRecognitionText && setRecognitionText(recognitionText);
        }
      })
      .catch((error) => {
        let livenessText = error.livenessError;
        const livenessIconResult = dismissCircleIcon;
        setLivenessIcon && setLivenessIcon(livenessIconResult);
        setLivenessText && setLivenessText(livenessText);

        if (action === 'detectLivenessWithVerify') {
          let recognitionText = error.recognitionError;
          const recognitionIconResult = dismissCircleIcon;
          setRecognitionIcon && setRecognitionIcon(recognitionIconResult);
          setRecognitionText && setRecognitionText(recognitionText);
        }
      });

    // Step 6: Cleanup on component unmount
    return () => {
      if (
        faceLivenessDetector &&
        containerRef.current &&
        containerRef.current.contains(faceLivenessDetector)
      ) {
        containerRef.current.removeChild(faceLivenessDetector);
      }
    };
  }, [sessionData]);

  return (
    <div style={{ padding: '0 20px', fontSize: '14px' }}>
      <div id='container' ref={containerRef}></div>
    </div>
  );
};

export default Face;
