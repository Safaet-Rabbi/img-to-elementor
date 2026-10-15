'use client';

import React, { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { Header } from '../components/layout/header';
import { Button } from '../components/ui/button';
import { Card, CardHeader, CardTitle, CardContent } from '../components/ui/card';
import { Badge } from '../components/ui/badge';
import { api } from '../lib/api';
import { useAuthStore } from '../store/auth';
import toast from 'react-hot-toast';
import { ArrowRight, Plus, Layers, Clock, Zap, LogIn } from 'lucide-react';

export default function DashboardPage() {
  const { isAuthenticated, token, setAuth } = useAuthStore();
  const [projects, setProjects] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [quickLoginLoading, setQuickLoginLoading] = useState(false);

  const loadProjects = useCallback(async () => {
    // Check if token exists in store or localStorage
    const storedToken = token || (typeof window !== 'undefined' ? localStorage.getItem('dte_token') : null);
    if (!storedToken) {
      setProjects([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const res = await api.projects.list();
      if (res) {
        setProjects(res);
      }
    } catch {
      // Unauthenticated or network issue
      setProjects([]);
    } finally {
      setLoading(false);
    }
  }, [token]);

  useEffect(() => {
    loadProjects();
  }, [loadProjects, isAuthenticated]);

  const handleQuickDevLogin = async () => {
    setQuickLoginLoading(true);
    try {
      const res = await api.auth.quickLogin();
      setAuth(res.user, res.token);
      toast.success('Signed in as Dev User!');
      await loadProjects();
    } catch (err: any) {
      toast.error(err.response?.data?.error?.message || err.message || 'Login failed');
    } finally {
      setQuickLoginLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 max-w-7xl w-full mx-auto p-6 md:p-8 space-y-8">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tight">Projects Dashboard</h1>
            <p className="text-slate-400 mt-1">
              Manage website designs, conversion workflows, and Elementor artifacts.
            </p>
          </div>
          <Link href="/upload">
            <Button className="flex items-center gap-2">
              <Plus className="w-4 h-4" />
              New Conversion
            </Button>
          </Link>
        </div>

        {!isAuthenticated && !loading && (
          <Card className="border border-blue-500/30 bg-blue-950/20 p-6">
            <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
              <div className="space-y-1">
                <h3 className="text-lg font-semibold text-blue-400">Authentication Required</h3>
                <p className="text-sm text-slate-400">
                  Please sign in to view your saved projects, upload screenshots, and access conversion history.
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Button
                  onClick={handleQuickDevLogin}
                  isLoading={quickLoginLoading}
                  className="bg-blue-600 hover:bg-blue-500 text-white flex items-center gap-2"
                >
                  <Zap className="w-4 h-4" />
                  1-Click Quick Dev Login
                </Button>
                <Link href="/auth/login">
                  <Button variant="outline" className="flex items-center gap-2">
                    <LogIn className="w-4 h-4" />
                    Sign In
                  </Button>
                </Link>
              </div>
            </div>
          </Card>
        )}

        {loading ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-48 rounded-xl bg-slate-900 border border-slate-800 animate-pulse" />
            ))}
          </div>
        ) : projects.length === 0 ? (
          <Card className="border-dashed border-2 border-slate-800 text-center py-16 bg-slate-900/30">
            <CardContent className="space-y-4">
              <Layers className="w-12 h-12 text-slate-500 mx-auto" />
              <h3 className="text-xl font-semibold">No conversion projects yet</h3>
              <p className="text-slate-400 max-w-md mx-auto text-sm">
                Upload a PNG/JPG screenshot or full-page landing page design to start converting to editable Elementor structure.
              </p>
              <Link href="/upload">
                <Button className="mt-2">Start First Conversion</Button>
              </Link>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {projects.map((project) => {
              const latestJob = project.conversionJobs?.[0];
              return (
                <Link key={project.id} href={`/projects/${project.id}`}>
                  <Card className="hover:border-blue-500/50 transition-all cursor-pointer bg-slate-900/50">
                    <CardHeader>
                      <div className="flex items-start justify-between">
                        <CardTitle className="text-lg">{project.name}</CardTitle>
                        {latestJob && (
                          <Badge variant={latestJob.status === 'preview_ready' ? 'success' : latestJob.status === 'failed' ? 'error' : 'info'}>
                            {latestJob.status}
                          </Badge>
                        )}
                      </div>
                    </CardHeader>
                    <CardContent className="space-y-4">
                      <p className="text-sm text-slate-400 line-clamp-2">
                        {project.description || 'No description provided'}
                      </p>
                      <div className="flex items-center justify-between text-xs text-slate-500 pt-4 border-t border-slate-800">
                        <span className="flex items-center gap-1">
                          <Clock className="w-3.5 h-3.5" />
                          {new Date(project.updatedAt).toLocaleDateString()}
                        </span>
                        <span className="flex items-center gap-1 text-blue-400 font-medium">
                          Inspect <ArrowRight className="w-3 h-3" />
                        </span>
                      </div>
                    </CardContent>
                  </Card>
                </Link>
              );
            })}
          </div>
        )}
      </main>
    </div>
  );
}
