import { useState } from 'react';
import { Search, Plus, Check, FileText } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '../../lib/supabase';
import { useCart } from '../cart/useCart';
import { Button } from '../../components/ui/Button';
import { Input } from '../../components/ui/Input';
import { Badge } from '../../components/ui/Badge';
import { Card } from '../../components/ui/Card';
import { Skeleton } from '../../components/ui/Skeleton';
import type { Medicine } from '../../types/database';

export function CatalogPage() {
  const [search, setSearch] = useState('');
  const { items, addItem } = useCart();

  const { data: medicines, isLoading } = useQuery({
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

  const filtered = (medicines ?? []).filter(m =>
    m.name.toLowerCase().includes(search.toLowerCase()) ||
    m.generic_name.toLowerCase().includes(search.toLowerCase())
  );

  const isInCart = (id: string) => items.some(i => i.medicine.id === id);

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <h1 className="text-xl font-bold">Medicines</h1>
      </div>

      <Input
        placeholder="Search by name or generic name…"
        value={search}
        onChange={e => setSearch(e.target.value)}
        icon={<Search className="h-4 w-4" strokeWidth={1.5} />}
      />

      {isLoading ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} variant="rect" height="120px" />
          ))}
        </div>
      ) : filtered.length === 0 ? (
        <p className="py-8 text-center text-sm text-neutral-500">No medicines found.</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map(med => (
            <Card key={med.id} className="flex flex-col justify-between gap-3">
              <div>
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-sm font-semibold text-neutral-900 leading-tight">{med.name}</h3>
                  {med.requires_prescription && (
                    <Badge variant="info" className="shrink-0">
                      <FileText className="mr-0.5 inline h-3 w-3" strokeWidth={1.5} />
                      Rx
                    </Badge>
                  )}
                </div>
                <p className="mt-0.5 text-xs text-neutral-500">{med.generic_name}</p>
                <div className="mt-1 flex items-center gap-2 text-xs text-neutral-500">
                  <span className="rounded bg-neutral-100 px-1.5 py-0.5">{med.form}</span>
                  <span>{med.strength}</span>
                </div>
              </div>

              <Button
                variant={isInCart(med.id) ? 'secondary' : 'primary'}
                size="sm"
                onClick={() => addItem(med)}
                icon={isInCart(med.id)
                  ? <Check className="h-3.5 w-3.5" strokeWidth={1.5} />
                  : <Plus className="h-3.5 w-3.5" strokeWidth={1.5} />
                }
                className="w-full"
              >
                {isInCart(med.id) ? 'Add more' : 'Add to cart'}
              </Button>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
