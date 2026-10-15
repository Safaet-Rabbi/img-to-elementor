'use client';

import React, { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { useDropzone } from 'react-dropzone';
import { Header } from '../../components/layout/header';
import { Button } from '../../components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { api } from '../../lib/api';
import { useAuthStore } from '../../store/auth';
import toast from 'react-hot-toast';
import { UploadCloud, FileImage, CheckCircle, Zap, LogIn } from 'lucide-react';

export default function UploadPage() {
  const router = useRouter();
  const { isAuthenticated, setAuth } = useAuthStore();
  const [projectName, setProjectName] = useState('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [quickLoginLoading, setQuickLoginLoading] = useState(false);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: {
      'image/png': ['.png'],
      'image/jpeg': ['.jpg', '.jpeg'],
    },
    maxFiles: 1,
    onDrop: (acceptedFiles) => {
      if (acceptedFiles.length > 0) {
        const file = acceptedFiles[0];
        setSelectedFile(file);
        setPreviewUrl(URL.createObjectURL(file));
        if (!projectName) {
          setProjectName(file.name.replace(/\.[^/.]+$/, ''));
        }
      }
    },
  });

  const handleQuickDevLogin = async () => {
    setQuickLoginLoading(true);
    try {
      const res = await api.auth.quickLogin();
      setAuth(res.user, res.token);
      toast.success('Signed in as Dev User!');
    } catch (err: any) {
      toast.error(err.response?.data?.error?.message || err.message || 'Login failed');
    } finally {
      setQuickLoginLoading(false);
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedFile) {
      toast.error('Please select an image file first');
      return;
    }
    if (!projectName.trim()) {
      toast.error('Please enter a project name');
      return;
    }

    // If user is not yet logged in, auto-login with dev user to avoid 401
    const storedToken = typeof window !== 'undefined' ? localStorage.getItem('dte_token') : null;
    if (!storedToken) {
      try {
        toast('Logging in as dev user before upload...', { icon: '🔑' });
        const res = await api.auth.quickLogin();
        setAuth(res.user, res.token);
      } catch {
        toast.error('Please sign in before uploading designs');
        return;
      }
    }

    setIsSubmitting(true);
    try {
      await api.upload.uploadImage(selectedFile, projectName);
      toast.success('Design uploaded successfully! Pipeline queued.');
      router.push('/');
    } catch (err: any) {
      toast.error(err.response?.data?.error?.message || err.message || 'Upload failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 max-w-4xl w-full mx-auto p-6 md:p-8 space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Upload Webpage Design</h1>
          <p className="text-slate-400 mt-1">
            Accepts PNG, JPG, or full-page tall screenshots. Automatically validates, tiles, and parses layout structure.
          </p>
        </div>

        {!isAuthenticated && (
          <Card className="border border-blue-500/30 bg-blue-950/20 p-4">
            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-blue-400">Authentication Required for Upload</p>
                <p className="text-xs text-slate-400">You must be logged in to store assets and run conversions.</p>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  onClick={handleQuickDevLogin}
                  isLoading={quickLoginLoading}
                  className="bg-blue-600 hover:bg-blue-500 text-white flex items-center gap-1.5"
                >
                  <Zap className="w-3.5 h-3.5" />
                  1-Click Dev Login
                </Button>
                <Link href="/auth/login">
                  <Button size="sm" variant="outline" className="flex items-center gap-1.5">
                    <LogIn className="w-3.5 h-3.5" />
                    Sign In
                  </Button>
                </Link>
              </div>
            </div>
          </Card>
        )}

        <form onSubmit={handleUpload} className="space-y-6">
          <Card className="bg-slate-900/50">
            <CardHeader>
              <CardTitle className="text-lg">Project Details</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Input
                label="Project Name"
                placeholder="e.g. SaaS Landing Page V2"
                value={projectName}
                onChange={(e) => setProjectName(e.target.value)}
                required
              />
            </CardContent>
          </Card>

          <Card className="bg-slate-900/50">
            <CardHeader>
              <CardTitle className="text-lg">Design Screenshot</CardTitle>
            </CardHeader>
            <CardContent>
              <div
                {...getRootProps()}
                className={`border-2 border-dashed rounded-xl p-8 text-center cursor-pointer transition-colors ${
                  isDragActive
                    ? 'border-blue-500 bg-blue-500/10'
                    : selectedFile
                    ? 'border-green-500/50 bg-green-500/5'
                    : 'border-slate-800 hover:border-slate-700 bg-slate-950/40'
                }`}
              >
                <input {...getInputProps()} />
                <div className="flex flex-col items-center justify-center space-y-3">
                  {selectedFile ? (
                    <>
                      <CheckCircle className="w-10 h-10 text-green-500" />
                      <div className="text-sm font-medium text-slate-200">
                        {selectedFile.name} ({(selectedFile.size / (1024 * 1024)).toFixed(2)} MB)
                      </div>
                      <p className="text-xs text-slate-400">Click or drag another image to replace</p>
                    </>
                  ) : (
                    <>
                      <UploadCloud className="w-10 h-10 text-slate-500" />
                      <div className="text-sm font-medium text-slate-200">
                        Drag and drop your screenshot here, or click to browse
                      </div>
                      <p className="text-xs text-slate-400">Supports PNG, JPG, JPEG up to 500MB</p>
                    </>
                  )}
                </div>
              </div>

              {previewUrl && (
                <div className="mt-6 border border-slate-800 rounded-xl overflow-hidden bg-slate-950">
                  <div className="p-3 bg-slate-900 border-b border-slate-800 flex items-center justify-between text-xs text-slate-400">
                    <span className="flex items-center gap-1.5 font-medium">
                      <FileImage className="w-3.5 h-3.5 text-blue-400" /> Image Preview
                    </span>
                    <span>Scroll to preview tall designs</span>
                  </div>
                  <div className="max-h-96 overflow-y-auto p-4 flex justify-center">
                    <img
                      src={previewUrl}
                      alt="Screenshot preview"
                      className="max-w-full h-auto rounded shadow-lg"
                    />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="flex items-center justify-end gap-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => router.push('/')}
              disabled={isSubmitting}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={isSubmitting || !selectedFile}>
              {isSubmitting ? 'Uploading & Processing...' : 'Start Conversion Pipeline'}
            </Button>
          </div>
        </form>
      </main>
    </div>
  );
}
