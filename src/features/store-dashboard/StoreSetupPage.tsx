import { useState, useEffect } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { MapPin, Save } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../auth/useAuth';
import { Card } from '../../components/ui/Card';
import { Input } from '../../components/ui/Input';
import { Button } from '../../components/ui/Button';
import type { Store } from '../../types/database';

export function StoreSetupPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [loading, setLoading] = useState(false);
  const [geoLoading, setGeoLoading] = useState(false);

  const { data: store } = useQuery({
    queryKey: ['my-store'],
    queryFn: async () => {
      const { data } = await supabase
        .from('stores')
        .select('*')
        .eq('owner_id', user!.id)
        .maybeSingle();
      return data as Store | null;
    },
    enabled: !!user,
  });

  const [form, setForm] = useState({
    name: '', address: '', lat: '', lng: '',
    is_open: true, offers_delivery: false, serviceable_pincodes: '',
  });

  useEffect(() => {
    if (store) {
      setForm({
        name: store.name,
        address: store.address,
        lat: String(store.lat),
        lng: String(store.lng),
        is_open: store.is_open,
        offers_delivery: store.offers_delivery,
        serviceable_pincodes: (store.serviceable_pincodes ?? []).join(', '),
      });
    }
  }, [store]);

  const update = (k: string, v: any) => setForm(f => ({ ...f, [k]: v }));

  const captureLocation = () => {
    if (!navigator.geolocation) { toast.error('Geolocation not supported'); return; }
    setGeoLoading(true);
    navigator.geolocation.getCurrentPosition(
      pos => { update('lat', String(pos.coords.latitude)); update('lng', String(pos.coords.longitude)); setGeoLoading(false); toast.success('Location captured'); },
      () => { toast.error('Could not get location'); setGeoLoading(false); }
    );
  };

  const handleSave = async () => {
    if (!form.name || !form.address || !form.lat || !form.lng) { toast.error('Fill in all required fields'); return; }
    setLoading(true);
    try {
      const pincodes = form.serviceable_pincodes.split(',').map(p => p.trim()).filter(Boolean);
      const payload = {
        owner_id: user!.id,
        name: form.name,
        address: form.address,
        lat: parseFloat(form.lat),
        lng: parseFloat(form.lng),
        is_open: form.is_open,
        offers_delivery: form.offers_delivery,
        serviceable_pincodes: pincodes,
      };
      if (store) {
        const { error } = await supabase.from('stores').update(payload as any).eq('id', store.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from('stores').insert(payload as any);
        if (error) throw error;
      }
      queryClient.invalidateQueries({ queryKey: ['my-store'] });
      toast.success('Store saved');
    } catch (err: any) {
      toast.error(err.message || 'Failed to save');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">{store ? 'Store settings' : 'Set up your store'}</h1>
      <Card>
        <div className="flex flex-col gap-4">
          <Input label="Store name" required value={form.name} onChange={e => update('name', e.target.value)} placeholder="e.g. MedPlus Pharmacy" />
          <Input label="Address" required value={form.address} onChange={e => update('address', e.target.value)} placeholder="Full address" />
          <div className="grid grid-cols-2 gap-3">
            <Input label="Latitude" required value={form.lat} onChange={e => update('lat', e.target.value)} placeholder="21.3500" />
            <Input label="Longitude" required value={form.lng} onChange={e => update('lng', e.target.value)} placeholder="74.8800" />
          </div>
          <Button variant="secondary" size="sm" onClick={captureLocation} loading={geoLoading} icon={<MapPin className="h-4 w-4" strokeWidth={1.5} />}>
            Use my current location
          </Button>
          <div className="flex gap-6">
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={form.is_open} onChange={e => update('is_open', e.target.checked)} className="rounded border-neutral-300" />
              Store is open
            </label>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={form.offers_delivery} onChange={e => update('offers_delivery', e.target.checked)} className="rounded border-neutral-300" />
              Offers delivery
            </label>
          </div>
          {form.offers_delivery && (
            <Input label="Serviceable pincodes" value={form.serviceable_pincodes} onChange={e => update('serviceable_pincodes', e.target.value)} placeholder="425405, 425001" hint="Comma-separated pincodes" />
          )}
          <div className="flex justify-end">
            <Button loading={loading} onClick={handleSave} icon={<Save className="h-4 w-4" strokeWidth={1.5} />}>
              {store ? 'Save changes' : 'Create store'}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}
