import { clsx, type ClassValue } from 'clsx';

export function cn(...inputs: ClassValue[]) {
  return clsx(inputs);
}

export function formatDate(dateStr: string): string {
  try {
    const date = new Date(dateStr);
    const now = new Date();
    const diff = now.getTime() - date.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));

    if (days === 0) {
      return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
    } else if (days === 1) {
      return 'Yesterday';
    } else if (days < 7) {
      return date.toLocaleDateString('en-US', { weekday: 'short' });
    } else {
      return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
    }
  } catch {
    return dateStr;
  }
}

export function truncate(str: string, maxLength: number): string {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength) + '...';
}

export function stripHtml(html: string): string {
  return html.replace(/<[^>]*>/g, '').replace(/&nbsp;/g, ' ').replace(/\s+/g, ' ').trim();
}

export function getCategoryColor(category: string): string {
  const colors: Record<string, string> = {
    newsletters: '#8B5CF6',
    job_recruitment: '#10B981',
    finance: '#F59E0B',
    notifications: '#6366F1',
    personal: '#EC4899',
    work_professional: '#3B82F6',
    uncategorized: '#6B7280',
  };
  return colors[category] || colors.uncategorized;
}

export function getCategoryLabel(category: string): string {
  const labels: Record<string, string> = {
    newsletters: 'Newsletter',
    job_recruitment: 'Job / Recruitment',
    finance: 'Finance',
    notifications: 'Notification',
    personal: 'Personal',
    work_professional: 'Work',
    uncategorized: 'Uncategorized',
  };
  return labels[category] || 'Uncategorized';
}
