"use client";

import { useEffect, useRef, useState, type ButtonHTMLAttributes, type InputHTMLAttributes, type ReactNode } from "react";

export function Card({ children, shadow = "strong", className = "" }: { children: ReactNode; shadow?: "strong" | "soft" | "softer"; className?: string }) {
  const drop =
    shadow === "strong" ? "drop-shadow-[0px_40px_40px_rgba(138,63,252,0.4)]"
    : shadow === "soft" ? "drop-shadow-[0px_40px_35px_rgba(138,63,252,0.2)]"
    : "drop-shadow-[0px_40px_40px_rgba(138,63,252,0.2)]";
  return (
    <div className={`flex w-full max-w-[460px] flex-col items-start rounded-[36px] border-[1.25px] border-[#e8e4f6] bg-white p-[20px] sm:p-[26px] ${drop} ${className}`}>
      {children}
    </div>
  );
}

export function CardTitle({ children }: { children: ReactNode }) {
  return <h1 className="text-[24px] font-semibold leading-[28px] tracking-[-0.84px] text-[#1c2533]">{children}</h1>;
}

export function CardText({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <p className={`pt-[4px] text-[14px] leading-[21px] text-[#5b6478] ${className}`}>{children}</p>;
}

export function PageTitle({ title, subtitle }: { title: string; subtitle?: string }) {
  return (
    <>
      <h1 className="pt-[16px] text-[28px] font-semibold leading-[32px] tracking-[-0.98px] text-[#1c2533]">{title}</h1>
      {subtitle && <p className="pt-[4px] text-[14.5px] leading-[22px] text-[#5b6478]">{subtitle}</p>}
    </>
  );
}

export function Field({ label, children, className = "pt-[12px]" }: { label: string; children: ReactNode; className?: string }) {
  return (
    <label className={`flex w-full flex-col gap-[6px] ${className}`}>
      <span className="text-[13px] font-semibold leading-[20px] text-[#1c2533]">{label}</span>
      {children}
    </label>
  );
}

const inputBase =
  "h-[42px] w-full border-[1.25px] border-[#ddd8ee] bg-white px-[16px] text-[14px] leading-[22.5px] text-[#1c2533] outline-none placeholder:text-[#98a0b4] focus:border-[#8a3ffc]";

export function TextInput({ round = "pill", className = "", ...props }: InputHTMLAttributes<HTMLInputElement> & { round?: "pill" | "soft" }) {
  return <input {...props} className={`${inputBase} ${round === "pill" ? "rounded-[40px]" : "rounded-[14px]"} ${className}`} />;
}

export function TextArea(props: React.TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <textarea
      {...props}
      className="h-[84px] min-h-[84px] w-full resize-none rounded-[28px] border-[1.25px] border-[#ddd8ee] bg-white px-[22px] py-[14px] text-[15px] leading-[22.5px] text-[#1c2533] outline-none placeholder:text-[#98a0b4] focus:border-[#8a3ffc]"
    />
  );
}

/** Always-visible show/hide button for a password field. */
export function EyeToggle({ shown, onToggle }: { shown: boolean; onToggle: () => void }) {
  return (
    <button
      type="button" onClick={onToggle} aria-label={shown ? "Hide password" : "Show password"} aria-pressed={shown}
      className="absolute right-[12px] top-1/2 flex size-[30px] -translate-y-1/2 items-center justify-center rounded-full text-[#69728a] hover:text-[#8a3ffc]"
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
        <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
        <circle cx="12" cy="12" r="3" />
        {shown && <path d="M3 3l18 18" />}
      </svg>
    </button>
  );
}

export function PasswordInput({ withShow: _withShow, round = "pill", ...props }: InputHTMLAttributes<HTMLInputElement> & { withShow?: boolean; round?: "pill" | "soft" }) {
  const [shown, setShown] = useState(false);
  return (
    <div className="relative w-full">
      <TextInput {...props} round={round} type={shown ? "text" : "password"} className="pr-[48px]" />
      <EyeToggle shown={shown} onToggle={() => setShown(s => !s)} />
    </div>
  );
}

