"use client";

import { useEffect, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { projectApiRequest } from "@/lib/projectApi";
import { Trash2, Plus, Edit, Send, Loader2, RefreshCw } from "lucide-react";
import { getStoredUserSession } from "@/lib/userSession";

interface Lesson {
  _id: string;
  title: string;
  description: string;
  reward: number;
  noOfQuestions: number;
  status: "draft" | "published";
  coverImage?: string;
}

export default function Lessons() {
  /*
  const pathname = usePathname();
  const router = useRouter();
  const isUserDashboard = pathname.startsWith("/user-dashboard");
  const apiBase = isUserDashboard ? "/user-hub" : "/hub";
  const createLessonUrl = isUserDashboard ? "/user-dashboard/create-lesson" : "/studio-dashboard/create-lesson";

  const [lessons, setLessons] = useState<Lesson[]>([]);
  const [loading, setLoading] = useState(true);
  const [publishingId, setPublishingId] = useState("");
  const { toast } = useToast();

  useEffect(() => {
    fetchLessons();
  }, []);

  const fetchLessons = async () => {
    try {
      setLoading(true);
      const res = await projectApiRequest<{ lessons?: Lesson[] }>({
        method: "GET",
        endpoint: `${apiBase}/get-lessons`,
      });
      setLessons(res.lessons ?? []);
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to load lessons.",
      });
    } finally {
      setLoading(false);
    }
  };

  const togglePublish = async (lesson: Lesson) => {
    const target = lesson.status === "published" ? "draft" : "published";
    const endpoint = target === "published" ? `${apiBase}/publish-lesson` : `${apiBase}/unpublish-lesson`;
    
    try {
      setPublishingId(lesson._id);
      await projectApiRequest({
        method: "PATCH",
        endpoint,
        data: { lessonId: lesson._id },
      });
      
      setLessons(prev => prev.map(l => 
        l._id === lesson._id ? { ...l, status: target } : l
      ));
      
      toast({
        title: target === "published" ? "Lesson Published" : "Lesson Unpublished",
        description: `"${lesson.title}" is now ${target}.`,
      });
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to update status.",
      });
    } finally {
      setPublishingId("");
    }
  };

  const deleteLesson = async (lesson: Lesson) => {
    if (!confirm(`Are you sure you want to delete "${lesson.title}"? This cannot be undone.`)) {
      return;
    }

    try {
      await projectApiRequest({
        method: "DELETE",
        endpoint: `${apiBase}/delete-lesson?id=${lesson._id}`,
      });
      setLessons(prev => prev.filter(l => l._id !== lesson._id));
      toast({
        title: "Lesson deleted",
        description: "The lesson has been removed successfully.",
      });
    } catch (err) {
      toast({
        variant: "destructive",
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to delete lesson.",
      });
    }
  };
  */

  return (
    <div className="flex flex-col items-center justify-center py-20 min-h-[400px]">
      <h1 className="text-4xl md:text-6xl font-bold text-[#1c2533] mb-4 tracking-tight">
        Coming Soon
      </h1>
      <p className="text-[#69728a] text-lg">
        The lessons management feature is currently under development.
      </p>
    </div>
  );
}
