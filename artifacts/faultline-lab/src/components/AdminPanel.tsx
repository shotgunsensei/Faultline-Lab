import { useEffect, useState, useSyncExternalStore } from 'react';
import { useAppStore } from '@/stores/useAppStore';
import { CATALOG, formatPrice, applyCatalogOverrides, revertCatalogProduct, subscribeCatalog, type CatalogProduct } from '@/data/catalog';
import {
  addOwnedProduct,
  getEntitlements,
  removeOwnedProduct,
  subscribeEntitlements,
} from '@/lib/entitlements';
import {
  adminFetchUsers,
  adminFetchUserEntitlements,
  adminGrantEntitlement,
  adminRevokeEntitlement,
  adminFetchCatalogOverrides,
  adminSaveCatalogOverride,
  adminRevertCatalogOverride,
  adminUpdateUserRole,
  adminDeleteUser,
  type CatalogOverridePayload,
} from '@/lib/api';
import { toast } from 'sonner';
import {
  ArrowLeft,
  Star,
  StarOff,
  Power,
  PowerOff,
  Shield,
  ShieldOff,
  UserSearch,
  Plus,
  Trash2,
  Pencil,
  Save,
  X,
  Tag,
  Undo2,
} from 'lucide-react';

type CatalogOverride = CatalogOverridePayload;

type CatalogOverrideEditor = {
  id: string;
  displayName: string | null;
  email: string | null;
};

type CatalogOverrideMeta = {
  updatedAt: string | null;
  editor: CatalogOverrideEditor | null;
};

function formatRelativeTime(iso: string | null | undefined): string {
  if (!iso) return '';
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const diffMs = Date.now() - then;
  const sec = Math.max(1, Math.round(diffMs / 1000));
  if (sec < 60) return `${sec}s ago`;
  const min = Math.round(sec / 60);
  if (min < 60) return `${min}m ago`;
  const hr = Math.round(min / 60);
  if (hr < 24) return `${hr}h ago`;
  const day = Math.round(hr / 24);
  if (day < 30) return `${day}d ago`;
  const mo = Math.round(day / 30);
  if (mo < 12) return `${mo}mo ago`;
  return `${Math.round(mo / 12)}y ago`;
}

interface AdminUser {
  id: string;
  clerkId: string | null;
  email: string | null;
  displayName: string | null;
  isAdmin: boolean;
  isSuperAdmin: boolean;
}

interface UserEntitlement {
  id: string;
  productId: string;
  entitlementType: string;
  source: string;
  isActive: boolean;
  grantedAt: string;
}

