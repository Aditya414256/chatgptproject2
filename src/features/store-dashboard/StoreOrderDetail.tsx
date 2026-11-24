import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { ArrowLeft, Loader2, FileText, ExternalLink } from 'lucide-react';
import { useParams, Link } from 'react-router-dom';
import { toast } from 'sonner';
import { supabase } from '../../lib/supabase';
import { Card } from '../../components/ui/Card';
import { Button } from '../../components/ui/Button';
import { Badge, OrderStatusBadge } from '../../components/ui/Badge';
import { Input } from '../../components/ui/Input';
import { formatPrice } from '../../lib/utils';
import type { Order, OrderItem, Medicine } from '../../types/database';

interface CustomerProfile { full_name: string; phone: string; }

export function StoreOrderDetail() {
  const { orderId } = useParams<{ orderId: string }>();
  const queryClient = useQueryClient();
  const [rejectReason, setRejectReason] = useState('');
  const [showRejectForm, setShowRejectForm] = useState(false);
  const [handoverInput, setHandoverInput] = useState('');
  const [loading, setLoading] = useState(false);

  const { data: order, isLoading } = useQuery({
    queryKey: ['store-order', orderId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .eq('id', orderId!)
        .single();
      if (error) throw error;
      return data as Order;
    },
    enabled: !!orderId,
  });

  const { data: orderItems } = useQuery({
    queryKey: ['store-order-items', orderId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('order_items')
        .select('*, medicines(*)')
        .eq('order_id', orderId!);
      if (error) throw error;
      return data as unknown as (OrderItem & { medicines: Medicine })[];
    },
    enabled: !!orderId,
  });

  const { data: customer } = useQuery({
    queryKey: ['customer-profile', order?.customer_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('full_name, phone')
        .eq('id', order!.customer_id)
        .single();
      if (error) throw error;
      return data as CustomerProfile;
    },
    enabled: !!order,
  });

  const { data: prescriptionUrl } = useQuery({
    queryKey: ['prescription-url', order?.prescription_path],
    queryFn: async () => {
      if (!order?.prescription_path) return null;
      const { data } = await supabase.storage
        .from('prescriptions')
        .createSignedUrl(order.prescription_path, 300);
      return data?.signedUrl ?? null;
    },
    enabled: !!order?.prescription_path,
  });

  const updateStatus = async (status: string, extraFields?: Record<string, any>) => {
    setLoading(true);
    try {
      const { error } = await supabase
        .from('orders')
        .update({ status, ...extraFields } as any)
        .eq('id', orderId!);
      if (error) throw error;

      if (order) {
        const messages: Record<string, string> = {
          accepted: 'Your order has been accepted!',
          rejected: `Your order was rejected. Reason: ${extraFields?.reject_reason || 'N/A'}`,
          ready: 'Your order is ready for pickup!',
          out_for_delivery: 'Your order is out for delivery!',
          completed: 'Your order has been completed.',
          not_collected: 'Your order was not collected.',
        };
        await supabase.from('notifications').insert({
          user_id: order.customer_id,
          order_id: order.id,
          message: messages[status] || `Order status: ${status}`,
        } as any);
      }

      toast.success(`Order marked as ${status}`);
      queryClient.invalidateQueries({ queryKey: ['store-order', orderId] });
      queryClient.invalidateQueries({ queryKey: ['store-orders'] });
    } catch (err: any) {
      toast.error(err.message || 'Failed to update');
    } finally {
      setLoading(false);
      setShowRejectForm(false);
    }
  };

  const handleComplete = async () => {
    if (handoverInput !== order?.handover_code) {
      toast.error('Handover code does not match');
      return;
    }
    await updateStatus('completed');
  };

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-primary-600" />
      </div>
    );
  }

  if (!order) {
    return <p className="py-8 text-center text-sm text-neutral-500">Order not found.</p>;
  }

  const hasRxItems = orderItems?.some(oi => oi.medicines?.requires_prescription);
  const isPickup = order.fulfilment_type === 'pickup';

  return (
    <div className="space-y-4">
      <Link to="/dashboard" className="flex items-center gap-1 text-sm text-neutral-500 hover:text-neutral-700">
        <ArrowLeft className="h-4 w-4" strokeWidth={1.5} /> Back to dashboard
      </Link>

      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Order detail</h1>
        <OrderStatusBadge status={order.status} />
      </div>

      <Card>
        <h3 className="text-sm font-semibold mb-2">Customer</h3>
        <div className="grid grid-cols-2 gap-2 text-sm">
          <div>
            <p className="text-xs text-neutral-500">Name</p>
            <p className="font-medium">{customer?.full_name ?? '—'}</p>
          </div>
          <div>
            <p className="text-xs text-neutral-500">Phone</p>
            <p className="font-medium">{customer?.phone ?? '—'}</p>
          </div>
          <div>
            <p className="text-xs text-neutral-500">Type</p>
            <p className="font-medium capitalize">{order.fulfilment_type}</p>
          </div>
          <div>
            <p className="text-xs text-neutral-500">Total</p>
            <p className="font-medium">{formatPrice(order.total)}</p>
          </div>
          {order.delivery_address && (
            <div className="col-span-2">
              <p className="text-xs text-neutral-500">Delivery address</p>
              <p className="font-medium">{order.delivery_address}, {order.delivery_pincode}</p>
            </div>
          )}
        </div>
      </Card>

      <Card>
        <h3 className="text-sm font-semibold mb-2">Items</h3>
        <div className="divide-y divide-neutral-100">
          {orderItems?.map(oi => (
            <div key={oi.id} className="flex items-center justify-between py-2">
              <div>
                <p className="text-sm font-medium">{oi.medicines?.name ?? 'Medicine'}</p>
                <p className="text-xs text-neutral-500">Qty: {oi.quantity} × {formatPrice(oi.unit_price)}</p>
                {oi.medicines?.requires_prescription && (
                  <Badge variant="info" className="mt-0.5">Rx</Badge>
                )}
              </div>
              <p className="text-sm font-medium">{formatPrice(oi.quantity * oi.unit_price)}</p>
            </div>
          ))}
        </div>
      </Card>

      {hasRxItems && (
        <Card>
          <h3 className="text-sm font-semibold mb-2">Prescription</h3>
          {isPickup ? (
            <div className="rounded-lg border border-blue-200 bg-blue-50 px-3 py-2 text-sm text-blue-800">
              Verify prescription at handover.
            </div>
          ) : prescriptionUrl ? (
            <div className="space-y-2">
              {order.prescription_path?.endsWith('.pdf') ? (
                <a href={prescriptionUrl} target="_blank" rel="noopener noreferrer"
                  className="flex items-center gap-2 text-primary-700 hover:underline text-sm">
                  <FileText className="h-4 w-4" strokeWidth={1.5} />
                  View prescription PDF
                  <ExternalLink className="h-3 w-3" strokeWidth={1.5} />
                </a>
              ) : (
                <img src={prescriptionUrl} alt="Prescription" className="max-h-80 rounded-lg border" />
              )}
            </div>
          ) : (
            <p className="text-sm text-neutral-500">No prescription uploaded.</p>
          )}
        </Card>
      )}

      {order.status === 'pending' && (
        <Card>
          <h3 className="text-sm font-semibold mb-3">Actions</h3>
          <div className="flex gap-2">
            <Button loading={loading} onClick={() => updateStatus('accepted')}>Accept</Button>
            <Button variant="danger" loading={loading} onClick={() => setShowRejectForm(!showRejectForm)}>Reject</Button>
          </div>

          {showRejectForm && (
            <div className="mt-3 space-y-2">
              <Input
                label="Reason for rejection"
                value={rejectReason}
                onChange={e => setRejectReason(e.target.value)}
                placeholder="e.g. Out of stock"
              />
              <div className="flex flex-wrap gap-2">
                {['Out of stock', 'Store closed', 'Invalid prescription', 'Cannot fulfil'].map(r => (
                  <button key={r} onClick={() => setRejectReason(r)}
                    className="rounded-full border border-neutral-200 bg-neutral-50 px-3 py-1 text-xs hover:bg-neutral-100">
                    {r}
                  </button>
                ))}
              </div>
              <Button
                variant="danger" size="sm" loading={loading}
                disabled={!rejectReason.trim()}
                onClick={() => updateStatus('rejected', { reject_reason: rejectReason })}
              >
                Confirm rejection
              </Button>
            </div>
          )}
        </Card>
      )}

      {order.status === 'accepted' && (
        <Card>
          <h3 className="text-sm font-semibold mb-3">Actions</h3>
          <Button loading={loading} onClick={() => updateStatus(isPickup ? 'ready' : 'out_for_delivery')}>
            {isPickup ? 'Mark ready for pickup' : 'Mark out for delivery'}
          </Button>
        </Card>
      )}

      {(order.status === 'ready' || order.status === 'out_for_delivery') && (
        <Card>
          <h3 className="text-sm font-semibold mb-3">Complete order</h3>
          <p className="mb-2 text-xs text-neutral-500">Enter the 4-digit handover code from the customer.</p>
          <div className="flex gap-2">
            <Input
              value={handoverInput}
              onChange={e => setHandoverInput(e.target.value)}
              placeholder="0000" maxLength={4}
              className="w-24 text-center font-mono text-lg"
            />
            <Button loading={loading} onClick={handleComplete}>Complete</Button>
            <Button variant="secondary" loading={loading} onClick={() => updateStatus('not_collected')}>
              Not collected
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}