export const passwordScore = (p: string) =>
  [p.length >= 8, /\d/.test(p), /[^a-zA-Z0-9]/.test(p), /[A-Z]/.test(p)].filter(Boolean).length;

export const passwordOk = (p: string) => passwordScore(p) === 4;

export function StrengthBar({ password }: { password: string }) {
  const score = passwordScore(password);
  const color = score >= 3 ? "#00a87c" : score === 2 ? "#f5a524" : "#e4545b";
  return (
    <div className="w-full pt-[8px]">
      <div className="h-[5px] w-full overflow-hidden rounded-[3px] bg-[#edeaf7]">
        <div className="h-[5px] transition-[width] duration-200" style={{ width: `${(score / 4) * 100}%`, background: color }} />
      </div>
    </div>
  );
}

export function PasswordMatch({ password, confirm }: { password: string; confirm: string }) {
  if (!confirm) return null;
  const ok = password === confirm;
  return (
    <span aria-live="polite" className={`pt-[2px] text-[12.5px] font-semibold leading-[18px] ${ok ? "text-[#00a87c]" : "text-[#e4545b]"}`}>
      {ok ? "✓ Passwords match" : "✕ Passwords don't match"}
    </span>
  );
}

export function PrimaryButton({ children, className = "", ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      {...props}
      className={`flex h-[44px] w-full items-center justify-center rounded-[999px] border-[1.25px] border-[#8a3ffc] bg-[#8a3ffc] px-[22px] text-[14.5px] font-semibold text-white drop-shadow-[0px_10px_13px_rgba(138,63,252,0.7)] transition-opacity disabled:cursor-not-allowed disabled:opacity-60 ${className}`}
    >
      {children}
    </button>
  );
}

export function TextLink({ children, ...props }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return <button type="button" {...props} className="text-[13.5px] font-semibold leading-[20.925px] text-[#8a3ffc] disabled:opacity-60">{children}</button>;
}

export function ErrorText({ children }: { children: ReactNode }) {
  if (!children) return null;
  return <p role="alert" className="pt-[10px] text-[13px] leading-[19px] text-[#e4545b]">{children}</p>;
}

