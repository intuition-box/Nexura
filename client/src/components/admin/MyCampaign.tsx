"use client";

import { useState, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
// StudioSidebar is provided by StudioLayout wrapper
import { Card } from "../ui/card";

export default function MyCampaign() {
  const pathname = usePathname();
  const router = useRouter();
  const [campaign, setCampaign] = useState<any>(null);
  const [tasks, setTasks] = useState<any[]>([]);

  useEffect(() => {
    const selected = localStorage.getItem("selectedCampaign");
    if (selected) {
      const parsed = JSON.parse(selected);
      setCampaign(parsed);
      setTasks(parsed.tasks || []);
    }
  }, []);

  const formatDateRange = (start: string, end: string) => {
  const startD = new Date(start);
  const endD = new Date(end);

  const startDay = startD.getDate();
  const startMonth = startD.toLocaleString("en-GB", { month: "short" });

  const endDay = endD.getDate();
  const endMonth = endD.toLocaleString("en-GB", { month: "short" });

  const year = startD.getFullYear();

  // If same year, shorten format
  if (startD.getFullYear() === endD.getFullYear()) {
    return `${startDay} ${startMonth} – ${endDay} ${endMonth}, ${year}`;
  }

  // Different years, fallback to full format
  return `${startDay} ${startMonth}, ${startD.getFullYear()} – ${endDay} ${endMonth}, ${endD.getFullYear()}`;
};


  if (!campaign) return <p className="text-[#69728a] p-6">No campaign selected.</p>;

  const {
    title,
    name,
    coverImage,
    startDate,
    endDate,
    rewardPool,
    participants,
  } = campaign;

  return (
    <div className="space-y-6 text-[#1c2533]">

{/* Top Row: Campaign Title + Buttons */}
<div className="flex justify-between items-center pr-4 mb-6 border-b-[0.833px] border-[rgba(28,37,51,0.09)] pb-3">
  {/* Left side: Back Button + Title + Duration + Active */}
  <div className="flex items-center gap-4">
    {/* Back Button */}
    <button
      onClick={() => router.push("/studio-dashboard/campaigns-tab")}
      className=""
    >
      <img src="/back-button.png" alt="Back" className="w-12 h-12 object-contain" />
    </button>

    {/* Title + Duration */}
    <div className="flex flex-col">
      <h3 className="text-[26px] font-semibold leading-[40.3px] tracking-[-0.65px] text-[#1c2533]">{title || "Untitled Campaign"}</h3>

      {/* Dates with calendar icon */}
      <div className="flex items-center gap-2 text-[#69728a] text-sm mt-1">
        <img src="/calendar.png" alt="Calendar" className="w-4 h-4" />
        <span>
          {startDate && endDate
            ? formatDateRange(startDate, endDate)
            : "Dates not set"}
        </span>
      </div>
    </div>

    {/* Active Status Button */}
    <button className="">
      <img src="/active.png" alt="Active" className="w-12 h-12 object-contain" />
    </button>
  </div>

  {/* Right side: Pause + Edit */}
  <div className="flex items-center gap-3">
    <button className="">
      <img src="/pause.png" alt="Pause" className="w-18 h-8 object-contain" />
    </button>

    <button
      onClick={() => router.push(`/studio-dashboard/create-new-campaign?edit=${campaign._id}`)}
    >
      <img src="/edit-campaign.png" alt="Edit Campaign" className="w-18 h-8 object-contain" />
    </button>
  </div>
</div>

{/* Three Horizontal Cards */}
<div className="flex gap-6 mt-6">
  {/* Card 1 */}
  <div className="flex-1 bg-white rounded-[40px] p-4 flex items-start gap-4 border-[0.833px] border-[rgba(28,37,51,0.09)]">
    <img src="/ref-icon.png" alt="Icon 1" className="w-10 h-10 object-contain" />
    <div className="flex flex-col">
      <h4 className="text-lg font-semibold text-[#1c2533]">Total Participants</h4>
      <p className="text-[#8a3ffc] text-xl font-extrabold">
        5
      </p>
    </div>
  </div>

  {/* Card 2 */}
  <div className="flex-1 bg-white rounded-[40px] p-4 flex items-start gap-4 border-[0.833px] border-[rgba(28,37,51,0.09)]">
    <img src="/approved.png" alt="Icon 2" className="w-10 h-10 object-contain" />
    <div className="flex flex-col">
      <h4 className="text-lg font-semibold text-[#1c2533]">Total Tasks Completed</h4>
      <p className="text-[#8a3ffc] text-xl font-extrabold">
        3
      </p>
    </div>
  </div>

  {/* Card 3 */}
  <div className="flex-1 bg-white rounded-[40px] p-4 flex items-start gap-4 border-[0.833px] border-[rgba(28,37,51,0.09)]">
    <img src="/intuition-icon.png" alt="Icon 3" className="w-10 h-10 object-contain" />
    <div className="flex flex-col">
      <h4 className="text-lg font-semibold text-[#1c2533]">Rewards Distributed</h4>
      <p className="text-[#8a3ffc] text-xl font-extrabold">
        50,000 TRUST
      </p>
    </div>
  </div>
</div>


          {/* Task Overview */}
          <div className="flex items-center justify-between mt-6">
            <h3 className="text-xl font-semibold text-[#1c2533]">Task Overview</h3>
            <button className="px-3 py-1 bg-[#8B3EFE] text-white rounded-[40px] text-sm font-semibold hover:bg-[#7b35e6] transition">
              Manage Tasks
            </button>
          </div>

        <Card className="p-8 space-y-6 bg-white border-[0.833px] border-[rgba(28,37,51,0.09)] rounded-[40px] shadow-none text-[#1c2533]">
          {tasks.length > 0 && (
            <div className="relative mt-2 space-y-4">
              {tasks.map((task, index) => (
                <div key={index} className="flex items-center justify-between gap-4 rounded-[20px] border-[0.833px] border-[rgba(138,63,252,0.28)] px-4 py-3 bg-[#f4f1fc]">
                  <div className="flex items-center justify-center w-8 h-8 bg-[rgba(138,63,252,0.1)] rounded-full text-[#8a3ffc] font-semibold">{index + 1}</div>
                  <p className="flex-1 text-[#1c2533]">{task.type}</p>
                  <div className="flex items-center gap-2">
                    <button
                      className="px-3 py-1 bg-[#8B3EFE] text-white rounded-[40px] text-sm font-semibold hover:bg-[#7b35e6] transition"
                      onClick={() => {
                        if (!task.handleOrUrl) return;
                        let url = task.handleOrUrl.trim();
                        if (!/^https?:\/\//i.test(url)) url = `https://${url}`;
                        window.open(url, "_blank");
                      }}
                    >
                      View
                    </button>
                    <button
                      className="px-3 py-1 bg-[#f7f4fe] border-[0.833px] border-[rgba(28,37,51,0.15)] text-[#1c2533] rounded-[40px] text-sm font-semibold hover:bg-[#efeafb] transition"
                    >
                      Edit
                    </button>
                  </div>
                </div>
              ))}

              {/* Task counter */}
              <span className="absolute -bottom-8 right-2 text-[#69728a] text-sm mt-2">
                {tasks.length}/{tasks.length}
              </span>
            </div>
          )}

          {/* Footer Buttons */}
          <div className="flex items-center justify-between mt-8">
            <button
              className="px-4 py-2 bg-[#f7f4fe] border-[0.833px] border-[rgba(28,37,51,0.15)] text-[#1c2533] rounded-[40px] text-sm font-semibold hover:bg-[#efeafb] transition"
              onClick={() => router.push("/studio-dashboard")}
            >
              Back
            </button>
            <button className="px-4 py-2 bg-[#8B3EFE] text-white rounded-[40px] text-sm font-semibold hover:bg-[#7b35e6] transition">
              Save
            </button>
          </div>
        </Card>
    </div>
  );
}
