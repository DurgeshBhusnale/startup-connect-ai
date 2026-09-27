import {
  ClockIcon,
  LightbulbIcon,
  LockIcon,
  ShieldCheckIcon,
  SparklesIcon,
  WorkflowIcon,
} from "@/components/icons";

import type { IconComponent } from "@/components/icons";
import type { ReactNode } from "react";

export type RoleLandingContent = {
  /** Used for the page title and the "you are here" nav state. */
  role: "investor" | "mentor";
  badge: string;
  headline: ReactNode;
  subhead: string;
  primaryCta: string;
  heroStats: ReadonlyArray<{ value: string; label: string }>;
  preview: {
    label: string;
    filters: ReadonlyArray<{ label: string; value: string }>;
    person: { initials: string; name: string; meta: string; fit: number };
    reason: string;
  };
  valueProps: ReadonlyArray<{
    icon: IconComponent;
    title: string;
    body: string;
    proof: string;
  }>;
  steps: ReadonlyArray<{ title: string; body: string; proof: string }>;
  explanation: {
    title: string;
    intro: string;
    quote: string;
    citations: readonly string[];
    concern: string;
  };
  control: { title: string; body: string; items: readonly string[] };
  faqs: ReadonlyArray<{ question: string; answer: string }>;
  closing: { title: string; body: string };
};

