import type { CreatedLogin } from "../../actions";

/** A new login, shown once to the KMF admin to pass on to the person. */
export function LoginSlip({ login }: { login: CreatedLogin }) {
  return (
    <div className="rounded-[var(--radius-card)] border border-dashed border-line-strong bg-brand-wash p-4">
      <p className="text-sm font-semibold">Pass these details to {login.name}. The password is shown only once.</p>
      <dl className="mt-3 grid grid-cols-[auto_1fr] gap-x-4 gap-y-1 text-sm">
        <dt className="text-ink-muted">Login</dt>
        <dd className="break-all font-mono font-bold">{login.login}</dd>
        <dt className="text-ink-muted">Password</dt>
        <dd className="font-mono font-bold tracking-wider">{login.password ?? <span className="font-sans tracking-normal">They already have an account; their password is unchanged.</span>}</dd>
      </dl>
    </div>
  );
}
