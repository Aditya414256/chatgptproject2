import { createContext, useContext, useEffect, useRef, useState, useCallback, type ReactNode } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../auth/useAuth';
import type { AppNotification } from '../../types/database';

const NOTIFICATION_SOUND_URL = 'data:audio/wav;base64,UklGRigAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQQAAAAAAA==';

export interface NotificationContextValue {
  notifications: AppNotification[];
  unreadCount: number;
  alertsEnabled: boolean;
  enableAlerts: () => Promise<void>;
  markAsRead: (notificationId: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextValue>({
  notifications: [],
  unreadCount: 0,
  alertsEnabled: false,
  enableAlerts: async () => {},
  markAsRead: async () => {},
  markAllAsRead: async () => {},
});

export function NotificationProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [alertsEnabled, setAlertsEnabled] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const { data: notifications = [] } = useQuery({
    queryKey: ['notifications'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user!.id)
        .order('created_at', { ascending: false })
        .limit(50);
      if (error) throw error;
      return data as AppNotification[];
    },
    enabled: !!user,
    refetchInterval: 30000,
  });

  const unreadCount = notifications.filter(n => !n.read).length;

  const playSound = useCallback(() => {
    if (!alertsEnabled) return;
    try {
      if (!audioRef.current) {
        audioRef.current = new Audio(NOTIFICATION_SOUND_URL);
      }
      audioRef.current.play().catch(() => {});
    } catch {}
  }, [alertsEnabled]);

  const showBrowserNotification = useCallback((message: string) => {
    if (!alertsEnabled) return;
    if (typeof Notification !== 'undefined' && Notification.permission === 'granted') {
      new Notification('FindMedicine', { body: message, icon: '/vite.svg' });
    }
  }, [alertsEnabled]);

  const enableAlerts = useCallback(async () => {
    setAlertsEnabled(true);
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'default') {
      await Notification.requestPermission();
    }
  }, []);

  const markAsRead = useCallback(async (notificationId: string) => {
    await supabase
      .from('notifications')
      .update({ read: true })
      .eq('id', notificationId);
    queryClient.invalidateQueries({ queryKey: ['notifications'] });
  }, [queryClient]);

  const markAllAsRead = useCallback(async () => {
    if (!user) return;
    await supabase
      .from('notifications')
      .update({ read: true })
      .eq('user_id', user.id)
      .eq('read', false);
    queryClient.invalidateQueries({ queryKey: ['notifications'] });
  }, [user, queryClient]);

  // Subscribe to realtime notifications with unique channel name
  useEffect(() => {
    if (!user) return;
    const channelName = `notifications-${user.id}-${Math.random().toString(36).slice(2)}`;
    const channel = supabase
      .channel(channelName)
      .on('postgres_changes', {
        event: 'INSERT',
        schema: 'public',
        table: 'notifications',
        filter: `user_id=eq.${user.id}`,
      }, (payload) => {
        queryClient.invalidateQueries({ queryKey: ['notifications'] });
        const msg = (payload.new as AppNotification).message;
        playSound();
        showBrowserNotification(msg);
      })
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user?.id, queryClient, playSound, showBrowserNotification]);

  return (
    <NotificationContext.Provider
      value={{
        notifications,
        unreadCount,
        alertsEnabled,
        enableAlerts,
        markAsRead,
        markAllAsRead,
      }}
    >
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  return useContext(NotificationContext);
}
