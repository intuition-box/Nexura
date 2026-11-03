"use client";

import { Suspense, useState } from "react";
import Image from "next/image";
import { useRouter, useSearchParams } from "next/navigation";
import { Check, Eye, EyeOff, Loader2 } from "lucide-react";
import AnimatedBackground from "@/components/AnimatedBackground";
import { projectApiRequest, storeProjectSession } from "@/lib/projectApi";
import { userApiRequest } from "@/lib/userApi";
import { storeUserSession } from "@/lib/userSession";
import { useToast } from "@/hooks/use-toast";

function ResetHubPasswordForm() {
  const router = useRouter();
  const { toast } = useToast();

  const queryParams = useSearchParams();
  const isUserHub = (queryParams.get("type") ?? "").toLowerCase() === "user";

  const [email, setEmail] = useState(queryParams.get("email") ?? "");
  const [code, setCode] = useState(queryParams.get("code") ?? "");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [pageError, setPageError] = useState("");

  const hasEmail = (queryParams.get("email") ?? "").length > 0;
  const hasCode = (queryParams.get("code") ?? "").length > 0;

  const pwdChecks = {
    length: password.length >= 8,
    number: /\d/.test(password),
    case: /[a-z]/.test(password) && /[A-Z]/.test(password),
    special: /[^a-zA-Z0-9]/.test(password),
  };
  const allPwdValid = Object.values(pwdChecks).every(Boolean);

  const requirements: [boolean, string][] = [
    [pwdChecks.length, "Least 8 characters"],
    [pwdChecks.number, "Least one number (0-9)"],
    [pwdChecks.case, "Lowercase (a-z) and uppercase (A-Z)"],
    [pwdChecks.special, "Least one special character ($, &, @)"],
  ];

  const handleResetPassword = async () => {
    if (!email || !code) {
      setPageError("Enter the email and the reset code we sent to your inbox.");
      return;
    }

    if (!password || !confirmPassword) {
      toast({ title: "Missing fields", description: "Please fill in both password fields.", variant: "destructive" });
      return;
    }

    if (!allPwdValid) {
      toast({ title: "Weak password", description: "Please meet all password requirements.", variant: "destructive" });
      return;
    }

    if (password !== confirmPassword) {
      toast({ title: "Passwords do not match", description: "Make sure both passwords are the same.", variant: "destructive" });
      return;
    }

    setLoading(true);
    setPageError("");

    try {
      if (isUserHub) {
        const res = await userApiRequest<{
          message?: string;
          accessToken?: string;
          token?: string;
          admin?: { _id: string; name: string; email: string; role?: string; hub?: string };
        }>({
          method: "POST",
          endpoint: "/user-hub/reset-password",
          data: { email, code, password },
        });

        const accessToken = (res.token ?? res.accessToken) as string | undefined;
        if (!accessToken || !res.admin) {
          throw new Error("No access token received");
        }

        storeUserSession({
          token: accessToken,
          type: "user",
          role: res.admin.role ?? "user",
          userId: res.admin._id,
          username: res.admin.name,
          name: res.admin.name,
          email: res.admin.email,
          hub: res.admin.hub,
        });

        toast({ title: "Password updated", description: "Your password has been reset successfully." });
        router.push("/user-dashboard");
        return;
      }

      const res = await projectApiRequest<{
        message?: string;
        accessToken?: string;
        token?: string;
        admin?: { _id: string; name: string; email: string; role: string; hub?: string };
      }>({
        method: "POST",
        endpoint: "/hub/reset-password",
        data: { email, code, password },
      });

      const accessToken = (res.token ?? res.accessToken) as string | undefined;
      if (!accessToken || !res.admin) {
        throw new Error("No access token received");
      }

      storeProjectSession(accessToken, {
        email: res.admin.email,
        name: res.admin.name,
        role: res.admin.role,
        adminId: res.admin._id,
      });

      try {
        const { hub } = await projectApiRequest<{ hub: Record<string, any> }>({
          method: "GET",
          endpoint: "/hub/me",
        });

        storeProjectSession(accessToken, {
          email: res.admin.email,
          name: hub.name ?? res.admin.name ?? res.admin.email,
          logo: hub.logo ?? "",
          role: res.admin.role,
          adminId: res.admin._id,
        });
      } catch {
        // Keep the basic admin session if hub profile fetch fails.
      }

      toast({ title: "Password updated", description: "Your password has been reset successfully." });
      router.push("/studio-dashboard");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Failed to reset password.";
      setPageError(message);
      toast({ title: "Reset failed", description: message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white overflow-auto p-4 sm:p-6 relative flex items-center justify-center font-[family-name:var(--font-geist-sans)]">
      <AnimatedBackground />

      <div className="relative z-10 w-full max-w-[600px] mx-auto py-6">
        <div className="bg-[#27134e] rounded-[20px] shadow-[-12px_-10px_18px_5px_rgba(0,0,0,0.25),12px_10px_18px_5px_rgba(0,0,0,0.25)] px-6 sm:px-[36px] py-[40px] flex flex-col items-center">
          {/* Top Icon Badge */}
          <div className="flex items-center justify-center size-[120px] rounded-[100px] bg-[rgba(139,62,254,0.1)] shadow-[0px_6px_67px_-10px_#7f3ae8]">
            <Image
              src="/activate-studio.png"
              alt=""
              width={120}
              height={120}
              className="size-[120px] object-contain"
              priority
            />
          </div>

          {/* Heading */}
          <h1 className="mt-[16px] text-[24px] font-bold text-white text-center">
            OTP Confirmed
          </h1>

          {/* Subtitle */}
          <p className="mt-[10px] max-w-[404px] text-[16px] font-light text-white text-center leading-snug">
            Your verification code was confirmed successfully.
            <br />
            Create a new password for your account.
          </p>

          {pageError ? (
            <div className="mt-4 w-full rounded-xl border border-red-500/20 bg-red-500/10 px-4 py-3 text-sm text-red-300">
              {pageError}
            </div>
          ) : null}

          {/* Fallback email / code capture — only when missing from the reset link */}
          {(!hasEmail || !hasCode) && (
            <div className="mt-5 w-full flex flex-col gap-3">
              {!hasEmail && (
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="Enter your email..."
                  className="w-full h-[44px] px-4 bg-[rgba(6,2,16,0.5)] border border-[#8a3efe] rounded-[16px] text-white text-[16px] placeholder:text-[rgba(255,255,255,0.4)] focus:outline-none"
                />
              )}
              {!hasCode && (
                <input
                  type="text"
                  inputMode="numeric"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  placeholder="Enter the reset code..."
                  className="w-full h-[44px] px-4 bg-[rgba(6,2,16,0.5)] border border-[#8a3efe] rounded-[16px] text-white text-[16px] tracking-widest placeholder:text-[rgba(255,255,255,0.4)] focus:outline-none"
                />
              )}
            </div>
          )}

          {/* New Password */}
          <div className="mt-[28px] w-full">
            <label className="block text-[18px] font-bold text-white mb-[12px]">New Password</label>
            <div className="relative w-full">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Enter your new password..."
                className="w-full h-[44px] pl-4 pr-[48px] bg-[rgba(6,2,16,0.5)] border border-[#8a3efe] rounded-[16px] text-white text-[16px] font-bold placeholder:text-[rgba(255,255,255,0.4)] placeholder:font-bold focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setShowPassword((current) => !current)}
                className="absolute right-[18px] top-1/2 -translate-y-1/2 text-[rgba(255,255,255,0.6)] hover:text-white transition-colors"
              >
                {showPassword ? <EyeOff className="size-[18px]" /> : <Eye className="size-[18px]" />}
              </button>
            </div>
          </div>

          {/* Password requirements checklist */}
          <div className="mt-[14px] w-full flex flex-col gap-[7px]">
            {requirements.map(([ok, label]) => (
              <div key={label} className="flex items-center gap-[8px] text-[13px] font-bold">
                {ok ? (
                  <Check className="size-[20px] text-[#00e1a2]" strokeWidth={2.5} />
                ) : (
                  <span className="flex size-[20px] items-center justify-center text-[rgba(255,255,255,0.6)]">
                    <span className="size-[4px] rounded-full bg-current" />
                  </span>
                )}
                <span className={ok ? "text-[#00e1a2]" : "text-[rgba(255,255,255,0.6)]"}>{label}</span>
              </div>
            ))}
          </div>

          {/* Confirm New Password */}
          <div className="mt-[24px] w-full">
            <label className="block text-[18px] font-bold text-white mb-[12px]">Confirm New Password</label>
            <div className="relative w-full">
              <input
                type={showConfirmPassword ? "text" : "password"}
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="Confirm your new password..."
                className="w-full h-[44px] pl-4 pr-[48px] bg-[rgba(6,2,16,0.5)] border border-[#8a3efe] rounded-[16px] text-white text-[16px] font-bold placeholder:text-[rgba(255,255,255,0.4)] placeholder:font-bold focus:outline-none"
              />
              <button
                type="button"
                onClick={() => setShowConfirmPassword((current) => !current)}
                className="absolute right-[18px] top-1/2 -translate-y-1/2 text-[rgba(255,255,255,0.6)] hover:text-white transition-colors"
              >
                {showConfirmPassword ? <EyeOff className="size-[18px]" /> : <Eye className="size-[18px]" />}
              </button>
            </div>
          </div>

          {/* Reset Password Button */}
          <button
            onClick={handleResetPassword}
            disabled={loading}
            className="mt-[32px] w-[340px] max-w-full h-[45px] bg-[#8b3efe] hover:bg-[#9b51ff] disabled:bg-[#8b3efe]/50 disabled:cursor-not-allowed text-white text-[16px] font-semibold rounded-[30px] flex items-center justify-center transition-colors"
          >
            {loading ? <Loader2 className="w-5 h-5 animate-spin" /> : "Reset Password"}
          </button>

          <button
            type="button"
            onClick={() => router.push(isUserHub ? "/studio/users/user-signin" : "/studio/sign-in")}
            className="mt-[16px] text-[14px] text-[rgba(255,255,255,0.6)] hover:text-white transition-colors"
          >
            Back to {isUserHub ? "user" : "studio"} sign in
          </button>
        </div>
      </div>
    </div>
  );
}

export default function ResetHubPassword() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-black" />}>
      <ResetHubPasswordForm />
    </Suspense>
  );
}
