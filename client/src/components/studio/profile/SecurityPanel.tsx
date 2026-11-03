"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Card, Dialog, DialogActions, PanelTitle, Row, SmallButton, StatusPill, Value, maskEmail } from "./ProfileUI";
import type { StudioProfile } from "./useStudioProfile";
import { CodeInput, ErrorText, EyeToggle, PasswordMatch, StrengthBar, errorMessage, passwordOk } from "../auth/AuthUI";
import { clearProjectSession, projectApiRequest, storeProjectSession } from "@/lib/projectApi";
import { useToast } from "@/hooks/use-toast";

const APP_STORE_URL = "https://apps.apple.com/app/google-authenticator/id388497605";
const PLAY_STORE_URL = "https://play.google.com/store/apps/details?id=com.google.android.apps.authenticator2";
const RESEND_SECONDS = 60;

type TwoFactorSetup = { secret: string; otpauthUrl?: string; qrCodeDataUrl?: string };

function DialogInput({ value, onChange, placeholder, focused }: { value: string; onChange: (v: string) => void; placeholder: string; focused?: boolean }) {
  const [shown, setShown] = useState(false);
  return (
    <div className="relative w-full">
    <input
      type={shown ? "text" : "password"} value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} autoComplete="new-password" autoFocus={focused}
      className="h-[45.488px] w-full rounded-[40px] border-[1.25px] border-[rgba(28,37,51,0.15)] bg-[#f4f1fc] pl-[13px] pr-[48px] py-[11px] text-[14px] text-[#1c2533] outline-none placeholder:text-[#98a0b4] focus:border-[#8a3ffc] focus:shadow-[0px_0px_0px_3px_rgba(138,63,252,0.1)]"
    />
    <EyeToggle shown={shown} onToggle={() => setShown(s => !s)} />
    </div>
  );
}

