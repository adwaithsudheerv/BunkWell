import React, { useState, useRef } from 'react';
import { Camera, Upload, Sparkles, CheckCircle2, AlertCircle, RefreshCw, X, ArrowRight, BookOpen, Clock, Calendar } from 'lucide-react';
import api from '../lib/api';

export default function AITimetableScannerModal({ isOpen, onClose, onTimetableApplied }) {
  const [imagePreview, setImagePreview] = useState(null);
  const [imageBase64, setImageBase64] = useState(null);
  const [isScanning, setIsScanning] = useState(false);
  const [scanStage, setScanStage] = useState('');
  const [scanResult, setScanResult] = useState(null);
  const [error, setError] = useState('');
  const [isApplying, setIsApplying] = useState(false);
  const fileInputRef = useRef(null);
  const cameraInputRef = useRef(null);

  if (!isOpen) return null;

  const compressImage = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const maxDim = 1280;
          let { width, height } = img;
          if (width > maxDim || height > maxDim) {
            if (width > height) {
              height = Math.round((height * maxDim) / width);
              width = maxDim;
            } else {
              width = Math.round((width * maxDim) / height);
              height = maxDim;
            }
          }
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', 0.8));
        };
        img.onerror = reject;
        img.src = e.target.result;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  };

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setError('');
    setScanResult(null);

    try {
      const compressedDataUrl = await compressImage(file);
      setImagePreview(compressedDataUrl);
      setImageBase64(compressedDataUrl);
    } catch (err) {
      const reader = new FileReader();
      reader.onloadend = () => {
        setImagePreview(reader.result);
        setImageBase64(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleScan = async () => {
    if (!imageBase64) {
      setError('Please choose or take a photo of your timetable first.');
      return;
    }

    setIsScanning(true);
    setError('');
    setScanStage('Analyzing photo & detecting timetable grid with OCR...');

    try {
      const res = await api.post('/timetable/ai-scan', { imageBase64 });
      if (res.data?.success) {
        setScanResult(res.data);
      } else {
        setError(res.data?.message || 'Failed to extract timetable schedule.');
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to scan image. Please ensure photo is well-lit and clear.');
    } finally {
      setIsScanning(false);
      setScanStage('');
    }
  };

  const handleApply = async () => {
    if (!scanResult || !scanResult.days) return;

    setIsApplying(true);
    setError('');

    try {
      const res = await api.post('/timetable/apply-ai-scan', {
        days: scanResult.days,
        detectedSubjects: scanResult.detectedSubjects,
        semesterName: 'AI Scanned Semester'
      });

      if (res.data?.success) {
        if (onTimetableApplied) {
          onTimetableApplied(res.data.timetable);
        }
        onClose();
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save timetable to your account.');
    } finally {
      setIsApplying(false);
    }
  };

  const resetAll = () => {
    setImagePreview(null);
    setImageBase64(null);
    setScanResult(null);
    setError('');
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-black/80 backdrop-blur-md overflow-y-auto animate-fade-in">
      <div className="relative w-full max-w-2xl bg-[#0e131f] border border-blue-500/30 rounded-3xl p-5 sm:p-7 shadow-2xl text-slate-100 my-auto">
        
        {/* Header */}
        <div className="flex items-start justify-between pb-4 border-b border-white/10">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-500 flex items-center justify-center shadow-lg shadow-blue-500/25">
              <Sparkles className="w-6 h-6 text-white animate-pulse" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h3 className="text-xl font-extrabold text-white">AI Timetable Photo Scanner</h3>
                <span className="px-2 py-0.5 rounded-full text-[10px] font-black uppercase tracking-wider bg-blue-500/20 text-blue-400 border border-blue-500/30">
                  Smart Vision AI
                </span>
              </div>
              <p className="text-xs text-slate-400 mt-0.5">
                Snap a photo of your college timetable sheet. AI extracts subjects, periods, and times automatically!
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-xl bg-white/5 hover:bg-white/10 text-slate-400 hover:text-white transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Error Alert */}
        {error && (
          <div className="mt-4 p-3 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-400 text-xs flex items-center gap-2">
            <AlertCircle size={16} className="shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* Step 1: Image Capture / Upload Area */}
        {!scanResult && (
          <div className="mt-5 space-y-4">
            {/* Input 1: Storage / Gallery file picker (NO capture attribute -> opens phone files/gallery) */}
            <input
              type="file"
              accept="image/png,image/jpeg,image/jpg,image/webp"
              ref={fileInputRef}
              onChange={handleFileChange}
              className="hidden"
            />

            {/* Input 2: Dedicated Camera Capture (with capture="environment" -> opens live hardware camera) */}
            <input
              type="file"
              accept="image/*"
              capture="environment"
              ref={cameraInputRef}
              onChange={handleFileChange}
              className="hidden"
            />

            {!imagePreview ? (
              <div className="border-2 border-dashed border-blue-500/30 rounded-3xl p-6 sm:p-8 text-center bg-blue-950/10 flex flex-col items-center justify-center gap-4">
                <div className="w-16 h-16 rounded-2xl bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-400">
                  <Sparkles size={32} />
                </div>
                <div>
                  <p className="text-base font-bold text-white">
                    Scan Timetable Schedule
                  </p>
                  <p className="text-xs text-slate-400 mt-1 max-w-sm mx-auto">
                    Choose an existing timetable screenshot from your phone files or take a live camera photo.
                  </p>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 w-full max-w-sm mt-2">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      cameraInputRef.current?.click();
                    }}
                    className="flex items-center justify-center gap-2 py-3 px-4 rounded-2xl bg-blue-600 hover:bg-blue-500 active:scale-95 text-white font-bold text-xs shadow-md shadow-blue-600/25 transition-all"
                  >
                    <Camera size={16} /> Open Camera
                  </button>

                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      fileInputRef.current?.click();
                    }}
                    className="flex items-center justify-center gap-2 py-3 px-4 rounded-2xl bg-white/10 hover:bg-white/15 active:scale-95 text-white font-bold text-xs border border-white/15 transition-all"
                  >
                    <Upload size={16} /> Choose from Files
                  </button>
                </div>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="relative rounded-2xl overflow-hidden border border-blue-500/30 max-h-64 flex items-center justify-center bg-black/40">
                  <img
                    src={imagePreview}
                    alt="Timetable Preview"
                    className="w-full h-auto max-h-64 object-contain"
                  />
                  {isScanning && (
                    <div className="absolute inset-0 bg-blue-950/70 backdrop-blur-sm flex flex-col items-center justify-center p-4 text-center">
                      <RefreshCw size={36} className="text-blue-400 animate-spin mb-3" />
                      <p className="text-sm font-bold text-white">{scanStage}</p>
                      <p className="text-xs text-blue-300 mt-1">
                        AI is parsing periods, days, and subjects...
                      </p>
                    </div>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <button
                    onClick={() => cameraInputRef.current?.click()}
                    disabled={isScanning}
                    className="px-3.5 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-slate-300 hover:text-white transition-colors flex items-center gap-1.5"
                  >
                    <Camera size={13} /> Retake
                  </button>
                  <button
                    onClick={() => fileInputRef.current?.click()}
                    disabled={isScanning}
                    className="px-3.5 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-slate-300 hover:text-white transition-colors flex items-center gap-1.5"
                  >
                    <Upload size={13} /> Choose File
                  </button>
                  <button
                    onClick={handleScan}
                    disabled={isScanning}
                    className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-500 hover:to-indigo-500 text-white font-bold text-xs shadow-lg shadow-blue-500/30 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
                  >
                    <Sparkles size={16} />
                    {isScanning ? 'Extracting Schedule...' : 'Scan with Smart AI'}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* Step 2: Scan Results Preview */}
        {scanResult && (
          <div className="mt-5 space-y-4">
            <div className="p-3.5 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 flex items-center justify-between">
              <div className="flex items-center gap-2 text-emerald-400 text-xs font-bold">
                <CheckCircle2 size={18} />
                <span>Successfully extracted timetable with AI!</span>
              </div>
              <button
                onClick={resetAll}
                className="text-[11px] text-slate-400 hover:text-white underline"
              >
                Scan Another
              </button>
            </div>

            {/* Detected Subjects Tags */}
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-2 flex items-center gap-1.5">
                <BookOpen size={13} className="text-blue-400" />
                Detected Subjects ({scanResult.detectedSubjects?.length || 0}):
              </span>
              <div className="flex flex-wrap gap-1.5 max-h-24 overflow-y-auto p-1">
                {scanResult.detectedSubjects?.map((sub, idx) => (
                  <span
                    key={idx}
                    className="px-2.5 py-1 rounded-xl bg-blue-500/15 border border-blue-500/30 text-blue-300 text-xs font-semibold"
                  >
                    {sub}
                  </span>
                ))}
              </div>
            </div>

            {/* Timetable Days Preview Table */}
            <div>
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400 block mb-2 flex items-center gap-1.5">
                <Calendar size={13} className="text-indigo-400" />
                Schedule Grid Preview:
              </span>
              <div className="space-y-2 max-h-56 overflow-y-auto pr-1">
                {scanResult.days?.map((dayObj, dIdx) => (
                  <div
                    key={dIdx}
                    className="p-2.5 rounded-xl bg-white/[0.03] border border-white/5 flex flex-col gap-1.5"
                  >
                    <div className="flex items-center justify-between text-xs font-black text-white">
                      <span>{dayObj.day}</span>
                      <span className="text-[10px] text-slate-400 font-normal">
                        {dayObj.periods?.length || 0} Periods
                      </span>
                    </div>
                    <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
                      {dayObj.periods?.map((p, pIdx) => (
                        <div
                          key={pIdx}
                          className="px-2 py-1 rounded-lg bg-black/40 border border-white/5 text-[11px]"
                        >
                          <span className="text-blue-400 font-bold block truncate">
                            P{p.periodNumber}: {p.subjectName}
                          </span>
                          <span className="text-slate-400 text-[10px] flex items-center gap-1">
                            <Clock size={10} />
                            {p.startTime && p.endTime ? `${p.startTime} - ${p.endTime}` : 'Regular'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-2 pt-2 border-t border-white/10">
              <button
                onClick={resetAll}
                disabled={isApplying}
                className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 text-xs font-semibold text-slate-300 hover:text-white transition-colors"
              >
                Discard
              </button>
              <button
                onClick={handleApply}
                disabled={isApplying}
                className="flex-1 py-2.5 rounded-xl bg-gradient-to-r from-emerald-600 to-teal-600 hover:from-emerald-500 hover:to-teal-500 text-white font-extrabold text-xs shadow-lg shadow-emerald-500/25 flex items-center justify-center gap-2 transition-all disabled:opacity-50"
              >
                {isApplying ? (
                  <>
                    <RefreshCw size={14} className="animate-spin" />
                    Applying to Schedule...
                  </>
                ) : (
                  <>
                    <ArrowRight size={14} />
                    Apply to My Timetable & Subjects
                  </>
                )}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
