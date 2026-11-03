"use client";

import StudioLayout from "@/components/studio/StudioLayout";
import LessonCreate from "../../_components/LessonCreate";

export default function Page() {
  return (
    <StudioLayout title="Create Lesson">
      <LessonCreate />
    </StudioLayout>
  );
}
