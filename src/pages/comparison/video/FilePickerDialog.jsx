import {
  Button,
  CircularProgress,
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
} from '@mui/material';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdf';
import ImageIcon from '@mui/icons-material/Image';
import FolderOpenIcon from '@mui/icons-material/FolderOpen';
import { MdOutlineSlowMotionVideo } from 'react-icons/md';

const VIDEO_EXTS = ['mp4', 'webm', 'mov', 'avi', 'mkv', 'ogg'];
const isVideoFile = (ext) => VIDEO_EXTS.includes((ext || '').toLowerCase());

/**
 * FilePickerDialog
 * Completely self-contained modal for picking a reference image
 * or multi-selecting uploaded videos.
 */
export default function FilePickerDialog({
  open,
  dialogType,
  fileList,
  selectedReferenceUrl,
  tempSelection,
  loadingFiles,
  onClose,
  onRefresh,
  onSelectReference,
  onToggleProvided,
  onConfirmProvided,
}) {
  return (
    <Dialog open={open} onClose={onClose} maxWidth='md' fullWidth>
      <DialogTitle>
        {dialogType === 'reference'
          ? 'Select Reference Image'
          : `Select Provided Videos (${tempSelection.length} selected)`}
      </DialogTitle>

      <DialogContent>
        {loadingFiles ? (
          <div className='text-center py-6'>
            <CircularProgress />
            <p className='mt-2 text-sm'>Loading files...</p>
          </div>
        ) : fileList.length === 0 ? (
          <div className='text-center py-6 text-gray-500'>
            {dialogType === 'reference' ? (
              <ImageIcon sx={{ fontSize: 60 }} className='mb-2' />
            ) : (
              <MdOutlineSlowMotionVideo size={60} className='mb-2 mx-auto' />
            )}
            <p>
              No{' '}
              {dialogType === 'reference'
                ? 'reference images'
                : 'provided videos'}{' '}
              uploaded yet
            </p>
            <p className='text-xs mt-1'>Go to the Upload page to add files</p>
          </div>
        ) : (
          <div className='grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 mt-2'>
            {fileList.map((file) => {
              const selected =
                dialogType === 'reference'
                  ? selectedReferenceUrl === file.url
                  : tempSelection.includes(file.url);
              const onClick =
                dialogType === 'reference'
                  ? () => onSelectReference(file)
                  : () => onToggleProvided(file);
              return (
                <FileCard
                  key={file.url}
                  file={file}
                  selected={selected}
                  onClick={onClick}
                />
              );
            })}
          </div>
        )}
      </DialogContent>

      <DialogActions>
        <Button onClick={onClose}>Close</Button>
        <Button onClick={onRefresh} startIcon={<FolderOpenIcon />}>
          Refresh
        </Button>
        {dialogType === 'provided' && (
          <Button
            variant='contained'
            disabled={!tempSelection.length}
            onClick={onConfirmProvided}
          >
            Confirm ({tempSelection.length})
          </Button>
        )}
      </DialogActions>
    </Dialog>
  );
}

function FileCard({ file, selected, onClick }) {
  const isPdf = file.ext === 'pdf';
  const isVid = isVideoFile(file.ext);
  return (
    <div
      onClick={onClick}
      className={`h-40 w-40 flex flex-col border rounded-lg overflow-hidden cursor-pointer transition-all shadow-sm ${
        selected
          ? 'border-blue-600 shadow-md scale-[1.02] ring-2 ring-blue-300'
          : 'border-gray-200 hover:shadow-md hover:scale-[1.02]'
      }`}
    >
      <div className='h-32 bg-gray-50 flex items-center justify-center overflow-hidden relative'>
        {isPdf ? (
          <PictureAsPdfIcon className='text-red-600' sx={{ fontSize: 32 }} />
        ) : isVid ? (
          <>
            <video
              src={file.fullUrl}
              className='max-w-full max-h-full object-cover'
              muted
              preload='metadata'
            />
            <div className='absolute inset-0 flex items-center justify-center bg-black/25'>
              <MdOutlineSlowMotionVideo
                size={32}
                className='text-white drop-shadow'
              />
            </div>
          </>
        ) : (
          <img
            src={file.fullUrl}
            alt={file.name}
            className='max-w-full max-h-full object-cover'
          />
        )}
      </div>
      <div className='px-2 py-1.5 flex-1 flex items-center justify-center'>
        <p className='text-[0.75rem] text-center font-semibold truncate w-full'>
          {file.name}
        </p>
      </div>
    </div>
  );
}
