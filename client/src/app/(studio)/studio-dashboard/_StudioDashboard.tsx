"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import StudioBackground from "@/components/StudioBackground";
import StudioSidebar from "@/components/studio/StudioSidebar";
import StudioHeader from "@/components/studio/StudioHeader";
import { useSessionExpiryRedirect } from "@/components/studio/useProjectSession";
import SignerReminder from "@/components/studio/SignerReminder";
import { apiRequest } from "@/lib/config";
import { projectApiRequest } from "@/lib/projectApi";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { getStoredAdminInfo } from "@/lib/config";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { Calendar, Shield, LayoutDashboard, Search, Bell, RefreshCw, Check, X, Eye, Clock, CheckCircle2, XCircle, ChevronDown, Users, FileText, Copy } from "lucide-react";
import { StatsOverview } from "@/components/admin/StatsOverview";
import SubmissionsHub from "@/components/admin/SubmissionsHub";
import { TASKS } from "@/types/admin";
import AdminManagement, { AdminType as Admin } from "@/components/admin/AdminManagement";
import CampaignsTab from "@/components/admin/CampaignsTab";
import CreateNewCampaigns from "@/components/admin/CreateNewCampaign";

type BannedUser = {
  _id: string;
  walletAddress: string;
  username: string; 
  bannedAt: string;
}

type TabType = "hubProfile" | "accountSettings" | "campaignSubmissions" | "adminManagement" | "campaignsTab" | "campaignsFlow";