export function WalletBanner({ address, onConnect, className = "", verified, signing, onSign, wrongWallet }: {
  address: string | null; onConnect: () => void; className?: string;
  /** Whether the wallet has signed the login message yet. */
  verified?: boolean; signing?: boolean; onSign?: () => void;
  /** The server's message when this wallet isn't the one linked to the account. */
  wrongWallet?: string;
}) {
  const short = address && address.length > 12 ? `${address.slice(0, 6)}…${address.slice(-4)}` : address;
  if (address && wrongWallet) {
    return (
      <div role="alert" className={`flex w-full items-center gap-[10px] rounded-[20px] border-[1.25px] border-[rgba(228,84,91,0.45)] bg-[rgba(228,84,91,0.08)] px-[15px] py-[9px] ${className}`}>
        <span className="flex size-[18px] shrink-0 items-center justify-center rounded-full bg-[#e4545b] text-[12px] font-bold text-white">!</span>
        <p className="flex-1 text-[13px] leading-[19.5px] text-[#1c2533]"><b className="font-bold">Wrong wallet.</b> {wrongWallet}</p>
      </div>
    );
  }
  if (address && signing && !verified) {
    return (
      <div aria-live="polite" className={`flex h-[40px] w-full items-center gap-[10px] rounded-[40px] border-[1.25px] border-[#e8e4f6] bg-[#f4f1ff] px-[15px] ${className}`}>
        <span className={`size-[8px] shrink-0 rounded-full bg-[#f5a524] ${signing ? "animate-pulse" : ""}`} />
        <p className="flex-1 text-[13.5px] leading-[20.25px] text-[#1c2533]">
          <b className="font-bold">Open your wallet extension</b> to sign for {short}
        </p>
      </div>
    );
  }
  if (address) {
    return (
      <div className={`flex h-[40px] w-full items-center gap-[10px] rounded-[40px] border-[1.25px] border-[rgba(0,225,162,0.4)] bg-[rgba(0,225,162,0.12)] px-[15px] py-[10px] ${className}`}>
        <img src="/studio-auth/check-circle.svg" alt="" className="size-[17.988px] shrink-0" />
        <p className="text-[13.5px] leading-[20.25px] text-[#1c2533]">
          <b className="font-bold">Wallet connected</b> {address.length > 12 ? `${address.slice(0, 6)}…${address.slice(-4)}` : address}
        </p>
      </div>
    );
  }
  return (
    <div className={`flex w-full items-center gap-[10px] rounded-[40px] border-[1.25px] border-[#e8e4f6] bg-[#f4f1ff] px-[15px] py-[9px] ${className}`}>
      <img src="/studio-auth/card.svg" alt="" className="size-[17.988px] shrink-0" />
      <p className="max-w-[401px] text-[13.5px] leading-[20.25px] text-[#1c2533]">
        <b className="font-bold">Wallet required</b>
      </p>
      <div className="flex flex-1 justify-end">
        <button
          type="button" onClick={onConnect}
          className="flex h-[37.988px] items-center rounded-[999px] border-[1.25px] border-[#8a3ffc] bg-[#8b3efe] px-[16px] text-[13.5px] font-semibold text-white drop-shadow-[0px_10px_13px_rgba(138,63,252,0.7)]"
        >
          Connect
        </button>
      </div>
    </div>
  );
}

export function GoogleAuthenticatorRow({ subtitle }: { subtitle?: string }) {
  return (
    <div className="flex w-full items-center gap-[12px] rounded-[40px] border-[1.25px] border-[#e3def3] bg-[#fbfaff] px-[14px] py-[13px]">
      <span className="relative size-[36px] shrink-0 overflow-hidden rounded-[40px] bg-[#4285f4]">
        <img src="/studio-auth/google-authenticator.svg" alt="" width={20} height={20} className="absolute left-[calc(50%-0.48px)] top-[calc(50%+0.17px)] -translate-x-1/2 -translate-y-1/2" />
      </span>
      <span className="flex flex-col">
        <span className="text-[14px] font-bold leading-[21.7px] text-[#1c2533]">Google Authenticator</span>
        {subtitle && <span className="text-[12px] leading-[18.6px] text-[#5b6478]">{subtitle}</span>}
      </span>
    </div>
  );
}

/** Six one-digit boxes; typing moves forward, Backspace moves back, pasting fills them all. */
const BOX = {
  auth: "h-[50px] border-[#ddd8ee]",
  dialog: "h-[55.996px] border-[rgba(28,37,51,0.15)] focus:shadow-[0px_0px_0px_3px_rgba(138,63,252,0.1)]",
  compact: "h-[51.992px] border-[rgba(28,37,51,0.15)]",
};

