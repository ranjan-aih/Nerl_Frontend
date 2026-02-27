// import axiosInstance from './axiosInstance';

// export const API_BASE_URL =
//   axiosInstance.defaults.baseURL?.replace(/\/api$/, '') || '';

// const UPLOAD_PATHS = {
//   photo: 'photos',
//   signature: 'signatures',
//   video: 'videos',
// };

// const getUploadPath = (fileType) => {
//   if (!UPLOAD_PATHS[fileType]) {
//     throw new Error(`Invalid file type: ${fileType}`);
//   }
//   return UPLOAD_PATHS[fileType];
// };

// export const uploadFiles = async (
//   files,
//   fileType,
//   category,
//   onProgress = null,
// ) => {
//   const typePath = getUploadPath(fileType);

//   const formData = new FormData();

//   const fileArray = Array.isArray(files) ? files : [files];

//   fileArray.forEach((file) => {
//     formData.append('files', file);
//   });

//   formData.append('category', category);
//   formData.append('fileType', fileType);

//   console.log('formdata ---> ', formData);

//   try {
//     const response = await axiosInstance.post(
//       `/upload/${typePath}/${category}`,
//       formData,
//       {
//         headers: {
//           'Content-Type': 'multipart/form-data',
//         },
//         onUploadProgress: (progressEvent) => {
//           if (onProgress) {
//             const percent = Math.round(
//               (progressEvent.loaded * 100) / progressEvent.total,
//             );
//             onProgress(percent);
//           }
//         },
//       },
//     );

//     return response.data;
//   } catch (error) {
//     throw error.response?.data || error;
//   }
// };

// export const getRecentUploads = async () => {
//   try {
//     const response = await axiosInstance.get('/uploads/recent');

//     console.log('Recent uploads:', response);

//     return response.data;
//   } catch (error) {
//     console.error('Error fetching recent uploads:', error);
//     throw error.response?.data || error;
//   }
// };

// export const deleteUpload = async (id, category, filename) => {
//   try {
//     if (!UPLOAD_PATHS[category]) {
//       throw new Error('Invalid file category');
//     }

//     console.log(`Deleting upload with id: ${id} and category: ${category}`);

//     const response = await axiosInstance.delete(`/delete/${category}/${id}`, {
//       data: {
//         name: filename,
//       },
//     });

//     return response.data;
//   } catch (error) {
//     throw error.response?.data || error;
//   }
// };

import axiosInstance from './axiosInstance';

export const API_BASE_URL =
  axiosInstance.defaults.baseURL?.replace(/\/api$/, '') || '';

const UPLOAD_PATHS = {
  photo: 'photos',
  signature: 'signatures',
  video: 'videos',
};

const getUploadPath = (fileType) => {
  if (!UPLOAD_PATHS[fileType]) {
    throw new Error(`Invalid file type: ${fileType}`);
  }
  return UPLOAD_PATHS[fileType];
};

export const uploadFiles = async (
  files,
  fileType,
  category,
  onProgress = null,
) => {
  const typePath = getUploadPath(fileType);

  const formData = new FormData();

  const fileArray = Array.isArray(files) ? files : [files];

  fileArray.forEach((file) => {
    formData.append('files', file);
  });

  formData.append('category', category);
  formData.append('fileType', fileType);

  try {
    const response = await axiosInstance.post(
      `/upload/${typePath}/${category}`,
      formData,
      {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        onUploadProgress: (progressEvent) => {
          if (onProgress) {
            const percent = Math.round(
              (progressEvent.loaded * 100) / progressEvent.total,
            );
            onProgress(percent);
          }
        },
      },
    );

    return response.data;
  } catch (error) {
    throw error.response?.data || error;
  }
};

export const getRecentUploads = async () => {
  try {
    const response = await axiosInstance.get('/uploads/recent');
    return response.data;
  } catch (error) {
    console.error('Error fetching recent uploads:', error);
    throw error.response?.data || error;
  }
};

export const deleteUpload = async (id, category) => {
  try {
    console.log(`Deleting upload with id: ${id} and category: ${category}`);

    const response = await axiosInstance.delete(`/delete/${category}/${id}`);

    return response.data;
  } catch (error) {
    throw error.response?.data || error;
  }
};
