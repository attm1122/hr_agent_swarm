'use client';

import {
  ShieldCheck,
  Sparkles,
  Users,
  BookOpen,
  Calendar,
  PartyPopper,
  AlertTriangle,
  CheckCircle,
  FileText,
  TrendingUp,
  Clock,
  type LucideProps,
} from 'lucide-react';
import type { ComponentType } from 'react';

/**
 * Maps icon name strings (from UIBlock data) to actual Lucide React components.
 * Add entries here as new icons are referenced in the composer rules.
 */
const ICON_MAP: Record<string, ComponentType<LucideProps>> = {
  ShieldCheck,
  Sparkles,
  Users,
  BookOpen,
  Calendar,
  PartyPopper,
  AlertTriangle,
  CheckCircle,
  FileText,
  TrendingUp,
  Clock,
};

interface LucideIconProps extends LucideProps {
  /** The Lucide icon name as a string (e.g. 'ShieldCheck'). */
  name: string;
}

/**
 * Renders a Lucide icon by name string. Falls back to nothing if the name
 * is not in the map (no runtime crash).
 */
export default function LucideIcon({ name, ...props }: LucideIconProps) {
  const Icon = ICON_MAP[name];
  if (!Icon) return null;
  return <Icon {...props} />;
}
