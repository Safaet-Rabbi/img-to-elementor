'use client';

import React, { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { Header } from '../../../../components/layout/header';
import { Button } from '../../../../components/ui/button';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '../../../../components/ui/card';
import { Input } from '../../../../components/ui/input';
import { Badge } from '../../../../components/ui/badge';
import { api } from '../../../../lib/api';
import toast from 'react-hot-toast';
import { ArrowLeft, Send, CheckCircle2, AlertTriangle, ExternalLink } from 'lucide-react';

export default function PublishPage() {
  const params = useParams();
  const router = useRouter();
  const projectId = params.id as string;

  const [project, setProject] = useState<any>(null);
  const [job, setJob] = useState<any>(null);
  const [sites, setSites] = useState<any[]>([]);
  const [selectedSiteId, setSelectedSiteId] = useState('');
  const [title, setTitle] = useState('');
  const [publishMode, setPublishMode] = useState<'draft' | 'publish'>('draft');
  const [confirmed, setConfirmed] = useState(false);
  const [isPublishing, setIsPublishing] = useState(false);
  const [publishResult, setPublishResult] = useState<any>(null);

  useEffect(() => {
    async function loadData() {
      try {
        const projRes = await api.projects.get(projectId);
        if (projRes) {
          setProject(projRes);
          setTitle(projRes.name);
          const latestJob = (projRes as any).conversionJobs?.[0];
          setJob(latestJob);
        }

        const sitesRes = await api.sites.list();
        if (sitesRes && sitesRes.length > 0) {
          setSites(sitesRes);
          setSelectedSiteId(sitesRes[0].id);
        }
      } catch (err: any) {
        toast.error('Failed to load publish context');
      }
    }
    loadData();
  }, [projectId]);

  const handlePublish = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!job) {
      toast.error('No conversion job ready to publish');
      return;
    }
    if (!selectedSiteId) {
      toast.error('Please configure or select a target WordPress site');
      return;
    }
    if (!confirmed) {
      toast.error('Please check the confirmation box before publishing');
      return;
    }

    setIsPublishing(true);
    try {
      const res = await api.publish.publish({
        projectId,
        siteConnectionId: selectedSiteId,
        resourceType: 'page',
        title,
        mode: publishMode,
      });

      if (res) {
        setPublishResult(res);
        toast.success(`Page published as ${publishMode}!`);
      } else {
        toast.error('Publishing failed');
      }
    } catch (err: any) {
      toast.error(err.response?.data?.error?.message || err.message || 'Publishing error');
    } finally {
      setIsPublishing(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 max-w-3xl w-full mx-auto p-6 md:p-8 space-y-6">
        <Link href={`/projects/${projectId}`} className="inline-flex items-center gap-1.5 text-xs text-slate-400 hover:text-slate-200">
          <ArrowLeft className="w-3.5 h-3.5" /> Back to project
        </Link>

        <div>
          <h1 className="text-3xl font-bold tracking-tight">Publish to Elementor</h1>
          <p className="text-slate-400 mt-1">
            Directly compile and push your design to WordPress using verified Elementor MCP capabilities.
          </p>
        </div>

        {publishResult ? (
          <Card className="border-green-500/50 bg-green-500/5 p-6 text-center space-y-4">
            <CheckCircle2 className="w-12 h-12 text-green-500 mx-auto" />
            <h2 className="text-2xl font-bold text-slate-100">Successfully Published!</h2>
            <p className="text-slate-300 text-sm max-w-md mx-auto">
              Your design has been compiled into native Elementor structures and registered on the target WordPress site.
            </p>
            <div className="bg-slate-900/80 border border-slate-800 rounded-lg p-4 max-w-sm mx-auto text-left text-xs space-y-2">
              <div><span className="text-slate-500">Resource ID:</span> {publishResult.remoteId}</div>
              <div><span className="text-slate-500">Status:</span> {publishResult.status}</div>
              {publishResult.remoteUrl && (
                <div className="truncate">
                  <span className="text-slate-500">URL:</span>{' '}
                  <a href={publishResult.remoteUrl} target="_blank" rel="noreferrer" className="text-blue-400 underline">
                    {publishResult.remoteUrl}
                  </a>
                </div>
              )}
            </div>
            <div className="pt-4 flex justify-center gap-3">
              <Button onClick={() => router.push(`/projects/${projectId}`)} variant="outline">
                Return to Project
              </Button>
              {publishResult.remoteUrl && (
                <a href={publishResult.remoteUrl} target="_blank" rel="noreferrer">
                  <Button className="flex items-center gap-2">
                    <ExternalLink className="w-4 h-4" /> View Live Page
                  </Button>
                </a>
              )}
            </div>
          </Card>
        ) : (
          <form onSubmit={handlePublish} className="space-y-6">
            <Card className="bg-slate-900/50">
              <CardHeader>
                <CardTitle className="text-lg">Target WordPress Site</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {sites.length === 0 ? (
                  <div className="p-4 rounded-lg border border-amber-500/30 bg-amber-500/10 text-amber-300 text-sm flex items-start gap-3">
                    <AlertTriangle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="font-medium">No WordPress connections found</p>
                      <p className="text-xs text-amber-400 mt-1">
                        Go to <Link href="/settings" className="underline font-semibold">Settings</Link> to connect your Elementor target site using WordPress Application Passwords.
                      </p>
                    </div>
                  </div>
                ) : (
                  <div>
                    <label className="text-sm font-medium text-slate-300 block mb-2">Connected Site</label>
                    <select
                      className="w-full bg-slate-950 border border-slate-800 rounded-lg p-2.5 text-sm text-slate-200"
                      value={selectedSiteId}
                      onChange={(e) => setSelectedSiteId(e.target.value)}
                    >
                      {sites.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name || s.siteUrl} ({s.siteUrl})
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                <Input
                  label="Page Title"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g. Landing Page"
                  required
                />

                <div>
                  <label className="text-sm font-medium text-slate-300 block mb-2">Publish Status</label>
                  <div className="grid grid-cols-2 gap-4">
                    <div
                      onClick={() => setPublishMode('draft')}
                      className={`border rounded-xl p-4 cursor-pointer transition-all ${
                        publishMode === 'draft'
                          ? 'border-blue-500 bg-blue-500/10'
                          : 'border-slate-800 bg-slate-950 hover:border-slate-700'
                      }`}
                    >
                      <div className="font-semibold text-sm">Save as Draft (Recommended)</div>
                      <p className="text-xs text-slate-400 mt-1">
                        Inspect in Elementor visual editor before publishing live.
                      </p>
                    </div>
                    <div
                      onClick={() => setPublishMode('publish')}
                      className={`border rounded-xl p-4 cursor-pointer transition-all ${
                        publishMode === 'publish'
                          ? 'border-blue-500 bg-blue-500/10'
                          : 'border-slate-800 bg-slate-950 hover:border-slate-700'
                      }`}
                    >
                      <div className="font-semibold text-sm">Publish Immediately</div>
                      <p className="text-xs text-slate-400 mt-1">
                        Page is created live on the WordPress site.
                      </p>
                    </div>
                  </div>
                </div>

                <div className="pt-2">
                  <label className="flex items-start gap-2.5 cursor-pointer text-sm text-slate-300">
                    <input
                      type="checkbox"
                      checked={confirmed}
                      onChange={(e) => setConfirmed(e.target.checked)}
                      className="mt-1 rounded border-slate-700 bg-slate-950 text-blue-600 focus:ring-0"
                    />
                    <span>
                      I explicitly authorize publishing this generated Elementor document to the connected WordPress destination.
                    </span>
                  </label>
                </div>
              </CardContent>
              <CardFooter className="flex justify-end gap-3 border-t border-slate-800 pt-4">
                <Button type="button" variant="outline" onClick={() => router.push(`/projects/${projectId}`)}>
                  Cancel
                </Button>
                <Button type="submit" disabled={isPublishing || !confirmed || sites.length === 0} className="flex items-center gap-2">
                  <Send className="w-4 h-4" />
                  {isPublishing ? 'Publishing via MCP...' : `Publish as ${publishMode}`}
                </Button>
              </CardFooter>
            </Card>
          </form>
        )}
      </main>
    </div>
  );
}

