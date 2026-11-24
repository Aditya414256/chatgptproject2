import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'sonner';
import { AuthProvider } from './features/auth/AuthProvider';
import { NotificationProvider } from './features/store-dashboard/NotificationContext';
import { ErrorBoundary } from './components/ui/ErrorBoundary';
import { ProtectedRoute } from './features/auth/ProtectedRoute';
import { LoginPage } from './features/auth/LoginPage';
import { SignupPage } from './features/auth/SignupPage';
import { CatalogPage } from './features/catalog/CatalogPage';
import { CartPage } from './features/cart/CartPage';
import { FulfilmentPage } from './features/orders/FulfilmentPage';
import { StoreSelectionPage } from './features/orders/StoreSelectionPage';
import { PrescriptionPage } from './features/orders/PrescriptionPage';
import { ReviewOrderPage } from './features/orders/ReviewOrderPage';
import { OrderTrackingPage } from './features/orders/OrderTrackingPage';
import { OrdersListPage } from './features/orders/OrdersListPage';
import { StoreDashboard } from './features/store-dashboard/StoreDashboard';
import { StoreOrderDetail } from './features/store-dashboard/StoreOrderDetail';
import { InventoryPage } from './features/store-dashboard/InventoryPage';
import { StoreSetupPage } from './features/store-dashboard/StoreSetupPage';
import { AppLayout } from './components/layout/AppLayout';
import { CartProvider } from './features/cart/CartProvider';
import { useAuth } from './features/auth/useAuth';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { staleTime: 1000 * 60, retry: 1 },
  },
});

function AppRoutes() {
  const { profile } = useAuth();
  const isStoreOwner = profile?.role === 'store_owner';
  const defaultPath = isStoreOwner ? '/dashboard' : '/catalog';

  return (
    <ErrorBoundary>
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/signup" element={<SignupPage />} />

        <Route element={<ProtectedRoute />}>
          <Route element={<AppLayout />}>
            {/* Customer routes */}
            <Route path="/catalog" element={<CatalogPage />} />
            <Route path="/cart" element={<CartPage />} />
            <Route path="/order/fulfilment" element={<FulfilmentPage />} />
            <Route path="/order/stores" element={<StoreSelectionPage />} />
            <Route path="/order/prescription" element={<PrescriptionPage />} />
            <Route path="/order/review" element={<ReviewOrderPage />} />
            <Route path="/orders" element={<OrdersListPage />} />
            <Route path="/orders/:orderId" element={<OrderTrackingPage />} />

            {/* Store owner routes */}
            <Route path="/dashboard" element={<StoreDashboard />} />
            <Route path="/dashboard/orders/:orderId" element={<StoreOrderDetail />} />
            <Route path="/dashboard/inventory" element={<InventoryPage />} />
            <Route path="/dashboard/setup" element={<StoreSetupPage />} />

            {/* Catch-all */}
            <Route path="/" element={<Navigate to={defaultPath} replace />} />
            <Route path="*" element={<Navigate to={defaultPath} replace />} />
          </Route>
        </Route>
      </Routes>
    </ErrorBoundary>
  );
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <AuthProvider>
          <NotificationProvider>
            <CartProvider>
              <AppRoutes />
              <Toaster
                position="top-right"
                toastOptions={{ className: 'font-sans text-sm' }}
              />
            </CartProvider>
          </NotificationProvider>
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}
