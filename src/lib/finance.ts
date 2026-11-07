export type FinancialAccount = {
  id: string;
  initial_balance?: number | string | null;
  initial_status?: string | null;
};

export type FinancialMovement = {
  status?: string | null;
  direction?: "entrada" | "saida" | "transferencia" | string | null;
  amount?: number | string | null;
  account_id?: string | null;
  transfer_account_id?: string | null;
};

export function moneyToCents(value: unknown): number {
  const amount = Number(value ?? 0);
  return Number.isFinite(amount) ? Math.round(amount * 100) : 0;
}

export function calculateAccountBalances<T extends FinancialAccount>(
  accounts: T[] = [],
  transactions: FinancialMovement[] = [],
) {
  return accounts.map((account) => {
    let cents = account.initial_status === "confirmado" ? moneyToCents(account.initial_balance) : 0;

    for (const movement of transactions) {
      if (movement.status !== "confirmado") continue;
      const amount = moneyToCents(movement.amount);

      if (movement.direction === "entrada" && movement.account_id === account.id) {
        cents += amount;
      } else if (movement.direction === "saida" && movement.account_id === account.id) {
        cents -= amount;
      } else if (movement.direction === "transferencia") {
        if (movement.account_id === account.id) cents -= amount;
        if (movement.transfer_account_id === account.id) cents += amount;
      }
    }

    return { ...account, balance: cents / 100 };
  });
}

export function calculateCashTotal(
  accounts: FinancialAccount[] = [],
  transactions: FinancialMovement[] = [],
): number {
  return calculateAccountBalances(accounts, transactions).reduce(
    (total, account) => total + moneyToCents(account.balance),
    0,
  ) / 100;
}

const normalizeStatus = (value: unknown) =>
  String(value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();

const CLOSED_DEBT_STATUSES = new Set([
  "a_confirmar",
  "estimado",
  "rascunho",
  "quitada",
  "quitado",
  "paga",
  "pago",
  "encerrada",
  "encerrado",
  "cancelada",
  "cancelado",
]);

export function isDebtOpen(debt: { status?: string | null }): boolean {
  return !CLOSED_DEBT_STATUSES.has(normalizeStatus(debt.status));
}