export const investorLandingContent: RoleLandingContent = {
  role: "investor",
  badge: "Now onboarding angels & micro-VCs across India",
  headline: (
    <>
      Deal flow that already fits your thesis —{" "}
      <span className="text-emerald">and tells you why</span>.
    </>
  ),
  subhead:
    "Set your sectors, stages, cheque range and geographies once. Every early-stage founder is scored against them, and each match arrives with the reasoning behind it — so your queue stays short and nothing in it is a mystery.",
  primaryCta: "Create investor profile",
  heroStats: [
    { value: "5 fields", label: "Define your whole thesis" },
    { value: "0", label: "Cold pitches in your inbox" },
    { value: "100%", label: "Matches with a written reason" },
  ],
  preview: {
    label: "Your thesis → your queue",
    filters: [
      { label: "Sectors", value: "Fintech · SaaS" },
      { label: "Stage", value: "Seed" },
      { label: "Cheque", value: "₹25L – ₹75L" },
      { label: "Geographies", value: "Pune · Bengaluru" },
    ],
    person: {
      initials: "RS",
      name: "Riya Sharma",
      meta: "Fintech SaaS · ₹40L seed · Pune",
      fit: 78,
    },
    reason:
      "Sector match (Fintech), stage match (Seed), ask within your cheque range, geographic overlap in Pune.",
  },
  valueProps: [
    {
      icon: WorkflowIcon,
      title: "A queue filtered before you ever see it",
      body: "Founders reach your list only if their sector overlaps your thesis and clears your no-gos. Stage, cheque fit, geography and semantic similarity then set the order.",
      proof: "Anything below a 0.5 fit is never shown",
    },
    {
      icon: SparklesIcon,
      title: "Every match explained, with citations",
      body: "Each signal carries a plain-language reason, any concern worth raising, and the value it came from — taken from the founder’s own profile, never invented by the model.",
      proof: "Numbers the facts don’t support get dropped",
    },
    {
      icon: LockIcon,
      title: "Founders come to you, not at you",
      body: "There is no cold outreach and no bulk mail. A founder requests an intro; you accept or decline. Messaging only opens once both sides have agreed.",
      proof: "Intro request → your accept → messaging",
    },
    {
      icon: ShieldCheckIcon,
      title: "Signals you can sanity-check",
      body: "Responsiveness badges built from real activity, endorsements from investors and mentors who have met the founder, and the founder’s own milestone updates sit on every profile.",
      proof: "Trust badges · endorsements · founder updates",
    },
  ],
  steps: [
    {
      title: "Set your thesis",
      body: "Sectors, stages, cheque range, geographies and no-gos — plus prior investments if you want them on your profile.",
      proof: "About 3 minutes, editable any time",
    },
    {
      title: "Get ranked matches",
      body: "Your thesis is embedded and scored against every visible founder. Weak fits are filtered out rather than padded into a feed.",
      proof: "Refreshes as founders update their profiles",
    },
    {
      title: "Accept the intros worth your time",
      body: "Save a founder for later, mark “not a fit” with a reason, or accept the intro request and open the conversation.",
      proof: "Your reasons are stored to tune the ranking",
    },
    {
      title: "Meet, then log the outcome",
      body: "Share a Cal.com link, meet, and record how it went in one tap. Private notes stay private to you — the other side never sees them.",
      proof: "In-app reminders at 24h and 1h",
    },
  ],
  explanation: {
    title: "You get the reasoning, not just a score",
    intro:
      "This is what a match looks like when you open it. Every line is traced back to a field somebody actually filled in.",
    quote:
      "Sector match (Fintech), stage match (Seed), and an ask of ₹40L that sits inside your ₹25L–₹75L cheque range. Both of you are active in Pune.",
    citations: [
      "Fintech · Seed — founder’s profile",
      "Ask ₹40L — founder’s profile",
      "Cheque ₹25L – ₹75L — your thesis",
      "Pune — founder’s profile",
    ],
    concern: "Team of 2 with no prior exits — worth probing on the hiring plan.",
  },
  control: {
    title: "Your data, your visibility",
    body: "Built for India’s DPDP Act, and boring on purpose: nothing leaves the platform without you asking it to.",
    items: [
      "Hide your cheque range from founders with a single setting.",
      "Notifications are in-app only — no email or WhatsApp blasts in v1.",
      "Withdraw matching consent to disappear from matching without losing your profile.",
      "Export everything as JSON, or delete your account with a 30-day restore window.",
    ],
  },
  faqs: [
    {
      question: "What does it cost?",
      answer:
        "Nothing. Startup Connect AI is free while we run a private beta with our first cohort of founders, angels and mentors.",
    },
    {
      question: "How many founders will I actually see?",
      answer:
        "Only the ones that clear your thesis filters and the fit threshold — sometimes a handful, sometimes none that week. We would rather show you nothing than pad the list.",
    },
    {
      question: "Can founders see my cheque range?",
      answer:
        "Only if you let them. Hiding cheque sizes is one toggle in investor settings, and your prior investments are yours to add or leave out.",
    },
    {
      question: "What if the AI gets a match wrong?",
      answer:
        "Tell it. “Not a fit” with a reason is a first-class action, and because every match ships with its reasoning you can check the logic instead of trusting a number.",
    },
  ],
  closing: {
    title: "Fill in your thesis once. Let the filtering happen before your inbox.",
    body: "Set up an investor profile in about three minutes and see what the first pass surfaces.",
  },
};

