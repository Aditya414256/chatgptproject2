import { Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ClipboardList, Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../auth/useAuth';
import { Card } from '../../components/ui/Card';
import { OrderStatusBadge } from '../../components/ui/Badge';
import { EmptyState } from '../../components/ui/EmptyState';
import { formatPrice } from '../../lib/utils';
import type { Order } from '../../types/database';

export function OrdersListPage() {
  const { user } = useAuth();

  const { data: orders, isLoading } = useQuery({
    queryKey: ['my-orders'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .eq('customer_id', user!.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as Order[];
    },
    enabled: !!user,
  });

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-6 w-6 animate-spin text-primary-600" />
      </div>
    );
  }

  if (!orders || orders.length === 0) {
    return (
      <EmptyState
        icon={<ClipboardList className="h-6 w-6" strokeWidth={1.5} />}
        title="No orders yet"
        description="Browse the catalog and place your first order."
        action={
          <Link to="/catalog" className="text-primary-700 font-medium text-sm hover:underline">
            Browse medicines
          </Link>
        }
      />
    );
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">My orders</h1>
      <div className="space-y-3">
        {orders.map(order => (
          <Link key={order.id} to={`/orders/${order.id}`}>
            <Card hoverable className="mb-3">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium capitalize">{order.fulfilment_type} order</p>
                  <p className="text-xs text-neutral-500">{new Date(order.created_at).toLocaleString('en-IN')}</p>
                </div>
                <div className="text-right flex items-center gap-3">
                  <p className="text-sm font-semibold">{formatPrice(order.total)}</p>
                  <OrderStatusBadge status={order.status} />
                </div>
              </div>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
