import { isApiAvailable, pullWorkspace, pushWorkspace } from "./neonApi.js";

export { isApiAvailable };

function workspacePayload(state) {
  return {
    clients: state.clients || [],
    projects: state.projects || [],
    settings: {
      bookMeta: state.bookMeta,
      locations: state.locations,
      activeLocationId: state.activeLocationId,
      priceBook: state.priceBook,
    },
  };
}

export async function initFromNeon(getState, setState) {
  if (!(await isApiAvailable())) return { mode: "local" };

  try {
    setState({ dbStatus: "syncing", dbError: null });
    const remote = await pullWorkspace();
    const hasRemote = (remote.projects?.length || 0) + (remote.clients?.length || 0) > 0;
    const local = getState();

    if (hasRemote) {
      const patch = { clients: remote.clients, projects: remote.projects, dbStatus: "synced" };
      if (remote.settings?.priceBook) {
        patch.priceBook = remote.settings.priceBook;
        patch.bookMeta = remote.settings.bookMeta || local.bookMeta;
        patch.locations = remote.settings.locations || local.locations;
        patch.activeLocationId = remote.settings.activeLocationId || local.activeLocationId;
      }
      setState(patch);
      return { mode: "remote" };
    }

    if (local.projects.length || local.clients.length) {
      await pushWorkspace(workspacePayload(local));
      setState({ dbStatus: "synced" });
      return { mode: "seeded" };
    }

    setState({ dbStatus: "synced" });
    return { mode: "empty" };
  } catch (err) {
    console.warn("Neon sync failed:", err);
    setState({ dbStatus: "error", dbError: err.message });
    return { mode: "error", error: err };
  }
}

let _timer;
export function queueNeonSync(get) {
  clearTimeout(_timer);
  _timer = setTimeout(async () => {
    if (!(await isApiAvailable())) return;
    try {
      await pushWorkspace(workspacePayload(get()));
    } catch (err) {
      console.warn("Neon background sync:", err);
    }
  }, 800);
}

export async function pushProjectToNeon(project) {
  if (!(await isApiAvailable()) || !project) return;
  await pushWorkspace({ clients: [], projects: [project], settings: null });
}
