import { Link, useNavigate } from 'react-router-dom';
import { ShoppingCart, Minus, Plus, Trash2, ArrowRight } from 'lucide-react';
import { useCart } from './useCart';
import { Button } from '../../components/ui/Button';
import { Card } from '../../components/ui/Card';
import { EmptyState } from '../../components/ui/EmptyState';
import { Badge } from '../../components/ui/Badge';

export function CartPage() {
  const { items, updateQuantity, removeItem, hasRxItems } = useCart();
  const navigate = useNavigate();

  if (items.length === 0) {
    return (
      <EmptyState
        icon={<ShoppingCart className="h-6 w-6" strokeWidth={1.5} />}
        title="Your cart is empty"
        description="Browse the catalog and add medicines to get started."
        action={
          <Link to="/catalog">
            <Button variant="secondary" size="sm">Browse medicines</Button>
          </Link>
        }
      />
    );
  }

  return (
    <div className="space-y-4">
      <h1 className="text-xl font-bold">Cart ({items.length} {items.length === 1 ? 'item' : 'items'})</h1>

      <Card noPadding>
        <div className="divide-y divide-neutral-100">
          {items.map(item => (
            <div key={item.medicine.id} className="flex items-center gap-4 px-4 py-3 sm:px-5">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-neutral-900 truncate">{item.medicine.name}</p>
                <p className="text-xs text-neutral-500">{item.medicine.generic_name} · {item.medicine.strength}</p>
                {item.medicine.requires_prescription && (
                  <Badge variant="info" className="mt-1">Prescription required</Badge>
                )}
              </div>
              <div className="flex items-center gap-2">
                <button
                  onClick={() => updateQuantity(item.medicine.id, item.quantity - 1)}
                  className="flex h-7 w-7 items-center justify-center rounded-md border border-neutral-300 text-neutral-600 hover:bg-neutral-50"
                  aria-label="Decrease quantity"
                >
                  <Minus className="h-3.5 w-3.5" strokeWidth={1.5} />
                </button>
                <span className="w-8 text-center text-sm font-medium">{item.quantity}</span>
                <button
                  onClick={() => updateQuantity(item.medicine.id, item.quantity + 1)}
                  className="flex h-7 w-7 items-center justify-center rounded-md border border-neutral-300 text-neutral-600 hover:bg-neutral-50"
                  aria-label="Increase quantity"
                >
                  <Plus className="h-3.5 w-3.5" strokeWidth={1.5} />
                </button>
              </div>
              <button
                onClick={() => removeItem(item.medicine.id)}
                className="rounded-lg p-1.5 text-neutral-400 hover:bg-red-50 hover:text-accent"
                aria-label="Remove item"
              >
                <Trash2 className="h-4 w-4" strokeWidth={1.5} />
              </button>
            </div>
          ))}
        </div>
      </Card>

      {hasRxItems && (
        <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
          Some items require a prescription. You&apos;ll need to provide one for delivery orders, or bring it to the store for pickup.
        </div>
      )}

      <div className="flex justify-end">
        <Button
          onClick={() => navigate('/order/fulfilment')}
          icon={<ArrowRight className="h-4 w-4" strokeWidth={1.5} />}
        >
          Checkout
        </Button>
      </div>
    </div>
  );
}
