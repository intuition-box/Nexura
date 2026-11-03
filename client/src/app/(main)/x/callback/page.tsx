"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import { apiRequestV2 } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";
import { projectApiRequest } from "@/lib/projectApi";
import { STUDIO_X_RETURN_KEY } from "@/lib/generateXAuthUrl";

function XCallbackInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { setUser } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    const ticket = searchParams.get("ticket");
    const username = searchParams.get("username");

    if (!ticket || !username) {
      alert("No id or username returned from server.");
      router.push("/profile/edit"); // redirect to edit profile if values is missing
      return;
    }

    // Started from Nexura Studio: the X account belongs to the hub, not the main-app user
    let studioReturn: string | null = null;
    try { studioReturn = localStorage.getItem(STUDIO_X_RETURN_KEY); localStorage.removeItem(STUDIO_X_RETURN_KEY); } catch { /* storage unavailable */ }
    if (studioReturn) {
      (async () => {
        try {
          const fd = new FormData();
          fd.append("xAccount", username.replace(/^@/, ""));
          await projectApiRequest({ method: "PATCH", endpoint: "/hub/update-hub", formData: fd });
          toast({ title: "X connected", description: `@${username.replace(/^@/, "")} is now linked to your studio.` });
        } catch (error: any) {
          toast({ title: "Couldn't link X", description: error?.message, variant: "destructive" });
        }
        router.push(studioReturn!);
      })();
      return;
    }

    // update user
    (async () => {
      console.log("[ACTION] xCallback", { username });
      try {
        const { user } = await apiRequestV2("GET", `/api/x/update?ticket=${encodeURIComponent(ticket)}`);

        setUser(user);

        toast({ title: "Success", description: "X login successful!" });
        router.push("/profile/edit")
      } catch (error: any) {
        console.error("[ACTION] xCallback ✗", error);
        console.error(error);
        toast({ title: "Error", description: error.message, variant: "destructive" });
        router.push("/profile/edit");
      }
    })();

    // fetch(`/api/discord/join`, {
    //   method: "POST",
    //   headers: { "Content-Type": "application/json" },
    //   body: JSON.stringify({ code }),
    // })
    //   .then((res) => res.json())
    //   .then((data) => {
    //     if (data.success) {
    //       alert("Successfully joined X!");
    //     } else {
    //       alert("Failed to join X server.");
    //     }
    //     setLocation("/campaigns"); // always go back to campaigns page
    //   })
    //   .catch((err) => {
    //     console.error(err);
    //     alert("Something went wrong.");
    //     setLocation("/campaigns");
    //   });
  }, []);

  return (
    <div className="min-h-screen flex items-center justify-center text-white bg-black">
      <p className="text-lg">Processing X connection... </p>
      <br />
      <p className="text-lg">Do not refresh</p>
    </div>
  );
}

export default function XCallback() {
  return (
    <Suspense fallback={null}>
      <XCallbackInner />
    </Suspense>
  );
}