export function CodeInput({ value, onChange, onComplete, className = "pt-[24px]", size = "auth" }: {
  value: string; onChange: (v: string) => void; onComplete?: (v: string) => void; className?: string; size?: keyof typeof BOX;
}) {
  const refs = useRef<(HTMLInputElement | null)[]>([]);
  const digits = Array.from({ length: 6 }, (_, i) => value[i] ?? "");
  const set = (next: string) => {
    const clean = next.replace(/\D/g, "").slice(0, 6);
    onChange(clean);
    if (clean.length === 6) onComplete?.(clean);
  };
  return (
    <div className={`flex w-full gap-[10px] ${className}`}>
      {digits.map((d, i) => (
        <input
          key={i}
          ref={el => { refs.current[i] = el; }}
          aria-label={`Digit ${i + 1}`}
          inputMode="numeric" autoComplete={i === 0 ? "one-time-code" : "off"} maxLength={1}
          value={d}
          onChange={e => {
            const ch = e.target.value.replace(/\D/g, "").slice(-1);
            const arr = digits.slice(); arr[i] = ch;
            set(arr.join(""));
            if (ch && i < 5) refs.current[i + 1]?.focus();
          }}
          onKeyDown={e => {
            if (e.key === "Backspace" && !digits[i] && i > 0) refs.current[i - 1]?.focus();
          }}
          onPaste={e => {
            e.preventDefault();
            set(e.clipboardData.getData("text"));
            refs.current[Math.min(5, e.clipboardData.getData("text").replace(/\D/g, "").length)]?.focus();
          }}
          className={`${BOX[size]} min-w-0 flex-1 rounded-[12px] border-[1.25px] bg-white text-center text-[22px] font-semibold text-[#1c2533] outline-none focus:border-[#8a3ffc]`}
        />
      ))}
    </div>
  );
}

export const PICTURE_ACCEPT = "image/png,image/jpeg,image/webp";
const PICTURE_MAX_BYTES = 5 * 1024 * 1024;

/** Why this file can't be the project picture, or null. */
export const pictureProblem = (f: File) =>
  !PICTURE_ACCEPT.split(",").includes(f.type) ? "Use a PNG, JPG or WebP image."
  : f.size > PICTURE_MAX_BYTES ? "Use an image up to 5 MB."
  : null;

/** Project profile picture on the create-studio step. */
export function ProfilePictureField({ file, onChange }: { file: File | null; onChange: (f: File) => void }) {
  const input = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<string | null>(null);
  useEffect(() => {
    if (!file) { setPreview(null); return; }
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  const open = () => input.current?.click();
  return (
    <div className="flex w-full items-center gap-[22px] pb-[20px] pt-[10px]">
      <input ref={input} type="file" accept={PICTURE_ACCEPT} hidden onChange={e => { const f = e.target.files?.[0]; if (f) onChange(f); e.target.value = ""; }} />
      <button
        type="button" onClick={open} aria-label={preview ? "Change profile picture" : "Add profile picture"}
        className="relative flex size-[103.984px] shrink-0 flex-col items-center justify-center gap-[4px] overflow-hidden rounded-[28px] border-[1.25px] border-dashed border-[#cfc9e6] bg-[#f4f1ff]"
      >
        {preview ? <img src={preview} alt="" className="absolute inset-0 size-full object-cover" /> : (
          <>
            <img src="/studio-auth/add-photo-plus.svg" alt="" width={21.9922} height={21.9922} />
            <span className="text-[12px] font-semibold leading-[18.6px] text-[#8a3ffc]">Add photo</span>
          </>
        )}
      </button>
      <div className="flex min-w-[220px] flex-1 flex-col items-start">
        <span className="text-[15px] font-bold leading-[23.25px] text-[#1c2533]">Profile picture</span>
        <p className="max-w-[380px] pt-[4px] text-[13px] leading-[19.5px] text-[#5b6478]">Upload a 512 × 512px image of your project logo or brand mark. PNG, JPG or WebP, up to 5 MB.</p>
        <div className="flex pt-[12px]">
          <button
            type="button" onClick={open}
            className="flex h-[37.988px] items-center rounded-[999px] border-[1.25px] border-[#8a3ffc] bg-[#8a3ffc] px-[16px] text-[13.5px] font-semibold text-white drop-shadow-[0px_10px_13px_rgba(138,63,252,0.7)]"
          >
            {preview ? "Change picture" : "Upload picture"}
          </button>
        </div>
      </div>
    </div>
  );
}

export const errorMessage = (e: unknown, fallback: string) => {
  const any = e as { message?: string; error?: string } | null;
  return any?.error || any?.message || fallback;
};
