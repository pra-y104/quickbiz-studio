import {
  AlignLeft,
  Boxes,
  Calculator,
  CalendarDays,
  ClipboardList,
  FileText,
  Languages,
  Megaphone,
  MessageSquareQuote,
  PenLine,
  Percent,
  Receipt,
  Ruler,
  Shapes,
  Sparkles,
  Tag,
  Type,
  type LucideIcon,
} from 'lucide-react';
import { cn } from '../../lib/cn';

/**
 * Maps the icon names stored in the shared tool catalogue to real icon
 * components. Keeping the mapping here means the catalogue stays free of React
 * imports and the API can return plain strings.
 */
const ICONS: Readonly<Record<string, LucideIcon>> = {
  'pen-line': PenLine,
  megaphone: Megaphone,
  languages: Languages,
  sparkles: Sparkles,
  tag: Tag,
  shapes: Shapes,
  'message-square-quote': MessageSquareQuote,
  'clipboard-list': ClipboardList,
  calculator: Calculator,
  percent: Percent,
  ruler: Ruler,
  'calendar-days': CalendarDays,
  'file-text': FileText,
  receipt: Receipt,
  type: Type,
  'align-left': AlignLeft,
};

export interface ToolIconProps {
  name: string;
  className?: string;
}

export function ToolIcon({ name, className }: ToolIconProps) {
  const Icon = ICONS[name] ?? Boxes;
  return <Icon className={cn('size-5', className)} aria-hidden="true" />;
}
