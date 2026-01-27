import { format } from 'date-fns';
import { he } from 'date-fns/locale';

export function formatHebrewDate(date: Date): string {
  return format(date, "EEEE, d בMMMM yyyy", { locale: he });
}

export function formatHebrewTime(date: Date): string {
  return format(date, "HH:mm", { locale: he });
}

export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('he-IL', {
    style: 'currency',
    currency: 'ILS',
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  }).format(amount);
}

export function formatNumber(num: number): string {
  return new Intl.NumberFormat('he-IL').format(num);
}

export function formatShortDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return format(d, "dd/MM/yyyy", { locale: he });
}

export function formatTime(time: string | null): string {
  if (!time) return '';
  return time.substring(0, 5); // HH:mm
}
