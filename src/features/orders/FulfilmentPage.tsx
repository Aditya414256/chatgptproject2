import { useNavigate } from 'react-router-dom';
import { Store, Truck, ArrowLeft } from 'lucide-react';
import { useCart } from '../cart/useCart';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { useState } from 'react';
import { Input } from '../../components/ui/Input';

export type FulfilmentChoice = 'pickup' | 'delivery';

export interface DeliveryInfo {
  address: string;
  pincode: string;
}

// Store the fulfilment state in sessionStorage so it persists across navigation
function useFulfilmentState() {
  const getStored = () => {
    try {
      const raw = sessionStorage.getItem('fm_fulfilment');
      return raw ? JSON.parse(raw) : null;
    } catch { return null; }
  };

  const setStored = (val: any) => {
    sessionStorage.setItem('fm_fulfilment', JSON.stringify(val));
  };

  return { getStored, setStored };
}

export function FulfilmentPage() {
  const navigate = useNavigate();
  const { items } = useCart();
  const { setStored } = useFulfilmentState();
  const [choice, setChoice] = useState<FulfilmentChoice | null>(null);
  const [address, setAddress] = useState('');
  const [pincode, setPincode] = useState('');

  if (items.length === 0) {
    navigate('/cart');
    return null;
  }

  const proceed = () => {
    if (!choice) return;
    const state: any = { type: choice, medicineIds: items.map(i => i.medicine.id) };
    if (choice === 'delivery') {
      state.address = address;
      state.pincode = pincode;
    }
    setStored(state);
    navigate('/order/stores');
  };

  return (
    <div className="space-y-4">
      <button onClick={() => navigate('/cart')} className="flex items-center gap-1 text-sm text-neutral-500 hover:text-neutral-700">
        <ArrowLeft className="h-4 w-4" strokeWidth={1.5} /> Back to cart
      </button>
      <h1 className="text-xl font-bold">How would you like to get your order?</h1>

      <div className="grid gap-3 sm:grid-cols-2">
        {/* Pickup option */}
        <label
          className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition-all ${
            choice === 'pickup'
              ? 'border-primary-600 bg-primary-50 ring-2 ring-primary-600'
              : 'border-neutral-200 bg-white hover:border-neutral-300'
          }`}
        >
          <input
            type="radio"
            name="fulfilment"
            value="pickup"
            checked={choice === 'pickup'}
            onChange={() => setChoice('pickup')}
            className="mt-0.5 accent-primary-600"
            aria-label="Pick up from store"
          />
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-50 text-primary-700">
              <Store className="h-5 w-5" strokeWidth={1.5} />
            </div>
            <div>
              <h3 className="text-sm font-semibold">Pick up from store</h3>
              <p className="text-xs text-neutral-500">Find a nearby store and collect your order</p>
            </div>
          </div>
        </label>

        {/* Delivery option */}
        <label
          className={`flex cursor-pointer items-start gap-3 rounded-xl border p-4 transition-all ${
            choice === 'delivery'
              ? 'border-primary-600 bg-primary-50 ring-2 ring-primary-600'
              : 'border-neutral-200 bg-white hover:border-neutral-300'
          }`}
        >
          <input
            type="radio"
            name="fulfilment"
            value="delivery"
            checked={choice === 'delivery'}
            onChange={() => setChoice('delivery')}
            className="mt-0.5 accent-primary-600"
            aria-label="Home delivery"
          />
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary-50 text-primary-700">
              <Truck className="h-5 w-5" strokeWidth={1.5} />
            </div>
            <div>
              <h3 className="text-sm font-semibold">Home delivery</h3>
              <p className="text-xs text-neutral-500">Get medicines delivered to your address</p>
            </div>
          </div>
        </label>
      </div>

      {choice === 'delivery' && (
        <Card>
          <h3 className="mb-3 text-sm font-semibold">Delivery details</h3>
          <div className="flex flex-col gap-3">
            <Input
              label="Delivery address"
              required
              value={address}
              onChange={e => setAddress(e.target.value)}
              placeholder="Flat, street, landmark"
            />
            <Input
              label="Pincode"
              required
              value={pincode}
              onChange={e => setPincode(e.target.value)}
              placeholder="e.g. 425405"
              maxLength={6}
            />
          </div>
        </Card>
      )}

      <div className="flex justify-end">
        <Button
          disabled={!choice || (choice === 'delivery' && (!address.trim() || !pincode.trim()))}
          onClick={proceed}
        >
          Continue
        </Button>
      </div>
    </div>
  );
}

/** Utility to read fulfilment state from sessionStorage */
export function getFulfilmentState(): { type: FulfilmentChoice; address?: string; pincode?: string; medicineIds: string[] } | null {
  try {
    const raw = sessionStorage.getItem('fm_fulfilment');
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}
