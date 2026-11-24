import { useEffect, useState } from "react";
import { adminDb } from "../../lib/adminDb";
import { useAuth } from "../../contexts/AuthContext";

const ROLE_OPTIONS = ["manager", "staff", "owner"];

/** Staff access. The owner can grant manager, staff or owner access by email. */
export default function AdminStaff() {
  const { roles: myRoles } = useAuth();
  const isOwner = myRoles?.includes("owner");
  const [profiles, setProfiles] = useState([]);
  const [roles, setRoles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [role, setRole] = useState("staff");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function load() {
    try {
      const data = await adminDb.getStaff();
      setProfiles(data.profiles);
      setRoles(data.roles);
    } catch (err) {
      setError(err.message || "Could not load staff.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function handleAssign(e) {
    e.preventDefault();
    setError("");
    setMessage("");
    try {
      await adminDb.assignRole(email.trim(), role);
      setMessage(`Access granted to ${email.trim()}.`);
      setEmail("");
      load();
    } catch (err) {
      setError(err.message || "Could not assign the role.");
    }
  }

  const rolesFor = (id) => roles.filter((r) => r.user_id === id).map((r) => r.role);

  return (
    <div className="space-y-8">
      {isOwner && (
        <form onSubmit={handleAssign} className="card grid gap-4 p-7 md:grid-cols-[1fr_200px_auto] md:items-end">
          <div>
            <label htmlFor="staff-email" className="mb-2 block text-sm font-semibold text-rosewood">Email of a registered user</label>
            <input id="staff-email" type="email" required value={email} onChange={(e) => setEmail(e.target.value)} className="field" placeholder="name@example.com" />
          </div>
          <div>
            <label htmlFor="staff-role" className="mb-2 block text-sm font-semibold text-rosewood">Role</label>
            <select id="staff-role" value={role} onChange={(e) => setRole(e.target.value)} className="field">
              {ROLE_OPTIONS.map((r) => <option key={r} value={r} className="capitalize">{r}</option>)}
            </select>
          </div>
          <button type="submit" className="btn btn-primary px-7 py-3.5">Grant access</button>
        </form>
      )}

      {message && <p className="rounded-xl border border-[#166534]/25 bg-[#166534]/5 p-4 text-sm text-[#166534]">{message}</p>}
      {error && <p role="alert" className="rounded-xl border border-[#b42318]/30 bg-[#b42318]/5 p-4 text-sm text-[#b42318]">{error}</p>}

      <div className="card overflow-hidden">
        <div className="border-b border-petal/60 bg-blush px-7 py-4">
          <h2 className="text-xl font-semibold text-rosewood">Team and customers</h2>
        </div>
        {loading ? (
          <p className="p-7 text-sm text-cocoa/60">Loading…</p>
        ) : profiles.length === 0 ? (
          <p className="p-7 text-sm text-cocoa/60">No accounts yet.</p>
        ) : (
          <ul className="divide-y divide-petal/60">
            {profiles.map((p) => {
              const list = rolesFor(p.id);
              return (
                <li key={p.id} className="flex flex-wrap items-center justify-between gap-3 px-7 py-4">
                  <div>
                    <p className="font-semibold text-cocoa">{p.full_name || "No name"}</p>
                    <p className="text-xs text-cocoa/55">{p.email || "No email"}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {list.length === 0 ? (
                      <span className="rounded-full bg-cocoa/5 px-3 py-1 text-xs text-cocoa/60">Customer</span>
                    ) : (
                      list.map((r) => (
                        <span key={r} className="rounded-full bg-rosewood/10 px-3 py-1 text-xs font-semibold capitalize text-rosewood">{r}</span>
                      ))
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
}
