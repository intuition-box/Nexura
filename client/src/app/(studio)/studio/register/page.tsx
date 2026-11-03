"use client";

import React, { useState, useMemo } from "react";
import Link from "next/link";
import AnimatedBackground from "@/components/AnimatedBackground";
import { Card, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ArrowRight, Eye, EyeOff, ShieldCheck, Check, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { projectApiRequest, storeProjectSession } from "@/lib/projectApi";
import { useToast } from "@/hooks/use-toast";

export default function AdminSignUp() {
  const [name, setName] = useState("");
  const emailFromUrl = useMemo(() => {
    const params = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
    return params.get("email") ?? "";
  }, []);
  const [email, setEmail] = useState(emailFromUrl);
  const [password, setPassword] = useState("");
  // Invite links shared by hand carry the access code too
  const [code, setCode] = useState(() =>
    typeof window !== "undefined" ? (new URLSearchParams(window.location.search).get("code") ?? "").slice(0, 6) : "");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  const pwdChecks = {
    length:  password.length >= 8,
    number:  /\d/.test(password),
    special: /[^a-zA-Z0-9]/.test(password),
    upper:   /[A-Z]/.test(password),
  };
  const allPwdValid = Object.values(pwdChecks).every(Boolean);
  const canSubmit = allPwdValid && !!name && !!email && !loading && code.length === 6;

  async function handleSignUp() {
    if (!name || !email || !password || !code) {
      toast({
        title: "Missing fields",
        description: "Please fill in all fields.",
        variant: "destructive",
      });
      return;
    }

    if (code.length !== 6) {
      toast({
        title: "Invalid code",
        description: "The OTP code must be exactly 6 characters.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);
    try {
      const res = await projectApiRequest<{
        message?: string;
        accessToken?: string;
        token?: string;
        admin?: { _id: string; name: string; email: string; role: string; hub?: string };
      }>({
        method: "POST",
        endpoint: "/hub/admin/sign-up",
        data: { name, email, password, code },
      });

      const token = (res.token ?? res.accessToken) as string | undefined;
      if (!token) throw new Error("No access token received");

      storeProjectSession(token, { email, name, role: res.admin?.role ?? "admin", adminId: res.admin?._id ?? "" });
      toast({
        title: "Account created!",
        description: "Welcome to Nexura Studio. You now have admin access.",
      });
      router.push("/studio-dashboard");
    } catch (err: unknown) {
      const msg =
        err instanceof Error ? err.message : "Sign up failed. Check your details and try again.";
      toast({ title: "Sign up failed", description: msg, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="relative min-h-screen flex items-center justify-center px-4">
      <AnimatedBackground />

      <Card className="relative z-10 w-full max-w-md bg-black/60 border border-white/10 backdrop-blur-xl p-8 rounded-2xl shadow-2xl">
        {/* Icon + heading */}
        <div className="flex flex-col items-center mb-8">
          <div className="flex h-14 w-14 items-center justify-center rounded-full bg-purple-600/20 border border-purple-500/30 mb-4">
            <ShieldCheck className="h-7 w-7 text-purple-400" />
          </div>
          <CardTitle className="text-2xl font-bold text-white text-center">
            Admin Account Setup
          </CardTitle>
          <p className="mt-2 text-sm text-white/50 text-center">
            You've been invited to manage a project on Nexura Studio.
            <br />
            Enter the OTP from your invitation email to complete setup.
          </p>
        </div>

        {/* Form */}
        <div className="space-y-4">
          {/* Name */}
          <div>
            <label className="block text-xs text-white/50 mb-1 ml-1">Full Name</label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Your full name"
              className="bg-white/5 border-white/10 text-white placeholder:text-white/30 focus:border-purple-500"
            />
          </div>

          {/* Email */}
          <div>
            <label className="block text-xs text-white/50 mb-1 ml-1">Email Address</label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="you@example.com"
              readOnly={!!emailFromUrl}
              className={`bg-white/5 border-white/10 text-white placeholder:text-white/30 focus:border-purple-500 ${
                emailFromUrl ? "opacity-60 cursor-not-allowed select-none" : ""
              }`}
            />
            {emailFromUrl && (
              <p className="mt-1 ml-1 text-xs text-white/30">Pre-filled from your invitation link</p>
            )}
          </div>

          {/* Password */}
          <div>
            <label className="block text-xs text-white/50 mb-1 ml-1">Password</label>
            <div className="relative">
              <Input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Create a password"
                className="bg-white/5 border-white/10 text-white placeholder:text-white/30 focus:border-purple-500 pr-10"
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-white/40 hover:text-white/70 transition-colors"
              >
                {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
              </button>
            </div>
            {/* Password checklist */}
            {password.length > 0 && (
              <ul className="mt-2 space-y-1">
                {([
                  [pwdChecks.length,  "At least 8 characters"],
                  [pwdChecks.upper,   "At least one uppercase letter"],
                  [pwdChecks.number,  "At least one number"],
                  [pwdChecks.special, "At least one special character"],
                ] as [boolean, string][]).map(([ok, label]) => (
                  <li key={label} className={`flex items-center gap-1.5 text-xs ${ok ? "text-emerald-400" : "text-white/40"}`}>
                    {ok ? <Check className="h-3 w-3" /> : <X className="h-3 w-3" />}
                    {label}
                  </li>
                ))}
              </ul>
            )}
          </div>

          {/* OTP */}
          <div>
            <label className="block text-xs text-white/50 mb-1 ml-1">Invitation Code (OTP)</label>
            <Input
              value={code}
              onChange={(e) => setCode(e.target.value.trim())}
              placeholder="6-character code from your email"
              maxLength={6}
              className="bg-white/5 border-white/10 text-white placeholder:text-white/30 focus:border-purple-500 tracking-widest text-center text-lg font-mono"
            />
          </div>
        </div>

        {/* Submit */}
        <Button
          onClick={handleSignUp}
          disabled={!canSubmit}
          className="mt-6 w-full border border-white/80 text-white bg-transparent hover:bg-[#8B3EFE] hover:border-[#8B3EFE] transition-all py-2.5 rounded-xl flex items-center justify-center gap-2 disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-transparent disabled:hover:border-white/80"
        >
          {loading ? (
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
          ) : (
            <>
              Complete Setup
              <ArrowRight className="h-4 w-4" />
            </>
          )}
        </Button>

        <p className="mt-4 text-center text-xs text-white/30">
          Already have access?{" "}
          <Link href="/studio/sign-in" className="text-purple-400 hover:underline">
            Sign in
          </Link>
        </p>
      </Card>
    </div>
  );
}


