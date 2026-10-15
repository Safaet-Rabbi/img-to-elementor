'use client';

import React, { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Header } from '../../../components/layout/header';
import { Card, CardHeader, CardTitle, CardContent } from '../../../components/ui/card';
import { Input } from '../../../components/ui/input';
import { Button } from '../../../components/ui/button';
import { api } from '../../../lib/api';
import { useAuthStore } from '../../../store/auth';
import toast from 'react-hot-toast';
import { UserPlus, Zap, Mail, Lock } from 'lucide-react';

export default function RegisterPage() {
  const router = useRouter();
  const setAuth = useAuthStore((state) => state.setAuth);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isQuickLoading, setIsQuickLoading] = useState(false);

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error('Please enter all fields');
      return;
    }

    if (password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }

    if (password !== confirmPassword) {
      toast.error('Passwords do not match');
      return;
    }

    setIsLoading(true);
    try {
      const res = await api.auth.register({ email, password });
      setAuth(res.user, res.token);
      toast.success('Account registered successfully!');
      router.push('/');
    } catch (err: any) {
      toast.error(err.response?.data?.error?.message || err.message || 'Registration failed');
    } finally {
      setIsLoading(false);
    }
  };

  const handleQuickDevLogin = async () => {
    setIsQuickLoading(true);
    try {
      const res = await api.auth.quickLogin();
      setAuth(res.user, res.token);
      toast.success('Logged in as Dev User!');
      router.push('/');
    } catch (err: any) {
      toast.error(err.response?.data?.error?.message || err.message || 'Quick login failed');
    } finally {
      setIsQuickLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col">
      <Header />
      <main className="flex-1 flex items-center justify-center p-6 md:p-8">
        <div className="w-full max-w-md space-y-6">
          <div className="text-center space-y-2">
            <h1 className="text-3xl font-bold tracking-tight">Create Account</h1>
            <p className="text-sm text-slate-400">
              Start converting your design mockups into Elementor templates
            </p>
          </div>

          <Card className="bg-slate-900/60 border-slate-800">
            <CardHeader>
              <CardTitle className="text-lg flex items-center gap-2">
                <UserPlus className="w-5 h-5 text-blue-400" />
                Sign Up
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <form onSubmit={handleRegister} className="space-y-4">
                <Input
                  label="Email Address"
                  type="email"
                  placeholder="name@example.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  leftIcon={<Mail className="w-4 h-4" />}
                  required
                />
                <Input
                  label="Password (min 6 characters)"
                  type="password"
                  placeholder="••••••••"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  leftIcon={<Lock className="w-4 h-4" />}
                  required
                />
                <Input
                  label="Confirm Password"
                  type="password"
                  placeholder="••••••••"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  leftIcon={<Lock className="w-4 h-4" />}
                  required
                />
                <Button type="submit" className="w-full mt-2" isLoading={isLoading}>
                  Create Account
                </Button>
              </form>

              <div className="relative my-4">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-slate-800" />
                </div>
                <div className="relative flex justify-center text-xs uppercase">
                  <span className="bg-slate-900 px-2 text-slate-400 font-semibold">
                    Developer Fast-Track
                  </span>
                </div>
              </div>

              <Button
                type="button"
                variant="outline"
                className="w-full border-blue-500/30 hover:bg-blue-500/10 text-blue-400"
                onClick={handleQuickDevLogin}
                isLoading={isQuickLoading}
                leftIcon={<Zap className="w-4 h-4 text-blue-400" />}
              >
                1-Click Quick Dev Login
              </Button>

              <div className="text-center text-xs text-slate-400 pt-2">
                Already have an account?{' '}
                <Link href="/auth/login" className="text-blue-400 hover:underline font-semibold">
                  Sign In
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  );
}

