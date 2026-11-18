import type { ReactNode } from 'react';
import { Card, CardDescription, CardHeader, CardTitle } from '../ui/card';

export interface FeatureCardProps {
  icon: ReactNode;
  title: string;
  body: string;
}

export function FeatureCard({ icon, title, body }: FeatureCardProps) {
  return (
    <Card as="article" className="h-full">
      <CardHeader>
        <span className="mb-1 inline-flex size-9 items-center justify-center rounded-lg border border-border bg-surface-muted text-primary">
          {icon}
        </span>
        <CardTitle className="text-[15px]">{title}</CardTitle>
        <CardDescription>{body}</CardDescription>
      </CardHeader>
    </Card>
  );
}
