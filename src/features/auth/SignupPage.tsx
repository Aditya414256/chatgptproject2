import { useState } from 'react';
import { Link, Navigate, useNavigate } from 'react-router-dom';
import { UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from './useAuth';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { BRAND } from '../../config/brand';

export function SignupPage() {
  const { signUp, session, profile, loading: authLoading } = useAuth();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    email: '',
    password: '',
    full_name: '',
    phone: '',
    role: 'customer' as 'customer' | 'store_owner',
  });
  const [loading, setLoading] = useState(false);

  if (authLoading) return null;
  if (session && profile) {
    return <Navigate to={profile.role === 'store_owner' ? '/dashboard' : '/catalog'} replace />;
  }

  const update = (field: string, value: string) => setForm(f => ({ ...f, [field]: value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (form.password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }
    setLoading(true);
    try {
      await signUp(form.email, form.password, {
        full_name: form.full_name,
        phone: form.phone,
        role: form.role,
      });
      toast.success('Account created! Logging you in…');
      navigate(form.role === 'store_owner' ? '/dashboard/setup' : '/catalog');
    } catch (err: any) {
      toast.error(err.message || 'Signup failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-surface px-4">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <h1 className="text-2xl font-bold text-primary-800">{BRAND.name}</h1>
          <p className="mt-1 text-sm text-neutral-500">Create your account</p>
        </div>

        <div className="rounded-xl border border-neutral-200 bg-white p-6 shadow-sm">
          <h2 className="mb-4 text-lg font-semibold">Sign up</h2>
          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            <Input label="Full name" required value={form.full_name} onChange={e => update('full_name', e.target.value)} placeholder="Your full name" />
            <Input label="Phone" type="tel" required value={form.phone} onChange={e => update('phone', e.target.value)} placeholder="9876543210" />
            <Input label="Email" type="email" required value={form.email} onChange={e => update('email', e.target.value)} placeholder="you@example.com" autoComplete="email" />
            <Input label="Password" type="password" required value={form.password} onChange={e => update('password', e.target.value)} placeholder="At least 6 characters" autoComplete="new-password" />

            <fieldset>
              <legend className="mb-2 text-sm font-medium text-neutral-700">I am a</legend>
              <div className="flex gap-3">
                {(['customer', 'store_owner'] as const).map(r => (
                  <label
                    key={r}
                    className={`flex flex-1 cursor-pointer items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors ${
                      form.role === r
                        ? 'border-primary-600 bg-primary-50 text-primary-800'
                        : 'border-neutral-300 bg-white text-neutral-600 hover:bg-neutral-50'
                    }`}
                  >
                    <input
                      type="radio"
                      name="role"
                      value={r}
                      checked={form.role === r}
                      onChange={() => update('role', r)}
                      className="sr-only"
                    />
                    {r === 'customer' ? 'Customer' : 'Store Owner'}
                  </label>
                ))}
              </div>
            </fieldset>

            <Button type="submit" loading={loading} icon={<UserPlus className="h-4 w-4" strokeWidth={1.5} />}>
              Create account
            </Button>
          </form>
          <p className="mt-4 text-center text-xs text-neutral-500">
            Already have an account?{' '}
            <Link to="/login" className="font-medium text-primary-700 hover:underline">
              Log in
            </Link>
          </p>
        </div>
        <p className="mt-6 text-center text-xs text-neutral-400">{BRAND.footer}</p>
      </div>
    </div>
  );
}
