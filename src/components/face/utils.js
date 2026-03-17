export async function fetchTokenFromAPI(
  livenessOperationMode,
  file,
  setSessionData,
  setLoadingToken,
  setErrorMessage,
) {
  let action =
    file !== undefined ? 'detectLivenessWithVerify' : 'detectLiveness';

  let parameters = {
    livenessOperationMode,
    deviceCorrelationId: await getDummyDeviceId(),
    userCorrelationId: await getDummyUserId(),
  };

  let sessionCreationBody = new FormData();
  sessionCreationBody.append('Action', action);
  sessionCreationBody.append('parameters', JSON.stringify(parameters));

  if (action === 'detectLivenessWithVerify' && file !== undefined) {
    sessionCreationBody.append('verifyImage', file, file.name);
  }

  const res = await fetch(`/api/generateAccessToken`, {
    method: 'POST',
    body: sessionCreationBody,
  });

  const sessionData = await res.json();

  if (!res.ok) {
    if (setErrorMessage) {
      setErrorMessage(sessionData.error.message);
    }
    if (setLoadingToken) {
      setLoadingToken(false);
    }
    return;
  }

  setSessionData(sessionData.sessionData);
}

export async function fetchSessionResultFromAPI(action, sessionId) {
  const res = await fetch(
    `/api/getSessionResult?action=${action}&sessionId=${sessionId}`,
    {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    },
  );

  const sessionData = await res.json();
  return sessionData;
}

export const getDummyUserId = async () => {
  let userId =
    globalThis.crypto?.randomUUID()?.replace(/-/g, '') || '0'.repeat(64);

  userId = '0'.repeat(64 - userId.length) + userId;
  userId = (
    BigInt('0x' + userId.substring(0, 32)) ^
    BigInt('0x' + userId.substring(32, 64))
  )
    .toString(16)
    .substring(0, 32);
  userId =
    ('0'.repeat(32 - userId.length) + userId)
      .match(/^(.{8})(.{4})(.{4})(.{4})(.{12})$/)
      ?.slice(1)
      .join('-') || '';

  return userId;
};

export const getDummyDeviceId = async () => {
  let deviceId = (await navigator.mediaDevices.enumerateDevices()).find(
    (device) => device.deviceId !== '',
  )?.deviceId;

  if (deviceId) {
    deviceId = deviceId.endsWith('=')
      ? Array.from(atob(deviceId), (char) =>
          ('0' + char.charCodeAt(0).toString(16)).slice(-2),
        ).join('')
      : deviceId;
  } else {
    deviceId =
      globalThis.crypto?.randomUUID()?.replace(/-/g, '') || '0'.repeat(64);
  }

  deviceId = '0'.repeat(64 - deviceId.length) + deviceId;
  deviceId = (
    BigInt('0x' + deviceId.substring(0, 32)) ^
    BigInt('0x' + deviceId.substring(32, 64))
  )
    .toString(16)
    .substring(0, 32);
  deviceId =
    ('0'.repeat(32 - deviceId.length) + deviceId)
      .match(/^(.{8})(.{4})(.{4})(.{4})(.{12})$/)
      ?.slice(1)
      .join('-') || '';

  return deviceId;
};

// // utils.js

// export const getDummyUserId = async () => {
//   let userId =
//     globalThis.crypto?.randomUUID()?.replace(/-/g, '') || '0'.repeat(64);
//   userId = '0'.repeat(64 - userId.length) + userId;
//   userId = (
//     BigInt('0x' + userId.substring(0, 32)) ^
//     BigInt('0x' + userId.substring(32, 64))
//   )
//     .toString(16)
//     .substring(0, 32);
//   userId =
//     ('0'.repeat(32 - userId.length) + userId)
//       .match(/^(.{8})(.{4})(.{4})(.{4})(.{12})$/)
//       ?.slice(1)
//       .join('-') || '';
//   return userId;
// };

// export const getDummyDeviceId = async () => {
//   let deviceId = (await navigator.mediaDevices.enumerateDevices()).find(
//     (device) => device.deviceId !== '',
//   )?.deviceId;

//   if (deviceId) {
//     deviceId = deviceId.endsWith('=')
//       ? Array.from(atob(deviceId), (char) =>
//           ('0' + char.charCodeAt(0).toString(16)).slice(-2),
//         ).join('')
//       : deviceId;
//   } else {
//     deviceId =
//       globalThis.crypto?.randomUUID()?.replace(/-/g, '') || '0'.repeat(64);
//   }

//   deviceId = '0'.repeat(64 - deviceId.length) + deviceId;
//   deviceId = (
//     BigInt('0x' + deviceId.substring(0, 32)) ^
//     BigInt('0x' + deviceId.substring(32, 64))
//   )
//     .toString(16)
//     .substring(0, 32);
//   deviceId =
//     ('0'.repeat(32 - deviceId.length) + deviceId)
//       .match(/^(.{8})(.{4})(.{4})(.{4})(.{12})$/)
//       ?.slice(1)
//       .join('-') || '';
//   return deviceId;
// };

// export async function fetchTokenFromAPI(
//   livenessOperationMode,
//   file,
//   setSessionData,
//   setLoadingToken,
//   setErrorMessage,
// ) {
//   const action =
//     file !== undefined ? 'detectLivenessWithVerify' : 'detectLiveness';

//   const parameters = {
//     livenessOperationMode,
//     deviceCorrelationId: await getDummyDeviceId(),
//     userCorrelationId: await getDummyUserId(),
//   };

//   const sessionCreationBody = new FormData();
//   sessionCreationBody.append('Action', action);
//   sessionCreationBody.append('parameters', JSON.stringify(parameters));

//   if (action === 'detectLivenessWithVerify' && file !== undefined) {
//     sessionCreationBody.append('verifyImage', file, file.name);
//   }

//   const res = await fetch(`/api/generateAccessToken`, {
//     method: 'POST',
//     body: sessionCreationBody,
//   });

//   const sessionData = await res.json();

//   if (!res.ok) {
//     if (setErrorMessage) setErrorMessage(sessionData.error.message);
//     if (setLoadingToken) setLoadingToken(false);
//     return;
//   }

//   setSessionData(sessionData.sessionData);
//   if (setLoadingToken) setLoadingToken(false);
// }

// export async function fetchSessionResultFromAPI(action, sessionId) {
//   const res = await fetch(
//     `/api/getSessionResult?action=${action}&sessionId=${sessionId}`,
//     {
//       method: 'GET',
//       headers: { 'Content-Type': 'application/json' },
//     },
//   );
//   const sessionData = await res.json();
//   return sessionData;
// }
