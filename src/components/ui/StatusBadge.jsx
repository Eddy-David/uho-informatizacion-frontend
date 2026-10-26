import { statusClass } from '@/utils';

/** Badge de estado que mapea códigos del backend a colores institucionales. */
export default function StatusBadge({ status, label }) {
  if (!status) return <span className="text-brand-300">—</span>;
  return <span className={statusClass(status)}>{label || status}</span>;
}
