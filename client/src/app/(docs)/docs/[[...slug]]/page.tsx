"use client";

import { useState, useEffect } from "react";
import { useParams, useRouter } from "next/navigation";

import DocsSidebar from "@/components/DocsSidebar";
import DocsHeader from "@/components/DocsHeader";
import OnThisPage from "@/components/docs/content/OnThisPage";

import Introduction from "@/components/docs/content/Introduction";
import KeyFeatures from "@/components/docs/content/KeyFeatures";
import NexonSystem from "@/components/docs/content/TheNexonSystem";
import GettingStarted from "@/components/docs/content/GettingStartedOnNexura";
import TechnicalOverview from "@/components/docs/content/TechnicalOverview";
import ArchitecturalLayer from "@/components/docs/content/ArchitecturalLayer";
import FAQs from "@/components/docs/content/FAQs";
import Legal, { LEGAL_SECTIONS } from "@/components/docs/content/Legal";

const docsContentMap: any = {
  introduction: Introduction,
  features: KeyFeatures,
  gettingstarted: GettingStarted,
  nexonsystem: NexonSystem,
  technicaloverview: TechnicalOverview,
  architecturallayer: ArchitecturalLayer,
  faqs: FAQs,
  legal: Legal,
};

const docsMap: any = {
  introduction: { topic: "INTRODUCTION", subtopic: "Introduction" },
  features: { topic: "CORE CONCEPTS", subtopic: "Key Features" },
  gettingstarted: { topic: "USING NEXURA", subtopic: "Getting Started" },
  nexonsystem: { topic: "USING NEXURA", subtopic: "The Nexon System" },
  technicaloverview: { topic: "TECHNICAL OVERVIEW", subtopic: "Nexura Technical Overview" },
  architecturallayer: { topic: "TECHNICAL OVERVIEW", subtopic: "Architectural Layer" },
  faqs: { topic: "SUPPORT", subtopic: "Frequently Asked Questions" },
  legal: { topic: "LEGAL", subtopic: "Terms, Policies and Disclaimer" },
};

const docsSectionsMap: any = {
  introduction: [
    { id: "introduction", title: "Introduction", level: 1 },
    { id: "the-problem", title: "The Problem", level: 3 },
    { id: "the-solution", title: "The Solution", level: 3 },
    { id: "what-is-nexura", title: "What is Nexura?", level: 1 },
    { id: "the-vision", title: "The Vision", level: 3 },
    { id: "built-on", title: "What Nexura is Built On", level: 2 },
    { id: "who-serves", title: "Who Nexura Serves", level: 2 },
  ],
  features: [
    { id: "key-features", title: "Key Features", level: 1 },
    { id: "learn", title: "Learn", level: 3 },
    { id: "explore", title: "Explore", level: 3 },
    { id: "referrals", title: "Referrals", level: 3 },
    { id: "quests", title: "Quests", level: 3 },
    { id: "campaigns", title: "Campaigns", level: 3 },
    { id: "ecosystem-dapps", title: "Ecosystem Dapps", level: 3 },
    { id: "leaderboard", title: "Leaderboard", level: 3 },
    { id: "portal-claims", title: "Portal Claims", level: 3 },
    { id: "analytics", title: "Analytics", level: 3 },
    { id: "nexura-studio", title: "Nexura Studio", level: 1 },
  ],
  gettingstarted: [
    { id: "getting-started", title: "Getting Started", level: 1 },
    { id: "rewards", title: "Rewards", level: 1 },
    { id: "what-is-xp", title: "What is XP?", level: 3 },
  ],
  nexonsystem: [
    { id: "what-is-a-nexon", title: "What is a Nexon?", level: 1 },
    { id: "the-path-of-the-nexon", title: "The Path of the Nexon", level: 1 },
    { id: "nexon-progression-model", title: "Nexon Progression Model", level: 1 },
  ],
  technicaloverview: [
    { id: "nexura-technical-overview", title: "Nexura Technical Overview", level: 1 },
    { id: "stack-at-a-glance", title: "Stack at a Glance", level: 3 },
  ],
  architecturallayer: [
    { id: "architectural-layer", title: "Architectural Layer", level: 1 },
    { id: "best-practices-for-users", title: "Best Practices for Users", level: 3 },
    { id: "best-practices-for-builders", title: "Best Practices for Builders", level: 3 },
  ],
  faqs: [
    { id: "frequently-asked-questions", title: "Frequently Asked Questions", level: 1 },
  ],
  legal: LEGAL_SECTIONS,
};

const Docs = () => {
  const router = useRouter();
  const params = useParams();
  const [searchQuery, setSearchQuery] = useState("");

  const slugParam = params?.slug as string[] | undefined;
  const slug = slugParam?.[0] || "introduction";

  const current = docsMap[slug];
  const ActiveContent = docsContentMap[slug];
  const sections = docsSectionsMap[slug] || [];

  const docsOrder = Object.keys(docsMap);
  const currentIndex = docsOrder.indexOf(slug);

  const handleNext = () => {
    if (currentIndex < docsOrder.length - 1) {
      router.push(`/docs/${docsOrder[currentIndex + 1]}`);
    }
  };

  const handlePrev = () => {
    if (currentIndex > 0) {
      router.push(`/docs/${docsOrder[currentIndex - 1]}`);
    }
  };

  const handleNavigateToSection = (id: string) => {
    const el = document.getElementById(id);
    if (!el) return;

    el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  useEffect(() => {
    window.scrollTo(0, 0);
    const id = window.location.hash.slice(1);
    if (id) requestAnimationFrame(() => document.getElementById(id)?.scrollIntoView({ block: "start" }));
  }, [slug]);

  return (
    <div className="flex flex-col lg:flex-row">

      <DocsSidebar
        active={slug}
        setActive={(id: string) => router.push(`/docs/${id}`)}
        searchQuery={searchQuery}
        setSearchQuery={setSearchQuery}
      />

      <div className="flex-1 flex justify-center">
        <div className="w-full max-w-[59rem] p-4 lg:p-6 text-white">

          <DocsHeader topic={current.topic} />

          <h1
            className="text-2xl lg:text-3xl font-bold mb-4"
            style={{
              background: "linear-gradient(90deg, #FFFFFF, #C287FC)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
            }}
          >
            {current.subtopic}
          </h1>

          <div className="block lg:hidden mb-6">
            <OnThisPage sections={sections} />
          </div>

          <ActiveContent
            onNext={handleNext}
            onPrev={handlePrev}
            searchQuery={searchQuery}
          />
        </div>

        <div className="hidden lg:block w-[14rem] sticky top-0 h-fit self-start -ml-4">
          <OnThisPage sections={sections} />
        </div>

      </div>
    </div>
  );
};

export default Docs;
