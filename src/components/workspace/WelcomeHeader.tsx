interface WelcomeHeaderProps {
  name: string;
  roleLabel: string;
  scope?: string;
}

export function WelcomeHeader({ name, roleLabel, scope }: WelcomeHeaderProps) {
  const firstName = name.split(' ')[0];
  return (
    <div className="space-y-0.5">
      <h1 className="text-2xl font-bold tracking-tight text-[var(--text-primary)]">
        Welcome back, {firstName}
      </h1>
      <p className="text-xs text-[var(--text-tertiary)]">
        {roleLabel}
        {scope && (
          <>
            <span className="mx-1.5 text-[var(--border-strong)]">·</span>
            <span>{scope}</span>
          </>
        )}
      </p>
    </div>
  );
}
