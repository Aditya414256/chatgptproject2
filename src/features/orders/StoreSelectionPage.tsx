import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { MapPin, ArrowLeft, Loader2, AlertCircle } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { useCart } from '../cart/useCart';
import { getFulfilmentState } from './FulfilmentPage';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { EmptyState } from '../../components/ui/EmptyState';
import { formatPrice, formatDistance } from '../../lib/utils';
import { DEFAULT_RADIUS_KM } from '../../config/constants';
import type { NearbyStore } from '../../types/database';

export function StoreSelectionPage() {
  const navigate = useNavigate();
  const { items, removeItem } = useCart();
  const fulfilment = getFulfilmentState();
  const [userLat, setUserLat] = useState<number | null>(null);
  const [userLng, setUserLng] = useState<number | null>(null);
  const [geoError, setGeoError] = useState<string | null>(null);
  const [geoLoading, setGeoLoading] = useState(false);

  if (!fulfilment || items.length === 0) {
    navigate('/cart');
    return null;
  }

  const isPickup = fulfilment.type === 'pickup';

  // Request geolocation for pickup
  useEffect(() => {
    if (!isPickup) return;
    setGeoLoading(true);
    if (!navigator.geolocation) {
      setGeoError('Geolocation not supported. Using default location near Shirpur.');
      setUserLat(21.35);
      setUserLng(74.88);
      setGeoLoading(false);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      pos => {
        setUserLat(pos.coords.latitude);
        setUserLng(pos.coords.longitude);
        setGeoLoading(false);
      },
      () => {
        setGeoError('Location access denied. Using default location near Shirpur.');
        setUserLat(21.35);
        setUserLng(74.88);
        setGeoLoading(false);
      },
      { enableHighAccuracy: false, timeout: 10000 }
    );
  }, [isPickup]);

  const medicineIds = items.map(i => i.medicine.id);

  const { data: stores, isLoading } = useQuery({
    queryKey: ['stores', fulfilment.type, userLat, userLng, fulfilment.pincode, medicineIds.join(',')],
    queryFn: async (): Promise<NearbyStore[]> => {
      if (isPickup) {
        const { data, error } = await supabase.rpc('nearby_stores', {
          user_lat: userLat!,
          user_lng: userLng!,
          radius_km: DEFAULT_RADIUS_KM,
          medicine_ids: medicineIds,
        });
        if (error) throw error;
        return (data ?? []) as NearbyStore[];
      } else {
        const { data, error } = await supabase.rpc('stores_for_pincode', {
          p_pincode: fulfilment.pincode!,
          medicine_ids: medicineIds,
        });
        if (error) throw error;
        return (data ?? []) as NearbyStore[];
      }
    },
    enabled: isPickup ? (userLat !== null && userLng !== null) : !!fulfilment.pincode,
  });

  const selectStore = (storeId: string, store: NearbyStore) => {
    const state: any = {
      ...fulfilment,
      storeId,
      storeName: store.store_name,
      totalPrice: store.total_price,
    };
    sessionStorage.setItem('fm_fulfilment', JSON.stringify(state));

    if (fulfilment.type === 'delivery' && items.some(i => i.medicine.requires_prescription)) {
      navigate('/order/prescription');
    } else {
      navigate('/order/review');
    }
  };

  const handleRemoveMissing = (missingNames: string[], storeId: string, store: NearbyStore) => {
    items.forEach(item => {
      if (missingNames.includes(item.medicine.name)) {
        removeItem(item.medicine.id);
      }
    });
    selectStore(storeId, store);
  };

  if (geoLoading) {
    return (
      <div className="flex flex-col items-center gap-3 py-16">
        <Loader2 className="h-6 w-6 animate-spin text-primary-600" />
        <p className="text-sm text-neutral-500">Detecting your location…</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <button onClick={() => navigate('/order/fulfilment')} className="flex items-center gap-1 text-sm text-neutral-500 hover:text-neutral-700">
        <ArrowLeft className="h-4 w-4" strokeWidth={1.5} /> Back
      </button>

      <h1 className="text-xl font-bold">
        {isPickup ? 'Nearby stores' : `Stores delivering to ${fulfilment.pincode}`}
      </h1>

      {geoError && (
        <div className="rounded-lg border border-yellow-200 bg-yellow-50 px-4 py-2 text-xs text-yellow-800">
          {geoError}
        </div>
      )}

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-primary-600" />
        </div>
      ) : !stores || stores.length === 0 ? (
        <EmptyState
          icon={<MapPin className="h-6 w-6" strokeWidth={1.5} />}
          title="No stores found"
          description={isPickup ? 'No stores within range have your items.' : 'No stores deliver to this pincode.'}
          action={
            <Button variant="secondary" size="sm" onClick={() => navigate('/order/fulfilment')}>
              Change options
            </Button>
          }
        />
      ) : (
        <div className="space-y-3">
          {stores.map(store => {
            const hasMissing = store.missing_medicines && store.missing_medicines.length > 0 && store.missing_medicines[0] !== null;
            return (
              <Card key={store.store_id} hoverable className={hasMissing ? '' : 'cursor-pointer'} onClick={() => !hasMissing && selectStore(store.store_id, store)}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <h3 className="text-sm font-semibold truncate">{store.store_name}</h3>
                      <Badge variant={store.is_open ? 'completed' : 'rejected'} className="shrink-0">
                        {store.is_open ? 'Open' : 'Closed'}
                      </Badge>
                    </div>
                    <p className="mt-0.5 text-xs text-neutral-500 truncate">{store.address}</p>
                    {isPickup && store.distance_km > 0 && (
                      <p className="mt-0.5 text-xs text-neutral-500">{formatDistance(store.distance_km)} away</p>
                    )}
                  </div>
                  <div className="text-right shrink-0 flex flex-col items-end gap-2">
                    <p className="text-sm font-semibold text-primary-800">{formatPrice(store.total_price)}</p>
                    {!hasMissing && (
                      <Button
                        size="sm"
                        onClick={(e) => { e.stopPropagation(); selectStore(store.store_id, store); }}
                        aria-label={`Select ${store.store_name}`}
                      >
                        Select
                      </Button>
                    )}
                  </div>
                </div>

                {hasMissing && (
                  <div className="mt-3 rounded-lg border border-orange-200 bg-orange-50 p-3">
                    <div className="flex items-start gap-2">
                      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-orange-600" strokeWidth={1.5} />
                      <div>
                        <p className="text-xs font-medium text-orange-800">
                          Missing: {store.missing_medicines.filter(Boolean).join(', ')}
                        </p>
                        <div className="mt-2">
                          <Button
                            size="sm"
                            variant="secondary"
                            onClick={(e) => {
                              e.stopPropagation();
                              handleRemoveMissing(store.missing_medicines.filter(Boolean), store.store_id, store);
                            }}
                          >
                            Remove missing &amp; select
                          </Button>
                        </div>
                      </div>
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