export default function AdminPanel() {
  const setView = useAppStore((s) => s.setView);
  const ent = useSyncExternalStore(
    (cb) => subscribeEntitlements(cb),
    () => getEntitlements()
  );
  const [tab, setTab] = useState<'catalog' | 'users'>('catalog');
  const [overrides, setOverrides] = useState<Record<string, CatalogOverride>>({});
  const [overrideMeta, setOverrideMeta] = useState<Record<string, CatalogOverrideMeta>>({});
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState<CatalogOverride>({});
  useSyncExternalStore(
    (cb) => subscribeCatalog(cb),
    () => CATALOG.length
  );

  useEffect(() => {
    adminFetchCatalogOverrides()
      .then((r: { overrides?: Array<Record<string, unknown>> }) => {
        const map: Record<string, CatalogOverride> = {};
        const metaMap: Record<string, CatalogOverrideMeta> = {};
        for (const raw of r.overrides || []) {
          const productId = String(raw.productId || '');
          if (!productId) continue;
          const override: CatalogOverride = {};
          if (raw.status === 'available' || raw.status === 'coming-soon' || raw.status === 'disabled') {
            override.status = raw.status;
          }
          if (typeof raw.featured === 'boolean') override.featured = raw.featured;
          if (typeof raw.shortDescription === 'string') override.shortDescription = raw.shortDescription;
          if (typeof raw.longDescription === 'string') override.longDescription = raw.longDescription;
          if (Array.isArray(raw.tags)) override.tags = raw.tags.filter((t): t is string => typeof t === 'string');
          map[productId] = override;
          const editorRaw = raw.editor as
            | { id?: unknown; displayName?: unknown; email?: unknown }
            | null
            | undefined;
          metaMap[productId] = {
            updatedAt: typeof raw.updatedAt === 'string' ? raw.updatedAt : null,
            editor: editorRaw && typeof editorRaw.id === 'string'
              ? {
                  id: editorRaw.id,
                  displayName: typeof editorRaw.displayName === 'string' ? editorRaw.displayName : null,
                  email: typeof editorRaw.email === 'string' ? editorRaw.email : null,
                }
              : null,
          };
        }
        setOverrides(map);
        setOverrideMeta(metaMap);
      })
      .catch(() => {});
  }, []);

  const [users, setUsers] = useState<AdminUser[] | null>(null);
  const [usersError, setUsersError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [selectedUserId, setSelectedUserId] = useState<string | null>(null);
  const [userEnts, setUserEnts] = useState<UserEntitlement[] | null>(null);
  const [grantProductId, setGrantProductId] = useState('');
  const [grantSource, setGrantSource] = useState('admin-grant');

  useEffect(() => {
    if (tab !== 'users') return;
    if (users !== null) return;
    adminFetchUsers()
      .then((r) => setUsers(r.users))
      .catch((e) => setUsersError(e.message || 'Failed to load users'));
  }, [tab, users]);

  useEffect(() => {
    if (!selectedUserId) return;
    setUserEnts(null);
    adminFetchUserEntitlements(selectedUserId)
      .then((r) => setUserEnts(r.entitlements))
      .catch(() => setUserEnts([]));
  }, [selectedUserId]);

  if (!ent.isAdmin) {
    return (
      <div className="min-h-screen bg-[#0a0e14] text-zinc-100 flex flex-col items-center justify-center p-6 text-center">
        <Shield className="w-10 h-10 text-zinc-700 mb-4" />
        <h1 className="text-lg font-semibold mb-1">Admin only</h1>
        <p className="text-sm text-zinc-400 mb-4">You need admin access to view this page.</p>
        <button
          onClick={() => setView('incident-board')}
          className="px-4 py-2 rounded bg-zinc-800 text-zinc-200 hover:bg-zinc-700 text-sm"
        >
          Back to dashboard
        </button>
      </div>
    );
  }

  const updateOverride = async (id: string, patch: CatalogOverride) => {
    const prev = overrides[id] || {};
    const merged: CatalogOverride = { ...prev, ...patch };
    setOverrides({ ...overrides, [id]: merged });
    applyCatalogOverrides([{ productId: id, ...merged }]);
    try {
      const res = await adminSaveCatalogOverride(id, merged);
      setOverrideMeta((cur) => ({
        ...cur,
        [id]: {
          updatedAt: res.updatedAt,
          editor: {
            id: res.updatedByUserId ?? 'me',
            displayName: 'You',
            email: null,
          },
        },
      }));
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Failed to save catalog override';
      toast.error(message);
    }
  };

  const revert = async (id: string) => {
    try {
      await adminRevertCatalogOverride(id);
      revertCatalogProduct(id);
      setOverrides((cur) => {
        const next = { ...cur };
        delete next[id];
        return next;
      });
      setOverrideMeta((cur) => {
        const next = { ...cur };
        delete next[id];
        return next;
      });
      toast.success('Reverted to original values.');
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Failed to revert catalog entry.';
      toast.error(message);
    }
  };

  const startEdit = (p: CatalogProduct) => {
    setEditing(p.id);
    const o = overrides[p.id] || {};
    setDraft({
      shortDescription: o.shortDescription ?? p.shortDescription,
      longDescription: o.longDescription ?? p.longDescription,
      tags: o.tags ?? p.tags,
    });
  };
  const saveEdit = async (id: string) => {
    await updateOverride(id, draft);
    setEditing(null);
    toast.success('Catalog entry updated.');
  };

  const filteredUsers = (users || []).filter((u) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return (
      (u.email || '').toLowerCase().includes(q) ||
      (u.displayName || '').toLowerCase().includes(q) ||
      (u.clerkId || '').toLowerCase().includes(q)
    );
  });

  const grant = async () => {
    if (!selectedUserId || !grantProductId) return;
    try {
      await adminGrantEntitlement(selectedUserId, grantProductId, grantSource);
      toast.success('Entitlement granted.');
      const r = await adminFetchUserEntitlements(selectedUserId);
      setUserEnts(r.entitlements);
      setGrantProductId('');
    } catch (e: any) {
      toast.error(e.message || 'Failed to grant entitlement.');
    }
  };
  const reloadUsers = async () => {
    try {
      const r = await adminFetchUsers();
      setUsers(r.users);
    } catch (e: any) {
      setUsersError(e?.message || 'Failed to reload users');
    }
  };

  const toggleAdmin = async (target: AdminUser) => {
    const next = !target.isAdmin;
    const verb = next ? 'Promote to admin' : 'Demote to regular user';
    if (!window.confirm(`${verb} — ${target.email || target.displayName || target.id}?`)) return;
    try {
      await adminUpdateUserRole(target.id, { isAdmin: next });
      toast.success(next ? 'Promoted to admin.' : 'Demoted to regular user.');
      await reloadUsers();
    } catch (e: any) {
      toast.error(e?.message || 'Failed to update role.');
    }
  };

  const toggleSuperAdmin = async (target: AdminUser) => {
    const next = !target.isSuperAdmin;
    const verb = next ? 'Grant SUPER ADMIN to' : 'Revoke super admin from';
    if (!window.confirm(`${verb} ${target.email || target.displayName || target.id}? Super admins can manage other users.`)) return;
    try {
      await adminUpdateUserRole(target.id, { isSuperAdmin: next });
      toast.success(next ? 'Super admin granted.' : 'Super admin revoked.');
      await reloadUsers();
    } catch (e: any) {
      toast.error(e?.message || 'Failed to update role.');
    }
  };

  const deleteUser = async (target: AdminUser) => {
    const label = target.email || target.displayName || target.id;
    if (!window.confirm(`Delete user ${label}? This removes their profile, entitlements, and purchase history. This cannot be undone.`)) return;
    if (!window.confirm(`Final confirmation: permanently delete ${label}?`)) return;
    try {
      await adminDeleteUser(target.id);
      toast.success('User deleted.');
      if (selectedUserId === target.id) {
        setSelectedUserId(null);
        setUserEnts(null);
      }
      await reloadUsers();
    } catch (e: any) {
      toast.error(e?.message || 'Failed to delete user.');
    }
  };

  const revoke = async (entitlementId: string) => {
    if (!selectedUserId) return;
    try {
      await adminRevokeEntitlement(selectedUserId, entitlementId);
      toast.success('Entitlement revoked.');
      const r = await adminFetchUserEntitlements(selectedUserId);
      setUserEnts(r.entitlements);
    } catch (e: any) {
      toast.error(e.message || 'Failed to revoke entitlement.');
    }
  };

  return (
    <div className="min-h-screen bg-[#0a0e14] text-zinc-100">
      <header className="border-b border-zinc-800/60 bg-zinc-900/50 sticky top-0 z-30 backdrop-blur-sm">
        <div className="max-w-6xl mx-auto px-4 py-3 flex items-center gap-3">
          <button
            onClick={() => setView('incident-board')}
            className="text-zinc-400 hover:text-cyan-400 p-1"
          >
            <ArrowLeft className="w-5 h-5" />
          </button>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-bold font-mono tracking-wide text-emerald-400">ADMIN</h1>
            <p className="text-xs text-zinc-500">Catalog & entitlement management</p>
          </div>
          <div className="flex bg-zinc-900 border border-zinc-800 rounded-lg overflow-hidden text-xs">
            <button
              onClick={() => setTab('catalog')}
              className={`px-3 py-1.5 font-mono uppercase tracking-wider ${
                tab === 'catalog' ? 'bg-zinc-800 text-emerald-300' : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Catalog
            </button>
            <button
              onClick={() => setTab('users')}
              className={`px-3 py-1.5 font-mono uppercase tracking-wider ${
                tab === 'users' ? 'bg-zinc-800 text-emerald-300' : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Users
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6 pb-24">
        {tab === 'catalog' && (
          <div className="space-y-3">
            {CATALOG.map((p) => {
              const o = overrides[p.id] || {};
              const status = o.status ?? p.status;
              const featured = o.featured ?? p.featured;
              const isEditing = editing === p.id;
              return (
                <div
                  key={p.id}
                  className="bg-zinc-900/60 border border-zinc-800/60 rounded-xl p-4"
                >
                  <div className="flex items-start justify-between gap-3 mb-2 flex-wrap">
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-semibold text-zinc-100">{p.name}</h3>
                        <span className="text-[11px] font-mono text-zinc-500 uppercase">
                          {p.id}
                        </span>
                        <span
                          className={`text-[10px] font-mono uppercase px-2 py-0.5 rounded border ${
                            status === 'available'
                              ? 'bg-emerald-500/10 text-emerald-300 border-emerald-500/30'
                              : status === 'coming-soon'
                                ? 'bg-amber-500/10 text-amber-300 border-amber-500/30'
                                : 'bg-zinc-700/40 text-zinc-400 border-zinc-700/40'
                          }`}
                        >
                          {status}
                        </span>
                        {featured && (
                          <span className="text-[10px] font-mono uppercase px-2 py-0.5 rounded border bg-cyan-500/10 text-cyan-300 border-cyan-500/30">
                            Featured
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-zinc-400 mt-1">
                        {(o.shortDescription ?? p.shortDescription)} •{' '}
                        <span className="font-mono text-zinc-500">
                          {p.pricingType === 'free' ? 'Free' : formatPrice(p.priceAmountCents)}
                          {p.pricingType === 'subscription-monthly' ? '/mo' : ''}
                        </span>
                      </p>
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button
                        title={status === 'disabled' ? 'Enable' : 'Disable'}
                        onClick={() =>
                          updateOverride(p.id, {
                            status: status === 'disabled' ? 'available' : 'disabled',
                          })
                        }
                        className="p-1.5 rounded hover:bg-zinc-800 text-zinc-400"
                      >
                        {status === 'disabled' ? <Power size={14} /> : <PowerOff size={14} />}
                      </button>
                      <button
                        title="Toggle featured"
                        onClick={() => updateOverride(p.id, { featured: !featured })}
                        className="p-1.5 rounded hover:bg-zinc-800 text-zinc-400"
                      >
                        {featured ? <StarOff size={14} /> : <Star size={14} />}
                      </button>
                      <button
                        title="Edit"
                        onClick={() => (isEditing ? setEditing(null) : startEdit(p))}
                        className="p-1.5 rounded hover:bg-zinc-800 text-zinc-400"
                      >
                        {isEditing ? <X size={14} /> : <Pencil size={14} />}
                      </button>
                      {overrides[p.id] && (
                        <button
                          title="Revert to original"
                          onClick={() => revert(p.id)}
                          className="p-1.5 rounded hover:bg-zinc-800 text-amber-400"
                        >
                          <Undo2 size={14} />
                        </button>
                      )}
                    </div>
                  </div>
                  {overrideMeta[p.id]?.updatedAt && (
                    <p className="text-[11px] text-zinc-500 font-mono mt-1">
                      edited by{' '}
                      <span className="text-zinc-300">
                        {overrideMeta[p.id]?.editor?.displayName ||
                          overrideMeta[p.id]?.editor?.email ||
                          overrideMeta[p.id]?.editor?.id ||
                          'unknown'}
                      </span>{' '}
                      · {formatRelativeTime(overrideMeta[p.id]?.updatedAt)}
                    </p>
                  )}
                  {isEditing && (
                    <div className="mt-3 space-y-2">
                      <label className="block text-[11px] font-mono uppercase tracking-wider text-zinc-500">
                        Short description
                      </label>
                      <input
                        value={draft.shortDescription ?? ''}
                        onChange={(e) => setDraft({ ...draft, shortDescription: e.target.value })}
                        className="w-full bg-zinc-950 border border-zinc-800 rounded px-2 py-1.5 text-sm text-zinc-100"
                      />
                      <label className="block text-[11px] font-mono uppercase tracking-wider text-zinc-500">
                        Long description
                      </label>
                      <textarea
                        rows={3}
                        value={draft.longDescription ?? ''}
                        onChange={(e) => setDraft({ ...draft, longDescription: e.target.value })}
                        className="w-full bg-zinc-950 border border-zinc-800 rounded px-2 py-1.5 text-sm text-zinc-100"
                      />
                      <label className="block text-[11px] font-mono uppercase tracking-wider text-zinc-500">
                        Tags (comma separated)
                      </label>
                      <input
                        value={(draft.tags || []).join(', ')}
                        onChange={(e) =>
                          setDraft({
                            ...draft,
                            tags: e.target.value
                              .split(',')
                              .map((t) => t.trim())
                              .filter(Boolean),
                          })
                        }
                        className="w-full bg-zinc-950 border border-zinc-800 rounded px-2 py-1.5 text-sm text-zinc-100"
                      />
                      <div className="flex justify-end">
                        <button
                          onClick={() => saveEdit(p.id)}
                          className="flex items-center gap-1.5 px-3 py-1.5 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-mono uppercase tracking-wider hover:bg-emerald-500/20"
                        >
                          <Save size={12} /> Save
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
            <p className="text-[11px] text-zinc-600 mt-3">
              Catalog overrides are saved to the server and applied for every user on load. Edits to
              status, featured flag, copy, and tags take effect immediately across all sessions.
            </p>
          </div>
        )}

        {tab === 'users' && (
          <div className="grid gap-4 md:grid-cols-[1fr_1.4fr]">
            <div className="bg-zinc-900/60 border border-zinc-800/60 rounded-xl p-4">
              <div className="flex items-center gap-2 mb-3">
                <UserSearch size={14} className="text-zinc-500" />
                <input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search users…"
                  className="flex-1 bg-zinc-950 border border-zinc-800 rounded px-2 py-1.5 text-sm text-zinc-100"
                />
              </div>
              {usersError && <p className="text-xs text-red-400">{usersError}</p>}
              {!users && !usersError && (
                <p className="text-xs text-zinc-500">Loading users…</p>
              )}
              <div className="space-y-1 max-h-[60vh] overflow-y-auto">
                {filteredUsers.map((u) => {
                  return (
                    <div
                      key={u.id}
                      className={`w-full px-3 py-2 rounded-lg border transition-colors ${
                        selectedUserId === u.id
                          ? 'border-emerald-500/40 bg-emerald-500/5'
                          : 'border-zinc-800/60 hover:border-zinc-700/60'
                      }`}
                    >
                      <button
                        type="button"
                        onClick={() => setSelectedUserId(u.id)}
                        className="w-full text-left"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-sm text-zinc-100 truncate">
                            {u.displayName || u.email || u.clerkId || u.id}
                          </span>
                          <span className="flex items-center gap-1 shrink-0">
                            {u.isSuperAdmin && (
                              <span
                                title="Super admin"
                                className="text-[9px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded bg-cyan-500/10 text-cyan-300 border border-cyan-500/30"
                              >
                                Super
                              </span>
                            )}
                            {u.isAdmin && (
                              <Shield size={12} className="text-emerald-400" />
                            )}
                          </span>
                        </div>
                        {u.email && (
                          <span className="text-[11px] text-zinc-500 truncate block">
                            {u.email}
                          </span>
                        )}
                      </button>
                      {ent.isSuperAdmin && (
                        <div className="mt-2 flex items-center gap-1 flex-wrap">
                          <button
                            type="button"
                            onClick={() => toggleAdmin(u)}
                            disabled={u.isSuperAdmin}
                            title={u.isSuperAdmin ? 'Revoke super admin first' : (u.isAdmin ? 'Demote to regular user' : 'Promote to admin')}
                            className="flex items-center gap-1 px-2 py-1 rounded text-[10px] font-mono uppercase tracking-wider border border-zinc-800 hover:border-emerald-500/40 hover:text-emerald-300 text-zinc-400 disabled:opacity-40 disabled:hover:border-zinc-800 disabled:hover:text-zinc-400"
                          >
                            {u.isAdmin ? <ShieldOff size={11} /> : <Shield size={11} />}
                            {u.isAdmin ? 'Demote' : 'Promote'}
                          </button>
                          <button
                            type="button"
                            onClick={() => toggleSuperAdmin(u)}
                            title={u.isSuperAdmin ? 'Revoke super admin' : 'Grant super admin'}
                            className="flex items-center gap-1 px-2 py-1 rounded text-[10px] font-mono uppercase tracking-wider border border-zinc-800 hover:border-cyan-500/40 hover:text-cyan-300 text-zinc-400"
                          >
                            <Shield size={11} />
                            {u.isSuperAdmin ? 'Unsuper' : 'Super'}
                          </button>
                          <button
                            type="button"
                            onClick={() => deleteUser(u)}
                            title="Delete user (server blocks self-deletion)"
                            className="flex items-center gap-1 px-2 py-1 rounded text-[10px] font-mono uppercase tracking-wider border border-zinc-800 hover:border-red-500/40 hover:text-red-300 text-zinc-400 ml-auto"
                          >
                            <Trash2 size={11} />
                            Delete
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
                {users && filteredUsers.length === 0 && (
                  <p className="text-xs text-zinc-500">No users match your search.</p>
                )}
              </div>
            </div>

            <div className="bg-zinc-900/60 border border-zinc-800/60 rounded-xl p-4">
              {!selectedUserId ? (
                <p className="text-sm text-zinc-500">Select a user to inspect entitlements.</p>
              ) : (
                <div>
                  <h3 className="text-sm font-semibold text-zinc-100 mb-3">User entitlements</h3>
                  <div className="flex flex-col sm:flex-row sm:items-center gap-2 mb-3">
                    <select
                      value={grantProductId}
                      onChange={(e) => setGrantProductId(e.target.value)}
                      className="flex-1 bg-zinc-950 border border-zinc-800 rounded px-2 py-1.5 text-xs text-zinc-100"
                    >
                      <option value="">Choose product to grant…</option>
                      {CATALOG.filter((p) => p.id !== 'base-free').map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.name}
                        </option>
                      ))}
                    </select>
                    <select
                      value={grantSource}
                      onChange={(e) => setGrantSource(e.target.value)}
                      className="bg-zinc-950 border border-zinc-800 rounded px-2 py-1.5 text-xs text-zinc-100"
                      title="Grant source"
                    >
                      <option value="admin-grant">Admin grant</option>
                      <option value="promo-grant">Promo unlock</option>
                      <option value="comp">Comp / support</option>
                      <option value="beta">Beta access</option>
                    </select>
                    <button
                      onClick={grant}
                      disabled={!grantProductId}
                      className="flex items-center gap-1 px-3 py-1.5 rounded bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs font-mono uppercase tracking-wider hover:bg-emerald-500/20 disabled:opacity-50"
                    >
                      <Plus size={12} /> Grant
                    </button>
                  </div>
                  {userEnts === null ? (
                    <p className="text-xs text-zinc-500">Loading entitlements…</p>
                  ) : userEnts.length === 0 ? (
                    <p className="text-xs text-zinc-500">No active entitlements.</p>
                  ) : (
                    <div className="space-y-1.5">
                      {userEnts.map((e) => {
                        const product = CATALOG.find((p) => p.id === e.productId);
                        return (
                          <div
                            key={e.id}
                            className="flex items-center justify-between gap-2 px-3 py-2 border border-zinc-800/60 rounded-lg"
                          >
                            <div className="min-w-0">
                              <p className="text-sm text-zinc-100 truncate">
                                {product?.name || e.productId}
                              </p>
                              <p className="text-[11px] text-zinc-500 font-mono truncate">
                                {e.entitlementType} · {e.source}
                                {!e.isActive && ' · revoked'}
                              </p>
                            </div>
                            {e.isActive && (
                              <button
                                onClick={() => revoke(e.id)}
                                className="p-1.5 rounded hover:bg-zinc-800 text-red-400"
                                title="Revoke"
                              >
                                <Trash2 size={14} />
                              </button>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

// Local mock-mode helper exposed for use in dev when API is missing
export function applyLocalEntitlement(productId: string, action: 'grant' | 'revoke') {
  if (action === 'grant') addOwnedProduct(productId);
  else removeOwnedProduct(productId);
}
