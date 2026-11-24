import { BRAND } from '../../config/brand';

export function Footer() {
  return (
    <footer className="border-t border-neutral-200 bg-white px-4 py-4 text-center text-xs text-neutral-400">
      {BRAND.footer}
    </footer>
  );
}
