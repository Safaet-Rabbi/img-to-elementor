'use client';

import React, { useEffect, useState } from 'react';
import { Header } from '../../components/layout/header';
import { Button } from '../../components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '../../components/ui/card';
import { Input } from '../../components/ui/input';
import { Badge } from '../../components/ui/badge';
import { api } from '../../lib/api';
import toast from 'react-hot-toast';
import { Globe, Plus, Trash2, CheckCircle2, ShieldCheck, Zap } from 'lucide-react';

export default function SettingsPage() {
  const [sites, setSites] = useState<any[]>([]);
  const [newSiteUrl, setNewSiteUrl] = useState('');
  const [newSiteName, setNewSiteName] = useState('');
  const [newUsername, setNewUsername] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [testingId, setTestingId] = useState<string | null>(null);

  const fetchSites = async () => {
    try {
      const res = await api.sites.list();
      if (res) setSites(res);
    } catch {
      // ignore
    }
  };

  useEffect(() => {
    fetchSites();
  }, []);

  const handleAddSite = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.sites.create({
        name: newSiteName,
        siteUrl: newSiteUrl,
        credentials: {
          username: newUsername,
          applicationPassword: newPassword,
        },
      });
      toast.success('WordPress connection saved with encrypted credentials');
      setNewSiteName('');
      setNewSiteUrl('');
      setNewUsername('');
      setNewPassword('');
      fetchSites();
    } catch (err: any) {
      toast.error('Failed to register site connection');
    }
  };

  const handleTestConnection = async (id: string) => {
    setTestingId(id);
    try {
      const res = await api.sites.test(id);
      if (res && res.isMcpAvailable) {
        toast.success('Connection verified! MCP capabilities discovered.');
      } else {
        toast.error(res?.message || 'Connection test failed');
      }
      fetchSites();
    } catch (err: any) {
      toast.error('Connection test failed');
    } finally {
      setTestingId(null);
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 max-w-4xl w-full mx-auto p-6 md:p-8 space-y-8">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">System Settings & Connections</h1>
          <p className="text-slate-400 mt-1">
            Manage target WordPress sites, MCP connections, and provider configurations.
          </p>
        </div>

        {/* AI Provider Configuration Overview */}
        <Card className="bg-slate-900/50">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Zap className="w-5 h-5 text-amber-400" /> AI Provider Architecture
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div className="border border-slate-800 rounded-lg p-3 bg-slate-950">
                <div className="text-xs text-slate-400">Vision Model</div>
                <div className="font-semibold text-slate-200 mt-1">Gemini / Groq Vision</div>
                <Badge variant="info" className="mt-2 text-xs">Stage A & B (DIR)</Badge>
              </div>
              <div className="border border-slate-800 rounded-lg p-3 bg-slate-950">
                <div className="text-xs text-slate-400">Structure Engine</div>
                <div className="font-semibold text-slate-200 mt-1">Groq / Llama 3.3</div>
                <Badge variant="info" className="mt-2 text-xs">Stage C (Elementor)</Badge>
              </div>
              <div className="border border-slate-800 rounded-lg p-3 bg-slate-950">
                <div className="text-xs text-slate-400">Review & Fallback</div>
                <div className="font-semibold text-slate-200 mt-1">OpenRouter / Balanced</div>
                <Badge variant="info" className="mt-2 text-xs">Stage D (Repair)</Badge>
              </div>
            </div>
            <p className="text-xs text-slate-400">
              Deterministic stage caching enabled: responses are cached by source image hash, prompt version, and model. Default tests execute with zero network calls.
            </p>
          </CardContent>
        </Card>

        {/* WordPress MCP Site Connections */}
        <Card className="bg-slate-900/50">
          <CardHeader>
            <CardTitle className="text-lg flex items-center gap-2">
              <Globe className="w-5 h-5 text-blue-400" /> Connected WordPress Sites (MCP)
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-6">
            {sites.length > 0 && (
              <div className="space-y-3">
                {sites.map((site) => (
                  <div key={site.id} className="border border-slate-800 rounded-lg p-4 bg-slate-950 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                    <div>
                      <div className="font-semibold text-slate-200 flex items-center gap-2">
                        {site.name || 'Unnamed Site'}
                        {site.isMcpAvailable && (
                          <Badge variant="success" className="text-xs">MCP Active</Badge>
                        )}
                      </div>
                      <div className="text-xs text-slate-400 mt-1">{site.siteUrl}</div>
                      {site.wordpressVersion && (
                        <div className="text-xs text-slate-500 mt-0.5">
                          WordPress {site.wordpressVersion} • Elementor {site.elementorVersion || 'Core'}
                        </div>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleTestConnection(site.id)}
                        disabled={testingId === site.id}
                      >
                        {testingId === site.id ? 'Testing...' : 'Test Connection'}
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Add Connection Form */}
            <form onSubmit={handleAddSite} className="border border-slate-800 rounded-lg p-4 bg-slate-950/60 space-y-4">
              <h4 className="text-sm font-semibold text-slate-200">Connect New Elementor Site</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  label="Site Label"
                  placeholder="e.g. Staging Server"
                  value={newSiteName}
                  onChange={(e) => setNewSiteName(e.target.value)}
                  required
                />
                <Input
                  label="WordPress Site URL"
                  placeholder="https://mysite.com"
                  value={newSiteUrl}
                  onChange={(e) => setNewSiteUrl(e.target.value)}
                  required
                />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <Input
                  label="Username"
                  placeholder="admin"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  required
                />
                <Input
                  label="Application Password"
                  type="password"
                  placeholder="xxxx xxxx xxxx xxxx"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  required
                />
              </div>
              <p className="text-xs text-slate-400">
                Credentials are encrypted using AES-256-GCM before storage and never exposed to the frontend.
              </p>
              <Button type="submit" size="sm" className="flex items-center gap-1.5">
                <Plus className="w-4 h-4" /> Save Connection
              </Button>
            </form>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

