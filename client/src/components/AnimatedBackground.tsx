"use client";

export default function AnimatedBackground({ className }: { className?: string }) {
  return (
    <div
      className={`app-animated-bg absolute inset-0 z-0 pointer-events-none ${className}`}
      style={{
        background: `
          radial-gradient(circle at 80% 10%, rgba(60, 0, 100, 0.25) 0%, transparent 45%),
          radial-gradient(circle at 50% 50%, rgba(50, 0, 90, 0.22) 0%, transparent 55%),
          radial-gradient(circle at 20% 90%, rgba(35, 0, 70, 0.2) 0%, transparent 60%),
          linear-gradient(135deg, #050507 0%, #000000 100%)
        `,
        backgroundSize: "cover",
        backgroundRepeat: "no-repeat",
        backgroundPosition: "center",
        animation: "bg-pan 60s linear infinite",
      }}
    />
  );
}
