import axiosInstance from './axiosInstance';

// Small helper: get a filename from a URL
const getFilenameFromUrl = (url, fallback = 'file.jpg') => {
  if (!url) return fallback;
  const parts = url.split('/');
  const last = parts[parts.length - 1];
  return last || fallback;
};

export const verifyPhoto = async (referenceUrl, providedUrls) => {
  try {
    console.log('verifyPhoto() called with:', { referenceUrl, providedUrls });

    const providedList = Array.isArray(providedUrls)
      ? providedUrls
      : [providedUrls];

    const refResponse = await fetch(referenceUrl);
    if (!refResponse.ok) {
      throw new Error(
        `Failed to load reference image: ${refResponse.status} ${refResponse.statusText}`,
      );
    }
    const refBlob = await refResponse.blob();

    const providedBlobs = [];
    for (const url of providedList) {
      const resp = await fetch(url);
      if (!resp.ok) {
        throw new Error(
          `Failed to load provided image: ${resp.status} ${resp.statusText}`,
        );
      }
      const blob = await resp.blob();
      providedBlobs.push({ url, blob });
    }

    const formData = new FormData();

    const refFilename = getFilenameFromUrl(referenceUrl, 'reference.jpg');
    formData.append('reference_photo', refBlob, refFilename);

    providedBlobs.forEach((item, index) => {
      const filename = getFilenameFromUrl(
        item.url,
        `provided_${index + 1}.jpg`,
      );
      formData.append('file', item.blob, filename);
    });

    const res = await axiosInstance.post('/verify-photo', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });

    console.log('verifyPhoto backend response:', res.data);
    return res;
  } catch (err) {
    console.error('Error in verifyPhoto:', err);
    throw err;
  }
};

// comparisonApi.js
export const verifySignature = async (referenceUrl, providedUrls) => {
  try {
    // Normalize providedUrls into an array
    const providedList = Array.isArray(providedUrls)
      ? providedUrls
      : [providedUrls];

    console.log('verifySignature ->', { referenceUrl, providedList });

    // --- Fetch reference file ---
    const refResponse = await fetch(referenceUrl);
    if (!refResponse.ok) {
      throw new Error(
        `Failed to load reference signature: ${refResponse.status} ${refResponse.statusText}`,
      );
    }
    const refBlob = await refResponse.blob();
    const refFilename =
      typeof referenceUrl === 'string'
        ? referenceUrl.split('/').pop() || 'reference.jpg'
        : 'reference.jpg';

    const formData = new FormData();
    formData.append('reference_signature', refBlob, refFilename);

    // --- Fetch all provided files ---
    const providedResponses = await Promise.all(
      providedList.map((url) => fetch(url)),
    );

    await Promise.all(
      providedResponses.map(async (resp, idx) => {
        if (!resp.ok) {
          throw new Error(
            `Failed to load provided signature: ${resp.status} ${resp.statusText}`,
          );
        }

        const provBlob = await resp.blob();
        const url = providedList[idx];

        const provFilename =
          typeof url === 'string' && url.includes('/')
            ? url.split('/').pop()
            : `provided_${idx + 1}.jpg`;

        formData.append('file', provBlob, provFilename);
      }),
    );

    const res = await axiosInstance.post('/verify-signature', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    });

    return res;
  } catch (error) {
    console.error('Error in verifySignature:', error);
    throw error;
  }
};

export const verifyVideo = async (referenceUrl, providedUrls) => {
  const formData = new FormData();

  // 🔹 Convert reference URL → File
  const refResponse = await fetch(referenceUrl);
  const refBlob = await refResponse.blob();
  const refFile = new File([refBlob], 'reference.jpg', {
    type: refBlob.type,
  });

  formData.append('reference_image', refFile);

  // 🔹 Convert each provided video URL → File
  for (let i = 0; i < providedUrls.length; i++) {
    const videoResponse = await fetch(providedUrls[i]);
    const videoBlob = await videoResponse.blob();

    const videoFile = new File([videoBlob], `video_${i}.mp4`, {
      type: videoBlob.type,
    });

    formData.append('video', videoFile);
  }

  return axiosInstance.post(`/verify-video`, formData, {
    headers: {
      'Content-Type': 'multipart/form-data',
    },
    withCredentials: true,
    timeout: 5 * 60 * 1000,
  });
};
