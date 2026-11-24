import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ShoppingBag } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '../../lib/supabase';
import { useCart } from '../cart/useCart';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';

export function ReviewOrderPage() {
  const navigate = useNavigate();
  const { items, clearCart, hasRxItems } = useCart();
  const [loading, setLoading] = useState(false);

  const raw = sessionStorage.getItem('fm_fulfilment');
  const fulfilment = raw ? JSON.parse(raw) : null;

  if (!fulfilment || items.length === 0) {
    navigate('/cart');
    return null;
  }

  const handlePlaceOrder = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.rpc('place_order', {
        p_store_id: fulfilment.storeId,
        p_fulfilment_type: fulfilment.type,
        p_items: items.map(i => ({ medicine_id: i.medicine.id, quantity: i.quantity })) as any,
        p_delivery_address: fulfilment.address || null,
        p_delivery_pincode: fulfilment.pincode || null,
        p_prescription_path: fulfilment.prescriptionPath || null,
      });
      if (error) throw error;

      const result = data as unknown as { order_id: string; handover_code: string; total: number };
      clearCart();
      sessionStorage.removeItem('fm_fulfilment');
      toast.success('Order placed successfully!');
      navigate(`/orders/${result.order_id}`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to place order');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-4">
      <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-sm text-neutral-500 hover:text-neutral-700">
        <ArrowLeft className="h-4 w-4" strokeWidth={1.5} /> Back
      </button>

      <h1 className="text-xl font-bold">Review your order</h1>

      <Card>
        <h3 className="text-sm font-semibold mb-2">Store</h3>
        <p className="text-sm text-neutral-700">{fulfilment.storeName}</p>
        <div className="mt-1 flex gap-2">
          <Badge variant="default">{fulfilment.type === 'pickup' ? 'Pickup' : 'Delivery'}</Badge>
        </div>
        {fulfilment.type === 'delivery' && (
          <div className="mt-2 text-xs text-neutral-500">
            <p>{fulfilment.address}</p>
            <p>Pincode: {fulfilment.pincode}</p>
          </div>
        )}
      </Card>

      <Card>
        <h3 className="text-sm font-semibold mb-3">Items ({items.length})</h3>
        <div className="divide-y divide-neutral-100">
          {items.map(item => (
            <div key={item.medicine.id} className="flex items-center justify-between py-2">
              <div>
                <p className="text-sm font-medium">{item.medicine.name}</p>
                <p className="text-xs text-neutral-500">Qty: {item.quantity}</p>
              </div>
              {item.medicine.requires_prescription && (
                <Badge variant="info" className="text-xs">Rx</Badge>
              )}
            </div>
          ))}
        </div>
      </Card>

      <Card>
        <h3 className="text-sm font-semibold mb-2">Payment</h3>
        <p className="text-sm text-neutral-600">
          {fulfilment.type === 'pickup' ? 'Pay at store' : 'Cash on delivery'}
        </p>
      </Card>

      {fulfilment.type === 'pickup' && hasRxItems && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
          Bring your prescription. The store will verify it when you collect.
        </div>
      )}

      <div className="flex justify-end">
        <Button
          loading={loading}
          onClick={handlePlaceOrder}
          icon={<ShoppingBag className="h-4 w-4" strokeWidth={1.5} />}
          size="lg"
        >
          Place order
        </Button>
      </div>
    </div>
  );
}