function ChangePasswordDialogs({ email, accountId, open, onClose }: { email: string; accountId?: string; open: boolean; onClose: () => void }) {
  const { toast } = useToast();
  const [step, setStep] = useState<"confirm" | "verify" | "password">("confirm");
  const [code, setCode] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [resendIn, setResendIn] = useState(0);

  const sendCode = async () => {
    setError("");
    try {
      await projectApiRequest({ method: "POST", endpoint: "/hub/forgot-password", data: { email, page: "project" } });
      setResendIn(RESEND_SECONDS);
    } catch (e) { setError(errorMessage(e, "We couldn't send the code. Try again.")); }
  };

  useEffect(() => {
    if (!open) return;
    // Nothing is sent until they confirm
    setStep("confirm"); setCode(""); setPassword(""); setConfirm(""); setError("");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn(s => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  const confirmSend = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      await projectApiRequest({ method: "POST", endpoint: "/hub/forgot-password", data: { email, page: "project" } });
      setResendIn(RESEND_SECONDS);
      setStep("verify");
    } catch (err) { setError(errorMessage(err, "We couldn't send the code. Try again.")); }
    finally { setBusy(false); }
  };

  const submitCode = (e?: React.FormEvent) => {
    e?.preventDefault();
    if (code.length !== 6) return setError("Enter the 6-digit code from your email.");
    setError(""); setStep("password");
  };

  const submitPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordOk(password)) return setError("Use at least 8 characters with a number, a capital letter and a symbol.");
    if (password !== confirm) return setError("The two passwords don't match.");
    setBusy(true); setError("");
    try {
      const res = await projectApiRequest<{ accessToken?: string; token?: string; admin?: { _id: string; name: string; email: string; role: string } }>({
        method: "POST", endpoint: "/hub/reset-password", data: { email, code, password, accountId },
      });
      const token = res.token ?? res.accessToken;
      if (token && res.admin) {
        storeProjectSession(token, { email: res.admin.email, name: res.admin.name, role: res.admin.role, adminId: res.admin._id });
        toast({ title: "Password updated", description: "Other devices have been signed out." });
        onClose();
      } else {
        // Studios with a linked wallet need a wallet sign-in after a password change
        clearProjectSession();
        try { sessionStorage.setItem("nexura:signed-out-reason", "Your password was updated. Sign in with your new password and your linked wallet."); } catch { /* ignore */ }
        window.location.href = "/studio/sign-in";
      }
    } catch (err) {
      const msg = errorMessage(err, "We couldn't update your password.");
      if (/code|otp|expired/i.test(msg)) { setCode(""); setStep("verify"); }
      setError(msg);
    } finally { setBusy(false); }
  };

  return (
    <Dialog open={open} onClose={onClose} labelledBy="change-password-title">
      {step === "confirm" ? (
        <form onSubmit={confirmSend}>
          <h3 id="change-password-title" className="px-[24px] pt-[22px] text-[24px] font-semibold leading-[32.2px] tracking-[-0.98px] text-[#1c2533]">Change your password?</h3>
          <div className="flex flex-col px-[24px] py-[16px]">
            <p className="text-[14px] leading-[21.7px] text-[#1c2533]">A 6-digit code will be sent to <b className="font-bold">{maskEmail(email)}</b>.</p>
            <ErrorText>{error}</ErrorText>
          </div>
          <DialogActions onCancel={onClose} confirmLabel="Send code" busy={busy} />
        </form>
      ) : step === "verify" ? (
        <form onSubmit={submitCode}>
          <h3 id="change-password-title" className="px-[24px] pt-[22px] text-[24px] font-semibold leading-[32.2px] tracking-[-0.98px] text-[#1c2533]">Verify it’s you</h3>
          <div className="flex flex-col px-[24px] py-[16px]">
            <p className="text-[14px] leading-[21.7px] text-[#1c2533]">
              Enter the 6-digit code sent to <b className="font-bold">{maskEmail(email)}</b>.
            </p>
            <CodeInput value={code} onChange={setCode} onComplete={() => submitCode()} className="pt-[14px]" size="dialog" />
            <div className="flex justify-center pt-[10px] text-[14px] leading-[21.7px] text-[#1c2533]">
              {resendIn > 0 ? `Resend code in ${resendIn}s` : <button type="button" onClick={sendCode} className="font-semibold text-[#8a3ffc]">Resend code</button>}
            </div>
            <ErrorText>{error}</ErrorText>
          </div>
          <DialogActions onCancel={onClose} confirmLabel="Verify" />
        </form>
      ) : (
        <form onSubmit={submitPassword}>
          <h3 id="change-password-title" className="pb-[10px] pl-[24px] pt-[30px] text-[24px] font-semibold leading-[18.837px] tracking-[-0.3276px] text-[#1c2533]">Set a new password</h3>
          <div className="flex flex-col px-[24px] py-[16px]">
            <p className="text-[14px] leading-[21.7px] text-[#1c2533]">Your email is verified. Choose a new password you have not used before.</p>
            <label className="flex flex-col gap-[7px] pt-[16px]">
              <span className="text-[13px] font-semibold leading-[20.15px] text-[#3d485c]">Password</span>
              <DialogInput value={password} onChange={setPassword} placeholder="At least 8 characters" focused />
              <StrengthBar password={password} />
            </label>
            <label className="flex flex-col gap-[7px] py-[2px]">
              <span className="text-[13px] font-semibold leading-[20.15px] text-[#3d485c]">Confirm password</span>
              <DialogInput value={confirm} onChange={setConfirm} placeholder="Re-enter password" />
              <PasswordMatch password={password} confirm={confirm} />
            </label>
            <ErrorText>{error}</ErrorText>
          </div>
          <DialogActions onCancel={onClose} confirmLabel="Update password" busy={busy} />
        </form>
      )}
    </Dialog>
  );
}

