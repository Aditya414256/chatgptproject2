import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, BellOff, CheckCheck, Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../auth/useAuth';
import { useNotifications } from './NotificationContext';
import { Card } from '../../components/ui/Card';
import { OrderStatusBadge } from '../../components/ui/Badge';
import { Button } from '../../components/ui/Button';
import { EmptyState } from '../../components/ui/EmptyState';
import { formatPrice } from '../../lib/utils';
import type { Order, Store } from '../../types/database';

export function StoreDashboard() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const { alertsEnabled, enableAlerts, markAllAsRead, unreadCount } = useNotifications();

  const { data: store, isLoading: storeLoading } = useQuery({
    queryKey: ['my-store'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('stores')
        .select('*')
        .eq('owner_id', user!.id)
        .maybeSingle();
      if (error) throw error;
      return data as Store | null;
    },
    enabled: !!user,
  });

  const { data: orders, isLoading } = useQuery({
    queryKey: ['store-orders', store?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('orders')
        .select('*')
        .eq('store_id', store!.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data as Order[];
    },
    enabled: !!store?.id,
  });

  useEffect(() => {
    if (!store?.id) return;
    const channelName = `store-orders-${store.id}-${Math.random().toString(36).slice(2)}`;
    const channel = supabase
      .channel(channelName)
      .on('postgres_changes', {
        event: '*',
        schema: 'public',
        table: 'orders',
        filter: `store_id=eq.${store.id}`,
      }, () => {
        queryClient.invalidateQueries({ queryKey: ['store-orders', store.id] });
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [store?.id, queryClient]);

  if (storeLoading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-primary-600" />
      </div>
    );
  }

  if (!store) {
    return (
      <EmptyState
        icon={<Bell className="h-6 w-6" strokeWidth={1.5} />}
        title="No store set up"
        description="Set up your store first to start receiving orders."
        action={
          <Link to="/dashboard/setup">
            <Button size="sm">Set up store</Button>
          </Link>
        }
      />
    );
  }

  const pendingOrders = (orders ?? []).filter(o => o.status === 'pending');
  const activeOrders = (orders ?? []).filter(o => ['accepted', 'ready', 'out_for_delivery'].includes(o.status));
  const pastOrders = (orders ?? []).filter(o => ['completed', 'rejected', 'cancelled', 'expired', 'not_collected'].includes(o.status));

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold">Orders — {store.name}</h1>
        <div className="flex items-center gap-2">
          {unreadCount > 0 && (
            <Button variant="ghost" size="sm" onClick={markAllAsRead} icon={<CheckCheck className="h-4 w-4" strokeWidth={1.5} />}>
              Mark all read
            </Button>
          )}
          <Button
            variant={alertsEnabled ? 'secondary' : 'primary'}
            size="sm"
            onClick={enableAlerts}
            icon={alertsEnabled
              ? <Bell className="h-4 w-4" strokeWidth={1.5} />
              : <BellOff className="h-4 w-4" strokeWidth={1.5} />
            }
          >
            {alertsEnabled ? 'Alerts on' : 'Enable alerts'}
          </Button>
        </div>
      </div>

      {isLoading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-primary-600" />
        </div>
      ) : (
        <>
          {pendingOrders.length > 0 && (
            <section>
              <h2 className="mb-2 text-sm font-semibold text-yellow-700">Pending ({pendingOrders.length})</h2>
              <div className="space-y-2">
                {pendingOrders.map(order => <OrderRow key={order.id} order={order} />)}
              </div>
            </section>
          )}

          {activeOrders.length > 0 && (
            <section>
              <h2 className="mb-2 text-sm font-semibold text-blue-700">Active ({activeOrders.length})</h2>
              <div className="space-y-2">
                {activeOrders.map(order => <OrderRow key={order.id} order={order} />)}
              </div>
            </section>
          )}

          {pastOrders.length > 0 && (
            <section>
              <h2 className="mb-2 text-sm font-semibold text-neutral-500">Past orders</h2>
              <div className="space-y-2">
                {pastOrders.slice(0, 20).map(order => <OrderRow key={order.id} order={order} />)}
              </div>
            </section>
          )}

          {(orders ?? []).length === 0 && (
            <EmptyState
              icon={<Bell className="h-6 w-6" strokeWidth={1.5} />}
              title="No orders yet"
              description="Orders will appear here in real time."
            />
          )}
        </>
      )}
    </div>
  );
}

function OrderRow({ order }: { order: Order }) {
  return (
    <Link to={`/dashboard/orders/${order.id}`}>
      <Card hoverable>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-medium capitalize">{order.fulfilment_type} order</p>
            <p className="text-xs text-neutral-500">{new Date(order.created_at).toLocaleString('en-IN')}</p>
          </div>
          <div className="flex items-center gap-3 text-right">
            <p className="text-sm font-semibold">{formatPrice(order.total)}</p>
            <OrderStatusBadge status={order.status} />
          </div>
        </div>
      </Card>
    </Link>
  );
}
