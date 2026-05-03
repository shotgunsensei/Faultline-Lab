import { useEffect, useState, useSyncExternalStore } from 'react';
import { useAppStore } from '@/stores/useAppStore';
import {
  CATALOG,
  applyCatalogOverrides,
  revertCatalogProduct,
  subscribeCatalog,
  type CatalogProduct,
} from '@/data/catalog';
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
  adminFetchCatalogOverrideHistory,
  adminRollbackCatalogOverride,
  type CatalogOverridePayload,
  type CatalogOverrideHistoryEntry,
} from '@/lib/api';
import { toast } from 'sonner';
import { ArrowLeft, FilePlus, Shield } from 'lucide-react';
import AdminCaseAuthoringPanel from './AdminCaseAuthoringPanel';
import { CatalogTab, type CatalogOverrideMeta } from './admin/CatalogTab';
import {
  UsersTab,
  type AdminUser,
  type UserEntitlement,
} from './admin/UsersTab';
import { CatalogHistoryDrawer } from './admin/CatalogHistoryDrawer';

type CatalogOverride = CatalogOverridePayload;

function readOverrideRecords(raw: Array<Record<string, unknown>>): {
  map: Record<string, CatalogOverride>;
  metaMap: Record<string, CatalogOverrideMeta>;
} {
  const map: Record<string, CatalogOverride> = {};
  const metaMap: Record<string, CatalogOverrideMeta> = {};
  for (const item of raw) {
    const productId = String(item.productId || '');
    if (!productId) continue;
    const override: CatalogOverride = {};
    if (item.status === 'available' || item.status === 'coming-soon' || item.status === 'disabled') {
      override.status = item.status;
    }
    if (typeof item.featured === 'boolean') override.featured = item.featured;
    if (typeof item.shortDescription === 'string') override.shortDescription = item.shortDescription;
    if (typeof item.longDescription === 'string') override.longDescription = item.longDescription;
    if (Array.isArray(item.tags)) {
      override.tags = item.tags.filter((t): t is string => typeof t === 'string');
    }
    map[productId] = override;
    const editorRaw = item.editor as
      | { id?: unknown; displayName?: unknown; email?: unknown }
      | null
      | undefined;
    metaMap[productId] = {
      updatedAt: typeof item.updatedAt === 'string' ? item.updatedAt : null,
      editor:
        editorRaw && typeof editorRaw.id === 'string'
          ? {
              id: editorRaw.id,
              displayName:
                typeof editorRaw.displayName === 'string' ? editorRaw.displayName : null,
              email: typeof editorRaw.email === 'string' ? editorRaw.email : null,
            }
          : null,
    };
  }
  return { map, metaMap };
}

