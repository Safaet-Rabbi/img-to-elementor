'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Header } from '../../../components/layout/header';
import { Button } from '../../../components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '../../../components/ui/card';
import { Badge } from '../../../components/ui/badge';
import { Tabs } from '../../../components/ui/tabs';
import { StageProgress } from '../../../components/conversion/stage-progress';
import { DIRInspector } from '../../../components/conversion/dir-inspector';
import { ElementorInspector } from '../../../components/conversion/elementor-inspector';
import { api } from '../../../lib/api';
import toast from 'react-hot-toast';
import { Download, RefreshCw, Send, ArrowLeft, Eye } from 'lucide-react';

export default function ProjectDetailPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;

  const [project, setProject] = useState<any>(null);
  const [job, setJob] = useState<any>(null);
  const [dirData, setDirData] = useState<any>(null);
  const [elementorData, setElementorData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'status' | 'dir' | 'elementor'>('status');

  const fetchProjectData = async () => {
    try {
      const res = await api.projects.get(projectId);
      if (res) {
        setProject(res);
        const latestJob = (res as any).conversionJobs?.[0];
        if (latestJob) {
          setJob(latestJob);

          if (latestJob.dirArtifact) {
            setDirData(latestJob.dirArtifact);
          } else {
            api.jobs.getDir(latestJob.id).then((d) => setDirData(d)).catch(() => {});
          }

          if (latestJob.elementorArtifact) {
            setElementorData(latestJob.elementorArtifact);
          } else {
            api.jobs.getElementor(latestJob.id).then((d) => setElementorData(d)).catch(() => {});
          }
        }
      }
    } catch (err: any) {
      toast.error('Failed to load project');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProjectData();
    // Poll while job is processing
    const interval = setInterval(() => {
      if (job && !['preview_ready', 'failed', 'published'].includes(job.status)) {
        fetchProjectData();
      }
    }, 3000);
    return () => clearInterval(interval);
  }, [projectId, job?.status]);

  const handleRetry = async () => {
    if (!job) return;
    try {
      await api.jobs.retry(job.id);
      toast.success('Conversion job retry queued');
      fetchProjectData();
    } catch (err: any) {
      toast.error('Failed to retry job');
    }
  };

  const downloadJson = (data: any, filename: string) => {
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  };

  if (loading) {
    return (
      <div className="min-h-screen flex flex-col">
        <Header />
        <div className="flex-1 max-w-7xl w-full mx-auto p-8 flex items-center justify-center">
          <RefreshCw className="w-8 h-8 text-blue-500 animate-spin" />
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 max-w-7xl w-full mx-auto p-6 md:p-8 space-y-6">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 pb-6 border-b border-slate-800">
          <div className="space-y-1">
            <Link href="/" className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200 mb-1">
              <ArrowLeft className="w-3.5 h-3.5" /> Back to dashboard
            </Link>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold tracking-tight">{project?.name}</h1>
              {job && (
                <Badge variant={job.status === 'preview_ready' ? 'success' : job.status === 'failed' ? 'error' : 'info'}>
                  {job.status}
                </Badge>
              )}
            </div>
          </div>

          <div className="flex items-center gap-3">
            {job?.status === 'failed' && (
              <Button variant="outline" onClick={handleRetry} className="flex items-center gap-2">
                <RefreshCw className="w-4 h-4" /> Retry Failed Stage
              </Button>
            )}
            {elementorData && (
              <>
                <Button
                  variant="outline"
                  onClick={() => downloadJson(elementorData, `${project.name}-elementor.json`)}
                  className="flex items-center gap-2"
                >
                  <Download className="w-4 h-4" /> Download Elementor JSON
                </Button>
                <Link href={`/projects/${projectId}/publish`}>
                  <Button className="flex items-center gap-2 bg-blue-600 hover:bg-blue-500">
                    <Send className="w-4 h-4" /> Direct Publish via MCP
                  </Button>
                </Link>
              </>
            )}
          </div>
        </div>

        {/* Navigation Tabs */}
        <div className="flex border-b border-slate-800 space-x-6 text-sm font-medium">
          <button
            onClick={() => setActiveTab('status')}
            className={`pb-3 border-b-2 transition-colors ${
              activeTab === 'status'
                ? 'border-blue-500 text-blue-400'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Pipeline Progress
          </button>
          <button
            onClick={() => setActiveTab('dir')}
            disabled={!dirData}
            className={`pb-3 border-b-2 transition-colors ${
              activeTab === 'dir'
                ? 'border-blue-500 text-blue-400'
                : !dirData
                ? 'border-transparent text-slate-600 cursor-not-allowed'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            DIR Inspector
          </button>
          <button
            onClick={() => setActiveTab('elementor')}
            disabled={!elementorData}
            className={`pb-3 border-b-2 transition-colors ${
              activeTab === 'elementor'
                ? 'border-blue-500 text-blue-400'
                : !elementorData
                ? 'border-transparent text-slate-600 cursor-not-allowed'
                : 'border-transparent text-slate-400 hover:text-slate-200'
            }`}
          >
            Elementor JSON & Structure
          </button>
        </div>

        {activeTab === 'status' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <Card className="bg-slate-900/50">
                <CardHeader>
                  <CardTitle className="text-lg">Conversion Stages</CardTitle>
                </CardHeader>
                <CardContent>
                  <StageProgress overallStatus={job?.status || 'queued'} stages={job?.stages || []} />
                </CardContent>
              </Card>

              {job?.errorMessage && (
                <div className="p-4 rounded-xl border border-red-500/30 bg-red-500/10 text-red-400 text-sm">
                  <h4 className="font-semibold text-red-300">Stage Execution Failed</h4>
                  <p className="mt-1">{job.errorMessage}</p>
                </div>
              )}
            </div>

            <div className="space-y-6">
              <Card className="bg-slate-900/50">
                <CardHeader>
                  <CardTitle className="text-lg">Source Design</CardTitle>
                </CardHeader>
                <CardContent>
                  {project?.assets?.find((a: any) => a.type === 'ORIGINAL_IMAGE') ? (
                    <div className="border border-slate-800 rounded-lg p-2 bg-slate-950 text-center">
                      <p className="text-xs text-slate-400 mb-2">Original Upload</p>
                      <img
                        src={`http://localhost:4000/storage/${project.assets[0].storagePath}`}
                        alt="Source design"
                        className="max-h-64 mx-auto rounded object-contain"
                        onError={(e) => {
                          (e.target as any).style.display = 'none';
                        }}
                      />
                    </div>
                  ) : (
                    <p className="text-sm text-slate-400">Source asset registered</p>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        )}

        {activeTab === 'dir' && dirData && (
          <DIRInspector dirData={dirData} />
        )}

        {activeTab === 'elementor' && elementorData && (
          <ElementorInspector elementorData={elementorData} />
        )}
      </main>
    </div>
  );
}

