"use client";

import { useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import AuthShell, { type StepState } from "./AuthShell";
import {
  Card, CardText, CardTitle, CodeInput, ErrorText, Field, GoogleAuthenticatorRow, PasswordInput, PrimaryButton,
  PasswordMatch, StrengthBar, TextInput, TextLink, WalletBanner, errorMessage, passwordOk,
} from "./AuthUI";
import { useStudioWallet } from "../useStudioWallet";
import { isProjectSessionActive, projectApiRequest, storeProjectSession } from "@/lib/projectApi";
import { EMAIL_RE } from "@/lib/email";
import { useToast } from "@/hooks/use-toast";

type Step = "signin" | "choose-hub" | "twofa" | "reset-email" | "reset-code" | "reset-password" | "reset-done";

type Admin = { _id: string; name: string; email: string; role: string; hub?: string };
type SignInResponse = {
  accessToken?: string; token?: string; admin?: Admin;
  twoFactorRequired?: boolean; twoFactorToken?: string;
  hubChoiceRequired?: boolean; hubs?: HubChoice[];
};
type HubChoice = { accountId: string; name: string; logo: string };

const WRONG_WALLET = /you connected|switch to the wallet|linked to this studio/i;

function HubPicker({ hubs, onPick, busy }: { hubs: HubChoice[]; onPick: (id: string) => void; busy: boolean }) {
  return (
    <div className="flex w-full flex-col gap-[10px] pt-[16px]">
      {hubs.map(h => (
        <button
          key={h.accountId} type="button" disabled={busy} onClick={() => onPick(h.accountId)}
          className="flex h-[56px] w-full items-center gap-[12px] rounded-[20px] border-[1.25px] border-[#e3def3] bg-white px-[14px] text-left hover:border-[#8a3ffc] disabled:opacity-60"
        >
          {h.logo
            ? <img src={h.logo} alt="" className="size-[32px] shrink-0 rounded-full object-cover" />
            : <span className="flex size-[32px] shrink-0 items-center justify-center rounded-full bg-[#f4f1ff] text-[13px] font-bold text-[#8a3ffc]">{h.name.slice(0, 1)}</span>}
          <span className="truncate text-[14.5px] font-semibold text-[#1c2533]">{h.name}</span>
        </button>
      ))}
    </div>
  );
}

const SIGN_IN_STEPS: StepState[] = ["active"];
const RESET_STEPS: StepState[] = ["active"];
const RESEND_SECONDS = 60;

export default function SignInFlow() {
  const router = useRouter();
  const params = useSearchParams();
  const { toast } = useToast();
  // The wallet signed once when it connected (see useStudioWallet); sign-in sends that proof
  const { address, connect, verified, verifying, verify, verifyFailed, token } = useStudioWallet();
  const [step, setStep] = useState<Step>(params.get("reset") ? "reset-email" : "signin");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [totp, setTotp] = useState("");
  const [twoFactorToken, setTwoFactorToken] = useState("");
  const [resetEmail, setResetEmail] = useState("");
  const [resetCode, setResetCode] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [resendIn, setResendIn] = useState(0);
  const [wrongWallet, setWrongWallet] = useState("");
  const [walletNote, setWalletNote] = useState("");
  const [hubs, setHubs] = useState<HubChoice[]>([]);
  const [remember, setRemember] = useState(false);
  const [resetHubs, setResetHubs] = useState<HubChoice[]>([]);

  /** Whether the connected wallet can open these details: "ok", "wrong" (banner shows why) or "unknown". */
  const checkWallet = async (): Promise<"ok" | "wrong" | "unknown"> => {
    const email = identifier.trim();
    if (!address || !email || !password) return "unknown";
    try {
      const r = await projectApiRequest<{ status: string; error?: string }>({
        method: "POST", endpoint: "/hub/sign-in/check", data: { email, password, walletAddress: address },
      });
      if (r.status === "wrongWallet") { setWrongWallet(r.error ?? "This wallet isn't linked to this studio."); return "wrong"; }
      return r.status === "ok" ? "ok" : "unknown";
    } catch { return "unknown"; } // a wrong password: Sign in says so
  };

  // As soon as the details and a wallet are in, check the wallet (no signature needed for that);
  // only the right wallet is then asked to sign, so a wrong one never gets a signature request
  useEffect(() => {
    setWrongWallet(""); setWalletNote("");
    if (!address || !identifier.trim() || password.length < 8) return;
    let stale = false;
    const t = setTimeout(async () => {
      const result = await checkWallet();
      if (!stale && result === "ok" && !verified) void verify();
    }, 700);
    return () => { stale = true; clearTimeout(t); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [address, identifier, password]);

  useEffect(() => {
    if (!params.get("reset") && isProjectSessionActive()) router.replace("/studio-dashboard/hub-profile");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    try {
      const reason = sessionStorage.getItem("nexura:signed-out-reason");
      if (!reason) return;
      sessionStorage.removeItem("nexura:signed-out-reason");
      toast({ title: "You were signed out", description: reason });
    } catch { /* storage unavailable */ }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn(s => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  const go = (s: Step) => { setError(""); setStep(s); };

  const finishSignIn = async (res: SignInResponse, email: string) => {
    const token = res.token ?? res.accessToken;
    if (!token) throw new Error("Signing in didn't return a session. Try again.");
    const base = { email: res.admin?.email ?? email, role: res.admin?.role ?? "admin", adminId: res.admin?._id ?? "", walletAddress: address ?? "" };
    storeProjectSession(token, { ...base, name: res.admin?.name ?? email }, remember);
    try {
      const { hub } = await projectApiRequest<{ hub: Record<string, any> }>({ method: "GET", endpoint: "/hub/me" });
      storeProjectSession(token, { ...base, name: hub.name ?? res.admin?.name ?? email, logo: hub.logo ?? "" }, remember);
    } catch { /* keep the basic session if the hub can't be loaded */ }
    router.push("/studio-dashboard/hub-profile");
  };

  const signIn = async (e?: React.FormEvent, accountId?: string) => {
    e?.preventDefault();
    const email = identifier.trim();
    if (!email || !password) return setError("Enter your username or email and your password.");
    if (!address) { setWalletNote("Connect your wallet first."); connect(); return; }
    setError(""); setWalletNote("");
    if (!token && (await checkWallet()) === "wrong") return;
    const walletToken = token ?? (await verify());
    if (!walletToken) return setWalletNote(verifyFailed ? "Your wallet signed, but we couldn't confirm it right now. Try again." : "Sign the message in your wallet to verify it.");
    setBusy(true); setWrongWallet("");
    try {
      const res = await projectApiRequest<SignInResponse>({
        method: "POST", endpoint: "/hub/sign-in",
        data: { email, password, role: "project", walletAddress: address, walletToken, remember, ...(accountId ? { accountId } : {}) },
      });
      if (res.hubChoiceRequired && res.hubs?.length) {
        setHubs(res.hubs);
        go("choose-hub");
        return;
      }
      if (res.twoFactorRequired && res.twoFactorToken) {
        setTwoFactorToken(res.twoFactorToken);
        setTotp("");
        go("twofa");
        return;
      }
      await finishSignIn(res, email);
    } catch (err) {
      const msg = errorMessage(err, "Incorrect email or password.");
      // A wrong wallet is rejected before the signature is used, so it stays valid; otherwise sign again next time
      if (WRONG_WALLET.test(msg)) { setWrongWallet(msg); if (accountId) go("signin"); return; }
      setError(msg);
    } finally { setBusy(false); }
  };

  const verifyTwoFactor = async (value = totp) => {
    if (value.length !== 6) return setError("Enter the 6-digit code from Google Authenticator.");
    setBusy(true); setError("");
    try {
      const res = await projectApiRequest<SignInResponse>({
        method: "POST", endpoint: "/hub/2fa/verify-login", data: { twoFactorToken, code: value, remember },
      });
      await finishSignIn(res, identifier.trim());
    } catch (err) {
      setTotp("");
      setError(errorMessage(err, "That code didn't work. Wait for a new one and try again."));
    } finally { setBusy(false); }
  };

  const sendResetCode = async () => {
    await projectApiRequest({ method: "POST", endpoint: "/hub/forgot-password", data: { email: resetEmail.trim().toLowerCase(), page: "project" } });
    setResendIn(RESEND_SECONDS);
  };

  const requestReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!EMAIL_RE.test(resetEmail.trim())) return setError("Enter the email on your account.");
    setBusy(true); setError("");
    try { await sendResetCode(); setResetCode(""); go("reset-code"); }
    catch (err) { setError(errorMessage(err, "We couldn't send the code. Try again.")); }
    finally { setBusy(false); }
  };

  const resend = async () => {
    setBusy(true); setError("");
    try { await sendResetCode(); setResetCode(""); }
    catch (err) { setError(errorMessage(err, "We couldn't resend the code.")); }
    finally { setBusy(false); }
  };

  const confirmCode = (value = resetCode) => {
    if (value.length !== 6) return setError("Enter the 6-digit code from your email.");
    go("reset-password");
  };

  const updatePassword = async (e?: React.FormEvent, resetAccountId?: string) => {
    e?.preventDefault();
    if (!passwordOk(newPassword)) return setError("Use at least 8 characters with a number, a capital letter and a symbol.");
    if (newPassword !== confirm) return setError("The two passwords don't match.");
    setBusy(true); setError("");
    try {
      const res = await projectApiRequest({
        method: "POST", endpoint: "/hub/reset-password",
        data: { email: resetEmail.trim().toLowerCase(), code: resetCode, password: newPassword, ...(resetAccountId ? { accountId: resetAccountId } : {}) },
      }) as { hubChoiceRequired?: boolean; hubs?: HubChoice[] } | undefined;
      setResetHubs([]);
      if (res?.hubChoiceRequired && res.hubs?.length) { setResetHubs(res.hubs); return; }
      setNewPassword(""); setConfirm(""); setResetCode("");
      go("reset-done");
    } catch (err) {
      const msg = errorMessage(err, "We couldn't update your password.");
      if (/code|otp|expired/i.test(msg)) { setResetCode(""); setStep("reset-code"); }
      setError(msg);
    } finally { setBusy(false); }
  };

  const back = () => {
    if (step === "signin") return router.push("/studio");
    if (step === "choose-hub") return go("signin");
    if (step === "reset-code") return go("reset-email");
    if (step === "reset-password") return go("reset-code");
    go("signin");
  };

  const isReset = step.startsWith("reset");

  return (
    <AuthShell steps={isReset ? RESET_STEPS : SIGN_IN_STEPS} onBack={back} account="signup">
      {step === "signin" && (
        <form onSubmit={signIn} noValidate className="flex w-full justify-center pt-[20px] lg:pt-[18px]">
          <Card shadow="soft">
            <WalletBanner address={address} onConnect={connect} verified={verified} signing={verifying} wrongWallet={wrongWallet} />
            <ErrorText>{walletNote}</ErrorText>
            <div className="pt-[14px]"><CardTitle>Sign in</CardTitle></div>
            <Field label="Username or email" className="pt-[16px]">
              <TextInput value={identifier} onChange={e => setIdentifier(e.target.value)} autoComplete="username" placeholder="you@project.xyz" />
            </Field>
            <Field label="Password">
              <PasswordInput withShow value={password} onChange={e => setPassword(e.target.value)} autoComplete="current-password" />
            </Field>
            <div className="flex w-full items-center justify-between gap-[12px] pb-[12px] pt-[8px]">
              <label className="flex cursor-pointer items-center gap-[8px] text-[13.5px] leading-[20.925px] text-[#3d485c]">
                <input type="checkbox" checked={remember} onChange={e => setRemember(e.target.checked)} className="size-[16px] accent-[#8a3ffc]" />
                Keep me signed in for 7 days
              </label>
              <TextLink onClick={() => { setResetEmail(identifier.includes("@") ? identifier.trim() : ""); go("reset-email"); }}>Forgot password?</TextLink>
            </div>
            <PrimaryButton type="submit" disabled={busy}>{busy ? "Signing in…" : "Sign in"}</PrimaryButton>
            <ErrorText>{error}</ErrorText>
          </Card>
        </form>
      )}

      {step === "choose-hub" && (
        <div className="flex w-full justify-center pt-[24px] lg:pt-[48px]">
          <Card>
            <CardTitle>Choose a studio</CardTitle>
            <CardText>{hubs.length} studios use these details.</CardText>
            <HubPicker hubs={hubs} busy={busy} onPick={id => signIn(undefined, id)} />
            <ErrorText>{error}</ErrorText>
            <div className="flex w-full justify-center pt-[18px]"><TextLink onClick={() => go("signin")}>Back to sign in</TextLink></div>
          </Card>
        </div>
      )}

      {step === "twofa" && (
        <form onSubmit={e => { e.preventDefault(); verifyTwoFactor(); }} className="flex w-full justify-center pt-[24px] lg:pt-[48px]">
          <Card>
            <div className="pt-[20px]"><CardTitle>Two-step verification</CardTitle></div>
            <div className="w-full pt-[24px]"><GoogleAuthenticatorRow /></div>
            <CodeInput value={totp} onChange={setTotp} onComplete={v => verifyTwoFactor(v)} className="pt-[18px]" />
            <PrimaryButton type="submit" disabled={busy} className="mt-[20px]">{busy ? "Checking…" : "Verify and sign in"}</PrimaryButton>
            <ErrorText>{error}</ErrorText>
            <div className="flex w-full justify-center pt-[18px]"><TextLink onClick={() => go("signin")}>Back to sign in</TextLink></div>
          </Card>
        </form>
      )}

      {step === "reset-email" && (
        <form onSubmit={requestReset} noValidate className="flex w-full justify-center pt-[24px] lg:pt-[56px]">
          <Card>
            <CardTitle>Reset your password</CardTitle>
            <Field label="Email" className="pb-[16px] pt-[24px]">
              <TextInput round="soft" type="email" value={resetEmail} onChange={e => setResetEmail(e.target.value)} placeholder="you@project.xyz" autoComplete="email" />
            </Field>
            <PrimaryButton type="submit" disabled={busy}>{busy ? "Sending…" : "Send code"}</PrimaryButton>
            <ErrorText>{error}</ErrorText>
          </Card>
        </form>
      )}

      {step === "reset-code" && (
        <form onSubmit={e => { e.preventDefault(); confirmCode(); }} className="flex w-full justify-center pt-[24px] lg:pt-[56px]">
          <Card>
            <CardTitle>Check your email</CardTitle>
            <CardText>{resetEmail.trim().toLowerCase()}</CardText>
            <CodeInput value={resetCode} onChange={setResetCode} onComplete={v => confirmCode(v)} />
            <PrimaryButton type="submit" className="mt-[20px]">Verify</PrimaryButton>
            <ErrorText>{error}</ErrorText>
            <div className="flex w-full justify-center pt-[18px] text-[13.5px] leading-[20.925px] text-[#5b6478]">
              {resendIn > 0 ? `Resend code in ${resendIn}s` : <TextLink onClick={resend} disabled={busy}>Resend code</TextLink>}
            </div>
          </Card>
        </form>
      )}

      {step === "reset-password" && (
        <form onSubmit={updatePassword} noValidate className="flex w-full justify-center pt-[24px] lg:pt-[48px]">
          <Card>
            <CardTitle>Choose a new password</CardTitle>
            <Field label="Password" className="pt-[24px]">
              <PasswordInput round="soft" value={newPassword} onChange={e => setNewPassword(e.target.value)} autoComplete="new-password" />
              <StrengthBar password={newPassword} />
            </Field>
            <Field label="Confirm password" className="py-[16px]">
              <PasswordInput round="soft" value={confirm} onChange={e => setConfirm(e.target.value)} autoComplete="new-password" />
              <PasswordMatch password={newPassword} confirm={confirm} />
            </Field>
            {resetHubs.length > 0
              ? <><CardText className="pt-[8px]">Which studio is this password for?</CardText><HubPicker hubs={resetHubs} busy={busy} onPick={id => updatePassword(undefined, id)} /></>
              : <PrimaryButton type="submit" disabled={busy} className="mt-[10px]">{busy ? "Updating…" : "Update password"}</PrimaryButton>}
            <ErrorText>{error}</ErrorText>
          </Card>
        </form>
      )}

      {step === "reset-done" && (
        <div className="flex w-full justify-center pt-[24px] lg:pt-[64px]">
          <Card shadow="softer">
            <CardTitle>Password updated</CardTitle>
            <PrimaryButton type="button" className="mt-[20px]" onClick={() => { setPassword(""); setIdentifier(resetEmail.trim()); go("signin"); }}>Back to sign in</PrimaryButton>
          </Card>
        </div>
      )}
    </AuthShell>
  );
}
