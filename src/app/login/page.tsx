"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("Use your Supabase Auth email and password.");

  async function handleLogin(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);

    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setMessage(`Login failed: ${error.message}`);
      setLoading(false);
      return;
    }

    router.replace("/projects");
    router.refresh();
  }

  async function handleSignUp() {
    setLoading(true);

    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
          emailRedirectTo: `${window.location.origin}/projects`,
      },
    });

    if (error) {
      setMessage(`Signup failed: ${error.message}`);
      setLoading(false);
      return;
    }

    setMessage("Signup successful. Check your email if confirmation is required.");
    setLoading(false);
  }

  return (
    <main className="relative min-h-screen overflow-hidden bg-[radial-gradient(circle_at_10%_20%,#0f766e_0%,#020617_42%,#020617_100%)] px-4 py-10 text-slate-100">
      <div className="mx-auto max-w-md rounded-2xl border border-cyan-300/20 bg-slate-950/80 p-6 shadow-2xl backdrop-blur">
        <p className="text-xs uppercase tracking-[0.25em] text-cyan-300">Private Access</p>
        <h1 className="mt-2 text-2xl font-semibold">RGV Water GIS Command Center</h1>
        <p className="mt-1 text-sm text-slate-300">Secure map planning workspace for infrastructure strategy.</p>

        <form onSubmit={handleLogin} className="mt-6 space-y-3">
          <div>
            <label className="mb-1 block text-xs text-slate-300">Email</label>
            <input
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              className="w-full rounded-md border border-slate-600 bg-slate-900 px-3 py-2 text-sm"
              placeholder="you@domain.com"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs text-slate-300">Password</label>
            <input
              type="password"
              required
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full rounded-md border border-slate-600 bg-slate-900 px-3 py-2 text-sm"
              placeholder="********"
            />
          </div>
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-md bg-cyan-600 px-4 py-2 text-sm font-semibold text-white transition hover:bg-cyan-500 disabled:opacity-60"
          >
            {loading ? "Please wait..." : "Login"}
          </button>
          <button
            type="button"
            disabled={loading}
            onClick={handleSignUp}
            className="w-full rounded-md border border-cyan-500/60 bg-transparent px-4 py-2 text-sm font-semibold text-cyan-300 transition hover:bg-cyan-500/10 disabled:opacity-60"
          >
            Create account
          </button>
        </form>

        <p className="mt-4 rounded-md border border-slate-700 bg-slate-900 p-2 text-xs text-slate-300">{message}</p>
        <p className="mt-4 text-xs text-slate-400">Need setup steps? Open README.md in the project root.</p>
      </div>
    </main>
  );
}
