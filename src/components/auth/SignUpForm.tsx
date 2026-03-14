"use client";
import Input from "@/components/form/input/InputField";
import Label from "@/components/form/Label";
import { ChevronLeftIcon } from "@/icons";
import Link from "next/link";
import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { registerAction } from "@/actions/register";
import { signIn } from "next-auth/react";

export default function SignUpForm() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [socialLoading, setSocialLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [formData, setFormData] = useState({
    name: "",
    email: "",
    password: "",
  });

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    const res = await registerAction(formData);

    setLoading(false);

    if (res.error) {
      setError(res.error);
    } else {
      router.push("/signin");
    }
  };

  const handleGoogleSignIn = async () => {
    setSocialLoading(true);
    await signIn("google", { callbackUrl: "/" });
    setSocialLoading(false);
  };

  return (
    <div className="flex flex-col flex-1 lg:w-1/2 w-full p-6 items-center justify-center">
      <div className="w-full max-w-md mx-auto mb-5">
        <Link href="/" className="inline-flex items-center text-sm text-gray-500 hover:text-gray-700">
          <ChevronLeftIcon /> Back to dashboard
        </Link>
      </div>
      <div className="flex flex-col justify-center flex-1 w-full max-w-md mx-auto">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-gray-800 dark:text-white">Sign Up</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400">Create your account</p>
        </div>

        <div className="space-y-4">
            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={socialLoading}
              className="w-full flex items-center justify-center gap-3 border border-gray-200 dark:border-gray-700 rounded-lg px-4 py-3 text-sm font-medium text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-gray-800 disabled:opacity-50"
            >
              <span className="inline-flex h-5 w-5 items-center justify-center rounded-full bg-white">
                <svg className="h-4 w-4" viewBox="0 0 24 24" aria-hidden="true">
                  <path fill="#EA4335" d="M12 10.2v3.92h5.46c-.24 1.24-.99 2.3-2.1 3l3.38 2.62c1.98-1.83 3.12-4.52 3.12-7.72 0-.74-.06-1.45-.18-2.12H12z" />
                  <path fill="#34A853" d="M6.56 14.42l-.86.66-2.7 2.08C4.9 20.66 8.24 23 12 23c2.97 0 5.44-.98 7.26-2.66l-3.38-2.62c-.94.64-2.14 1.02-3.88 1.02-2.98 0-5.5-2.01-6.4-4.8z" />
                  <path fill="#4A90E2" d="M3 7.84C2.09 9.63 1.6 11.72 1.6 14c0 2.28.49 4.37 1.4 6.16l3.36-2.62c-.22-.66-.36-1.38-.36-2.16 0-.78.14-1.5.36-2.16z" />
                  <path fill="#FBBC05" d="M12 5.5c1.62 0 3.06.56 4.2 1.66l3.14-3.14C17.43 1.45 14.96 0.5 12 0.5 8.24 0.5 4.9 2.84 3 6.16l3.36 2.62C6.94 6.58 9.02 5.5 12 5.5z" />
                </svg>
              </span>
              {socialLoading ? "Contacting Google..." : "Sign up with Google"}
            </button>
            <div className="flex items-center gap-2 text-xs text-gray-400">
              <span className="flex-1 border-t border-gray-200 dark:border-gray-700" />
              or continue with email
              <span className="flex-1 border-t border-gray-200 dark:border-gray-700" />
            </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4 mt-6">
            <div>
              <Label>Full Name</Label>
              <Input type="text" name="name" value={formData.name} onChange={handleChange} placeholder="John Doe" />
            </div>
            <div>
              <Label>Email</Label>
              <Input type="email" name="email" value={formData.email} onChange={handleChange} placeholder="email@example.com" />
            </div>
            <div>
              <Label>Password</Label>
              <Input type="password" name="password" value={formData.password} onChange={handleChange} placeholder="******" />
            </div>

            {error && <div className="text-red-500 text-sm bg-red-50 p-2 rounded">{error}</div>}

            <button
              type="submit"
              disabled={loading || socialLoading}
              className="w-full px-4 py-3 text-white bg-brand-500 rounded-lg hover:bg-brand-600 disabled:opacity-50 mt-4"
            >
              {loading ? "Creating Account..." : "Create Account"}
            </button>
            
            <div className="mt-4 text-center">
              <span className="text-sm text-gray-500">Already have an account? </span>
              <Link href="/signin" className="text-sm text-brand-500 hover:underline">
                Sign In
              </Link>
            </div>
        </form>
      </div>
    </div>
  );
}
