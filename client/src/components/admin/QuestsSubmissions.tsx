"use client";
import StudioLoader from "@/components/studio/StudioLoader";

import { useState } from "react";
import { Card } from "../ui/card";
import { Button } from "../ui/button";
import { Badge } from "../ui/badge";
import { Input } from "../ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "../ui/table";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "../ui/collapsible";
import { cn } from "../../lib/utils";
import { StatOverview } from "./StatOverview";
import { TASKSS } from "../../types/admin";
import {
  Search,
  RefreshCw,
  Eye,
  Check,
  X,
  Clock,
  CheckCircle2,
  ChevronDown
} from "lucide-react";

interface QuestSubmissionsProps {
  tasks: TASKSS[];
  loading: boolean;
  searchTerm: string;
  setSearchTerm: (value: string) => void;
  selectedUsers: Set<string>;
  viewedSubmissions: Set<string>;
  toggleUserSelection: (userId: string) => void;
  handleView: (id: string, taskType: string, link: string) => void;
  handleAction: (id: string, action: "accept" | "reject") => void;
  onRefresh: () => void;
}

export default function QuestSubmissions({
  tasks = [],
  loading,
  searchTerm,
  setSearchTerm,
  selectedUsers,
  viewedSubmissions,
  toggleUserSelection,
  handleView,
  handleAction,
  onRefresh,
}: QuestSubmissionsProps) {

  const [questPendingOpen, setQuestPendingOpen] = useState(true);
  const [questCompletedOpen, setQuestCompletedOpen] = useState(true);

  const timeAgo = (dateString: string) => {
  const now = new Date().getTime();
  const past = new Date(dateString).getTime();
  const diffInSeconds = Math.floor((now - past) / 1000);

  if (diffInSeconds < 60) return `${diffInSeconds}s ago`;

  const diffInMinutes = Math.floor(diffInSeconds / 60);
  if (diffInMinutes < 60) return `${diffInMinutes}m ago`;

  const diffInHours = Math.floor(diffInMinutes / 60);
  if (diffInHours < 24) return `${diffInHours}h ago`;

  const diffInDays = Math.floor(diffInHours / 24);
  return `${diffInDays}d ago`;
};


    // Filter tasks by status and search term
    // const pendingTasks = tasks.filter(task => task.status === "pending" && task.username.toLowerCase().includes(searchTerm.toLowerCase()));
    // const pendingTasks = tasks.filter(task => task.status === "pending");

    // const completedTasks = tasks.filter(task => task.status !== "pending" && task.username.toLowerCase().includes(searchTerm.toLowerCase()));
    
    const pendingTasks = tasks.filter(task => 
  task.status === "pending" &&
  task.username?.toLowerCase().includes(searchTerm.toLowerCase())
);

const completedTasks = tasks.filter(task => 
  task.status !== "pending" &&
  task.username?.toLowerCase().includes(searchTerm.toLowerCase())
);

    // Helper function to render individual task cards
    const renderTaskCard = (submission: TASKSS) => (
      <Card key={submission._id} className="bg-[#f4f1fc] border-[rgba(28,37,51,0.12)] p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-xs uppercase tracking-wide text-[#69728a]">User</p>
            <p className="text-[#1c2533] font-medium cursor-pointer hover:text-[#3d485c] flex items-center gap-2" onClick={() => toggleUserSelection(submission.user)}>
              {submission.username}
              {selectedUsers.has(submission.user) && <Check className="w-4 h-4 text-[#00a87c]" />}
            </p>
          </div>
          <Badge
            variant="outline"
            className={
              submission.status === "pending" ? "bg-yellow-500/20 text-[#c27c00] border-yellow-500/30" :
                submission.status === "done" ? "bg-green-500/20 text-[#00a87c] border-green-500/30" :
                  submission.status === "retry" ? "bg-red-500/20 text-[#e4545b] border-red-500/30" :
                    "bg-gray-500/20 text-[#69728a] border-gray-500/30"
            }
          >
            {submission.status}
          </Badge>
        </div>
        <div className="mt-3 space-y-2 text-sm">
          <div className="flex items-start justify-between gap-3">
            <span className="text-[#69728a]">Task</span>
            <span className="text-[#1c2533] text-right">{submission.taskType}</span>
          </div>
          {submission.taskType?.toLowerCase() === "feedback" && (
            <div className="mt-2 bg-[#f4f1fc] border border-[rgba(28,37,51,0.12)] rounded-lg p-3 max-h-24 overflow-y-auto">
              <p className="text-[#3d485c] text-xs whitespace-pre-wrap leading-relaxed">
                {submission.submissionLink.length > 150 ? submission.submissionLink.slice(0, 150) + "…" : submission.submissionLink}
              </p>
            </div>
          )}
          <div className="flex items-center justify-between">
            <span className="text-[#69728a]">Validated By</span>
            <span className="text-[#1c2533]">{submission.validatedBy}</span>
          </div>
        </div>
        <div className="mt-4 flex flex-col gap-2">
          {submission.status === "pending" ? (
            <>
              <Button
                size="sm"
                onClick={() => handleView(submission._id, submission.taskType, submission.submissionLink)}
                className="w-full bg-gradient-to-r from-[#8a3ffc] to-[#522696] shadow-[0px_4px_3px_-3px_#7e39e6] rounded-full text-white hover:opacity-90 transition-opacity"
              >
                <Eye className="w-4 h-4 mr-2" />
                View
              </Button>
              {viewedSubmissions.has(submission._id) && (
                <div className="flex items-center justify-center gap-2 mt-2">
                  <Button
                    size="sm"
                    onClick={() => handleAction(submission._id, "accept")}
                    className="bg-green-500/20 text-[#00a87c] hover:bg-green-500/30 hover:text-[#00a87c] border border-green-500/50 rounded-full p-2"
                    title="Accept"
                  >
                    <Check className="w-4 h-4" />
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => handleAction(submission._id, "reject")}
                    className="bg-red-500/20 text-[#e4545b] hover:bg-red-500/30 hover:text-[#e4545b] border border-red-500/50 rounded-full p-2"
                    title="Reject"
                  >
                    <X className="w-4 h-4" />
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => handleView(submission._id, submission.taskType, submission.submissionLink)}
                    className="bg-blue-500/20 text-[#2f7fe0] hover:bg-blue-500/30 hover:text-[#2f7fe0] border border-blue-500/50 rounded-full p-2"
                    title="Review"
                  >
                    <RefreshCw className="w-4 h-4" />
                  </Button>
                </div>
              )}
            </>
          ) : (
            <Button
              size="sm"
              onClick={() => handleView(submission._id, submission.taskType, submission.submissionLink)}
              className="w-full bg-orange-500/20 text-[#c27c00] hover:bg-orange-500/30 hover:text-[#c27c00] border border-orange-500/50 rounded-full"
              title="Review & Change Status"
            >
              <RefreshCw className="w-4 h-4 mr-2" />
              Review
            </Button>
          )}
        </div>
      </Card>
    );

    // Helper function to render table rows
    const renderTaskRow = (submission: TASKSS) => (
  <TableRow key={submission._id} className="border-[rgba(28,37,51,0.12)]">
    
    {/* User */}
    <TableCell className="text-[#3d485c]">
      <button
        className="flex items-center gap-2 hover:text-[#1c2533] cursor-pointer"
        onClick={() => toggleUserSelection(submission.user)}
      >
        {submission.username}
        {selectedUsers.has(submission.user) && (
          <Check className="w-4 h-4 text-[#00a87c]" />
        )}
      </button>
    </TableCell>

    {/* Task Type */}
    <TableCell className="font-medium text-[#1c2533]">
      {submission.taskType}
    </TableCell>

    {/* Submitted */}
    <TableCell className="text-[#3d485c]">
  {timeAgo(submission.createdAt ?? new Date().toISOString())}
</TableCell>

    {/* Status */}
    <TableCell>
      <Badge
        variant="outline"
        className={
          submission.status === "pending"
            ? "bg-yellow-500/20 text-[#c27c00] border-yellow-500/30"
            : submission.status === "done"
            ? "bg-green-500/20 text-[#00a87c] border-green-500/30"
            : submission.status === "retry"
            ? "bg-red-500/20 text-[#e4545b] border-red-500/30"
            : "bg-gray-500/20 text-[#69728a] border-gray-500/30"
        }
      >
        {submission.status}
      </Badge>
    </TableCell>

    {/* Validated By */}
    <TableCell className="text-[#3d485c]">
      {submission.validatedBy}
    </TableCell>

    {/* Actions */}
    <TableCell className="text-right">
      {submission.status === "pending" ? (
        <div className="flex items-center justify-end gap-2">
          <Button
            size="sm"
            onClick={() =>
              handleView(
                submission._id,
                submission.taskType,
                submission.submissionLink
              )
            }
            className="bg-gradient-to-r from-[#8a3ffc] to-[#522696] rounded-full text-white px-6 hover:opacity-90 transition-opacity"
          >
            <Eye className="w-4 h-4 mr-2" />
            View
          </Button>

          {viewedSubmissions.has(submission._id) && (
            <>
              <Button
                size="sm"
                onClick={() => handleAction(submission._id, "accept")}
                className="bg-green-500/20 text-[#00a87c] border border-green-500/50 rounded-full p-2"
              >
                <Check className="w-4 h-4" />
              </Button>
              <Button
                size="sm"
                onClick={() => handleAction(submission._id, "reject")}
                className="bg-red-500/20 text-[#e4545b] border border-red-500/50 rounded-full p-2"
              >
                <X className="w-4 h-4" />
              </Button>
            </>
          )}
        </div>
      ) : (
        <Button
          size="sm"
          onClick={() =>
            handleView(
              submission._id,
              submission.taskType,
              submission.submissionLink
            )
          }
          className="bg-orange-500/20 text-[#c27c00] border border-orange-500/50 rounded-full px-4"
        >
          <RefreshCw className="w-4 h-4 mr-2" />
          Review
        </Button>
      )}
    </TableCell>
  </TableRow>
);


    return (
      <div className="space-y-4">
        <StatOverview tasks={tasks} />
        <div className="flex flex-wrap items-center justify-between gap-y-3 mb-6">
          <h2 className="text-2xl font-bold text-[#1c2533]">Quests Submissions</h2>
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <div className="relative flex-1 sm:flex-none">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#69728a]" />
              <Input
                placeholder="Search users..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="bg-[#f4f1fc] border-[rgba(28,37,51,0.12)] text-[#1c2533] pl-9 placeholder:text-[#98a0b4] focus-visible:ring-[#8a3ffc] w-full sm:w-48"
              />
            </div>
            <Button
              size="icon"
              variant="ghost"
              className="text-[#3d485c] hover:text-[#1c2533] hover:bg-[rgba(138,63,252,0.06)]"
              onClick={onRefresh}
              disabled={loading}
            >
              <RefreshCw className={cn("w-5 h-5", loading && "animate-spin")} />
            </Button>
          </div>
        </div>

        {/* Pending Tasks Section */}
        <Collapsible open={questPendingOpen} onOpenChange={setQuestPendingOpen}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" className="w-full justify-between text-[#1c2533] hover:bg-[rgba(138,63,252,0.06)] p-4">
              <span className="text-lg font-semibold">Pending Tasks ({pendingTasks.length})</span>
              <ChevronDown className={cn("w-5 h-5 transition-transform", questPendingOpen && "rotate-180")} />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-3">
            {loading ? (
              <StudioLoader compact message="Loading submissions…" />
            ) : pendingTasks.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-[#69728a]">
                <Clock className="w-12 h-12 mb-4 opacity-50" />
                <p>No pending tasks</p>
              </div>
            ) : (
              <>
                <div className="space-y-3 md:hidden">
                  {pendingTasks.map(renderTaskCard)}
                </div>
                <Card className="bg-transparent border-[rgba(28,37,51,0.12)] overflow-hidden hidden md:block">

                  <Table>
<TableHeader>
  <TableRow className="border-[rgba(28,37,51,0.12)]">
    <TableHead className="text-[#3d485c]">USER</TableHead>
    <TableHead className="text-[#3d485c]">TASK TYPE</TableHead>
    <TableHead className="text-[#3d485c]">SUBMITTED</TableHead>
    <TableHead className="text-[#3d485c]">STATUS</TableHead>
    <TableHead className="text-[#3d485c]">VALIDATED BY</TableHead>
    <TableHead className="text-[#3d485c] text-right">ACTIONS</TableHead>
  </TableRow>
</TableHeader>

                    <TableBody>
                      {pendingTasks.map(renderTaskRow)}
                    </TableBody>
                  </Table>
                </Card>
              </>
            )}
          </CollapsibleContent>
        </Collapsible>

        {/* Completed Tasks Section */}
        <Collapsible open={questCompletedOpen} onOpenChange={setQuestCompletedOpen}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" className="w-full justify-between text-[#1c2533] hover:bg-[rgba(138,63,252,0.06)] p-4">
              <span className="text-lg font-semibold">Completed Tasks ({completedTasks.length})</span>
              <ChevronDown className={cn("w-5 h-5 transition-transform", questCompletedOpen && "rotate-180")} />
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="space-y-3">
            {completedTasks.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-8 text-[#69728a]">
                <CheckCircle2 className="w-12 h-12 mb-4 opacity-50" />
                <p>No completed tasks yet</p>
              </div>
            ) : (
              <>
                <div className="space-y-3 md:hidden">
                  {completedTasks.map(renderTaskCard)}
                </div>
                <Card className="bg-transparent border-[rgba(28,37,51,0.12)] overflow-hidden hidden md:block">
                  <Table>
                    <TableHeader>
  <TableRow className="border-[rgba(28,37,51,0.12)]">
    <TableHead className="text-[#3d485c]">USER</TableHead>
    <TableHead className="text-[#3d485c]">TASK TYPE</TableHead>
    <TableHead className="text-[#3d485c]">SUBMITTED</TableHead>
    <TableHead className="text-[#3d485c]">STATUS</TableHead>
    <TableHead className="text-[#3d485c]">VALIDATED BY</TableHead>
    <TableHead className="text-[#3d485c] text-right">ACTIONS</TableHead>
  </TableRow>
</TableHeader>
                    <TableBody>
                      {completedTasks.map(renderTaskRow)}
                    </TableBody>
                  </Table>
                </Card>
              </>
            )}
          </CollapsibleContent>
        </Collapsible>
      </div>
    );
  };
