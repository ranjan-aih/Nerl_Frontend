import React, { useState, useRef, useEffect } from 'react';
import {
  Button,
  Avatar,
  IconButton,
  Popover,
  List,
  ListItem,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  RadioGroup,
  FormControlLabel,
  Radio,
  Chip,
  Alert,
  CircularProgress,
  Typography,
} from '@mui/material';

import CloudUploadIcon from '@mui/icons-material/CloudUpload';
import MoreVertIcon from '@mui/icons-material/MoreVert';
import FolderIcon from '@mui/icons-material/Folder';
import ImageIcon from '@mui/icons-material/Image';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import InsertDriveFileIcon from '@mui/icons-material/InsertDriveFile';
import DeleteIcon from '@mui/icons-material/Delete';
import DownloadIcon from '@mui/icons-material/Download';
import RefreshIcon from '@mui/icons-material/Refresh';
import VideoFileIcon from '@mui/icons-material/VideoFile';

import {
  uploadFiles,
  getRecentUploads,
  API_BASE_URL,
  deleteUpload,
} from '../api/uploadApi';

const ALLOWED_VIDEO_EXT = ['mp4', 'mkv', 'mov', 'webm'];
const ALLOWED_IMAGE_EXT = ['jpg', 'jpeg', 'png'];

const buildFileUrl = (url) => {
  if (!url) return null;
  if (url.startsWith('http://') || url.startsWith('https://')) return url;
  const cleanUrl = url.startsWith('/') ? url : `/${url}`;
  return `${API_BASE_URL}${cleanUrl}`;
};

const isImageFile = (file) => {
  if (!file) return false;
  if (file.type) return file.type.startsWith('image/');
  const ext = file.name.split('.').pop().toLowerCase();
  return ALLOWED_IMAGE_EXT.includes(ext);
};

const isVideoFile = (file) => {
  if (!file) return false;
  if (file.type) return file.type.startsWith('video/');
  const ext = file.name.split('.').pop().toLowerCase();
  return ALLOWED_VIDEO_EXT.includes(ext);
};

