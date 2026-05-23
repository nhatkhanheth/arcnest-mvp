export type Activity = {
  id: string;
  groupId: string;
  actorUserId?: string;
  actorMemberId?: string;
  type:
    | "group_created"
    | "group_edited"
    | "group_archived"
    | "group_deleted"
    | "member_joined"
    | "member_removed"
    | "role_changed"
    | "expense_created"
    | "expense_edited"
    | "expense_voided"
    | "expense_deleted"
    | "payment_started"
    | "payment_paid"
    | "payment_failed"
    | "treasury_deposit"
    | "treasury_payment"
    | "invite_created"
    | "invite_used";
  targetId?: string;
  metadata?: Record<string, unknown>;
  createdAt: number;
};
