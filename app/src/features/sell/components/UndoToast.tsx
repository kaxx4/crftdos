export function UndoToast({ onUndo }: { onUndo: () => void }) {
  return (
    <div className="fixed bottom-16 left-0 right-0 flex justify-center z-40 px-4">
      <div className="bg-ink text-cream px-4 py-3 flex items-center gap-3 border-2 border-blue motion-safe:animate-[pos-enter_var(--dur-pos)_var(--ease-out-strong)_both]">
        <span className="text-sm font-bold">Sale done.</span>
        <button onClick={onUndo} className="text-blue font-extrabold text-sm underline min-h-[48px] px-1">
          UNDO
        </button>
      </div>
    </div>
  );
}
