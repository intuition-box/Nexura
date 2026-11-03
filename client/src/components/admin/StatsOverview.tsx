"use client";

import { Card } from "../../components/ui/card";
import { TASKS } from "../../types/admin";

export const StatsOverview = ({ tasks }: { tasks: TASKS[] }) => {
    const totalPending = tasks.filter(task => task.status === "pending").length;
    const approvedToday = tasks.filter(task => task.status === "done").length;
    // Count total historical rejections (includes tasks later re-approved)
    const rejectedToday = tasks.reduce((sum, task) => sum + ((task as any).rejectedCount || (task.status === "retry" ? 1 : 0)), 0);
    const totalProcessed = approvedToday + rejectedToday;
    const totalSubmissions = tasks.length;

    const pendingChange = totalProcessed > 0 ? `${Math.round((totalPending / (totalPending + totalProcessed)) * 100)}%` : "0%";
    const approvedChange = totalProcessed > 0 ? `${Math.round((approvedToday / totalProcessed) * 100)}%` : "0%";
    const rejectedChange = totalProcessed > 0 ? `${Math.round((rejectedToday / totalProcessed) * 100)}%` : "0%";

    return (
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
        <Card className="bg-white border-[0.833px] border-[rgba(28,37,51,0.09)] rounded-[40px] shadow-none p-6 relative overflow-hidden group hover:bg-[#fbfaff] transition-colors">
          <div className="flex flex-col relative z-10 pr-20">
            <span className="text-[#69728a] text-sm font-semibold">Total Pending</span>
            <div className="flex items-baseline gap-2 mt-2">
              <span className="text-3xl font-extrabold text-[#8a3ffc]">{totalPending}</span>
              <span className="text-[#69728a] text-xs font-medium">{pendingChange} pending</span>
            </div>
          </div>
          <img src="/total-pending.png" alt="Pending" className="absolute right-4 top-1/2 -translate-y-1/2 w-16 h-16 object-contain opacity-60 group-hover:opacity-80 transition-opacity" />
        </Card>

        <Card className="bg-white border-[0.833px] border-[rgba(28,37,51,0.09)] rounded-[40px] shadow-none p-6 relative overflow-hidden group hover:bg-[#fbfaff] transition-colors">
          <div className="flex flex-col relative z-10 pr-20">
            <span className="text-[#69728a] text-sm font-semibold">Total Approved</span>
            <div className="flex items-baseline gap-2 mt-2">
              <span className="text-3xl font-extrabold text-[#8a3ffc]">{approvedToday}</span>
              <span className="text-[#69728a] text-xs font-medium">{approvedChange} approval rate</span>
            </div>
          </div>
          <img src="/approved.png" alt="Approved" className="absolute right-4 top-1/2 -translate-y-1/2 w-16 h-16 object-contain opacity-60 group-hover:opacity-80 transition-opacity" />
        </Card>

        <Card className="bg-white border-[0.833px] border-[rgba(28,37,51,0.09)] rounded-[40px] shadow-none p-6 relative overflow-hidden group hover:bg-[#fbfaff] transition-colors">
          <div className="flex flex-col relative z-10 pr-20">
            <span className="text-[#69728a] text-sm font-semibold">Total Rejected</span>
            <div className="flex items-baseline gap-2 mt-2">
              <span className="text-3xl font-extrabold text-[#8a3ffc]">{rejectedToday}</span>
              <span className="text-[#69728a] text-xs font-medium">{rejectedChange} rejection rate</span>
            </div>
          </div>
          <img src="/rejected.png" alt="Rejected" className="absolute right-4 top-1/2 -translate-y-1/2 w-16 h-16 object-contain opacity-60 group-hover:opacity-80 transition-opacity" />
        </Card>

        <Card className="bg-white border-[0.833px] border-[rgba(28,37,51,0.09)] rounded-[40px] shadow-none p-6 relative overflow-hidden group hover:bg-[#fbfaff] transition-colors">
          <div className="flex flex-col relative z-10 pr-20">
            <span className="text-[#69728a] text-sm font-semibold">Total Submissions</span>
            <div className="flex items-baseline gap-2 mt-2">
              <span className="text-3xl font-extrabold text-[#8a3ffc]">{totalSubmissions}</span>
              <span className="text-[#69728a] text-xs font-medium">All time submissions</span>
            </div>
          </div>
          <img src="/approved.png" alt="Submissions" className="absolute right-4 top-1/2 -translate-y-1/2 w-16 h-16 object-contain opacity-60 group-hover:opacity-80 transition-opacity" />
        </Card>
      </div>
    );
  };