export default function StudioDashboard() {
  const pathname = usePathname();
  const deriveTab = (): TabType => {
    if (pathname.includes("/studio-dashboard/dashboard")) return "campaignSubmissions";
    if (pathname.includes("hub-profile")) return "hubProfile";
    if (pathname.includes("admin-management")) return "adminManagement";
    if (pathname.includes("campaigns-flow")) return "campaignsFlow";
    if (pathname.includes("campaigns-tab") || pathname.includes("create-new-campaign") || pathname.includes("my-campaign")) {
      return "campaignsTab";
    }
    return "campaignsTab";
  };
  const [activeTab, setActiveTab] = useState<TabType>(deriveTab);

  useEffect(() => {
    setActiveTab(deriveTab());
  }, [pathname]);

  useSessionExpiryRedirect();
  const [viewedSubmissions, setViewedSubmissions] = useState<Set<string>>(new Set());
const [campaignTasks, setCampaignTasks] = useState<TASKS[]>([]);
  const [admins, setAdmins] = useState<Admin[]>([]);
  const [loading, setLoading] = useState(false);
  const [adminsLoading, setAdminsLoading] = useState(false);
  const [viewModalOpen, setViewModalOpen] = useState(false);
  const [selectedTask, setSelectedTask] = useState<TASKS | null>(null);
    const [searchTerm, setSearchTerm] = useState("");
  // Bumped after a submission is accepted or rejected so the Submissions view reloads
  const [submissionsRefresh, setSubmissionsRefresh] = useState(0);
    

  const fetchTasks = async () => {
    try {
      setLoading(true);
      const res = await projectApiRequest<{ message?: string; pendingTasks?: TASKS[] }>({ endpoint: "/hub/campaign-submissions", method: "GET" });
      const pendingTasks = res?.pendingTasks ?? [];

      const pendingcampaignTasks = pendingTasks.filter((task) => task.page === "campaign");

      setCampaignTasks(pendingcampaignTasks);
    } catch (error) {
      console.error("Failed to fetch tasks:", error);
      // No fallback data for production - API must be available
      setCampaignTasks([]);
    } finally {
      setLoading(false);
    }
  };

  // Fetch submissions when the component mounts or when switching to the submissions tab
  useEffect(() => {
    if (activeTab === "campaignSubmissions") {
      fetchTasks();
    }
  }, [activeTab]);

  const fetchAdmins = async () => {
    try {
      setAdminsLoading(true);
      const res = await apiRequest<{ message?: string; admins?: Admin[] }>({ endpoint: "/api/admin/get-admins", method: "GET" });
      const adminList = res?.admins ?? [];
      setAdmins(adminList);
    } catch (error) {
      console.error("Failed to fetch admins:", error);
      // For development/testing, show empty list - current admin is not in this list
      setAdmins([]);
    } finally {
      setAdminsLoading(false);
    }
  };

  const openSubmission = (task: TASKS) => {
    setSelectedTask(task);
    setViewModalOpen(true);
    setViewedSubmissions((prev) => new Set(prev).add(task._id));
  };

  const handleAction = async (id: string, action: "accept" | "reject") => {
    console.log("[ACTION] StudioDashboard.handleAction", action, id);
    try {
      setLoading(true);
      await projectApiRequest<{ message?: string }>({
        method: "POST",
        endpoint: "/hub/validate-campaign-submissions",
        data: { submissionId: id, action }
      });

      // Refresh tasks after action
      await fetchTasks();
      setSubmissionsRefresh(n => n + 1);
      setViewModalOpen(false);

      // Remove from viewed submissions
      setViewedSubmissions((prev) => {
        const newSet = new Set(prev);
        newSet.delete(id);
        return newSet;
      });
    } catch (error) {
      console.error(`Failed to ${action} submission:`, error);
    } finally {
      setLoading(false);
    }
  };

const [bannedUsers, setBannedUsers] = useState<BannedUser[]>([]);
const [selectedUsers, setSelectedUsers] = useState<Set<string>>(new Set());

const toggleUserSelection = (id: string) => {
  setSelectedUsers(prev => {
    const newSet = new Set(prev);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    return newSet;
  });
};

const unbanUser = async (id: string) => {
  try {
    setLoading(true);
    await apiRequest({ method: "POST", endpoint: "/api/admin/unban-user", data: { userId: id } });
    // Refresh banned users
    fetchBannedUsers();
  } catch (err) {
    console.error(err);
  } finally {
    setLoading(false);
  }
};

const fetchBannedUsers = async () => {
  try {
    setLoading(true);
    const res = await apiRequest<{ bannedUsers: BannedUser[] }>({ method: "GET", endpoint: "/api/admin/get-banned-users" });
    setBannedUsers(res.bannedUsers || []);
  } catch (err) {
    console.error(err);
  } finally {
    setLoading(false);
  }
};


  return (
    <div className="relative min-h-screen w-full overflow-hidden">
      <StudioBackground />
      <SignerReminder />

      <div className="relative z-10 flex h-screen flex-col md:flex-row">

{/* ////////////  Sidebar */}
        <StudioSidebar
  activeTab={activeTab}
  setActiveTab={setActiveTab}
/>

        {/* Main Content Area */}
        <div className="flex-1 flex flex-col overflow-hidden">
          <div className="hidden md:block">
            <StudioHeader
              title={
                activeTab === "hubProfile" ? "Project Profile"
                : activeTab === "adminManagement" ? "User Administration"
                : activeTab === "campaignsTab" ? "Campaigns"
                : activeTab === "campaignsFlow" ? "New Campaigns"
                : activeTab === "campaignSubmissions" ? "Submissions"
                : "Nexura Studio"
              }
            />
          </div>


          <main className="flex-1 overflow-y-auto pt-16 pb-24 px-4 md:pt-8 md:pb-8 md:px-9 relative bg-[#f7f5ff] text-[#1c2533]" style={{ fontFamily: "'Geist', 'Inter', sans-serif" }}>
            <div className="max-w-7xl mx-auto">
              {activeTab === "hubProfile" && <StatsOverview key={activeTab} tasks={[]} />}
              {activeTab === "campaignsTab" && <CampaignsTab />}

              {activeTab === "campaignSubmissions" && (
                <SubmissionsHub
                  refreshKey={submissionsRefresh}
                  loading={loading}
                  searchTerm={searchTerm}
                  setSearchTerm={setSearchTerm}
                  selectedUsers={selectedUsers}
                  viewedSubmissions={viewedSubmissions}
                  toggleUserSelection={toggleUserSelection}
                  onOpenSubmission={openSubmission}
                  handleAction={handleAction}
                />
              )}

              {activeTab === "adminManagement" && <AdminManagement />}
            </div>
          </main>
        </div>
      </div>

      {/* View Task Modal */}
      <Dialog open={viewModalOpen} onOpenChange={setViewModalOpen}>
        <DialogContent className="sm:max-w-[500px] bg-white border-[0.833px] border-[rgba(28,37,51,0.15)] rounded-[40px] text-[#1c2533] shadow-[0px_22px_25px_rgba(28,37,51,0.28)]">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-xl font-bold">
              <div className="p-2 rounded-full bg-[rgba(138,63,252,0.1)]">
                <Eye className="w-5 h-5 text-[#8B3EFE]" />
              </div>
              View {selectedTask?.taskType} Submission
            </DialogTitle>
            <DialogDescription className="text-[#69728a]">
              Submission details for validation
            </DialogDescription>
          </DialogHeader>

          {selectedTask && (
            <div className="grid gap-4 py-4">
              <div className="grid gap-2">
                <Label className="text-[13px] font-semibold text-[#3d485c]">Task Type</Label>
                <div className="text-[#1c2533] capitalize">{selectedTask.taskType}</div>
              </div>

              {selectedTask.taskType && selectedTask.taskType.toLowerCase() === "feedback" ? (
                <div className="grid gap-2">
                  <Label className="text-[13px] font-semibold text-[#3d485c]">User Feedback</Label>
                  <div className="bg-[#f4f1fc] border border-[rgba(28,37,51,0.09)] rounded-[16px] p-4 max-h-60 overflow-y-auto">
                    <p className="text-[#1c2533] text-sm whitespace-pre-wrap leading-relaxed">{selectedTask.submissionLink}</p>
                  </div>
                  <p className="text-xs text-[#98a0b4]">{selectedTask.submissionLink.length} characters</p>
                </div>
              ) : selectedTask.taskType === "wallet-address" ? (
                <div className="grid gap-2">
                  <Label className="text-[13px] font-semibold text-[#3d485c]">Wallet Address</Label>
                  <div className="flex gap-2">
                    <Input
                      value={selectedTask.submissionLink}
                      readOnly
                      className="bg-[#f4f1fc] border-[rgba(28,37,51,0.15)] text-[#1c2533] placeholder:text-[#98a0b4] rounded-[12px] focus-visible:ring-[#8a3ffc] flex-1 font-mono"
                    />
                    <Button
                      onClick={() => navigator.clipboard.writeText(selectedTask.submissionLink)}
                      className="rounded-[40px] bg-[#8B3EFE] hover:bg-[#7b35e6] text-white px-4"
                    >
                      <Copy className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ) : selectedTask.taskType && ["follow", "like"].includes(selectedTask.taskType.toLowerCase()) ? (
                <div className="grid gap-2">
                  <Label className="text-[13px] font-semibold text-[#3d485c]">Username to {selectedTask.taskType}</Label>
                  <div className="flex gap-2">
                    <Input
                      value={(() => {
                        // For both follow and like tasks, extract username from submissionLink
                        const urlMatch = selectedTask.submissionLink.match(/https?:\/\/(?:twitter\.com|x\.com)\/([^\/]+)/);
                        return urlMatch ? `x.com/${urlMatch[1]}` : selectedTask.submissionLink;
                      })()}
                      readOnly
                      className="bg-[#f4f1fc] border-[rgba(28,37,51,0.15)] text-[#1c2533] placeholder:text-[#98a0b4] rounded-[12px] focus-visible:ring-[#8a3ffc] flex-1"
                    />
                    <Button
                      onClick={() => {
                        const urlMatch = selectedTask.submissionLink.match(/https?:\/\/(?:twitter\.com|x\.com)\/([^\/]+)/);
                        const targetUrl = urlMatch ? `https://x.com/${urlMatch[1]}` : selectedTask.submissionLink;
                        if (targetUrl) window.open(targetUrl, "_blank");
                      }}
                      disabled={!selectedTask.submissionLink}
                      className="rounded-[40px] bg-[#8B3EFE] hover:bg-[#7b35e6] text-white px-4"
                    >
                      <Eye className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              ) : (
                <div className="grid gap-2">
                  <Label className="text-[13px] font-semibold text-[#3d485c]">Submission Link</Label>
                  <div className="flex gap-2">
                    <Input
                      value={selectedTask.submissionLink}
                      readOnly
                      className="bg-[#f4f1fc] border-[rgba(28,37,51,0.15)] text-[#1c2533] placeholder:text-[#98a0b4] rounded-[12px] focus-visible:ring-[#8a3ffc] flex-1"
                    />
                    <Button
                      onClick={() => window.open(selectedTask.submissionLink, "_blank")}
                      className="rounded-[40px] bg-[#8B3EFE] hover:bg-[#7b35e6] text-white px-4"
                    >
                      <Eye className="w-4 h-4" />
                    </Button>
                  </div>
                </div>
              )}

              <div className="grid gap-2">
                <Label className="text-[13px] font-semibold text-[#3d485c]">Campaign ID</Label>
                <div className="text-[#69728a] text-sm font-mono">{selectedTask.campaignId}</div>
              </div>

              <div className="grid gap-2">
                <Label className="text-[13px] font-semibold text-[#3d485c]">Status</Label>
                <Badge className={cn(
                  "w-fit",
                  selectedTask.status === "pending" && "bg-[rgba(245,158,11,0.14)] text-[#c27c00] hover:bg-[rgba(245,158,11,0.14)]",
                  selectedTask.status === "done" && "bg-[rgba(0,225,162,0.16)] text-[#00a87c] hover:bg-[rgba(0,225,162,0.16)]",
                  selectedTask.status === "retry" && "bg-[rgba(248,113,113,0.16)] text-[#e4545b] hover:bg-[rgba(248,113,113,0.16)]"
                )}>
                  {selectedTask.status}
                </Badge>
              </div>
            </div>
          )}

          {/* Review Actions for Completed Tasks */}
          {selectedTask && selectedTask.status !== "pending" && (
            <div className="flex items-center justify-center gap-3 pt-4 border-t-[0.833px] border-[rgba(28,37,51,0.09)]">
              <Button
                onClick={() => handleAction(selectedTask._id, "accept")}
                className="bg-[rgba(0,225,162,0.16)] text-[#00a87c] hover:bg-[rgba(0,225,162,0.24)] border border-[rgba(0,168,124,0.3)] rounded-full px-6 py-2"
                disabled={loading}
              >
                <Check className="w-4 h-4 mr-2" />
                Accept
              </Button>
              <Button
                onClick={() => handleAction(selectedTask._id, "reject")}
                className="bg-[rgba(248,113,113,0.16)] text-[#e4545b] hover:bg-[rgba(248,113,113,0.24)] border border-[rgba(228,84,91,0.3)] rounded-full px-6 py-2"
                disabled={loading}
              >
                <X className="w-4 h-4 mr-2" />
                Reject
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}


