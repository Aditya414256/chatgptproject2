import { useState } from 'react';
import { Link, Navigate } from 'react-router-dom';
import { LogIn } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from './useAuth';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { BRAND } from '../../config/brand';

export function LoginPage() {
  const { signIn, session, profile, loading: authLoading } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  if (authLoading) return null;
  if (session && profile) {
    return <Navigate to={profile.role === 'store_owner' ? '/dashboard' : '/catalog'} replace />;
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await signIn(email, password);
      toast.success('Welcome back!');
    } catch (err: any) {
      toast.error(err.message || 'Login failed');
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-primary-800">{BRAND.name}</h1>
          <p className="mt-1 text-sm text-neutral-500">{BRAND.tagline}</p>
        </div>

        <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold">Log in</h2>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <Input
              label="Email"
              type="email"
              required
              value={email}
              onChange={e => setEmail(e.target.value)}
              placeholder="you@example.com"
              autoComplete="email"
            />
            <Input
              label="Password"
              type="password"
              required
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
            />
            <Button type="submit" loading={loading} icon={<LogIn className="h-4 w-4" strokeWidth={1.5} />}>
              Log in
            </Button>
          </form>
          <p className="mt-4 text-center text-xs text-neutral-500">
            Don&apos;t have an account?{' '}
            <Link to="/signup" className="font-medium text-primary-700 hover:underline">
              Sign up
            </Link>
          </p>
        </div>
        <p className="mt-6 text-center text-xs text-neutral-400">{BRAND.footer}</p>
      </div>
    </div>
  );
}
