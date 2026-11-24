import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Upload, FileText, ArrowLeft, X, Check } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../auth/useAuth';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { MAX_PRESCRIPTION_SIZE, ACCEPTED_PRESCRIPTION_TYPES } from '../../config/constants';
import { toast } from 'sonner';

export function PrescriptionPage() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploaded, setUploaded] = useState(false);

  const handleFile = (f: File) => {
    if (!ACCEPTED_PRESCRIPTION_TYPES.includes(f.type)) {
      toast.error('Only JPG, PNG, or PDF files are accepted.');
      return;
    }
    if (f.size > MAX_PRESCRIPTION_SIZE) {
      toast.error('File must be under 5 MB.');
      return;
    }
    setFile(f);
    setUploaded(false);
  };

  const handleUpload = async () => {
    if (!file || !user) return;
    setUploading(true);
    try {
      const ext = file.name.split('.').pop();
      const path = `${user.id}/${Date.now()}.${ext}`;
      const { error } = await supabase.storage
        .from('prescriptions')
        .upload(path, file, { upsert: false });
      if (error) throw error;

      // Save path to fulfilment state
      const raw = sessionStorage.getItem('fm_fulfilment');
      if (raw) {
        const state = JSON.parse(raw);
        state.prescriptionPath = path;
        sessionStorage.setItem('fm_fulfilment', JSON.stringify(state));
      }

      setUploaded(true);
      toast.success('Prescription uploaded');
    } catch (err: any) {
      toast.error(err.message || 'Upload failed');
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-4">
      <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-sm text-neutral-500 hover:text-neutral-700">
        <ArrowLeft className="h-4 w-4" strokeWidth={1.5} /> Back
      </button>

      <h1 className="text-xl font-bold">Upload prescription</h1>
      <p className="text-sm text-neutral-600">
        Your cart contains prescription-required medicines. Upload a valid prescription to continue with delivery.
      </p>

      <Card>
        <input
          ref={fileRef}
          type="file"
          accept=".jpg,.jpeg,.png,.pdf"
          className="hidden"
          onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])}
        />

        {!file ? (
          <button
            onClick={() => fileRef.current?.click()}
            className="flex w-full flex-col items-center gap-3 rounded-lg border-2 border-dashed border-neutral-300 px-6 py-10 text-neutral-500 hover:border-primary-400 hover:bg-primary-50/50 transition-colors"
          >
            <Upload className="h-8 w-8" strokeWidth={1.5} />
            <span className="text-sm font-medium">Click to upload prescription</span>
            <span className="text-xs">JPG, PNG or PDF — max 5 MB</span>
          </button>
        ) : (
          <div className="flex items-center gap-3 rounded-lg border border-neutral-200 bg-neutral-50 p-3">
            <FileText className="h-8 w-8 shrink-0 text-primary-600" strokeWidth={1.5} />
            <div className="flex-1 min-w-0">
              <p className="truncate text-sm font-medium">{file.name}</p>
              <p className="text-xs text-neutral-500">{(file.size / 1024).toFixed(0)} KB</p>
            </div>
            {uploaded && <Check className="h-5 w-5 text-green-600" strokeWidth={1.5} />}
            <button
              onClick={() => { setFile(null); setUploaded(false); }}
              className="rounded p-1 text-neutral-400 hover:text-accent"
            >
              <X className="h-4 w-4" strokeWidth={1.5} />
            </button>
          </div>
        )}

        <div className="mt-4 flex justify-end gap-2">
          {file && !uploaded && (
            <Button onClick={handleUpload} loading={uploading}>
              Upload
            </Button>
          )}
          {uploaded && (
            <Button onClick={() => navigate('/order/review')}>
              Continue to review
            </Button>
          )}
        </div>
      </Card>
    </div>
  );
}
