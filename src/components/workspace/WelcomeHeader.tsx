interface WelcomeHeaderProps {
  name: string;
  roleLabel: string;
  scope?: string;
}

export function WelcomeHeader({ name, roleLabel, scope }: WelcomeHeaderProps) {
  const firstName = name.split(' ')[0];
  return (
    <div className="space-y-0.5">
      <h1 className="text-2xl font-bold tracking-tight text-[#1A1A1A]">
        Welcome back, {firstName}
      </h1>
      <p className="text-xs text-[#9C9C9C]">
        {roleLabel}
        {scope && (
          <>
            <span className="mx-1.5 text-[#BDB8B0]">·</span>
            <span>{scope}</span>
          </>
        )}
      </p>
    </div>
  );
}
