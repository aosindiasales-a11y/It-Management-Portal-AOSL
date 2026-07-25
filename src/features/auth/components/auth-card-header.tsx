import Image from "next/image";

interface AuthCardHeaderProps {
  title: string;
  eyebrow?: string;
  description?: string;
}

export function AuthCardHeader({ title, eyebrow, description }: AuthCardHeaderProps) {
  return (
    <div className="mb-8 flex flex-col items-center text-center">
      <Image
        src="/brand/aosl-logo.png"
        alt="Aviation Overseas Supply Logistics"
        width={220}
        height={48}
        className="mb-5 h-10 w-auto"
        priority
      />
      <h1 className="text-xl font-semibold tracking-tight text-foreground">{title}</h1>
      {eyebrow && <p className="mt-1.5 text-sm font-medium text-primary">{eyebrow}</p>}
      {description && <p className="mt-2 text-sm text-muted-foreground">{description}</p>}
    </div>
  );
}
