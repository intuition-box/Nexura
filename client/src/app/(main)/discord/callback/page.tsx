"use client";

import { Suspense, useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useToast } from "@/hooks/use-toast";
import { apiRequestV2 } from "@/lib/queryClient";
import { useAuth } from "@/lib/auth";

function DiscordCallbackInner() {
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

    // update user
    (async () => {
      console.log("[ACTION] discordCallback", { username });
      try {
        const { user } = await apiRequestV2("GET", `/api/discord/update?ticket=${encodeURIComponent(ticket)}`);

        setUser(user);

        toast({ title: "Success", description: "Discord login successful!" });
        router.push("/profile/edit")
      } catch (error: any) {
        console.error("[ACTION] discordCallback ✗", error);
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
    //       alert("Successfully joined Discord!");
    //     } else {
    //       alert("Failed to join Discord server.");
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
      <p className="text-lg">Processing Discord connection... </p>
      <br />
      <p className="text-lg">Do not refresh</p>
    </div>
  );
}

export default function DiscordCallback() {
  return (
    <Suspense fallback={null}>
      <DiscordCallbackInner />
    </Suspense>
  );
}
