import { describe, expect, it } from "vitest";
import { calculateAccountBalances, calculateCashTotal, isDebtOpen } from "@/lib/finance";

const accounts = [
  { id: "renan", initial_balance: 100, initial_status: "confirmado" },
  { id: "leticia", initial_balance: 50, initial_status: "confirmado" },
  { id: "mp", initial_balance: 0, initial_status: "a_confirmar" },
];

describe("financial ledger", () => {
  it("applies confirmed income and expenses to their own account", () => {
    const balances = calculateAccountBalances(accounts, [
      { status: "confirmado", direction: "entrada", amount: 250.1, account_id: "renan" },
      { status: "confirmado", direction: "saida", amount: 25.1, account_id: "renan" },
      { status: "a_confirmar", direction: "entrada", amount: 900, account_id: "leticia" },
    ]);

    expect(balances.map((account) => account.balance)).toEqual([325, 50, 0]);
  });

  it("moves money between accounts without changing consolidated cash", () => {
    const movements = [
      { status: "confirmado", direction: "transferencia", amount: 40.25, account_id: "renan", transfer_account_id: "mp" },
    ];

    expect(calculateAccountBalances(accounts, movements).map((account) => account.balance)).toEqual([
      59.75, 50, 40.25,
    ]);
    expect(calculateCashTotal(accounts, movements)).toBe(150);
  });

  it("uses integer cents to avoid floating-point drift", () => {
    const movements = Array.from({ length: 100 }, () => ({
      status: "confirmado",
      direction: "entrada",
      amount: 0.1,
      account_id: "renan",
    }));

    expect(calculateAccountBalances(accounts, movements)[0].balance).toBe(110);
  });

  it("uses the same open-debt rule in every dashboard", () => {
    expect(isDebtOpen({ status: "ativa" })).toBe(true);
    expect(isDebtOpen({ status: "atrasada" })).toBe(true);
    expect(isDebtOpen({ status: "a_confirmar" })).toBe(false);
    expect(isDebtOpen({ status: "PAGA" })).toBe(false);
    expect(isDebtOpen({ status: "quitada" })).toBe(false);
  });
});
