import { useEffect, useMemo, useState } from "react";
import { ArrowRight, Plus } from "lucide-react";
import type { Expense, ExpenseCategory, ExpenseShare, Group, GroupMember, SplitMode } from "../../models";
import { fxRate } from "../../data/mockData";
import { formatVND } from "../../lib/format";
import type { ExpenseDraft } from "../../services/expenseService";
import { validateExpenseDraft } from "../../services/expenseService";
import { useSettingsStore } from "../../state/useSettingsStore";
import { Button } from "../ui/Button";
import { Input, Select, TextArea } from "../ui/Input";
import { BottomSheet } from "../ui/Modal";
import { ExpenseReview } from "./ExpenseReview";
import { SplitModeSelector } from "./SplitModeSelector";

type AddExpenseSheetProps = {
  open: boolean;
  group: Group;
  members: GroupMember[];
  expense?: Expense;
  onClose: () => void;
  onSave: (draft: ExpenseDraft) => { ok: boolean; message?: string };
};

const categories: ExpenseCategory[] = ["Food", "Travel", "Bills", "Sports", "Shopping", "Entertainment", "Other"];

function toUSDC(amountVND: number) {
  return (amountVND / fxRate.usdcToVnd).toFixed(2);
}

export function AddExpenseSheet({ open, group, members, expense, onClose, onSave }: AddExpenseSheetProps) {
  const { defaultSplitMode } = useSettingsStore();
  const [step, setStep] = useState<"details" | "review">("details");
  const [title, setTitle] = useState("Dinner after tennis");
  const [amountVND, setAmountVND] = useState(980000);
  const [category, setCategory] = useState<ExpenseCategory>("Food");
  const [paidBy, setPaidBy] = useState(members[0]?.id ?? "");
  const [participants, setParticipants] = useState<string[]>(members.map((member) => member.id));
  const [splitMode, setSplitMode] = useState<SplitMode>("equal");
  const [fixedAmount, setFixedAmount] = useState(245000);
  const [customAmounts, setCustomAmounts] = useState<Record<string, number>>(
    Object.fromEntries(members.map((member) => [member.id, Math.round(980000 / Math.max(members.length, 1))]))
  );
  const [note, setNote] = useState("");
  const [saveError, setSaveError] = useState<string>();

  useEffect(() => {
    if (!open) {
      return;
    }

    const fallbackAmount = expense?.amountVND ?? 980000;
    const fallbackParticipants = expense?.participants ?? members.map((member) => member.id);
    const fallbackSplitAmounts =
      expense?.splitAmountsVND ??
      Object.fromEntries(fallbackParticipants.map((memberId) => [memberId, Math.round(fallbackAmount / Math.max(fallbackParticipants.length, 1))]));

    setStep("details");
    setTitle(expense?.title ?? "Dinner after tennis");
    setAmountVND(fallbackAmount);
    setCategory(expense?.category ?? "Food");
    setPaidBy(expense && members.some((member) => member.id === expense.paidBy) ? expense.paidBy : members[0]?.id ?? "");
    setParticipants(fallbackParticipants);
    setSplitMode(expense?.splitMode ?? defaultSplitMode);
    setFixedAmount(Number(Object.values(fallbackSplitAmounts)[0] ?? Math.round(fallbackAmount / Math.max(fallbackParticipants.length, 1))));
    setCustomAmounts(fallbackSplitAmounts);
    setNote(expense?.note ?? "");
    setSaveError(undefined);
  }, [defaultSplitMode, expense, group.id, members, open]);

  const selectedMembers = members.filter((member) => participants.includes(member.id));
  const paidByMember = members.find((member) => member.id === paidBy);

  const shares = useMemo<ExpenseShare[]>(() => {
    if (selectedMembers.length === 0) {
      return [];
    }

    if (splitMode === "treasury") {
      const shareVND = Math.round(amountVND / selectedMembers.length);
      return selectedMembers.map((member) => ({
        memberId: member.id,
        displayName: member.displayName,
        amountVND: shareVND,
        amountUSDC: toUSDC(shareVND),
        direction: "treasury"
      }));
    }

    if (splitMode === "fixed") {
      return selectedMembers
        .filter((member) => member.id !== paidBy)
        .map((member) => ({
          memberId: member.id,
          displayName: member.displayName,
          amountVND: fixedAmount,
          amountUSDC: toUSDC(fixedAmount),
          direction: "owes"
        }));
    }

    if (splitMode === "custom") {
      return selectedMembers
        .filter((member) => member.id !== paidBy)
        .map((member) => {
          const amount = Number(customAmounts[member.id] ?? 0);
          return {
            memberId: member.id,
            displayName: member.displayName,
            amountVND: amount,
            amountUSDC: toUSDC(amount),
            direction: "owes"
          };
        });
    }

    const shareVND = Math.round(amountVND / selectedMembers.length);
    return selectedMembers
      .filter((member) => member.id !== paidBy)
      .map((member) => ({
        memberId: member.id,
        displayName: member.displayName,
        amountVND: shareVND,
        amountUSDC: toUSDC(shareVND),
        direction: "owes"
      }));
  }, [amountVND, customAmounts, fixedAmount, paidBy, selectedMembers, splitMode]);

  const customTotal = Object.entries(customAmounts).reduce((total, [memberId, value]) => {
    if (!participants.includes(memberId)) {
      return total;
    }

    return total + Number(value || 0);
  }, 0);

  const draft = buildDraft();
  const validation = validateExpenseDraft(group, members, draft);
  const warning =
    saveError ??
    (!validation.valid
      ? validation.message
      : splitMode === "custom" && customTotal !== amountVND
        ? `Custom total is ${formatVND(customTotal)}. It must equal ${formatVND(amountVND)}.`
        : selectedMembers.length === 0
          ? "Select at least one participant."
          : undefined);

  function toggleParticipant(memberId: string) {
    setParticipants((current) =>
      current.includes(memberId) ? current.filter((id) => id !== memberId) : [...current, memberId]
    );
  }

  function closeSheet() {
    setStep("details");
    setSaveError(undefined);
    onClose();
  }

  function buildDraft(): ExpenseDraft {
    return {
      title,
      amountVND,
      category,
      paidBy,
      participants,
      splitMode,
      splitAmountsVND:
        splitMode === "fixed"
          ? Object.fromEntries(participants.map((memberId) => [memberId, fixedAmount]))
          : splitMode === "custom"
            ? Object.fromEntries(participants.map((memberId) => [memberId, Number(customAmounts[memberId] ?? 0)]))
            : undefined,
      note
    };
  }

  function saveExpense() {
    const result = onSave(buildDraft());

    if (result.ok) {
      closeSheet();
      return;
    }

    setSaveError(result.message ?? "Could not save expense.");
  }

  return (
    <BottomSheet
      open={open}
      title={step === "details" ? "Add expense" : "Expense review"}
      subtitle={step === "details" ? group.name : expense ? "Review changes before saving" : "Calculated balances before saving"}
      onClose={closeSheet}
    >
      {step === "review" ? (
        <ExpenseReview
          title={title}
          amountVND={amountVND}
          amountUSDC={toUSDC(amountVND)}
          splitMode={splitMode}
          shares={shares}
          warning={warning}
          onBack={() => setStep("details")}
          onSave={saveExpense}
        />
      ) : (
        <div className="space-y-4">
          <Input label="Title" value={title} onChange={(event) => setTitle(event.target.value)} />
          <Input
            label="Amount VND"
            inputMode="numeric"
            value={amountVND}
            onChange={(event) => setAmountVND(Number(event.target.value || 0))}
            rightSlot={<span className="number text-sm text-[var(--text-muted)]">{toUSDC(amountVND)} USDC</span>}
          />
          <Select label="Category" value={category} onChange={(event) => setCategory(event.target.value as ExpenseCategory)}>
            {categories.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </Select>
          <Select label="Paid by" value={paidBy} onChange={(event) => setPaidBy(event.target.value)}>
            {members.map((member) => (
              <option key={member.id} value={member.id}>
                {member.displayName}
              </option>
            ))}
          </Select>
          <div>
            <p className="mb-2 text-xs font-semibold text-[var(--text-muted)]">Participants</p>
            <div className="grid grid-cols-2 gap-2">
              {members.map((member) => {
                const active = participants.includes(member.id);
                return (
                  <button
                    key={member.id}
                    type="button"
                    className={[
                      "focus-ring min-h-[48px] rounded-2xl border px-3 text-left text-sm font-semibold",
                      active ? "border-[var(--arc-accent)] bg-[var(--arc-soft)]" : "border-[var(--border-soft)] bg-[var(--row-bg)]"
                    ].join(" ")}
                    onClick={() => toggleParticipant(member.id)}
                  >
                    {member.displayName}
                  </button>
                );
              })}
            </div>
          </div>
          <SplitModeSelector value={splitMode} onChange={setSplitMode} />
          {splitMode === "fixed" ? (
            <Input
              label="Fixed amount per participant"
              inputMode="numeric"
              value={fixedAmount}
              onChange={(event) => setFixedAmount(Number(event.target.value || 0))}
            />
          ) : null}
          {splitMode === "custom" ? (
            <div className="space-y-3">
              <p className="text-xs font-semibold text-[var(--text-muted)]">Custom shares</p>
              {selectedMembers.map((member) => (
                <Input
                  key={member.id}
                  label={member.displayName}
                  inputMode="numeric"
                  value={customAmounts[member.id] ?? 0}
                  onChange={(event) =>
                    setCustomAmounts((current) => ({ ...current, [member.id]: Number(event.target.value || 0) }))
                  }
                />
              ))}
            </div>
          ) : null}
          <TextArea label="Note" placeholder="Optional" value={note} onChange={(event) => setNote(event.target.value)} />
          <div className="surface-row rounded-[18px] p-4 text-sm text-[var(--text-secondary)]">
            {splitMode === "treasury"
              ? "Participants will owe the group treasury."
              : `${selectedMembers.length} participants. ${paidByMember?.displayName ?? "A member"} receives from others.`}
          </div>
          <Button fullWidth icon={step === "details" ? <ArrowRight size={18} /> : <Plus size={18} />} onClick={() => setStep("review")} disabled={Boolean(warning)}>
            Review balances
          </Button>
        </div>
      )}
    </BottomSheet>
  );
}
