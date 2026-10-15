import React, { useState, useEffect } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Layers, Sun, Moon, LogOut, User as UserIcon, Plus, Menu, X, Settings } from 'lucide-react';
import { useAuthStore } from '@/store/auth';
import { Button } from '@/components/ui/button';

export function Header() {
  const pathname = usePathname();
  const { user, isAuthenticated, logout } = useAuthStore();
  const [theme, setTheme] = useState<'light' | 'dark'>('dark');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    // Check initial theme from document class or localStorage
    const savedTheme = localStorage.getItem('dte_theme') as 'light' | 'dark' | null;
    const isDark = savedTheme === 'dark' || (!savedTheme && window.matchMedia('(prefers-color-scheme: dark)').matches);
    const initialTheme = isDark ? 'dark' : 'light';
    setTheme(initialTheme);
    if (isDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, []);

  const toggleTheme = () => {
    const nextTheme = theme === 'dark' ? 'light' : 'dark';
    setTheme(nextTheme);
    localStorage.setItem('dte_theme', nextTheme);
    if (nextTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  };

  const navLinks = [
    { href: '/', label: 'Projects' },
    { href: '/upload', label: 'New Conversion' },
    { href: '/settings', label: 'Settings' },
  ];

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border bg-card/80 backdrop-blur supports-[backdrop-filter]:bg-card/60">
      <div className="flex h-16 items-center justify-between px-4 sm:px-8 max-w-7xl mx-auto">
        {/* Brand */}
        <div className="flex items-center gap-6">
          <Link href="/" className="flex items-center gap-2.5 font-bold text-lg text-foreground transition-opacity hover:opacity-90">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-gradient-to-tr from-primary to-accent shadow-md shadow-primary/25 text-white">
              <Layers className="h-5 w-5" />
            </div>
            <span className="tracking-tight">
              Design<span className="text-primary font-black">2</span>Elementor
            </span>
          </Link>

          {/* Desktop Nav */}
          <nav className="hidden md:flex items-center gap-1">
            {navLinks.map((link) => {
              const isActive = pathname === link.href || (link.href !== '/' && pathname.startsWith(link.href));
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`px-3 py-1.5 text-sm font-medium rounded-lg transition-colors ${
                    isActive
                      ? 'bg-secondary text-foreground font-semibold'
                      : 'text-muted-foreground hover:text-foreground hover:bg-secondary/50'
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </nav>
        </div>

        {/* Action controls */}
        <div className="flex items-center gap-3">
          <Link href="/upload" className="hidden sm:inline-flex">
            <Button size="sm" leftIcon={<Plus className="h-4 w-4" />}>
              New Conversion
            </Button>
          </Link>

          {/* Dark/Light mode toggle */}
          <Button
            variant="ghost"
            size="icon"
            onClick={toggleTheme}
            aria-label="Toggle theme"
            className="rounded-lg text-muted-foreground hover:text-foreground"
          >
            {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
          </Button>

          {/* User auth state */}
          {isAuthenticated && user ? (
            <div className="flex items-center gap-3 pl-2 border-l border-border">
              <div className="hidden sm:flex flex-col text-right">
                <span className="text-xs font-semibold text-foreground truncate max-w-[140px]">
                  {user.email}
                </span>
                <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
                  {user.role || 'User'}
                </span>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={logout}
                aria-label="Log out"
                title="Log out"
                className="text-muted-foreground hover:text-destructive"
              >
                <LogOut className="h-4 w-4" />
              </Button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <Link href="/auth/login">
                <Button variant="ghost" size="sm">
                  Sign In
                </Button>
              </Link>
              <Link href="/auth/register">
                <Button variant="outline" size="sm">
                  Sign Up
                </Button>
              </Link>
            </div>
          )}

          {/* Mobile hamburger */}
          <Button
            variant="ghost"
            size="icon"
            className="md:hidden"
            onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
            aria-label="Toggle navigation menu"
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </Button>
        </div>
      </div>

      {/* Mobile menu dropdown */}
      {mobileMenuOpen && (
        <div className="md:hidden border-b border-border bg-card px-4 pt-2 pb-4 space-y-1">
          {navLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              onClick={() => setMobileMenuOpen(false)}
              className="block px-3 py-2 rounded-md text-base font-medium text-muted-foreground hover:text-foreground hover:bg-secondary"
            >
              {link.label}
            </Link>
          ))}
          <div className="pt-2 border-t border-border mt-2">
            <Link
              href="/upload"
              onClick={() => setMobileMenuOpen(false)}
              className="block w-full text-center py-2 text-sm font-semibold text-primary"
            >
              + Start New Conversion
            </Link>
          </div>
        </div>
      )}
    </header>
  );
}
