"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import AuthShell, { type StepState } from "./AuthShell";
import {
  Card, CardText, CardTitle, CodeInput, ErrorText, Field, PageTitle, PasswordInput, PrimaryButton,
  PasswordMatch, ProfilePictureField, StrengthBar, pictureProblem, TextArea, TextInput, TextLink, WalletBanner, errorMessage, passwordOk,
} from "./AuthUI";
import { useStudioWallet } from "../useStudioWallet";
import { apiRequestV2, getStoredAccessToken } from "@/lib/queryClient";
import { projectApiRequest, storeProjectSession } from "@/lib/projectApi";
import { EMAIL_RE } from "@/lib/email";
import { initialsLogo } from "./initialsLogo";
import CategoryPicker from "./CategoryPicker";

type Step = "account" | "verify" | "project";

const STEP_STATES: Record<Step, [StepState, StepState, StepState]> = {
  account: ["active", "todo", "todo"],
  verify: ["done", "active", "todo"],
  project: ["done", "done", "active"],
};

const RESEND_SECONDS = 60;
const DESCRIPTION_MAX = 300;

export default function SignUpFlow() {
  const router = useRouter();
  const { address, connect, verified, verifying, verify: verifyWallet, token } = useStudioWallet();
  // Set once the account exists, so a retry after a failed hub step doesn't sign up twice
  const account = useRef<{ token: string; hub: string } | null>(null);
  const [step, setStep] = useState<Step>("account");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [code, setCode] = useState("");
  const [projectName, setProjectName] = useState("");
  const [website, setWebsite] = useState("");
  const [description, setDescription] = useState("");
  const [logo, setLogo] = useState<File | null>(null);
  const [categories, setCategories] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [resendIn, setResendIn] = useState(0);

  useEffect(() => {
    if (resendIn <= 0) return;
    const t = setTimeout(() => setResendIn(s => s - 1), 1000);
    return () => clearTimeout(t);
  }, [resendIn]);

  const go = (s: Step) => { setError(""); setStep(s); };
  const cleanEmail = email.trim().toLowerCase();

  const sendCode = async () => {
    await apiRequestV2("POST", `/api/hub-auth/validate-email?email=${encodeURIComponent(cleanEmail)}&name=${encodeURIComponent(username.trim())}&page=project`);
    setResendIn(RESEND_SECONDS);
  };

  const submitAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!address) return setError("Connect your wallet from the top bar to continue.");
    if (username.trim().length < 3) return setError("Your username needs at least 3 characters.");
    if (!EMAIL_RE.test(cleanEmail)) return setError("Enter a valid email address.");
    if (!passwordOk(password)) return setError("Use at least 8 characters with a number, a capital letter and a symbol.");
    if (password !== confirm) return setError("The two passwords don't match.");
    setBusy(true); setError("");
    try {
      await sendCode();
      go("verify");
    } catch (err) {
      setError(errorMessage(err, "We couldn't send the code. Try again."));
    } finally { setBusy(false); }
  };

  const verify = async (value = code) => {
    if (busy) return;
    if (value.length !== 6) return setError("Enter the 6-digit code from your email.");
    setBusy(true); setError("");
    try {
      await apiRequestV2("POST", "/api/auth/confirm-hub-email-validation", { code: value, email: cleanEmail });
      go("project");
    } catch (err) {
      setError(errorMessage(err, "That code didn't work. Check it and try again."));
    } finally { setBusy(false); }
  };

  const resend = async () => {
    setBusy(true); setError("");
    try { await sendCode(); setCode(""); }
    catch (err) { setError(errorMessage(err, "We couldn't resend the code.")); }
    finally { setBusy(false); }
  };

  const createStudio = async (e: React.FormEvent) => {
    e.preventDefault();
    const name = projectName.trim();
    const about = description.trim();
    if (!categories.length) return setError("Pick at least one category.");
    if (!name) return setError("Add your project name.");
    if (about.length > DESCRIPTION_MAX) return setError(`Keep your description under ${DESCRIPTION_MAX} characters.`);
    if (busy) return;
    if (!address) { setError("Connect your wallet from the top bar to continue."); connect(); return; }
    setBusy(true); setError("");
    try {
      if (!account.current) {
        // The wallet signed here becomes the only one that can sign in to this studio
        const walletToken = token ?? (await verifyWallet());
        if (!walletToken) { setError("Sign the message in your wallet to verify it."); return; }
        const res = await projectApiRequest<{ accessToken?: string; admin?: { _id: string; name: string; email: string; role: string; hub: string } }>({
          method: "POST", endpoint: "/hub/sign-up",
          data: {
            name: username.trim(), email: cleanEmail, password, authToken: getStoredAccessToken(),
            walletToken,
          },
        });
        if (!res.accessToken) throw new Error("Your account was created, but signing in failed. Sign in to continue.");
        account.current = { token: res.accessToken, hub: res.admin?.hub || "" };
        storeProjectSession(res.accessToken, {
          email: res.admin?.email || cleanEmail, name: res.admin?.name || username.trim(),
          role: res.admin?.role || "superadmin", adminId: res.admin?._id || "", hub: res.admin?.hub || "", walletAddress: address ?? "",
        });
      }

      const fd = new FormData();
      fd.append("name", name);
      fd.append("description", about);
      fd.append("categories", JSON.stringify(categories));
      if (website.trim()) fd.append("website", website.trim());
      // No picture chosen: a logo from the project's initials
      if (logo) fd.append("logo", logo, logo.name);
      else fd.append("logo", await initialsLogo(name), "logo.png");
      await projectApiRequest({ method: "POST", endpoint: "/hub/create-hub", formData: fd });

      router.push("/studio-dashboard/hub-profile?welcome=1");
    } catch (err) {
      setError(errorMessage(err, "We couldn't create your studio. Try again."));
    } finally { setBusy(false); }
  };

  const back = () => {
    if (step === "project") return go("verify");
    if (step === "verify") return go("account");
    router.push("/studio");
  };

  return (
    <AuthShell steps={STEP_STATES[step]} onBack={back} account="signin">
      {step === "account" && (
        <form onSubmit={submitAccount} noValidate className="flex w-full max-w-[500px] flex-col items-start pb-[24px] pt-[4px]">
          <WalletBanner address={address} onConnect={connect} verified={verified} signing={verifying} onSign={() => void verifyWallet()} />
          <PageTitle title="Create your account" />
          <Field label="Username" className="pt-[18px]">
            <TextInput value={username} onChange={e => setUsername(e.target.value)} placeholder="e.g. studio_lead" autoComplete="username" />
          </Field>
          <Field label="Email">
            <TextInput type="email" value={email} onChange={e => setEmail(e.target.value)} placeholder="you@project.xyz" autoComplete="email" />
          </Field>
          <Field label="Password">
            <PasswordInput value={password} onChange={e => setPassword(e.target.value)} autoComplete="new-password" />
            <StrengthBar password={password} />
          </Field>
          <Field label="Confirm password" className="py-[16px]">
            <PasswordInput value={confirm} onChange={e => setConfirm(e.target.value)} autoComplete="new-password" />
            <PasswordMatch password={password} confirm={confirm} />
          </Field>
          <PrimaryButton type="submit" disabled={busy}>{busy ? "Sending code…" : "Continue"}</PrimaryButton>
          <ErrorText>{error}</ErrorText>
        </form>
      )}

      {step === "verify" && (
        <form onSubmit={e => { e.preventDefault(); verify(); }} className="flex w-full justify-center pt-[24px] lg:pt-[48px]">
          <Card className="gap-[12px]">
            <div className="pt-[20px]"><CardTitle>Check your email</CardTitle></div>
            <CardText className="pt-0"><b className="font-bold">{cleanEmail}</b></CardText>
            <CodeInput value={code} onChange={setCode} onComplete={v => verify(v)} />
            <PrimaryButton type="submit" disabled={busy}>{busy ? "Checking…" : "Verify"}</PrimaryButton>
            <ErrorText>{error}</ErrorText>
            <div className="flex w-full justify-center pt-[18px] text-[13.5px] leading-[20.925px] text-[#5b6478]">
              {resendIn > 0 ? `Resend code in ${resendIn}s` : <TextLink onClick={resend} disabled={busy}>Resend code</TextLink>}
            </div>
          </Card>
        </form>
      )}

      {step === "project" && (
        <form onSubmit={createStudio} noValidate className="flex w-full max-w-[500px] flex-col items-start pb-[24px] pt-[4px]">
          <WalletBanner address={address} onConnect={connect} verified={verified} signing={verifying} onSign={() => void verifyWallet()} />
          <PageTitle title="Your project" />
          <div className="w-full pt-[18px]">
            <ProfilePictureField file={logo} onChange={f => { const problem = pictureProblem(f); setError(problem ?? ""); if (!problem) setLogo(f); }} />
          </div>
          <CategoryPicker value={categories} onChange={setCategories} />
          <Field label="Project name">
            <TextInput value={projectName} onChange={e => setProjectName(e.target.value)} placeholder="e.g. Intuition Labs" />
          </Field>
          <Field label="Project Website">
            <TextInput type="url" value={website} onChange={e => setWebsite(e.target.value)} placeholder="https://" />
          </Field>
          <Field label="Short description" className="py-[16px]">
            <TextArea value={description} onChange={e => setDescription(e.target.value)} maxLength={DESCRIPTION_MAX} />
          </Field>
          <PrimaryButton type="submit" disabled={busy}>{busy ? "Creating your studio…" : "Create my studio"}</PrimaryButton>
          <ErrorText>{error}</ErrorText>
        </form>
      )}
    </AuthShell>
  );
}
