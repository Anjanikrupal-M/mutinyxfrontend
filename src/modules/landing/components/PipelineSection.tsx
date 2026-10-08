import React from "react";
import { Timeline } from "@/shared/ui/timeline";
import ln1Img from "@/assets/landing_page_photos/launch_and_negotiate_1.jpg";
import ln2Img from "@/assets/landing_page_photos/launch_and_negotiate_2.jpg";
import ad1Img from "@/assets/landing_page_photos/applicants_dashboard_1.jpg";
import ad2Img from "@/assets/landing_page_photos/applicants_dashboard_2.jpg";
import tm1Img from "@/assets/landing_page_photos/the_tracking_module_1.jpg";
import tm2Img from "@/assets/landing_page_photos/the_tracking_module_2.jpg";
import ab1Img from "@/assets/landing_page_photos/analytics_and_boosting_1.jpg";
import ab2Img from "@/assets/landing_page_photos/analytics_and_boosting_2.jpg";

export function PipelineSection() {
  const timelineData = [
    {
      title: "01. Launch & Negotiate",
      content: (
        <div>
          <p className="mb-8 text-neutral-800 text-sm dark:text-neutral-200 font-geist">
            Publish an open call to the marketplace, or use Direct Connect to negotiate terms 1-on-1 with targeted influencers.
          </p>
          <div className="grid grid-cols-2 gap-4">
            <img
              src={ln1Img}
              alt="Launch and Negotiate 1"
              width={3991}
              height={2820}
              className="w-full h-auto rounded-lg object-cover shadow-[0_0_24px_rgba(34,_42,_53,_0.06),_0_1px_1px_rgba(0,_0,_0,_0.05),_0_0_0_1px_rgba(34,_42,_53,_0.04),_0_0_4px_rgba(34,_42,_53,_0.08),_0_16px_68px_rgba(47,_48,_55,_0.05),_0_1px_0_rgba(255,_255,_255,_0.1)_inset]"
            />
            <img
              src={ln2Img}
              alt="Launch and Negotiate 2"
              width={3991}
              height={2820}
              className="w-full h-auto rounded-lg object-cover shadow-[0_0_24px_rgba(34,_42,_53,_0.06),_0_1px_1px_rgba(0,_0,_0,_0.05),_0_0_0_1px_rgba(34,_42,_53,_0.04),_0_0_4px_rgba(34,_42,_53,_0.08),_0_16px_68px_rgba(47,_48,_55,_0.05),_0_1px_0_rgba(255,_255,_255,_0.1)_inset]"
            />
          </div>
        </div>
      ),
    },
    {
      title: "02. Applicants Dashboard",
      content: (
        <div>
          <p className="mb-8 text-neutral-800 text-sm dark:text-neutral-200 font-geist">
            Sort applicants by engagement rate, view proposed prices, and watch our AI allocate your budget.
          </p>
          <div className="grid grid-cols-2 gap-4">
            <img
              src={ad1Img}
              alt="Applicants Dashboard 1"
              width={3991}
              height={2820}
              className="w-full h-auto rounded-lg object-cover shadow-[0_0_24px_rgba(34,_42,_53,_0.06),_0_1px_1px_rgba(0,_0,_0,_0.05),_0_0_0_1px_rgba(34,_42,_53,_0.04),_0_0_4px_rgba(34,_42,_53,_0.08),_0_16px_68px_rgba(47,_48,_55,_0.05),_0_1px_0_rgba(255,_255,_255,_0.1)_inset]"
            />
            <img
              src={ad2Img}
              alt="Applicants Dashboard 2"
              width={3991}
              height={2820}
              className="w-full h-auto rounded-lg object-cover shadow-[0_0_24px_rgba(34,_42,_53,_0.06),_0_1px_1px_rgba(0,_0,_0,_0.05),_0_0_0_1px_rgba(34,_42,_53,_0.04),_0_0_4px_rgba(34,_42,_53,_0.08),_0_16px_68px_rgba(47,_48,_55,_0.05),_0_1px_0_rgba(255,_255,_255,_0.1)_inset]"
            />
          </div>
        </div>
      ),
    },
    {
      title: "03. The Tracking Module",
      content: (
        <div>
          <p className="mb-8 text-neutral-800 text-sm dark:text-neutral-200 font-geist">
            Review every stage of content. Manage feedback loops from initial Script to Draft Video to Final Content right inside the platform.
          </p>
          <div className="grid grid-cols-2 gap-4">
            <img
              src={tm1Img}
              alt="The Tracking Module 1"
              width={3991}
              height={2820}
              className="w-full h-auto rounded-lg object-cover shadow-[0_0_24px_rgba(34,_42,_53,_0.06),_0_1px_1px_rgba(0,_0,_0,_0.05),_0_0_0_1px_rgba(34,_42,_53,_0.04),_0_0_4px_rgba(34,_42,_53,_0.08),_0_16px_68px_rgba(47,_48,_55,_0.05),_0_1px_0_rgba(255,_255,_255,_0.1)_inset]"
            />
            <img
              src={tm2Img}
              alt="The Tracking Module 2"
              width={3991}
              height={2820}
              className="w-full h-auto rounded-lg object-cover shadow-[0_0_24px_rgba(34,_42,_53,_0.06),_0_1px_1px_rgba(0,_0,_0,_0.05),_0_0_0_1px_rgba(34,_42,_53,_0.04),_0_0_4px_rgba(34,_42,_53,_0.08),_0_16px_68px_rgba(47,_48,_55,_0.05),_0_1px_0_rgba(255,_255,_255,_0.1)_inset]"
            />
          </div>
        </div>
      ),
    },
    {
      title: "04. Analytics & Boosting",
      content: (
        <div>
          <p className="mb-8 text-neutral-800 text-sm dark:text-neutral-200 font-geist">
            Track CPE, reach, and engagement in real-time. Turn your top-performing organic content into Paid Ads.
          </p>
          <div className="grid grid-cols-2 gap-4">
            <img
              src={ab1Img}
              alt="Analytics and Boosting 1"
              width={3991}
              height={2820}
              className="w-full h-auto rounded-lg object-cover shadow-[0_0_24px_rgba(34,_42,_53,_0.06),_0_1px_1px_rgba(0,_0,_0,_0.05),_0_0_0_1px_rgba(34,_42,_53,_0.04),_0_0_4px_rgba(34,_42,_53,_0.08),_0_16px_68px_rgba(47,_48,_55,_0.05),_0_1px_0_rgba(255,_255,_255,_0.1)_inset]"
            />
            <img
              src={ab2Img}
              alt="Analytics and Boosting 2"
              width={3991}
              height={2820}
              className="w-full h-auto rounded-lg object-cover shadow-[0_0_24px_rgba(34,_42,_53,_0.06),_0_1px_1px_rgba(0,_0,_0,_0.05),_0_0_0_1px_rgba(34,_42,_53,_0.04),_0_0_4px_rgba(34,_42,_53,_0.08),_0_16px_68px_rgba(47,_48,_55,_0.05),_0_1px_0_rgba(255,_255,_255,_0.1)_inset]"
            />
          </div>
        </div>
      ),
    }
  ];

  return (
    <section id="pipeline" className="relative overflow-hidden border-b border-border/50">
      <div className="relative w-full overflow-clip">
        <Timeline data={timelineData} />
      </div>
    </section>
  );
}

export default PipelineSection;
