import type { Metadata } from "next";
import { SignUpForm } from "./SignUpForm";

export const metadata: Metadata = {
  title: "Get started",
  description: "Create your Stonevora account and set up your company in minutes.",
  alternates: { canonical: "/signup" },
};

export default function SignUpPage() {
  return <SignUpForm />;
}
