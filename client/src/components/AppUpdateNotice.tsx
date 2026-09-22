import { useEffect, useState } from "react";
import { applyAppUpdate, isUpdateReady, subscribeToUpdates } from "../utils/pwaUpdates";

export function AppUpdateNotice() {
  const [ready, setReady] = useState(isUpdateReady);
  useEffect(() => subscribeToUpdates(() => setReady(isUpdateReady())), []);
  if (!ready) return null;
  return <aside className="app-update-notice" role="status" aria-live="polite">
    <div><strong>Nueva versión lista</strong><p>Guarda lo que estés editando y actualiza para ver los cambios.</p></div>
    <button type="button" className="btn btn--primary" onClick={applyAppUpdate}>Actualizar</button>
  </aside>;
}