function AuthenticatorSetup({ onCancel, onDone }: { onCancel: () => void; onDone: () => void }) {
  const { toast } = useToast();
  const [step, setStep] = useState<1 | 2>(1);
  const [setup, setSetup] = useState<TwoFactorSetup | null>(null);
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const toStepTwo = async () => {
    setBusy(true); setError("");
    try {
      const res = await projectApiRequest<TwoFactorSetup>({ method: "POST", endpoint: "/hub/2fa/setup" });
      if (!res.secret) throw new Error("No secret returned");
      setSetup(res); setStep(2);
    } catch (e) {
      setError(errorMessage(e, "We couldn't start the setup. Try again."));
    } finally { setBusy(false); }
  };

  const verify = async (value = code) => {
    if (value.length !== 6) return setError("Enter the 6-digit code from Google Authenticator.");
    setBusy(true); setError("");
    try {
      await projectApiRequest({ method: "POST", endpoint: "/hub/2fa/enable", data: { code: value } });
      toast({ title: "2-step verification is on", description: "You'll need a code from Google Authenticator each time you sign in." });
      onDone();
    } catch (e) {
      setCode("");
      setError(errorMessage(e, "That code didn't work. Wait for a new one and try again."));
    } finally { setBusy(false); }
  };

  const copy = async () => {
    if (!setup?.secret) return;
    try { await navigator.clipboard.writeText(setup.secret); toast({ title: "Code copied" }); }
    catch { toast({ title: "Couldn't copy", description: "Select the code and copy it by hand.", variant: "destructive" }); }
  };

  return (
    <>
      <PanelTitle>Set up authenticator app</PanelTitle>
      <p className="pt-[8px] text-[14px] leading-[21.7px] text-[#1c2533]">Step {step} of 2</p>

      {step === 1 ? (
        <>
          <div className="mt-[20px] flex max-w-[560px] flex-col gap-[18px] rounded-[22px] border-[1.25px] border-[rgba(28,37,51,0.09)] bg-[#f4f1fc] p-[22px] sm:flex-row">
            <span className="relative size-[62px] shrink-0 rounded-[40px] bg-[#4285f4]">
              <img src="/studio-profile/google-authenticator-lg.svg" alt="" width={30} height={30} className="absolute left-[calc(50%-0.25px)] top-[calc(50%-0.25px)] -translate-x-1/2 -translate-y-1/2" />
            </span>
            <div className="flex flex-col">
              <b className="text-[16px] font-bold leading-[24.8px] text-[#1c2533]">Download Google Authenticator</b>
              <p className="pt-[6px] text-[13.5px] leading-[20.925px] text-[#69728a]">
                Install the app on your phone first. It gives you a 6-digit code that you will need every time you sign in to Nexura Studio.
              </p>
              <div className="flex gap-[8px] pt-[14px]">
                <a href={APP_STORE_URL} target="_blank" rel="noopener noreferrer" className="flex h-[35.996px] items-center rounded-[999px] border-[1.25px] border-[rgba(28,37,51,0.15)] bg-white px-[16px] text-[13px] font-semibold leading-[20.15px] text-[#1c2533]">App Store</a>
                <a href={PLAY_STORE_URL} target="_blank" rel="noopener noreferrer" className="flex h-[35.996px] items-center rounded-[999px] border-[1.25px] border-[rgba(28,37,51,0.15)] bg-white px-[16px] text-[13px] font-semibold leading-[20.15px] text-[#1c2533]">Google Play</a>
              </div>
            </div>
          </div>
          <ErrorText>{error}</ErrorText>
          <div className="flex gap-[8px] pt-[26px]">
            <SmallButton variant="outline" onClick={onCancel}>Cancel</SmallButton>
            <SmallButton onClick={toStepTwo} disabled={busy}>{busy ? "Preparing…" : "I have installed it"}</SmallButton>
          </div>
        </>
      ) : (
        <form onSubmit={e => { e.preventDefault(); void verify(); }} className="w-full">
          <div className="flex items-center gap-[10px] pt-[20px]">
            <img src="/studio-profile/shield.svg" alt="" className="size-[20px]" />
            <span className="text-[16px] font-semibold leading-[24.8px] text-[#1c2533]">Scan QR code</span>
          </div>
          <p className="pt-[6px] text-[14px] leading-[21.7px] text-[#1c2533]">Scan the QR code below or manually enter the secret key into your authenticator app.</p>
          <div className="flex justify-center pt-[14px]">
            <div className="flex w-full max-w-[560px] flex-col items-center gap-[26px] rounded-[22px] border-[1.25px] border-[rgba(28,37,51,0.09)] bg-[#f4f1fc] p-[20px] sm:flex-row">
              <div className="flex size-[190px] shrink-0 items-center justify-center rounded-[20px] border-[1.25px] border-[rgba(28,37,51,0.15)] bg-white p-[14px]">
                {setup?.qrCodeDataUrl
                  ? <img src={setup.qrCodeDataUrl} alt="QR code to add Nexura Studio to your authenticator app" className="size-[159.531px]" />
                  : <span className="text-center text-[12px] leading-[18px] text-[#69728a]">Enter the code on the right in your app.</span>}
              </div>
              <div className="flex min-w-[200px] flex-1 flex-col">
                <b className="text-[13px] font-bold leading-[20.15px] text-[#1c2533]">Can&apos;t scan? Enter code manually:</b>
                <div className="pb-[12px] pt-[10px]">
                  <div className="break-all rounded-[12px] border-[1.25px] border-[rgba(28,37,51,0.09)] bg-white px-[14px] py-[11px] text-[13px] leading-[20.15px] tracking-[0.78px] text-[#1c2533]" style={{ fontFamily: "var(--font-geist-mono), 'Geist Mono', ui-monospace, monospace" }}>
                    {setup?.secret}
                  </div>
                </div>
                <SmallButton variant="outline" onClick={copy} className="self-start">
                  <img src="/studio-profile/copy.svg" alt="" className="size-[12.988px]" /> Copy code
                </SmallButton>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-[10px] pt-[28px]">
            <img src="/studio-profile/lock.svg" alt="" className="size-[20px]" />
            <span className="text-[16px] font-semibold leading-[24.8px] text-[#1c2533]">Enter verification code</span>
          </div>
          <p className="pt-[6px] text-[14px] leading-[21.7px] text-[#1c2533]">Enter the 6-digit code shown in your authenticator app.</p>
          <div className="max-w-[360px]">
            <CodeInput value={code} onChange={setCode} onComplete={v => verify(v)} className="pt-[6px]" size="compact" />
          </div>
          <ErrorText>{error}</ErrorText>
          <div className="flex gap-[8px] pt-[22px]">
            <SmallButton variant="outline" onClick={onCancel}>Cancel</SmallButton>
            <SmallButton type="submit" disabled={busy}>{busy ? "Checking…" : "Verify"}</SmallButton>
          </div>
        </form>
      )}
    </>
  );
}

