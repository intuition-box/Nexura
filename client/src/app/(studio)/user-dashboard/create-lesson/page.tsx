"use client";

import UserLayout from "@/components/studio/UserLayout";
import LessonCreate from "../../_components/LessonCreate";

export default function Page() {
  return (
    <UserLayout title="Create Lesson">
      <LessonCreate />
    </UserLayout>
  );
}