const Upload = () => {
  const [fileType, setFileType] = useState('photo');
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(false);
  const [uploadingRef, setUploadingRef] = useState(false);
  const [uploadingProv, setUploadingProv] = useState(false);
  const [error, setError] = useState(null);

  const referenceInputRef = useRef(null);
  const providedInputRef = useRef(null);

  const [pendingRefFiles, setPendingRefFiles] = useState([]);
  const [pendingProvFiles, setPendingProvFiles] = useState([]);

  const [anchorEl, setAnchorEl] = useState(null);
  const [selectedFile, setSelectedFile] = useState(null);

  const uploading = uploadingRef || uploadingProv;

  const getAcceptedFormats = () => {
    if (fileType === 'video') return '.mp4,.mkv,.mov,.webm';
    return '.jpeg,.jpg,.png,.pdf';
  };

  const getSupportText = () => {
    if (fileType === 'video') return 'Supported: .mp4, .mkv, .mov, .webm';
    return 'Only .jpeg, .jpg, .png, .pdf format supported';
  };

  const getFileIcon = (name = '') => {
    const ext = name.split('.').pop().toLowerCase();
    if (ext === 'pdf') return <PictureAsPdfIcon color='primary' />;
    if (ALLOWED_IMAGE_EXT.includes(ext)) return <ImageIcon color='primary' />;
    if (ALLOWED_VIDEO_EXT.includes(ext))
      return <VideoFileIcon color='secondary' />;
    if (['ppt', 'pptx'].includes(ext))
      return <InsertDriveFileIcon color='primary' />;
    if (['zip', 'rar'].includes(ext)) return <FolderIcon color='primary' />;
    return <InsertDriveFileIcon color='primary' />;
  };

  const handleMenuOpen = (event, file) => {
    event.stopPropagation();
    setAnchorEl(event.currentTarget);
    setSelectedFile(file);
  };

  const handleMenuClose = () => {
    setAnchorEl(null);
    setSelectedFile(null);
  };

  const handleDownload = () => {
    if (selectedFile?.url) {
      const fullUrl = buildFileUrl(selectedFile.url);
      const link = document.createElement('a');
      link.href = fullUrl;
      link.download = selectedFile.name || 'download';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
    }
    handleMenuClose();
  };

  const handleDelete = async () => {
    if (!selectedFile) return;

    const fileId = selectedFile.id || selectedFile._id;
    const currentFileType = selectedFile.type;

    if (!fileId) {
      setError('Cannot delete this file – missing ID.');
      handleMenuClose();
      return;
    }

    try {
      await deleteUpload(fileId, currentFileType);

      setFiles((prev) =>
        prev.filter((f) => f.id !== fileId && f._id !== fileId),
      );
    } catch (err) {
      setError(
        `Failed to delete file: ${err.response?.data?.message || err.message}`,
      );
    } finally {
      handleMenuClose();
    }
  };

  const refreshRecent = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await getRecentUploads();

      console.log('Recent uploads response:', res);

      if (!res?.success) {
        setError('Server returned an error');
        setFiles([]);
        return;
      }

      const { files: allFiles = [] } = res;
      const mapped = allFiles.map((f) => ({
        id: f._id || f.id,
        name: f.name || 'Unnamed',
        time: f.uploadedAt
          ? new Date(f.uploadedAt).toLocaleString()
          : 'Recently',
        size: f.size ? `${(f.size / 1024).toFixed(1)} KB` : 'Unknown',
        icon: getFileIcon(f.name),
        url: f.url,
        slot: f.slot,
        type: f.type || f.fileType || 'photo',
      }));
      setFiles(mapped);
    } catch (err) {
      setError(`Failed to load files: ${err.message}`);
      setFiles([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshRecent();
  }, []);

  const handleUpload = async (category) => {
    const filesToUpload =
      category === 'reference' ? pendingRefFiles : pendingProvFiles;

    if (!filesToUpload.length) return;

    const setUploading =
      category === 'reference' ? setUploadingRef : setUploadingProv;
    const setPendingFiles =
      category === 'reference' ? setPendingRefFiles : setPendingProvFiles;

    try {
      setUploading(true);
      setError(null);

      console.log(`Uploading ${filesToUpload.length} files to ${category}`);

      const fileArray = filesToUpload.map((item) => item.file);

      console.log('File array:', fileArray);
      console.log('File type:', fileType);
      console.log('Category:', category);

      const result = await uploadFiles(fileArray, fileType, category);

      console.log('Upload result:', result);

      await refreshRecent();

      setPendingFiles([]);
    } catch (err) {
      console.error('Upload error:', err);
      setError(err.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  const handleFileSelect = (e, slot) => {
    const selectedFiles = Array.from(e.target.files || []);
    if (!selectedFiles.length) return;

    console.log(`Selected ${selectedFiles.length} files for ${slot}`);

    const validFiles = selectedFiles.filter((file) => {
      if (fileType === 'video' && !isVideoFile(file)) {
        setError(`Invalid video file: ${file.name}`);
        return false;
      }
      if (
        fileType === 'photo' &&
        !isImageFile(file) &&
        !file.type.includes('pdf')
      ) {
        setError(`Invalid file type: ${file.name}`);
        return false;
      }
      return true;
    });

    console.log(`Valid files: ${validFiles.length}`);

    const filesWithPreview = validFiles.map((file) => ({
      file,
      preview: isImageFile(file) ? URL.createObjectURL(file) : null,
    }));

    if (slot === 'reference') {
      setPendingRefFiles((prev) => [...prev, ...filesWithPreview]);
    } else {
      setPendingProvFiles((prev) => [...prev, ...filesWithPreview]);
    }

    e.target.value = '';
  };

  const handleDrop = (e, slot) => {
    e.preventDefault();
    if (uploading) return;

    const droppedFiles = Array.from(e.dataTransfer.files || []);
    if (!droppedFiles.length) return;

    console.log(`Dropped ${droppedFiles.length} files on ${slot}`);

    const validFiles = droppedFiles.filter((file) => {
      if (fileType === 'video' && !isVideoFile(file)) {
        setError(`Invalid video file: ${file.name}`);
        return false;
      }
      if (
        fileType === 'photo' &&
        !isImageFile(file) &&
        !file.type.includes('pdf')
      ) {
        setError(`Invalid file type: ${file.name}`);
        return false;
      }
      return true;
    });

    const filesWithPreview = validFiles.map((file) => ({
      file,
      preview: isImageFile(file) ? URL.createObjectURL(file) : null,
    }));

    if (slot === 'reference') {
      setPendingRefFiles((prev) => [...prev, ...filesWithPreview]);
    } else {
      setPendingProvFiles((prev) => [...prev, ...filesWithPreview]);
    }
  };

  const preventDefaults = (e) => e.preventDefault();
  const handleOpenInNewTab = (file) => {
    const fullUrl = buildFileUrl(file.url);
    if (fullUrl) window.open(fullUrl, '_blank', 'noopener,noreferrer');
  };

  const referenceList = files.filter((f) => f.slot === 'reference');
  const providedList = files.filter((f) => f.slot === 'provided');

  return (
    <div className='mb-6 w-full px-3 sm:px-4'>
      <div className='text-center mb-2'>
        <Typography sx={{ fontWeight: 600, fontSize: '24px' }}>
          Upload
        </Typography>
      </div>

      <div className='relative mt-4 w-full  min-h-[420px] max-w-6xl mx-auto bg-white rounded-2xl shadow-md p-4 md:p-6'>
        <div className='mb-4'>
          <Typography sx={{ fontSize: '20px', fontWeight: 600 }}>
            Select Upload Category
          </Typography>
          <RadioGroup
            row
            value={fileType}
            onChange={(e) => {
              setFileType(e.target.value);
              setPendingRefFiles([]);
              setPendingProvFiles([]);
            }}
            sx={{ mt: 1 }}
          >
            <FormControlLabel value='photo' control={<Radio />} label='Photo' />
            <FormControlLabel
              value='signature'
              control={<Radio />}
              label='Signature'
            />
            <FormControlLabel value='video' control={<Radio />} label='Video' />
          </RadioGroup>
        </div>

        <div className=' grid grid-cols-1 md:grid-cols-2 gap-4'>
          {/* Reference upload box */}
          <div>
            <Typography sx={{ fontWeight: 600, mb: 1 }}>
              Upload Reference{' '}
              {fileType.charAt(0).toUpperCase() + fileType.slice(1)}
              {pendingRefFiles.length > 0 && ` (${pendingRefFiles.length})`}
            </Typography>
            <div
              className={`border-2 border-dashed border-gray-200 rounded-2xl min-h-[200px] flex flex-col items-center justify-center p-4 transition ${
                uploadingRef ? 'cursor-default' : 'cursor-pointer'
              } hover:bg-gray-50`}
              onClick={() =>
                !uploadingRef && referenceInputRef.current?.click()
              }
              onDrop={(e) => !uploadingRef && handleDrop(e, 'reference')}
              onDragOver={preventDefaults}
            >
              {pendingRefFiles.length > 0 ? (
                <div className='w-full'>
                  {pendingRefFiles.map((item, index) => (
                    <div
                      key={index}
                      className='flex items-center justify-between bg-gray-100 p-2 rounded-lg mb-2'
                    >
                      <div className='flex items-center gap-2'>
                        {item.preview ? (
                          <img
                            src={item.preview}
                            alt='preview'
                            className='w-12 h-12 object-cover rounded'
                          />
                        ) : (
                          getFileIcon(item.file.name)
                        )}
                        <span className='text-xs font-medium'>
                          {item.file.name}
                        </span>
                      </div>

                      <IconButton
                        size='small'
                        onClick={(e) => {
                          e.stopPropagation();
                          setPendingRefFiles((prev) =>
                            prev.filter((_, i) => i !== index),
                          );
                        }}
                      >
                        <DeleteIcon fontSize='small' />
                      </IconButton>
                    </div>
                  ))}
                </div>
              ) : (
                <>
                  <CloudUploadIcon sx={{ fontSize: 45, color: '#777' }} />
                  <p className='mt-1 text-base text-gray-700 font-medium text-center'>
                    Click or drag to upload
                  </p>
                  <p className='mt-1 text-xs text-gray-400 text-center'>
                    {getSupportText()}
                  </p>
                </>
              )}
              <input
                type='file'
                hidden
                multiple
                ref={referenceInputRef}
                accept={getAcceptedFormats()}
                onChange={(e) => handleFileSelect(e, 'reference')}
              />
            </div>
          </div>

          {/* Provided upload box */}
          <div>
            <Typography sx={{ fontWeight: 600, mb: 1 }}>
              Upload Provided{' '}
              {fileType.charAt(0).toUpperCase() + fileType.slice(1)}
              {pendingProvFiles.length > 0 && ` (${pendingProvFiles.length})`}
            </Typography>

            <div
              className={`relative border-2 border-dashed border-gray-200 rounded-2xl min-h-[200px] flex flex-col p-4 transition ${
                uploadingProv ? 'cursor-default' : 'cursor-pointer'
              } hover:bg-gray-50`}
              onClick={() =>
                !uploadingProv && providedInputRef.current?.click()
              }
              onDrop={(e) => !uploadingProv && handleDrop(e, 'provided')}
              onDragOver={preventDefaults}
            >
              {/* Upload Button Top Right */}
              {/* {pendingProvFiles.length > 0 && (
                <div className='absolute top-3 right-3'>
                  <Button
                    variant='contained'
                    size='small'
                    disabled={uploadingProv}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleUpload('provided');
                    }}
                  >
                    {uploadingProv ? <CircularProgress size={18} /> : 'Upload'}
                  </Button>
                </div>
              )} */}

              {pendingProvFiles.length > 0 ? (
                <div className='w-full mt-6'>
                  {pendingProvFiles.map((item, index) => (
                    <div
                      key={index}
                      className='flex items-center justify-between bg-gray-100 p-2 rounded-lg mb-2'
                    >
                      <div className='flex items-center gap-2'>
                        {item.preview ? (
                          <img
                            src={item.preview}
                            alt='preview'
                            className='w-12 h-12 object-cover rounded'
                          />
                        ) : (
                          getFileIcon(item.file.name)
                        )}
                        <span className='text-xs font-medium'>
                          {item.file.name}
                        </span>
                      </div>

                      <IconButton
                        size='small'
                        onClick={(e) => {
                          e.stopPropagation();
                          setPendingProvFiles((prev) =>
                            prev.filter((_, i) => i !== index),
                          );
                        }}
                      >
                        <DeleteIcon fontSize='small' />
                      </IconButton>
                    </div>
                  ))}
                </div>
              ) : (
                <div className='flex flex-col items-center justify-center h-full'>
                  <CloudUploadIcon sx={{ fontSize: 45, color: '#777' }} />
                  <p className='mt-1 text-base text-gray-700 font-medium text-center'>
                    Click or drag to upload
                  </p>
                  <p className='mt-1 text-xs text-gray-400 text-center'>
                    {getSupportText()}
                  </p>
                </div>
              )}

              <input
                type='file'
                hidden
                multiple
                ref={providedInputRef}
                accept={getAcceptedFormats()}
                onChange={(e) => handleFileSelect(e, 'provided')}
              />
            </div>
          </div>
        </div>
        <div className='absolute bottom-4 right-6'>
          <Button
            variant='contained'
            disabled={
              uploading ||
              (pendingRefFiles.length === 0 && pendingProvFiles.length === 0)
            }
            onClick={async () => {
              console.log('Main upload button clicked');
              console.log('Reference files:', pendingRefFiles.length);
              console.log('Provided files:', pendingProvFiles.length);

              if (pendingRefFiles.length > 0) {
                await handleUpload('reference');
              }
              if (pendingProvFiles.length > 0) {
                await handleUpload('provided');
              }
            }}
          >
            {uploading ? <CircularProgress size={20} /> : 'Upload All'}
          </Button>
        </div>
      </div>

      {error && (
        <div className='my-4 max-w-4xl mx-auto'>
          <Alert severity='error' onClose={() => setError(null)}>
            {error}
          </Alert>
        </div>
      )}

      {/* RECENT UPLOADS TABLE */}
      <div className='mt-4 w-full max-w-6xl mx-auto bg-white rounded-2xl shadow-md p-4 h-[60vh] overflow-y-auto'>
        <div className='flex flex-wrap items-center justify-between mb-3 gap-4'>
          <div className='flex-1 text-center'>
            <Button
              sx={{
                backgroundColor: '#F6F7FB',
                color: '#3B3E9F',
                textTransform: 'none',
                px: 4,
                borderRadius: '30px',
              }}
            >
              Recent Uploads ({files.length})
            </Button>
          </div>
          <IconButton onClick={refreshRecent} disabled={loading}>
            <RefreshIcon />
          </IconButton>
        </div>

        {loading && (
          <div className='flex justify-center items-center h-40'>
            <CircularProgress />
          </div>
        )}

        {!loading && files.length > 0 && (
          <div className='grid grid-cols-1 md:grid-cols-2 gap-4'>
            {[
              { title: 'Reference', list: referenceList },
              { title: 'Provided', list: providedList },
            ].map((section) => (
              <div key={section.title}>
                <p className='font-semibold text-sm mb-2 text-gray-700'>
                  {section.title} ({section.list.length})
                </p>
                {section.list.map((file, idx) => (
                  <div
                    key={idx}
                    className='flex items-center justify-between px-3 py-2 mb-1 border-b border-gray-100 rounded-lg bg-gray-50 hover:bg-gray-100 cursor-pointer'
                    onClick={() => handleOpenInNewTab(file)}
                  >
                    <div className='flex items-center gap-3'>
                      <Avatar
                        sx={{
                          backgroundColor: '#F4F5F7',
                          width: 40,
                          height: 40,
                        }}
                      >
                        {file.icon}
                      </Avatar>
                      <div>
                        <div className='flex items-center gap-2'>
                          <p className='text-sm font-semibold text-gray-800'>
                            {file.name.slice(0, 25)}
                          </p>
                          <Chip
                            label={file.type}
                            size='small'
                            sx={{ height: 18, fontSize: '0.65rem' }}
                          />
                        </div>
                        <p className='text-xs text-gray-500'>{file.time}</p>
                      </div>
                    </div>
                    <IconButton
                      size='small'
                      onClick={(e) => handleMenuOpen(e, file)}
                    >
                      <MoreVertIcon fontSize='small' />
                    </IconButton>
                  </div>
                ))}
              </div>
            ))}
          </div>
        )}

        {!loading && files.length === 0 && (
          <div className='text-center text-gray-500 py-10'>
            No files uploaded yet
          </div>
        )}
      </div>

      <Popover
        open={Boolean(anchorEl)}
        anchorEl={anchorEl}
        onClose={handleMenuClose}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
      >
        <List sx={{ minWidth: '150px' }}>
          <ListItem disablePadding>
            <ListItemButton onClick={handleDownload}>
              <ListItemIcon>
                <DownloadIcon color='primary' />
              </ListItemIcon>
              <ListItemText primary='Download' />
            </ListItemButton>
          </ListItem>
          <ListItem disablePadding>
            <ListItemButton onClick={handleDelete}>
              <ListItemIcon>
                <DeleteIcon color='error' />
              </ListItemIcon>
              <ListItemText primary='Delete' />
            </ListItemButton>
          </ListItem>
        </List>
      </Popover>
    </div>
  );
};

export default Upload;
