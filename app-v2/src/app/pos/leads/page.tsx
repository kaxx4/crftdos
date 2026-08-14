"use client";

/** Leads.
 *
 *  Staff log potential-customer details — bulk order enquiries or a single
 *  custom-tee request — with a free-text notes field for what they want and
 *  anything else worth remembering. Org-wide, not tied to a stall, same as
 *  B2B: a lead someone jots down at one stall should be visible to whoever
 *  picks up the phone next, wherever they're standing.
 *
 *  "Log a lead" is the whole point of the screen, so it is the pinned action
 *  rather than a small button in a panel header — this gets tapped mid-
 *  conversation with somebody standing in front of you. */

import { useState } from "react";
import { getBackend } from "@/lib/backend";
import { useAsync, useAction } from "@/lib/hooks/useAsync";
import type { Lead } from "@/lib/domain/types";
import {
  Banner,
  Button,
  EmptyState,
  Field,
  Mono,
  PosScreen,
  Sheet,
  Skeleton,
  Text,
  Textarea,
} from "@/components/ui";
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

  const list = leads.data ?? [];

  return (
    <PosShell title="Leads">
      <PosScreen>
        <PosScreen.Body>
          {leads.error && <Banner tone="danger" title="Couldn't load leads">{leads.error}</Banner>}

          {leads.loading ? (
            <>
              <Skeleton className="h-24" />
              <Skeleton className="h-24" />
            </>
          ) : list.length === 0 ? (
            <EmptyState
              headline="No leads logged yet"
              teach="A lead is a potential customer worth following up — a bulk order enquiry, a custom-tee request, anything that isn't a sale yet. Log the name and what they want; every stall can see it."
            />
          ) : (
            <ul className="flex flex-col gap-[var(--space-3)]">
              {list.map((lead) => (
                <li key={lead.id}>
                  {/* One tone for the whole list: leads are not ranked, and a
                      colour per row would imply they are. */}
                  <button
                    type="button"
                    onClick={() => openEdit(lead)}
                    className="w-full rounded-[var(--radius-lg)] border-[3px] border-[var(--color-ink)] bg-white p-[var(--space-3)] text-left shadow-[var(--shadow-sticker)] transition-[transform,box-shadow] duration-[var(--dur-fast)] active:translate-x-[3px] active:translate-y-[3px] active:shadow-none"
                  >
                    <p className="t-md">{lead.name}</p>
                    {lead.phone && <Mono className="t-base text-[var(--color-muted)]">{lead.phone}</Mono>}
                    {lead.notes && <Text className="mt-[var(--space-1)]">{lead.notes}</Text>}
                    <Text muted className="mt-[var(--space-1)]">
                      Logged by {lead.logged_by} ·{" "}
                      {new Date(lead.created_at).toLocaleString("en-IN", {
                        hour: "2-digit",
                        minute: "2-digit",
                        day: "2-digit",
                        month: "short",
                      })}{" "}
                      · tap to edit
                    </Text>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </PosScreen.Body>

        <PosScreen.Foot className="flex flex-col gap-[var(--space-2)]">
          <div className="flex items-end justify-between gap-[var(--space-3)]">
            <span className="t-label text-white/80">Leads logged</span>
            <Mono className="t-xl">{list.length}</Mono>
          </div>
          <Button variant="primary" size="xl" block onClick={openCreate}>
            Log a lead
          </Button>
        </PosScreen.Foot>

        <Sheet
          open={open}
          onClose={() => setOpen(false)}
          title={editing ? "Edit lead" : "Log a lead"}
          footer={
            <Button
              variant="primary"
              size="xl"
              block
              busy={save.busy}
              disabled={!name.trim()}
              onClick={() => void submit()}
            >
              {editing ? "Save changes" : "Log lead"}
            </Button>
          }
        >
          <div className="flex flex-col gap-[var(--space-3)]">
            <Field label="Name" value={name} onChange={(e) => setName(e.target.value)} />
            <Field
              label="Phone (optional)"
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
              inputMode="tel"
            />
            <Textarea
              label="Notes (optional)"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={4}
              placeholder="What they want, and anything else worth remembering…"
            />
            {save.error && <Banner tone="danger">{save.error}</Banner>}
          </div>
        </Sheet>
      </PosScreen>
    </PosShell>
  );
}
