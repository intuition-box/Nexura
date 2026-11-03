"use client";

import React from "react";

const imgRewardIcon72X1 = "/reward.png";
const imgXpIconFill72X3 = "/xp-icon.png";

export default function CreatorRewardsBanner() {
  return (
    <div className="w-full mb-6">
      <div className="backdrop-blur-[6px] bg-[rgba(138,63,252,0.07)] border border-[rgba(138,63,252,0.2)] border-solid overflow-hidden relative rounded-[16px] w-full min-h-[120px] flex flex-col md:flex-row items-center justify-between p-6">
        
        {/* Glow effect */}
        <div className="absolute bg-[rgba(138,63,252,0.15)] blur-[50px] -right-[80px] rounded-full w-[256px] h-[256px] -top-[80px]" />
        
        {/* Left Section */}
        <div className="flex items-center gap-6 relative z-10 w-full md:w-auto mb-4 md:mb-0">
          <div className="flex items-center justify-center shrink-0 rounded-[16px] w-[60px] h-[60px]" style={{ backgroundImage: "linear-gradient(135deg, rgba(138, 63, 252, 0.3) 0%, rgba(91, 94, 233, 0.3) 100%)" }}>
            <div className="relative shrink-0 w-[40px] h-[40px]">
              <img alt="Reward Icon" className="absolute inset-0 max-w-none object-cover pointer-events-none w-full h-full" src={imgRewardIcon72X1} />
            </div>
          </div>
          
          <div className="flex flex-col items-start gap-2">
            <div className="bg-[rgba(131,58,253,0.1)] flex flex-col items-start px-3 py-1 relative rounded-full shrink-0">
              <span className="font-semibold text-[#833afd] text-[10px] tracking-[1.2px] uppercase whitespace-nowrap">
                Creator Rewards
              </span>
            </div>
            <div className="flex flex-col gap-1 items-start">
              <h3 className="font-bold text-[#1c2533] text-[16px]">
                Earn +2,000 XP for every published quest
              </h3>
              <p className="font-medium text-[#968da1] text-[14px]">
                Contribute engagement quests and earn ecosystem recognition.
              </p>
            </div>
          </div>
        </div>

        {/* Right Section (Bonus XP) */}
        <div className="bg-[rgba(255,255,255,0.05)] border border-[rgba(255,255,255,0.1)] border-solid h-[89px] rounded-[12px] w-[97px] flex flex-col items-center justify-center relative z-10 shrink-0">
          <div className="flex gap-[3px] items-center">
            <span className="font-black text-[#1c2533] text-[20px] text-center">
              2K
            </span>
            <div className="relative shrink-0 w-[20px] h-[20px]">
              <img alt="XP Icon" className="absolute inset-0 max-w-none object-cover pointer-events-none w-full h-full" src={imgXpIconFill72X3} />
            </div>
          </div>
          <span className="font-semibold text-[12px] text-[#3d485c] text-center tracking-[-0.5px] uppercase mt-1">
            Bonus XP
          </span>
        </div>

      </div>
    </div>
  );
}