export const mentorLandingContent: RoleLandingContent = {
  role: "mentor",
  badge: "Now onboarding operators & sector experts",
  headline: (
    <>
      Mentor the founders who <span className="text-emerald">actually need what you know</span>.
    </>
  ),
  subhead:
    "Pick your expertise areas, the stages you are useful at, and how often you can show up. We surface founders whose current ask lines up with your experience — and tell them exactly why you, so nobody’s time gets wasted on a bad first call.",
  primaryCta: "Create mentor profile",
  heroStats: [
    { value: "20", label: "Expertise areas to pick from" },
    { value: "1–4", label: "Sessions a month, your call" },
    { value: "100%", label: "Matches with a written reason" },
  ],
  preview: {
    label: "Your expertise → your matches",
    filters: [
      { label: "Expertise", value: "GTM · Pricing" },
      { label: "Stages", value: "Pre-seed · Seed" },
      { label: "Availability", value: "2 sessions / month" },
      { label: "Sector focus", value: "Fintech · SaaS" },
    ],
    person: {
      initials: "RS",
      name: "Riya Sharma",
      meta: "Fintech SaaS · Seed · Pune",
      fit: 74,
    },
    reason:
      "Stage match (Seed), and her pinned ask — pricing a B2B product for enterprise buyers — maps to your GTM and Pricing expertise.",
  },
  valueProps: [
    {
      icon: LightbulbIcon,
      title: "Matched on what you actually do",
      body: "Expertise areas like GTM, pricing, hiring or enterprise sales — combined with the stages you are useful at and how close your experience sits to what a founder is building.",
      proof: "Expertise + stage + semantic fit",
    },
    {
      icon: ClockIcon,
      title: "Your calendar stays yours",
      body: "Say how many sessions a month you can take, accept only the intros you want, and share a Cal.com link when you are ready to meet. A match carries no obligation.",
      proof: "1, 2, 4 sessions a month, or open",
    },
    {
      icon: SparklesIcon,
      title: "Founders arrive with context",
      body: "Their stage, sector, current milestones and a pinned “currently asking for” line are all on the profile before the first call — along with the reasoning for why you were matched.",
      proof: "No “can I pick your brain?” cold DMs",
    },
    {
      icon: ShieldCheckIcon,
      title: "Credit that compounds",
      body: "Endorse the claims you can personally vouch for, earn responsiveness badges from real activity, and build a track record of founders you have actually helped.",
      proof: "Endorsements · response-history badges",
    },
  ],
  steps: [
    {
      title: "Tell us your expertise",
      body: "Areas you can genuinely help with, the stages you are useful at, your availability, and a session fee if you charge one.",
      proof: "About 3 minutes, editable any time",
    },
    {
      title: "See founders matched to your stage and skills",
      body: "Founders are scored against your expertise and stages. Weak fits are filtered out instead of being shown as a maybe.",
      proof: "Anything below a 0.5 fit is never shown",
    },
    {
      title: "Accept an intro when it fits",
      body: "Founders request; you accept or decline. Declining costs nothing and takes one click. Messaging opens only after you both agree.",
      proof: "You are never auto-introduced",
    },
    {
      title: "Meet, then log how it went",
      body: "Book through Cal.com, meet, and record the outcome afterwards. Your private notes are never shown to the founder.",
      proof: "In-app reminders at 24h and 1h",
    },
  ],
  explanation: {
    title: "You see why you were matched, before you say yes",
    intro:
      "Every line in an explanation is traced back to something the founder actually filled in, or to your own expertise profile.",
    quote:
      "Stage match (Seed), and she is asking for help taking a B2B product into enterprise pricing — two of your strongest expertise areas.",
    citations: [
      "Seed — founder’s profile",
      "Enterprise pricing — founder’s pinned ask",
      "GTM, Pricing — your expertise",
      "Fintech SaaS — founder’s profile",
    ],
    concern: "She has no enterprise deals closed yet, so expect groundwork before pricing strategy.",
  },
  control: {
    title: "Give time on your terms",
    body: "Built for India’s DPDP Act, and designed so that saying no is as easy as saying yes.",
    items: [
      "Availability and session fee are yours to set, and every intro still needs your explicit accept.",
      "Notifications are in-app only — no email or WhatsApp blasts in v1.",
      "Withdraw matching consent to disappear from matching without losing your profile.",
      "Export everything as JSON, or delete your account with a 30-day restore window.",
    ],
  },
  faqs: [
    {
      question: "Is this paid mentoring?",
      answer:
        "That is up to you. You can record a session fee on your profile, but payments do not run through the platform in v1 — you arrange those directly with the founder.",
    },
    {
      question: "How much time does it take?",
      answer:
        "As much as you agree to. You set sessions per month on your profile, every intro needs your accept, and declining takes one click.",
    },
    {
      question: "Do I need a verified badge to be useful?",
      answer:
        "No. Verification is coming; until then your expertise, your endorsements from founders you have helped, and your response history do the talking.",
    },
    {
      question: "What if a founder isn’t a fit?",
      answer:
        "Mark “not a fit” with a reason. They drop off your list, and the reason is stored to tune how future founders are ranked for you.",
    },
  ],
  closing: {
    title: "Your experience, pointed at the founders who need it most.",
    body: "Set up a mentor profile in about three minutes and see who is asking for what you know.",
  },
};
