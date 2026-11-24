import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Package } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../auth/useAuth';
import { Card } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';
import { EmptyState } from '../../components/ui/EmptyState';
import { formatPrice } from '../../lib/utils';
import type { Medicine, Store } from '../../types/database';

interface InventoryRow {
  store_id: string;
  medicine_id: string;
  price: number;
  stock: number;
  medicines: Medicine;
}

export function InventoryPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: store } = useQuery({
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

  const { data: allMedicines } = useQuery({
    queryKey: ['medicines'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('medicines')
        .select('*')
        .order('name');
      if (error) throw error;
      return data as Medicine[];
    },
  });

  const { data: inventory, isLoading } = useQuery({
    queryKey: ['store-inventory', store?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('store_inventory')
        .select('*, medicines(*)')
        .eq('store_id', store!.id);
      if (error) throw error;
      return data as unknown as InventoryRow[];
    },
    enabled: !!store,
  });

  const updateInventory = async (medicineId: string, field: 'price' | 'stock', value: number) => {
    if (!store) return;
    const existing = inventory?.find(i => i.medicine_id === medicineId);
    if (existing) {
      const { error } = await supabase
        .from('store_inventory')
        .update({ [field]: value } as any)
        .eq('store_id', store.id)
        .eq('medicine_id', medicineId);
      if (error) toast.error(error.message);
      else queryClient.invalidateQueries({ queryKey: ['store-inventory', store.id] });
    }
  };

  const addMedicine = async (medicineId: string) => {
    if (!store) return;
    const { error } = await supabase
      .from('store_inventory')
      .insert({ store_id: store.id, medicine_id: medicineId, price: 10, stock: 0 } as any);
    if (error) {
      toast.error(error.message);
    } else {
      queryClient.invalidateQueries({ queryKey: ['store-inventory', store.id] });
      toast.success('Medicine added to inventory');
    }
  };

  if (!store) {
    return (
      <EmptyState
        icon={<Package className="h-6 w-6" strokeWidth={1.5} />}
        title="Set up your store first"
        description="Go to Store Settings to create your store."
      />
    );
  }

  if (isLoading) {
    return (
      <div className="flex justify-center py-16">
        <Package className="h-6 w-6 animate-pulse text-primary-600" />
      </div>
    );
  }

  const inventoryIds = new Set(inventory?.map(i => i.medicine_id) ?? []);
  const availableMedicines = (allMedicines ?? []).filter(m => !inventoryIds.has(m.id));

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold">Inventory — {store.name}</h1>

      <Card noPadding>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-200 bg-neutral-50 text-left text-xs font-medium text-neutral-500">
                <th className="px-4 py-2">Medicine</th>
                <th className="px-4 py-2 w-28">Price (₹)</th>
                <th className="px-4 py-2 w-24">Stock</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-neutral-100">
              {(inventory ?? []).map(row => (
                <InventoryRowEdit key={row.medicine_id} row={row} onUpdate={updateInventory} />
              ))}
              {(!inventory || inventory.length === 0) && (
                <tr>
                  <td colSpan={3} className="px-4 py-6 text-center text-neutral-500">
                    No medicines in inventory.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>

      {availableMedicines.length > 0 && (
        <div>
          <h2 className="mb-2 text-sm font-semibold text-neutral-700">Add medicines</h2>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {availableMedicines.map(med => (
              <button
                key={med.id}
                onClick={() => addMedicine(med.id)}
                className="flex items-center gap-2 rounded-lg border border-dashed border-neutral-300 p-3 text-left hover:border-primary-400 hover:bg-primary-50/50 transition-colors"
              >
                <span className="flex-1 text-xs font-medium text-neutral-700">{med.name}</span>
                {med.requires_prescription && <Badge variant="info" className="text-xs">Rx</Badge>}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function InventoryRowEdit({ row, onUpdate }: {
  row: InventoryRow;
  onUpdate: (id: string, f: 'price' | 'stock', v: number) => void;
}) {
  const [price, setPrice] = useState(String(row.price));
  const [stock, setStock] = useState(String(row.stock));

  return (
    <tr>
      <td className="px-4 py-2">
        <div className="flex items-center gap-2">
          <span className="font-medium">{row.medicines.name}</span>
          {row.medicines.requires_prescription && (
            <Badge variant="info" className="text-xs">Rx</Badge>
          )}
        </div>
        <div className="text-xs text-neutral-500">{formatPrice(row.price)} · {row.stock} in stock</div>
      </td>
      <td className="px-4 py-2">
        <input
          type="number" min="0.01" step="0.01"
          value={price}
          onChange={e => setPrice(e.target.value)}
          onBlur={() => { const v = parseFloat(price); if (v > 0) onUpdate(row.medicine_id, 'price', v); }}
          className="w-20 rounded border border-neutral-200 px-2 py-1 text-sm"
        />
      </td>
      <td className="px-4 py-2">
        <input
          type="number" min="0" step="1"
          value={stock}
          onChange={e => setStock(e.target.value)}
          onBlur={() => { const v = parseInt(stock, 10); if (v >= 0) onUpdate(row.medicine_id, 'stock', v); }}
          className="w-16 rounded border border-neutral-200 px-2 py-1 text-sm"
        />
      </td>
    </tr>
  );
}