export default function AdminPanel() {
  const setView = useAppStore((s) => s.setView);
  const ent = useSyncExternalStore(
    (cb) => subscribeEntitlements(cb),
    () => getEntitlements()
  );
  const [tab, setTab] = useState<'catalog' | 'users' | 'authoring'>('catalog');
  const [overrides, setOverrides] = useState<Record<string, CatalogOverride>>({});
  const [overrideMeta, setOverrideMeta] = useState<Record<string, CatalogOverrideMeta>>({});
  const [editing, setEditing] = useState<string | null>(null);
  const [draft, setDraft] = useState<CatalogOverride>({});
  const [historyFor, setHistoryFor] = useState<string | null>(null);
  const [historyEntries, setHistoryEntries] = useState<CatalogOverrideHistoryEntry[] | null>(null);
  const [historyLoading, setHistoryLoading] = useState(false);
  useSyncExternalStore(
    (cb) => subscribeCatalog(cb),
    () => CATALOG.length
  );

  useEffect(() => {
    adminFetchCatalogOverrides()
      .then((r: { overrides?: Array<Record<string, unknown>> }) => {
        const { map, metaMap } = readOverrideRecords(r.overrides || []);
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

  const openHistory = async (productId: string) => {
    setHistoryFor(productId);
    setHistoryEntries(null);
    setHistoryLoading(true);
    try {
      const res = await adminFetchCatalogOverrideHistory(productId);
      setHistoryEntries(res.history);
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Failed to load history.';
      toast.error(message);
      setHistoryEntries([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  const refreshOverridesFromServer = async () => {
    try {
      const r = await adminFetchCatalogOverrides();
      const { map, metaMap } = readOverrideRecords(
        (r.overrides || []) as Array<Record<string, unknown>>
      );
      const previousIds = new Set(Object.keys(overrides));
      setOverrides(map);
      setOverrideMeta(metaMap);
      const allIds = new Set<string>([...previousIds, ...Object.keys(map)]);
      for (const id of allIds) {
        if (map[id]) {
          applyCatalogOverrides([{ productId: id, ...map[id] }]);
        } else {
          revertCatalogProduct(id);
        }
      }
    } catch {}
  };

  const rollbackTo = async (productId: string, entry: CatalogOverrideHistoryEntry) => {
    try {
      await adminRollbackCatalogOverride(productId, entry.id);
      await refreshOverridesFromServer();
      const res = await adminFetchCatalogOverrideHistory(productId);
      setHistoryEntries(res.history);
      toast.success(
        entry.overrides === null
          ? 'Rolled back to defaults.'
          : 'Rolled back to selected version.'
      );
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : 'Failed to roll back.';
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
    if (
      !window.confirm(
        `${verb} ${target.email || target.displayName || target.id}? Super admins can manage other users.`
      )
    )
      return;
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
    if (
      !window.confirm(
        `Delete user ${label}? This removes their profile, entitlements, and purchase history. This cannot be undone.`
      )
    )
      return;
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
                tab === 'catalog'
                  ? 'bg-zinc-800 text-emerald-300'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Catalog
            </button>
            <button
              onClick={() => setTab('users')}
              className={`px-3 py-1.5 font-mono uppercase tracking-wider ${
                tab === 'users'
                  ? 'bg-zinc-800 text-emerald-300'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              Users
            </button>
            <button
              onClick={() => setTab('authoring')}
              className={`px-3 py-1.5 font-mono uppercase tracking-wider flex items-center gap-1 ${
                tab === 'authoring'
                  ? 'bg-zinc-800 text-emerald-300'
                  : 'text-zinc-400 hover:text-zinc-200'
              }`}
            >
              <FilePlus size={12} /> Authoring
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-4 py-6 pb-24">
        {tab === 'catalog' && (
          <CatalogTab
            overrides={overrides}
            overrideMeta={overrideMeta}
            editing={editing}
            draft={draft}
            setDraft={setDraft}
            setEditing={setEditing}
            startEdit={startEdit}
            saveEdit={(id) => void saveEdit(id)}
            updateOverride={(id, patch) => void updateOverride(id, patch)}
            revert={(id) => void revert(id)}
            openHistory={(id) => void openHistory(id)}
          />
        )}

        {tab === 'users' && (
          <UsersTab
            users={users}
            usersError={usersError}
            search={search}
            setSearch={setSearch}
            filteredUsers={filteredUsers}
            selectedUserId={selectedUserId}
            setSelectedUserId={setSelectedUserId}
            userEnts={userEnts}
            grantProductId={grantProductId}
            setGrantProductId={setGrantProductId}
            grantSource={grantSource}
            setGrantSource={setGrantSource}
            isSuperAdmin={!!ent.isSuperAdmin}
            toggleAdmin={(u) => void toggleAdmin(u)}
            toggleSuperAdmin={(u) => void toggleSuperAdmin(u)}
            deleteUser={(u) => void deleteUser(u)}
            grant={() => void grant()}
            revoke={(id) => void revoke(id)}
          />
        )}
        {tab === 'authoring' && <AdminCaseAuthoringPanel />}
      </main>

      {historyFor && (
        <CatalogHistoryDrawer
          productId={historyFor}
          entries={historyEntries}
          loading={historyLoading}
          onClose={() => setHistoryFor(null)}
          onRollback={(entry) => void rollbackTo(historyFor, entry)}
        />
      )}
    </div>
  );
}

// Local mock-mode helper exposed for use in dev when API is missing
export function applyLocalEntitlement(productId: string, action: 'grant' | 'revoke') {
  if (action === 'grant') addOwnedProduct(productId);
  else removeOwnedProduct(productId);
}
