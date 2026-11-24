import { createContext, useCallback, useState, type ReactNode } from 'react';
import type { Medicine } from '../../types/database';

export interface CartItem {
  medicine: Medicine;
  quantity: number;
}

export interface CartContextValue {
  items: CartItem[];
  addItem: (medicine: Medicine) => void;
  removeItem: (medicineId: string) => void;
  updateQuantity: (medicineId: string, quantity: number) => void;
  clearCart: () => void;
  hasRxItems: boolean;
  totalItems: number;
}

export const CartContext = createContext<CartContextValue | null>(null);

export function CartProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);

  const addItem = useCallback((medicine: Medicine) => {
    setItems(prev => {
      const existing = prev.find(i => i.medicine.id === medicine.id);
      if (existing) {
        return prev.map(i =>
          i.medicine.id === medicine.id ? { ...i, quantity: i.quantity + 1 } : i
        );
      }
      return [...prev, { medicine, quantity: 1 }];
    });
  }, []);

  const removeItem = useCallback((medicineId: string) => {
    setItems(prev => prev.filter(i => i.medicine.id !== medicineId));
  }, []);

  const updateQuantity = useCallback((medicineId: string, quantity: number) => {
    if (quantity <= 0) {
      setItems(prev => prev.filter(i => i.medicine.id !== medicineId));
      return;
    }
    setItems(prev =>
      prev.map(i => (i.medicine.id === medicineId ? { ...i, quantity } : i))
    );
  }, []);

  const clearCart = useCallback(() => setItems([]), []);

  const hasRxItems = items.some(i => i.medicine.requires_prescription);
  const totalItems = items.reduce((s, i) => s + i.quantity, 0);

  return (
    <CartContext.Provider value={{ items, addItem, removeItem, updateQuantity, clearCart, hasRxItems, totalItems }}>
      {children}
    </CartContext.Provider>
  );
}