export default function SecurityPanel({ p }: { p: StudioProfile }) {
  const router = useRouter();
  const { toast } = useToast();
  const [settingUp, setSettingUp] = useState(false);
  const [passwordOpen, setPasswordOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const enabled = !!p.admin?.twoFactorEnabled;
  const email = p.admin?.email ?? "";

  const [offOpen, setOffOpen] = useState(false);
  const [offCode, setOffCode] = useState("");
  const [offError, setOffError] = useState("");

  const turnOff = async (e?: React.FormEvent, value = offCode) => {
    e?.preventDefault();
    if (value.length !== 6) return setOffError("Enter the 6-digit code from Google Authenticator.");
    setBusy(true); setOffError("");
    try {
      await projectApiRequest({ method: "POST", endpoint: "/hub/2fa/disable", data: { code: value } });
      await p.reload();
      setOffOpen(false);
      toast({ title: "2-step verification is off" });
    } catch (err) {
      setOffCode("");
      setOffError(errorMessage(err, "That code didn't work. Try again."));
    } finally { setBusy(false); }
  };

  if (settingUp) {
    return <Card><AuthenticatorSetup onCancel={() => setSettingUp(false)} onDone={async () => { setSettingUp(false); await p.reload(); }} /></Card>;
  }

  return (
    <Card title="Security" text="Protect your account.">
      <div className="w-full pt-[18px]">
        <Row title="Email address" text="The email associated with your account.">
          <Value>{email || "No email on this account"}</Value>
          {email && <StatusPill tone="green">Verified</StatusPill>}
        </Row>
        <Row title="Password" text="Set a unique password to protect your account.">
          <SmallButton variant="outline" onClick={() => setPasswordOpen(true)} disabled={!email}>Change Password</SmallButton>
        </Row>
        <Row title="2-step verification" text="Use Google Authenticator to get a 6-digit code every time you sign in." last>
          <StatusPill tone={enabled ? "green" : "grey"}>{enabled ? "On" : "Off"}</StatusPill>
          {enabled
            ? <SmallButton variant="outline" onClick={() => { setOffCode(""); setOffError(""); setOffOpen(true); }}>Turn off</SmallButton>
            : <SmallButton onClick={() => setSettingUp(true)}>Set up</SmallButton>}
        </Row>
      </div>
      <ChangePasswordDialogs email={email} accountId={p.admin?._id} open={passwordOpen} onClose={() => setPasswordOpen(false)} />
      <Dialog open={offOpen} onClose={() => setOffOpen(false)} labelledBy="turn-off-2fa-title">
        <form onSubmit={turnOff}>
          <h3 id="turn-off-2fa-title" className="px-[24px] pt-[22px] text-[24px] font-semibold leading-[32.2px] tracking-[-0.98px] text-[#1c2533]">Turn off 2-step verification</h3>
          <div className="flex flex-col px-[24px] py-[16px]">
            <p className="text-[14px] leading-[21.7px] text-[#1c2533]">Enter the 6-digit code from Google Authenticator to confirm.</p>
            <CodeInput value={offCode} onChange={setOffCode} onComplete={v => turnOff(undefined, v)} className="pt-[14px]" size="dialog" />
            <ErrorText>{offError}</ErrorText>
          </div>
          <DialogActions onCancel={() => setOffOpen(false)} confirmLabel="Turn off" busy={busy} />
        </form>
      </Dialog>
    </Card>
  );
}
