import { useParams, Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useEffect } from 'react';
import { ArrowLeft, Clock, Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../auth/useAuth';
import { Card } from '../../components/ui/Card';
import { OrderStatusBadge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { formatPrice, generateHandoverDisplay } from '../../lib/utils';
import { toast } from 'sonner';
import type { Order, OrderItem, Medicine } from '../../types/database';

export function OrderTrackingPage() {
  const { orderId } = useParams<{ orderId: string }>();
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: order, isLoading } = useQuery({
    queryKey: ['order', orderId],
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
    queryKey: ['order-items', orderId],
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

  useEffect(() => {
    if (!orderId) return;
    const channelName = `order-${orderId}-${Math.random().toString(36).slice(2)}`;
    const channel = supabase
      .channel(channelName)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'orders',
        filter: `id=eq.${orderId}`,
      }, () => {
        queryClient.invalidateQueries({ queryKey: ['order', orderId] });
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [orderId, queryClient]);

  const handleCancel = async () => {
    if (!orderId) return;
    const { error } = await supabase
      .from('orders')
      .update({ status: 'cancelled' } as any)
      .eq('id', orderId)
      .eq('customer_id', user!.id);
    if (error) {
      toast.error(error.message);
    } else {
      toast.success('Order cancelled');
      queryClient.invalidateQueries({ queryKey: ['order', orderId] });
    }
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

  const isTerminal = ['completed', 'rejected', 'cancelled', 'expired', 'not_collected'].includes(order.status);

  return (
    <div className="space-y-4">
      <Link to="/orders" className="flex items-center gap-1 text-sm text-neutral-500 hover:text-neutral-700">
        <ArrowLeft className="h-4 w-4" strokeWidth={1.5} /> All orders
      </Link>

      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Order</h1>
        <OrderStatusBadge status={order.status} />
      </div>

      {order.status === 'rejected' && order.reject_reason && (
        <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-800">
          Rejected: {order.reject_reason}
        </div>
      )}

      <Card>
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-xs text-neutral-500">Type</p>
            <p className="font-medium capitalize">{order.fulfilment_type}</p>
          </div>
          <div>
            <p className="text-xs text-neutral-500">Total</p>
            <p className="font-medium">{formatPrice(order.total)}</p>
          </div>
          <div>
            <p className="text-xs text-neutral-500">Handover code</p>
            <p className="font-mono text-lg font-bold text-primary-800 tracking-widest">
              {generateHandoverDisplay(order.handover_code)}
            </p>
          </div>
          <div>
            <p className="text-xs text-neutral-500">Payment</p>
            <p className="font-medium">
              {order.fulfilment_type === 'pickup' ? 'Pay at store' : 'Cash on delivery'}
            </p>
          </div>
          {order.delivery_address && (
            <div className="col-span-2">
              <p className="text-xs text-neutral-500">Delivery address</p>
              <p className="font-medium">{order.delivery_address}, {order.delivery_pincode}</p>
            </div>
          )}
          <div>
            <p className="text-xs text-neutral-500">Placed</p>
            <p className="font-medium">{new Date(order.created_at).toLocaleString('en-IN')}</p>
          </div>
        </div>
      </Card>

      {orderItems && orderItems.length > 0 && (
        <Card>
          <h3 className="text-sm font-semibold mb-2">Items</h3>
          <div className="divide-y divide-neutral-100">
            {orderItems.map(oi => (
              <div key={oi.id} className="flex items-center justify-between py-2">
                <div>
                  <p className="text-sm font-medium">{oi.medicines?.name ?? 'Medicine'}</p>
                  <p className="text-xs text-neutral-500">
                    Qty: {oi.quantity} × {formatPrice(oi.unit_price)}
                  </p>
                </div>
                <p className="text-sm font-medium">{formatPrice(oi.quantity * oi.unit_price)}</p>
              </div>
            ))}
          </div>
        </Card>
      )}

      {order.status === 'pending' && (
        <div className="flex items-center justify-between rounded-lg border border-yellow-200 bg-yellow-50 px-4 py-3">
          <div className="flex items-center gap-2 text-sm text-yellow-800">
            <Clock className="h-4 w-4" strokeWidth={1.5} />
            Waiting for store to accept…
          </div>
          <Button variant="danger" size="sm" onClick={handleCancel}>
            Cancel
          </Button>
        </div>
      )}

      {isTerminal && ['rejected', 'cancelled', 'expired'].includes(order.status) && (
        <div className="flex justify-center">
          <Link to="/catalog">
            <Button variant="secondary">Order again</Button>
          </Link>
        </div>
      )}
    </div>
  );
}
