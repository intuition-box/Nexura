"use client";

import React, { useState } from "react";
import AnimatedBackground from "@/components/AnimatedBackground";
import { CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Globe, Twitter } from "lucide-react";
import { useRouter } from "next/navigation";
import { projectApiRequest, base64ToBlob } from "@/lib/projectApi";
import { useToast } from "@/hooks/use-toast";

export default function ProjectsHub() {
  const router = useRouter();
  const { toast } = useToast();
  const [hubName, setHubName] = useState("");
  const [description, setDescription] = useState("");
  const [website, setWebsite] = useState("");
  const [xAccount, setXAccount] = useState("");
  const [imagePreview, setImagePreview] = useState("");
  const [loading, setLoading] = useState(false);

  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => setImagePreview(reader.result as string);
    reader.readAsDataURL(file);
  };

  const handleSubmit = async () => {
    console.log("[ACTION] ProjectsHub.handleSubmit — create/save project");
    if (!hubName.trim()) {
      toast({ title: "Missing fields", description: "Please enter a project name.", variant: "destructive" });
      return;
    }

    setLoading(true);

    try {
      const fd = new FormData();
      fd.append("name", hubName.trim());
      fd.append("description", description || "");
      fd.append("website", website || "");
      fd.append("x", xAccount || "");
      if (imagePreview) {
        fd.append("logo", base64ToBlob(imagePreview));
      }

      await projectApiRequest({
        method: "POST",
        endpoint: "/hub/create-hub",
        formData: fd,
      });

      toast({ title: "Project Hub created!", description: "Your project hub has been created successfully." });

      router.push("/connect-discord");
    } catch (err: any) {
      toast({ title: "Creation failed", description: err.message, variant: "destructive" });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white p-4 sm:p-6 relative">
      <AnimatedBackground />

      {/* Back Button */}
      <div className="w-full flex justify-start mb-4 relative z-10">
        <button
          onClick={() => router.push("/studio/select-role")}
          className="inline-flex items-center gap-2 px-3 py-2 rounded-full border border-white/30 bg-black/30 hover:bg-black/50 text-white text-xs sm:text-sm"
        >
          <ArrowLeft className="w-3.5 h-3.5" />
          Back to Studio
        </button>
      </div>

      <div className="max-w-xl mx-auto relative z-10 space-y-6 bg-white/[0.03] border border-[#A760FF] rounded-2xl p-6">

        <CardTitle className="text-lg">Create Project Hub</CardTitle>

        <div className="space-y-2">
          <CardTitle className="text-xs">Project Name</CardTitle>
          <Input
            value={hubName}
            onChange={(e) => setHubName(e.target.value)}
            placeholder="Enter your Project Name..."
            className="bg-gray-800 border-purple-500 text-white"
          />
        </div>

        <div className="space-y-2">
          <CardTitle className="text-xs">Description</CardTitle>
          <Textarea
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe your project (up to 300 characters)"
            maxLength={300}
            className="bg-gray-800 border-purple-500 text-white h-32"
          />
        </div>

        <div className="space-y-3">
          <CardTitle className="text-xs">Project Links</CardTitle>

          <div className="relative">
            <Globe className="w-4 h-4 text-white/50 absolute left-3 top-1/2 -translate-y-1/2" />
            <Input
              value={website}
              onChange={(e) => setWebsite(e.target.value)}
              placeholder="Website"
              className="bg-gray-800 border-purple-500 text-white pl-10"
            />
          </div>

          <div className="relative">
            <Twitter className="w-4 h-4 text-white/50 absolute left-3 top-1/2 -translate-y-1/2" />
            <Input
              value={xAccount}
              onChange={(e) => setXAccount(e.target.value)}
              placeholder="X account"
              className="bg-gray-800 border-purple-500 text-white pl-10"
            />
          </div>
        </div>

        <div className="space-y-3">
          <CardTitle className="text-xs text-center">Project Logo</CardTitle>

          <label className="w-full border-2 border-dashed border-purple-500 rounded-2xl p-8 bg-black cursor-pointer block">
            <input type="file" accept="image/*" onChange={handleImageChange} className="hidden" />

            {imagePreview ? (
              <img src={imagePreview} className="w-32 h-32 mx-auto rounded-xl" />
            ) : (
              <p className="text-center text-white/60">Upload logo</p>
            )}
          </label>
        </div>

        <Button
          onClick={handleSubmit}
          disabled={loading}
          className="w-full bg-[#8B3EFE]"
        >
          {loading ? "Creating..." : "Create Project"}
        </Button>

      </div>
    </div>
  );
}
