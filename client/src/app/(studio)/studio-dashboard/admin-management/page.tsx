"use client";

import StudioLayout from "@/components/studio/StudioLayout";
import StudioHeader from "@/components/studio/StudioHeader";
import AdminManagement from "@/components/admin/AdminManagement";

export default function Page() {
  return (
    <StudioLayout title="Admin Management" hideHeader>
      <div className="hidden md:block sticky top-0 z-[100]">
        <StudioHeader title="Admin Management" />
      </div>
      <div className="pt-14 md:pt-0 min-h-full bg-[#f7f5ff]">
        <AdminManagement />
      </div>
    </StudioLayout>
  );
}
