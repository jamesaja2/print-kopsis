import SignUpForm from "@/components/auth/SignUpForm";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "KOPSIS SignUp Page",
  description: "Create an account to access the KOPSIS Dashboard",
  // other metadata
};

export default function SignUp() {
  return <SignUpForm />;
}

