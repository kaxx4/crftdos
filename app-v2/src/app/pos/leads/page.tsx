"use client";

/** Leads.
 *
 *  Staff log potential-customer details — bulk order enquiries or a single
 *  custom-tee request — with a free-text notes field for what they want and
 *  anything else worth remembering. Org-wide, not tied to a stall, same as
 *  B2B: a lead someone jots down at one stall should be visible to whoever
 *  picks up the phone next, wherever they're standing. */

import { useState } from "react";
import { getBackend } from "@/lib/backend";
import { useAsync, useAction } from "@/lib/hooks/useAsync";
import type { Lead } from "@/lib/domain/types";
import { Banner, Button, EmptyState, Field, Panel, Sheet, Skeleton } from "@/components/ui";
import { PosShell } from "@/features/pos/PosShell";

export default function LeadsPage() {
  const leads = useAsync(() => getBackend().listLeads(), []);
  const save = useAction();

  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Lead | null>(null);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [notes, setNotes] = useState("");

  function openCreate() {
    setEditing(null);
    setName("");
    setPhone("");
    setNotes("");
    setOpen(true);
  }

  function openEdit(lead: Lead) {
    setEditing(lead);
    setName(lead.name);
    setPhone(lead.phone ?? "");
    setNotes(lead.notes ?? "");
    setOpen(true);
  }

  async function submit() {
    if (!name.trim()) return;
    const res = editing
      ? await save.run(() =>
          getBackend().updateLead(editing.id, {
            name: name.trim(),
            phone: phone.trim() || null,
            notes: notes.trim() || null,
          })
        )
      : await save.run(() =>
          getBackend().createLead({
            name: name.trim(),
            phone: phone.trim() || null,
            notes: notes.trim() || null,
          })
        );
    if (res) {
      setOpen(false);
      void leads.reload();
    }
  }

  return (
    <PosShell title="Leads">
      <div className="flex flex-col gap-4 p-3">
        {leads.error && <Banner tone="danger" title="Couldn't load leads">{leads.error}</Banner>}

        <Panel
          title={`Leads${leads.data ? ` (${leads.data.length})` : ""}`}
          action={
            <Button size="md" variant="primary" onClick={openCreate}>
              Log a lead
            </Button>
          }
        >
          {leads.loading ? (
            <div className="flex flex-col gap-2">
              <Skeleton className="h-16" />
              <Skeleton className="h-16" />
            </div>
          ) : !leads.data || leads.data.length === 0 ? (
            <EmptyState
              headline="No leads logged yet"
              teach="A lead is a potential customer worth following up — a bulk order enquiry, a custom-tee request, anything that isn't a sale yet. Log the name and what they want; it's visible to every stall."
            />
          ) : (
            <ul className="flex flex-col divide-y divide-[var(--color-line)]">
              {leads.data.map((lead) => (
                <li key={lead.id} className="flex items-start justify-between gap-3 py-3">
                  <div className="flex flex-col gap-0.5">
                    <span className="font-bold">{lead.name}</span>
                    {lead.phone && <span className="text-sm text-[var(--color-muted)]">{lead.phone}</span>}
                    {lead.notes && <span className="text-sm">{lead.notes}</span>}
                    <span className="text-xs text-[var(--color-muted)]">
                      Logged by {lead.logged_by} ·{" "}
                      {new Date(lead.created_at).toLocaleString("en-IN", {
                        hour: "2-digit",
                        minute: "2-digit",
                        day: "2-digit",
                        month: "short",
                      })}
                    </span>
                  </div>
                  <Button size="md" variant="ghost" onClick={() => openEdit(lead)}>
                    Edit
                  </Button>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Sheet
          open={open}
          onClose={() => setOpen(false)}
          title={editing ? "Edit lead" : "Log a lead"}
          footer={
            <Button
              variant="primary"
              size="lg"
              block
              busy={save.busy}
              disabled={!name.trim()}
              onClick={() => void submit()}
            >
              {editing ? "Save changes" : "Log lead"}
            </Button>
          }
        >
          <div className="flex flex-col gap-3">
            <Field label="Name" value={name} onChange={(e) => setName(e.target.value)} />
            <Field
              label="Phone (optional)"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              inputMode="tel"
            />
            <div>
              <label htmlFor="lead-notes" className="text-sm font-semibold">
                Notes (optional)
              </label>
              <textarea
                id="lead-notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
                rows={4}
                placeholder="What they want, and anything else worth remembering…"
                className="mt-1.5 w-full rounded-lg border-2 border-[var(--color-line)] p-3 text-base"
              />
            </div>
            {save.error && <Banner tone="danger">{save.error}</Banner>}
          </div>
        </Sheet>
      </div>
    </PosShell>
  );
}
