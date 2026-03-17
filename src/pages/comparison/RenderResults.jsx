import React from 'react';
import {
  CheckCircle2,
  XCircle,
  FileText,
  Video,
  User,
  Hash,
  Shield,
} from 'lucide-react';

const RenderResults = ({ data }) => {
  if (!data) return null;

  const {
    status,
    cost,
    message,
    document_details,
    video_details,
    verification,
    face_verification,
  } = data;

  const isMatch = status === 'MATCH';
  const confidence = Math.round(face_verification?.confidence_score || 0);

  const nameMatch =
    document_details?.name?.toLowerCase() ===
    video_details?.name?.toLowerCase();

  const numberMatch =
    document_details?.card_number === video_details?.card_number;

  const isIdentical = face_verification?.is_identical;

  return (
    <div className='min-h-screen bg-slate-100 p-6 md:p-12 text-slate-800'>
      <div className='max-w-6xl mx-auto space-y-10'>
        {/* ================= TOP STATUS BADGE ================= */}
        <div
          className={`rounded-2xl shadow-md border flex justify-between items-center p-6 md:p-8 ${
            isMatch
              ? 'bg-emerald-50 border-emerald-200'
              : 'bg-red-50 border-red-200'
          }`}
        >
          <div className='flex items-center gap-4'>
            <div
              className={`w-12 h-12 rounded-full flex items-center justify-center ${
                isMatch ? 'bg-emerald-100' : 'bg-red-100'
              }`}
            >
              {isMatch ? (
                <CheckCircle2 className='w-7 h-7 text-emerald-600' />
              ) : (
                <XCircle className='w-7 h-7 text-red-600' />
              )}
            </div>

            <div>
              <h2 className='text-2xl font-bold tracking-wide'>{status}</h2>
              <p className='text-lg text-slate-600'>{message}</p>
            </div>
          </div>

          <div className='text-right'>
            <p className='text-sm uppercase tracking-widest text-slate-500 font-semibold'>
              Transaction Cost
            </p>
            <p className='text-2xl font-bold text-slate-900'>
              ${cost.toFixed(4)}
            </p>
          </div>
        </div>

        {/* ================= FACE SECTION ================= */}
        <div className='bg-white rounded-2xl shadow-md border border-slate-200 p-4 px-10 space-y-4'>
          <div className='flex justify-between items-center'>
            <h3 className='text-xl font-semibold'>Face Verification</h3>

            <div className='flex items-center gap-3 mt-2'>
              <span className='text-lg font-medium'>
                Face verification Status:
              </span>

              <span
                className={`px-4 py-1.5 rounded-full text-base font-semibold ${
                  isIdentical
                    ? 'bg-emerald-100 text-emerald-700'
                    : 'bg-red-100 text-red-700'
                }`}
              >
                {isIdentical ? 'Matched' : 'Not Matched'}
              </span>
            </div>
          </div>

          <div className='flex flex-col md:flex-row items-center justify-center gap-12'>
            {/* Smaller controlled image size */}
            <div className='text-center space-y-3'>
              <img
                src={`data:image/png;base64,${face_verification.reference_photo}`}
                alt='Reference'
                className='w-56 h-64 object-cover rounded-xl border border-slate-200'
              />
              <p className='text-lg font-medium'>Document Photo</p>
            </div>

            <div className='text-center space-y-3'>
              <img
                src={`data:image/png;base64,${face_verification.photo_frame}`}
                alt='Live'
                className='w-56 h-64 object-cover rounded-xl border border-slate-200'
              />
              <p className='text-lg font-medium'>Video Frame</p>
            </div>
          </div>

          <div className='space-y-2'>
            <div className='flex justify-between text-lg font-medium'>
              <span>Confidence Score</span>
              <span>{confidence}</span>
            </div>
            <div className='w-full bg-slate-200 h-2.5 rounded-full overflow-hidden'>
              <div
                className={`h-2.5 ${
                  confidence > 70 ? 'bg-emerald-500' : 'bg-red-500'
                }`}
                style={{ width: `${confidence}` }}
              />
            </div>
          </div>

          <div className='bg-slate-50 border border-slate-200 rounded-xl px-6 py-2 text-lg text-slate-700 my-2'>
            {face_verification?.comparison_result?.report}
          </div>
        </div>

        {/* ================= DOCUMENT VS VIDEO DETAILS ================= */}
        <div className='grid md:grid-cols-2 gap-8'>
          {/* DOCUMENT DETAILS */}
          <div className='bg-white rounded-2xl shadow-md border border-slate-200 p-8 space-y-6'>
            <div className='flex items-center gap-3 border-b border-slate-200 pb-4'>
              <FileText className='w-6 h-6 text-blue-600' />
              <h3 className='text-xl font-semibold'>Document Details</h3>
            </div>

            <div className='space-y-4 text-lg'>
              <div className='flex'>
                <span className='w-36 text-slate-500 font-medium'>
                  Card Type :
                </span>
                <span className='font-semibold text-slate-900'>
                  {document_details.card_type}
                </span>
              </div>

              <div className='flex'>
                <span className='w-36 text-slate-500 font-medium'>
                  Full Name :
                </span>
                <span className='font-semibold text-slate-900'>
                  {document_details.name}
                </span>
              </div>

              <div className='flex '>
                <span className='w-36 text-slate-500 font-medium'>
                  {document_details.card_type} Number :
                </span>
                <span className='font-mono font-semibold text-slate-900 tracking-wide'>
                  {document_details.card_number}
                </span>
              </div>
            </div>
          </div>

          {/* VIDEO DETAILS */}
          <div className='bg-white rounded-2xl shadow-md border border-slate-200 p-8 space-y-6'>
            <div className='flex items-center gap-3 border-b border-slate-200 pb-4'>
              <Video className='w-6 h-6 text-purple-600' />
              <h3 className='text-xl font-semibold'>Video Extracted Details</h3>
            </div>

            <div className='space-y-4 text-lg'>
              <div className='flex'>
                <span className='w-44 text-slate-500 font-medium'>
                  Card Type :
                </span>
                <span className='font-semibold text-slate-900'>
                  {document_details.card_type}
                </span>
              </div>

              <div className='flex'>
                <span className='w-44 text-slate-500 font-medium'>
                  Spoken Name :
                </span>
                <span
                  className={`font-semibold ${
                    nameMatch ? 'text-emerald-600' : 'text-red-600'
                  }`}
                >
                  {video_details.name}
                </span>
              </div>

              <div className='flex'>
                <span className='w-44 text-slate-500 font-medium'>
                  Spoken Number :
                </span>
                <span
                  className={`font-mono font-semibold tracking-wide ${
                    numberMatch ? 'text-emerald-600' : 'text-red-600'
                  }`}
                >
                  {video_details.card_number}
                </span>
              </div>
            </div>
          </div>
        </div>

        {/* ================= AI REASON ================= */}
        <div className='bg-white rounded-2xl shadow-md border border-slate-200 p-8'>
          <h3 className='text-xl font-semibold flex items-center gap-2 mb-4'>
            <Shield className='w-5 h-5 text-emerald-500' /> AI Verification
            Reason
          </h3>
          <p className='text-lg text-slate-700 leading-relaxed'>
            {verification.reason}
          </p>
        </div>
      </div>
    </div>
  );
};

export default RenderResults;
