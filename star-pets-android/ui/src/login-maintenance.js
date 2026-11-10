export async function settleLoginMaintenance({
  tick,
  reload,
  onConflict,
  onDeferred,
}) {
  try {
    await tick();
    return 'updated';
  } catch (error) {
    if (error instanceof Error && error.message === '版本冲突') {
      try {
        await reload();
        onConflict?.();
        return 'reloaded';
      } catch {
        // The already validated state remains usable when a refresh also fails.
      }
    }
    onDeferred?.();
    return 'deferred';
  }
}
