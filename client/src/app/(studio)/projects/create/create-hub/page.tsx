"use client";

import React, { useState, useEffect } from "react";
import AnimatedBackground from "@/components/AnimatedBackground";
import { Card, CardTitle, CardDescription, CardFooter } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { Eye, EyeOff } from "lucide-react";
import { useRouter } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import { useWallet } from "@/hooks/use-wallet";
import OTPModal from "@/components/studio/OTPModal";
import { apiRequestV2 } from "@/lib/queryClient";

export default function SharedAccessCredentials() {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [hasUppercase, setHasUppercase] = useState(false);
  const [hasNumber, setHasNumber] = useState(false);
  const [hasSpecialChar, setHasSpecialChar] = useState(false);
  const [isLongEnough, setIsLongEnough] = useState(false);
  const [creating, setCreating] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isOTPModalOpen, setIsOTPModalOpen] = useState(false);
  const router = useRouter();
  const { toast } = useToast();
  const { address: walletAddress, isConnected } = useWallet();

  // Track step -- only during creation flow (not if already signed in)
  useEffect(() => {
    const hasFullSession =
      !!localStorage.getItem("nexura-project:token") ||
      !!localStorage.getItem("nexura:proj-token");
    if (!hasFullSession) {
      localStorage.setItem("nexura:studio-step", "/projects/create/create-hub");
    }
  }, []);

  // Autofill wallet address when wallet is connected
  useEffect(() => {
    if (walletAddress) setAddress(walletAddress);
  }, [walletAddress]);

  async function handleSignUp() {
    try {
      if (!isLongEnough || !hasUppercase || !hasNumber || !hasSpecialChar) {
        toast({ title: "Weak password", description: "Password does not meet all requirements.", variant: "destructive" });
        return;
      }

      if (password !== confirmPassword) {
        toast({ title: "Password mismatch", description: "Passwords do not match.", variant: "destructive" });
        return;
      }
      if (!email) {
        toast({ title: "Missing email", description: "Please enter an email address.", variant: "destructive" });
        return;
      }
      if (!address) {
        toast({ title: "Missing address", description: "Please enter your project wallet address.", variant: "destructive" });
        return;
      }
      if (!name) {
        toast({ title: "Missing name", description: "Please enter a name.", variant: "destructive" });
        return;
      }

      setCreating(true);

      // Send OTP
      await apiRequestV2("POST", `/api/hub-auth/validate-email?email=${encodeURIComponent(email)}&name=${encodeURIComponent(name)}&page=project`);

      sessionStorage.setItem("nexura:pending-signup", JSON.stringify({
        email,
        password,
        name,
        page: "project",
        walletAddress: address
      }));

      setIsOTPModalOpen(true);
      } catch (error: any) {
      console.error(error);
      setCreating(false);
      const msg: string = error?.message || "Failed to sign up.";
      if (msg.toLowerCase().includes("already exists")) {
        toast({ title: "Account already exists", description: "Redirecting you to sign in.", variant: "destructive" });
        setTimeout(() => router.push("/studio/sign-in"), 1500);
      } else {
        toast({ title: "Error", description: msg, variant: "destructive" });
      }
    }
  }

  return (
    <div className="min-h-screen bg-black text-white overflow-auto p-4 sm:p-6 relative">
      <AnimatedBackground />

      <div className="max-w-md mx-auto relative z-10 space-y-6">
          {/* Header */}
          <div className="text-center py-4 sm:py-6 px-2 sm:px-0">
            <h1 className="text-xl sm:text-2xl font-bold text-white mb-2">
              Shared Access Credentials
            </h1>
            <p className="text-sm sm:text-base text-white/60 leading-relaxed">
              Set up credentials that will allow your team members to access your project on Nexura Studio
            </p>
          </div>

          {/* Credentials Card */}
          <Card className="border-2 border-purple-500 rounded-3xl p-6 space-y-6 bg-gray-900">
            <div className="space-y-6">
              {/* name */}
              <div>
                <CardTitle className="text-white text-lg sm:text-xl">Super Admin Name</CardTitle>
                <Input
                  type="text"
                  placeholder="Enter super admin name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  className="mt-2 w-full rounded-lg bg-gray-800 text-white border-purple-500"
                />
              </div>

              {/* Email */}
              <div>
                <CardTitle className="text-white text-lg sm:text-xl">Email Address</CardTitle>
                <Input
                  type="email"
                  placeholder="Enter email address"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="mt-2 w-full rounded-lg bg-gray-800 text-white border-purple-500"
                />
              </div>

              {/* Wallet Address */}
              <div>
                <CardTitle className="text-white text-lg sm:text-xl">Project Wallet Address</CardTitle>
                <Input
                  type="text"
                  placeholder="0x..."
                  value={address}
                  onChange={(e) => !isConnected && setAddress(e.target.value)}
                  readOnly={isConnected}
                  className={`mt-2 w-full rounded-lg bg-gray-800 text-white border-purple-500 ${isConnected ? "opacity-70 cursor-not-allowed select-none font-mono text-sm" : ""
                    }`}
                />
                {isConnected && (
                  <p className="mt-1 ml-1 text-xs text-white/30">Auto-filled from connected wallet</p>
                )}
              </div>

              {/* Password */}
              <div>
                <CardTitle className="text-white text-lg sm:text-xl">Password</CardTitle>
                <div className="relative mt-2">
                  <Input
                    type={showPassword ? "text" : "password"}
                    placeholder="*   *   *   *   *   *   *   *"
                    value={password}
                    onChange={(e) => {
                      const value = e.target.value;
                      setPassword(value);
                      setHasUppercase(/[A-Z]/.test(value));
                      setHasNumber(/\d/.test(value));
                      setHasSpecialChar(/[!@#$%^&*()_+[\]{};':"\\|,.<>/?]/.test(value));
                      setIsLongEnough(value.length >= 8);
                    }}
                    className="w-full rounded-lg bg-gray-800 text-white border-purple-500 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2 top-2 text-gray-400 hover:text-white"
                  >
                    {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>

                <div className="mt-2 space-y-1 rounded-2xl bg-gray-800/60 p-3 text-xs">
                  <p className={isLongEnough ? "text-green-400" : "text-red-400"}>&#8226; At least 8 characters</p>
                  <p className={hasUppercase ? "text-green-400" : "text-red-400"}>&#8226; 1 uppercase letter</p>
                  <p className={hasNumber ? "text-green-400" : "text-red-400"}>&#8226; 1 number</p>
                  <p className={hasSpecialChar ? "text-green-400" : "text-red-400"}>&#8226; 1 special character</p>
                </div>
              </div>

              {/* Confirm Password */}
              <div className="relative">
                <CardTitle className="text-white text-lg sm:text-xl">Confirm Password</CardTitle>
                <div className="relative mt-2">
                  <Input
                    type={showConfirmPassword ? "text" : "password"}
                    placeholder="*   *   *   *   *   *   *   *"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    className="w-full rounded-lg bg-gray-800 text-white border-purple-500 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-2 top-2 text-gray-400 hover:text-white"
                  >
                    {showConfirmPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                  </button>
                </div>
              </div>

              {/* Disclaimer */}
              <div className="flex items-start gap-3 bg-gray-800 p-4 rounded-2xl mt-2">
                <div className="flex-shrink-0 text-blue-400 mt-0.5">
                  <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M12 20.5a8.5 8.5 0 110-17 8.5 8.5 0 010 17z" />
                  </svg>
                </div>
                <CardDescription className="text-white/60 text-xs">
                  Disclaimer: Anyone with these credentials can manage your campaign and project settings.
                </CardDescription>
              </div>
            </div>

            <CardFooter className="pt-2">
              <Button
                disabled={creating}
                onClick={handleSignUp}
                className="w-full rounded-full bg-[#8B3EFE] border-0 text-white hover:bg-[#8B3EFE] hover:shadow-[0_0_28px_rgba(131,58,253,0.7)] hover:scale-[1.02] active:scale-[0.98] transition-all duration-200 flex items-center justify-center gap-2"
              >
                {creating ? "Creating Super Admin..." : "Create Super Admin"}
                <ArrowRight className="h-5 w-5" />
              </Button>
            </CardFooter>
          </Card>
      </div>

      <OTPModal
        isOpen={isOTPModalOpen}
        onClose={() => setIsOTPModalOpen(false)}
        email={email}
        page="project"
      />
    </div>
  );
}


