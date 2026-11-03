"use client";

import React, { useState } from "react";
import AnimatedBackground from "@/components/AnimatedBackground";
import { Card, CardTitle, CardDescription } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { projectApiRequest, storeProjectSession, getStoredProjectToken, getStoredProjectInfo, base64ToBlob } from "@/lib/projectApi";
import { useToast } from "@/hooks/use-toast";
import { Globe, Twitter } from "lucide-react";
import { setStudioDiscordReturnPath } from "@/lib/studioDiscord";

export default function TheHub() {
  const [hubName, setHubName] = useState("");
  const [description, setDescription] = useState("");
  const [website, setWebsite] = useState("");
  const [xAccount, setXAccount] = useState("");
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();
  const { toast } = useToast();

  const handleImageChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      setImageFile(file);
      setImagePreview(reader.result as string); // Base64 string
    };
    reader.readAsDataURL(file);
  };


  const handleSubmit = async () => {
    console.log("[ACTION] CreateHub.handleSubmit — create project hub");
    if (!hubName.trim()) {
      toast({ title: "Missing Project Name", description: "Please enter a project name.", variant: "destructive" });
      return;
    }

    if (description.length > 300) {
      toast({ title: "Description invalid", description: "Keep it under 300 characters.", variant: "destructive" });
      return;
    }

    if (!imageFile) {
      toast({ title: "Missing Logo", description: "Please upload a project logo.", variant: "destructive" });
      return;
    }

    setLoading(true);
    try {
      const fd = new FormData();
      fd.append("name", hubName.trim());
      fd.append("description", description ?? "");
      fd.append("website", website.trim());
      fd.append("xAccount", xAccount.trim());

      if (imagePreview) {
        const blob = base64ToBlob(imagePreview);
        fd.append("logo", blob, "logo.png");
      }

      await projectApiRequest({ method: "POST", endpoint: `/hub/create-hub`, formData: fd });

      // Update stored project session with hub name and logo
      const token = getStoredProjectToken();
      const existingInfo = getStoredProjectInfo() ?? {};
      if (token) {
        storeProjectSession(token, {
          ...existingInfo,
          name: hubName.trim(),
          logo: imagePreview ?? "",
        });
      }

      setStudioDiscordReturnPath("/studio-dashboard");
      router.push("/studio-dashboard/connect-discord");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Sign-up failed. Please try again.";
      toast({ title: "Sign up failed", description: msg, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };


  return (
    <div className="min-h-screen bg-black text-white p-4 sm:p-6 relative">
      <AnimatedBackground />

      <div className="max-w-xl mx-auto relative z-10 space-y-6">

        {/* Page Header */}
        <div className="text-center space-y-2">
          <h1 className="text-2xl sm:text-3xl font-bold">
            Welcome to Nexura Studio
          </h1>
          <p className="text-white/60 max-w-2xl mx-auto">
            Set up a dedicated project space for your project or community on Nexura
          </p>
        </div>

        {/* Main Container */}
        <Card className="bg-gray-900 border-2 border-purple-500 rounded-3xl p-5 sm:p-6 space-y-5">

          {/* Intro */}
          <div>
            <CardTitle className="text-xl">
              You are ...
            </CardTitle>
          </div>

          {/* Horizontal Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-6">
            <Card className="bg-gray-800 border border-purple-500 rounded-2xl p-6 flex flex-col items-center justify-center text-center gap-3">
              <img
                src="/project-icon.png"
                alt="Project icon"
                className="w-10 h-10"
              />

              <CardTitle className="text-lg">
                a project or builder
              </CardTitle>

              <CardDescription className="text-white/60 max-w-xs">
                Perfect for building a centralized project space for your dApp or protocol
              </CardDescription>
            </Card>


            <Card className="relative bg-gray-800 border border-purple-500 rounded-2xl p-6 overflow-hidden">

              {/* Blurred content */}
              <div className="flex flex-col items-center justify-center text-center gap-3 blur-sm select-none">
                <img
                  src="/members.png"
                  alt="Engagement icon"
                  className="w-10 h-10"
                />

                <CardTitle className="text-lg">
                  Community Access
                </CardTitle>

                <CardDescription className="text-white/60 max-w-xs">
                  Allow your team and community to collaborate securely.
                </CardDescription>
              </div>

              {/* Overlay */}
              <div className="absolute inset-0 flex items-center justify-center">
                <span className="text-white font-semibold text-lg tracking-wide">
                  Coming Soon
                </span>
              </div>
            </Card>
          </div>

          {/* Name */}
          <div className="space-y-2">
            <CardTitle className="text-lg">Project Name</CardTitle>
            <Input
              value={hubName}
              onChange={(e) => setHubName(e.target.value.toUpperCase())}
              placeholder="Enter your Project Name..."
              className="bg-gray-800 border-purple-500 text-white"
            />
          </div>

          {/* Description */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <CardTitle className="text-lg">Description</CardTitle>
              <span className={`text-xs ${description.length > 300 ? "text-red-400" : "text-white/40"}`}>
                {description.length}/300
              </span>
            </div>
            <Textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Describe your project or community (up to 300 characters)"
              maxLength={300}
              className="bg-gray-800 border-purple-500 text-white resize-none h-32"
            />
          </div>

          {/* Optional Social Info */}
          <div className="space-y-3">
            <CardTitle className="text-lg">Project Links (Optional)</CardTitle>
            <div className="relative">
              <Globe className="w-4 h-4 text-white/50 absolute left-3 top-1/2 -translate-y-1/2" />
              <Input
                value={website}
                onChange={(e) => setWebsite(e.target.value)}
                placeholder="Project website (e.g. https://example.com)"
                className="bg-gray-800 border-purple-500 text-white pl-10"
              />
            </div>
            <div className="relative">
              <Twitter className="w-4 h-4 text-white/50 absolute left-3 top-1/2 -translate-y-1/2" />
              <Input
                value={xAccount}
                onChange={(e) => setXAccount(e.target.value)}
                placeholder="X account (e.g. @myproject or https://x.com/myproject)"
                className="bg-gray-800 border-purple-500 text-white pl-10"
              />
            </div>
            <p className="text-xs text-white/50">
              Discord server is now set through Discord connection after this step.
            </p>
          </div>

          {/* Logo Upload */}
          <div className="space-y-3 w-full">
            <CardTitle className="text-lg text-center">Project Logo</CardTitle>

            <label className="w-full border-2 border-dashed border-purple-500 rounded-2xl p-8 bg-black hover:border-[#8B3EFE] transition cursor-pointer block">
              <input
                type="file"
                accept="image/*"
                onChange={handleImageChange}
                className="hidden"
              />

              {imagePreview ? (
                <div className="flex flex-col items-center gap-3">
                  <img
                    src={imagePreview}
                    alt="Preview"
                    className="w-32 h-32 object-cover rounded-xl"
                  />
                  <p className="text-sm text-white/60">Click to change image</p>
                </div>
              ) : (
                <div className="flex flex-col items-center justify-center text-center gap-2 text-white/60">
                  <img
                    src="/upload-icon.png"
                    alt="Upload icon"
                    className="w-16 h-16"
                  />
                  <p className="font-medium text-white">
                    Click to upload or drag and drop
                  </p>
                  <p className="text-sm text-white/50">
                    SVG, PNG, JPG or GIF (max. 10MB)
                  </p>
                </div>
              )}
            </label>
          </div>

          {/* Action */}
          <div className="pt-4">
            <Button
              className="w-full bg-[#8B3EFE] border-0 text-white hover:bg-[#8B3EFE] hover:shadow-[0_0_28px_rgba(131,58,253,0.7)] hover:scale-[1.02] active:scale-[0.98] transition-all duration-200"
              onClick={handleSubmit}
              disabled={loading}
            >
              {loading ? "Creating Project..." : "Create Project"}
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}


