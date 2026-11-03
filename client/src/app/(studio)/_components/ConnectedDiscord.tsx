"use client";
import StudioLoader from "@/components/studio/StudioLoader";

import { useEffect, useState } from "react";
import { ArrowLeft, ArrowRight, CheckCircle2, Loader2 } from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import { Card, CardDescription, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useToast } from "@/hooks/use-toast";
import { getStoredProjectInfo, projectApiRequest } from "@/lib/projectApi";
import {
  beginStudioDiscordConnect,
  clearStudioDiscordReturnPath,
  getStudioDiscordReturnPath,
} from "@/lib/studioDiscord";

type DiscordServer = {
  id: string;
  name: string;
};

export default function ConnectedDiscord() {
  const params = new URLSearchParams(typeof window !== "undefined" ? window.location.search : "");
  const id = params.get("id");
  const router = useRouter();
  const { toast } = useToast();
  const returnPath = getStudioDiscordReturnPath("/studio-dashboard/hub-profile");

  const [discordData, setDiscordData] = useState<DiscordServer[]>([]);
  const [selectedServer, setSelectedServer] = useState<DiscordServer>({ id: "", name: "" });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [serverOpen, setServerOpen] = useState(false);

  useEffect(() => {
    if (!id) {
      setLoading(false);
      toast({
        title: "Missing Discord session",
        description: "Please reconnect Discord to continue.",
        variant: "destructive",
      });
      router.push("/studio-dashboard/connect-discord");
      return;
    }

    const fetchDiscordData = async () => {
      try {
        setLoading(true);
        const { servers } = await projectApiRequest<{ servers: DiscordServer[] }>({
          method: "GET",
          endpoint: `/hub/get-servers?id=${id}`,
        });
        setDiscordData(servers ?? []);
      } catch (error) {
        console.error(error);
        toast({ title: "Error", description: "Failed to fetch server data.", variant: "destructive" });
      } finally {
        setLoading(false);
      }
    };

    void fetchDiscordData();
  }, [id, router, toast]);

  async function completeDiscordSetup() {
    if (!selectedServer.id) {
      toast({ title: "Select a server", description: "Please choose your Discord server first.", variant: "destructive" });
      return;
    }

    try {
      setSaving(true);

      await projectApiRequest({
        method: "PATCH",
        endpoint: "/hub/update-ids",
        data: {
          guildId: selectedServer.id,
          discordServer: selectedServer.name,
          discordSessionId: id,
        },
      });

      if (id) {
        const existingInfo = getStoredProjectInfo() ?? {};
        localStorage.setItem(
          "nexura-project:info",
          JSON.stringify({ ...existingInfo, discordSessionId: id })
        );
      }

      clearStudioDiscordReturnPath();
      toast({ title: "Discord connected", description: "Your studio Discord connection is ready." });
      router.push(returnPath);
    } catch (error) {
      console.error(error);
      const message = error instanceof Error ? error.message : "Failed to connect Discord";
      toast({ title: "Error", description: message, variant: "destructive" });
    } finally {
      setSaving(false);
    }
  }

  const handleBack = () => {
    console.log("[ACTION] ConnectedDiscord.handleBack");
    clearStudioDiscordReturnPath();
    router.push(returnPath);
  };

  if (loading) {
    return (
      <StudioLoader message="Loading Discord…" />
    );
  }

  return (
    <div className="flex min-h-[70vh] items-center justify-center">
      <Card className="w-full max-w-3xl rounded-[40px] border-[0.833px] border-[rgba(28,37,51,0.09)] bg-white p-8 text-[#1c2533] shadow-none">
        <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-3">
            <div className="inline-flex h-14 w-14 items-center justify-center rounded-2xl border border-emerald-400/30 bg-emerald-400/10">
              <CheckCircle2 className="h-8 w-8 text-emerald-300" />
            </div>
            <div className="space-y-2">
              <CardTitle className="text-3xl font-semibold">Finish Discord Setup</CardTitle>
              <CardDescription className="max-w-2xl text-sm leading-6 text-[#69728a]">
                Your Discord account is authorized. Choose the server you manage and the verification role Nexura should use for studio campaigns.
              </CardDescription>
            </div>
          </div>

          <div className="rounded-[20px] border-[0.833px] border-[rgba(138,63,252,0.24)] bg-[rgba(138,63,252,0.1)] px-4 py-3 text-sm text-[#6e2bd8]">
            The selected server will be saved directly to this studio hub.
          </div>
        </div>

        <div className="grid gap-6">
          <div className="space-y-3">
            <label className="text-[13px] font-semibold text-[#3d485c]">Discord Server</label>
            <div
              onClick={() => setServerOpen((open) => !open)}
              className="cursor-pointer rounded-[20px] border-[0.833px] border-[rgba(28,37,51,0.15)] bg-[#f4f1fc] p-4 transition hover:border-[#8B3EFE]/50"
            >
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-base font-semibold text-[#1c2533]">Select server</p>
                  <p className="mt-1 text-sm text-[#69728a]">
                    {selectedServer.name || "Choose an active Discord server"}
                  </p>
                </div>
                <ArrowRight className={`h-5 w-5 transition-transform ${serverOpen ? "rotate-90" : ""}`} />
              </div>
            </div>

            {serverOpen && (
              <div className="space-y-2 rounded-[20px] border-[0.833px] border-[rgba(28,37,51,0.15)] bg-[#f4f1fc] p-2">
                {discordData.length === 0 && (
                  <div className="rounded-[14px] border-[0.833px] border-[rgba(28,37,51,0.09)] bg-white px-4 py-3 text-sm text-[#69728a]">
                    No Discord servers were returned for this account.
                  </div>
                )}
                {discordData.map((server) => (
                  <button
                    key={server.id}
                    type="button"
                    onClick={() => {
                      setSelectedServer(server);
                      setServerOpen(false);
                    }}
                    className="w-full rounded-[14px] border border-transparent bg-white px-4 py-3 text-left text-[#1c2533] transition hover:border-[#8B3EFE]/40 hover:bg-[#fbfaff]"
                  >
                    {server.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-between">
          <Button
            type="button"
            variant="ghost"
            onClick={handleBack}
            className="rounded-[40px] border-[0.833px] border-[rgba(28,37,51,0.15)] bg-[#f7f4fe] text-[#1c2533] hover:bg-[#efeafb] hover:text-[#1c2533]"
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Back to Studio
          </Button>

          <div className="flex flex-col gap-3 sm:flex-row">
            <Button
              type="button"
              variant="ghost"
              onClick={() => beginStudioDiscordConnect(returnPath)}
              className="rounded-[40px] border-[0.833px] border-[rgba(28,37,51,0.15)] bg-[#f7f4fe] text-[#1c2533] hover:bg-[#efeafb] hover:text-[#1c2533]"
            >
              Reconnect Discord
            </Button>
            <Button
              type="button"
              onClick={completeDiscordSetup}
              disabled={saving}
              className="rounded-[40px] bg-[#8B3EFE] text-white hover:bg-[#7b35e6]"
            >
              {saving ? "Saving..." : "Save Discord Setup"}
              {!saving && <ArrowRight className="ml-2 h-4 w-4" />}
            </Button>
          </div>
        </div>
      </Card>
    </div>
  );
}


